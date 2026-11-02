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

export type Feld = FeldAus018 | FeldAus023;

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
		name: 'Zehnerstangen und Einerwürfel',
		felder: [
			...ZEHNER_EINER('Zehnerstangen', 'Einerwürfel'),
			{ art: 'zahl', ...GROESSE, min: 4, max: 16, standard: 8 },
		],
		regeln: mindestensEins,
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
				],
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
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 20, standard: 0 },
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-zahlenstrahl': {
		name: 'Zahlenstrahl',
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 0, max: 100000, standard: 0 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 100000, standard: 20 },
			{ art: 'zahl', attribut: 'schritt', name: 'Abstand der Striche', min: 1, max: 10000, standard: 1 },
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
