import { ABSCHNITT_TITEL } from '@schoolbox/kern/src/abschnitte';
import { FREIES_ELEMENT, kann } from '@schoolbox/kern/src/bausteine';
import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';
import { leseNotiz, setzeNotiz, sichtbarkeitFest } from '@schoolbox/kern/src/kit-einstellungen';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
import { Feld } from '../bausteine/Feld';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Reiter } from '../bausteine/Reiter';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { AbbildungSteuerung } from './abbildung';
import { hatWeitere } from './abbildung-felder';
import { AbbildungFelder, AbbildungHinweise } from './Abbildungspanel';
import type { Ablage } from './ablage';
import { gesperrtIn } from './ausgeblendet-hilfe';
import { AusgeblendetHinweis, GesperrtHinweis } from './AusgeblendetHinweis';
import type { BildSteuerung } from './bild';
import { BildKontext } from './bild';
import { BildDarstellung, Bildwerkzeug } from './Bildpanel';
import { useClaudeSteuerung } from './claude-kontext';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import { Gestaltungsinspektor } from './gestaltung/inspektor/Gestaltungsinspektor';
import { istGestaltungAuswahl } from './gestaltung/inspektor/kontext-ersatz';
import type { Einblendung } from './Leinwand';
import type { LoesungSteuerung } from './loesung';
import { Loesungswerkzeug } from './Loesungspanel';
import { KitWerkzeug, SammlungName, Sichtbarkeit, Spaltenwahl, TabellenWerkzeug } from './Panel';
import type { PruefKnopf } from './Pruefliste';
import { Pruefhinweise } from './Pruefliste';
import type { Pruefpunkt, Pruefstand } from './pruefung';
import { holeInSeiteAus } from './pruefung';
import { Sprachwerkzeug } from './Sprachwerkzeug';
import type { Spalten, Struktur } from './struktur';
import type { useText } from './text';

type ReiterName = 'auswahl' | 'blatt';

const STUFE = 'size-knopf-status h-zeile truncate rounded px-1 text-xs text-leise hover:bg-flaeche-2 hover:text-tinte';

/**
 * Wo im Blatt: die Elternkette in einer Zeile, der Baustein darunter. Überfahren rahmt die Ebene im Blatt, damit man
 * vor dem Klick sieht, was „Reihe“ ist. Passt die Kette nicht, fassen sich die vorderen Stufen zu „…“ zusammen.
 */
const Pfad = ({
	pfad,
	umriss,
	waehle,
}: {
	pfad: PfadTeil[];
	umriss: (nr: number | null) => void;
	waehle: (nr: number | null) => void;
}) => {
	const zeile = useRef<HTMLDivElement>(null);
	const eltern = pfad.slice(0, -1);
	const gewaehlt = pfad.at(-1);
	const schluessel = pfad.map((t) => t.nr).join('/');
	const [wegBei, setWeg] = useState({ schluessel, n: 0 });
	const weg = wegBei.schluessel === schluessel ? wegBei.n : 0;

	useLayoutEffect(() => {
		const el = zeile.current;
		if (el && el.scrollWidth > el.clientWidth && weg < eltern.length - 1) {
			setWeg({ schluessel, n: weg + 1 });
		}
	}, [schluessel, weg, eltern.length]);

	if (!gewaehlt) {
		return null;
	}
	return (
		<nav aria-label="Wo im Blatt" className="min-w-0" data-breadcrumb>
			<div ref={zeile} className="-ml-1 flex h-zeile items-center overflow-hidden whitespace-nowrap">
				{weg > 0 && (
					<>
						<Menue
							art="leise"
							groesse="klein"
							name="Weitere Ebenen"
							beschriftung="…"
							eintraege={eltern.slice(0, weg).map((t) => ({ titel: t.name, waehle: () => waehle(t.nr) }))}
						/>
						<span className="flex-none px-0.5 text-xs text-dezent">›</span>
					</>
				)}
				{eltern.slice(weg).map((teil, i) => (
					<span key={teil.nr} className="flex min-w-0 flex-none items-center">
						{i > 0 && <span className="px-0.5 text-xs text-dezent">›</span>}
						<button
							type="button"
							className={STUFE}
							data-pfad-stufe={teil.nr}
							onPointerEnter={() => umriss(teil.nr)}
							onPointerLeave={() => umriss(null)}
							onFocus={() => umriss(teil.nr)}
							onBlur={() => umriss(null)}
							onClick={() => {
								umriss(null);
								waehle(teil.nr);
							}}
						>
							{teil.name}
						</button>
					</span>
				))}
			</div>
			{eltern.length > 0 && <span className="sr-only">›</span>}
			<h2 className="min-w-0 truncate pr-7 text-base font-semibold">
				<button
					type="button"
					className="h-knopf-status max-w-full truncate"
					aria-current="true"
					onClick={() => waehle(gewaehlt.nr)}
				>
					{gewaehlt.name}
				</button>
			</h2>
		</nav>
	);
};

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	umriss: (nr: number | null) => void;
	/** Der Inhalt des Reiters „Blatt“. */
	blatt: ReactNode;
	/** Zählt hoch, wenn die Palette zu einer Einstellung des Blatts springt. */
	zumBlatt: number;
	/** Präsentation: Eine gewählte Folie zeigt ihre Notiz im Reiter „Auswahl“, eine Seite sonst den Reiter „Blatt“. */
	folien: boolean;
	children: ReactNode;
}

/** Rechts neben dem Blatt: zwei Reiter, damit immer klar ist, worauf sich eine Einstellung bezieht. */
export const Inspektor = ({ blatt, children, folien, pfad, umriss, waehle, zumBlatt }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;
	// 196-23: Für eine Seite gilt, was im Reiter „Blatt“ steht („Gilt für“ bietet sie an).
	const seite = gewaehlt?.baustein.art === 'seite' && !folien;
	const [wunsch, setWunsch] = useState<ReiterName>(seite ? 'blatt' : 'auswahl');
	const [zuletzt, setZuletzt] = useState(nr);
	if (zuletzt !== nr) {
		setZuletzt(nr);
		if (nr !== null) {
			setWunsch(seite ? 'blatt' : 'auswahl');
		}
	}
	const [blattZuletzt, setBlattZuletzt] = useState(zumBlatt);
	if (blattZuletzt !== zumBlatt) {
		setBlattZuletzt(zumBlatt);
		setWunsch('blatt');
	}
	const reiter = gewaehlt ? wunsch : 'blatt';
	return (
		<div data-inspektor={reiter}>
			<Reiter
				beschriftung="Worauf sich die Einstellungen beziehen"
				className="border-b border-rand px-3"
				wert={reiter}
				waehle={setWunsch}
				werte={[
					{ wert: 'auswahl', titel: 'Auswahl', aus: !gewaehlt },
					{ wert: 'blatt', titel: 'Blatt' },
				]}
			/>
			{reiter === 'blatt' || !gewaehlt ? (
				blatt
			) : (
				<div data-auswahl={gewaehlt.baustein.art}>
					<div className="relative px-3 pt-1 pb-2">
						<Pfad pfad={pfad} umriss={umriss} waehle={waehle} />
						<span className="absolute right-2 bottom-2">
							<SymbolKnopf
								symbol="schliessen"
								beschriftung="Auswahl aufheben"
								groesse="klein"
								onClick={() => waehle(null)}
							/>
						</span>
					</div>
					{children}
				</div>
			)}
		</div>
	);
};

/** Gestrichelter Rahmen um die Ebene, die im Pfad gerade überfahren wird; gleiche Maße wie der Auswahlrahmen. */
export const Umriss = ({ e, nr }: { e: Einblendung; nr: number | null }) => {
	const r = nr === null ? null : elementZu(e.doc, nr)?.getBoundingClientRect();
	if (!r) {
		return null;
	}
	return (
		<div
			className={klassen(
				'umriss pointer-events-none absolute rounded-[2px] border border-dashed border-brand-500',
			)}
			data-umriss={nr}
			style={{
				left: e.links + r.left * e.skala - 4,
				top: r.top * e.skala - 4,
				width: r.width * e.skala + 8,
				height: r.height * e.skala + 8,
			}}
		/>
	);
};

interface EinstellungenEigenschaften {
	/** Zeigt der Editor gerade die Lösung? */
	loesung: boolean;
	schalteAnsicht: () => void;
	pfad: PfadTeil[];
	quelle: string | null;
	format: string;
	frei: boolean;
	doc: Document | null;
	geladen: { doc: Document } | null;
	struktur: Struktur;
	ablage: Ablage;
	abb: AbbildungSteuerung;
	bild: BildSteuerung;
	loes: LoesungSteuerung;
	text: ReturnType<typeof useText>;
	pruefung: Pruefstand | null;
}

const eintraegeIn = (doc: Document | null, nr: number | undefined) =>
	(doc && nr !== undefined ? elementZu(doc, nr)?.children.length : 0) ?? 0;

/** 196-16: Sichtbarkeit nur, wo sie im Stapel einen Sinn hat; Namenszeile, Kopf und Fuß gehören zu jedem Blatt. */
const OHNE_SICHTBARKEIT = new Set(['namenszeile', 'kopf', 'fuss']);
const EIGENE_SICHTBARKEIT = new Set(['aufgabe', 'sternchenaufgabe', 'item', 'karte', 'tabellenzeile']);
const STAPEL = new Set(['aufgabe', 'sternchenaufgabe', 'seite']);

const hatSichtbarkeit = (pfad: PfadTeil[], folien: boolean) => {
	const art = pfad.at(-1)?.baustein.art;
	const eltern = pfad.at(-2)?.baustein.art;
	// 196-17: Folien haben keine Lösungsansicht.
	if (folien || !art) {
		return false;
	}
	return EIGENE_SICHTBARKEIT.has(art) || (eltern !== undefined && STAPEL.has(eltern) && !OHNE_SICHTBARKEIT.has(art));
};

const SichtbarkeitWenn = ({
	aus,
	baustein,
	folien,
	nr,
	pfad,
	quelle,
	struktur,
}: {
	aus: boolean;
	baustein: PfadTeil['baustein'];
	folien: boolean;
	nr: number;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
}) =>
	quelle &&
	kann(baustein, 'ordnen') &&
	baustein.art !== 'seite' &&
	hatSichtbarkeit(pfad, folien) &&
	!sichtbarkeitFest(quelle, nr) ? (
		<Sichtbarkeit aus={aus} nr={nr} quelle={quelle} struktur={struktur} />
	) : null;

/** 196-23, 192-01: Die Notiz der gewählten Folie; mehrzeilig, Verlassen übernimmt, Esc stellt wieder her. */
const FolienNotiz = ({
	aus,
	nr,
	quelle,
	struktur,
}: {
	aus: boolean;
	nr: number;
	quelle: string;
	struktur: Struktur;
}) => {
	const wert = leseNotiz(quelle, nr);
	const [text, setText] = useState(wert);
	useEffect(() => setText(wert), [wert]);
	return (
		<textarea
			className={klassen(FELD_KLASSEN, 'h-auto min-h-16 py-1')}
			aria-label="Notiz"
			data-folien-notiz
			disabled={aus}
			rows={4}
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={() => {
				if (text.trim() !== wert) {
					struktur.fuehreAus('Notiz geändert', (q) => ({ quelle: setzeNotiz(q, nr, text), nr }));
				}
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape' && text !== wert) {
					e.preventDefault();
					e.stopPropagation();
					setText(wert);
				}
			}}
		/>
	);
};

/** Öffnet die Blase an diesem Element (134). */
const FreiesElementHinweis = () => {
	const claude = useClaudeSteuerung();
	return (
		<div className="flex flex-col items-start gap-1.5" data-frei-hinweis>
			<p className="text-sm text-leise">Von Claude gebaut. Hier gibt es keine Einstellungen.</p>
			<Knopf art="zweit" groesse="klein" onClick={() => claude.oeffne()}>
				Claude fragen
			</Knopf>
		</div>
	);
};

/**
 * Das gewählte Element ist in dieser Ansicht nicht zu sehen (nur in der Lösung, nur auf der Folie): Ohne Hinweis sähe
 * es aus, als wäre nichts passiert. Bewusst ein Hinweis und kein Umschalten, das würde beim Einfügen überraschen (G9).
 */
const UnsichtbarHinweis = ({
	doc,
	loesung,
	nr,
	quelle,
	schalte,
}: {
	doc: Document | null;
	loesung: boolean;
	nr: number;
	quelle: string | null;
	schalte: () => void;
}) => {
	const [element, setElement] = useState<Element | null>(null);
	useEffect(() => {
		const el = doc ? (elementZu(doc, nr) ?? null) : null;
		// Ausgeblendetes (`data-aus`) meldet `AusgeblendetHinweis` (096).
		setElement(el && el.getClientRects().length === 0 && !el.closest('[data-aus]') ? el : null);
	}, [doc, nr, quelle, loesung]);
	if (!element) {
		return null;
	}
	if (element.matches('.notiz')) {
		return (
			<p className="text-sm text-leise" data-hinweis="unsichtbar">
				Die Notiz siehst du nur in der Präsentation, nicht auf dem Blatt.
			</p>
		);
	}
	return (
		<div className="flex flex-col items-start gap-1.5" data-hinweis="unsichtbar">
			<p className="text-sm text-leise">
				{`${loesung ? 'Das steht nur im Arbeitsblatt.' : 'Das steht nur in der Lösung.'} Hier siehst du es nicht.`}
			</p>
			<Knopf art="zweit" groesse="klein" onClick={schalte}>
				{loesung ? 'Zum Arbeitsblatt' : 'Zur Lösung'}
			</Knopf>
		</div>
	);
};

/** Gestaltung (099) am gezeigten Blatt: Es bleibt beim Nachladen stehen, deshalb fehlt es nur, bevor ein Bild da ist. */
const Gestaltung = ({
	bild,
	doc,
	pfad,
	quelle,
	struktur,
}: {
	bild: BildSteuerung;
	doc: Document | null;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
}) =>
	doc ? (
		<BildKontext.Provider value={bild}>
			<Gestaltungsinspektor doc={doc} pfad={pfad} quelle={quelle} struktur={struktur} />
		</BildKontext.Provider>
	) : null;

/**
 * 198-20: „In die Seite holen“ am Hinweis „außerhalb der Seite“ und „im Druckrand“ eines Gestaltungselements, statt des
 * Tipps. Gesperrt oder ohne bearbeitbares Blatt gibt es den Knopf nicht.
 */
const inSeiteHolen =
	(doc: Document | null, struktur: Struktur, gesperrt: boolean) =>
	(p: Pruefpunkt): PruefKnopf | null => {
		const nr = p.bausteine[0];
		const element = doc && nr !== undefined ? elementZu(doc, nr) : null;
		if (!doc || gesperrt || !struktur.aktiv || (p.code !== 'aussen' && p.code !== 'druckrand')) {
			return null;
		}
		if (!element?.matches(GESTALTUNG_SELEKTOR)) {
			return null;
		}
		return {
			titel: 'In die Seite holen',
			art: 'in-seite-holen',
			aus: () => holeInSeiteAus(doc, struktur.aendereAttribute, p),
		};
	};

/** Was jede Einstellung eines Bausteins braucht, wie `KitWerkzeug` es nimmt. */
interface Kit {
	art: string;
	aus: boolean;
	folien: boolean;
	nr: number;
	quelle: string | null;
	struktur: Struktur;
}

/** Hinweise über den Abschnitten: frei, ausgeblendet, gesperrt, unsichtbar, Prüfung, Abbildung, Sammlung. */
const Hinweise = ({
	abb,
	ablage,
	aktiv,
	art,
	doc,
	gesperrt,
	loesung,
	nr,
	pruefung,
	quelle,
	schalteAnsicht,
	struktur,
}: {
	abb: AbbildungSteuerung;
	ablage: Ablage;
	aktiv: boolean;
	art: string;
	doc: Document | null;
	gesperrt: number | null;
	loesung: boolean;
	nr: number;
	pruefung: Pruefstand | null;
	quelle: string | null;
	schalteAnsicht: () => void;
	struktur: Struktur;
}) => (
	<div className="flex flex-col gap-2 px-3 pb-2 empty:hidden" data-abschnitt="hinweise">
		{FREIES_ELEMENT.has(art) && <FreiesElementHinweis />}
		<AusgeblendetHinweis doc={doc} nr={nr} quelle={quelle} struktur={struktur} />
		<GesperrtHinweis gesperrt={gesperrt} struktur={struktur} />
		<UnsichtbarHinweis doc={doc} loesung={loesung} nr={nr} quelle={quelle} schalte={schalteAnsicht} />
		<Pruefhinweise
			stand={pruefung}
			nr={nr}
			gesperrt={gesperrt !== null}
			knopf={inSeiteHolen(doc, struktur, gesperrt !== null)}
		/>
		<AbbildungHinweise abb={abb} />
		{aktiv && quelle && <SammlungName ablage={ablage} />}
	</div>
);

/** Abschnitt „Inhalt“: Bild, Abbildung, Notiz der Folie, Tabelle und die Einstellungen des Bausteins. */
const InhaltAbschnitt = ({
	abb,
	aktiv,
	bild,
	inTabelle,
	kit,
	pfad,
}: {
	abb: AbbildungSteuerung;
	aktiv: boolean;
	bild: BildSteuerung;
	inTabelle: boolean;
	kit: Kit;
	pfad: PfadTeil[];
}) => {
	const { art, aus, folien, nr, quelle, struktur } = kit;
	return (
		<Abschnitt name="inhalt" titel={ABSCHNITT_TITEL.inhalt}>
			<Bildwerkzeug bild={bild} />
			<AbbildungFelder abb={abb} abschnitt="inhalt" />
			{aktiv && quelle && art === 'seite' && folien && (
				<Feld titel="Notiz">
					<FolienNotiz aus={aus} nr={nr} quelle={quelle} struktur={struktur} />
				</Feld>
			)}
			{aktiv && (
				<>
					{!inTabelle && (
						<TabellenWerkzeug
							aus={aus}
							folien={folien}
							nr={nr}
							pfad={pfad}
							quelle={quelle}
							struktur={struktur}
						/>
					)}
					<KitWerkzeug {...kit} abschnitt="inhalt" />
				</>
			)}
		</Abschnitt>
	);
};

/** 196-20: Am Baustein „Punkte“ die Aufgabe, zu der er gehört. */
const aufgabeDerPunkte = (art: string, pfad: PfadTeil[]) =>
	art === 'punkte'
		? pfad.findLast((t) => t.baustein.art === 'aufgabe' || t.baustein.art === 'sternchenaufgabe')
		: undefined;

/** 196-18: „Reihe · Spalten“ nur an der Reihe selbst und an ihrem direkten Kind. */
const reiheHier = (spalten: Spalten | null, nr: number, pfad: PfadTeil[]) =>
	spalten !== null && (spalten.nr === nr || pfad.at(-2)?.nr === spalten.nr);

/** Die Abschnitte der Eltern: Tabelle an Zeile und Zelle, Aufgabe am Baustein „Punkte“, Reihe, dann „Weitere“. */
const ElternAbschnitte = ({
	abb,
	aktiv,
	doc,
	inTabelle,
	kit,
	pfad,
	spalten,
}: {
	abb: AbbildungSteuerung;
	aktiv: boolean;
	doc: Document | null;
	inTabelle: boolean;
	kit: Kit;
	pfad: PfadTeil[];
	spalten: Spalten | null;
}) => {
	const { art, aus, folien, nr, quelle, struktur } = kit;
	const aufgabe = aufgabeDerPunkte(art, pfad);
	const anzahl = eintraegeIn(doc, spalten?.nr);
	return (
		<>
			{aktiv && inTabelle && (
				<Abschnitt name="eltern-tabelle" titel="Tabelle">
					<TabellenWerkzeug
						aus={aus}
						folien={folien}
						nr={nr}
						pfad={pfad}
						quelle={quelle}
						struktur={struktur}
					/>
				</Abschnitt>
			)}
			{aktiv && aufgabe && (
				<Abschnitt name="eltern-aufgabe" titel="Aufgabe">
					<KitWerkzeug {...kit} art="aufgabe" nr={aufgabe.nr} nur={['punkte']} abschnitt="bewertung" />
				</Abschnitt>
			)}
			<Abschnitt
				name="eltern"
				titel={spalten?.name ?? ''}
				// 196-32: Bei einem Eintrag gibt es kein „alle“
				notiz={anzahl > 1 ? `gilt für alle ${anzahl} Einträge` : undefined}
			>
				{spalten && reiheHier(spalten, nr, pfad) && spalten.nr !== nr && (
					<Spaltenwahl aus={aus} spalten={spalten} struktur={struktur} />
				)}
			</Abschnitt>
			{hatWeitere(abb) && (
				<Abschnitt name="weitere" titel={ABSCHNITT_TITEL.weitere} einklappbar zu>
					<AbbildungFelder abb={abb} abschnitt="weitere" />
				</Abschnitt>
			)}
		</>
	);
};

/** Feste Abschnitte in fester Reihenfolge; was leer bleibt, blendet `Abschnitt` aus. */
export const Einstellungen = ({
	abb,
	ablage,
	bild,
	doc,
	format,
	frei,
	geladen,
	loes,
	loesung,
	pfad,
	pruefung,
	quelle,
	schalteAnsicht,
	struktur,
	text,
}: EinstellungenEigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return null;
	}
	const { baustein, nr } = gewaehlt;
	// 196-13: Gesperrt (Konflikt, Vorschlag offen) bleiben die Abschnitte stehen, nur bedienen lassen sie sich nicht.
	// Gesperrt (`data-gesperrt`) ebenso, bis „Entsperren“.
	const gesperrt = gesperrtIn(doc, nr);
	const aus = !struktur.aktiv || gesperrt !== null;
	const aktiv = quelle !== null && struktur.werte !== null;
	const folien = format === 'folie';
	const kit = { art: baustein.art, aus, folien, nr, quelle, struktur };
	const spalten = aktiv ? (struktur.werte?.spalten ?? null) : null;
	// 196-05: An Zeile und Zelle steht der Aufbau der Tabelle unten als ihr Eltern-Abschnitt.
	const inTabelle = baustein.art === 'tabellenzeile' || baustein.art === 'tabellenzelle';
	// 196-21: Keine Lesehilfen an „Name:“ und „Datum:“; an der Zelle nach der Lösung
	const sprachSpaeter = baustein.art === 'tabellenzelle';
	const sprache = !pfad.some((t) => t.baustein.art === 'namenszeile') && (
		<Sprachwerkzeug
			pfad={pfad}
			aktiv={frei}
			geladen={geladen}
			quelle={quelle}
			bearbeitet={text.bearbeitet}
			beende={text.beende}
			struktur={struktur}
		/>
	);
	const hinweise = (
		<Hinweise
			abb={abb}
			ablage={ablage}
			aktiv={aktiv}
			art={baustein.art}
			doc={doc}
			gesperrt={gesperrt}
			loesung={loesung}
			nr={nr}
			pruefung={pruefung}
			quelle={quelle}
			schalteAnsicht={schalteAnsicht}
			struktur={struktur}
		/>
	);
	// Gestaltung (099): eigene Abschnitte statt der Bausteine; Pfad und Hinweise bleiben.
	if (istGestaltungAuswahl(baustein)) {
		return (
			<div>
				{hinweise}
				{/* 198-03: Die Sperre der Felder setzt der Gestaltungsinspektor je Abschnitt; die Sichtbarkeit bleibt bedienbar. */}
				<Gestaltung bild={bild} doc={doc} pfad={pfad} quelle={quelle} struktur={struktur} />
			</div>
		);
	}
	return (
		<div {...(abb.aktiv ? { 'data-abbildungswerkzeug': '' } : {})}>
			{hinweise}
			<fieldset
				disabled={gesperrt !== null}
				className="contents"
				data-gesperrt-felder={gesperrt !== null || undefined}
			>
				{!sprachSpaeter && sprache}
				<InhaltAbschnitt abb={abb} aktiv={aktiv} bild={bild} inTabelle={inTabelle} kit={kit} pfad={pfad} />
				<Abschnitt name="darstellung" titel={ABSCHNITT_TITEL.darstellung}>
					<BildDarstellung bild={bild} />
					<AbbildungFelder abb={abb} abschnitt="darstellung" />
					{aktiv && <KitWerkzeug {...kit} abschnitt="darstellung" />}
					{spalten?.nr === nr && <Spaltenwahl aus={aus} spalten={spalten} struktur={struktur} />}
				</Abschnitt>
				<Abschnitt name="loesung" titel={ABSCHNITT_TITEL.loesung}>
					<Loesungswerkzeug l={loes} />
					<AbbildungFelder abb={abb} abschnitt="loesung" />
					{/* 196-11: ein Feld „Lösung“; in der Lösungsansicht das der Antwortlinie (Vorschau, „Zur anderen …“). */}
					{aktiv && loes.antwort === null && <KitWerkzeug {...kit} abschnitt="loesung" />}
				</Abschnitt>
				{sprachSpaeter && sprache}
				<Abschnitt name="bewertung" titel={ABSCHNITT_TITEL.bewertung}>
					<AbbildungFelder abb={abb} abschnitt="bewertung" />
					{aktiv && <KitWerkzeug {...kit} abschnitt="bewertung" />}
				</Abschnitt>
				<Abschnitt name="sichtbarkeit" titel="Sichtbarkeit">
					{aktiv && (
						<SichtbarkeitWenn
							aus={aus}
							baustein={baustein}
							folien={folien}
							nr={nr}
							pfad={pfad}
							quelle={quelle}
							struktur={struktur}
						/>
					)}
				</Abschnitt>
				<ElternAbschnitte
					abb={abb}
					aktiv={aktiv}
					doc={doc}
					inTabelle={inTabelle}
					kit={kit}
					pfad={pfad}
					spalten={spalten}
				/>
			</fieldset>
		</div>
	);
};
