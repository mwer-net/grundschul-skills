import { kann } from '@schoolbox/kern/src/bausteine';
import type { KeyboardEvent } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { BEFEHLE, kannVerschieben, kuerzelIm, kuerzelText, titelVon } from './befehle';
import { ClaudeKnopf } from './ClaudeKnopf';
import type { PfadTeil } from './darstellung';
import { DREH_ABSTAND } from './gestaltung/auswahlrahmen';
import { istGestaltungAuswahl } from './gestaltung/inspektor/kontext-ersatz';
import type { Einblendung } from './Leinwand';
import { fokusZurueckInsBlatt, lageDerLeiste } from './leistenlage';
import { useSichtfeld } from './sichtfeld';
import type { Struktur } from './struktur';
import type { useText } from './text';
import { TextFertig, Textknoepfe } from './Textleiste';
import type { Befehle } from './useBefehle';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	struktur: Struktur;
	befehle: Befehle;
	text: ReturnType<typeof useText>;
}

const Trenner = () => <span aria-hidden className="mx-0.5 h-4 w-px flex-none bg-rand" />;

/** Ein Befehl als Knopf: dieselben Namen, Kürzel und Sperren wie überall sonst. */
const BefehlKnopf = ({ befehle, id, platz }: { befehle: Befehle; id: string; platz?: boolean }) => {
	const k = befehle.jetzt.current;
	const b = BEFEHLE.find((x) => x.id === id);
	if (!b || (!platz && !b.verfuegbar(k))) {
		return null;
	}
	const symbol = (typeof b.symbol === 'function' ? b.symbol(k) : b.symbol) as SymbolName;
	const erstes = kuerzelIm(b, k);
	return (
		<SymbolKnopf
			symbol={symbol}
			beschriftung={titelVon(b, k)}
			groesse="klein"
			{...(erstes ? { kuerzel: kuerzelText(erstes) } : {})}
			disabled={b.gesperrt?.(k) ?? false}
			onClick={() => befehle.fuehreAus(id)}
		/>
	);
};

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein">
		<Symbol name="mehr" />
	</Knopf>
);

const tastenInLeiste = (ereignis: KeyboardEvent<HTMLDivElement>, doc: Document) => {
	const ziel = ereignis.target as HTMLElement;
	if (ereignis.key === 'Escape') {
		ereignis.preventDefault();
		doc.defaultView?.focus();
		return;
	}
	if (!['ArrowLeft', 'ArrowRight'].includes(ereignis.key) || ziel.tagName !== 'BUTTON') {
		return;
	}
	ereignis.preventDefault();
	const alle = [...ereignis.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, input')];
	const schritt = ereignis.key === 'ArrowRight' ? 1 : -1;
	alle[(alle.indexOf(ziel) + schritt + alle.length) % alle.length]?.focus();
};

/** Was die Leiste beim Wechsel in die Textsitzung festhält, damit die Schriftknöpfe nicht springen. */
interface Fest {
	nr: number | null;
	rechts: number;
	pfeile: boolean;
	claude: boolean;
	duplizieren: boolean;
	loeschen: boolean;
}

const KEIN_PLATZ: Fest = { nr: null, rechts: 0, pfeile: false, claude: false, duplizieren: false, loeschen: false };

const da = (befehle: Befehle, id: string) =>
	Boolean(BEFEHLE.find((b) => b.id === id)?.verfuegbar(befehle.jetzt.current));


/**
 * Ende der Leiste: Duplizieren, Löschen, ⋯; in der Sitzung „Fertig“ an derselben Stelle. Beide liegen übereinander
 * in einer Zelle, das jeweils andere unsichtbar: So ist die Leiste in beiden Zuständen gleich breit (204-15).
 */
const LeistenEnde = ({
	befehle,
	fokusDanach,
	platz,
	seite,
	text,
	trenner,
}: Pick<Eigenschaften, 'befehle' | 'text'> & {
	fokusDanach: { current: HTMLElement | null };
	platz: Fest | null;
	seite: boolean;
	trenner: boolean;
}) => (
	<span className="grid flex-none items-center *:col-start-1 *:row-start-1">
		<span className={klassen('flex items-center gap-0.5', platz && 'invisible')} data-leiste-ende>
			{trenner && <Trenner />}
			{(!platz || platz.duplizieren) && (
				<BefehlKnopf platz={Boolean(platz)} befehle={befehle} id="auswahl.duplizieren" />
			)}
			{(!platz || platz.loeschen) && (
				<BefehlKnopf platz={Boolean(platz)} befehle={befehle} id="auswahl.loeschen" />
			)}
			{platz ? (
				<span className="size-knopf-klein flex-none" />
			) : (
				<Menue
					name="Mehr zu diesem Baustein"
					rechtsbuendig
					ausloeser={MEHR_KNOPF}
					eintraege={befehle.menue(seite ? 'seite' : 'baustein')}
					fokusDanach={fokusDanach}
				/>
			)}
		</span>
		{platz && (
			<span className="flex items-center justify-end gap-0.5">
				{trenner && <Trenner />}
				<TextFertig text={text} />
			</span>
		)}
	</span>
);

const boxAufLeinwand = (e: Eigenschaften['e']) =>
	e.box
		? {
				links: e.links + e.box.left * e.skala,
				rechts: e.links + e.box.right * e.skala,
				oben: e.box.top * e.skala,
				unten: e.box.bottom * e.skala,
			}
		: null;

/**
 * Am gewählten Baustein (204): Claude · ↑↓ (nur mit Nachbarn) · B U Hervorheben (nur an Text) · Duplizieren, Löschen ·
 * ⋯. Kein Name, kein Griff, kein „+“, keine Knöpfe der Art: Die stehen im Inspektor und im ⋯. Beim Tippen bleiben die
 * Schriftknöpfe und „Fertig“ an ihrem Platz; die rechte Kante steht.
 */
export const Bausteinleiste = ({ befehle, e, pfad, struktur, text }: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const [mass, setMass] = useState({ breite: 300, hoehe: 30 });
	const fest = useRef(KEIN_PLATZ);
	const sicht = useSichtfeld(e.doc);
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;
	const sitzung = text.bearbeitet;

	useLayoutEffect(() => {
		const element = leiste.current;
		if (!element) {
			return;
		}
		const { offsetHeight: hoehe, offsetWidth: breite } = element;
		setMass((alt) => (alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe }));
	});

	// Bei Gestaltung steht dort die eigene Leiste (099); nur die Textsitzung behält diese Leiste mit „Fertig“.
	const gestaltung = istGestaltungAuswahl(gewaehlt?.baustein);
	const box = boxAufLeinwand(e);
	if (!gewaehlt || !box || !sicht || nr === null || !(struktur.aktiv || sitzung) || (gestaltung && !sitzung)) {
		return null;
	}

	const { baustein, name } = gewaehlt;
	// 204-15: Am Gestaltungselement steht die Leiste wie dessen eigene über dem Drehgriff.
	const lage = lageDerLeiste(box, mass, sicht, gestaltung ? DREH_ABSTAND : 0);
	const pfeile = kannVerschieben(befehle.jetzt.current);
	// 194-13: Neu gemessen, sobald ein anderer Baustein gewählt ist, auch mitten in der Sitzung (Tab in der Tabelle).
	if (!sitzung || fest.current.nr !== nr) {
		fest.current = {
			nr,
			rechts: lage.links + mass.breite,
			pfeile,
			claude: da(befehle, 'auswahl.claude'),
			duplizieren: da(befehle, 'auswahl.duplizieren'),
			loeschen: da(befehle, 'auswahl.loeschen'),
		};
	}
	const platz = sitzung ? fest.current : null;
	const links = platz ? platz.rechts - mass.breite : lage.links;
	const claude = platz ? platz.claude : da(befehle, 'auswahl.claude');
	const mitPfeilen = platz ? platz.pfeile : pfeile;
	const mitText = kann(baustein, 'text');
	// Nach dem Schreiben geht der Fokus nach einem Menü ins Blatt zurück, nicht auf ⋯ (204-13).
	const blatt = { current: (e.doc.defaultView?.frameElement as HTMLElement | null | undefined) ?? null };

	return (
		<div
			ref={leiste}
			className={klassen(
				'absolute z-ueberlagerung flex min-h-[30px] items-center gap-0.5 rounded-[7px] border border-rand bg-flaeche px-1 whitespace-nowrap shadow-1',
				e.zieht && 'invisible',
			)}
			role="toolbar"
			aria-label={`Leiste für ${name}`}
			data-bausteinleiste={baustein.art}
			{...(sitzung ? { 'data-textbearbeitung': '' } : {})}
			style={{ left: links, top: lage.top }}
			onKeyDown={(ereignis) => tastenInLeiste(ereignis, e.doc)}
			onClick={(ereignis) => fokusZurueckInsBlatt(ereignis, e.doc)}
		>
			{claude && <ClaudeKnopf befehle={befehle} platzhalter={sitzung} />}
			{mitPfeilen && (
				<span className={klassen('flex items-center', sitzung && 'invisible')}>
					{claude && <Trenner />}
					<BefehlKnopf platz befehle={befehle} id="auswahl.hoch" />
					<BefehlKnopf platz befehle={befehle} id="auswahl.runter" />
				</span>
			)}
			{mitText && (
				<>
					{(claude || mitPfeilen) && <Trenner />}
					<Textknoepfe sitzung={sitzung} text={text} />
				</>
			)}
			<LeistenEnde
				befehle={befehle}
				fokusDanach={blatt}
				platz={platz}
				seite={baustein.art === 'seite'}
				text={text}
				trenner={claude || mitPfeilen || mitText}
			/>
		</div>
	);
};
