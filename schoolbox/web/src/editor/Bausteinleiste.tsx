import { kann } from '@schoolbox/kern/src/bausteine';
import type { KitFeld } from '@schoolbox/kern/src/kit-einstellungen';
import { KIT_FELDER, leseKit, setzeKit } from '@schoolbox/kern/src/kit-einstellungen';
import { SPALTEN } from '@schoolbox/kern/src/struktur';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Schalter } from '../bausteine/Schalter';
import { Stepper } from '../bausteine/Stepper';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { AbbildungSteuerung } from './abbildung';
import { hatLeistenfeld } from './abbildung-felder';
import { AbbildungLeiste } from './Abbildungspanel';
import { BEFEHLE, kuerzelText, titelVon } from './befehle';
import type { BildSteuerung } from './bild';
import { ClaudeKnopf } from './ClaudeKnopf';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import { istGestaltungAuswahl } from './gestaltung/inspektor/kontext-ersatz';
import type { Einblendung } from './Leinwand';
import type { LoesungSteuerung } from './loesung';
import { useSichtfeld } from './sichtfeld';
import type { Struktur } from './struktur';
import type { useText } from './text';
import { TextFertig, Textknoepfe } from './Textleiste';
import type { Befehle } from './useBefehle';
import { ziehbarImBlatt } from './ziele';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	quelle: string | null;
	format: string;
	struktur: Struktur;
	befehle: Befehle;
	text: ReturnType<typeof useText>;
	abb: AbbildungSteuerung;
	bild: BildSteuerung;
	loes: LoesungSteuerung;
	waehle: (nr: number) => void;
}

// 640 statt 560 seit „Claude“ in der Leiste steht (134): Sonst fielen beim Aufgabentext die Schriftknöpfe weg.
const MAX_BREITE = 640;
const ABSTAND = 6;
const MAX_SPEZIFISCH = 3;
/** Die Seite hat „Seite danach“; in Zellen und Einträgen steht ein neuer Baustein nicht in derselben Liste. */
const OHNE_EINFUEGEN = ['seite', 'tabellenzelle', 'tabellenzeile', 'item', 'karte'];

const Trenner = () => <span aria-hidden className="mx-0.5 h-4 w-px flex-none bg-rand" />;

const Beschriftet = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<span className="flex flex-none items-center gap-1.5 text-xs text-leise">
		{titel}
		{children}
	</span>
);

/** Ein Befehl als Knopf: dieselben Namen, Kürzel und Sperren wie überall sonst. */
const BefehlKnopf = ({ befehle, id, platz }: { befehle: Befehle; id: string; platz?: boolean }) => {
	const k = befehle.jetzt.current;
	const b = BEFEHLE.find((x) => x.id === id);
	if (!b || (!platz && !b.verfuegbar(k))) {
		return null;
	}
	const symbol = (typeof b.symbol === 'function' ? b.symbol(k) : b.symbol) as SymbolName;
	const [erstes] = b.kuerzel ?? [];
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

const KitFeldInLeiste = ({
	feld,
	setze,
	wert,
}: {
	feld: KitFeld;
	wert: string | number | boolean | undefined;
	setze: (wert: string | number | boolean) => void;
}) => {
	const name = feld.leisteName ?? feld.titel;
	if (feld.typ === 'schalter') {
		return (
			<Knopf
				art="leise"
				groesse="klein"
				aria-pressed={wert === true}
				className="aria-pressed:bg-flaeche-2 aria-pressed:text-tinte"
				onClick={() => setze(wert !== true)}
			>
				{feld.name === 'stern' && <Symbol name="stern" />}
				{name}
			</Knopf>
		);
	}
	if (feld.typ === 'zahl') {
		return (
			<Beschriftet titel={name}>
				<Stepper
					name={name}
					wert={Number(wert)}
					min={feld.min}
					max={feld.max}
					schritt={feld.schritt}
					setze={setze}
				/>
			</Beschriftet>
		);
	}
	if (feld.typ === 'wahl') {
		return (
			<Beschriftet titel={name}>
				<select
					aria-label={name}
					className="h-feld rounded-md border border-rand-feld bg-flaeche px-1 text-xs text-tinte"
					value={String(wert)}
					onChange={(ereignis) => setze(ereignis.target.value)}
				>
					{feld.optionen.map((o) => (
						<option key={o.wert} value={o.wert}>
							{o.titel}
						</option>
					))}
				</select>
			</Beschriftet>
		);
	}
	return null;
};

/**
 * Am gewählten Baustein, rechtsbündig darüber: Griff, Name, Pfeile, was zur Art passt, „+ Baustein“, Duplizieren,
 * Löschen, ⋯. Beim Tippen bleiben nur Name, Schrift und „Fertig“, ohne dass die Schriftknöpfe den Platz wechseln.
 */
const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
		<Symbol name="mehr" />
	</Knopf>
);

const LeistenEnde = ({
	art,
	befehle,
	setVorschau,
}: {
	art: string;
	befehle: Eigenschaften['befehle'];
	setVorschau: (an: boolean) => void;
}) => (
	<>
		<Trenner />
		{!OHNE_EINFUEGEN.includes(art) && (
			<Knopf
				art="leise"
				groesse="klein"
				data-einfuegen-plus
				onPointerEnter={() => setVorschau(true)}
				onPointerLeave={() => setVorschau(false)}
				onClick={() => {
					setVorschau(false);
					befehle.fuehreAus('auswahl.einfuegen-danach');
				}}
			>
				<Symbol name="plus" />
				Baustein
			</Knopf>
		)}
		<BefehlKnopf befehle={befehle} id="auswahl.duplizieren" />
		<BefehlKnopf befehle={befehle} id="auswahl.loeschen" />
		<Menue
			name="Mehr zu diesem Baustein"
			rechtsbuendig
			ausloeser={MEHR_KNOPF}
			eintraege={befehle.menue('baustein')}
		/>
	</>
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

const punktIm = (ereignis: ReactPointerEvent, e: Einblendung) => {
	const r = e.doc.defaultView?.frameElement?.getBoundingClientRect();
	return { x: (ereignis.clientX - (r?.left ?? 0)) / e.skala, y: (ereignis.clientY - (r?.top ?? 0)) / e.skala };
};

/** In der Sitzung nur als unsichtbarer Platzhalter: Die Schriftknöpfe bleiben dann, wo sie waren. */
const Pfeile = ({ befehle, platzhalter }: { befehle: Befehle; platzhalter: boolean }) => (
	<div className={klassen('flex items-center', platzhalter && 'invisible')}>
		<Trenner />
		<BefehlKnopf platz={platzhalter} befehle={befehle} id="auswahl.hoch" />
		<BefehlKnopf platz={platzhalter} befehle={befehle} id="auswahl.runter" />
	</div>
);

const griffDruecken = (ereignis: ReactPointerEvent<HTMLButtonElement>, e: Einblendung, nr: number) => {
	if (!ereignis.isPrimary || ereignis.button !== 0) {
		return;
	}
	ereignis.preventDefault();
	ereignis.currentTarget.setPointerCapture(ereignis.pointerId);
	const { x, y } = punktIm(ereignis, e);
	e.ziehen.current?.griffStart(nr, x, y, ereignis.pointerId);
};

const KEIN_PLATZ = { links: 0, griff: false, pfeile: false };

interface TeileAngaben {
	abb: Eigenschaften['abb'];
	befehle: Eigenschaften['befehle'];
	bild: Eigenschaften['bild'];
	format: Eigenschaften['format'];
	gewaehlt: PfadTeil;
	loes: Eigenschaften['loes'];
	quelle: Eigenschaften['quelle'];
	sitzung: boolean;
	struktur: Eigenschaften['struktur'];
	text: Eigenschaften['text'];
}

/** Was nur dieser Baustein kann, in der Reihenfolge seiner Wichtigkeit: Wird es eng, fällt das Letzte weg. */
const spezifischeTeile = ({
	abb,
	befehle,
	bild,
	format,
	gewaehlt,
	loes,
	quelle,
	sitzung,
	struktur,
	text,
}: TeileAngaben): { schluessel: string; inhalt: ReactNode }[] => {
	const { baustein, nr } = gewaehlt;
	const k = befehle.jetzt.current;
	const felder = quelle ? (KIT_FELDER[baustein.art] ?? []).filter((f) => f.leiste) : [];
	const kit = quelle && felder.length > 0 ? leseKit(quelle, nr, baustein.art) : {};
	const setzeFeld = (f: KitFeld, wert: string | number | boolean) =>
		struktur.aendereAttribute(`${f.titel} geändert`, (q) =>
			setzeKit(q, nr, baustein.art, f.name, wert, { jeSeite: format === 'folie' }),
		);
	return [
		...(kann(baustein, 'text')
			? [{ schluessel: 'text', inhalt: <Textknoepfe sitzung={sitzung} text={text} /> }]
			: []),
		...felder.map((f) => ({
			schluessel: f.name,
			inhalt: <KitFeldInLeiste feld={f} wert={kit[f.name]} setze={(wert) => setzeFeld(f, wert)} />,
		})),
		...(abb.aktiv && hatLeistenfeld(abb)
			? [{ schluessel: 'abbildung', inhalt: <AbbildungLeiste abb={abb} /> }]
			: []),
		...befehle
			.fuer('leiste')
			.filter((b) => b.leisteTitel && (b.leisteWenn?.(k) ?? true))
			.map((b) => ({
				schluessel: b.id,
				inhalt: (
					<Knopf
						art="leise"
						groesse="klein"
						aria-label={titelVon(b, k)}
						onClick={() => befehle.fuehreAus(b.id)}
					>
						{typeof b.symbol === 'string' && <Symbol name={b.symbol} />}
						{b.leisteTitel}
					</Knopf>
				),
			})),
		...(bild.groesse && bild.werte
			? [
					{
						schluessel: 'groesse',
						inhalt: (
							<Beschriftet titel="Größe">
								<Stepper
									name="Größe"
									wert={Math.round(bild.werte.breite)}
									min={bild.groesse.min}
									max={bild.groesse.max}
									schritt={10}
									setze={bild.setzeBreite}
								/>
							</Beschriftet>
						),
					},
				]
			: []),
		...(struktur.werte?.spalten?.nr === nr
			? [
					{
						schluessel: 'spalten',
						inhalt: (
							<Beschriftet titel="Spalten">
								<Stepper
									name="Spalten"
									wert={struktur.werte.spalten.wert}
									min={SPALTEN.min}
									max={SPALTEN.max}
									minusName="Eine Spalte weniger"
									plusName="Eine Spalte mehr"
									setze={(n) => struktur.spalten(nr, n)}
								/>
							</Beschriftet>
						),
					},
				]
			: []),
		...(loes.beispiel
			? [
					{
						schluessel: 'beispiel',
						inhalt: (
							<Beschriftet titel="Als Beispiel">
								<Schalter
									name="Als Beispiel"
									an={loes.beispiel.an}
									setze={(an) => loes.setzeAlsBeispiel(an)}
								/>
							</Beschriftet>
						),
					},
				]
			: []),
	];
};

const griffGeht = (aktiv: boolean, element: Element | null | undefined, baustein: PfadTeil['baustein']) =>
	Boolean(aktiv && element && ziehbarImBlatt(baustein, element));

/** Über dem Baustein, sonst darunter, sonst oben im Sichtfeld; waagerecht immer ganz sichtbar. */
const lageVon = (
	box: { links: number; rechts: number; oben: number; unten: number },
	mass: { breite: number; hoehe: number },
	sicht: { links: number; rechts: number; oben: number; unten: number },
) => {
	const oben = box.oben - mass.hoehe - ABSTAND;
	const unten = box.unten + ABSTAND;
	let top = sicht.oben + ABSTAND;
	if (oben >= sicht.oben + ABSTAND) {
		top = oben;
	} else if (unten + mass.hoehe <= sicht.unten - ABSTAND) {
		top = unten;
	}
	const klein = box.rechts - box.links < mass.breite;
	const wunsch = klein ? (box.links + box.rechts - mass.breite) / 2 : box.rechts - mass.breite;
	return { links: Math.max(sicht.links + ABSTAND, Math.min(wunsch, sicht.rechts - mass.breite - ABSTAND)), top };
};

const EinfuegeVorschau = ({
	box,
	quer,
}: {
	box: { links: number; rechts: number; oben: number; unten: number };
	quer: boolean | undefined;
}) => (
	<div
		className="pointer-events-none absolute z-ueberlagerung rounded-full bg-brand-500"
		data-einfuege-vorschau
		style={
			quer
				? { left: box.rechts + 2, top: box.oben, width: 2, height: box.unten - box.oben }
				: { left: box.links, top: box.unten + 2, width: box.rechts - box.links, height: 2 }
		}
	/>
);

const LeistenGriff = ({
	e,
	nr,
	platzhalter,
	ziehbar,
}: {
	e: Eigenschaften['e'];
	nr: number;
	platzhalter: boolean;
	ziehbar: boolean;
}) => {
	if (!ziehbar) {
		return platzhalter ? <span className="w-4 flex-none" /> : null;
	}
	return (
		<>
			{platzhalter && <span className="w-4 flex-none" />}
			<GriffKnopf e={e} nr={nr} />
		</>
	);
};

const GriffKnopf = ({ e, nr }: { e: Eigenschaften['e']; nr: number }) => (
	<button
		type="button"
		aria-label="Zum Verschieben ziehen"
		className="flex h-knopf-klein w-4 flex-none cursor-grab touch-none items-center justify-center text-dezent hover:text-tinte"
		data-leiste-griff
		onPointerDown={(ereignis) => griffDruecken(ereignis, e, nr)}
		onPointerMove={(ereignis) => {
			const p = punktIm(ereignis, e);
			e.ziehen.current?.griffBewege(p.x, p.y);
		}}
		onPointerCancel={() => e.ziehen.current?.griffEnde(false)}
	>
		<Symbol name="griff" />
	</button>
);

const LeistenRest = ({
	art,
	befehle,
	setVorschau,
	sitzung,
	spezifisch,
	text,
}: Pick<Eigenschaften, 'befehle' | 'text'> & {
	art: string;
	setVorschau: (an: boolean) => void;
	sitzung: boolean;
	spezifisch: ReturnType<typeof spezifischeTeile>;
}) => (
	<>
		{spezifisch.length > 0 && <Trenner />}
		{spezifisch
			.filter((s) => !sitzung || s.schluessel === 'text')
			.map((s) => (
				<span key={s.schluessel} className="flex flex-none items-center">
					{s.inhalt}
				</span>
			))}
		{sitzung ? (
			<>
				<Trenner />
				<TextFertig text={text} />
			</>
		) : (
			<LeistenEnde art={art} befehle={befehle} setVorschau={setVorschau} />
		)}
	</>
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

export const Bausteinleiste = ({
	abb,
	befehle,
	bild,
	e,
	format,
	loes,
	pfad,
	quelle,
	struktur,
	text,
	waehle,
}: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const [mass, setMass] = useState({ breite: 400, hoehe: 30 });
	const [wegBei, setWeg] = useState({ nr: null as number | null, n: 0 });
	const [vorschau, setVorschau] = useState(false);
	// In der Sitzung sperrt `struktur` Griff und Pfeile; ihr Platz bleibt, damit die Schriftknöpfe nicht springen.
	const fest = useRef({ links: 0, griff: false, pfeile: false });
	const sicht = useSichtfeld(e.doc);
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;
	const sitzung = text.bearbeitet;
	const grenze = Math.min(MAX_BREITE, e.breite);
	const weg = wegBei.nr === nr ? wegBei.n : 0;

	useLayoutEffect(() => {
		const element = leiste.current;
		if (!element) {
			return;
		}
		const { offsetHeight: hoehe, offsetWidth: breite } = element;
		setMass((alt) => (alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe }));
		if (breite > grenze && !sitzung) {
			setWeg({ nr, n: Math.min(weg + 1, MAX_SPEZIFISCH) });
		}
	}, [grenze, sitzung, nr, weg, e.skala, quelle]);

	// Bei Gestaltung steht dort die Leiste am Element (099); nur die Textsitzung behält diese Leiste mit „Fertig“.
	const gestaltung = istGestaltungAuswahl(gewaehlt?.baustein) && !sitzung;
	const box = boxAufLeinwand(e);
	if (!gewaehlt || !box || !sicht || nr === null || !(struktur.aktiv || sitzung) || gestaltung) {
		return null;
	}

	const { baustein, name } = gewaehlt;
	const element = elementZu(e.doc, nr);

	const { links, top } = lageVon(box, mass, sicht);
	const griffZiehbar = griffGeht(struktur.aktiv, element, baustein);
	const nachWerte = struktur.werte?.nach;
	if (!sitzung) {
		fest.current = { links, griff: griffZiehbar, pfeile: Boolean(nachWerte) };
	}
	const platz = sitzung ? fest.current : KEIN_PLATZ;

	const spezifisch = spezifischeTeile({
		abb,
		befehle,
		bild,
		format,
		gewaehlt,
		loes,
		quelle,
		struktur,
		text,
		sitzung,
	}).slice(0, sitzung ? MAX_SPEZIFISCH : MAX_SPEZIFISCH - weg);

	return (
		<>
			{vorschau && <EinfuegeVorschau box={box} quer={nachWerte?.quer} />}
			{/* Beim Ziehen nur unsichtbar: Der Griff hält den Zeiger, solange er da ist. */}
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
				style={{ left: sitzung ? platz.links : links, top }}
				onKeyDown={(ereignis) => tastenInLeiste(ereignis, e.doc)}
			>
				<LeistenGriff e={e} nr={nr} platzhalter={platz.griff} ziehbar={griffZiehbar} />
				<Menue
					art="leise"
					groesse="klein"
					name="Ebene wählen"
					beschriftung={name}
					eintraege={pfad.map((t) => ({
						titel: t.name,
						aktiv: t.nr === nr,
						waehle: () => waehle(t.nr),
					}))}
				/>
				{(sitzung ? platz.pfeile : nachWerte) && <Pfeile befehle={befehle} platzhalter={sitzung} />}
				{!sitzung && (
					<>
						<Trenner />
						<ClaudeKnopf befehle={befehle} />
					</>
				)}
				<LeistenRest
					art={baustein.art}
					befehle={befehle}
					setVorschau={setVorschau}
					sitzung={sitzung}
					spezifisch={spezifisch}
					text={text}
				/>
			</div>
		</>
	);
};
