/**
 * Schema der Abbildungen aus `abbildungen.js` (018): welche Attribute ein `x-…`-Element hat, wie sie heißen, welche
 * Werte gelten und welche Regeln zwischen ihnen. Das Abbildungs-Panel baut daraus seine Eingaben; ein neues Element
 * braucht nur einen Eintrag hier. Rechnet nur über Text-Patches auf der Quelle, wie die anderen Editor-Befehle.
 */

import type { Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	entschluessele,
	ersetzeInnen,
	innenVon,
	schuetzeText,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { StrukturErgebnis } from './struktur';

/** Ein zweites Attribut für denselben Wert, das `abbildungen.js` nur im Beispiel und auf dem Lösungsblatt zeichnet. */
interface Loesung {
	attribut: string;
	/** Beschriftung des Schalters, z. B. „Zeiger nur in der Lösung“. */
	name: string;
	/** Stehen beide Attribute in der Quelle, zeichnet `abbildungen.js` dieses (sonst das sichtbare). */
	vorrang?: boolean;
}

interface FeldBasis {
	attribut: string;
	name: string;
	hilfe?: string;
	loesung?: Loesung;
	/** Abschnitt im Panel; außer dem ersten bleiben Abschnitte zunächst eingeklappt. */
	gruppe?: string;
	/** Der Wert ist der Text im Element (`<x-silben>Ro|si|ne</x-silben>`), nicht ein Attribut. */
	quelle?: 'inhalt';
}

export interface ZahlFeld extends FeldBasis {
	art: 'zahl';
	min: number;
	max: number;
	/** Was `abbildungen.js` ohne Attribut nimmt. */
	standard: number;
	schritt?: number;
	einheit?: string;
}

export interface UhrzeitFeld extends FeldBasis {
	art: 'uhrzeit';
}

export interface AuswahlFeld extends FeldBasis {
	art: 'auswahl';
	/** `wert: null` entfernt das Attribut, dann gilt der Standard aus `abbildungen.js`. */
	optionen: { wert: string | null; name: string }[];
	/** Was `abbildungen.js` ohne Attribut zeichnet, wenn es dafür eine eigene Option gibt. */
	standard?: string;
	/** Zurück und Vor unter der Auswahl: Man sieht jede Option gleich im Blatt. */
	blaettern?: boolean;
	/** Weitere Optionen aus einem Feld mit `|`-Teilen, z. B. die Bausteine eines Worts. */
	optionenAus?: string;
}

export interface SchalterFeld extends FeldBasis {
	art: 'schalter';
	an: string;
	aus: string;
	standard: boolean;
}

/** Eine Liste von Zahlen, z. B. die beschrifteten Zahlen am Zahlenstrahl. */
export interface ZahlenFeld extends FeldBasis {
	art: 'zahlen';
	beispiel: string;
}

/** Eine Zahl je Stelle einer Stellentafel; die Stellen stehen im Feld `stellen`. */
export interface ZiffernFeld extends FeldBasis {
	art: 'ziffern';
	stellen: string;
}

/** Ein einzeiliges oder mehrzeiliges Textfeld. */
export interface TextFeld extends FeldBasis {
	art: 'text';
	max?: number;
	/** Regulärer Ausdruck für den ganzen Text; `musterHilfe` sagt der Lehrkraft, was erlaubt ist. */
	muster?: string;
	musterHilfe?: string;
	zeilen?: number;
	beispiel?: string;
	/** Knopf, der das Zeichen an der Cursor-Stelle einfügt, z. B. den Silbenstrich. */
	einfuegen?: { zeichen: string; name: string };
}

export interface Option {
	wert: string;
	name: string;
}

export interface UnterFeld {
	name: string;
	art: 'text' | 'zahl' | 'auswahl' | 'muster' | 'schalter';
	optionen?: Option[];
	min?: number;
	max?: number;
	/** Neue Zeilen beginnen damit. */
	standard?: string;
	/** Darf leer bleiben (fällt am Zeilenende weg). */
	leer?: boolean;
	/** Nur `art: 'schalter'`: Wert, wenn der Haken gesetzt ist. */
	an?: string;
}

/** Zeilen aus Unterfeldern: `Hund: 7; Katze: 4`. Zeilen hinzufügen, löschen, verschieben. */
export interface ListeFeld extends FeldBasis {
	art: 'liste';
	unter: UnterFeld[];
	min?: number;
	max?: number;
	/** Zwischen den Zeilen; Standard `;`. */
	zeilenTrenner?: ';' | ' ' | '/';
	/** Zwischen den Unterfeldern einer Zeile; Standard `:`. */
	feldTrenner?: ':' | ' ' | '';
}

/** Mehrere Haken aus festen Optionen; im Attribut mit Leerzeichen getrennt. */
export interface MehrfachFeld extends FeldBasis {
	art: 'mehrfach';
	optionen: Option[];
	/** Was ohne Attribut gilt. */
	standard?: string[];
	mindestens?: number;
}

/** Ein Zustand einer Rasterzelle; `zeichen` steht im Panel in der Zelle. */
export interface RasterZustand {
	wert: string;
	name: string;
	zeichen?: string;
}

/** Eine Zelle in der Gestalt des Elements; das Element meldet sie beim Zeichnen (`meldeZellen`). */
export interface FormZelle {
	id: string;
	x: number;
	y: number;
	b?: number;
	h?: number;
	/** Grau in der Zelle, z. B. die berechnete Lösung. */
	text?: string;
	/** Gewählt, solange das Attribut fehlt. */
	an?: boolean;
}

/**
 * Kleines Gitter im Panel. Ohne `form`: `0 1 1 / 0 1 0` im Attribut, Antippen schaltet die Zustände durch oder nimmt mit
 * `zahlen` eine Zahl auf. Mit `form`: Felder in der Gestalt des Elements (Mauer, Haus, Tafel …), im Attribut stehen die
 * gewählten Felder als Liste.
 */
export interface RasterFeld extends FeldBasis {
	art: 'raster';
	/** Attribut mit der Spaltenzahl, feste Zahl, oder `wachsen` für Knöpfe Zeile/Spalte ±. */
	spalten?: string | number;
	zeilen?: string | number;
	zustaende?: RasterZustand[];
	zahlen?: { min: number; max: number };
	wachsen?: { spalten: number; zeilen: number };
	form?: boolean;
}

/** Auswahl mit Vorschau: im s/w-Blatt das Muster, im Farbblatt die Farbe. */
export interface MusterFeld extends FeldBasis {
	art: 'muster';
	optionen: Option[];
	standard?: string;
}

/** Knopf „Neu mischen“: setzt das Attribut neu, gleiche Inhalte in anderer Anordnung. */
export interface MischenFeld extends FeldBasis {
	art: 'mischen';
	knopf?: string;
}

type FeldAus018 = ZahlFeld | UhrzeitFeld | AuswahlFeld | SchalterFeld | ZahlenFeld | ZiffernFeld;
type FeldAus023 = TextFeld | ListeFeld | MehrfachFeld | RasterFeld | MusterFeld | MischenFeld;

/** Der Inhalt als Wort-Chips: Wort antippen, Markierung wählen; mit `gruppen` lassen sich Nachbarn verbinden. */
export interface MarkierungFeld extends FeldBasis {
	art: 'markierung';
	/** Wie die Auswahl im Panel heißt, z. B. „Wortart“. */
	markeName: string;
	optionen: Option[];
	gruppen?: boolean;
	beispiel?: string;
}

export type Feld = FeldAus018 | FeldAus023 | MarkierungFeld;

/** Attributname → Wert in der Quelle, `null` = fehlt. Enthält auch die Lösungs-Attribute. */
export type Werte = Record<string, string | null>;

/** Feld (`attribut`) → Meldung für die Lehrkraft. */
export type Fehler = Record<string, string>;

export interface AbbildungSchema {
	name: string;
	felder: Feld[];
	/** Regeln über mehrere Felder; laufen nur, wenn jedes Feld für sich gültig ist. */
	regeln?: (w: Lesen) => Fehler;
}

/** Zugriff auf die wirksamen Werte innerhalb einer Regel. */
export interface Lesen {
	zahl: (attribut: string) => number;
	zahlen: (attribut: string) => number[];
	text: (attribut: string) => string | null;
	/** Zeilen einer `liste`, je Zeile die Unterfelder. */
	zeilen: (attribut: string) => string[][];
	/** Zellen eines `raster`. */
	raster: (attribut: string) => string[][];
	/** Gewählte Werte eines `mehrfach`-Feldes oder Einträge eines Attributs. */
	liste: (attribut: string) => string[];
}

const STELLEN_STANDARD = 'Z E';

const GROESSE = { attribut: 'groesse', name: 'Größe', einheit: 'px' } as const;

const ZEHNER_EINER = (zehner: string, einer: string): AbbildungSchema['felder'] => [
	{ art: 'zahl', attribut: 'z', name: zehner, min: 0, max: 10, standard: 0 },
	{ art: 'zahl', attribut: 'e', name: einer, min: 0, max: 20, standard: 0 },
];

const mindestensEins = (w: Lesen): Fehler =>
	w.zahl('z') + w.zahl('e') === 0 ? { e: 'Mindestens ein Zehner oder ein Einer.' } : {};

export const FARBEN: Option[] = [
	{ wert: 'rot', name: 'Rot' },
	{ wert: 'blau', name: 'Blau' },
	{ wert: 'gruen', name: 'Grün' },
	{ wert: 'gelb', name: 'Gelb' },
	{ wert: 'orange', name: 'Orange' },
	{ wert: 'lila', name: 'Lila' },
	{ wert: 'grau', name: 'Grau' },
	{ wert: 'leer', name: 'Weiß' },
];

const ZAHL = /^-?\d+([.,]\d+)?$/;
export const alsZahl = (wert: string) => (ZAHL.test(wert.trim()) ? Number(wert.trim().replace(',', '.')) : NaN);

const WUERFELBAU_TEILE = [
	{ wert: 'schraegbild', name: 'Schrägbild' },
	{ wert: 'bauplan', name: 'Bauplan' },
	{ wert: 'vorne', name: 'Ansicht von vorne' },
	{ wert: 'rechts', name: 'Ansicht von rechts' },
	{ wert: 'links', name: 'Ansicht von links' },
	{ wert: 'oben', name: 'Ansicht von oben' },
];

const FIGUR_MARKEN: Option[] = [
	{ wert: 'rechter-winkel', name: 'Rechte Winkel' },
	{ wert: 'parallel', name: 'Parallele Seiten' },
	{ wert: 'gleich-lang', name: 'Gleich lange Seiten' },
];

const STUFEN_DREI = ['unmöglich', 'möglich', 'sicher'];
const STUFEN_FUENF: Option[] = ['unmöglich', 'wenig wahrscheinlich', 'möglich', 'sehr wahrscheinlich', 'sicher'].map(
	(wert) => ({ wert, name: wert }),
);

/** Satz als Wörter mit Markierung; bei `gruppen` gehören benachbarte Wörter mit gleicher `gruppe` zu einem Satzglied. */
export interface MarkWort {
	wort: string;
	marke: string | null;
	gruppe: number;
	/** Was bis zum nächsten Wort folgt: Leerzeichen, Satzzeichen. */
	nach: string;
}

export interface MarkSatz {
	vor: string;
	woerter: MarkWort[];
}

const WORT = /[\p{L}\p{N}-]+/gu;

const woerterIn = (text: string, marke: string | null, gruppe: () => number): MarkSatz => {
	const treffer = [...text.matchAll(WORT)];
	const woerter = treffer.map((t, i): MarkWort => {
		const ende = (t.index ?? 0) + t[0].length;
		return { wort: t[0], marke, gruppe: gruppe(), nach: text.slice(ende, treffer[i + 1]?.index ?? text.length) };
	});
	return { vor: treffer.length === 0 ? text : text.slice(0, treffer[0]?.index ?? 0), woerter };
};

const lesenEinzeln = (wert: string): MarkSatz => {
	const treffer = [...wert.matchAll(/([\p{L}\p{N}-]+)(?:\/(\p{L}*))?/gu)];
	const woerter = treffer.map((t, i): MarkWort => {
		const ende = (t.index ?? 0) + t[0].length;
		return {
			wort: t[1] ?? '',
			marke: t[2] ?? null,
			gruppe: i,
			nach: wert.slice(ende, treffer[i + 1]?.index ?? wert.length),
		};
	});
	return { vor: treffer.length === 0 ? wert : wert.slice(0, treffer[0]?.index ?? 0), woerter };
};

const lesenGruppen = (wert: string): MarkSatz => {
	let nr = 0;
	const neueGruppe = () => nr++;
	const satz: MarkSatz = { vor: '', woerter: [] };
	const anhaengen = (teil: MarkSatz) => {
		const letztes = satz.woerter.at(-1);
		if (letztes) {
			letztes.nach += teil.vor;
		} else {
			satz.vor += teil.vor;
		}
		satz.woerter.push(...teil.woerter);
	};
	for (const t of wert.matchAll(/\[([^[\]]*)\](\p{L}*)|[^[\]]+|[[\]]/gu)) {
		if (t[1] === undefined) {
			anhaengen(woerterIn(t[0], null, neueGruppe));
		} else {
			const gruppe = neueGruppe();
			anhaengen(woerterIn(t[1], t[2] || null, () => gruppe));
		}
	}
	return satz;
};

export const markierungLesen = (wert: string, gruppen = false) => (gruppen ? lesenGruppen(wert) : lesenEinzeln(wert));

export const markierungKlartext = (satz: MarkSatz) => satz.vor + satz.woerter.map((w) => `${w.wort}${w.nach}`).join('');

/** Einzelne Wörter und Gruppen ohne Rolle bleiben ohne Klammer, wenn sie allein stehen. */
export const markierungText = (satz: MarkSatz, gruppen = false) => {
	if (!gruppen) {
		return satz.vor + satz.woerter.map((w) => `${w.wort}${w.marke ? `/${w.marke}` : ''}${w.nach}`).join('');
	}
	let text = satz.vor;
	satz.woerter.forEach((w, i) => {
		const vorher = satz.woerter[i - 1];
		const nachher = satz.woerter[i + 1];
		const offen = vorher?.gruppe !== w.gruppe;
		const schluss = nachher?.gruppe !== w.gruppe;
		const klammer = w.marke !== null || !offen || !schluss;
		text += `${klammer && offen ? '[' : ''}${w.wort}${klammer && schluss ? `]${w.marke ?? ''}` : ''}${w.nach}`;
	});
	return text;
};

/** Überträgt die Markierungen auf einen neuen Satz: Wörter, die gleich bleiben, behalten ihre (längste gemeinsame Folge). */
export const markierungNeuerText = (alt: MarkSatz, klartext: string): MarkSatz => {
	let nr = Math.max(-1, ...alt.woerter.map((w) => w.gruppe)) + 1;
	const neu = woerterIn(klartext, null, () => nr++);
	const a = alt.woerter;
	const b = neu.woerter;
	const laenge = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	const feld = (i: number, j: number) => laenge[i]?.[j] ?? 0;
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			const gleich = a[i]?.wort === b[j]?.wort;
			(laenge[i] as number[])[j] = gleich ? feld(i + 1, j + 1) + 1 : Math.max(feld(i + 1, j), feld(i, j + 1));
		}
	}
	let i = 0;
	let j = 0;
	const herkunft = new Map<number, MarkWort>();
	while (i < a.length && j < b.length) {
		const quelle = a[i];
		if (quelle && quelle.wort === b[j]?.wort) {
			herkunft.set(j, quelle);
			i++;
			j++;
		} else if (feld(i + 1, j) >= feld(i, j + 1)) {
			i++;
		} else {
			j++;
		}
	}
	b.forEach((w, k) => {
		const quelle = herkunft.get(k);
		if (quelle) {
			w.marke = quelle.marke;
			w.gruppe = quelle.gruppe;
		}
	});
	// Ein neues Wort mitten in einer Gruppe gehört dazu, sonst zerfiele sie.
	b.forEach((w, k) => {
		if (herkunft.has(k)) {
			return;
		}
		const links = [...b.slice(0, k)].reverse().find((_, r) => herkunft.has(k - 1 - r));
		const rechts = b.slice(k + 1).find((_, r) => herkunft.has(k + 1 + r));
		if (links && rechts && links.gruppe === rechts.gruppe) {
			w.gruppe = links.gruppe;
			w.marke = links.marke;
		}
	});
	return neu;
};

export const markeSetzen = (satz: MarkSatz, i: number, marke: string | null): MarkSatz => {
	const gruppe = satz.woerter[i]?.gruppe;
	return { ...satz, woerter: satz.woerter.map((w) => (w.gruppe === gruppe ? { ...w, marke } : w)) };
};

/** Verbindet die Gruppe von Wort `i` mit der des nächsten Worts; die erste vorhandene Markierung gilt. */
export const markeVerbinden = (satz: MarkSatz, i: number): MarkSatz => {
	const links = satz.woerter[i];
	const rechts = satz.woerter[i + 1];
	if (!links || !rechts || links.gruppe === rechts.gruppe) {
		return satz;
	}
	const marke = links.marke ?? rechts.marke;
	return {
		...satz,
		woerter: satz.woerter.map((w) =>
			w.gruppe === links.gruppe || w.gruppe === rechts.gruppe ? { ...w, gruppe: links.gruppe, marke } : w,
		),
	};
};

/** Trennt die Gruppe zwischen Wort `i` und dem nächsten; beide Teile behalten die Markierung. */
export const markeTrennen = (satz: MarkSatz, i: number): MarkSatz => {
	const links = satz.woerter[i];
	const rechts = satz.woerter[i + 1];
	if (!links || !rechts || links.gruppe !== rechts.gruppe) {
		return satz;
	}
	const neu = Math.max(...satz.woerter.map((w) => w.gruppe)) + 1;
	return {
		...satz,
		woerter: satz.woerter.map((w, k) => (k > i && w.gruppe === links.gruppe ? { ...w, gruppe: neu } : w)),
	};
};

const WORTART_OPTIONEN: Option[] = [
	{ wert: 'N', name: 'Nomen' },
	{ wert: 'Art', name: 'Artikel' },
	{ wert: 'V', name: 'Verb' },
	{ wert: 'A', name: 'Adjektiv' },
	{ wert: 'P', name: 'Pronomen' },
	{ wert: 'Pr', name: 'Präposition' },
	{ wert: 'K', name: 'Konjunktion' },
	{ wert: 'Adv', name: 'Adverb' },
];

const ROLLEN_OPTIONEN: Option[] = [
	{ wert: 'S', name: 'Subjekt' },
	{ wert: 'P', name: 'Prädikat' },
	{ wert: 'AkO', name: 'Akkusativobjekt' },
	{ wert: 'DaO', name: 'Dativobjekt' },
	{ wert: 'Ort', name: 'Ortsangabe' },
	{ wert: 'Zeit', name: 'Zeitangabe' },
];

export const ABBILDUNG_SCHEMA = {
	'x-uhr': {
		name: 'Uhr',
		felder: [
			{
				art: 'uhrzeit',
				attribut: 'zeit',
				name: 'Uhrzeit',
				hilfe: 'Ohne Uhrzeit bleibt die Uhr leer, zum Einzeichnen.',
				loesung: { attribut: 'loesung', name: 'Zeiger nur in der Lösung' },
			},
			{ art: 'schalter', attribut: 'ziffern', name: 'Ziffern 1 bis 12', an: 'ja', aus: 'nein', standard: true },
			{ art: 'zahl', ...GROESSE, min: 48, max: 300, standard: 88, schritt: 8 },
			{
				art: 'auswahl',
				attribut: 'digital',
				name: 'Digitalanzeige',
				gruppe: 'Mehr',
				standard: 'nein',
				optionen: [
					{ wert: 'nein', name: 'Keine' },
					{ wert: 'ja', name: 'Unter der Uhr' },
					{ wert: 'nur', name: 'Nur digital' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'format',
				name: 'Digital im Format',
				gruppe: 'Mehr',
				standard: '24',
				optionen: [
					{ wert: '24', name: '24 Stunden' },
					{ wert: '12', name: '12 Stunden' },
				],
			},
			{
				art: 'text',
				attribut: 'sektor',
				name: 'Zeitspanne als Fläche',
				gruppe: 'Mehr',
				beispiel: '4:30-4:50',
				muster: '\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}',
				musterHilfe: 'Zwei Uhrzeiten wie 4:30-4:50.',
				loesung: { attribut: 'sektor-loesung', name: 'Fläche nur in der Lösung' },
			},
			{
				art: 'schalter',
				attribut: 'minuten',
				name: 'Außenring 5, 10, …',
				gruppe: 'Mehr',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'schalter',
				attribut: 'ziffern24',
				name: 'Innerer Ring 13 bis 24',
				gruppe: 'Mehr',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-menge': {
		name: 'Menge',
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Anzahl', min: 1, max: 100, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreise' },
					{ wert: 'plaettchen', name: 'Plättchen' },
					{ wert: 'nuss', name: 'Nüsse' },
				],
			},
			{ art: 'zahl', attribut: 'reihe', name: 'In einer Reihe', min: 1, max: 10, standard: 10 },
			{
				art: 'zahl',
				attribut: 'buendel',
				name: 'Eingekreiste Zehner',
				min: 0,
				max: 10,
				standard: 0,
				loesung: { attribut: 'buendel-loesung', name: 'Nur in der Lösung einkreisen', vorrang: true },
			},
			{ art: 'zahl', ...GROESSE, min: 8, max: 40, standard: 16, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const buendel = w.zahl('buendel');
			if (buendel > 0 && w.zahl('reihe') !== 10) {
				return { buendel: 'Zehner einkreisen geht nur mit 10 in einer Reihe.' };
			}
			const voll = Math.floor(w.zahl('n') / 10);
			if (buendel > voll) {
				return {
					buendel:
						voll === 0
							? 'Es gibt keinen vollen Zehner zum Einkreisen.'
							: `Es gibt nur ${voll} volle ${voll === 1 ? 'Zehnerreihe' : 'Zehnerreihen'}.`,
				};
			}
			return {};
		},
	},
	'x-dienes': {
		name: 'Mehrsystemblöcke',
		felder: [
			{ art: 'zahl', attribut: 't', name: 'Tausenderwürfel', min: 0, max: 9, standard: 0 },
			{ art: 'zahl', attribut: 'h', name: 'Hunderterplatten', min: 0, max: 9, standard: 0 },
			...ZEHNER_EINER('Zehnerstangen', 'Einerwürfel'),
			{
				art: 'zahlen',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				beispiel: '1 2 3 4',
				hilfe: 'Vier Zahlen: Tausender, Hunderter, Zehner, Einer.',
			},
			{ art: 'zahl', ...GROESSE, min: 4, max: 16, standard: 8 },
		],
		regeln: (w): Fehler =>
			w.zahl('t') + w.zahl('h') + w.zahl('z') + w.zahl('e') === 0 && w.zahlen('loesung').length === 0
				? { e: 'Mindestens ein Block, auf dem Blatt oder in der Lösung.' }
				: {},
	},
	'x-strichpunkt': {
		name: 'Strich-Punkt-Bild',
		felder: [
			...ZEHNER_EINER('Striche (Zehner)', 'Punkte (Einer)'),
			{ art: 'zahl', ...GROESSE, min: 20, max: 80, standard: 40, schritt: 4 },
		],
		regeln: mindestensEins,
	},
	'x-stellentafel': {
		name: 'Stellentafel',
		felder: [
			{
				art: 'auswahl',
				attribut: 'stellen',
				name: 'Stellen',
				standard: STELLEN_STANDARD,
				optionen: [
					{ wert: 'E', name: 'E' },
					{ wert: 'Z E', name: 'Z E' },
					{ wert: 'H Z E', name: 'H Z E' },
					{ wert: 'T H Z E', name: 'T H Z E' },
					{ wert: 'ZT T H Z E', name: 'ZT T H Z E' },
					{ wert: 'HT ZT T H Z E', name: 'HT ZT T H Z E' },
					{ wert: 'M HT ZT T H Z E', name: 'M HT ZT T H Z E' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'ziffern',
				optionen: [
					{ wert: 'ziffern', name: 'Ziffern' },
					{ wert: 'plaettchen', name: 'Plättchen' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'plaettchen',
				name: 'Plättchen je Stelle',
				beispiel: '3 0 12',
				hilfe: 'Von links nach rechts, bis 15 je Stelle. In der Lösung steht dieselbe Angabe unter „Nur in der Lösung zeigen“.',
			},
			{
				art: 'ziffern',
				attribut: 'werte',
				name: 'Zahlen in der Tafel',
				stellen: 'stellen',
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen' },
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 6, standard: 1 },
		],
	},
	'x-zwanzigerfeld': {
		name: 'Zwanzigerfeld',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Feld',
				standard: 'zwanziger',
				optionen: [
					{ wert: 'fuenfer', name: 'Fünferfeld' },
					{ wert: 'zehner', name: 'Zehnerfeld' },
					{ wert: 'zwanziger', name: 'Zwanzigerfeld' },
				],
			},
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 20, standard: 0 },
			{ art: 'zahl', attribut: 'n2', name: 'Plättchen, zweite Sorte', min: 0, max: 20, standard: 0 },
			{
				art: 'zahlen',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				beispiel: '5 2',
				hilfe: 'Plättchen und zweite Sorte.',
			},
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-zahlenstrahl': {
		name: 'Zahlenstrahl',
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 0, max: 1000000, standard: 0 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 1000000, standard: 20 },
			{ art: 'zahl', attribut: 'schritt', name: 'Abstand der Striche', min: 1, max: 100000, standard: 1 },
			{ art: 'zahl', attribut: 'marken', name: 'Mittlere Striche alle', min: 1, max: 100, standard: 5 },
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Beschriftete Zahlen',
				beispiel: '0 5 10',
				hilfe: 'Leer: nur Anfang und Ende.',
			},
			{
				art: 'zahlen',
				attribut: 'pfeile',
				name: 'Pfeile mit Kästchen',
				beispiel: '7 13',
				hilfe: 'Die Zahl im Kästchen steht nur in der Lösung.',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 200,
				max: 1000,
				standard: 560,
				schritt: 20,
			},
			{ art: 'zahl', attribut: 'schrift', name: 'Schriftgröße', einheit: 'px', min: 10, max: 28, standard: 16 },
		],
		regeln: (w): Fehler => {
			const von = w.zahl('von');
			const bis = w.zahl('bis');
			if (von >= bis) {
				return { bis: '„Bis“ muss größer sein als „Von“.' };
			}
			const striche = (bis - von) / w.zahl('schritt');
			if (striche > 200) {
				return {
					schritt: `Das wären ${Math.ceil(striche)} Striche. Nimm einen größeren Abstand (höchstens 200).`,
				};
			}
			const fehler: Fehler = {};
			for (const feld of ['zahlen', 'pfeile']) {
				const draussen = w.zahlen(feld).find((z) => z < von || z > bis);
				if (draussen !== undefined) {
					fehler[feld] = `${draussen} liegt nicht zwischen ${von} und ${bis}.`;
				}
			}
			return fehler;
		},
	},
	'x-timer': {
		name: 'Timer',
		felder: [
			{ art: 'zahl', attribut: 'minuten', name: 'Minuten', min: 1, max: 120, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'skala',
				name: 'Skala',
				hilfe: 'Für kurze Phasen 5 oder 10 Minuten, sonst ist die Scheibe kaum zu sehen.',
				optionen: [
					{ wert: null, name: 'Passend (60 bzw. 120)' },
					{ wert: '5', name: '5 Minuten' },
					{ wert: '10', name: '10 Minuten' },
					{ wert: '15', name: '15 Minuten' },
					{ wert: '30', name: '30 Minuten' },
					{ wert: '60', name: '60 Minuten' },
					{ wert: '120', name: '120 Minuten' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 120, max: 600, standard: 360, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const skala = w.text('skala');
			return skala !== null && w.zahl('minuten') > Number(skala)
				? { skala: `Die Skala reicht nur bis ${skala}. Nimm eine größere oder „Passend“.` }
				: {};
		},
	},
	/** Nur für die Tests der Feldtypen (023); kommt in Material nicht vor. */
	'x-probe': {
		name: 'Probe',
		felder: [
			{ art: 'text', attribut: 'titel', name: 'Titel', max: 20, gruppe: 'Einfach' },
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Wort',
				quelle: 'inhalt',
				muster: '[A-Za-zÄÖÜäöüß|&<]*',
				musterHilfe: 'Nur Buchstaben und |.',
				einfuegen: { zeichen: '|', name: 'Strich einfügen' },
				gruppe: 'Einfach',
			},
			{ art: 'muster', attribut: 'farbe', name: 'Füllung', optionen: FARBEN, standard: 'rot', gruppe: 'Einfach' },
			{
				art: 'mehrfach',
				attribut: 'arten',
				name: 'Arten',
				optionen: [
					{ wert: 'eins', name: 'Eins' },
					{ wert: 'zwei', name: 'Zwei' },
					{ wert: 'drei', name: 'Drei' },
				],
				gruppe: 'Einfach',
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung', gruppe: 'Einfach' },
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Zahl', art: 'zahl', min: 0, max: 99, standard: '1' },
				],
				min: 1,
				max: 5,
				gruppe: 'Listen',
			},
			{ art: 'raster', attribut: 'feld', name: 'Feld', spalten: 3, zeilen: 2, gruppe: 'Raster' },
			{
				art: 'raster',
				attribut: 'hoehen',
				name: 'Höhen',
				zahlen: { min: 0, max: 5 },
				wachsen: { spalten: 4, zeilen: 4 },
				gruppe: 'Raster',
			},
			{ art: 'raster', attribut: 'form', name: 'Form', form: true, gruppe: 'Raster' },
		],
		regeln: (w): Fehler => (w.zeilen('eintraege').length === 4 ? { eintraege: 'Vier geht nicht.' } : {}),
	},
	'x-gluecksrad': {
		name: 'Glücksrad',
		felder: [
			{
				art: 'liste',
				attribut: 'felder',
				name: 'Felder',
				unter: [
					{ name: 'Füllung', art: 'muster', optionen: FARBEN, standard: 'rot' },
					{ name: 'Beschriftung', art: 'text', leer: true },
				],
				min: 2,
				max: 12,
			},
			{
				art: 'zahlen',
				attribut: 'anteile',
				name: 'Anteile',
				beispiel: '1 1 2',
				hilfe: 'Eine Zahl je Feld. Leer heißt: alle Felder gleich groß.',
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Füllungen erst in der Lösung',
				hilfe: 'Auf dem Blatt bleiben alle Felder weiß, z. B. „rot blau rot“.',
				beispiel: 'rot blau rot',
			},
			{ art: 'schalter', attribut: 'zeiger', name: 'Zeiger', an: 'ja', aus: 'nein', standard: true },
			{ art: 'schalter', attribut: 'legende', name: 'Legende', an: 'ja', aus: 'nein', standard: true },
			{
				art: 'schalter',
				attribut: 'bastel',
				name: 'Bastelvorlage (12 cm)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 100, max: 460, standard: 200, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const felder = w.zeilen('felder').length;
			const anteile = w.zahlen('anteile');
			if (anteile.length > 0 && anteile.reduce((a, b) => a + b, 0) <= 0) {
				return { anteile: 'Die Anteile müssen zusammen mehr als 0 ergeben.' };
			}
			if (anteile.length > 0 && felder > 0 && anteile.length !== felder) {
				return { anteile: `Bitte genau ${felder} Zahlen, eine je Feld.` };
			}
			return {};
		},
	},
	'x-wuerfel': {
		name: 'Würfel',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Seite zeigt',
				standard: 'augen',
				optionen: [
					{ wert: 'augen', name: 'Augen' },
					{ wert: 'zahl', name: 'Zahl' },
					{ wert: 'muster', name: 'Füllung' },
					{ wert: 'text', name: 'Text' },
				],
			},
			{ art: 'zahl', attribut: 'augen', name: 'Augen', min: 0, max: 6, standard: 0 },
			{ art: 'text', attribut: 'inhalt', name: 'Zahl, Text oder Füllung', max: 6 },
			{ art: 'text', attribut: 'loesung', name: 'Nur in der Lösung', max: 6 },
			{
				art: 'auswahl',
				attribut: 'ansicht',
				name: 'Ansicht',
				standard: 'flach',
				optionen: [
					{ wert: 'flach', name: 'Flach' },
					{ wert: 'raeumlich', name: 'Räumlich' },
				],
			},
			{ art: 'zahl', attribut: 'oben', name: 'Oben', min: 0, max: 6, standard: 1 },
			{ art: 'zahl', attribut: 'vorne', name: 'Vorne', min: 0, max: 6, standard: 2 },
			{ art: 'zahl', attribut: 'rechts', name: 'Rechts', min: 0, max: 6, standard: 3 },
			{ art: 'zahl', ...GROESSE, min: 32, max: 200, standard: 60, schritt: 4 },
		],
	},
	'x-strichliste': {
		name: 'Strichliste',
		felder: [
			{
				art: 'liste',
				attribut: 'werte',
				name: 'Zeilen',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Anzahl', art: 'zahl', min: 0, max: 30, standard: '1' },
				],
				min: 1,
				max: 8,
			},
			{
				art: 'auswahl',
				attribut: 'zeige',
				name: 'Auf dem Blatt steht',
				standard: 'striche',
				optionen: [
					{ wert: 'striche', name: 'Striche' },
					{ wert: 'zahl', name: 'Anzahl' },
					{ wert: 'leer', name: 'Nichts' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 28, max: 60, standard: 34, schritt: 2 },
		],
	},
	'x-diagramm': {
		name: 'Diagramm',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'saeulen',
				optionen: [
					{ wert: 'saeulen', name: 'Säulen' },
					{ wert: 'balken', name: 'Balken' },
					{ wert: 'bild', name: 'Bilder' },
				],
			},
			{
				art: 'liste',
				attribut: 'werte',
				name: 'Werte',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Wert', art: 'zahl', min: 0, max: 100000, standard: '1' },
				],
				min: 1,
				max: 12,
			},
			{
				art: 'zahlen',
				attribut: 'offen',
				name: 'Offen zum Zeichnen',
				beispiel: '2 3',
				hilfe: 'Nummern der Einträge, die die Kinder selbst zeichnen.',
			},
			{ art: 'zahl', attribut: 'skala', name: 'Skalenschritt', min: 1, max: 100000, standard: 1 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 100000, standard: 10 },
			{ art: 'text', attribut: 'einheit', name: 'Achse', max: 20 },
			{
				art: 'auswahl',
				attribut: 'symbol',
				name: 'Symbol',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'stern', name: 'Stern' },
					{ wert: 'herz', name: 'Herz' },
				],
			},
			{ art: 'zahl', attribut: 'je', name: 'Ein Symbol steht für', min: 1, max: 1000, standard: 1 },
			{ art: 'zahl', ...GROESSE, min: 100, max: 400, standard: 200, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const bis = w.text('bis');
			const groesster = Math.max(0, ...w.zeilen('werte').map((z) => alsZahl(z[1] ?? '0')));
			return bis !== null && groesster > alsZahl(bis) ? { bis: `Ein Wert ist größer als ${bis}.` } : {};
		},
	},
	'x-urne': {
		name: 'Kugeln im Säckchen',
		felder: [
			{
				art: 'liste',
				attribut: 'kugeln',
				name: 'Kugeln',
				unter: [
					{ name: 'Füllung', art: 'muster', optionen: FARBEN, standard: 'rot' },
					{ name: 'Anzahl', art: 'zahl', min: 0, max: 20, standard: '1' },
				],
				max: 8,
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Kugeln erst in der Lösung',
				hilfe: 'Auf dem Blatt bleibt das Gefäß leer, z. B. „rot: 3; blau: 1“.',
				beispiel: 'rot: 3; blau: 1',
			},
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Gefäß',
				standard: 'sack',
				optionen: [
					{ wert: 'sack', name: 'Säckchen' },
					{ wert: 'glas', name: 'Glas' },
				],
			},
			{ art: 'schalter', attribut: 'legende', name: 'Legende', an: 'ja', aus: 'nein', standard: true },
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
			{ art: 'zahl', ...GROESSE, min: 100, max: 300, standard: 160, schritt: 10 },
		],
		regeln: (w): Fehler => {
			const summe = w.zeilen('kugeln').reduce((a, z) => a + alsZahl(z[1] ?? '0'), 0);
			return summe > 20 ? { kugeln: `Höchstens 20 Kugeln, hier sind es ${summe}.` } : {};
		},
	},
	'x-wahrscheinlichkeit': {
		name: 'Wahrscheinlichkeit',
		felder: [
			{
				art: 'auswahl',
				attribut: 'stufen',
				name: 'Stufen',
				standard: '3',
				optionen: [
					{ wert: '3', name: '3: unmöglich, möglich, sicher' },
					{ wert: '5', name: '5: auch wenig und sehr wahrscheinlich' },
				],
			},
			{
				art: 'liste',
				attribut: 'ereignisse',
				name: 'Ereignisse',
				unter: [
					{ name: 'Buchstabe', art: 'text', standard: 'A' },
					{ name: 'Stufe', art: 'auswahl', standard: 'möglich', optionen: STUFEN_FUENF },
				],
				max: 10,
			},
		],
		regeln: (w): Fehler => {
			const erlaubt = w.text('stufen') === '5' ? STUFEN_FUENF.map((o) => o.wert) : STUFEN_DREI;
			const falsch = w.zeilen('ereignisse').find((z) => !erlaubt.includes(z[1] ?? ''));
			return falsch ? { ereignisse: `„${falsch[1] ?? ''}“ steht nicht auf dieser Skala.` } : {};
		},
	},
	'x-kombinatorik': {
		name: 'Möglichkeiten',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'baum',
				optionen: [
					{ wert: 'baum', name: 'Baum' },
					{ wert: 'tabelle', name: 'Tabelle' },
					{ wert: 'liste', name: 'Liste' },
				],
			},
			{
				art: 'liste',
				attribut: 'stufen',
				name: 'Stufen',
				zeilenTrenner: '/',
				hilfe: 'Je Stufe die Wörter mit Leerzeichen, z. B. „Waffel Becher“.',
				unter: [{ name: 'Wörter', art: 'text', standard: 'A B' }],
				min: 1,
				max: 3,
			},
			{
				art: 'schalter',
				attribut: 'wiederholung',
				name: 'Mit Wiederholung',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{
				art: 'schalter',
				attribut: 'reihenfolge',
				name: 'Reihenfolge zählt',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{ art: 'zahl', attribut: 'vorgegeben', name: 'Schon ausgefüllt', min: 0, max: 24, standard: 1 },
		],
	},
	'x-gitter': {
		name: 'Gitter',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'karo',
				gruppe: 'Gitter',
				optionen: [
					{ wert: 'karo', name: 'Kästchen' },
					{ wert: 'punkte', name: 'Punkte' },
					{ wert: 'geobrett', name: 'Geobrett' },
				],
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 40, standard: 10, gruppe: 'Gitter' },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 40, standard: 8, gruppe: 'Gitter' },
			{
				art: 'auswahl',
				attribut: 'kaestchen',
				name: 'Kästchen',
				gruppe: 'Gitter',
				optionen: [
					{ wert: null, name: 'Wie im Heft der Klasse' },
					{ wert: '0.5', name: '0,5 cm' },
					{ wert: '1', name: '1 cm' },
				],
			},
			{ art: 'raster', attribut: 'figur', name: 'Figur', spalten: 'spalten', zeilen: 'zeilen', gruppe: 'Figur' },
			{
				art: 'text',
				attribut: 'linien',
				name: 'Figur aus Linien',
				gruppe: 'Figur',
				muster: '[-0-9.,; ]*',
				musterHilfe: 'Punkte wie 0,0 3,0 3,2; mehrere Figuren mit ; trennen.',
				hilfe: 'Diese Figur besteht aus Linien und lässt sich nur über Claude ändern.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'spiegeln', name: 'Spiegeln' },
					{ wert: 'fortsetzen', name: 'Fortsetzen' },
					{ wert: 'vergroessern', name: 'Vergrößern' },
					{ wert: 'weg', name: 'Weg' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'achse',
				name: 'Achse',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: null, name: 'Keine' },
					{ wert: 'senkrecht', name: 'Senkrecht' },
					{ wert: 'waagerecht', name: 'Waagerecht' },
				],
			},
			{
				art: 'zahl',
				attribut: 'achse-bei',
				name: 'Achse nach Kästchen',
				min: 1,
				max: 39,
				standard: 5,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapport',
				name: 'Breite eines Musters',
				min: 1,
				max: 40,
				standard: 4,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapporte',
				name: 'Muster vorgegeben',
				min: 1,
				max: 10,
				standard: 2,
				gruppe: 'Aufgabe',
			},
			{
				art: 'auswahl',
				attribut: 'rapportart',
				name: 'Fortsetzen durch',
				standard: 'schieben',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'schieben', name: 'Schieben' },
					{ wert: 'spiegeln', name: 'Spiegeln im Wechsel' },
					{ wert: 'drehen', name: 'Drehen im Wechsel' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'faktor',
				name: 'Größe',
				standard: '2',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: '2', name: 'Doppelt so groß' },
					{ wert: '0.3', name: 'Klein' },
					{ wert: '0.5', name: 'Halb so groß' },
				],
			},
			{
				art: 'liste',
				attribut: 'weg',
				name: 'Weg',
				zeilenTrenner: ' ',
				feldTrenner: '',
				gruppe: 'Aufgabe',
				unter: [
					{ name: 'Schritte', art: 'zahl', min: 1, max: 40, standard: '1' },
					{
						name: 'Richtung',
						art: 'auswahl',
						standard: '→',
						optionen: [
							{ wert: '→', name: '→ rechts' },
							{ wert: '←', name: '← links' },
							{ wert: '↑', name: '↑ hoch' },
							{ wert: '↓', name: '↓ runter' },
						],
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'wegart',
				name: 'Beim Weg',
				standard: 'gehen',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'gehen', name: 'Kinder gehen die Pfeile' },
					{ wert: 'beschreiben', name: 'Kinder schreiben die Pfeile' },
				],
			},
			{
				art: 'text',
				attribut: 'start',
				name: 'Start (Spalte,Zeile)',
				gruppe: 'Aufgabe',
				muster: '\\d+,\\d+',
				musterHilfe: 'Zum Beispiel 2,3. Das Kästchen oben links ist 0,0.',
			},
			{
				art: 'mehrfach',
				attribut: 'zaehlen',
				name: 'Zählen lassen',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'flaeche', name: 'Fläche' },
					{ wert: 'umfang', name: 'Umfang' },
				],
			},
		],
	},
	'x-figur': {
		name: 'Figur',
		felder: [
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'quadrat',
				optionen: [
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'rechteck', name: 'Rechteck' },
					{ wert: 'dreieck', name: 'Dreieck' },
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'trapez', name: 'Trapez' },
					{ wert: 'parallelogramm', name: 'Parallelogramm' },
					{ wert: 'raute', name: 'Raute' },
					{ wert: 'fuenfeck', name: 'Fünfeck' },
					{ wert: 'sechseck', name: 'Sechseck' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'typ',
				name: 'Dreieck',
				standard: 'rechtwinklig',
				optionen: [
					{ wert: 'rechtwinklig', name: 'Rechtwinklig' },
					{ wert: 'gleichseitig', name: 'Gleichseitig' },
					{ wert: 'gleichschenklig', name: 'Gleichschenklig' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'masse',
				name: 'Maße in cm',
				beispiel: '4 3',
				hilfe: 'Mit Maßen zeichnet die Figur in echten Zentimetern.',
			},
			{ art: 'zahl', attribut: 'drehung', name: 'Drehung in Grad', min: 0, max: 359, standard: 0, schritt: 15 },
			{ art: 'mehrfach', attribut: 'markierung', name: 'Kennzeichnen', optionen: FIGUR_MARKEN },
			{ art: 'mehrfach', attribut: 'loesung', name: 'Kennzeichnen nur in der Lösung', optionen: FIGUR_MARKEN },
			{
				art: 'schalter',
				attribut: 'beschriftung',
				name: 'Ecken A, B, C',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 60, max: 400, standard: 120, schritt: 10 },
		],
	},
	'x-hunderterfeld': {
		name: 'Hunderterfeld',
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 100, standard: 0 },
			{ art: 'zahl', attribut: 'n2', name: 'Plättchen, zweite Sorte', min: 0, max: 100, standard: 0 },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 10 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 10 },
			{
				art: 'text',
				attribut: 'malwinkel',
				name: 'Malwinkel',
				muster: '([0-9]+x[0-9]+)?',
				musterHilfe: 'So: 3x7.',
			},
			{
				art: 'text',
				attribut: 'loesung',
				name: 'Nur in der Lösung zeigen',
				muster: '[0-9 x]*',
				musterHilfe: 'Plättchen wie 30 6 oder Malwinkel wie 3x7.',
			},
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-hundertertafel': {
		name: 'Hundertertafel',
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 1, max: 9901, standard: 1 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 10000, standard: 100 },
			{
				art: 'auswahl',
				attribut: 'ausschnitt',
				name: 'Ausschnitt',
				standard: 'ganz',
				optionen: [
					{ wert: 'ganz', name: 'Ganze Tafel' },
					{ wert: 'zeile', name: 'Zeile' },
					{ wert: 'spalte', name: 'Spalte' },
					{ wert: 'kreuz', name: 'Kreuz' },
					{ wert: 'block', name: 'Block' },
					{ wert: 'treppe', name: 'Treppe' },
				],
			},
			{ art: 'zahl', attribut: 'mitte', name: 'Mittelzahl', min: 1, max: 10000, standard: 45 },
			{ art: 'raster', attribut: 'luecken', name: 'Lücken', form: true, gruppe: 'Lücken' },
			{
				art: 'zahl',
				attribut: 'zufall',
				name: 'Zufällige Lücken',
				min: 0,
				max: 100,
				standard: 0,
				gruppe: 'Lücken',
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung', gruppe: 'Lücken' },
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Zahlen', form: true, gruppe: 'Markierung' },
			{ art: 'zahl', ...GROESSE, min: 20, max: 50, standard: 32, schritt: 2 },
		],
	},
	'x-rechenrahmen': {
		name: 'Rechenrahmen',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rahmen',
				standard: '20',
				optionen: [
					{ wert: '20', name: '20er' },
					{ wert: '100', name: '100er' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'stellung',
				name: 'Kugeln links je Reihe',
				beispiel: '7 3',
			},
			{ art: 'zahlen', attribut: 'loesung', name: 'Nur in der Lösung zeigen', beispiel: '7 3' },
			{ art: 'zahl', ...GROESSE, min: 10, max: 30, standard: 18, schritt: 2 },
		],
	},
	'x-rechenstrich': {
		name: 'Rechenstrich',
		felder: [
			{ art: 'zahl', attribut: 'start', name: 'Start', min: 0, max: 1000000, standard: 0 },
			{
				art: 'liste',
				attribut: 'spruenge',
				name: 'Sprünge',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 1,
				max: 8,
				unter: [{ art: 'text', name: 'Sprung' }],
				hilfe: 'Zum Beispiel +30 oder −4.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Schon vorgegeben',
				standard: ['start', 'spruenge'],
				optionen: [
					{ wert: 'start', name: 'Start' },
					{ wert: 'spruenge', name: 'Sprünge' },
					{ wert: 'zwischen', name: 'Zwischenergebnisse' },
					{ wert: 'ziel', name: 'Ziel' },
				],
				hilfe: 'Alles andere ist ein Kästchen; die Lösung wird berechnet.',
			},
			{ art: 'schalter', attribut: 'massstab', name: 'Bögen im Maßstab', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'schalter',
				attribut: 'gemischt',
				name: 'Gemischte Sprünge',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 200,
				max: 620,
				standard: 560,
				schritt: 20,
			},
		],
	},
	'x-lineatur': {
		name: 'Schreiblinien',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Lineatur',
				standard: '1',
				blaettern: true,
				optionen: [
					{ wert: '1', name: 'Lineatur 1' },
					{ wert: '2', name: 'Lineatur 2' },
					{ wert: '3', name: 'Lineatur 3' },
					{ wert: '4', name: 'Lineatur 4' },
					{ wert: 'karo', name: 'Karo 1 cm' },
					{ wert: 'karo-klein', name: 'Karo 0,5 cm' },
				],
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 30, standard: 3 },
			{ art: 'text', attribut: 'vorlage', name: 'Zum Nachspuren', beispiel: 'Rosine' },
			{ art: 'zahl', attribut: 'vorlage-zeilen', name: 'Zeilen mit Vorlage', min: 1, max: 30, standard: 1 },
			{ art: 'text', attribut: 'anfang', name: 'Vorbild am Zeilenanfang', beispiel: 'Ro' },
			{ art: 'text', attribut: 'loesung', name: 'Text in der Lösung', beispiel: 'Der Hund bellt.' },
			{
				art: 'auswahl',
				attribut: 'mittelband',
				name: 'Mittelband',
				standard: 'linie',
				gruppe: 'Maße',
				hilfe: 'Getönt erscheint nur beim Farbdruck.',
				optionen: [
					{ wert: 'linie', name: 'Graue Linien' },
					{ wert: 'getoent', name: 'Getönt' },
				],
			},
			{
				art: 'text',
				attribut: 'band',
				name: 'Mittelband in mm',
				beispiel: '4',
				gruppe: 'Maße',
				muster: '\\d+([.,]\\d+)?',
				musterHilfe: 'Eine Zahl wie 4 oder 3,5.',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 100,
				max: 620,
				standard: 620,
				schritt: 20,
				gruppe: 'Maße',
			},
		],
	},
	'x-silben': {
		name: 'Silben',
		felder: [
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Text',
				quelle: 'inhalt',
				zeilen: 4,
				beispiel: 'Die Ro|si|ne ist süß.',
				einfuegen: { zeichen: '|', name: 'Silbenstrich einfügen' },
				hilfe: 'Nach Sprechsilben: A|bend, Was|ser, Zu|cker.',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'boegen',
				optionen: [
					{ wert: 'boegen', name: 'Bögen' },
					{ wert: 'farbe', name: 'Farben' },
					{ wert: 'beides', name: 'Farben und Bögen' },
				],
			},
			{
				art: 'text',
				attribut: 'farben',
				name: 'Farben der Klasse',
				beispiel: 'blau rot',
				hilfe: 'Zwei aus blau, rot, gruen, lila, braun, schwarz.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'boegen', name: 'Bögen zeichnen' },
					{ wert: 'trennen', name: 'Trennstriche setzen' },
				],
			},
		],
		regeln: (w): Fehler => {
			const wort = w.text('inhalt') ?? '';
			if (wort.includes('||')) {
				return { inhalt: 'Zwei Silbenstriche stehen direkt nebeneinander.' };
			}
			if (/(^|[\s„"'(])\||\|($|[\s.,;:!?“"')])/.test(wort)) {
				return { inhalt: 'Ein Silbenstrich steht am Anfang oder Ende eines Worts.' };
			}
			return /^[\p{L}\s|.,;:!?„“"'()\-–…]*$/u.test(wort)
				? {}
				: { inhalt: 'Erlaubt sind Buchstaben, Satzzeichen, Leerzeichen und der Silbenstrich.' };
		},
	},
	'x-wortarten': {
		name: 'Wortarten',
		felder: [
			{
				art: 'markierung',
				attribut: 'inhalt',
				name: 'Satz',
				quelle: 'inhalt',
				markeName: 'Wortart',
				beispiel: 'Der Hund bellt laut.',
				optionen: WORTART_OPTIONEN,
				hilfe: 'Wort antippen und die Wortart wählen.',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Darstellung',
				standard: 'symbole',
				optionen: [
					{ wert: 'symbole', name: 'Symbole' },
					{ wert: 'unterstreichen', name: 'Unterstreichen' },
				],
			},
			{ art: 'mehrfach', attribut: 'nur', name: 'Nur diese zeigen', optionen: WORTART_OPTIONEN, gruppe: 'Mehr' },
			{
				art: 'liste',
				attribut: 'farben',
				name: 'Farben der Klasse',
				gruppe: 'Mehr',
				unter: [
					{ name: 'Wortart', art: 'auswahl', standard: 'N', optionen: WORTART_OPTIONEN },
					{
						name: 'Farbe',
						art: 'auswahl',
						standard: 'blau',
						optionen: [
							'blau',
							'rot',
							'gruen',
							'lila',
							'braun',
							'schwarz',
							'hellblau',
							'rosa',
							'orange',
						].map((f) => ({ wert: f, name: f === 'gruen' ? 'grün' : f })),
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'bestimmen', name: 'Wortarten bestimmen' },
				],
			},
		],
		regeln: (w): Fehler => {
			const unbekannt = markierungLesen(w.text('inhalt') ?? '').woerter.find(
				(t) => t.marke !== null && !WORTART_OPTIONEN.some((o) => o.wert === t.marke),
			);
			return unbekannt ? { inhalt: `Das Kürzel „${unbekannt.marke ?? ''}“ gibt es nicht.` } : {};
		},
	},
	'x-satzglieder': {
		name: 'Satzglieder',
		felder: [
			{
				art: 'markierung',
				attribut: 'inhalt',
				name: 'Satz',
				quelle: 'inhalt',
				markeName: 'Satzglied',
				gruppen: true,
				beispiel: 'Der Hund bellt den Briefträger an.',
				optionen: ROLLEN_OPTIONEN,
				hilfe: 'Wort antippen, Nachbarn verbinden und das Satzglied wählen.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'bestimmen', name: 'Satzglieder bestimmen' },
					{ wert: 'umstellen', name: 'Satz umstellen' },
					{ wert: 'fragen', name: 'Fragen stellen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'vorn',
				name: 'Beim Umstellen nach vorn',
				gruppe: 'Mehr',
				optionen: [
					{ wert: null, name: 'Nächstes Satzglied' },
					...ROLLEN_OPTIONEN.filter((o) => o.wert !== 'P'),
				],
			},
			{
				art: 'schalter',
				attribut: 'ausschneiden',
				name: 'Satzstreifen zum Ausschneiden',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const wert = w.text('inhalt');
			if (wert === null) {
				return {};
			}
			const zaehler = [...wert].filter((z) => z === '[').length;
			if (zaehler !== [...wert].filter((z) => z === ']').length) {
				return { inhalt: 'Eine eckige Klammer ist nicht geschlossen.' };
			}
			const { woerter } = markierungLesen(wert, true);
			const unbekannt = woerter.find((t) => t.marke !== null && !ROLLEN_OPTIONEN.some((o) => o.wert === t.marke));
			if (unbekannt) {
				return { inhalt: `Das Satzglied „${unbekannt.marke ?? ''}“ gibt es nicht.` };
			}
			return woerter.some((t) => t.marke === 'P') ? {} : { inhalt: 'Jeder Satz braucht ein Prädikat.' };
		},
	},
	'x-wortbausteine': {
		name: 'Wortbausteine',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'wort',
				optionen: [
					{ wert: 'wort', name: 'Ein Wort zerlegt' },
					{ wert: 'familie', name: 'Wortfamilie' },
				],
			},
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Bausteine',
				quelle: 'inhalt',
				beispiel: 'ver|fahr|en',
				einfuegen: { zeichen: '|', name: 'Trennstrich einfügen' },
				hilfe: 'Bei einer Wortfamilie nur der Stamm.',
			},
			{
				art: 'auswahl',
				attribut: 'stamm',
				name: 'Stamm',
				optionen: [{ wert: null, name: 'Nicht hervorheben' }],
				optionenAus: 'inhalt',
			},
			{
				art: 'liste',
				attribut: 'woerter',
				name: 'Wörter der Familie',
				max: 8,
				unter: [{ name: 'Wort', art: 'text', standard: 'Wort' }],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'zerlegen', name: 'Wort zerlegen' },
					{ wert: 'zusammensetzen', name: 'Wort zusammensetzen' },
					{ wert: 'familie', name: 'Wortfamilie finden' },
				],
			},
		],
		regeln: (w): Fehler => {
			const wort = w.text('inhalt') ?? '';
			const familie = w.text('art') === 'familie';
			const teile = wort.split('|').map((t) => t.trim());
			const stamm = w.text('stamm');
			const aufgabe = w.text('aufgabe');
			if (wort !== '' && teile.some((t) => !/^[\p{L}-]+$/u.test(t))) {
				return { inhalt: 'Bausteine bestehen aus Buchstaben, dazwischen je ein Strich.' };
			}
			if (stamm !== null && !teile.some((t) => t.toLowerCase() === stamm.toLowerCase())) {
				return { stamm: `Der Stamm „${stamm}“ ist keiner der Bausteine.` };
			}
			if (familie && teile.length > 1) {
				return { inhalt: 'Bei einer Wortfamilie steht in der Mitte nur der Stamm.' };
			}
			if (familie && w.zeilen('woerter').length === 0) {
				return { woerter: 'Eine Wortfamilie braucht Wörter.' };
			}
			const passt = familie ? aufgabe !== 'zerlegen' && aufgabe !== 'zusammensetzen' : aufgabe !== 'familie';
			return passt ? {} : { aufgabe: 'Diese Aufgabe passt nicht zur Art.' };
		},
	},
	'x-geld': {
		name: 'Geld',
		felder: [
			{
				art: 'liste',
				attribut: 'stuecke',
				name: 'Stücke',
				zeilenTrenner: ' ',
				unter: [
					{
						name: 'Stück',
						art: 'auswahl',
						standard: '1€',
						optionen: [
							{ wert: '1ct', name: '1 ct' },
							{ wert: '2ct', name: '2 ct' },
							{ wert: '5ct', name: '5 ct' },
							{ wert: '10ct', name: '10 ct' },
							{ wert: '20ct', name: '20 ct' },
							{ wert: '50ct', name: '50 ct' },
							{ wert: '1€', name: '1 €' },
							{ wert: '2€', name: '2 €' },
							{ wert: '5€', name: '5 €' },
							{ wert: '10€', name: '10 €' },
							{ wert: '20€', name: '20 €' },
							{ wert: '50€', name: '50 €' },
							{ wert: '100€', name: '100 €' },
							{ wert: '200€', name: '200 €' },
						],
					},
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'betrag', name: 'Betrag bestimmen' },
					{ wert: 'legen', name: 'Betrag legen' },
				],
			},
			{
				art: 'text',
				attribut: 'betrag',
				name: 'Betrag zum Legen',
				beispiel: '3,45',
				muster: '\\d+([.,]\\d{1,2})?',
				musterHilfe: 'Ein Betrag wie 3,45.',
			},
			{
				art: 'auswahl',
				attribut: 'anordnung',
				name: 'Anordnung',
				standard: 'reihe',
				optionen: [
					{ wert: 'reihe', name: 'In einer Reihe' },
					{ wert: 'gruppiert', name: 'Nach Wert sortiert' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'seite',
				name: 'Münzseite',
				standard: 'wert',
				optionen: [
					{ wert: 'wert', name: 'Wertseite' },
					{ wert: 'rueck', name: 'Rückseite' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'massstab',
				name: 'Größe',
				standard: '0.5',
				hilfe: 'Scheine bleiben immer höchstens 75 % groß.',
				optionen: [
					{ wert: '0.3', name: 'Klein' },
					{ wert: '0.5', name: 'Halb so groß' },
					{ wert: '0.75', name: 'Dreiviertel' },
					{ wert: 'original', name: 'Originalgröße' },
				],
			},
		],
		regeln: (w): Fehler =>
			w.text('aufgabe') === 'legen' && !w.text('betrag') ? { betrag: 'Welcher Betrag soll gelegt werden?' } : {},
	},
	'x-skala': {
		name: 'Messgerät',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Gerät',
				standard: 'lineal',
				optionen: [
					{ wert: 'lineal', name: 'Lineal' },
					{ wert: 'massband', name: 'Maßband' },
					{ wert: 'messbecher', name: 'Messbecher' },
					{ wert: 'thermometer', name: 'Thermometer' },
					{ wert: 'waage', name: 'Waage' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'einheit',
				name: 'Einheit',
				hilfe: 'Lineal: cm, mm; Maßband: cm, m; Messbecher: ml, l; Thermometer: °C; Waage: g, kg.',
				optionen: [
					{ wert: null, name: 'Passend zum Gerät' },
					{ wert: 'cm', name: 'cm' },
					{ wert: 'mm', name: 'mm' },
					{ wert: 'm', name: 'm' },
					{ wert: 'ml', name: 'ml' },
					{ wert: 'l', name: 'l' },
					{ wert: '°C', name: '°C' },
					{ wert: 'g', name: 'g' },
					{ wert: 'kg', name: 'kg' },
				],
			},
			{
				art: 'text',
				attribut: 'wert',
				name: 'Wert',
				beispiel: '7',
				muster: '-?\\d+([.,]\\d+)?',
				musterHilfe: 'Eine Zahl wie 7 oder 2,5.',
				loesung: { attribut: 'loesung', name: 'Wert nur in der Lösung' },
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				optionen: [
					{ wert: null, name: 'Nur zeigen' },
					{ wert: 'ablesen', name: 'Ablesen' },
					{ wert: 'einzeichnen', name: 'Einzeichnen' },
				],
			},
			{ art: 'zahlen', attribut: 'teilung', name: 'Striche: Haupt, Zwischen', beispiel: '10 1', gruppe: 'Skala' },
			{ art: 'zahl', attribut: 'von', name: 'Von', min: -50, max: 10000, standard: 0, gruppe: 'Skala' },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: -50, max: 100000, standard: 15, gruppe: 'Skala' },
			{
				art: 'auswahl',
				attribut: 'massstab',
				name: 'Lineal',
				gruppe: 'Skala',
				optionen: [
					{ wert: null, name: 'Originalgröße' },
					{ wert: 'nein', name: 'Verkleinert, nicht zum Messen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 120, max: 600, standard: 240, schritt: 20, gruppe: 'Skala' },
		],
	},
	'x-strecke': {
		name: 'Strecke',
		felder: [
			{
				art: 'text',
				attribut: 'laenge',
				name: 'Länge',
				beispiel: '7 cm',
				muster: '\\d+([.,]\\d+)? ?(cm|mm)?',
				musterHilfe: 'Zum Beispiel 7 cm oder 45 mm.',
			},
			{ art: 'text', attribut: 'beschriftung', name: 'Buchstaben an den Enden', beispiel: 'A B' },
			{
				art: 'auswahl',
				attribut: 'richtung',
				name: 'Richtung',
				standard: 'waagerecht',
				optionen: [
					{ wert: 'waagerecht', name: 'Waagerecht' },
					{ wert: 'schraeg', name: 'Schräg' },
				],
			},
		],
	},
	'x-kalender': {
		name: 'Kalender',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'monat',
				optionen: [
					{ wert: 'monat', name: 'Ein Monat' },
					{ wert: 'jahr', name: 'Ganzes Jahr' },
				],
			},
			{ art: 'zahl', attribut: 'monat', name: 'Monat', min: 1, max: 12, standard: 1 },
			{ art: 'zahl', attribut: 'jahr', name: 'Jahr', min: 1900, max: 2100, standard: 2026 },
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Tage', form: true },
			{ art: 'raster', attribut: 'luecken', name: 'Tage ohne Zahl', form: true },
			{ art: 'schalter', attribut: 'kw', name: 'Kalenderwochen', an: 'ja', aus: 'nein', standard: false },
		],
	},
	'x-zeitspanne': {
		name: 'Zeitspanne',
		felder: [
			{ art: 'uhrzeit', attribut: 'von', name: 'Von' },
			{ art: 'uhrzeit', attribut: 'bis', name: 'Bis' },
			{
				art: 'text',
				attribut: 'spruenge',
				name: 'Sprünge',
				beispiel: 'bis 9:00, +40 min',
				hilfe: 'Leer: zur vollen Stunde und dann weiter.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['von', 'bis'],
				optionen: [
					{ wert: 'von', name: 'Anfang' },
					{ wert: 'bis', name: 'Ende' },
					{ wert: 'spruenge', name: 'Sprünge' },
					{ wert: 'dauer', name: 'Dauer' },
				],
			},
		],
	},
	'x-punktfeld': {
		name: 'Punktfeld',
		felder: [
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 5 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 5 },
			{
				art: 'zahlen',
				attribut: 'trenner',
				name: 'Zerlegungslinie nach',
				beispiel: '5',
				hilfe: 'Kernaufgaben: nach 1, 2 oder 5.',
			},
			{
				art: 'auswahl',
				attribut: 'richtung',
				name: 'Linie zerlegt die',
				standard: 'zeilen',
				optionen: [
					{ wert: 'zeilen', name: 'Zeilen' },
					{ wert: 'spalten', name: 'Spalten' },
				],
			},
			{
				art: 'schalter',
				attribut: 'loesung',
				name: 'Linie nur in der Lösung',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'zahlen',
				attribut: 'abdecken',
				name: 'Frei bleiben',
				beispiel: '3 4',
				hilfe: 'Zeilen und Spalten, der Rest ist grau abgedeckt wie mit dem Malwinkel.',
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 40, standard: 20, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const fehler: Fehler = {};
			const trenner = w.zahlen('trenner');
			const grenze = w.zahl(w.text('richtung') === 'spalten' ? 'spalten' : 'zeilen');
			if (trenner.length > 1 || trenner.some((k) => k < 1 || k >= grenze)) {
				fehler.trenner = `Eine Linie innerhalb des Feldes: 1 bis ${grenze - 1}.`;
			}
			const frei = w.zahlen('abdecken');
			const [freiZeilen = 0, freiSpalten = 0] = frei;
			const passt = frei.length === 2 && freiZeilen <= w.zahl('zeilen') && freiSpalten <= w.zahl('spalten');
			if (frei.length > 0 && !passt) {
				fehler.abdecken = 'Zwei Zahlen, die im Feld liegen.';
			}
			return fehler;
		},
	},
	'x-malkreuz': {
		name: 'Malkreuz',
		felder: [
			{ art: 'zahl', attribut: 'a', name: 'Erste Zahl', min: 1, max: 99, standard: 34 },
			{ art: 'zahl', attribut: 'b', name: 'Zweite Zahl', min: 1, max: 99, standard: 6 },
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['zerlegung'],
				optionen: [
					{ wert: 'zerlegung', name: 'Zerlegung' },
					{ wert: 'teilprodukte', name: 'Teilprodukte' },
					{ wert: 'summe', name: 'Summe' },
				],
			},
		],
	},
	'x-schriftlich': {
		name: 'Schriftliche Rechnung',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rechnung',
				standard: 'plus',
				optionen: [
					{ wert: 'plus', name: 'Plus' },
					{ wert: 'minus', name: 'Minus' },
					{ wert: 'mal', name: 'Mal' },
					{ wert: 'geteilt', name: 'Geteilt' },
				],
			},
			{ art: 'zahlen', attribut: 'zahlen', name: 'Zahlen', beispiel: '345 278' },
			{
				art: 'auswahl',
				attribut: 'verfahren',
				name: 'Verfahren bei Minus',
				hilfe: 'So, wie es die Klasse gelernt hat.',
				optionen: [
					{ wert: null, name: 'Bitte wählen' },
					{ wert: 'abziehen-entbuendeln', name: 'Abziehen, Entbündeln' },
					{ wert: 'abziehen-erweitern', name: 'Abziehen, Erweitern' },
					{ wert: 'ergaenzen-entbuendeln', name: 'Ergänzen, Entbündeln' },
					{ wert: 'ergaenzen-erweitern', name: 'Ergänzen, Erweitern' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'uebertrag',
				name: 'Überträge',
				standard: 'zeile',
				optionen: [
					{ wert: 'zeile', name: 'Notieren' },
					{ wert: 'keine', name: 'Nicht notieren' },
				],
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Im Blatt steht schon',
				standard: ['aufgabe'],
				optionen: [
					{ wert: 'aufgabe', name: 'Aufgabe' },
					{ wert: 'uebertraege', name: 'Überträge' },
					{ wert: 'ergebnis', name: 'Ergebnis' },
				],
			},
			{
				art: 'zahl',
				attribut: 'kaestchen',
				name: 'Kästchen',
				einheit: 'cm',
				min: 0.4,
				max: 1,
				standard: 0.5,
				schritt: 0.1,
			},
			{
				art: 'schalter',
				attribut: 'fehlerhaft',
				name: 'Rechnung mit Fehler zum Finden',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'mischen', attribut: 'seed', name: 'Fehler', knopf: 'Anderer Fehler' },
		],
		regeln: (w): Fehler => {
			const art = w.text('art') ?? 'plus';
			const zahlen = w.zahlen('zahlen');
			const [erste = 0, zweite = 0] = zahlen;
			if (zahlen.some((z) => String(z).length > 7)) {
				return { zahlen: 'Eine Zahl hat höchstens 7 Stellen.' };
			}
			if (art === 'plus' && (zahlen.length < 2 || zahlen.length > 4)) {
				return { zahlen: 'Bei Plus stehen 2 bis 4 Zahlen untereinander.' };
			}
			if (art !== 'plus' && zahlen.length !== 2) {
				return { zahlen: 'Hier gehören genau 2 Zahlen hinein.' };
			}
			if (art === 'minus' && erste < zweite) {
				return { zahlen: 'Die erste Zahl muss mindestens so groß sein wie die zweite.' };
			}
			if (art === 'minus' && !w.text('verfahren')) {
				return { verfahren: 'Bitte das Verfahren wählen, das die Klasse gelernt hat.' };
			}
			if (art === 'geteilt' && (zweite < 2 || zweite > 9)) {
				return { zahlen: 'Geteilt wird durch 2 bis 9.' };
			}
			return art === 'mal' && String(zweite).length > 3
				? { zahlen: 'Der zweite Faktor hat höchstens 3 Stellen.' }
				: {};
		},
	},
	'x-zahlenmauer': {
		name: 'Zahlenmauer',
		felder: [
			{ art: 'zahlen', attribut: 'basis', name: 'Unterste Reihe', beispiel: '3 5 2' },
			{ art: 'raster', attribut: 'offen', name: 'Leere Steine', form: true },
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rechnung',
				standard: 'plus',
				optionen: [
					{ wert: 'plus', name: 'Plus' },
					{ wert: 'minus', name: 'Minus' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 24, max: 80, standard: 44, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const anzahl = w.zahlen('basis').length;
			return anzahl < 2 || anzahl > 5 ? { basis: 'Eine Zahlenmauer hat unten 2 bis 5 Steine.' } : {};
		},
	},
	'x-rechendreieck': {
		name: 'Rechendreieck',
		felder: [
			{ art: 'zahlen', attribut: 'innen', name: 'Innenzahlen', beispiel: '3 5 2' },
			{ art: 'raster', attribut: 'offen', name: 'Leere Felder', form: true },
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Innen',
				standard: 'zahlen',
				optionen: [
					{ wert: 'zahlen', name: 'Zahlen' },
					{ wert: 'plaettchen', name: 'Plättchen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 140, max: 360, standard: 220, schritt: 10 },
		],
	},
	'x-zahlenhaus': {
		name: 'Zahlenhaus',
		felder: [
			{ art: 'zahl', attribut: 'dach', name: 'Dach', min: 0, max: 1000000, standard: 7 },
			{
				art: 'liste',
				attribut: 'zerlegungen',
				name: 'Stockwerke',
				feldTrenner: ' ',
				unter: [
					{ art: 'zahl', name: 'Links' },
					{ art: 'zahl', name: 'Rechts' },
				],
			},
			{
				art: 'schalter',
				attribut: 'alle',
				name: 'Alle Zerlegungen der Reihe nach',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'raster', attribut: 'offen', name: 'Leere Felder', form: true },
			{ art: 'zahl', ...GROESSE, min: 24, max: 70, standard: 40, schritt: 2 },
		],
	},
	'x-zahlenkette': {
		name: 'Rechenkette',
		felder: [
			{ art: 'zahl', attribut: 'start', name: 'Start', min: 0, max: 1000000, standard: 0 },
			{
				art: 'liste',
				attribut: 'operatoren',
				name: 'Rechenschritte',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 1,
				max: 8,
				unter: [{ art: 'text', name: 'Schritt' }],
				hilfe: 'Zum Beispiel +5, −3, ·2 oder :4.',
			},
			{
				art: 'mehrfach',
				attribut: 'zeige',
				name: 'Schon vorgegeben',
				standard: ['start', 'operatoren'],
				optionen: [
					{ wert: 'start', name: 'Start' },
					{ wert: 'operatoren', name: 'Rechenschritte' },
					{ wert: 'zwischen', name: 'Zwischenergebnisse' },
					{ wert: 'ziel', name: 'Ziel' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Darstellung',
				standard: 'kette',
				optionen: [
					{ wert: 'kette', name: 'Kette' },
					{ wert: 'pfeilbild', name: 'Pfeilbild' },
				],
			},
			{
				art: 'schalter',
				attribut: 'rueckwaerts',
				name: 'Rückwärts (Ziel gegeben)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-zauberdreieck': {
		name: 'Zauberdreieck',
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Form',
				standard: 'dreieck',
				optionen: [
					{ wert: 'dreieck', name: 'Zauberdreieck (6 Zahlen)' },
					{ wert: 'quadrat', name: 'Magisches Quadrat (9 Zahlen)' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Zahlen',
				beispiel: '1 2 3 4 5 6',
				hilfe: 'Leer: 1 bis 6 oder 1 bis 9.',
			},
			{
				art: 'zahl',
				attribut: 'summe',
				name: 'Summe je Linie',
				min: 0,
				max: 100000,
				standard: 0,
				hilfe: '0: ohne Summe, eine Forscheraufgabe.',
			},
			{ art: 'raster', attribut: 'vorgegeben', name: 'Vorgegebene Felder', form: true },
			{ art: 'mischen', attribut: 'seed', name: 'Lösung' },
			{ art: 'zahl', ...GROESSE, min: 26, max: 70, standard: 44, schritt: 2 },
		],
	},
	'x-rechenrad': {
		name: 'Rechenrad',
		felder: [
			{
				art: 'text',
				attribut: 'mitte',
				name: 'In der Mitte',
				muster: '[+\\-−·×*:] ?[0-9]+',
				musterHilfe: 'Zum Beispiel ·7 oder :4.',
			},
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Innerer Ring',
				beispiel: '1 2 3 4 5 6',
				hilfe: '6 bis 10 Zahlen.',
			},
			{
				art: 'auswahl',
				attribut: 'offen',
				name: 'Offen',
				standard: 'aussen',
				optionen: [
					{ wert: 'aussen', name: 'Außen' },
					{ wert: 'innen', name: 'Innen' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 160, max: 400, standard: 240, schritt: 10 },
		],
	},
	'x-wuerfelbau': {
		name: 'Würfelgebäude',
		felder: [
			{
				art: 'raster',
				attribut: 'bauplan',
				name: 'Bauplan (Turmhöhen)',
				zahlen: { min: 0, max: 5 },
				wachsen: { spalten: 4, zeilen: 4 },
				hilfe: 'Die unterste Zeile ist vorne.',
			},
			{ art: 'mehrfach', attribut: 'zeige', name: 'Vorgegeben', optionen: WUERFELBAU_TEILE },
			{
				art: 'mehrfach',
				attribut: 'fragen',
				name: 'Gefragt',
				optionen: [{ wert: 'anzahl', name: 'Anzahl der Würfel' }, ...WUERFELBAU_TEILE.slice(1)],
			},
			{
				art: 'auswahl',
				attribut: 'projektion',
				name: 'Schrägbild',
				standard: 'schraeg',
				optionen: [
					{ wert: 'schraeg', name: 'Schräg' },
					{ wert: 'iso', name: 'Isometrisch' },
				],
			},
			{
				art: 'schalter',
				attribut: 'verdeckt',
				name: 'Verdeckte Würfel zeigen',
				an: 'zeigen',
				aus: 'nicht',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'einheit',
				name: 'Würfelkante',
				min: 14,
				max: 50,
				standard: 26,
				schritt: 2,
				einheit: 'px',
			},
		],
	},
	'x-wuerfelnetz': {
		name: 'Würfelnetz',
		felder: [
			{
				art: 'auswahl',
				attribut: 'netz',
				name: 'Netz',
				standard: '1',
				blaettern: true,
				optionen: [
					...Array.from({ length: 11 }, (_, i) => ({ wert: String(i + 1), name: `Netz ${i + 1}` })),
					...Array.from({ length: 8 }, (_, i) => ({ wert: `n${i + 1}`, name: `Kein Netz ${i + 1}` })),
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'netz-oder-nicht', name: 'Netz oder nicht?' },
					{ wert: 'gegenueber', name: 'Gegenüberliegende Fläche' },
					{ wert: 'augen-ergaenzen', name: 'Augen ergänzen' },
				],
			},
			{ art: 'zahl', attribut: 'markiere', name: 'Markierte Fläche', min: 1, max: 6, standard: 1 },
			{
				art: 'schalter',
				attribut: 'augen',
				name: 'Standardwürfel (gegenüber 7)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'liste',
				attribut: 'flaechen',
				name: 'Flächen',
				zeilenTrenner: ' ',
				feldTrenner: ' ',
				min: 6,
				max: 6,
				unter: [{ art: 'text', name: 'Inhalt' }],
				hilfe: '1 bis 6 sind Augen, 0 ist leer, #12 eine Zahl; sonst Wort oder Farbe, ohne Leerzeichen.',
			},
			{ art: 'schalter', attribut: 'laschen', name: 'Laschen', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'schalter',
				attribut: 'bastel',
				name: 'Bastelvorlage',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'zahl',
				attribut: 'kante',
				name: 'Kante',
				min: 1,
				max: 8,
				standard: 4,
				schritt: 0.5,
				einheit: 'cm',
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Körper',
				standard: 'wuerfel',
				gruppe: 'Weitere Angaben',
				optionen: [
					{ wert: 'wuerfel', name: 'Würfel' },
					{ wert: 'quader', name: 'Quader' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'masse',
				name: 'Maße des Quaders',
				beispiel: '4 2 1',
				gruppe: 'Weitere Angaben',
			},
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 270,
				standard: 0,
				schritt: 90,
				gruppe: 'Weitere Angaben',
			},
			{ art: 'zahl', ...GROESSE, min: 16, max: 80, standard: 30, schritt: 2, gruppe: 'Weitere Angaben' },
			{ art: 'text', attribut: 'seed', name: 'Mischung', gruppe: 'Weitere Angaben' },
		],
	},
	'x-koerper': {
		name: 'Körper',
		felder: [
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'wuerfel',
				optionen: [
					{ wert: 'wuerfel', name: 'Würfel' },
					{ wert: 'quader', name: 'Quader' },
					{ wert: 'kugel', name: 'Kugel' },
					{ wert: 'zylinder', name: 'Zylinder' },
					{ wert: 'kegel', name: 'Kegel' },
					{ wert: 'pyramide', name: 'Pyramide' },
					{ wert: 'prisma', name: 'Prisma' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'ansicht',
				name: 'Ansicht',
				standard: 'schraegbild',
				optionen: [
					{ wert: 'schraegbild', name: 'Schrägbild' },
					{ wert: 'kantenmodell', name: 'Kantenmodell' },
				],
			},
			{
				art: 'schalter',
				attribut: 'verdeckt',
				name: 'Verdeckte Kanten gestrichelt',
				an: 'gestrichelt',
				aus: 'aus',
				standard: true,
			},
			{
				art: 'mehrfach',
				attribut: 'markiere',
				name: 'Gefragt und in der Lösung markiert',
				optionen: [
					{ wert: 'ecken', name: 'Ecken' },
					{ wert: 'kanten', name: 'Kanten' },
					{ wert: 'flaechen', name: 'Flächen' },
				],
			},
			{ art: 'zahlen', attribut: 'masse', name: 'Maße', beispiel: '4 2 2', gruppe: 'Weitere Angaben' },
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 359,
				standard: 0,
				schritt: 15,
				gruppe: 'Weitere Angaben',
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 60, standard: 30, schritt: 2, gruppe: 'Weitere Angaben' },
		],
	},
	'x-tangram': {
		name: 'Tangram',
		felder: [
			{
				art: 'auswahl',
				attribut: 'umriss',
				name: 'Umriss',
				standard: 'haus',
				optionen: [
					{ wert: 'haus', name: 'Haus' },
					{ wert: 'katze', name: 'Katze' },
					{ wert: 'schiff', name: 'Schiff' },
					{ wert: 'fisch', name: 'Fisch' },
					{ wert: 'kerze', name: 'Kerze' },
				],
			},
			{
				art: 'mehrfach',
				attribut: 'teile',
				name: 'Schon eingezeichnet',
				optionen: [
					{ wert: 'gross1', name: 'Großes Dreieck 1' },
					{ wert: 'gross2', name: 'Großes Dreieck 2' },
					{ wert: 'mittel', name: 'Mittleres Dreieck' },
					{ wert: 'klein1', name: 'Kleines Dreieck 1' },
					{ wert: 'klein2', name: 'Kleines Dreieck 2' },
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'raute', name: 'Parallelogramm' },
				],
			},
			{
				art: 'schalter',
				attribut: 'bogen',
				name: 'Bogen zum Ausschneiden (12 cm)',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 60, standard: 30, schritt: 2 },
		],
	},
} satisfies Record<string, AbbildungSchema>;

export type Abbildung = keyof typeof ABBILDUNG_SCHEMA;

/**
 * Attribute, die `abbildungen.js` liest, die das Panel aber bewusst nicht anbietet: `rest` setzt `praesentation.js`
 * zur Laufzeit, während ein Timer abläuft.
 */
export const NUR_ZUR_LAUFZEIT = ['rest'];

export const schemaVon = (tag: string): AbbildungSchema | undefined =>
	(ABBILDUNG_SCHEMA as Record<string, AbbildungSchema>)[tag];

export const attributeVon = (schema: AbbildungSchema) =>
	schema.felder.flatMap((f) => (f.loesung ? [f.attribut, f.loesung.attribut] : [f.attribut]));

// ── Werte lesen und schreiben ───────────────────────────────────────────────

const amInhalt = (schema: AbbildungSchema, a: string) =>
	schema.felder.some((f) => f.attribut === a && f.quelle === 'inhalt');

/** Mit `quelle: 'inhalt'` braucht es die Zerlegung, weil der Wert der Text im Element ist. */
export const werteVon = (schema: AbbildungSchema, k: Knoten, z?: Zerlegung): Werte =>
	Object.fromEntries(
		attributeVon(schema).map((a) => {
			if (amInhalt(schema, a)) {
				const roh = z ? entschluessele(innenVon(z, k)).trim() : '';
				return [a, roh === '' ? null : roh];
			}
			return [a, attribut(k, a)?.wert ?? null];
		}),
	);

/** Wert eines Feldes und ob er nur in der Lösung steht; mit beiden Attributen gilt, was `abbildungen.js` zeichnet. */
export const feldWert = (feld: Feld, w: Werte): { wert: string | null; nurLoesung: boolean } => {
	const sichtbar = w[feld.attribut] ?? null;
	const loesung = feld.loesung ? (w[feld.loesung.attribut] ?? null) : null;
	if (loesung !== null && (sichtbar === null || feld.loesung?.vorrang)) {
		return { wert: loesung, nurLoesung: true };
	}
	return { wert: sichtbar, nurLoesung: false };
};

export const stellenVon = (w: Werte, attributName: string) =>
	(w[attributName] ?? STELLEN_STANDARD).split(/\s+/).filter(Boolean);

export const listeVon = (wert: string | null) => (wert ?? '').split(/[\s,;]+/).filter(Boolean);

/** Platzhalter für ein leeres Unterfeld im Entwurf, damit die Zeile beim Tippen nicht wegfällt. */
export const LEER = '∅';

const teile = (text: string, trenner: string, anzahl: number): string[] => {
	if (trenner === '') {
		const t = new RegExp(`^(${LEER}|\\d*)(.*)$`, 's').exec(text);
		return [t?.[1] ?? '', t?.[2] ?? ''];
	}
	if (trenner === ' ') {
		return text.split(/\s+/).filter(Boolean);
	}
	const i = text.indexOf(trenner);
	return i < 0 || anzahl < 2
		? [text.trim()]
		: [text.slice(0, i).trim(), ...teile(text.slice(i + 1), trenner, anzahl - 1)];
};

/** `Hund: 7; Katze: 4` → `[['Hund', '7'], ['Katze', '4']]`. Eine leere letzte Zeile (`…;`) zählt nicht. */
export const zeilenVon = (feld: ListeFeld, wert: string | null): string[][] => {
	const { feldTrenner = ':', unter, zeilenTrenner = ';' } = feld;
	if (!wert?.trim()) {
		return [];
	}
	const zeilen = zeilenTrenner === ' ' ? wert.trim().split(/\s+/) : wert.split(zeilenTrenner);
	if (zeilen.at(-1)?.trim() === '') {
		zeilen.pop();
	}
	return zeilen.map((z) => {
		const werte = teile(z.trim(), feldTrenner, unter.length);
		return unter.map((_, i) => {
			const w = werte[i] ?? '';
			return w === LEER ? '' : w;
		});
	});
};

export const zeilenText = (feld: ListeFeld, zeilen: string[][]): string | null => {
	const { feldTrenner = ':', unter, zeilenTrenner = ';' } = feld;
	if (zeilen.length === 0) {
		return null;
	}
	const zwischen = feldTrenner === ':' ? ': ' : feldTrenner;
	let trenner = '; ';
	if (zeilenTrenner === ' ') {
		trenner = ' ';
	} else if (zeilenTrenner === '/') {
		trenner = ' / ';
	}
	return zeilen
		.map((z) => {
			const werte = unter.map((u, i) => (z[i] ?? '').trim() || (u.leer ? '' : LEER));
			while (werte.length > 1 && werte.at(-1) === '') {
				werte.pop();
			}
			return werte.join(zwischen);
		})
		.join(trenner);
};

export const rasterVon = (wert: string | null): string[][] =>
	(wert ?? '')
		.split('/')
		.map((z) => z.trim())
		.filter(Boolean)
		.map((z) => z.split(/\s+/));

export const rasterText = (zeilen: string[][]) => {
	const text = zeilen.map((z) => z.join(' ')).join(' / ');
	return text === '' ? null : text;
};

/** Ziffern je Stelle als Attributwert; leere Stellen am Ende fallen weg, eine ganz leere Tafel hat keinen Wert. */
export const ziffernText = (liste: string[]) => {
	const bis = liste.findLastIndex((z) => z.trim() !== '');
	return bis < 0
		? null
		: liste
				.slice(0, bis + 1)
				.map((z) => z.trim() || '?')
				.join(' ');
};

/**
 * Ändert ein Feld. Mit Lösungs-Gegenstück steht der Wert danach in genau einem der beiden Attribute. Ändern sich die
 * Stellen einer Stellentafel, bleiben die Zahlen rechtsbündig an ihrer Stelle (der Einer bleibt der Einer).
 */
export const aendereFeld = (
	schema: AbbildungSchema,
	w: Werte,
	feld: Feld,
	wert: string | null,
	nurLoesung = feldWert(feld, w).nurLoesung,
): Werte => {
	const neu = { ...w };
	if (feld.loesung) {
		neu[feld.attribut] = nurLoesung ? null : wert;
		neu[feld.loesung.attribut] = nurLoesung ? wert : null;
	} else {
		neu[feld.attribut] = wert;
	}
	for (const f of schema.felder) {
		if (f.art !== 'ziffern' || f.stellen !== feld.attribut) {
			continue;
		}
		const alt = stellenVon(w, f.stellen).length;
		const jetzt = stellenVon(neu, f.stellen).length;
		const { nurLoesung: nur, wert: ziffern } = feldWert(f, neu);
		if (ziffern === null || alt === jetzt) {
			continue;
		}
		const liste = Array.from({ length: alt }, (_, i) => listeVon(ziffern)[i] ?? '');
		const gerueckt = jetzt > alt ? [...Array<string>(jetzt - alt).fill(''), ...liste] : liste.slice(alt - jetzt);
		Object.assign(neu, aendereFeld(schema, neu, f, ziffernText(gerueckt), nur));
	}
	return neu;
};

/** Die Attribute, die sich zwischen zwei Fassungen unterscheiden. */
export const unterschiede = (alt: Werte, neu: Werte) =>
	Object.keys(neu).filter((a) => (alt[a] ?? null) !== (neu[a] ?? null));

// ── Prüfen ──────────────────────────────────────────────────────────────────

const zahlText = (n: number) => String(n).replace('.', ',');

const pruefeUnterfeld = (u: UnterFeld, wert: string): string | null => {
	if (wert === '') {
		return u.leer ? null : `„${u.name}“ fehlt.`;
	}
	if (u.art === 'zahl') {
		const n = alsZahl(wert);
		if (Number.isNaN(n)) {
			return `„${wert}“ ist keine Zahl.`;
		}
		if ((u.min !== undefined && n < u.min) || (u.max !== undefined && n > u.max)) {
			return `„${u.name}“: bitte von ${u.min ?? ''} bis ${u.max ?? ''}.`;
		}
	}
	if ((u.art === 'auswahl' || u.art === 'muster') && u.optionen && !u.optionen.some((o) => o.wert === wert)) {
		return `„${wert}“ gibt es bei „${u.name}“ nicht.`;
	}
	return null;
};

const pruefeListe = (feld: ListeFeld, wert: string | null): string | null => {
	const zeilen = zeilenVon(feld, wert);
	if (wert !== null && feld.min !== undefined && zeilen.length < feld.min) {
		return `Bitte mindestens ${feld.min} ${feld.min === 1 ? 'Zeile' : 'Zeilen'}.`;
	}
	if (feld.max !== undefined && zeilen.length > feld.max) {
		return `Höchstens ${feld.max} Zeilen.`;
	}
	for (const [i, zeile] of zeilen.entries()) {
		for (const [j, u] of feld.unter.entries()) {
			const meldung = pruefeUnterfeld(u, zeile[j] ?? '');
			if (meldung) {
				return `Zeile ${i + 1}: ${meldung}`;
			}
		}
	}
	return null;
};

const pruefeRaster = (feld: RasterFeld, wert: string | null): string | null => {
	if (feld.form) {
		return null;
	}
	const { max = Infinity, min = -Infinity } = feld.zahlen ?? {};
	const erlaubt = feld.zustaende?.map((z) => z.wert) ?? ['0', '1'];
	for (const zelle of rasterVon(wert).flat()) {
		if (feld.zahlen) {
			const n = alsZahl(zelle);
			if (!Number.isInteger(n) || n < min || n > max) {
				return `Bitte Zahlen von ${min} bis ${max}.`;
			}
		} else if (!erlaubt.includes(zelle)) {
			return `„${zelle}“ geht in diesem Feld nicht.`;
		}
	}
	return null;
};

const pruefeZahl = (feld: ZahlFeld, wert: string | null) => {
	if (wert === null) {
		return null;
	}
	const n = alsZahl(wert);
	return !Number.isInteger(n) || n < feld.min || n > feld.max
		? `Bitte eine ganze Zahl von ${zahlText(feld.min)} bis ${zahlText(feld.max)}.`
		: null;
};

const pruefeUhrzeit = (wert: string | null) => {
	if (wert === null) {
		return null;
	}
	const treffer = /^(\d{1,2}):(\d{2})$/.exec(wert.trim());
	const [stunde, minute] = [Number(treffer?.[1]), Number(treffer?.[2])];
	return !treffer || stunde > 23 || minute > 59 ? 'Bitte eine Uhrzeit wie 4:30 (Minuten 0 bis 59).' : null;
};

const pruefeZiffern = (feld: ZiffernFeld, wert: string | null, w: Werte) => {
	const stellen = stellenVon(w, feld.stellen);
	const liste = listeVon(wert);
	if (liste.length > stellen.length) {
		return `Die Tafel hat nur ${stellen.length} ${stellen.length === 1 ? 'Stelle' : 'Stellen'}.`;
	}
	const luecke = liste.findIndex((z) => z === '?');
	if (luecke >= 0) {
		return `Bei „${stellen[luecke] ?? ''}“ fehlt eine Zahl. Trag eine ein oder nimm weniger Stellen.`;
	}
	const falsch = liste.find((z) => !/^\d{1,2}$/.test(z));
	return falsch === undefined ? null : `„${falsch}“ geht nicht. Bitte je Stelle eine Zahl von 0 bis 99.`;
};

const pruefeText = (feld: TextFeld, wert: string | null) => {
	if (wert === null) {
		return null;
	}
	if (feld.max !== undefined && wert.length > feld.max) {
		return `Höchstens ${feld.max} Zeichen.`;
	}
	return feld.muster && !new RegExp(`^(?:${feld.muster})$`, 'su').test(wert)
		? (feld.musterHilfe ?? 'Diese Zeichen gehen hier nicht.')
		: null;
};

const pruefeMehrfach = (feld: MehrfachFeld, wert: string | null) => {
	const gewaehlt = listeVon(wert ?? feld.standard?.join(' ') ?? null);
	const falsch = gewaehlt.find((g) => !feld.optionen.some((o) => o.wert === g));
	if (falsch !== undefined) {
		return `„${falsch}“ gibt es hier nicht.`;
	}
	return feld.mindestens !== undefined && gewaehlt.length < feld.mindestens
		? `Bitte mindestens ${feld.mindestens} auswählen.`
		: null;
};

const pruefeFeld = (feld: Feld, w: Werte): string | null => {
	const { wert } = feldWert(feld, w);
	switch (feld.art) {
		case 'zahl':
			return pruefeZahl(feld, wert);
		case 'uhrzeit':
			return pruefeUhrzeit(wert);
		case 'schalter':
			return wert === null || wert === feld.an || wert === feld.aus
				? null
				: `Nur „${feld.an}“ oder „${feld.aus}“.`;
		case 'zahlen': {
			const falsch = listeVon(wert).find((z) => Number.isNaN(alsZahl(z)));
			return falsch === undefined ? null : `„${falsch}“ ist keine Zahl. Trenne die Zahlen mit Leerzeichen.`;
		}
		case 'ziffern':
			return pruefeZiffern(feld, wert, w);
		case 'text':
			return pruefeText(feld, wert);
		case 'liste':
			return pruefeListe(feld, wert);
		case 'mehrfach':
			return pruefeMehrfach(feld, wert);
		case 'raster':
			return pruefeRaster(feld, wert);
		case 'muster':
			return wert === null || feld.optionen.some((o) => o.wert === wert) ? null : `„${wert}“ gibt es hier nicht.`;
		default:
			return null;
	}
};

const leser = (schema: AbbildungSchema, w: Werte): Lesen => {
	const feld = (a: string) => schema.felder.find((f) => f.attribut === a);
	return {
		text: (a) => {
			const f = feld(a);
			return f ? feldWert(f, w).wert : (w[a] ?? null);
		},
		zahl: (a) => {
			const f = feld(a);
			const wert = f ? feldWert(f, w).wert : null;
			if (wert !== null) {
				return alsZahl(wert);
			}
			return f?.art === 'zahl' ? f.standard : 0;
		},
		zahlen: (a) => {
			const f = feld(a);
			return listeVon(f ? feldWert(f, w).wert : null).map(alsZahl);
		},
		zeilen: (a) => {
			const f = feld(a);
			return f?.art === 'liste' ? zeilenVon(f, feldWert(f, w).wert) : [];
		},
		raster: (a) => {
			const f = feld(a);
			return rasterVon(f ? feldWert(f, w).wert : null);
		},
		liste: (a) => {
			const f = feld(a);
			if (f?.art === 'mehrfach') {
				return listeVon(feldWert(f, w).wert ?? f.standard?.join(' ') ?? null);
			}
			return listeVon(f ? feldWert(f, w).wert : (w[a] ?? null));
		},
	};
};

/** Leer heißt gültig. Erst jedes Feld für sich, dann die Regeln zwischen den Feldern. */
export const pruefeWerte = (schema: AbbildungSchema, w: Werte): Fehler => {
	const fehler: Fehler = {};
	for (const feld of schema.felder) {
		const meldung = pruefeFeld(feld, w);
		if (meldung) {
			fehler[feld.attribut] = meldung;
		}
	}
	return Object.keys(fehler).length > 0 || !schema.regeln ? fehler : schema.regeln(leser(schema, w));
};

// ── Befehl ──────────────────────────────────────────────────────────────────

/**
 * Setzt die Attribute einer Abbildung (`null` entfernt eines). Nur diese Attribute ändern sich in der Quelle; die
 * Nummern der Elemente bleiben, die Auswahl auch.
 */
export const setzeAbbildung = (quelle: string, nr: number, werte: Werte): StrukturErgebnis => {
	const k = zerlege(quelle).knoten[nr];
	const schema = k ? schemaVon(k.tag) : undefined;
	if (!k || !schema) {
		throw new Error(`Das Element ${nr} ist keine Abbildung.`);
	}
	const fehler = Object.values(pruefeWerte(schema, { ...werteVon(schema, k, zerlege(quelle)), ...werte }));
	if (fehler.length > 0) {
		throw new Error(fehler[0]);
	}
	let neu = quelle;
	for (const [name, wert] of Object.entries(werte)) {
		const z = zerlege(neu);
		const knoten = z.knoten[nr];
		if (knoten) {
			neu = wendeAn(
				neu,
				amInhalt(schema, name)
					? ersetzeInnen(z, knoten, schuetzeText(wert ?? ''))
					: setzeAttribut(z, knoten, name, wert),
			);
		}
	}
	return { quelle: neu, nr };
};
