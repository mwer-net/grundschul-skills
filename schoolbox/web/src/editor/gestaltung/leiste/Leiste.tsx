import type { KeyboardEvent } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Menue } from '../../../bausteine/Menue';
import { Symbol } from '../../../bausteine/Symbol';
import { SymbolKnopf } from '../../../bausteine/SymbolKnopf';
import { BEFEHLE, kuerzelIm, kuerzelText, titelVon } from '../../befehle';
import { ClaudeKnopf } from '../../ClaudeKnopf';
import type { PfadTeil } from '../../darstellung';
import { elementZu } from '../../darstellung';
import type { Einblendung } from '../../Leinwand';
import type { Kante } from '../../leistenlage';
import { fokusZurueckInsBlatt, lageDerLeiste, umfeldDerLeiste } from '../../leistenlage';
import { useSichtfeld } from '../../sichtfeld';
import type { Struktur } from '../../struktur';
import type { Befehle } from '../../useBefehle';
import { DREH_ABSTAND } from '../auswahlrahmen';
import type { GestaltungKontext } from '../inspektor/kontext-ersatz';
import { kontextFuerGestaltung, liegtFreiAuf } from '../inspektor/kontext-ersatz';
import { LEISTEN } from './index';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
	befehle: Befehle;
	/** In der Textsitzung bleibt die Bausteinleiste mit „Fertig“; diese Leiste weicht. */
	sitzung: boolean;
}

const Trenner = () => <span aria-hidden className="mx-0.5 h-4 w-px flex-none bg-rand" />;

const tasten = (ereignis: KeyboardEvent<HTMLDivElement>, doc: Document) => {
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

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein">
		<Symbol name="mehr" />
	</Knopf>
);

/** Duplizieren und Löschen wie an der Bausteinleiste; bei Mehrfachauswahl wirken sie auf alle (113). */
const BefehlKnopf = ({ befehle, id }: { befehle: Befehle; id: string }) => {
	const k = befehle.jetzt.current;
	const b = BEFEHLE.find((x) => x.id === id);
	if (!b?.verfuegbar(k) || typeof b.symbol !== 'string') {
		return null;
	}
	const erstes = kuerzelIm(b, k);
	return (
		<SymbolKnopf
			symbol={b.symbol}
			beschriftung={titelVon(b, k)}
			groesse="klein"
			{...(erstes ? { kuerzel: kuerzelText(erstes) } : {})}
			onClick={() => befehle.fuehreAus(id)}
		/>
	);
};

/** Ort der Leiste am Element `kasten` (Maße im Blatt), in Punkten der Ansicht. */
const ortDerLeiste = (
	e: Einblendung,
	kasten: DOMRect,
	nrn: readonly number[],
	mass: { breite: number; hoehe: number },
	sicht: Kante,
) => {
	const box = {
		links: e.links + kasten.left * e.skala,
		rechts: e.links + kasten.right * e.skala,
		oben: kasten.top * e.skala,
		unten: kasten.bottom * e.skala,
	};
	// 204-15: dieselbe Regel wie an der Bausteinleiste, über dem Drehgriff.
	// 204-N04, Schlussdurchsicht: die Stelle, die am wenigsten fremden Inhalt verdeckt.
	const eigen = nrn.flatMap((nr) => elementZu(e.doc, nr) ?? []);
	return lageDerLeiste(box, mass, sicht, DREH_ABSTAND, umfeldDerLeiste(e, kasten, eigen));
};

/** Ein frei liegendes Element, weder gesperrt noch ausgeblendet (204-03). */
const freiUndOffen = (k: GestaltungKontext | null) =>
	Boolean(k && liegtFreiAuf(k.baustein) && !k.element.closest('[data-gesperrt], [data-aus]'));

/** Ob „Claude“ für die Auswahl gerade geht. */
const claudeVerfuegbar = (befehle: Befehle) =>
	Boolean(BEFEHLE.find((b) => b.id === 'auswahl.claude')?.verfuegbar(befehle.jetzt.current));

/** Der Rahmen des Blatts, in den der Fokus nach dem Menü zurückkehrt. */
const rahmenVon = (doc: Document) => (doc.defaultView?.frameElement as HTMLElement | null | undefined) ?? null;

/**
 * Leiste am gewählten Gestaltungselement (099, 204-12), nach demselben Bauplan wie die Bausteinleiste: Claude · was
 * nur hier geht (Text im Bogen, Gruppe auflösen, Gruppieren und Ausrichten) · Duplizieren, Löschen · ⋯. Alles andere
 * steht im Inspektor. Gesperrte und ausgeblendete Elemente haben keine Leiste (204-03): Man wählt sie in den Ebenen.
 */
export const Leiste = ({ befehle, e, pfad, quelle, sitzung, struktur }: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const [mass, setMass] = useState({ breite: 200, hoehe: 30 });
	const sicht = useSichtfeld(e.doc);
	const k = kontextFuerGestaltung({ doc: e.doc, pfad, struktur });
	const da = Boolean(freiUndOffen(k) && e.box && sicht && quelle && struktur.aktiv && !sitzung);

	useLayoutEffect(() => {
		const element = leiste.current;
		if (!element) {
			return;
		}
		const { offsetHeight: hoehe, offsetWidth: breite } = element;
		setMass((alt) => (alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe }));
	});

	if (!da || !k || !e.box || !sicht || quelle === null) {
		return null;
	}

	const { links, top } = ortDerLeiste(e, e.box, k.nrn, mass, sicht);
	const mehrfach = k.nrn.length > 1; // 113
	const Knoepfe = LEISTEN[mehrfach ? 'mehrfach' : k.art] ?? null;
	const name = pfad.at(-1)?.name ?? k.baustein.name;
	const claude = !mehrfach && claudeVerfuegbar(befehle);
	const blatt = { current: rahmenVon(e.doc) };

	return (
		<div
			ref={leiste}
			className={klassen(
				'absolute z-ueberlagerung flex min-h-[30px] items-center gap-0.5 rounded-[7px] border border-rand bg-flaeche px-1 whitespace-nowrap shadow-1',
				e.zieht && 'invisible',
			)}
			role="toolbar"
			aria-label={`Leiste für ${name}`}
			data-gestaltungsleiste={mehrfach ? 'mehrfach' : k.art}
			style={{ left: links, top }}
			onKeyDown={(ereignis) => tasten(ereignis, e.doc)}
			onClick={(ereignis) => fokusZurueckInsBlatt(ereignis, e.doc)}
		>
			{claude && <ClaudeKnopf befehle={befehle} />}
			{Knoepfe && (
				<>
					{claude && <Trenner />}
					<Knoepfe k={k} befehle={befehle} quelle={quelle} aktiv={struktur.aktiv} />
				</>
			)}
			{(claude || Knoepfe) && <Trenner />}
			<BefehlKnopf befehle={befehle} id="auswahl.duplizieren" />
			<BefehlKnopf befehle={befehle} id="auswahl.loeschen" />
			<Menue
				name={mehrfach ? 'Mehr zu diesen Elementen' : 'Mehr zu diesem Element'}
				rechtsbuendig
				ausloeser={MEHR_KNOPF}
				eintraege={befehle.menue('gestaltung')}
				fokusDanach={blatt}
			/>
		</div>
	);
};
