import type { AbschnittName } from './abschnitte';
/**
 * Schema der Abbildungen aus `abbildungen.js` (018): welche Attribute ein `x-…`-Element hat, wie sie heißen, welche
 * Werte gelten und welche Regeln zwischen ihnen. Das Abbildungs-Panel baut daraus seine Eingaben; ein neues Element
 * braucht nur einen Eintrag hier. Rechnet nur über Text-Patches auf der Quelle, wie die anderen Editor-Befehle.
 */
import { pxZuCm, zahlMitKomma } from './masse';
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
import { uebertrageAuszeichnung } from './textstuecke';
import type { Art, Fach, Klasse } from './werte';

/** Ein zweites Attribut für denselben Wert, das `abbildungen.js` nur im Beispiel und auf dem Lösungsblatt zeichnet. */
interface Loesung {
	attribut: string;
	/** Beschriftung des Schalters, z. B. „Zeiger nur in der Lösung“. */
	name: string;
	/** Stehen beide Attribute in der Quelle, zeichnet `abbildungen.js` dieses (sonst das sichtbare). */
	vorrang?: boolean;
	/**
	 * 197-10: Mehrere Felder teilen ein Lösungs-Attribut mit Zahlen nach Leerzeichen („1 2 3 4“); dieses Feld ist die
	 * Stelle `teil`. Ein Schalter am letzten Feld verschiebt alle zusammen.
	 */
	teil?: number;
	/**
	 * 197-10: Der Schalter schreibt das hier Berechnete nach `attribut` (an) oder entfernt es (aus); das Feld selbst
	 * bleibt stehen. Für Glücksräder, deren Lösung die Füllungen der Felder sind.
	 */
	abgeleitet?: (w: Werte) => string;
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
	/** Steht auch in der Leiste am Baustein: was man beim Durchgehen eines Blatts am häufigsten ändert (071). */
	leiste?: boolean;
	/** Abschnitt im Inspektor, wenn die Regel in `abschnittVon` nicht passt. */
	abschnitt?: AbschnittName;
	/** Der Inspektor hat dafür einen eigenen Regler (083, Silben), das Feld erschiene sonst doppelt. */
	ohneFeld?: boolean;
	/** Der Inhalt darf `<mark>` und Fett enthalten: Das Feld zeigt den Text, beim Ändern bleibt die Auszeichnung. */
	auszeichnung?: boolean;
	/** Nur wenn es wirkt: Das Panel blendet das Feld sonst aus. Der Wert im Attribut bleibt, am Blatt ändert sich nichts. */
	nurWenn?: (w: Werte) => boolean;
	/** Was die Wahl sonst am Blatt scheitern ließe, nimmt sie mit: bekommt die neuen und die alten Werte, liefert die dazu geänderten. */
	mitnehmen?: (w: Werte, alt: Werte) => Werte;
}

/** Vorschlag für den Notenschlüssel in Prozent (053); dieselbe Angabe steht in `abbildungen.js`, ein Test hält beide gleich. */
export const NOTEN_VORSCHLAG = '1:95; 2:80; 3:65; 4:50; 5:25';

export interface ZahlFeld extends FeldBasis {
	art: 'zahl';
	min: number;
	max: number;
	/** Was `abbildungen.js` ohne Attribut nimmt. */
	standard: number;
	/** Hängt der Standard von anderen Feldern ab, liefert das den wirksamen Wert; `standard` gilt dann für die Grundwerte. */
	standardJe?: (w: Werte) => number;
	schritt?: number;
	einheit?: string;
	/**
	 * 197-12: Ohne Attribut rechnet die Zeichnung selbst. Das Feld bleibt dann leer und zeigt als Platzhalter
	 * „automatisch (N)“ bzw. „ohne“; leeren stellt das wieder her.
	 */
	automatisch?: 'automatisch' | 'ohne';
	/**
	 * 197-N02: Was `abbildungen.js` je Klasse höchstens zeichnet, weil sonst der Platz fehlt; enger als `max`, gilt im
	 * Panel mit Klasse. Der Zahlenraum der Klasse gehört nicht hierher: Darüber wird gezeichnet und gewarnt (207).
	 */
	maxJeKlasse?: (klasse: number) => number;
	/**
	 * S-01 (UX 186): Die Zahl ist die Breite der Zeichnung. Im Panel endet sie am rechten Rand des Satzspiegels der
	 * Seite, auf der die Abbildung steht (Format und Ränder zählen); gespeicherte größere Werte zeichnen wie bisher.
	 */
	bisZumRand?: true;
}

/** 197-N02: die obere Grenze eines Zahlenfelds in dieser Klasse. */
export const zahlMax = (feld: ZahlFeld, klasse?: number) =>
	klasse !== undefined && feld.maxJeKlasse ? Math.min(feld.max, feld.maxJeKlasse(klasse)) : feld.max;

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
	/** Im Panel stehen nur diese, je nach anderem Feld; der erste Eintrag gilt, solange es fehlt. `optionen` bleibt die Liste aller gültigen Werte. */
	optionenJe?: { feld: string; werte: Record<string, { wert: string | null; name: string }[]> };
	/** Im Panel stehen nur Optionen, für die das gilt, z. B. nur Satzglieder, die es im Satz gibt. `optionen` bleibt die Liste aller gültigen Werte. */
	angeboten?: (wert: string | null, w: Werte, klasse?: number) => boolean;
	/** 197-16: Ab welcher Klasse eine Option passt; darunter trägt sie im Panel „(über Klasse N)“, bleibt aber wählbar. */
	abKlasse?: Record<string, number>;
	/** Pfad eines kleinen Bilds zur gewählten Option; `{wert}` steht für den Wert. */
	vorschau?: string;
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
	/** 197-04: Kommazahlen erlaubt (3,5); gespeichert mit Punkt, gezeigt mit Komma. Sonst nur ganze Zahlen. */
	komma?: boolean;
	/** 197-11: Eine Zahl je Zeile dieser Liste, im Panel neben ihrer Beschriftung statt als Zahlenreihe. */
	jeZeileVon?: string;
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
	/** Knopf, der das Zeichen an der Cursor-Stelle einfügt, z. B. den Silbenstrich; mit `bis` umschließt er die Markierung. */
	einfuegen?: { zeichen: string; name: string; bis?: string };
	/** 197-17: Eine Liste kurzer Texte, im Blatt mit `;` getrennt; im Panel ein Eintrag je Zeile. */
	jeZeile?: boolean;
}

/** 197-17: Mit `;` getrennt im Blatt, eine Zeile je Eintrag im Panel. */
export const zeilenAusListe = (wert: string | null) =>
	(wert ?? '')
		.split(';')
		.map((t) => t.trim())
		.filter(Boolean)
		.join('\n');
export const listeAusZeilen = (text: string) =>
	text
		.split('\n')
		.map((t) => t.trim())
		.filter(Boolean)
		.join('; ');

const NUR_BUCHSTABEN = /^[A-Za-zÄÖÜäöüß]+$/;

export interface Option {
	wert: string;
	name: string;
}

export interface UnterFeld {
	name: string;
	art: 'text' | 'zahl' | 'auswahl' | 'muster' | 'schalter' | 'bild' | 'mini';
	optionen?: Option[];
	min?: number;
	max?: number;
	/** Neue Zeilen beginnen damit. */
	standard?: string;
	/** Darf leer bleiben (fällt am Zeilenende weg). */
	leer?: boolean;
	/** Nur `art: 'schalter'`: Wert, wenn der Haken gesetzt ist. */
	an?: string;
	/** Lange Einträge wie ein Hinweis: Die Spalte bekommt im Panel anderthalbmal so viel Platz. */
	breit?: boolean;
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
	feldTrenner?: ':' | ': ' | '-' | ' ' | '';
	/** Viele Einträge: Knopf „Als Text bearbeiten“, eine Zeile je Eintrag. */
	alsText?: boolean;
	/** `false`: Die Reihenfolge wirkt nicht (die Zeichnung ordnet selbst), also kein Griff. */
	sortierbar?: boolean;
}

/** Mehrere Haken aus festen Optionen; im Attribut mit Leerzeichen getrennt. */
export interface MehrfachFeld extends FeldBasis {
	art: 'mehrfach';
	optionen: Option[];
	/** Was ohne Attribut gilt. */
	standard?: string[];
	mindestens?: number;
	/** Die Optionen hängen von einem anderen Feld ab; der erste Eintrag gilt, solange es fehlt. */
	optionenJe?: { feld: string; werte: Record<string, Option[]> };
	/** 197-11: Die Optionen entstehen aus den Werten, z. B. ein Haken je Station („1“, „2“ …) und Pfeil („p1“ …). */
	optionenVon?: (w: Werte) => Option[];
}

/** 197-11: Was ein Mehrfach-Feld gerade anbietet. */
export const mehrfachOptionen = (feld: MehrfachFeld, w: Werte | null | undefined): Option[] => {
	if (feld.optionenVon) {
		return w ? feld.optionenVon(w) : [];
	}
	const je = feld.optionenJe;
	return je ? (je.werte[w?.[je.feld] ?? Object.keys(je.werte)[0] ?? ''] ?? []) : feld.optionen;
};

/**
 * 197-11: Zwei Zahlen in einem Attribut, z. B. ein Malwinkel „3x7“, ein Kästchen „2,3“ oder Striche „10 1“. Das Panel
 * zeigt zwei Zahlenfelder und setzt das Attribut daraus zusammen.
 */
export interface PaarFeld extends FeldBasis {
	art: 'paar';
	teile: [PaarTeil, PaarTeil];
	trenner: 'x' | ',' | ' ';
	/** Beide leer entfernt das Attribut. */
	leer?: boolean;
}

export interface PaarTeil {
	name: string;
	min: number;
	max: number;
	/** Ohne Attribut; gilt auch, wenn nur die andere Zahl getippt ist. */
	standard: number;
	/** Kommazahlen erlaubt (gespeichert mit Punkt). */
	komma?: boolean;
	/** S-05 (UX 186): Die obere Grenze hängt von anderen Feldern ab, z. B. der letzten Spalte des Gitters. */
	maxJe?: (w: Werte) => number;
}

/** 197-11: Ein Haken je Zeile einer Liste: Wert ist die Nummer ab 1, Name der Text vor dem ersten `:`. */
const nummernDerZeilen = (wert: string | null, vor: string): Option[] =>
	(wert ?? '')
		.split(';')
		.map((z) => z.trim())
		.filter(Boolean)
		.map((z, i) => ({ wert: `${vor}${i + 1}`, name: `${i + 1}: ${(z.split(':')[0] ?? '').trim()}` }));

/** 197-11: Die zwei Zahlen eines Paars, `null`, wo keine steht. */
export const paarVon = (feld: PaarFeld, wert: string | null): [number | null, number | null] => {
	const teile = (wert ?? '').split(feld.trenner === ' ' ? /\s+/ : feld.trenner).map((t) => t.trim());
	const zahl = (t: string | undefined) => (t ? alsZahl(t) : null);
	return wert?.trim() ? [zahl(teile[0]), zahl(teile[1])] : [null, null];
};

/** 197-11: Zwei Uhrzeiten wie „4:30-4:50“: zwei Uhrzeit-Wahlen. */
export interface ZeitspanneFeld extends FeldBasis {
	art: 'zeitspanne';
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
type FeldAus023 = TextFeld | ListeFeld | MehrfachFeld | RasterFeld | MusterFeld | MischenFeld | PaarFeld | ZeitspanneFeld;

/** Ein Bild aus der Sammlung oder hochgeladen (049); im Attribut steht nur der Pfad. */
export interface BildFeld extends FeldBasis {
	art: 'bild';
}

/** Punkte auf dem Bild `bild`, mit Maus oder Finger gesetzt: `x,y: Wort; …` in Prozent (049). */
export interface PunkteFeld extends FeldBasis {
	art: 'punkte';
}

/** Der Inhalt als Wort-Chips: Wort antippen, Markierung wählen; mit `gruppen` lassen sich Nachbarn verbinden. */
export interface MarkierungFeld extends FeldBasis {
	art: 'markierung';
	/** Wie die Auswahl im Panel heißt, z. B. „Wortart“. */
	markeName: string;
	optionen: Option[];
	gruppen?: boolean;
	beispiel?: string;
}

/** Ein Gitter im Panel für zwei Attribute: Kästchen antippen, Fläche (`boden`) und Symbol (`objekte`) wählen. */
export interface PlanFeld extends FeldBasis {
	art: 'plan';
	objekte: string;
	flaechen: Option[];
	/** Symbole je Wert von `art`. */
	symbole: Record<string, Option[]>;
}

/** Noten als Text; im Panel eine Leiste zum Anfügen. `tonhoehe`: `c'4`, sonst nur der Wert wie `4`. */
export interface NotenFeld extends FeldBasis {
	art: 'noten';
	tonhoehe: boolean;
}

export type Feld = BildFeld | PunkteFeld | FeldAus018 | FeldAus023 | MarkierungFeld | PlanFeld | NotenFeld;

/** Attributname → Wert in der Quelle, `null` = fehlt. Enthält auch die Lösungs-Attribute. */
export type Werte = Record<string, string | null>;

/** Feld (`attribut`) → Meldung für die Lehrkraft. */
export type Fehler = Record<string, string>;

export const KATALOG_KATEGORIEN = [
	'Blatt',
	'Aufgaben',
	'Aufgabenformate',
	'Zahlen',
	'Rechnen',
	'Geometrie',
	'Größen',
	'Daten und Zufall',
	'Deutsch',
	'Sachunterricht',
	'Musik',
	'Spiele und Rätsel',
	'Folien',
] as const;

export type Kategorie = (typeof KATALOG_KATEGORIEN)[number];

/** Gliederung der Bereiche in der Bibliothek (081, 203-11). `KATALOG_KATEGORIEN` bleibt die Quelle der Namen. */
export const KATALOG_BEREICHE = [
	{ gruppe: 'Grundgerüst', bereiche: ['Blatt', 'Aufgaben', 'Aufgabenformate'] },
	{
		gruppe: 'Fächer',
		bereiche: [
			'Zahlen',
			'Rechnen',
			'Geometrie',
			'Größen',
			'Daten und Zufall',
			'Deutsch',
			'Sachunterricht',
			'Musik',
		],
	},
	{ gruppe: 'Mehr', bereiche: ['Spiele und Rätsel', 'Folien'] },
] as const satisfies readonly { gruppe: string; bereiche: readonly Kategorie[] }[];

/** Symbol je Bereich. Hier nur der Name; `web/src/bausteine/Symbol.tsx` bildet ihn auf das Bild ab. */
export const BEREICH_SYMBOL = {
	'Blatt': 'kopfUndRahmen',
	'Aufgaben': 'schrift',
	'Aufgabenformate': 'schreiben',
	'Zahlen': 'nummer',
	'Rechnen': 'rechnen',
	'Geometrie': 'formen',
	'Größen': 'lineal',
	'Daten und Zufall': 'diagramm',
	'Deutsch': 'buch',
	'Sachunterricht': 'natur',
	'Musik': 'musik',
	'Spiele und Rätsel': 'puzzle',
	'Folien': 'praesentieren',
} as const satisfies Record<Kategorie, string>;

/**
 * Wo ein Baustein stehen darf: im Blatt als Ganzem, auf der Seite, in einer Aufgabe (`.koerper`), in einer Zeile oder
 * als Inhalt einer Folie (203-10: in die gewählte Folie, wenn sie nur Kopf und Notiz hat, sonst in eine neue dahinter).
 */
export const KATALOG_ORTE = ['blatt', 'seite', 'aufgabe', 'zeile', 'folie'] as const;

export interface KatalogAngaben {
	kategorie: Kategorie;
	suchbegriffe: readonly string[];
	ort: (typeof KATALOG_ORTE)[number];
	/** Nur als Filter; was wofür taugt, entscheidet der Skill. Ohne Angabe: alle. */
	faecher?: readonly Fach[];
	klassen?: readonly Klasse[];
	/** Nur bei diesen Materialarten. */
	arten?: readonly Art[];
	/**
	 * `false`: nicht mehr im Angebot (Schublade, Schnellauswahl, Slash, Palette), weil es einen einfacheren Weg gibt
	 * (203-04). Der Eintrag bleibt für die Suche per Kennung, die Vorschau und die Starter (Entscheidungen 26 und 27).
	 */
	angeboten?: false;
	/**
	 * Eigenes Starter-HTML aus vorhandenen Elementen und Klassen, wenn das Muster nicht zeigt, was die Kachel einfügen
	 * soll (203). Die Muster bleiben, wie sie sind: Sie gehören den Skills.
	 */
	html?: string;
	/** Aufgabentext, wenn das Element ohne passende Auswahl in eine neue Aufgabe kommt; sonst „Anweisung“ (203-06). */
	anweisung?: string;
	/** Nur Ort `zeile`: Text vor und nach dem Element, wenn es eine eigene Zeile braucht (203-06, Antwortlinie). */
	umZeile?: readonly [string, string];
	/**
	 * Feste Stelle statt der Auswahl (203-07): hinter die letzte Aufgabe ihrer Seite bzw. auf eine neue letzte Seite.
	 * Gibt es das Teil dort schon, wird es gewählt.
	 */
	stelle?: 'nach-letzter-aufgabe' | 'neue-seite';
}

export interface AbbildungSchema {
	/** Wie in `NAMEN` in `abbildungen.js` (Meldungen im Blatt). */
	name: string;
	/** Name in der Oberfläche, wenn er vom Namen in `abbildungen.js` abweicht (203-15); das Skill-Asset bleibt. */
	anzeige?: string;
	/** Angaben für den Katalog (`katalog.ts`); fehlen nur bei `x-probe`, das es nur für Tests gibt. */
	katalog?: KatalogAngaben;
	felder: Feld[];
	/** 197-N04: Eine Zeile im Inspektor, wenn es keine Felder gibt: woraus die Abbildung entsteht. */
	zustand?: string;
	/** Dieses Attribut erzeugt „Neue Zahlen“ aus den übrigen Feldern; ändert sich ein anderes Feld, entsteht es neu (050). */
	generiert?: string;
	/** 197-03: Diese Felder ordnen nur an; ändert sich eines, bleibt die erzeugte Liste. */
	generiertOhne?: string[];
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

const MONATE = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember',
];

/** 197-09: Sprünge einer Zeitspanne, „bis 9:00“, „+30 min“, „+1 h“, mit Komma getrennt. */
const SPRUNG = '\\s*(?:bis\\s+\\d{1,2}[:.]\\d{2}|[+]\\s?\\d+\\s?(?:min|h))\\s*';
const SPRUNG_MUSTER = `${SPRUNG}(?:,${SPRUNG})*`;

/** 197-10: Feld `teil` der Zahlen in `loesung`; der Schalter steht unter dem letzten. */
const teilDerLoesung = (teil: number): Loesung => ({ attribut: 'loesung', name: 'Nur in der Lösung zeigen', teil });

/** Die Füllungen der Felder eines Glücksrads, wie sie `loesung` erwartet („rot blau rot“). */
const fuellungenDesRads = (w: Werte) =>
	(w.felder ?? '')
		.split(';')
		.map((z) => z.split(':')[0]?.trim() ?? '')
		.filter(Boolean)
		.join(' ');

const ZEHNER_EINER = (zehner: string, einer: string): AbbildungSchema['felder'] => [
	{ art: 'zahl', attribut: 'z', name: zehner, min: 0, max: 10, standard: 0 },
	{ art: 'zahl', attribut: 'e', name: einer, min: 0, max: 20, standard: 0 },
];

/**
 * S-03 (UX 186): Eine Regel über mehrere Felder meldet an jedem beteiligten Feld; das Panel zeigt davon nur die eine
 * Meldung am Feld, das die Lehrkraft zuletzt geändert hat.
 */
const beiAllen = (felder: string[], meldung: string): Fehler =>
	Object.fromEntries(felder.map((f) => [f, meldung]));

const mindestensEins = (w: Lesen): Fehler =>
	w.zahl('z') + w.zahl('e') === 0 ? beiAllen(['z', 'e'], 'Nimm mindestens einen Zehner oder einen Einer.') : {};

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

const namenOptionen = (namen: string[]): Option[] => namen.map((wert) => ({ wert, name: wert }));

/**
 * Jahreskreis: kleinste Größe in px, bei der die Beschriftung passt, wie in `jahreskreis` in `abbildungen.js`
 * („September“ radial, „Donnerstag“ quer, Schrift 15 × 0,56). 24 Stunden prüft das Asset nicht.
 */
const kreisMindestens = (w: Werte) => {
	const art = w.art ?? 'jahr';
	const band = art === 'jahr' && w.jahreszeiten === 'ja' ? 18 : 0;
	const roh =
		art === 'jahr'
			? (9 * 15 * 0.56 + 10 + 2 + band) / 0.41
			: art === 'woche' || art === 'tag'
				? 2 * (2 + (10 * 15 * 0.56) / (1.24 * Math.sin(Math.PI / (art === 'woche' ? 7 : 4))))
				: 200;
	return Math.max(200, Math.ceil(roh / 20) * 20);
};

const KREIS_OPTIONEN: Record<string, Option[]> = {
	jahr: namenOptionen([
		'Januar',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember',
	]),
	woche: namenOptionen(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']),
	tag: namenOptionen(['Morgen', 'Mittag', 'Abend', 'Nacht']),
	stunden: namenOptionen(Array.from({ length: 24 }, (_, i) => String(i))),
};

const PLAN_FLAECHEN: Option[] = [
	{ wert: 'leer', name: 'Frei' },
	{ wert: 'strasse', name: 'Straße' },
	{ wert: 'wasser', name: 'Wasser' },
	{ wert: 'wald', name: 'Wald' },
	{ wert: 'wiese', name: 'Wiese' },
	{ wert: 'platz', name: 'Platz' },
];

const PLAN_SYMBOLE: Record<string, Option[]> = {
	ort: [
		{ wert: 'schule', name: 'Schule' },
		{ wert: 'kirche', name: 'Kirche' },
		{ wert: 'rathaus', name: 'Rathaus' },
		{ wert: 'bahnhof', name: 'Bahnhof' },
		{ wert: 'bushaltestelle', name: 'Bushaltestelle' },
		{ wert: 'spielplatz', name: 'Spielplatz' },
		{ wert: 'haus', name: 'Haus' },
		{ wert: 'baum', name: 'Baum' },
		{ wert: 'bruecke', name: 'Brücke' },
		{ wert: 'post', name: 'Post' },
		{ wert: 'krankenhaus', name: 'Krankenhaus' },
		{ wert: 'parkplatz', name: 'Parkplatz' },
	],
	raum: [
		{ wert: 'tisch', name: 'Tisch' },
		{ wert: 'stuhl', name: 'Stuhl' },
		{ wert: 'tafel', name: 'Tafel' },
		{ wert: 'tuer', name: 'Tür' },
		{ wert: 'fenster', name: 'Fenster' },
		{ wert: 'schrank', name: 'Schrank' },
		{ wert: 'teppich', name: 'Teppich' },
	],
};

/** `B3` als Spalte und Zeile, `null`, wenn es außerhalb liegt. */
export const planLage = (q: string, spalten: number, zeilen: number) => {
	const m = /^([A-Z])(\d+)$/.exec(q);
	if (!m) {
		return null;
	}
	const x = (m[1] ?? 'A').charCodeAt(0) - 65;
	const y = Number(m[2]) - 1;
	return x < spalten && y >= 0 && y < zeilen ? { x, y } : null;
};

/** `schule: B3; baum: A2 A3` als Planquadrat → Symbol. */
export const planObjekteVon = (wert: string | null) => {
	const orte = new Map<string, string>();
	for (const teil of (wert ?? '').split(';')) {
		const [name, quadrate] = teil.split(':');
		for (const q of (quadrate ?? '').split(/\s+/).filter(Boolean)) {
			orte.set(q, (name ?? '').trim());
		}
	}
	return orte;
};

export const planObjekteText = (orte: Map<string, string>) => {
	const je = new Map<string, string[]>();
	for (const [q, name] of orte) {
		je.set(name, [...(je.get(name) ?? []), q]);
	}
	return [...je].map(([name, quadrate]) => `${name}: ${quadrate.join(' ')}`).join('; ') || null;
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

const STROM_TEILE: Option[] = [
	{ wert: 'batterie', name: 'Batterie' },
	{ wert: 'schalter:offen', name: 'Schalter offen' },
	{ wert: 'schalter:zu', name: 'Schalter zu' },
	{ wert: 'lampe', name: 'Lampe' },
	{ wert: 'motor', name: 'Motor' },
	{ wert: 'summer', name: 'Summer' },
	{ wert: 'kabel', name: 'Kabel' },
	{ wert: 'eisen', name: 'Eisen (Leiter)' },
	{ wert: 'kupfer', name: 'Kupfer (Leiter)' },
	{ wert: 'alufolie', name: 'Alufolie (Leiter)' },
	{ wert: 'holz', name: 'Holz (Nichtleiter)' },
	{ wert: 'gummi', name: 'Gummi (Nichtleiter)' },
	{ wert: 'plastik', name: 'Plastik (Nichtleiter)' },
	{ wert: 'glas', name: 'Glas (Nichtleiter)' },
	{ wert: 'papier', name: 'Papier (Nichtleiter)' },
];

/** Auch `abbildungen.js` und `assets/bilder/verkehrszeichen/QUELLEN.md` führen diese Nummern; ein Test vergleicht sie. */
export const VERKEHRSZEICHEN: Option[] = [
	{ wert: '101', name: 'Gefahrstelle (101)' },
	{ wert: '102', name: 'Kreuzung mit Vorfahrt von rechts (102)' },
	{ wert: '136', name: 'Kinder (136)' },
	{ wert: '138', name: 'Radverkehr (138)' },
	{ wert: '205', name: 'Vorfahrt gewähren (205)' },
	{ wert: '206', name: 'Halt! Vorfahrt gewähren (206)' },
	{ wert: '220', name: 'Einbahnstraße (220)' },
	{ wert: '237', name: 'Radweg (237)' },
	{ wert: '239', name: 'Gehweg (239)' },
	{ wert: '240', name: 'Gemeinsamer Geh- und Radweg (240)' },
	{ wert: '250', name: 'Verbot für Fahrzeuge aller Art (250)' },
	{ wert: '254', name: 'Verbot für Radverkehr (254)' },
	{ wert: '267', name: 'Verbot der Einfahrt (267)' },
	{ wert: '274', name: 'Höchstgeschwindigkeit 50 (274)' },
	{ wert: '301', name: 'Vorfahrt (301)' },
	{ wert: '306', name: 'Vorfahrtstraße (306)' },
	{ wert: '350', name: 'Fußgängerüberweg (350)' },
	{ wert: '357', name: 'Sackgasse (357)' },
];

const WETTER: Option[] = [
	{ wert: 'sonne', name: 'Sonne' },
	{ wert: 'heiter', name: 'Heiter' },
	{ wert: 'wolke', name: 'Wolke' },
	{ wert: 'regen', name: 'Regen' },
	{ wert: 'schnee', name: 'Schnee' },
	{ wert: 'gewitter', name: 'Gewitter' },
	{ wert: 'nebel', name: 'Nebel' },
];

const NOTEN_TAKTARTEN: Option[] = [
	{ wert: '2/4', name: '2/4' },
	{ wert: '3/4', name: '3/4' },
	{ wert: '4/4', name: '4/4' },
];

const NOTEN_ACHTEL: Record<string, number> = { 1: 8, 2: 4, 4: 2, 8: 1 };
const NOTEN_TAKT_ACHTEL: Record<string, number> = { '2/4': 4, '3/4': 6, '4/4': 8 };
const NOTEN_STUFEN = ['c', 'd', 'e', 'f', 'g', 'a', 'h'];

const wortAchtel = (wort: string) => {
	const t = /(1|2|4|8)(\.?)$/.exec(wort);
	return t ? (NOTEN_ACHTEL[t[1] ?? ''] ?? 0) * (t[2] ? 1.5 : 1) : 0;
};

/** Hängt eine Note an; ist der letzte Takt voll, beginnt ein neuer. */
export const notenAnfuegen = (text: string, wort: string, takt: string) => {
	const roh = text.trim();
	if (!roh) {
		return wort;
	}
	const letzter = roh.split('|').at(-1) ?? '';
	const summe = letzter
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.reduce((s, w) => s + wortAchtel(w), 0);
	return summe >= (NOTEN_TAKT_ACHTEL[takt] ?? 8) ? `${roh} | ${wort}` : `${roh} ${wort}`;
};

/**
 * Ordnet die Noten neu in Takte der Taktart `takt`, wie `notenAnfuegen` sie schriebe; Pausen am Ende fallen weg, neue füllen
 * den letzten Takt. `null`, wenn eine Note über einen Taktstrich ragte oder ein Wort keine Note ist.
 */
export const notenInTakt = (text: string, takt: string): string | null => {
	const soll = NOTEN_TAKT_ACHTEL[takt];
	const woerter = text.split(/[\s|]+/).filter(Boolean);
	while (woerter.length > 0 && /^r/.test(woerter.at(-1) ?? '')) {
		woerter.pop();
	}
	if (!soll || woerter.length === 0) {
		return null;
	}
	const takte: string[][] = [];
	let summe = soll;
	for (const wort of woerter) {
		const achtel = wortAchtel(wort);
		if (achtel === 0) {
			return null;
		}
		if (summe === soll) {
			takte.push([]);
			summe = 0;
		}
		if (summe + achtel > soll) {
			return null;
		}
		takte.at(-1)?.push(wort);
		summe += achtel;
	}
	const letzter = takte.at(-1) ?? [];
	if (summe % 2 === 1) {
		letzter.push('r8');
		summe += 1;
	}
	while (summe < soll) {
		const halbe = summe % 4 === 0 && soll - summe >= 4;
		letzter.push(halbe ? 'r2' : 'r4');
		summe += halbe ? 4 : 2;
	}
	return takte.map((t) => t.join(' ')).join(' | ');
};

/** Die Taktart nimmt die Noten mit, wenn sie sich ohne Bindebogen neu ordnen lassen; mit Auftakt bleibt alles, wie es ist. */
const notenFuerTakt = (w: Werte): Werte => {
	const roh = w.noten ?? '';
	const soll = NOTEN_TAKT_ACHTEL[w.takt ?? '4/4'] ?? 8;
	const takte = roh.split('|').map((t) => t.trim().split(/\s+/).filter(Boolean));
	const passt = takte.every((t) => t.reduce((s, wort) => s + wortAchtel(wort), 0) === soll);
	if (!roh.trim() || passt || w.auftakt === 'ja') {
		return {};
	}
	const neu = notenInTakt(roh, w.takt ?? '4/4');
	if (neu === null || (w.art === 'karte' && neu.includes('|'))) {
		return {};
	}
	return { noten: neu };
};

export const notenZuruecknehmen = (text: string) =>
	text
		.trim()
		.replace(/\S+$/, '')
		.replace(/[\s|]+$/, '');

/** Setzt oder nimmt den Punkt der letzten Note; punktierte Achtel gibt es nicht. */
export const notenPunkt = (text: string) => {
	const roh = text.trim();
	if (/\.$/.test(roh)) {
		return roh.slice(0, -1);
	}
	return /[124]$/.test(roh) ? `${roh}.` : roh;
};

/** Die Noten mit Tonhöhe, ohne Pausen und Taktstriche. */
export const notenMitTon = (text: string) => text.split(/[\s|]+/).filter((w) => /^[a-h]'/.test(w));

/** Verschiebt die `nr`-te Note (ab 0) um Stufen; bleibt in c' bis a''. */
export const notenTon = (text: string, nr: number, schritt: number) => {
	let i = -1;
	return text.replace(
		/(^|[\s|])([a-h])('{1,2})(?=[1248])/g,
		(ganz: string, vor: string, ton: string, oktave: string) => {
			i += 1;
			if (i !== nr) {
				return ganz;
			}
			const alt = NOTEN_STUFEN.indexOf(ton === 'b' ? 'h' : ton) + (oktave.length - 1) * 7;
			const neu = Math.min(12, Math.max(0, alt + schritt));
			return `${vor}${NOTEN_STUFEN[neu % 7] ?? ''}${String.raw`'`.repeat(neu >= 7 ? 2 : 1)}`;
		},
	);
};

/** Von, bis und Teilung je Messgerät und Einheit, wie `SKALA_STANDARD` in `abbildungen.js`. */
export const SKALA_STANDARD: Record<string, [number, number, string]> = {
	'lineal|cm': [0, 15, '1 0.1'],
	'lineal|mm': [0, 150, '10 1'],
	'massband|cm': [0, 100, '10 1'],
	'massband|m': [0, 5, '1 0.1'],
	'messbecher|ml': [0, 500, '100 20'],
	'messbecher|l': [0, 2, '1 0.1'],
	'thermometer|°C': [-20, 40, '10 2'],
	'waage|g': [0, 1000, '100 20'],
	'waage|kg': [0, 5, '1 0.1'],
};

const skalaStandard = (w: Werte): [number, number, string] => {
	const art = w.art ?? 'lineal';
	const einheit =
		w.einheit ??
		Object.keys(SKALA_STANDARD)
			.find((k) => k.startsWith(`${art}|`))
			?.split('|')[1];
	return SKALA_STANDARD[`${art}|${einheit}`] ?? [0, 15, '1 0.1'];
};

const skalaEinheitVon = (art: string) =>
	Object.keys(SKALA_STANDARD)
		.filter((k) => k.startsWith(`${art}|`))
		.map((k) => k.split('|')[1] ?? '');

/** Im Panel nur die Einheiten des Geräts; die Reihenfolge ist die in `SKALA_STANDARD`, das Lineal zuerst. */
const SKALA_EINHEITEN = Object.fromEntries(
	[...new Set(Object.keys(SKALA_STANDARD).map((k) => k.split('|')[0] ?? ''))].map((art) => [
		art,
		[{ wert: null, name: 'Passend zum Gerät' }, ...skalaEinheitVon(art).map((e) => ({ wert: e, name: e }))],
	]),
);

const skalaSchluessel = (w: Werte) => {
	const art = w.art ?? 'lineal';
	return `${art}|${w.einheit ?? skalaEinheitVon(art)[0] ?? ''}`;
};

/** Liegt die Zahl auf einem Strich der neuen Skala, bleibt sie; sonst kommt ein Strich in der Mitte. */
const skalaWert = (roh: string, [von, bis, teilung]: [number, number, string]) => {
	const klein = Number(teilung.split(' ')[1]);
	const zahl = Number(roh.replace(',', '.'));
	const schritte = (zahl - von) / klein;
	if (zahl >= von && zahl <= bis && Math.abs(schritte - Math.round(schritte)) < 1e-6) {
		return roh;
	}
	const mitte = von + Math.round((bis - von) / 2 / klein) * klein;
	return String(Math.round(mitte * 1e6) / 1e6).replace('.', ',');
};

/**
 * Anderes Gerät oder andere Einheit: Die Einheit muss zum Gerät passen, Von, Bis und Striche folgen dem Standard des
 * Geräts, der Wert kommt auf einen Strich. Bleibt die wirksame Einheit dieselbe, ändert sich nichts.
 */
const skalaFolgt = (w: Werte, alt: Werte): Werte => {
	const einheit = skalaEinheitVon(w.art ?? 'lineal').includes(w.einheit ?? '') ? w.einheit : null;
	const neu = { ...w, einheit: einheit ?? null };
	if (skalaSchluessel(neu) === skalaSchluessel(alt)) {
		return {};
	}
	const standard = skalaStandard(neu);
	return {
		einheit: einheit ?? null,
		von: null,
		bis: null,
		teilung: null,
		...(w.wert ? { wert: skalaWert(w.wert, standard) } : {}),
		...(w.loesung ? { loesung: skalaWert(w.loesung, standard) } : {}),
	};
};

/** Der wirksame Standard eines Zahlenfeldes bei den übrigen Werten. */
export const zahlStandard = (feld: ZahlFeld, w: Werte | null | undefined) =>
	feld.standardJe && w ? feld.standardJe(w) : feld.standard;

/** Was das Panel zur Wahl anbietet: die Optionen je nach anderem Feld (`optionenJe`), davon die `angeboten`en. */
export const auswahlOptionen = (feld: AuswahlFeld, w: Werte | null | undefined, klasse?: number) => {
	const je = feld.optionenJe;
	const grund = je ? (je.werte[w?.[je.feld] ?? Object.keys(je.werte)[0] ?? ''] ?? feld.optionen) : feld.optionen;
	const angeboten = feld.angeboten;
	return angeboten && w ? grund.filter((o) => angeboten(o.wert, w, klasse)) : grund;
};

// ── 197-07: Was eine Wahl sonst am Blatt scheitern ließe ────────────────────

/** Euro mit Komma aus den Stücken („2€ 50ct 20ct“ → „2,70“). */
const summeDerStuecke = (stuecke: string | null) => {
	const cent = (stuecke ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.reduce((a, t) => {
			const m = /^(\d+)(ct|€)$/.exec(t);
			return a + (m ? Number(m[1]) * (m[2] === 'ct' ? 1 : 100) : 0);
		}, 0);
	return cent > 0 ? (cent / 100).toFixed(2).replace('.', ',') : null;
};

/**
 * Gitter: die erste Linie ab der Mitte, die die Figur nicht schneidet und Platz für das Spiegelbild lässt; `null`, wenn
 * es keine gibt.
 */
const achseFuer = (w: Werte, achse: string): number | null => {
	const quer = achse === 'waagerecht';
	// 197-02: auf die Grenze des Felds gesetzt, sonst baut ein Entwurf wie „999999“ beim Tippen riesige Listen.
	const grenze = Math.min(40, Number((quer ? w.zeilen : w.spalten) ?? (quer ? 8 : 10)) || 0);
	const figur = gitterFigur(w);
	const mitte = Math.max(1, Math.floor(grenze / 2));
	const linien = [
		...Array.from({ length: Math.max(0, grenze - mitte) }, (_, i) => mitte + i),
		...Array.from({ length: mitte - 1 }, (_, i) => mitte - 1 - i),
	].filter((bei) => bei > 0 && bei < grenze);
	if (!figur) {
		return linien[0] ?? null;
	}
	const [von, bis] = quer ? [figur.oben, figur.unten] : [figur.links, figur.rechts];
	// Die Figur liegt ganz auf einer Seite, und ihr Spiegelbild passt auf die andere.
	return linien.find((bei) => (bis <= bei && 2 * bei - von <= grenze) || (von >= bei && 2 * bei - bis >= 0)) ?? null;
};

/** Zeilen einer Liste (`a: b; c: d`) nach einer Bedingung an der ersten Spalte. */
const zeilenMit = (wert: string | null, behalten: (erste: string) => boolean) => {
	const zeilen = (wert ?? '').split(';').filter((z) => z.trim() !== '');
	const neu = zeilen.filter((z) => behalten((z.split(':')[0] ?? '').trim()));
	return neu.length === zeilen.length ? (wert ?? null) : neu.length > 0 ? neu.join(';') : null;
};

/** Zahlen einer Liste innerhalb der Grenzen; `null` heißt leer. */
const zahlenZwischen = (wert: string | null, von: number, bis: number) => {
	const zahlen = listeVon(wert);
	const neu = zahlen.filter((z) => alsZahl(z) >= von && alsZahl(z) <= bis);
	return neu.length === zahlen.length ? (wert ?? null) : neu.length > 0 ? neu.join(' ') : null;
};

/** Hat jede Zeile der Liste ein Bild? Erst dann gibt es „Bilder“ (197-07). */
const jedeZeileMitBild = (tag: string, liste: string, spalte: number) => (w: Werte) => {
	const feld = schemaVon(tag)?.felder.find((f) => f.attribut === liste);
	const zeilen = feld?.art === 'liste' ? zeilenVon(feld, w[liste] ?? null) : [];
	return zeilen.length > 0 && zeilen.every((z) => (z[spalte] ?? '').trim() !== '');
};

/** Punktfeld: Die Zerlegungslinie bleibt im Feld, auf der Grenze (197-07). */
const linieImPunktfeld = (w: Werte): Werte => {
	const grenze = alsZahl((w.richtung === 'spalten' ? w.spalten : w.zeilen) ?? '5');
	const linie = listeVon(w.trenner ?? null).map(alsZahl);
	if (linie.length === 0 || linie.every((k) => k >= 1 && k < grenze)) {
		return {};
	}
	return { trenner: grenze > 1 ? String(Math.min(grenze - 1, Math.max(1, linie[0] ?? 1))) : null };
};

/** Zeitleiste: Ein Jahr 0 gibt es nur bei Lebensjahren; Ereignisse außerhalb der Leiste fallen weg (197-07). */
const zeitleisteAngepasst = (w: Werte): Werte => {
	const leben = w.art === 'leben';
	const neu: Werte = {};
	let von = alsZahl(w.von ?? '1900');
	let bis = alsZahl(w.bis ?? '2020');
	if (!leben && von === 0) {
		von = 1;
		neu.von = '1';
	}
	if (!leben && bis === 0) {
		bis = 1;
		neu.bis = '1';
	}
	const drin = (jahr: string) => {
		const m = /^(-?\d+)(?:-(-?\d+))?$/.exec(jahr);
		if (!m) {
			// Was noch kein Jahr ist, meldet die Regel am Feld; es fällt nicht still weg.
			return true;
		}
		const jahre = [m[1], m[2]].filter((j) => j !== undefined).map(Number);
		return jahre.every((j) => j >= von && j <= bis && (leben || j !== 0));
	};
	const ereignisse = zeilenMit(w.ereignisse ?? null, drin);
	return ereignisse === (w.ereignisse ?? null) ? neu : { ...neu, ereignisse };
};

/** Bingo: passen so viele Karten mit so vielen Feldern auf ein A4-Blatt (Rechnung wie `abbildungen.js`)? */
const bingoPasst = (seite: number, je: number, klasse = 3) => {
	const [spalten, reihen] = [je === 4 ? 2 : 1, je === 1 ? 1 : 2];
	const zelle = Math.min(
		(620 - 16 * (spalten - 1)) / spalten / seite,
		(870 - 16 * (reihen - 1) - 40 * reihen) / reihen / seite,
		130,
	);
	return Math.floor(zelle * 10) / 10 >= PX_JE_CM * (klasse <= 2 ? 2.5 : 2) - 0.5;
};

/** Für `nurWenn`: Das Feld gilt nur bei diesen Werten eines anderen Felds. Ein leeres Attribut zählt als `standard`. */
const wenn =
	(feldName: string, standard: string, ...werte: string[]) =>
	(w: Werte) =>
		werte.includes(w[feldName] ?? standard);
const wennNicht =
	(feldName: string, standard: string, ...werte: string[]) =>
	(w: Werte) =>
		!werte.includes(w[feldName] ?? standard);
/** Wiederholung und Reihenfolge ändern nur etwas, wenn dasselbe Wort auf mehreren Stufen steht. */
const gleicheWoerter = (w: Werte) => {
	const stufen = (w.stufen ?? '').split(';').map((s) => s.split(',').map((t) => t.trim()));
	return stufen.some((s, i) => stufen.some((t, j) => i !== j && s.some((x) => x && t.includes(x))));
};

/**
 * Satzglieder, die sich beim Umstellen nach vorn stellen lassen: wie `satzUmstellen` in `abbildungen.js` jedes außer dem
 * Prädikat und dem ersten Satzglied.
 */
export const vornMoeglich = (satz: string) => {
	const { woerter } = markierungLesen(satz, true);
	const erstes = woerter[0]?.gruppe;
	return new Set(woerter.flatMap((t) => (t.gruppe !== erstes && t.marke && t.marke !== 'P' ? [t.marke] : [])));
};
const vornAngeboten = (wert: string | null, w: Werte) => wert === null || vornMoeglich(w.inhalt ?? '').has(wert);
/** Ändert sich der Satz, fällt ein Satzglied für vorn weg, das es dort nicht mehr gibt. */
const vornFolgtSatz = (w: Werte): Werte => (vornAngeboten(w.vorn ?? null, w) ? {} : { vorn: null });

/**
 * Art „Bilder“: Jeder Eintrag braucht ein Bild. Die Meldung steht an der Liste, also bei den Bild-Knöpfen, und nennt
 * die Zeilen. Die Wahl bleibt so lange Entwurf, die Knöpfe sind schon da (E-S2; Suchsel mit `istBild` für `mini`).
 */
const bilderFehlen = (
	w: Lesen,
	{
		istBild = (z: string) => z.trim() !== '',
		liste,
		spalte,
		wahl,
		weg = 'Wähle es mit dem Bild-Knopf in der Zeile',
	}: {
		liste: string;
		spalte: number;
		wahl: string;
		istBild?: (zelle: string) => boolean;
		/** Wie die Zeile zu ihrem Bild kommt; ohne Angabe steht der Bild-Knopf schon in der Zeile. */
		weg?: string;
	},
): Fehler => {
	const ohne = w.zeilen(liste).flatMap((z, i) => (istBild(z[spalte] ?? '') ? [] : [i + 1]));
	if (ohne.length === 0) {
		return {};
	}
	const wo = ohne.length === 1 ? `Zeile ${ohne[0]}` : `Zeile ${ohne.slice(0, -1).join(', ')} und ${ohne.at(-1)}`;
	return { [liste]: `${wahl} braucht jeder Eintrag ein Bild. ${weg}, es fehlt in ${wo}.` };
};

/** Buchstaben eines Rätselworts wie `raetselWort` in `abbildungen.js`: groß, ß wird SS. */
const raetselBuchstaben = (wort: string) => [...wort.replace(/ß/g, 'SS').toUpperCase()];

/**
 * Lösungswort senkrecht: Aus jedem Wort kommt der Reihe nach ein Buchstabe. Die Meldung steht am Lösungswort und
 * nennt den Weg; die Wahl der Art bleibt Entwurf, bis es passt (E-X3). Dieselben Prüfungen wie in `abbildungen.js`.
 */
const senkrechtFehlt = (eintraege: string[][], geheimRoh: string | null): Fehler => {
	const n = eintraege.length;
	const weg = `Aus jedem Wort kommt der Reihe nach ein Buchstabe, es braucht also ${n} Buchstaben.`;
	if (!geheimRoh) {
		return { loesungswort: `Trag ein Lösungswort ein. ${weg}` };
	}
	const geheim = raetselBuchstaben(geheimRoh);
	if (geheim.length !== n) {
		return {
			loesungswort: `Das Lösungswort hat ${geheim.length} Buchstaben, es sind aber ${n} Wörter. ${weg} Nimm ein anderes Lösungswort oder ${geheim.length} Wörter.`,
		};
	}
	const i = eintraege.findIndex(([, wort = ''], j) => !raetselBuchstaben(wort).includes(geheim[j] ?? ''));
	const [, wort = ''] = eintraege[i] ?? [];
	return i < 0
		? {}
		: {
				loesungswort: `„${wort}“ enthält kein ${geheim[i]}, den ${i + 1}. Buchstaben des Lösungsworts. Nimm ein anderes Wort oder ziehe die Wörter in eine passende Reihenfolge.`,
			};
};

/** Platzhalter, wenn die Inhalte eines Spielplans nicht als Ziele taugen. */
export const LERNLANDKARTE_PLATZHALTER = 'Ich kann …; Ich kann …; Ich kann …';

/**
 * Zur Lernlandkarte: Sie hat 2 bis 12 Ziele wie `lernlandkarte` in `abbildungen.js`. Passt die Zahl der Inhalte nicht,
 * etwa die Aufgaben eines Spielplans, kommen drei Platzhalter; was passt, bleibt (E-X4).
 */
const zieleFuerLernlandkarte = (w: Werte): Werte => {
	if (w.art !== 'lernlandkarte') {
		return {};
	}
	const ziele = (w.inhalt ?? '').split(';').filter((t) => t.trim() !== '').length;
	return ziele >= 2 && ziele <= 12 ? {} : { inhalt: LERNLANDKARTE_PLATZHALTER };
};

const FELDER_JE_ART: Readonly<Record<string, number>> = { fuenfer: 5, zehner: 10, zwanziger: 20 };

/** Plättchen, die ins Feld passen. Sind es zu viele, füllt die erste Sorte das halbe Feld wie im Musterblatt. */
const passendePlaettchen = (n: number, n2: number, felder: number) => {
	const erste = n > felder ? Math.ceil(felder / 2) : n;
	return [erste, Math.min(n2, felder - erste)] as const;
};

/** Die Art des Zwanzigerfelds nimmt passende Anzahlen mit, auch die der Lösung; was passt, bleibt zeichengleich. */
const plaettchenFuerArt = (w: Werte): Werte => {
	const felder = FELDER_JE_ART[w.art ?? 'zwanziger'] ?? 20;
	const neu: Werte = {};
	const [n, n2] = [Number(w.n ?? 0), Number(w.n2 ?? 0)];
	if (n + n2 > felder) {
		const [erste, zweite] = passendePlaettchen(n, n2, felder);
		neu.n = String(erste);
		neu.n2 = zweite > 0 ? String(zweite) : null;
	}
	const loesung = (w.loesung ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
	if ((loesung[0] ?? 0) + (loesung[1] ?? 0) > felder) {
		const [erste, zweite] = passendePlaettchen(loesung[0] ?? 0, loesung[1] ?? 0, felder);
		neu.loesung = zweite > 0 ? `${erste} ${zweite}` : String(erste);
	}
	return neu;
};

const TAFEL_VERSATZ: Readonly<Record<string, readonly number[]>> = {
	kreuz: [-10, -1, 0, 1, 10],
	block: [-11, -10, -9, -1, 0, 1, 9, 10, 11],
	treppe: [0, 1, 11, 12, 22, 23],
};

/** Die Zahlen eines Ausschnitts wie `ausschnittZahlen` in `abbildungen.js`, ein Test hält beide gleich; `null`, wenn er dort scheitert. */
export const tafelAusschnitt = (von: number, bis: number, art: string, mitte: number): number[] | null => {
	if (mitte < von || mitte > bis) {
		return null;
	}
	const spalte = (mitte - von) % 10;
	const alle = Array.from({ length: bis - von + 1 }, (_, i) => von + i);
	if (art === 'zeile') {
		return alle.filter((z) => Math.floor((z - von) / 10) === Math.floor((mitte - von) / 10));
	}
	if (art === 'spalte') {
		return alle.filter((z) => (z - von) % 10 === spalte);
	}
	const versatz = TAFEL_VERSATZ[art];
	if (!versatz || spalte < (art === 'treppe' ? 0 : 1) || spalte + 1 > 9) {
		return null;
	}
	const zahlen = versatz.map((v) => mitte + v);
	return zahlen.every((z) => z >= von && z <= bis) ? zahlen : null;
};

const tafelGrenzen = (w: Werte) => {
	const von = Number(w.von ?? 1);
	// 197-02: höchstens 400 Zahlen wie die Regel an „bis“; ein Entwurf wie „999999“ baut sonst riesige Listen.
	return { bis: Math.min(Number(w.bis ?? von + 99), von + 399), von };
};

/** Lücken und Markierungen außerhalb des Ausschnitts ließen das Zeichnen scheitern und wären im Raster nicht mehr zu erreichen. */
const nurImAusschnitt = (w: Werte, zahlen: number[]): Werte => {
	const neu: Werte = {};
	for (const name of ['luecken', 'markiert']) {
		const alt = (w[name] ?? '').trim().split(/\s+/).filter(Boolean);
		const bleibt = alt.filter((z) => zahlen.includes(Number(z)));
		if (bleibt.length < alt.length) {
			neu[name] = bleibt.length > 0 ? bleibt.join(' ') : null;
		}
	}
	return neu;
};

/** Die Wahl des Ausschnitts schreibt die gezeigte Mittelzahl mit; passt sie nicht, die nächste, um die er geht. */
const mitteFuerAusschnitt = (w: Werte): Werte => {
	const art = w.ausschnitt ?? 'ganz';
	if (art === 'ganz') {
		return {};
	}
	const { bis, von } = tafelGrenzen(w);
	const gezeigt = Number(w.mitte ?? 45);
	const wunsch = gezeigt >= von && gezeigt <= bis ? gezeigt : von + 44;
	const passend = Array.from({ length: Math.max(bis - von + 1, 0) }, (_, i) => von + i)
		.sort((a, b) => Math.abs(a - wunsch) - Math.abs(b - wunsch))
		.find((z) => tafelAusschnitt(von, bis, art, z));
	if (passend === undefined) {
		return {};
	}
	return {
		mitte: String(passend),
		...nurImAusschnitt(w, tafelAusschnitt(von, bis, art, passend) ?? []),
	};
};

/** Rückt die Mittelzahl, fällt heraus, was nicht mehr im Ausschnitt steht. Geht er um diese Zahl nicht, sagt das die Meldung. */
const ausschnittFolgtMitte = (w: Werte): Werte => {
	const { bis, von } = tafelGrenzen(w);
	const zahlen = tafelAusschnitt(von, bis, w.ausschnitt ?? 'ganz', Number(w.mitte ?? 45));
	return zahlen ? nurImAusschnitt(w, zahlen) : {};
};

/** Geht jede Reihe der Minus-Mauer auf, ohne dass ein Stein unter 0 fällt? */
const minusMauerGeht = (basis: number[]): boolean => {
	if (basis.length < 2) {
		return true;
	}
	const reihe = basis.slice(1).map((z, i) => (basis[i] ?? 0) - z);
	return reihe.every((z) => z >= 0) && minusMauerGeht(reihe);
};

const anordnungen = (zahlen: number[]): number[][] =>
	zahlen.length < 2
		? [zahlen]
		: zahlen.flatMap((z, i) => anordnungen(zahlen.filter((_, j) => j !== i)).map((rest) => [z, ...rest]));

/** Minus nimmt eine Reihenfolge mit, in der kein Stein unter 0 fällt; was aufgeht, bleibt zeichengleich. */
const basisFuerRechnung = (w: Werte): Werte => {
	const basis = (w.basis ?? '')
		.trim()
		.split(/[;\s]+/)
		.filter(Boolean)
		.map(Number);
	if (w.art !== 'minus' || basis.length > 5 || basis.some(Number.isNaN) || minusMauerGeht(basis)) {
		return {};
	}
	const passend =
		anordnungen([...basis].sort((a, b) => b - a)).find(minusMauerGeht) ?? [16, 8, 4, 2, 1].slice(-basis.length);
	return { basis: passend.join(' ') };
};

const REIHE_OBERGRENZE = 60;

/** Die Grundaufgaben der Rechenreihe wie `grundaufgabe` in `abbildungen.js`. */
const rechenreiheGrund = function* (zeichen: string, raum: number, reihe: number | null, rest: boolean) {
	if (zeichen === '+') {
		for (let a = 1; a < raum; a += 1) {
			for (let b = 1; b <= raum - a; b += 1) {
				yield [a, b] as const;
			}
		}
	} else if (zeichen === '−') {
		for (let a = 2; a <= raum; a += 1) {
			for (let b = 1; b < a; b += 1) {
				yield [a, b] as const;
			}
		}
	} else if (zeichen === '·') {
		for (let a = 1; a <= (reihe === null ? Math.floor(raum / 2) : Math.min(10, Math.floor(raum / reihe))); a += 1) {
			for (const b of reihe === null ? Array.from({ length: Math.floor(raum / a) }, (_, i) => i + 1) : [reihe]) {
				yield [a, b] as const;
			}
		}
	} else {
		const teiler =
			reihe === null ? Array.from({ length: Math.max(1, Math.floor(raum / 2)) }, (_, i) => i + 1) : [reihe];
		for (const b of teiler.filter((t) => !rest || t >= 2)) {
			const hoechstens = Math.floor(raum / b);
			for (let c = 1; c <= (reihe === null ? hoechstens : Math.min(10, hoechstens)); c += 1) {
				for (let r = rest ? 1 : 0; r <= (rest ? Math.max(1, b - 1) : 0); r += 1) {
					if (b * c + r <= raum) {
						yield [b * c + r, b] as const;
					}
				}
			}
		}
	}
};

/**
 * Wie viele verschiedene Aufgaben `rechenreiheAufgaben` in `abbildungen.js` bei diesen Werten finden kann, ein Test hält
 * beide gleich. Zählt nur bis zur Obergrenze der Anzahl.
 */
export const rechenreiheMoeglich = (w: Werte): number => {
	const zeichen = w.rechenart ?? '+';
	const uebergang = w.uebergang ?? 'egal';
	const beziehung = w.beziehung ?? 'keine';
	const gegen: Readonly<Record<string, string>> = { '+': '−', '−': '+', '·': ':', ':': '·' };
	const rechne: Readonly<Record<string, (a: number, b: number) => number>> = {
		'+': (a, b) => a + b,
		'−': (a, b) => a - b,
		'·': (a, b) => a * b,
		':': (a, b) => Math.floor(a / b),
	};
	const schon = new Set<string>();
	const grund = rechenreiheGrund(
		zeichen,
		Number(w.zahlenraum ?? 20),
		w.reihe ? Number(w.reihe) : null,
		w.rest === '1',
	);
	for (const [a, b] of grund) {
		const ueber = zeichen === '+' ? (a % 10) + (b % 10) > 10 : ((a - b) % 10) + (b % 10) > 10;
		const punkt = zeichen === '·' || zeichen === ':';
		if (
			(!punkt && uebergang !== 'egal' && ueber !== (uebergang === 'mit')) ||
			(beziehung === 'tausch' && a === b)
		) {
			continue;
		}
		schon.add(`${a} ${zeichen} ${b}`);
		if (beziehung === 'tausch') {
			schon.add(`${b} ${zeichen} ${a}`);
		}
		if (beziehung === 'umkehr') {
			schon.add(`${rechne[zeichen]?.(a, b) ?? 0} ${gegen[zeichen] ?? ''} ${b}`);
		}
		if (schon.size >= REIHE_OBERGRENZE) {
			break;
		}
	}
	return schon.size;
};

/**
 * Was zur Rechenart nicht passt, fällt weg, und die Anzahl sinkt auf das, was es gibt. Sonst scheitert die Wahl am Starter.
 * `dazu` nennt, was die jeweilige Wahl darüber hinaus braucht.
 */
const rechenreiheNimmt =
	(dazu?: (w: Werte) => Werte) =>
	(w: Werte): Werte => {
		const zeichen = w.rechenart ?? '+';
		const punkt = zeichen === '·' || zeichen === ':';
		const neu: Werte = {};
		if (punkt && (w.uebergang ?? 'egal') !== 'egal') {
			neu.uebergang = null;
		}
		if (!punkt && w.reihe) {
			neu.reihe = null;
		}
		if (zeichen !== ':' && w.rest === '1') {
			neu.rest = null;
		}
		if (w.beziehung === 'tausch' && (zeichen === '−' || zeichen === ':')) {
			neu.beziehung = null;
		}
		const stand = { ...w, ...neu, ...dazu?.({ ...w, ...neu }) };
		const moeglich = rechenreiheMoeglich(stand);
		return moeglich > 0 && Number(stand.anzahl ?? 10) > moeglich ? { ...stand, anzahl: String(moeglich) } : stand;
	};

/** Eine Reihe braucht den Zahlenraum, in dem ihre zehn Aufgaben liegen; die 1er-Reihe hat keinen Rest. */
const raumFuerReihe = (w: Werte): Werte => {
	const reihe = Number(w.reihe ?? 0);
	const raum = [10, 20, 100].find((r) => r >= reihe * 10) ?? 100;
	return {
		...(reihe > 0 && Number(w.zahlenraum ?? 20) < raum ? { zahlenraum: String(raum) } : {}),
		...(reihe === 1 && w.rest === '1' ? { rest: null } : {}),
	};
};

/** Rest geht nur mit dem Platzhalter beim Ergebnis, ohne Aufgabenpaare und nicht in der 1er-Reihe. */
const passendZumRest = (w: Werte): Werte => {
	if (w.rest !== '1') {
		return {};
	}
	return {
		...((w.platzhalter ?? 'ergebnis') !== 'ergebnis' ? { platzhalter: null } : {}),
		...((w.beziehung ?? 'keine') !== 'keine' ? { beziehung: null } : {}),
		...(w.reihe === '1' ? { reihe: null } : {}),
	};
};

const ZAUBER_START: Readonly<Record<string, { felder: number; ids: RegExp; summe: string; vorgegeben: string }>> = {
	dreieck: { felder: 6, ids: /^[es]\d$/, summe: '9', vorgegeben: 'e0 e1' },
	quadrat: { felder: 9, ids: /^z\d$/, summe: '15', vorgegeben: 'z0 z4 z5' },
};

/** Die Form nimmt ihre Zahlen mit, die Summe, die dazu aufgeht, und Vorgaben, die es in ihr gibt, wie im Musterblatt. */
const zahlenFuerZauberform = (w: Werte): Werte => {
	const start = ZAUBER_START[w.art ?? 'dreieck'];
	const zahlen = (w.zahlen ?? '')
		.trim()
		.split(/[;\s]+/)
		.filter(Boolean);
	if (!start || zahlen.length === start.felder) {
		return {};
	}
	const mitSumme = Number(w.summe ?? 0) > 0;
	const vorgegeben = (w.vorgegeben ?? '').trim().split(/\s+/).filter(Boolean);
	const fremd = vorgegeben.some((id) => !start.ids.test(id));
	return {
		...(w.zahlen ? { zahlen: null } : {}),
		...(mitSumme ? { summe: start.summe } : {}),
		...(fremd ? { vorgegeben: mitSumme ? start.vorgegeben : null } : {}),
	};
};

/** 197-12: Wie weit die Achse ohne „Bis“ reicht: bis zum größten Wert, auf den Skalenschritt aufgerundet. */
const diagrammBis = (w: Werte) => {
	const werte = (w.werte ?? '')
		.split(/[;\n]/)
		.map((z) => alsZahl(z.split(':').at(-1)?.trim() ?? ''))
		.filter(Number.isFinite);
	const schritt = Math.max(1, alsZahl(w.skala ?? '1') || 1);
	return Math.max(schritt, Math.ceil(Math.max(0, ...werte) / schritt) * schritt);
};

/** Nutzbare Breite eines Blatts in px; dieselbe Zahl steht in `abbildungen.js`, ein Test hält beide gleich. */
export const SATZSPIEGEL = 620;
const PX_JE_CM = 96 / 2.54;

/** Der Rand der Figur im Gitter in Kästchen, aus dem Raster und den Linien; ohne Figur `null`. */
const gitterFigur = (w: Werte) => {
	const zellen = rasterVon(w.figur ?? null).flatMap((zeile, y) =>
		zeile.flatMap((z, x) =>
			z === '0'
				? []
				: [
						[x, y],
						[x + 1, y + 1],
					],
		),
	);
	const punkte = (w.linien ?? '')
		.split(/[;\s]+/)
		.filter(Boolean)
		.map((p) => p.split(',').map(Number));
	const xs = [...zellen, ...punkte].map((p) => p[0] ?? 0);
	const ys = [...zellen, ...punkte].map((p) => p[1] ?? 0);
	return xs.length === 0
		? null
		: { links: Math.min(...xs), oben: Math.min(...ys), rechts: Math.max(...xs), unten: Math.max(...ys) };
};

/** Passt die Breite bei 1 cm nicht aufs Blatt, nimmt die Wahl die kleinen Kästchen. Ohne Angabe sind es in Klasse 1 und 2 1 cm. */
const kaestchenFuer = (w: Werte, breite: (kaestchenPx: number) => number): Werte =>
	w.kaestchen !== '0.5' && breite(PX_JE_CM) > SATZSPIEGEL ? { kaestchen: '0.5' } : {};

const GITTER_ABSTAND = 28;
const breiteMitZiel = (spalten: number) => (px: number) => spalten * px * 2 + GITTER_ABSTAND;

/** Fortsetzen zeigt die vorgegebenen Muster und zwei weitere: Das Gitter wächst, wenn es sonst zu schmal wäre. */
const gitterFuerFortsetzen = (w: Werte): Werte => {
	const figur = gitterFigur(w);
	if (!figur) {
		return {};
	}
	const breite = Number(w.rapport ?? figur.rechts);
	const vorgegeben = Number(w.rapporte ?? 2);
	const hoechstens = Math.floor(SATZSPIEGEL / (PX_JE_CM / 2));
	const einMuster = vorgegeben > 1 && (vorgegeben + 2) * breite > hoechstens && 3 * breite <= hoechstens;
	const noetig = ((einMuster ? 1 : vorgegeben) + 2) * breite;
	const spalten = Math.max(Number(w.spalten ?? 10), noetig);
	if (noetig > hoechstens) {
		return {};
	}
	return {
		...(spalten !== Number(w.spalten ?? 10) ? { spalten: String(spalten) } : {}),
		...(einMuster ? { rapporte: '1' } : {}),
		...kaestchenFuer(w, (px) => spalten * px),
	};
};

/** Das Zielgitter ist so groß wie das Gitter und steht daneben: Es muss die Figur fassen, beide zusammen das Blatt. */
const gitterFuerVergroessern = (w: Werte): Werte => {
	const figur = gitterFigur(w);
	if (!figur) {
		return {};
	}
	const faktor = w.faktor === '0.5' ? 0.5 : 2;
	const noetigSpalten = Math.max(figur.rechts, Math.ceil((figur.rechts - figur.links) * faktor));
	const noetigZeilen = Math.max(figur.unten, Math.ceil((figur.unten - figur.oben) * faktor));
	const jetzt = Number(w.spalten ?? 10);
	const gewachsen = Math.max(jetzt, noetigSpalten);
	const passtKlein = breiteMitZiel(gewachsen)(PX_JE_CM / 2) <= SATZSPIEGEL;
	const spalten = passtKlein ? gewachsen : noetigSpalten;
	const zeilen = Math.max(Number(w.zeilen ?? 8), noetigZeilen);
	return {
		...(spalten !== jetzt ? { spalten: String(spalten) } : {}),
		...(zeilen !== Number(w.zeilen ?? 8) ? { zeilen: String(zeilen) } : {}),
		...kaestchenFuer(w, breiteMitZiel(spalten)),
		...(w.achse ? { 'achse': null, 'achse-bei': null } : {}),
	};
};

/** Spiegeln braucht eine Achse: Fehlt sie, kommt sie an den rechten Rand der Figur, ohne Figur in die Mitte. */
const achseFuerSpiegeln = (w: Werte): Werte =>
	w.achse
		? {}
		: {
				'achse': 'senkrecht',
				'achse-bei': String(gitterFigur(w)?.rechts ?? Math.floor(Number(w.spalten ?? 10) / 2)),
			};

/** Die Aufgabe des Gitters nimmt mit, was sie am Gitter braucht; was schon passt, bleibt zeichengleich. */
const gitterFuerAufgabe = (w: Werte): Werte => {
	switch (w.aufgabe) {
		case 'spiegeln':
			return achseFuerSpiegeln(w);
		case 'fortsetzen':
			return gitterFuerFortsetzen(w);
		case 'vergroessern':
			return gitterFuerVergroessern(w);
		// S-05 (UX 186): Der Weg hat keine Achse; eine vorhandene fällt mit der Wahl weg.
		case 'weg':
			return w.achse ? { 'achse': null, 'achse-bei': null } : {};
		default:
			return {};
	}
};

/**
 * Was gefragt ist, steht nicht mehr als Vorgabe da. Bleibt dann weder Schrägbild noch Bauplan, kommt das Schrägbild
 * dazu, denn sonst lässt sich die Frage nicht beantworten. Andersherum nimmt eine Vorgabe die Frage nicht weg. Wer
 * Bauplan oder Anzahl aus dem Schrägbild erschließt, muss jeden Würfel sehen: Verdeckte werden gezeigt; hat der Bau
 * keine, ändert das am Blatt nichts.
 */
const vorgabeOhneFrage = (w: Werte): Werte => {
	const fragen = listeVon(w.fragen ?? null);
	const zeige = listeVon(w.zeige ?? null);
	const bleibt = zeige.filter((z) => !fragen.includes(z));
	const ohneGrundlage =
		fragen.length > 0 && bleibt.length > 0 && !bleibt.some((z) => ['schraegbild', 'bauplan'].includes(z));
	const neu = ohneGrundlage ? ['schraegbild', ...bleibt] : bleibt;
	const nurSchraegbild = !neu.includes('bauplan') && fragen.some((f) => ['bauplan', 'anzahl'].includes(f));
	return {
		...(neu.join(' ') === zeige.join(' ') ? {} : { zeige: neu.length > 0 ? neu.join(' ') : null }),
		...(nurSchraegbild && w.verdeckt !== 'zeigen' ? { verdeckt: 'zeigen' } : {}),
	};
};

const NETZ_NUR_ECHT = ['gegenueber', 'augen-ergaenzen'];
const istKeinNetz = (w: Werte) => (w.netz ?? '').startsWith('n');

/** „Kein Netz“ ergibt nur als Frage „Netz oder nicht?“ Sinn; was einen faltbaren Würfel braucht, fällt mit der Wahl weg. */
const aufgabeFuerNetz = (w: Werte): Werte =>
	istKeinNetz(w)
		? {
				...(w.aufgabe === 'netz-oder-nicht' ? {} : { aufgabe: 'netz-oder-nicht' }),
				...(w.art === 'quader' ? { art: null } : {}),
				...(w.bastel === 'ja' ? { bastel: null } : {}),
				...(w.laschen === 'ja' ? { laschen: null } : {}),
			}
		: {};

/** Aufgaben am gefalteten Würfel brauchen ein echtes Netz. */
const netzFuerAufgabe = (w: Werte): Werte =>
	istKeinNetz(w) && NETZ_NUR_ECHT.includes(w.aufgabe ?? '') ? { netz: '1' } : {};

/** Der Quader braucht drei Maße und eines der Netze 1 bis 6. */
const masseFuerQuader = (w: Werte): Werte =>
	w.art === 'quader'
		? {
				...(listeVon(w.masse ?? null).length === 3 ? {} : { masse: '4 2 1' }),
				...(['1', '2', '3', '4', '5', '6'].includes(w.netz ?? '1') ? {} : { netz: '1' }),
			}
		: {};

export const ABBILDUNG_SCHEMA = {
	'x-uhr': {
		name: 'Uhr',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Uhrzeit', 'Zifferblatt', 'Zeiger', 'Uhr', 'lesen', 'digital'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			// 203-01: mit Zeigern zum Ablesen; das Muster zeigt die Fassung „Zeichne die Zeiger ein“.
			html: '<x-uhr zeit="4:30"></x-uhr>',
		},
		felder: [
			{
				art: 'uhrzeit',
				attribut: 'zeit',
				name: 'Uhrzeit',
				leiste: true,
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
				nurWenn: wenn('digital', 'nein', 'ja', 'nur'),
				name: 'Digital im Format',
				gruppe: 'Mehr',
				standard: '24',
				optionen: [
					{ wert: '24', name: '24 Stunden' },
					{ wert: '12', name: '12 Stunden' },
				],
			},
			{
				art: 'zeitspanne',
				attribut: 'sektor',
				name: 'Zeitspanne als Fläche',
				gruppe: 'Mehr',
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
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zählen', 'Bündeln', 'Plättchen', 'Nüsse', 'Anzahl', 'Mengenbild'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
			{ art: 'zahl', attribut: 'reihe', name: 'Stück je Reihe', min: 1, max: 10, standard: 10 },
			{
				art: 'zahl',
				attribut: 'buendel',
				name: 'Zehnerbündel',
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
				return {
					buendel: 'Stelle zuerst „Stück je Reihe“ auf 10. Eingekreist werden nur volle Zehnerreihen.',
					reihe: 'Lass 10 Stück je Reihe, solange Zehner eingekreist werden, oder nimm 0 Zehnerbündel.',
				};
			}
			const voll = Math.floor(w.zahl('n') / 10);
			if (buendel > voll) {
				return {
					buendel:
						voll === 0
							? 'Nimm 0 Zehnerbündel. Es gibt noch keinen vollen Zehner zum Einkreisen.'
							: `Nimm höchstens ${voll} Zehnerbündel. Mehr volle Zehnerreihen gibt es nicht.`,
					n: `Nimm für „Anzahl“ mindestens ${buendel * 10}, oder weniger Zehnerbündel.`,
				};
			}
			return {};
		},
	},
	'x-dienes': {
		name: 'Mehrsystemblöcke',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Dienes', 'Zehnerstange', 'Einerwürfel', 'Stellenwert', 'Mehrsystem'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 't', name: 'Tausenderwürfel', min: 0, max: 9, standard: 0, loesung: teilDerLoesung(0) },
			{ art: 'zahl', attribut: 'h', name: 'Hunderterplatten', min: 0, max: 9, standard: 0, loesung: teilDerLoesung(1) },
			{ art: 'zahl', attribut: 'z', name: 'Zehnerstangen', min: 0, max: 10, standard: 0, loesung: teilDerLoesung(2) },
			{ art: 'zahl', attribut: 'e', name: 'Einerwürfel', min: 0, max: 20, standard: 0, loesung: teilDerLoesung(3) },
			{ art: 'zahl', ...GROESSE, min: 4, max: 16, standard: 8 },
		],
		regeln: (w): Fehler =>
			w.zahl('t') + w.zahl('h') + w.zahl('z') + w.zahl('e') === 0 && w.zahlen('loesung').length === 0
				? beiAllen(['t', 'h', 'z', 'e', 'loesung'], 'Nimm mindestens einen Block, auf dem Blatt oder in der Lösung.')
				: {},
	},
	'x-strichpunkt': {
		name: 'Strich-Punkt-Bild',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zehner', 'Einer', 'Stellenwert', 'Striche', 'Punkte'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			...ZEHNER_EINER('Striche (Zehner)', 'Punkte (Einer)'),
			{ art: 'zahl', ...GROESSE, min: 20, max: 80, standard: 40, schritt: 4 },
		],
		regeln: mindestensEins,
	},
	'x-stellentafel': {
		name: 'Stellentafel',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Stellenwerttafel', 'Hunderter', 'Zehner', 'Einer', 'Tausender', 'Plättchen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				name: 'Zahlen als',
				standard: 'ziffern',
				optionen: [
					{ wert: 'ziffern', name: 'Ziffern' },
					{ wert: 'plaettchen', name: 'Plättchen' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'plaettchen',
				nurWenn: wenn('art', 'ziffern', 'plaettchen'),
				name: 'Plättchen je Stelle',
				beispiel: '3 0 12',
				hilfe: 'Von links nach rechts, bis 15 je Stelle. In der Lösung steht dieselbe Angabe unter „Nur in der Lösung zeigen“.',
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 6, standard: 1 },
			{
				art: 'ziffern',
				attribut: 'werte',
				name: 'Zahlen in der Tafel',
				stellen: 'stellen',
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen' },
			},
		],
	},
	'x-zwanzigerfeld': {
		name: 'Zwanzigerfeld',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zwanzigerraum', 'Zehnerfeld', 'Fünferfeld', 'Wendeplättchen', 'Kraft', 'Fünf'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Feld',
				standard: 'zwanziger',
				mitnehmen: plaettchenFuerArt,
				optionen: [
					{ wert: 'fuenfer', name: 'Fünferfeld' },
					{ wert: 'zehner', name: 'Zehnerfeld' },
					{ wert: 'zwanziger', name: 'Zwanzigerfeld' },
				],
			},
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 20, standard: 0, loesung: teilDerLoesung(0) },
			{ art: 'zahl', attribut: 'n2', name: 'Zweite Sorte', min: 0, max: 20, standard: 0, loesung: teilDerLoesung(1) },

			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-zahlenstrahl': {
		name: 'Zahlenstrahl',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Zahlengerade', 'Zahlenreihe', 'Nachbarzahlen', 'Hunderterraum'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'zahl',
				attribut: 'von',
				name: 'Von',
				min: 0,
				max: 1000000,
				standard: 0,
				// 197-07: Beschriftete Zahlen und Pfeile außerhalb fallen weg.
				mitnehmen: (w): Werte => {
					const [von, bis] = [alsZahl(w.von ?? '0'), alsZahl(w.bis ?? '20')];
					return {
						zahlen: zahlenZwischen(w.zahlen ?? null, von, bis),
						pfeile: zahlenZwischen(w.pfeile ?? null, von, bis),
					};
				},
			},
			{
				art: 'zahl',
				attribut: 'bis',
				name: 'Bis',
				min: 1,
				max: 1000000,
				standard: 20,
				// 197-07: Beschriftete Zahlen und Pfeile außerhalb fallen weg.
				mitnehmen: (w): Werte => {
					const [von, bis] = [alsZahl(w.von ?? '0'), alsZahl(w.bis ?? '20')];
					return {
						zahlen: zahlenZwischen(w.zahlen ?? null, von, bis),
						pfeile: zahlenZwischen(w.pfeile ?? null, von, bis),
					};
				},
			},
			{ art: 'zahl', attribut: 'schritt', name: 'Strichabstand', min: 1, max: 100000, standard: 1 },
			{
				art: 'zahl',
				attribut: 'marken',
				name: 'Langer Strich alle',
				min: 1,
				max: 100,
				standard: 5,
			},
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
				bisZumRand: true,
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
				return {
					bis: `Nimm für „Bis“ eine Zahl über ${zahlText(von)}.`,
					von: `Nimm für „Von“ eine Zahl unter ${zahlText(bis)}.`,
				};
			}
			const schritt = w.zahl('schritt');
			const striche = (bis - von) / schritt;
			if (striche > 200) {
				const wie = `Das wären ${Math.ceil(striche)} Striche, höchstens 200 gehen.`;
				return {
					schritt: `${wie} Nimm einen größeren Strichabstand.`,
					bis: `${wie} Nimm für „Bis“ höchstens ${zahlText(von + 200 * schritt)}.`,
					von: `${wie} Nimm für „Von“ mindestens ${zahlText(bis - 200 * schritt)}.`,
				};
			}
			const fehler: Fehler = {};
			for (const [feld, name] of [
				['zahlen', 'Beschriftete Zahlen'],
				['pfeile', 'Pfeile mit Kästchen'],
			] as const) {
				const draussen = w.zahlen(feld).find((z) => z < von || z > bis);
				if (draussen !== undefined) {
					fehler[feld] = `Nimm Zahlen von ${zahlText(von)} bis ${zahlText(bis)}. ${zahlText(draussen)} liegt außerhalb.`;
					const grenze = draussen > bis ? 'bis' : 'von';
					fehler[grenze] ??=
						grenze === 'bis'
							? `Nimm für „Bis“ mindestens ${zahlText(draussen)}, sonst liegt diese Zahl aus „${name}“ außerhalb.`
							: `Nimm für „Von“ höchstens ${zahlText(draussen)}, sonst liegt diese Zahl aus „${name}“ außerhalb.`;
				}
			}
			return fehler;
		},
	},
	'x-timer': {
		name: 'Timer',
		katalog: {
			kategorie: 'Folien',
			suchbegriffe: ['Zeitscheibe', 'Zeit', 'Minuten', 'Countdown', 'Stoppuhr'],
			// 203-N02: eine Folie für sich wie die übrigen Folien, ohne Aufgabe drumherum.
			ort: 'folie',
			arten: ['praesentation'],
			html: '<x-timer minuten="10" groesse="280"></x-timer>',
		},
		felder: [
			{
				art: 'zahl',
				attribut: 'minuten',
				name: 'Minuten',
				min: 1,
				max: 120,
				standard: 10,
				mitnehmen: (w): Werte => (w.skala && Number(w.minuten ?? 10) > Number(w.skala) ? { skala: null } : {}),
			},
			{
				art: 'auswahl',
				attribut: 'skala',
				name: 'Skala',
				hilfe: 'Für kurze Phasen 5 oder 10 Minuten, sonst ist die Scheibe kaum zu sehen.',
				// 197-07: nur Skalen, die die Minuten fassen
				angeboten: (wert, w) => wert === null || Number(wert) >= Number(w.minuten ?? 10),
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
				? {
						skala: `Die Skala reicht nur bis ${skala}. Nimm eine größere oder „Passend“.`,
						minuten: `Nimm höchstens ${skala} Minuten, so weit reicht die Skala. Oder nimm eine größere Skala.`,
					}
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
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Drehrad', 'Zufall', 'Wahrscheinlichkeit', 'Rad'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				// 197-10: Auf dem Blatt bleiben die Felder weiß, die Lösung zeigt ihre Füllungen.
				loesung: { attribut: 'loesung', name: 'Füllungen nur in der Lösung', abgeleitet: fuellungenDesRads },
			},
			{
				art: 'zahlen',
				attribut: 'anteile',
				name: 'Anteile',
				beispiel: '1 1 2',
				hilfe: 'Eine Zahl je Feld. Leer heißt: alle Felder gleich groß.',
				jeZeileVon: 'felder',
			},
			{ art: 'schalter', attribut: 'zeiger', name: 'Zeiger', an: 'ja', aus: 'nein', standard: true },
			{ art: 'schalter', attribut: 'legende', name: 'Legende', an: 'ja', aus: 'nein', standard: true },
			{
				art: 'schalter',
				attribut: 'bastel',
				abschnitt: 'darstellung',
				name: 'Zum Ausschneiden (12 cm)',
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
				return { anteile: 'Nimm Anteile, die zusammen mehr als 0 ergeben.' };
			}
			if (anteile.length > 0 && felder > 0 && anteile.length !== felder) {
				return {
					anteile: `Gib genau ${felder} Zahlen an, eine je Feld.`,
					felder: `Nimm ${anteile.length} Felder, so viele Zahlen stehen bei „Anteile“. Oder ändere die Anteile.`,
				};
			}
			return {};
		},
	},
	'x-wuerfel': {
		name: 'Würfel',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Würfelaugen', 'Augenzahl', 'Zufall'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				nurWenn: wenn('ansicht', 'flach', 'flach'),
				name: 'Seite zeigt',
				standard: 'augen',
				optionen: [
					{ wert: 'augen', name: 'Augen' },
					{ wert: 'zahl', name: 'Zahl' },
					{ wert: 'muster', name: 'Füllung' },
					{ wert: 'text', name: 'Text' },
				],
			},
			{
				art: 'zahl',
				attribut: 'augen',
				nurWenn: (w) => (w.ansicht ?? 'flach') === 'flach' && (w.art ?? 'augen') === 'augen',
				name: 'Augen',
				min: 0,
				max: 6,
				standard: 0,
				loesung: { attribut: 'loesung', name: 'Augen nur in der Lösung', vorrang: true },
			},
			{
				art: 'text',
				attribut: 'inhalt',
				nurWenn: (w) => (w.ansicht ?? 'flach') === 'flach' && (w.art ?? 'augen') !== 'augen',
				name: 'Zahl, Text oder Füllung',
				max: 6,
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen', vorrang: true },
			},
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
			{
				art: 'zahl',
				attribut: 'oben',
				nurWenn: wenn('ansicht', 'flach', 'raeumlich'),
				name: 'Oben',
				min: 0,
				max: 6,
				standard: 1,
			},
			{
				art: 'zahl',
				attribut: 'vorne',
				nurWenn: wenn('ansicht', 'flach', 'raeumlich'),
				name: 'Vorne',
				min: 0,
				max: 6,
				standard: 2,
			},
			{
				art: 'zahl',
				attribut: 'rechts',
				nurWenn: wenn('ansicht', 'flach', 'raeumlich'),
				name: 'Rechts',
				min: 0,
				max: 6,
				standard: 3,
			},
			{ art: 'zahl', ...GROESSE, min: 32, max: 200, standard: 60, schritt: 4 },
		],
	},
	'x-strichliste': {
		name: 'Strichliste',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Häufigkeit', 'Zählen', 'Strichtabelle', 'Fünferbündel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Säulendiagramm', 'Balkendiagramm', 'Bilddiagramm', 'Schaubild', 'Statistik'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
					{ wert: 'linie', name: 'Linie' },
				],
			},
			{
				art: 'liste',
				attribut: 'werte',
				name: 'Werte',
				unter: [
					{ name: 'Name', art: 'text', standard: 'Neu' },
					{ name: 'Wert', art: 'zahl', min: -100000, max: 100000, standard: '1', leer: true },
				],
				min: 1,
				max: 12,
			},
			{
				art: 'mehrfach',
				attribut: 'offen',
				name: 'Offen zum Zeichnen',
				hilfe: 'Diese Einträge zeichnen die Kinder selbst.',
				optionen: [],
				optionenVon: (w) => nummernDerZeilen(w.werte ?? null, ''),
			},
			{ art: 'zahl', attribut: 'skala', name: 'Skalenschritt', min: 1, max: 100000, standard: 1 },
			{
				art: 'zahl',
				attribut: 'von',
				nurWenn: wenn('art', 'saeulen', 'linie'),
				name: 'Von',
				min: -1000,
				max: 1000,
				standard: 0,
				hilfe: 'Nur beim Liniendiagramm, z. B. −10 für Temperaturen unter null.',
			},
			{
				art: 'zahl',
				attribut: 'bis',
				name: 'Bis',
				min: 1,
				max: 100000,
				standard: 10,
				automatisch: 'automatisch',
				standardJe: diagrammBis,
			},
			{ art: 'text', attribut: 'einheit', name: 'Name der Achse', max: 20 },
			{
				art: 'auswahl',
				attribut: 'symbol',
				nurWenn: wenn('art', 'saeulen', 'bild'),
				name: 'Symbol',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'quadrat', name: 'Quadrat' },
					{ wert: 'stern', name: 'Stern' },
					{ wert: 'herz', name: 'Herz' },
				],
			},
			{
				art: 'zahl',
				attribut: 'je',
				nurWenn: wenn('art', 'saeulen', 'bild'),
				name: 'Ein Symbol steht für',
				min: 1,
				max: 1000,
				standard: 1,
			},
			{ art: 'zahl', ...GROESSE, min: 100, max: 400, standard: 200, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const bis = w.text('bis');
			const zahlen = w.zeilen('werte').map((z) => alsZahl(z[1] || '0'));
			if (w.text('art') !== 'linie' && zahlen.some((v) => v < 0)) {
				return {
					werte: 'Nimm Werte ab 0. Werte unter null gehen nur beim Liniendiagramm.',
					art: 'Nimm das Liniendiagramm, denn ein Wert liegt unter null. Oder ändere die Werte.',
				};
			}
			if (w.text('art') !== 'linie' && w.zeilen('werte').some((z) => !z[1])) {
				return {
					werte: 'Trag bei jedem Eintrag einen Wert ein. Leere Werte gehen nur beim Liniendiagramm.',
					art: 'Nimm das Liniendiagramm, denn ein Wert ist leer. Oder trag ihn ein.',
				};
			}
			const groesster = Math.max(0, ...zahlen);
			return bis !== null && groesster > alsZahl(bis)
				? {
						bis: `Nimm für „Bis“ mindestens ${zahlText(groesster)}, so groß ist der größte Wert.`,
						werte: `Nimm Werte bis ${bis}, so weit reicht „Bis“.`,
					}
				: {};
		},
	},
	'x-urne': {
		name: 'Kugeln im Säckchen',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Kugeln', 'Säckchen', 'Ziehen', 'Zufall'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				// 197-10: Auf dem Blatt bleibt das Gefäß dann leer.
				loesung: { attribut: 'loesung', name: 'Kugeln nur in der Lösung', vorrang: true },
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
			return summe > 20 ? { kugeln: `Nimm höchstens 20 Kugeln, hier sind es ${summe}.` } : {};
		},
	},
	'x-wahrscheinlichkeit': {
		name: 'Wahrscheinlichkeit',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['sicher', 'möglich', 'unmöglich', 'Skala', 'Ereignis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				sortierbar: false,
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
			return falsch
				? {
						ereignisse: `Wähle für jedes Ereignis eine Stufe dieser Skala. „${falsch[1] ?? ''}“ gibt es hier nicht.`,
						stufen: `Bei diesen Stufen gibt es „${falsch[1] ?? ''}“ nicht. Ändere zuerst das Ereignis „${falsch[0] ?? ''}“.`,
					}
				: {};
		},
	},
	'x-kombinatorik': {
		name: 'Möglichkeiten',
		katalog: {
			kategorie: 'Daten und Zufall',
			suchbegriffe: ['Kombinationen', 'Baumdiagramm', 'Möglichkeiten', 'Eisbecher'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Zeigen als',
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
				name: 'Auswahl aus',
				zeilenTrenner: '/',
				hilfe: 'Je Stufe die Wörter mit Leerzeichen, z. B. „Waffel Becher“.',
				unter: [{ name: 'Wörter', art: 'text', standard: 'A B' }],
				min: 1,
				max: 3,
			},
			{
				art: 'schalter',
				attribut: 'wiederholung',
				nurWenn: gleicheWoerter,
				name: 'Mit Wiederholung',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{
				art: 'schalter',
				attribut: 'reihenfolge',
				nurWenn: gleicheWoerter,
				name: 'Reihenfolge zählt',
				an: 'ja',
				aus: 'nein',
				standard: true,
			},
			{ art: 'zahl', attribut: 'vorgegeben', name: 'Im Blatt steht schon', min: 0, max: 24, standard: 1 },
		],
	},
	'x-gitter': {
		name: 'Gitter',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: [
				'Karos',
				'Kästchen',
				'Spiegeln',
				'Achsensymmetrie',
				'Muster',
				'fortsetzen',
				'Vergrößern',
				'Wege',
			],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
			{
				art: 'raster',
				attribut: 'figur',
				name: 'Aus Kästchen',
				spalten: 'spalten',
				zeilen: 'zeilen',
				gruppe: 'Figur',
			},
			{
				art: 'text',
				attribut: 'linien',
				name: 'Aus Linien',
				gruppe: 'Figur',
				// Nur Claude füllt es; leer gehört es nicht ins Panel.
				nurWenn: (w) => Boolean(w.linien?.trim()),
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
				mitnehmen: gitterFuerAufgabe,
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'spiegeln', name: 'Spiegeln' },
					{ wert: 'fortsetzen', name: 'Fortsetzen' },
					{ wert: 'vergroessern', name: 'Vergrößern' },
					{ wert: 'weg', name: 'Weg' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'achse',
				// S-05 (UX 186): Beim Weg gibt es keine Achse.
				nurWenn: wennNicht('aufgabe', 'keine', 'fortsetzen', 'weg'),
				name: 'Achse',
				gruppe: 'Aufgabe',
				// 197-07: Spiegeln braucht eine Achse; eine neue Achse steht in der Mitte des Gitters.
				// Beim Spiegeln nur eine Achse, die die Figur nicht schneidet; sie steht ab der Mitte (197-07).
				angeboten: (wert, w) =>
					w.aufgabe !== 'spiegeln' || (wert !== null && achseFuer(w, wert) !== null),
				mitnehmen: (w, alt): Werte => {
					if (!w.achse || w.achse === alt.achse) {
						return {};
					}
					const quer = w.achse === 'waagerecht';
					const laenge = Number((quer ? w.zeilen : w.spalten) ?? (quer ? 8 : 10));
					const bei = w.aufgabe === 'spiegeln' ? achseFuer(w, w.achse) : null;
					return { 'achse-bei': String(bei ?? Math.max(1, Math.floor(laenge / 2))) };
				},
				optionen: [
					{ wert: null, name: 'Keine' },
					{ wert: 'senkrecht', name: 'Senkrecht' },
					{ wert: 'waagerecht', name: 'Waagerecht' },
				],
			},
			{
				art: 'zahl',
				attribut: 'achse-bei',
				nurWenn: (w) => !!w.achse && !['fortsetzen', 'weg'].includes(w.aufgabe ?? 'keine'),
				name: 'Achse nach',
				hilfe: 'So viele Kästchen von links, bei waagerechter Achse von oben.',
				min: 1,
				max: 39,
				standard: 5,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapport',
				nurWenn: wenn('aufgabe', 'keine', 'fortsetzen'),
				name: 'Breite eines Musters',
				min: 1,
				max: 40,
				standard: 4,
				standardJe: (w) => gitterFigur(w)?.rechts ?? 4,
				gruppe: 'Aufgabe',
			},
			{
				art: 'zahl',
				attribut: 'rapporte',
				nurWenn: wenn('aufgabe', 'keine', 'fortsetzen'),
				name: 'Muster vorgegeben',
				min: 1,
				max: 10,
				standard: 2,
				gruppe: 'Aufgabe',
			},
			{
				art: 'auswahl',
				attribut: 'rapportart',
				nurWenn: wenn('aufgabe', 'keine', 'fortsetzen'),
				name: 'Fortsetzen durch',
				standard: 'schieben',
				gruppe: 'Aufgabe',
				mitnehmen: gitterFuerAufgabe,
				optionen: [
					{ wert: 'schieben', name: 'Schieben' },
					{ wert: 'spiegeln', name: 'Spiegeln im Wechsel' },
					{ wert: 'drehen', name: 'Drehen im Wechsel' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'faktor',
				nurWenn: wenn('aufgabe', 'keine', 'vergroessern'),
				name: 'Vergrößern',
				standard: '2',
				gruppe: 'Aufgabe',
				mitnehmen: gitterFuerAufgabe,
				optionen: [
					{ wert: '2', name: 'Doppelt so groß' },
					{ wert: '0.5', name: 'Halb so groß' },
				],
			},
			{
				art: 'liste',
				attribut: 'weg',
				nurWenn: wenn('aufgabe', 'keine', 'weg'),
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
				nurWenn: wenn('aufgabe', 'keine', 'weg'),
				name: 'Beim Weg',
				standard: 'gehen',
				gruppe: 'Aufgabe',
				optionen: [
					{ wert: 'gehen', name: 'Kinder gehen die Pfeile' },
					{ wert: 'beschreiben', name: 'Kinder schreiben die Pfeile' },
				],
			},
			{
				art: 'paar',
				attribut: 'start',
				nurWenn: wenn('aufgabe', 'keine', 'weg'),
				name: 'Start',
				gruppe: 'Aufgabe',
				trenner: ',',
				leer: true,
				hilfe: 'Gezählt ab dem Kästchen oben links, es ist 0 und 0.',
				// S-05 (UX 186): Der Start liegt im Gitter; die Grenze am Feld nennt die letzte Spalte und Zeile.
				teile: [
					{ name: 'Spalte', min: 0, max: 39, standard: 0, maxJe: (w) => alsZahl(w.spalten ?? '10') - 1 },
					{ name: 'Zeile', min: 0, max: 39, standard: 0, maxJe: (w) => alsZahl(w.zeilen ?? '8') - 1 },
				],
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
		anzeige: 'Ebene Figur',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Figur', 'Dreieck', 'Viereck', 'Rechteck', 'Kreis', 'Fläche', 'Formen', 'rechter', 'Winkel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				nurWenn: wenn('form', 'quadrat', 'dreieck'),
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
				komma: true,
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
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Hunderterraum', 'Punktefeld', 'Malwinkel', '100er-Feld'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 100, standard: 0, loesung: teilDerLoesung(0) },
			{ art: 'zahl', attribut: 'n2', name: 'Zweite Sorte', min: 0, max: 100, standard: 0, loesung: teilDerLoesung(1) },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 10 },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 10 },
			{
				art: 'paar',
				attribut: 'malwinkel',
				name: 'Malwinkel',
				trenner: 'x',
				leer: true,
				teile: [
					{ name: 'Zeilen', min: 1, max: 10, standard: 1 },
					{ name: 'Spalten', min: 1, max: 10, standard: 1 },
				],
			},
			{
				// 197-10: Plättchen nur in der Lösung schaltet der Schalter an „Zweite Sorte“; hier bleibt der Malwinkel.
				art: 'text',
				attribut: 'loesung',
				name: 'Malwinkel nur in der Lösung',
				// Ohne „x“ stehen hier die Plättchen des Schalters („30 6“); das Feld ist dann nicht zu sehen.
				muster: '([0-9]+x[0-9]+|[0-9]+( [0-9]+)?)?',
				musterHilfe: 'So: 3x7.',
				nurWenn: (w) => /x/.test(w.loesung ?? ''),
			},
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-hundertertafel': {
		name: 'Hundertertafel',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Hunderterraum', 'Hunderterblatt', 'Tausendertafel', 'Zahlentafel'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 1, max: 9901, standard: 1 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 10000, standard: 100 },
			{
				art: 'auswahl',
				attribut: 'ausschnitt',
				name: 'Ausschnitt',
				standard: 'ganz',
				mitnehmen: mitteFuerAusschnitt,
				optionen: [
					{ wert: 'ganz', name: 'Ganze Tafel' },
					{ wert: 'zeile', name: 'Zeile' },
					{ wert: 'spalte', name: 'Spalte' },
					{ wert: 'kreuz', name: 'Kreuz' },
					{ wert: 'block', name: 'Block' },
					{ wert: 'treppe', name: 'Treppe' },
				],
			},
			{
				art: 'zahl',
				attribut: 'mitte',
				nurWenn: wennNicht('ausschnitt', 'ganz', 'ganz'),
				mitnehmen: ausschnittFolgtMitte,
				name: 'Mittelzahl',
				min: 1,
				max: 10000,
				standard: 45,
			},
			{ art: 'raster', attribut: 'luecken', name: 'Leere Felder', form: true, gruppe: 'Lücken' },
			{
				art: 'zahl',
				attribut: 'zufall',
				name: 'Zufällige Lücken',
				min: 0,
				max: 100,
				standard: 0,
				gruppe: 'Lücken',
			},
			{
				art: 'mischen',
				attribut: 'seed',
				name: 'Anordnung',
				gruppe: 'Lücken',
				nurWenn: (w) => Number(w.zufall ?? 0) > 0,
			},
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Zahlen', form: true, gruppe: 'Markierung' },
			{ art: 'zahl', ...GROESSE, min: 20, max: 50, standard: 32, schritt: 2 },
		],
		// 197-N02: `abbildungen.js` zeichnet höchstens 400 Zahlen; die Meldung steht an „Bis“.
		regeln: (w): Fehler =>
			w.zahl('bis') - w.zahl('von') + 1 > 400
				? {
						bis: `Nimm für „Bis“ höchstens ${zahlText(w.zahl('von') + 399)}. Mehr als 400 Zahlen gehen nicht.`,
						von: `Nimm für „Von“ mindestens ${zahlText(w.zahl('bis') - 399)}. Mehr als 400 Zahlen gehen nicht.`,
					}
				: {},
	},
	'x-rechenrahmen': {
		name: 'Rechenrahmen',
		katalog: {
			kategorie: 'Zahlen',
			suchbegriffe: ['Abakus', 'Rechenschieber', 'Kugeln', 'Zwanzigerrahmen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen' },
			},
			{ art: 'zahl', ...GROESSE, min: 10, max: 30, standard: 18, schritt: 2 },
		],
	},
	'x-rechenstrich': {
		name: 'Rechenstrich',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['leerer', 'Zahlenstrahl', 'Rechenweg', 'Sprünge', 'Halbschriftlich'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				name: 'Im Blatt steht schon',
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
				nurWenn: (w) => w.gemischt === 'ja' || (/\+/.test(w.spruenge ?? '') && /[-−]/.test(w.spruenge ?? '')),
				name: 'Gemischte Sprünge',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'breite',
				bisZumRand: true,
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
		anzeige: 'Lineatur',
		katalog: {
			kategorie: 'Aufgaben',
			suchbegriffe: ['Schreiblinien', 'Lineatur', 'Heftlinien', 'Zeilen', 'Hilfslinien', 'Schreiben', 'lernen'],
			ort: 'aufgabe',
			// 203-12: drei leere Zeilen ohne Vorlagewort; `art` setzt das Einfügen nach der Klasse des Blatts.
			html: '<x-lineatur zeilen="3"></x-lineatur>',
		},
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
			{
				art: 'zahl',
				attribut: 'vorlage-zeilen',
				name: 'Graue Zeilen',
				hilfe: 'So viele Zeilen zeigen den Text zum Nachspuren.',
				min: 1,
				max: 30,
				standard: 1,
			},
			{ art: 'text', attribut: 'anfang', name: 'Vorbild am Zeilenanfang', beispiel: 'Ro' },
			{ art: 'text', attribut: 'loesung', name: 'Text in der Lösung', beispiel: 'Der Hund bellt.' },
			{
				art: 'auswahl',
				attribut: 'schrift',
				name: 'Schrift',
				standard: 'druck',
				hilfe: 'Schreibschrift ist die Vereinfachte Ausgangsschrift. Im Karo bleibt es Druckschrift.',
				optionen: [
					{ wert: 'druck', name: 'Druckschrift' },
					{ wert: 'va', name: 'Schreibschrift' },
				],
			},
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
				bisZumRand: true,
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
	'x-lueckentext': {
		name: 'Lückentext',
		katalog: { kategorie: 'Aufgabenformate', suchbegriffe: ['Lücke', 'Einsetzen', 'Ergänzen', 'Text'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Text',
				quelle: 'inhalt',
				zeilen: 5,
				beispiel: 'Der [Hund] bellt, die [[Katze]] miaut.',
				einfuegen: { zeichen: '[', bis: ']', name: 'Lücke' },
				hilfe: 'Lücke: [Wort]. Schon eingetragen: [[Wort]].',
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Lücke als',
				standard: 'linie',
				optionen: [
					{ wert: 'linie', name: 'Linie' },
					{ wert: 'kasten', name: 'Kasten' },
					{ wert: 'gepunktet', name: 'Gepunktet' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'breite',
				name: 'Breite',
				standard: 'einheitlich',
				optionen: [
					{ wert: 'einheitlich', name: 'Alle gleich breit' },
					{ wert: 'wortlaenge', name: 'Nach Wortlänge' },
				],
			},
		],
	},
	'x-wortspeicher': {
		name: 'Wortspeicher',
		katalog: { kategorie: 'Aufgabenformate', suchbegriffe: ['Wörter', 'Wortkasten', 'Lücke'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'woerter',
				name: 'Wörter',
				zeilen: 3,
				jeZeile: true,
				beispiel: 'Hund; Maus; Pferd',
				hilfe: 'Leer: die Wörter aus den Lücken dieser Aufgabe.',
			},
			{
				art: 'zahl',
				attribut: 'spalten',
				abschnitt: 'darstellung',
				name: 'Spalten',
				min: 1,
				max: 6,
				standard: 4,
			},
			{
				art: 'auswahl',
				attribut: 'reihenfolge',
				name: 'Reihenfolge',
				standard: 'alphabetisch',
				optionen: [
					{ wert: 'alphabetisch', name: 'Alphabetisch' },
					{ wert: 'gemischt', name: 'Gemischt' },
				],
			},
			{
				art: 'mischen',
				attribut: 'seed',
				nurWenn: wenn('reihenfolge', 'alphabetisch', 'gemischt'),
				name: 'Anordnung',
			},
			{ art: 'schalter', attribut: 'rahmen', name: 'Rahmen', an: '1', aus: '0', standard: true },
		],
	},
	'x-ankreuzen': {
		name: 'Ankreuzen',
		katalog: {
			kategorie: 'Aufgabenformate',
			suchbegriffe: ['Multiple Choice', 'Auswahl', 'Kreuzen', 'Antworten'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'text',
				attribut: 'fragen',
				name: 'Fragen',
				zeilen: 5,
				beispiel: 'Wie viele Beine hat ein Hund?: *4, 3, 6',
				// S-06 (UX 186): Das Panel zeigt Zeilen; die Kurzschrift erklärt es nur unter „Als Text bearbeiten“.
				hilfe: 'Je Frage eine Zeile, darunter ihre Antworten. Hake an, was richtig ist.',
			},
			{
				art: 'schalter',
				attribut: 'mehrfach',
				nurWenn: (w) => w.mehrfach === '1' || (w.fragen ?? '').split(';').some((f) => f.split('*').length > 2),
				name: 'Mehrere richtig',
				an: '1',
				aus: '0',
				standard: false,
			},
			{
				art: 'zahl',
				attribut: 'spalten',
				abschnitt: 'darstellung',
				name: 'Spalten',
				min: 1,
				max: 4,
				standard: 1,
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
	},
	'x-zuordnen': {
		name: 'Zuordnen',
		katalog: {
			kategorie: 'Aufgabenformate',
			suchbegriffe: ['Verbinden', 'Paare', 'Linien', 'Was gehört zusammen', 'Zuordnung'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'liste',
				attribut: 'paare',
				name: 'Paare',
				unter: [
					{ name: 'Links', art: 'text', standard: 'Neu' },
					{ name: 'Rechts', art: 'text', standard: 'Neu' },
					{ name: 'Bild links', art: 'bild', leer: true },
					{ name: 'Bild rechts', art: 'bild', leer: true },
				],
				min: 2,
				max: 10,
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Lösen durch',
				standard: 'linien',
				optionen: [
					{ wert: 'linien', name: 'Mit Linien verbinden' },
					{ wert: 'ziffern', name: 'Ziffer eintragen' },
				],
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
	},
	'x-sortieren': {
		name: 'Sortieren',
		katalog: {
			kategorie: 'Aufgabenformate',
			suchbegriffe: ['Reihenfolge', 'Ordnen', 'Satz ordnen', 'Bilderfolge', 'Nummerieren'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'liste',
				attribut: 'eintraege',
				name: 'Einträge in richtiger Reihenfolge',
				unter: [
					{ name: 'Text', art: 'text', standard: 'Neu' },
					{ name: 'Bild', art: 'bild', leer: true },
				],
				min: 2,
				max: 12,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'saetze',
				// 197-07: „Bilder“ erst, wenn jeder Eintrag ein Bild hat.
				angeboten: (wert, w) => wert !== 'bilder' || jedeZeileMitBild('x-sortieren', 'eintraege', 1)(w),
				optionen: [
					{ wert: 'saetze', name: 'Sätze' },
					{ wert: 'woerter', name: 'Wörter' },
					{ wert: 'bilder', name: 'Bilder' },
					{ wert: 'zahlen', name: 'Zahlen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Lösen durch',
				standard: 'ziffer',
				optionen: [
					{ wert: 'ziffer', name: 'Ziffer im Kästchen' },
					{ wert: 'linien', name: 'Linien zum Abschreiben' },
				],
			},
			{ art: 'mischen', attribut: 'seed', name: 'Anordnung' },
		],
		regeln: (w): Fehler =>
			w.text('art') === 'bilder'
				? bilderFehlen(w, { liste: 'eintraege', spalte: 1, wahl: 'Bei der Art „Bilder“' })
				: {},
	},
	'x-beschriften': {
		name: 'Beschriften',
		katalog: {
			kategorie: 'Aufgabenformate',
			suchbegriffe: ['Bild beschriften', 'Pflanze', 'Körper', 'Fahrrad', 'Teile benennen'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'bild', attribut: 'bild', name: 'Bild' },
			{
				art: 'text',
				attribut: 'alt',
				name: 'Was zeigt das Bild?',
				// 197-U5: nicht im Panel; der Wert bleibt, wie Claude ihn schreibt
				ohneFeld: true,
			},
			{ art: 'punkte', attribut: 'punkte', name: 'Punkte' },
			{
				art: 'auswahl',
				attribut: 'darstellung',
				name: 'Beschriften mit',
				standard: 'linien',
				optionen: [
					{ wert: 'linien', name: 'Linien nach außen' },
					{ wert: 'nummer', name: 'Nummern im Bild' },
				],
			},
			{ art: 'schalter', attribut: 'wortspeicher', name: 'Wortspeicher', an: '1', aus: '0', standard: false },
		],
	},
	'x-schreibrahmen': {
		name: 'Schreibrahmen',
		katalog: {
			kategorie: 'Aufgabenformate',
			suchbegriffe: ['Satzanfänge', 'Schreibhilfe', 'Text schreiben', 'Aufsatz', 'Planung'],
			ort: 'aufgabe',
		},
		felder: [
			{
				art: 'text',
				attribut: 'satzanfaenge',
				name: 'Satzanfänge',
				zeilen: 4,
				jeZeile: true,
				beispiel: 'Zuerst; Dann; Am Ende',
			},
			{ art: 'zahl', attribut: 'linien', name: 'Linien je Satz', min: 1, max: 6, standard: 2 },
			{
				art: 'auswahl',
				attribut: 'lineatur',
				name: 'Lineatur',
				optionen: [
					{ wert: null, name: 'Nach der Klasse' },
					{ wert: '1', name: 'Lineatur 1' },
					{ wert: '2', name: 'Lineatur 2' },
					{ wert: '3', name: 'Lineatur 3' },
					{ wert: '4', name: 'Lineatur 4' },
				],
			},
			{ art: 'text', attribut: 'wortspeicher', name: 'Wortspeicher', zeilen: 3, jeZeile: true, beispiel: 'Hund; Maus' },
			{ art: 'schalter', attribut: 'planung', name: 'Planung', an: '1', aus: '0', standard: false },
			{
				art: 'text',
				attribut: 'beispiel',
				name: 'Beispieltext',
				zeilen: 3,
				hilfe: 'Steht nur auf dem Lösungsblatt.',
			},
		],
	},
	'x-richtigfalsch': {
		name: 'Richtig oder falsch',
		katalog: { kategorie: 'Aufgabenformate', suchbegriffe: ['Aussagen', 'Stimmt', 'Ja Nein', 'Wahr'], ort: 'aufgabe' },
		felder: [
			{
				art: 'text',
				attribut: 'aussagen',
				name: 'Aussagen',
				zeilen: 5,
				beispiel: 'Hunde bellen: r; Katzen fliegen: f',
				hilfe: 'Je Aussage eine Zeile. Schalte „Richtig“ ein, wenn sie stimmt; sonst ist sie falsch.',
			},
			{
				art: 'auswahl',
				attribut: 'koepfe',
				name: 'Spaltenköpfe',
				standard: 'richtigfalsch',
				optionen: [
					{ wert: 'richtigfalsch', name: 'richtig / falsch' },
					{ wert: 'janein', name: 'ja / nein' },
					{ wert: 'daumen', name: 'Daumen' },
				],
			},
		],
	},
	'x-gesamtpunkte': {
		name: 'Gesamtpunkte',
		katalog: {
			kategorie: 'Blatt',
			suchbegriffe: ['Punkte', 'Summe', 'Klassenarbeit'],
			ort: 'aufgabe',
			angeboten: false,
		},
		felder: [],
	},
	'x-notenschluessel': {
		name: 'Notenschlüssel',
		katalog: {
			kategorie: 'Blatt',
			suchbegriffe: ['Noten', 'Grenzen', 'Klassenarbeit'],
			ort: 'aufgabe',
			angeboten: false,
		},
		felder: [
			{
				art: 'text',
				attribut: 'grenzen',
				name: 'Grenzen in Prozent',
				beispiel: NOTEN_VORSCHLAG,
				muster: '(\\s*[1-5]:\\d+\\s*;?){5}\\s*',
				musterHilfe: `Fünf Grenzen von oben nach unten, z. B. ${NOTEN_VORSCHLAG}.`,
				hilfe: 'Leer lassen für den Vorschlag. Deine Grenzen bleiben, bis du sie löschst.',
			},
			{
				art: 'zahl',
				attribut: 'gesamt',
				name: 'Gesamtpunkte',
				min: 0,
				max: 500,
				standard: 0,
				automatisch: 'automatisch',
			},
		],
	},
	'x-notenspiegel': {
		name: 'Notenspiegel',
		katalog: {
			kategorie: 'Blatt',
			suchbegriffe: ['Verteilung', 'Durchschnitt', 'Klassenarbeit'],
			ort: 'aufgabe',
			// 203-07: zusammen in „Punkte und Unterschrift“ und „Auswertung für die Lehrkraft“
			angeboten: false,
		},
		felder: [],
	},
	'x-unterschrift': {
		name: 'Unterschrift und Datum',
		katalog: {
			kategorie: 'Blatt',
			suchbegriffe: ['Eltern', 'Datumszeile', 'Klassenarbeit'],
			ort: 'aufgabe',
			angeboten: false,
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'felder',
				name: 'Felder',
				standard: 'beides',
				optionen: [
					{ wert: 'beides', name: 'Datum und Unterschrift' },
					{ wert: 'datum', name: 'Nur Datum' },
					{ wert: 'unterschrift', name: 'Nur Unterschrift' },
				],
			},
			{ art: 'text', attribut: 'text', name: 'Beschriftung', beispiel: 'Unterschrift' },
		],
	},
	'x-erwartungshorizont': {
		name: 'Erwartungshorizont',
		katalog: {
			kategorie: 'Blatt',
			suchbegriffe: ['Lösung', 'Teilpunkte', 'Anforderungsbereich', 'Klassenarbeit'],
			ort: 'seite',
			// 203-07: zusammen in „Punkte und Unterschrift“ und „Auswertung für die Lehrkraft“
			angeboten: false,
		},
		felder: [],
		zustand: 'Entsteht aus den Aufgaben und ihren Punkten.',
	},
	'x-silben': {
		name: 'Silben',
		katalog: {
			kategorie: 'Deutsch',
			suchbegriffe: ['Silbentext', 'Wörter in Silben lesen', 'Silbenbögen', 'Silbe', 'Klatschen', 'Lesen', 'lernen'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
			// 203-06: nimmt „Silbentext“ und „Wörter in Silben lesen“ auf
			html: '<x-silben>Die Ro|si|ne ist süß.</x-silben>',
			anweisung: 'Lies. Klatsche die Silben.',
		},
		felder: [
			{
				art: 'text',
				attribut: 'inhalt',
				name: 'Text',
				quelle: 'inhalt',
				// 196-22: Text und Aufgabe offen unter „Inhalt“, nicht im zugeklappten „Weitere“
				abschnitt: 'inhalt',
				auszeichnung: true,
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
				ohneFeld: true,
				optionen: [
					{ wert: 'boegen', name: 'Bögen' },
					{ wert: 'farbe', name: 'Farben' },
					{ wert: 'beides', name: 'Farben und Bögen' },
				],
			},
			{
				art: 'text',
				attribut: 'farben',
				nurWenn: wenn('darstellung', 'boegen', 'farbe', 'beides'),
				name: 'Farben der Klasse',
				abschnitt: 'darstellung',
				beispiel: 'blau rot',
				hilfe: 'Zwei aus blau, rot, gruen, lila, braun, schwarz.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				abschnitt: 'inhalt',
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
				return { inhalt: 'Lösch einen der zwei Silbenstriche, die direkt nebeneinander stehen.' };
			}
			if (/(^|[\s„"'(])\||\|($|[\s.,;:!?“"')])/.test(wort)) {
				return { inhalt: 'Setz Silbenstriche nur innerhalb eines Worts, nicht an den Anfang oder das Ende.' };
			}
			return {};
		},
	},
	'x-wortarten': {
		name: 'Wortarten',
		katalog: {
			kategorie: 'Deutsch',
			suchbegriffe: ['Nomen', 'Verb', 'Adjektiv', 'Montessori', 'Symbole', 'Grammatik'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
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
				name: 'Wortarten als',
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
			return unbekannt ? { inhalt: `Ändere das Kürzel „${unbekannt.marke ?? ''}“, das gibt es nicht.` } : {};
		},
	},
	'x-satzglieder': {
		name: 'Satzglieder',
		katalog: {
			kategorie: 'Deutsch',
			suchbegriffe: ['Subjekt', 'Prädikat', 'Objekt', 'Satzbau', 'Umstellprobe'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
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
				mitnehmen: vornFolgtSatz,
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
				nurWenn: wenn('aufgabe', 'keine', 'umstellen'),
				name: 'Beim Umstellen nach vorn',
				gruppe: 'Mehr',
				angeboten: vornAngeboten,
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
				return { inhalt: 'Schließ jede eckige Klammer.' };
			}
			const { woerter } = markierungLesen(wert, true);
			const unbekannt = woerter.find((t) => t.marke !== null && !ROLLEN_OPTIONEN.some((o) => o.wert === t.marke));
			if (unbekannt) {
				return { inhalt: `Ändere das Satzglied „${unbekannt.marke ?? ''}“, das gibt es nicht.` };
			}
			return woerter.some((t) => t.marke === 'P') ? {} : { inhalt: 'Markiere in jedem Satz ein Prädikat.' };
		},
	},
	'x-wortbausteine': {
		name: 'Wortbausteine',
		katalog: {
			kategorie: 'Deutsch',
			suchbegriffe: ['Wortfamilie', 'Stamm', 'Vorsilbe', 'Endung', 'Morphem'],
			ort: 'aufgabe',
			faecher: ['deutsch'],
		},
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
				// 197-07: „Wortfamilie finden“ gibt es nur bei einer Wortfamilie.
				// 197-07: Bei „Wortfamilie“ bleibt der Stamm in der Mitte, das Wort wird das erste der Familie.
				mitnehmen: (w, alt): Werte => {
					if (w.art !== 'familie') {
						return w.aufgabe === 'familie' ? { aufgabe: null } : {};
					}
					const teile = (w.inhalt ?? '').split('|').map((t) => t.trim()).filter(Boolean);
					if (alt.art === 'familie' || teile.length < 2) {
						return {};
					}
					const stamm =
						teile.find((t) => t.toLowerCase() === (w.stamm ?? '').toLowerCase()) ??
						teile.reduce((a, b) => (b.length > a.length ? b : a));
					const wort = teile.join('');
					const woerter = (w.woerter ?? '').split(';').map((t) => t.trim()).filter(Boolean);
					const aufgabe: Werte = w.aufgabe === 'zerlegen' || w.aufgabe === 'zusammensetzen' ? { aufgabe: null } : {};
					const familie = [wort, ...woerter.filter((t) => t !== wort)].join('; ');
					return { inhalt: stamm, stamm: null, woerter: familie, ...aufgabe };
				},
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
				nurWenn: wenn('art', 'wort', 'familie'),
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
				angeboten: (wert, w) => wert !== 'familie' || w.art === 'familie',
			},
		],
		regeln: (w): Fehler => {
			const wort = w.text('inhalt') ?? '';
			const familie = w.text('art') === 'familie';
			const teile = wort.split('|').map((t) => t.trim());
			const stamm = w.text('stamm');
			const aufgabe = w.text('aufgabe');
			if (wort !== '' && teile.some((t) => !/^[\p{L}-]+$/u.test(t))) {
				return { inhalt: 'Schreib die Bausteine nur mit Buchstaben, dazwischen je einen Strich.' };
			}
			if (stamm !== null && !teile.some((t) => t.toLowerCase() === stamm.toLowerCase())) {
				return {
					stamm: `Wähle als Stamm einen der Bausteine. „${stamm}“ ist keiner.`,
					inhalt: `Lass den Stamm „${stamm}“ in den Bausteinen, oder wähle zuerst einen anderen Stamm.`,
				};
			}
			if (familie && teile.length > 1) {
				return {
					inhalt: 'Schreib bei einer Wortfamilie nur den Stamm in die Mitte.',
					art: 'Lass für eine Wortfamilie bei „Bausteine“ zuerst nur den Stamm stehen.',
				};
			}
			if (familie && w.zeilen('woerter').length === 0) {
				return {
					woerter: 'Trag Wörter der Familie ein.',
					art: 'Trag für die Wortfamilie auch Wörter der Familie ein.',
				};
			}
			const passt = familie ? aufgabe !== 'zerlegen' && aufgabe !== 'zusammensetzen' : aufgabe !== 'familie';
			return passt
				? {}
				: {
						aufgabe: 'Wähle eine Aufgabe, die zur Art passt.',
						art: 'Wähle zuerst eine Aufgabe, die zu dieser Art passt.',
					};
		},
	},
	'x-zeitleiste': {
		name: 'Zeitleiste',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Zeitstrahl', 'Geschichte', 'Jahre', 'Ablauf'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'jahre',
				optionen: [
					{ wert: 'jahre', name: 'Jahreszahlen' },
					{ wert: 'leben', name: 'Lebensjahre' },
				],
				mitnehmen: zeitleisteAngepasst,
			},
			{ art: 'zahl', attribut: 'von', name: 'Von', min: -5000, max: 2100, standard: 1900, mitnehmen: zeitleisteAngepasst },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: -5000, max: 2100, standard: 2020, mitnehmen: zeitleisteAngepasst },
			{
				art: 'zahl',
				attribut: 'schritt',
				name: 'Strich alle',
				hilfe: 'Abstand der Striche auf der Leiste. Passen nicht alle Zahlen, steht nur an manchen eine.',
				min: 1,
				max: 1000,
				standard: 10,
				einheit: 'Jahre',
			},
			{
				art: 'liste',
				attribut: 'ereignisse',
				sortierbar: false,
				name: 'Ereignisse',
				hilfe: 'Jahr oder Zeitraum: 1914 oder 1900-1914, vor Christus mit Minus: -500.',
				unter: [
					{ name: 'Jahr', art: 'text', standard: '2000' },
					{ name: 'Ereignis', art: 'text', standard: 'Ereignis' },
					{ name: 'Kinder tragen ein', art: 'schalter', an: 'offen', leer: true },
				],
			},
			{
				art: 'schalter',
				attribut: 'ereignisliste',
				name: 'Offene Ereignisse als Liste',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				bisZumRand: true,
				abschnitt: 'darstellung',
				name: 'Breite',
				min: 200,
				max: 1600,
				standard: 620,
				schritt: 20,
				einheit: 'px',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const leben = w.text('art') === 'leben';
			const von = w.zahl('von');
			const bis = w.zahl('bis');
			if (von >= bis) {
				return {
					von: `Nimm für „Von“ eine Zahl unter ${zahlText(bis)}, dem Ende der Leiste.`,
					bis: `Nimm für „Bis“ eine Zahl über ${zahlText(von)}, dem Anfang der Leiste.`,
				};
			}
			for (const zeile of w.zeilen('ereignisse')) {
				const m = /^(-?\d+)(?:-(-?\d+))?$/.exec((zeile[0] ?? '').trim());
				if (!m) {
					return {
						ereignisse: `Schreib statt „${zeile[0] ?? ''}“ ein Jahr wie 1990 oder einen Zeitraum wie 1990-2000.`,
					};
				}
				const jahre = [m[1], m[2]].filter((j) => j !== undefined).map(Number);
				if (!leben && jahre.includes(0)) {
					return { ereignisse: 'Nimm statt 0 das Jahr 1 oder -1. Ein Jahr 0 gibt es nicht.' };
				}
				const frueh = Math.min(...jahre);
				const spaet = Math.max(...jahre);
				if (frueh < von || spaet > bis) {
					const wann = zeile[0] ?? '';
					return {
						ereignisse: `Nimm Jahre von ${zahlText(von)} bis ${zahlText(bis)}. ${wann} liegt außerhalb der Leiste.`,
						...(frueh < von ? { von: `Nimm für „Von“ höchstens ${zahlText(frueh)}, sonst liegt ${wann} außerhalb.` } : {}),
						...(spaet > bis ? { bis: `Nimm für „Bis“ mindestens ${zahlText(spaet)}, sonst liegt ${wann} außerhalb.` } : {}),
					};
				}
			}
			return {};
		},
	},
	'x-jahreskreis': {
		name: 'Jahreskreis',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Jahreszeiten', 'Monate', 'Jahreslauf', 'Feste'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'jahr',
				optionen: [
					{ wert: 'jahr', name: 'Jahreskreis' },
					{ wert: 'woche', name: 'Woche' },
					{ wert: 'tag', name: 'Tageskreis: vier Tageszeiten' },
					{ wert: 'stunden', name: 'Tageskreis: 24 Stunden' },
				],
				// 197-07: Jahreszeiten gibt es nur beim Jahreskreis.
				// „Markiert“ behält nur, was es im neuen Kreis gibt.
				mitnehmen: (w): Werte => {
					const art = w.art ?? 'jahr';
					const erlaubt = KREIS_OPTIONEN[art] ?? [];
					const markiert = listeVon(w.markiert ?? null);
					const bleibt = markiert.filter((m) => erlaubt.some((o) => o.wert === m));
					// Passt die Beschriftung der neuen Art nicht, wächst der Kreis mit (197-07).
					const neu: Werte = { ...w, ...(art === 'jahr' ? {} : { jahreszeiten: null }) };
					const mindestens = kreisMindestens(neu);
					return {
						...(art === 'jahr' ? {} : { jahreszeiten: null }),
						...(bleibt.length === markiert.length ? {} : { markiert: bleibt.length > 0 ? bleibt.join(' ') : null }),
						...(Number(w.groesse ?? 320) < mindestens ? { groesse: String(mindestens) } : {}),
					};
				},
			},
			{
				art: 'auswahl',
				attribut: 'beschriftung',
				name: 'Beschriftung',
				standard: 'voll',
				optionen: [
					{ wert: 'voll', name: 'Beschriftet' },
					{ wert: 'leer', name: 'Leer, Kinder tragen ein' },
				],
			},
			{
				art: 'schalter',
				attribut: 'jahreszeiten',
				nurWenn: (w) => (w.art ?? 'jahr') === 'jahr',
				name: 'Jahreszeiten',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{
				art: 'mehrfach',
				attribut: 'markiert',
				name: 'Markiert',
				optionen: [],
				optionenJe: { feld: 'art', werte: KREIS_OPTIONEN },
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'groesse',
				abschnitt: 'darstellung',
				name: 'Größe',
				min: 200,
				max: 1200,
				standard: 320,
				schritt: 20,
				einheit: 'px',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const art = w.text('art') ?? 'jahr';
			if (w.text('jahreszeiten') === 'ja' && art !== 'jahr') {
				return beiAllen(['jahreszeiten', 'art'], 'Schalte die Jahreszeiten aus. Es gibt sie nur beim Jahreskreis.');
			}
			const erlaubt = KREIS_OPTIONEN[art] ?? [];
			const falsch = w.liste('markiert').find((m) => !erlaubt.some((o) => o.wert === m));
			if (falsch) {
				return {
					markiert: `Markiere nur, was zu diesem Kreis gehört. „${falsch}“ gehört nicht dazu.`,
					art: `Nimm zuerst die Markierung „${falsch}“ weg. Sie gehört nicht zu diesem Kreis.`,
				};
			}
			// 197-N02: Die Beschriftung braucht Platz; die Meldung steht an der Größe.
			const mindestens = kreisMindestens({ art, jahreszeiten: w.text('jahreszeiten') });
			return w.zahl('groesse') < mindestens
				? { groesse: `Nimm für „Größe“ mindestens ${zahlMitKomma(pxZuCm(mindestens))} cm, sonst passt die Beschriftung nicht.` }
				: {};
		},
	},
	'x-windrose': {
		name: 'Windrose',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Himmelsrichtungen', 'Norden', 'Kompass', 'Karte'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'richtungen',
				name: 'Richtungen',
				standard: '4',
				optionen: [
					{ wert: '4', name: '4 Richtungen' },
					{ wert: '8', name: '8 Richtungen' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'beschriftung',
				name: 'Beschriftung',
				standard: 'voll',
				optionen: [
					{ wert: 'voll', name: 'Alle Richtungen' },
					{ wert: 'norden', name: 'Nur Norden' },
					{ wert: 'leer', name: 'Leer, Kinder tragen ein' },
				],
			},
			{ art: 'zahl', attribut: 'groesse', name: 'Größe', min: 120, max: 600, standard: 170, schritt: 20, einheit: 'px' },
		],
	},
	'x-schaltplan': {
		name: 'Stromkreis',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Schaltung', 'Batterie', 'Lampe', 'Strom', 'Stromkreis'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'liste',
				attribut: 'teile',
				name: 'Teile im Kreis',
				unter: [{ name: 'Teil', art: 'auswahl', optionen: STROM_TEILE, standard: 'lampe' }],
				zeilenTrenner: ' ',
				min: 1,
				max: 6,
			},
			{
				art: 'liste',
				attribut: 'zweig',
				name: 'Zweiter Zweig',
				hilfe: 'Liegt parallel zu allen Teilen außer der Batterie.',
				unter: [
					{
						name: 'Teil',
						art: 'auswahl',
						optionen: STROM_TEILE.filter((o) => o.wert !== 'batterie'),
						standard: 'kabel',
					},
				],
				zeilenTrenner: ' ',
				max: 5,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Zeichnen als',
				standard: 'symbole',
				optionen: [
					{ wert: 'symbole', name: 'Schaltzeichen' },
					{ wert: 'bild', name: 'Bildhaft' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'leuchtet', name: 'Leuchtet die Lampe?' },
					{ wert: 'vervollstaendigen', name: 'Kabel ergänzen' },
					{ wert: 'benennen', name: 'Teile benennen' },
				],
			},
		],
		regeln: (w): Fehler =>
			w.zeilen('teile').some((z) => z[0] === 'batterie') ? {} : { teile: 'Füge eine Batterie hinzu. Ohne sie ist der Stromkreis nicht vollständig.' },
	},
	'x-kreislauf': {
		name: 'Kreislauf',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Wasserkreislauf', 'Zyklus', 'Lebenskreislauf', 'Pfeile'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
			// 203-19: Kurze Namen passen in ihre Kästen; das Muster bleibt für die Skills.
			html:
				'<x-kreislauf stationen="Meer; Wolken; Regen; Fluss" pfeile="verdunsten; ziehen weiter; regnen; fließen"' +
				' offen="3 p1"></x-kreislauf>',
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Form',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreis' },
					{ wert: 'ablauf', name: 'Ablauf' },
				],
			},
			{
				art: 'liste',
				attribut: 'stationen',
				name: 'Stationen',
				unter: [
					{ name: 'Text', art: 'text', standard: 'Neu' },
					{ name: 'Bild', art: 'bild', leer: true },
				],
				min: 3,
				max: 8,
			},
			{
				art: 'text',
				attribut: 'pfeile',
				name: 'Pfeile',
				beispiel: 'verdunsten; aufsteigen; regnen',
				hilfe: 'Beschriftung je Pfeil, mit Semikolon getrennt.',
			},
			{
				art: 'mehrfach',
				attribut: 'offen',
				name: 'Offen zum Eintragen',
				optionen: [],
				optionenVon: (w) => {
					const stationen = nummernDerZeilen(w.stationen ?? null, '');
					const pfeile = (w.pfeile ?? '').split(';').map((t) => t.trim());
					const anzahl = w.art === 'ablauf' ? stationen.length - 1 : stationen.length;
					return [
						...stationen,
						...Array.from({ length: Math.max(0, anzahl) }, (_, i) => ({
							wert: `p${i + 1}`,
							name: `Pfeil ${i + 1}${pfeile[i] ? `: ${pfeile[i]}` : ''}`,
						})),
					];
				},
			},
		],
		// 197-09: je Pfeil eine Beschriftung aus Wörtern; leer heißt ohne Beschriftung.
		regeln: (w): Fehler => {
			const pfeile = (w.text('pfeile') ?? '').split(';').map((t) => t.trim());
			if (pfeile.every((t) => t === '')) {
				return {};
			}
			const stationen = w.zeilen('stationen').length;
			const anzahl = w.text('art') === 'ablauf' ? stationen - 1 : stationen;
			if (pfeile.some((t) => t !== '' && !/\p{L}/u.test(t))) {
				return { pfeile: 'Schreib je Pfeil ein Wort wie „verdunsten“, mit Semikolon getrennt.' };
			}
			const ablauf = w.text('art') === 'ablauf';
			return pfeile.length === anzahl
				? {}
				: {
						pfeile: `Schreib ${anzahl} Beschriftungen, eine je Pfeil, mit Semikolon getrennt.`,
						stationen: `Nimm ${ablauf ? pfeile.length + 1 : pfeile.length} Stationen, dazu passen die ${pfeile.length} beschrifteten Pfeile. Oder ändere zuerst die Pfeile.`,
						art: `In dieser Form gibt es ${anzahl} Pfeile, beschriftet sind ${pfeile.length}. Ändere zuerst die Pfeile.`,
					};
		},
	},
	'x-verkehrszeichen': {
		name: 'Verkehrszeichen',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Verkehr', 'Schild', 'Radfahren', 'Straße'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'nummer',
				name: 'Zeichen',
				standard: '205',
				optionen: VERKEHRSZEICHEN,
				vorschau: 'bilder/verkehrszeichen/{wert}.svg',
			},
			{ art: 'zahl', ...GROESSE, min: 40, max: 300, standard: 90, schritt: 10 },
			{
				art: 'schalter',
				attribut: 'ausmalen',
				name: 'Nur Umriss zum Ausmalen',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
		],
	},
	'x-wetter': {
		name: 'Wettersymbol',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Wetter', 'Sonne', 'Regen', 'Wolken', 'Wetterbogen'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'symbol',
				name: 'Symbol',
				optionen: [{ wert: null, name: 'Keins' }, ...WETTER],
				// 197-07: „Keins“ legt das Symbol in die Lösung, statt es zu löschen.
				mitnehmen: (w, alt): Werte => (!w.symbol && !w.loesung && alt.symbol ? { loesung: alt.symbol } : {}),
			},
			{
				art: 'auswahl',
				attribut: 'loesung',
				nurWenn: (w) => !w.symbol,
				name: 'Symbol erst in der Lösung',
				optionen: [{ wert: null, name: 'Keins' }, ...WETTER],
			},
			{ art: 'zahl', attribut: 'wind', name: 'Wind (Striche)', min: 0, max: 3, standard: 0 },
			{ art: 'zahl', ...GROESSE, min: 24, max: 200, standard: 60, schritt: 4 },
		],
		regeln: (w): Fehler => (w.text('symbol') || w.text('loesung') ? {} : { symbol: 'Wähle ein Symbol.' }),
	},
	'x-suchsel': {
		name: 'Suchsel',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Wörtersuche', 'Buchstabengitter', 'Wortsuchrätsel', 'Suchrätsel'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Gitter' },
			{
				art: 'liste',
				attribut: 'woerter',
				alsText: true,
				name: 'Wörter',
				hilfe: 'Nur Buchstaben. Das Bild braucht nur die Wortliste „Bilder“.',
				unter: [
					{ name: 'Wort', art: 'text', standard: 'Wort' },
					{ name: 'Bild', art: 'mini', leer: true },
				],
				feldTrenner: ': ',
				min: 2,
				max: 20,
			},
			{
				art: 'zahl',
				attribut: 'spalten',
				name: 'Spalten',
				min: 5,
				max: 20,
				standard: 10,
				// So viele Kästchen (1 cm bis Klasse 2, sonst 0,8 cm) passen in die Zeile von `abbildungen.js`.
				maxJeKlasse: (k) => (k <= 2 ? 16 : 20),
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 5, max: 20, standard: 10 },
			{
				art: 'mehrfach',
				attribut: 'richtungen',
				name: 'Richtungen',
				hilfe: 'Ohne Haken gilt der Standard der Klasse.',
				optionen: [
					{ wert: 'rechts', name: 'Nach rechts' },
					{ wert: 'runter', name: 'Nach unten' },
					{ wert: 'diagonal', name: 'Schräg' },
					{ wert: 'rueckwaerts', name: 'Rückwärts' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'buchstaben',
				name: 'Buchstaben',
				optionen: [
					{ wert: null, name: 'Nach Klasse' },
					{ wert: 'gross', name: 'Großbuchstaben' },
					{ wert: 'wie-geschrieben', name: 'Wie geschrieben' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'wortliste',
				name: 'Wortliste',
				standard: 'text',
				angeboten: (wert, w) => wert !== 'bilder' || jedeZeileMitBild('x-suchsel', 'woerter', 1)(w),
				optionen: [
					{ wert: 'text', name: 'Text' },
					{ wert: 'bilder', name: 'Bilder' },
					{ wert: 'keine', name: 'Keine' },
				],
			},
		],
		regeln: (w): Fehler => {
			const breite = Math.max(w.zahl('spalten'), w.zahl('zeilen'));
			for (const [wort = ''] of w.zeilen('woerter')) {
				if (!NUR_BUCHSTABEN.test(wort)) {
					return { woerter: `Schreib „${wort}“ nur mit Buchstaben.` };
				}
				const laenge = [...wort].length;
				if (laenge > breite) {
					return {
						woerter: `Nimm ein Wort mit höchstens ${breite} Buchstaben. „${wort}“ ist länger als das Gitter.`,
						spalten: `Nimm mindestens ${laenge} Spalten, so lang ist „${wort}“.`,
						zeilen: `Nimm mindestens ${laenge} Zeilen, so lang ist „${wort}“.`,
					};
				}
			}
			// Jeder Mini-Inhalt gilt als Bild, wie in `abbildungen.js` und der Referenz; die Art steht im ⋯ der Zeile.
			return w.text('wortliste') === 'bilder'
				? bilderFehlen(w, {
						liste: 'woerter',
						spalte: 1,
						wahl: 'Bei der Wortliste „Bilder“',
						istBild: (z) => miniTeile(z).inhalt.trim() !== '',
						weg: 'Stelle im Menü ⋯ der Zeile die Art auf „Bild“ und wähle es',
					})
				: {};
		},
	},
	'x-kreuzwort': {
		name: 'Kreuzworträtsel',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Kreuzworträtsel', 'Rätsel', 'Wörter'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Gitter' },
			{
				art: 'liste',
				attribut: 'eintraege',
				alsText: true,
				name: 'Einträge',
				hilfe: 'Hinweis als Text oder Bild, dazu das Wort. Höchstens 12.',
				unter: [
					{ name: 'Hinweis', art: 'mini', standard: 'Hinweis', breit: true },
					{ name: 'Wort', art: 'text', standard: 'Wort' },
				],
				feldTrenner: ': ',
				min: 2,
				max: 12,
			},
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'kreuz',
				optionen: [
					{ wert: 'kreuz', name: 'Frei gekreuzt' },
					{ wert: 'senkrecht', name: 'Lösungswort senkrecht' },
				],
			},
			// 197-07: nur bei „Lösungswort senkrecht“
			{ art: 'text', attribut: 'loesungswort', name: 'Lösungswort', nurWenn: (w) => w.art === 'senkrecht' },
		],
		regeln: (w): Fehler => {
			for (const [, wort = ''] of w.zeilen('eintraege')) {
				if (!NUR_BUCHSTABEN.test(wort)) {
					return { eintraege: `Schreib „${wort}“ nur mit Buchstaben.` };
				}
			}
			const geheim = w.text('loesungswort');
			if (geheim && !NUR_BUCHSTABEN.test(geheim)) {
				return { loesungswort: 'Schreib das Lösungswort nur mit Buchstaben.' };
			}
			return w.text('art') === 'senkrecht' ? senkrechtFehlt(w.zeilen('eintraege'), geheim) : {};
		},
	},
	'x-loesungswort': {
		name: 'Lösungswort',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Lösungswort', 'Selbstkontrolle', 'Geheimwort'],
			ort: 'aufgabe',
		},
		felder: [
			{ art: 'text', attribut: 'wort', name: 'Wort', beispiel: 'SONNE' },
			{
				art: 'text',
				attribut: 'bezug',
				name: 'Aufgabe',
				hilfe: 'Nummer der Aufgabe, deren Lösungen die Buchstaben liefern.',
			},
			{
				art: 'liste',
				attribut: 'zuordnung',
				alsText: true,
				name: 'Legende',
				hilfe: 'Jedes richtige Ergebnis mit seinem Buchstaben.',
				unter: [
					{ name: 'Ergebnis', art: 'text', standard: '1' },
					{ name: 'Buchstabe', art: 'text', standard: 'A' },
				],
				feldTrenner: ': ',
				min: 0,
				max: 26,
			},
			{
				art: 'liste',
				attribut: 'ablenker',
				name: 'Ablenker',
				hilfe: 'Typische falsche Ergebnisse mit eigenem Buchstaben.',
				unter: [
					{ name: 'Ergebnis', art: 'text', standard: '1' },
					{ name: 'Buchstabe', art: 'text', standard: 'X' },
				],
				feldTrenner: ': ',
				min: 0,
				max: 10,
			},
		],
		regeln: (w): Fehler =>
			NUR_BUCHSTABEN.test(w.text('wort') ?? '') ? {} : { wort: 'Schreib das Wort nur mit Buchstaben.' },
	},
	'x-bingo': {
		name: 'Bingo',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Bingo', 'Spiel', 'Karten', 'Rufliste'],
			ort: 'seite',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Karten mischen' },
			{
				art: 'liste',
				attribut: 'eintraege',
				alsText: true,
				name: 'Einträge',
				hilfe: 'Ruf und Feld, zum Beispiel 7·8 und 56. Nötig sind Felder × Felder + 4 Einträge.',
				unter: [
					{ name: 'Ruf', art: 'text', standard: 'Neu' },
					{ name: 'Feld', art: 'mini', leer: true },
				],
				feldTrenner: ': ',
				min: 8,
				max: 60,
			},
			{
				art: 'zahl',
				attribut: 'felder',
				name: 'Felder je Reihe',
				min: 3,
				max: 5,
				standard: 4,
				// 197-07: Passen die Karten je Seite nicht mehr, nimmt die Wahl weniger.
				mitnehmen: (w): Werte => {
					const seite = alsZahl(w.felder ?? '4');
					const je = alsZahl(w['je-seite'] ?? '2');
					const passt = [4, 2, 1].find((n) => n <= je && bingoPasst(seite, n, 1));
					return passt === undefined || passt === je ? {} : { 'je-seite': String(passt) };
				},
			},
			{ art: 'zahl', attribut: 'karten', name: 'Karten', min: 1, max: 40, standard: 4 },
			{
				art: 'auswahl',
				attribut: 'je-seite',
				name: 'Karten je Seite',
				standard: '2',
				angeboten: (wert, w, klasse) => bingoPasst(alsZahl(w.felder ?? '4'), alsZahl(wert ?? '2'), klasse),
				optionen: [
					{ wert: '1', name: '1' },
					{ wert: '2', name: '2' },
					{ wert: '4', name: '4' },
				],
			},
			{
				art: 'schalter',
				attribut: 'frei',
				nurWenn: (w) => Number(w.felder ?? 4) % 2 === 1,
				name: 'Joker in der Mitte',
				an: 'ja',
				aus: 'nein',
				standard: false,
			},
			{ art: 'schalter', attribut: 'rufliste', name: 'Rufliste', an: 'ja', aus: 'nein', standard: true },
		],
		regeln: (w): Fehler => {
			const seite = w.zahl('felder');
			const noetig = seite * seite - (w.text('frei') === 'ja' && seite % 2 === 1 ? 1 : 0) + 4;
			const anzahl = w.zeilen('eintraege').length;
			return anzahl < noetig
				? {
						eintraege: `Trag mindestens ${noetig} Einträge ein, damit die Karten verschieden werden. Jetzt sind es ${anzahl}.`,
						felder: `Nimm weniger Felder je Reihe. Für ${seite} × ${seite} Felder braucht es mindestens ${noetig} Einträge, jetzt sind es ${anzahl}.`,
						frei: `Lass den Joker an, oder trag mehr Einträge ein. Ohne Joker braucht es ${noetig}, jetzt sind es ${anzahl}.`,
					}
				: {};
		},
	},
	'x-domino': {
		name: 'Domino',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Domino', 'Spiel', 'Kette', 'Steine', 'Klammerkarten'],
			ort: 'seite',
		},
		felder: [
			{ art: 'mischen', attribut: 'seed', name: 'Lage der Steine' },
			{
				art: 'liste',
				attribut: 'paare',
				alsText: true,
				name: 'Paare',
				unter: [
					{ name: 'Aufgabe', art: 'mini', standard: 'Neu' },
					{ name: 'Lösung', art: 'mini', standard: 'Neu' },
				],
				feldTrenner: ': ',
				min: 12,
				max: 24,
			},
			{
				art: 'auswahl',
				attribut: 'kette',
				name: 'Kette',
				standard: 'geschlossen',
				optionen: [
					{ wert: 'geschlossen', name: 'Geschlossen' },
					{ wert: 'offen', name: 'Offen, mit Start und Ende' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'je-seite',
				name: 'Steine je Seite',
				standard: '12',
				optionen: ['8', '10', '12', '14', '16'].map((wert) => ({ wert, name: wert })),
			},
			{
				art: 'schalter',
				attribut: 'rueckseite',
				name: 'Nummer auf dem Stein',
				an: 'nummer',
				aus: 'nein',
				standard: false,
			},
		],
		regeln: (w): Fehler => {
			const zeilen = w.zeilen('paare');
			const aufgaben = zeilen.map((z) => z[0] ?? '');
			const loesungen = zeilen.map((z) => z[1] ?? '');
			const doppelt = loesungen.find((l, i) => loesungen.indexOf(l) !== i);
			if (doppelt) {
				return { paare: `Ändere eine der zwei Lösungen „${doppelt}“, sonst ist die Kette nicht eindeutig.` };
			}
			const auchAufgabe = loesungen.find((l) => aufgaben.includes(l));
			return auchAufgabe
				? { paare: `Ändere „${auchAufgabe}“. Es ist zugleich Lösung und Aufgabe, dann ist die Kette nicht eindeutig.` }
				: {};
		},
	},
	'x-spielplan': {
		name: 'Spielplan',
		katalog: {
			kategorie: 'Spiele und Rätsel',
			suchbegriffe: ['Brettspiel', 'Würfelspiel', 'Leiterspiel', 'Laufspiel', 'Spielfeld'],
			ort: 'seite',
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'spiel',
				optionen: [
					{ wert: 'spiel', name: 'Spielplan' },
					{ wert: 'lernlandkarte', name: 'Lernlandkarte' },
				],
				mitnehmen: zieleFuerLernlandkarte,
			},
			{ art: 'zahl', attribut: 'felder', name: 'Felder', min: 20, max: 40, standard: 30 },
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'schlange',
				optionen: [
					{ wert: 'schlange', name: 'Schlange' },
					{ wert: 'spirale', name: 'Spirale' },
					{ wert: 'rundweg', name: 'Rundweg' },
					{ wert: 'leiter', name: 'Leiterspiel' },
				],
			},
			{
				art: 'liste',
				attribut: 'inhalt',
				name: 'Inhalt je Feld',
				hilfe: 'Text, Aufgabe oder Sonderfeld: ?, ★, +3, −2. Eine leere Zeile lässt das Feld frei.',
				unter: [{ name: 'Inhalt', art: 'mini', leer: true }],
				max: 40,
			},
			{
				art: 'liste',
				attribut: 'leitern',
				name: 'Leitern und Rutschen',
				hilfe: 'Von Feld, bis Feld. Führt der Weg zurück, ist es eine Rutsche.',
				unter: [
					{ name: 'Von', art: 'zahl', min: 1, max: 40, standard: '2' },
					{ name: 'Bis', art: 'zahl', min: 1, max: 40, standard: '9' },
				],
				feldTrenner: '-',
			},
			{ art: 'text', attribut: 'start', name: 'Start' },
			{ art: 'text', attribut: 'ziel', name: 'Ziel' },
			{
				art: 'liste',
				attribut: 'loesungen',
				name: 'Kontrollkarte',
				unter: [
					{ name: 'Feld', art: 'zahl', min: 1, max: 40, standard: '2' },
					{ name: 'Lösung', art: 'text', standard: 'Neu' },
				],
				feldTrenner: ': ',
			},
		],
	},
	'x-rhythmus': {
		name: 'Rhythmus',
		katalog: {
			kategorie: 'Musik',
			suchbegriffe: ['Takt', 'Klatschen', 'Notenwerte', 'Rhythmuskarten'],
			ort: 'aufgabe',
			faecher: ['musik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'takt',
				name: 'Takt',
				standard: '4/4',
				optionen: NOTEN_TAKTARTEN,
				mitnehmen: notenFuerTakt,
			},
			{ art: 'noten', attribut: 'noten', name: 'Noten', tonhoehe: false },
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'zeile',
				optionen: [
					{ wert: 'zeile', name: 'Zeile mit mehreren Takten' },
					{ wert: 'karte', name: 'Karte mit einem Takt' },
					{ wert: 'grafisch', name: 'Grafisch: Strich und Punkt' },
				],
			},
			{
				art: 'text',
				attribut: 'silben',
				name: 'Silben',
				beispiel: 'ta',
				hilfe: '„keine“, „ta“ für ta, ti-ti, ta-a oder die Silben der Klasse, mit Leerzeichen getrennt.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'silben', name: 'Silben schreiben' },
					{ wert: 'noten', name: 'Noten schreiben' },
					{ wert: 'ergaenzen', name: 'Note ergänzen' },
				],
			},
			{
				art: 'zahlen',
				attribut: 'offen',
				nurWenn: wenn('aufgabe', 'keine', 'ergaenzen'),
				name: 'Fehlende Noten',
				beispiel: '5',
				hilfe: 'Nummern der Noten zum Ergänzen; ohne Angabe die letzte.',
			},
			{ art: 'schalter', attribut: 'linie', name: 'Rhythmuslinie', an: 'ja', aus: 'nein', standard: false },
			{ art: 'schalter', attribut: 'auftakt', name: 'Mit Auftakt', an: 'ja', aus: 'nein', standard: false },
			{ art: 'zahl', attribut: 'breite', name: 'Breite', min: 120, max: 620, standard: 620, schritt: 20, einheit: 'px', bisZumRand: true },
		],
	},
	'x-noten': {
		name: 'Noten',
		katalog: {
			kategorie: 'Musik',
			suchbegriffe: ['Notenzeile', 'Notensystem', 'Melodie', 'Violinschlüssel', 'Lied'],
			ort: 'aufgabe',
			faecher: ['musik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'takt',
				name: 'Takt',
				standard: '4/4',
				optionen: NOTEN_TAKTARTEN,
				mitnehmen: notenFuerTakt,
			},
			{ art: 'noten', attribut: 'noten', name: 'Noten', tonhoehe: true },
			{ art: 'schalter', attribut: 'namen', name: 'Notennamen darunter', an: 'ja', aus: 'nein', standard: false },
			{
				art: 'text',
				attribut: 'text',
				name: 'Liedtext',
				beispiel: 'Al le mei ne Ent chen',
				hilfe: 'Silben mit Leerzeichen getrennt, eine je Note.',
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'benennen', name: 'Noten benennen' },
					{ wert: 'zeichnen', name: 'Noten zeichnen' },
				],
			},
			{
				art: 'zahl',
				attribut: 'systeme',
				name: 'Leere Zeilen',
				hilfe: 'So viele leere Notenzeilen kommen unter die Noten.',
				min: 0,
				max: 8,
				standard: 0,
			},
			{
				art: 'auswahl',
				attribut: 'vorzeichen',
				name: 'Vorzeichen',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'b', name: 'Ein b (F-Dur)' },
					{ wert: 'kreuz', name: 'Ein Kreuz (G-Dur)' },
				],
			},
			{ art: 'schalter', attribut: 'auftakt', name: 'Mit Auftakt', an: 'ja', aus: 'nein', standard: false },
			{ art: 'zahl', attribut: 'breite', name: 'Breite', min: 200, max: 620, standard: 620, schritt: 20, einheit: 'px', bisZumRand: true },
		],
	},
	'x-plan': {
		name: 'Plan',
		anzeige: 'Lageplan',
		katalog: {
			kategorie: 'Sachunterricht',
			suchbegriffe: ['Plan', 'Lageplan', 'Ortsplan', 'Karte', 'Klassenzimmer', 'Wegbeschreibung'],
			ort: 'aufgabe',
			faecher: ['sachunterricht'],
			// 203-19: Der Starter im Muster nutzt `boden`, das in `abbildungen.js` unter der Karte weiterläuft.
			html:
				'<x-plan spalten="6" zeilen="3" kaestchen="0.9" aufgabe="einzeichnen" ' +
				'objekte="post: B2; spielplatz: E3"></x-plan>',
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Art',
				standard: 'ort',
				optionen: [
					{ wert: 'ort', name: 'Ortsplan' },
					{ wert: 'raum', name: 'Raumplan' },
				],
				// 197-07: Symbole, die es in der neuen Art nicht gibt, fallen weg; ⌘Z holt sie zurück.
				mitnehmen: (w): Werte => {
					const symbole = PLAN_SYMBOLE[w.art ?? 'ort'] ?? [];
					const orte = planObjekteVon(w.objekte ?? null);
					const neu = new Map([...orte].filter(([, name]) => symbole.some((o) => o.wert === name)));
					return neu.size === orte.size ? {} : { objekte: neu.size > 0 ? planObjekteText(neu) : null };
				},
			},
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 26, standard: 6 },
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 30, standard: 5 },
			{
				art: 'plan',
				attribut: 'boden',
				objekte: 'objekte',
				name: 'Plan',
				hilfe: 'Kästchen antippen, dann Fläche und Symbol wählen. Die Legende entsteht von selbst.',
				flaechen: PLAN_FLAECHEN,
				symbole: PLAN_SYMBOLE,
			},
			{
				art: 'auswahl',
				attribut: 'aufgabe',
				name: 'Aufgabe',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'finden', name: 'Planquadrate finden' },
					{ wert: 'einzeichnen', name: 'Symbole einzeichnen' },
					{ wert: 'weg', name: 'Weg einzeichnen' },
				],
			},
			{
				art: 'text',
				attribut: 'weg',
				nurWenn: wenn('aufgabe', 'keine', 'weg'),
				name: 'Weg',
				beispiel: 'A1 A2 B2',
				hilfe: 'Planquadrate von Start bis Ziel.',
			},
			{
				art: 'schalter',
				attribut: 'planquadrate',
				name: 'Planquadrate',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'schalter',
				attribut: 'legende',
				name: 'Legende',
				an: 'ja',
				aus: 'nein',
				standard: true,
				gruppe: 'Mehr',
			},
			{
				art: 'schalter',
				attribut: 'nordpfeil',
				name: 'Nordpfeil',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Mehr',
			},
			{ art: 'text', attribut: 'massstab', name: 'Maßstab', beispiel: '1 Kästchen = 100 m', gruppe: 'Mehr' },
			{
				art: 'zahl',
				attribut: 'kaestchen',
				abschnitt: 'darstellung',
				name: 'Kästchen',
				min: 0.8,
				max: 3,
				standard: 1.2,
				schritt: 0.1,
				einheit: 'cm',
				gruppe: 'Mehr',
			},
		],
		regeln: (w): Fehler => {
			const spalten = w.zahl('spalten');
			const zeilen = w.zahl('zeilen');
			const kaestchen = w.zahl('kaestchen');
			if (spalten * kaestchen * PX_JE_CM + 26 > SATZSPIEGEL) {
				const hoechstensSpalten = Math.max(1, Math.floor((SATZSPIEGEL - 26) / (kaestchen * PX_JE_CM)));
				const hoechstensKaestchen = Math.floor(((SATZSPIEGEL - 26) / (spalten * PX_JE_CM)) * 10) / 10;
				return {
					spalten: `Nimm höchstens ${hoechstensSpalten} Spalten, sonst wird der Plan zu breit für die Seite.`,
					kaestchen:
						hoechstensKaestchen >= 0.8
							? `Nimm für „Kästchen“ höchstens ${zahlMitKomma(hoechstensKaestchen)} cm, sonst wird der Plan zu breit für die Seite.`
							: 'Nimm kleinere Kästchen und weniger Spalten, sonst wird der Plan zu breit für die Seite.',
				};
			}
			const symbole = PLAN_SYMBOLE[w.text('art') ?? 'ort'] ?? [];
			const objekte = planObjekteVon(w.text('objekte'));
			const falsch = [...objekte.values()].find((name) => !symbole.some((o) => o.wert === name));
			if (falsch) {
				return {
					boden: `Nimm ein Symbol dieser Art. „${falsch}“ gibt es hier nicht.`,
					art: `Bei dieser Art gibt es das Symbol „${falsch}“ nicht. Nimm es zuerst aus dem Plan.`,
				};
			}
			const draussen = [...objekte.keys()].find((q) => planLage(q, spalten, zeilen) === null);
			if (draussen) {
				return {
					boden: `Nimm ein Planquadrat im Plan. ${draussen} liegt außerhalb.`,
					spalten: `Nimm mehr Spalten, in ${draussen} steht noch ein Symbol. Oder nimm es zuerst aus dem Plan.`,
					zeilen: `Nimm mehr Zeilen, in ${draussen} steht noch ein Symbol. Oder nimm es zuerst aus dem Plan.`,
				};
			}
			const weg = (w.text('weg') ?? '').split(/\s+/).filter(Boolean);
			if (w.text('aufgabe') !== 'weg') {
				return {};
			}
			const lagen = weg.map((q) => planLage(q, spalten, zeilen));
			if (weg.length < 2 || lagen.some((l) => l === null)) {
				return { weg: 'Gib für den Weg mindestens zwei Planquadrate im Plan an.' };
			}
			const nebeneinander = lagen.every((l, i) => {
				const v = lagen[i - 1];
				return !v || !l || Math.abs(l.x - v.x) + Math.abs(l.y - v.y) === 1;
			});
			return nebeneinander ? {} : { weg: 'Nimm für den Weg Planquadrate, die nebeneinander liegen.' };
		},
	},
	'x-geld': {
		name: 'Geld',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Euro', 'Cent', 'Münzen', 'Scheine', 'Rechengeld'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				// 197-07: „Betrag legen“ bekommt die Summe der Stücke als Betrag.
				mitnehmen: (w): Werte =>
					w.aufgabe === 'legen' && !w.betrag?.trim() ? { betrag: summeDerStuecke(w.stuecke ?? null) } : {},
			},
			{
				art: 'text',
				attribut: 'betrag',
				nurWenn: wenn('aufgabe', 'keine', 'legen'),
				name: 'Betrag zum Legen',
				beispiel: '3,85',
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
				name: 'Maßstab',
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
			w.text('aufgabe') === 'legen' && !w.text('betrag') ? { betrag: 'Trag den Betrag zum Legen ein.' } : {},
	},
	'x-skala': {
		name: 'Messgerät',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Lineal', 'Messbecher', 'Thermometer', 'Waage', 'Maßband', 'Messen'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Gerät',
				standard: 'lineal',
				mitnehmen: skalaFolgt,
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
				nurWenn: (w) => w.art !== 'thermometer',
				name: 'Einheit',
				mitnehmen: skalaFolgt,
				optionenJe: { feld: 'art', werte: SKALA_EINHEITEN },
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
			{
				art: 'paar',
				attribut: 'teilung',
				name: 'Striche',
				trenner: ' ',
				leer: true,
				gruppe: 'Skala',
				teile: [
					{ name: 'Hauptstrich alle', min: 0.1, max: 100_000, standard: 10, komma: true },
					{ name: 'Zwischenstrich alle', min: 0.01, max: 10_000, standard: 1, komma: true },
				],
			},
			{
				art: 'zahl',
				attribut: 'von',
				name: 'Von',
				min: -50,
				max: 10000,
				standard: 0,
				standardJe: (w) => skalaStandard(w)[0],
				automatisch: 'automatisch',
				gruppe: 'Skala',
			},
			{
				art: 'zahl',
				attribut: 'bis',
				name: 'Bis',
				min: -50,
				max: 100000,
				standard: 15,
				standardJe: (w) => skalaStandard(w)[1],
				automatisch: 'automatisch',
				gruppe: 'Skala',
			},
			{
				art: 'auswahl',
				attribut: 'massstab',
				nurWenn: wenn('art', 'lineal', 'lineal'),
				name: 'Lineal',
				gruppe: 'Skala',
				optionen: [
					{ wert: null, name: 'Originalgröße' },
					{ wert: 'nein', name: 'Verkleinert, nicht zum Messen' },
				],
			},
			{
				art: 'zahl',
				nurWenn: (w) => (w.art ?? 'lineal') !== 'lineal' || w.massstab === 'nein',
				...GROESSE,
				min: 120,
				max: 600,
				standard: 240,
				schritt: 20,
				gruppe: 'Skala',
			},
		],
	},
	'x-strecke': {
		name: 'Strecke',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Länge', 'Zentimeter', 'Messen', 'Linie'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'text',
				attribut: 'laenge',
				name: 'Länge',
				beispiel: '7 cm',
				muster: '\\d+([.,]\\d+)? ?(cm|mm)?',
				musterHilfe: 'Zum Beispiel 7 cm oder 45 mm.',
			},
			{
				art: 'text',
				attribut: 'beschriftung',
				name: 'Buchstaben an den Enden',
				beispiel: 'A B',
				// 197-09
				muster: '\\s*\\p{L}\\s+\\p{L}\\s*',
				musterHilfe: 'Zwei Buchstaben, z. B. A B.',
			},
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
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Monat', 'Datum', 'Wochentage', 'Jahr'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
			// 197-11: Monatsnamen statt 1 bis 12; im Blatt bleibt die Zahl.
			{
				art: 'auswahl',
				attribut: 'monat',
				nurWenn: wenn('art', 'monat', 'monat'),
				name: 'Monat',
				standard: '1',
				optionen: MONATE.map((name, i) => ({ wert: String(i + 1), name })),
			},
			{ art: 'zahl', attribut: 'jahr', name: 'Jahr', min: 1900, max: 2100, standard: 2026 },
			{ art: 'raster', attribut: 'markiert', name: 'Markierte Tage', form: true },
			{ art: 'raster', attribut: 'luecken', name: 'Tage ohne Zahl', form: true },
			{ art: 'schalter', attribut: 'kw', name: 'Kalenderwochen', an: 'ja', aus: 'nein', standard: false },
		],
	},
	'x-zeitspanne': {
		name: 'Zeitspanne',
		katalog: {
			kategorie: 'Größen',
			suchbegriffe: ['Dauer', 'Uhrzeit', 'Zeitpunkt', 'von', 'bis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{ art: 'uhrzeit', attribut: 'von', name: 'Von' },
			{ art: 'uhrzeit', attribut: 'bis', name: 'Bis' },
			{
				art: 'text',
				attribut: 'spruenge',
				name: 'Sprünge',
				beispiel: 'bis 9:00, +30 min, +15 min',
				// 197-09
				muster: SPRUNG_MUSTER,
				musterHilfe: 'Sprünge wie „bis 9:00“, „+30 min“ oder „+1 h“, mit Komma getrennt.',
				hilfe: 'Mit Komma getrennt: „bis 9:00“, „+40 min“ oder „+1 h“. Der letzte endet bei „Bis“. Leer: zur vollen Stunde und dann weiter.',
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
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Malfeld', 'Einmaleins', 'Punktebild', 'Multiplikation'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			// 203-02: Der Starter liegt über dem Zahlenraum der kleineren Klassen.
			klassen: [2, 3, 4],
		},
		felder: [
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 10, standard: 5, mitnehmen: linieImPunktfeld },
			{ art: 'zahl', attribut: 'spalten', name: 'Spalten', min: 1, max: 10, standard: 5, mitnehmen: linieImPunktfeld },
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
				mitnehmen: linieImPunktfeld,
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
				fehler.trenner = `Nimm für die Zerlegungslinie eine Zahl von 1 bis ${grenze - 1}.`;
			}
			const frei = w.zahlen('abdecken');
			const [freiZeilen = 0, freiSpalten = 0] = frei;
			const passt = frei.length === 2 && freiZeilen <= w.zahl('zeilen') && freiSpalten <= w.zahl('spalten');
			if (frei.length > 0 && !passt) {
				fehler.abdecken = `Gib zwei Zahlen an: höchstens ${w.zahl('zeilen')} Zeilen und ${w.zahl('spalten')} Spalten.`;
			}
			return fehler;
		},
	},
	'x-malkreuz': {
		name: 'Malkreuz',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Malnehmen', 'Multiplikation', 'halbschriftlich', 'Malkreuz'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			// 203-02: Der Starter liegt über dem Zahlenraum der kleineren Klassen.
			klassen: [3, 4],
		},
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
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['schriftliche', 'Addition', 'Subtraktion', 'Multiplikation', 'Division', 'Übertrag'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			// 203-02: Der Starter liegt über dem Zahlenraum der kleineren Klassen.
			klassen: [3, 4],
		},
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
				// 197-07: Außer bei Plus zwei Zahlen: die ersten zwei, die größere zuerst.
				mitnehmen: (w): Werte => {
					const zahlen = listeVon(w.zahlen ?? null);
					if ((w.art ?? 'plus') === 'plus' || zahlen.length <= 2) {
						return {};
					}
					return { zahlen: zahlen.slice(0, 2).sort((a, b) => alsZahl(b) - alsZahl(a)).join(' ') };
				},
			},
			{ art: 'zahlen', attribut: 'zahlen', name: 'Zahlen', beispiel: '345 278' },
			{
				art: 'auswahl',
				attribut: 'verfahren',
				nurWenn: wenn('art', 'plus', 'minus'),
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
			// 197-15: nur bei einer Fehleraufgabe, direkt unter ihrem Schalter
			{ art: 'mischen', attribut: 'seed', name: 'Fehler', knopf: 'Anderer Fehler', nurWenn: (w) => w.fehlerhaft === 'ja' },
		],
		regeln: (w): Fehler => {
			const art = w.text('art') ?? 'plus';
			const zahlen = w.zahlen('zahlen');
			const [erste = 0, zweite = 0] = zahlen;
			if (zahlen.some((z) => String(z).length > 7)) {
				return { zahlen: 'Nimm Zahlen mit höchstens 7 Stellen.' };
			}
			if (art === 'plus' && (zahlen.length < 2 || zahlen.length > 4)) {
				return {
					zahlen: 'Gib bei Plus 2 bis 4 Zahlen an.',
					art: 'Plus geht mit 2 bis 4 Zahlen. Ändere zuerst die Zahlen.',
				};
			}
			if (art !== 'plus' && zahlen.length !== 2) {
				return {
					zahlen: 'Gib genau 2 Zahlen an.',
					art: 'Diese Rechnung braucht genau 2 Zahlen. Ändere zuerst die Zahlen.',
				};
			}
			if (art === 'minus' && erste < zweite) {
				return {
					zahlen: 'Nimm als erste Zahl die größere.',
					art: 'Bei Minus kommt die größere Zahl zuerst. Ändere zuerst die Zahlen.',
				};
			}
			if (art === 'minus' && !w.text('verfahren')) {
				return { verfahren: 'Wähle das Verfahren, das die Klasse gelernt hat.' };
			}
			if (art === 'geteilt' && (zweite < 2 || zweite > 9)) {
				return {
					zahlen: 'Nimm als zweite Zahl 2 bis 9. Geteilt wird durch eine Ziffer.',
					art: 'Geteilt wird durch 2 bis 9. Ändere zuerst die zweite Zahl.',
				};
			}
			return art === 'mal' && String(zweite).length > 3
				? {
						zahlen: 'Nimm als zweiten Faktor eine Zahl mit höchstens 3 Stellen.',
						art: 'Mal geht mit einem zweiten Faktor bis 3 Stellen. Ändere zuerst die Zahlen.',
					}
				: {};
		},
	},
	'x-zahlenmauer': {
		name: 'Zahlenmauer',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Zahlenmauer rechnen', 'Rechenmauer', 'Zahlenpyramide', 'Mauer'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			anweisung: 'Fülle die Zahlenmauer aus.',
		},
		felder: [
			{ art: 'zahlen', attribut: 'basis', name: 'Unterste Reihe', beispiel: '3 5 2' },
			{ art: 'raster', attribut: 'offen', name: 'Leere Steine', form: true },
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Rechnung',
				standard: 'plus',
				mitnehmen: basisFuerRechnung,
				optionen: [
					{ wert: 'plus', name: 'Plus' },
					{ wert: 'minus', name: 'Minus' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 24, max: 80, standard: 44, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const anzahl = w.zahlen('basis').length;
			return anzahl < 2 || anzahl > 5 ? { basis: 'Gib unten 2 bis 5 Steine an.' } : {};
		},
	},
	'x-rechenreihe': {
		name: 'Rechenreihe',
		anzeige: 'Rechenpäckchen',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenreihe', 'Päckchen', 'Plusaufgaben', 'Minusaufgaben', 'Einmaleins', 'Platzhalter', 'Zehnerübergang'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		generiert: 'aufgaben',
		generiertOhne: ['spalten'],
		felder: [
			{
				art: 'auswahl',
				attribut: 'rechenart',
				name: 'Rechenart',
				standard: '+',
				mitnehmen: rechenreiheNimmt(),
				optionen: [
					{ wert: '+', name: 'Plus' },
					{ wert: '−', name: 'Minus' },
					{ wert: '·', name: 'Mal' },
					{ wert: ':', name: 'Geteilt' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'zahlenraum',
				name: 'Zahlenraum',
				standard: '20',
				mitnehmen: rechenreiheNimmt((w): Werte =>
					w.zahlenraum === '10' && w.uebergang === 'mit' ? { uebergang: null } : {},
				),
				optionen: [
					{ wert: '10', name: 'bis 10' },
					{ wert: '20', name: 'bis 20' },
					{ wert: '100', name: 'bis 100' },
					{ wert: '1000', name: 'bis 1000' },
					{ wert: '1000000', name: 'bis 1 Million' },
				],
				abKlasse: { '100': 2, '1000': 3, '1000000': 4 },
			},
			{ art: 'zahl', attribut: 'anzahl', name: 'Anzahl', min: 1, max: 60, standard: 10 },
			{
				art: 'zahl',
				attribut: 'spalten',
				abschnitt: 'darstellung',
				name: 'Spalten',
				min: 1,
				max: 4,
				standard: 2,
			},
			{
				art: 'auswahl',
				attribut: 'uebergang',
				nurWenn: wenn('rechenart', '+', '+', '−'),
				name: 'Zehnerübergang',
				standard: 'egal',
				mitnehmen: rechenreiheNimmt((w): Werte =>
					w.zahlenraum === '10' && w.uebergang === 'mit' ? { zahlenraum: '20' } : {},
				),
				optionen: [
					{ wert: 'egal', name: 'Egal' },
					{ wert: 'mit', name: 'Mit Übergang' },
					{ wert: 'ohne', name: 'Ohne Übergang' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'platzhalter',
				name: 'Lücke',
				standard: 'ergebnis',
				optionen: [
					{ wert: 'ergebnis', name: 'Beim Ergebnis' },
					{ wert: 'erste', name: 'Erste Zahl' },
					{ wert: 'zweite', name: 'Zweite Zahl' },
					{ wert: 'gemischt', name: 'Gemischt' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'beziehung',
				name: 'Aufgabenpaare',
				standard: 'keine',
				optionen: [
					{ wert: 'keine', name: 'Keine' },
					{ wert: 'tausch', name: 'Tauschaufgaben' },
					{ wert: 'umkehr', name: 'Umkehraufgaben' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'reihe',
				nurWenn: wenn('rechenart', '+', '·', ':'),
				name: 'Einmaleins-Reihe',
				mitnehmen: rechenreiheNimmt(raumFuerReihe),
				optionen: [
					{ wert: null, name: 'Alle' },
					...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((r) => ({
						wert: r,
						name: `${r}er-Reihe`,
					})),
				],
			},
			{
				art: 'schalter',
				attribut: 'rest',
				nurWenn: wenn('rechenart', '+', ':'),
				mitnehmen: rechenreiheNimmt(passendZumRest),
				name: 'Mit Rest',
				an: '1',
				aus: '0',
				standard: false,
			},
			{
				art: 'text',
				attribut: 'aufgaben',
				name: 'Aufgaben',
				zeilen: 4,
				hilfe: 'Je Aufgabe genau ein _. ; trennt die Aufgaben. Die Lösung wird berechnet.',
			},
		],
	},
	'x-rechendreieck': {
		name: 'Rechendreieck',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Zahlendreieck', 'Rechendreieck'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Zerlegen', 'Zerlegungshaus', 'Zahlzerlegung', 'Dach'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'zahl',
				attribut: 'dach',
				name: 'Dach',
				min: 0,
				max: 1000000,
				standard: 7,
				// 197-07: Die Stockwerke gehen mit dem Dach; die erste Zahl bleibt, die zweite ergänzt.
				mitnehmen: (w): Werte => {
					const dach = alsZahl(w.dach ?? '7');
					// 207-N03: Ein Dach wie „7,5“ ist rot; die Stockwerke bleiben dann, wie sie sind (kein „4.5“).
					if (!w.zerlegungen?.trim() || !Number.isInteger(dach)) {
						return {};
					}
					const neu = w.zerlegungen
						.split(';')
						.filter((z) => z.trim())
						.map((z) => {
							const links = Math.min(dach, Math.max(0, alsZahl(z.trim().split(/\s+/)[0] ?? '0') || 0));
							return `${links} ${dach - links}`;
						});
					return { zerlegungen: neu.join('; ') };
				},
			},
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
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenkette', 'Kettenaufgabe', 'Pfeile'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				name: 'Im Blatt steht schon',
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
				name: 'Zeigen als',
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
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['magisches', 'Dreieck', 'Zauberquadrat'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Form',
				standard: 'dreieck',
				mitnehmen: zahlenFuerZauberform,
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
				automatisch: 'ohne',
			},
			{ art: 'raster', attribut: 'vorgegeben', name: 'Vorgegebene Felder', form: true },
			{ art: 'mischen', attribut: 'seed', name: 'Lösung' },
			{ art: 'zahl', ...GROESSE, min: 26, max: 70, standard: 44, schritt: 2 },
		],
	},
	'x-rechenrad': {
		name: 'Rechenrad',
		katalog: {
			kategorie: 'Rechnen',
			suchbegriffe: ['Rechenblume', 'Einmaleins', 'Kreis'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
			// 203-02: Der Starter liegt über dem Zahlenraum der kleineren Klassen.
			klassen: [2, 3, 4],
		},
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
				name: 'Kinder füllen aus',
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
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Würfelgebäude', 'Bauplan', 'Schrägbild', 'räumlich', 'Ansichten'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
		felder: [
			{
				art: 'raster',
				attribut: 'bauplan',
				name: 'Bauplan (Turmhöhen)',
				zahlen: { min: 0, max: 5 },
				wachsen: { spalten: 4, zeilen: 4 },
				hilfe: 'Die unterste Zeile ist vorne.',
			},
			{ art: 'mehrfach', attribut: 'zeige', name: 'Im Blatt steht schon', optionen: WUERFELBAU_TEILE },
			{
				art: 'mehrfach',
				attribut: 'fragen',
				name: 'Gefragt',
				mitnehmen: vorgabeOhneFrage,
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
				abschnitt: 'darstellung',
				name: 'Größe',
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
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Netz', 'Basteln', 'Faltnetz', 'Würfel', 'räumlich'],
			ort: 'seite',
			faecher: ['mathematik'],
		},
		felder: [
			// 197-15: zuerst, was für ein Körper
			{
				art: 'auswahl',
				attribut: 'art',
				name: 'Körper',
				standard: 'wuerfel',
				mitnehmen: masseFuerQuader,
				optionen: [
					{ wert: 'wuerfel', name: 'Würfel' },
					{ wert: 'quader', name: 'Quader' },
				],
			},
			{
				art: 'auswahl',
				attribut: 'netz',
				name: 'Netz',
				standard: '1',
				blaettern: true,
				mitnehmen: aufgabeFuerNetz,
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
				mitnehmen: netzFuerAufgabe,
				optionen: [
					{ wert: 'keine', name: 'Nur zeigen' },
					{ wert: 'netz-oder-nicht', name: 'Netz oder nicht?' },
					{ wert: 'gegenueber', name: 'Gegenüberliegende Fläche' },
					{ wert: 'augen-ergaenzen', name: 'Augen ergänzen' },
				],
			},
			{
				art: 'zahl',
				attribut: 'markiere',
				nurWenn: wenn('aufgabe', 'keine', 'gegenueber'),
				name: 'Markierte Fläche',
				min: 1,
				max: 6,
				standard: 1,
			},
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
				name: 'Zum Ausschneiden',
				an: 'ja',
				aus: 'nein',
				standard: false,
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'zahl',
				attribut: 'kante',
				nurWenn: wenn('bastel', 'nein', 'ja'),
				name: 'Kante',
				min: 1,
				max: 8,
				standard: 4,
				schritt: 0.5,
				einheit: 'cm',
				gruppe: 'Bastelvorlage',
			},
			{
				art: 'zahlen',
				attribut: 'masse',
				nurWenn: wenn('art', 'wuerfel', 'quader'),
				name: 'Maße des Quaders',
				beispiel: '4 2 1',
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 270,
				standard: 0,
				schritt: 90,
				gruppe: 'Mehr',
			},
			{ art: 'zahl', ...GROESSE, min: 16, max: 80, standard: 30, schritt: 2, gruppe: 'Mehr' },
			{
				art: 'mischen',
				attribut: 'seed',
				nurWenn: wenn('aufgabe', 'keine', 'augen-ergaenzen'),
				name: 'Mischung',
				gruppe: 'Mehr',
			},
		],
	},
	'x-koerper': {
		name: 'Körper',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Quader', 'Kugel', 'Pyramide', 'Zylinder', 'Kegel', 'Kanten', 'Ecken'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
			{
				art: 'zahlen',
				attribut: 'masse',
				name: 'Maße',
				beispiel: '4 2 2',
				komma: true,
				hilfe: 'Würfel und Kugel: eine Zahl. Zylinder und Kegel: Durchmesser und Höhe. Sonst: Länge, Breite und Höhe.',
				gruppe: 'Mehr',
			},
			{
				art: 'zahl',
				attribut: 'drehung',
				name: 'Drehung in Grad',
				min: 0,
				max: 359,
				standard: 0,
				schritt: 15,
				gruppe: 'Mehr',
			},
			{ art: 'zahl', ...GROESSE, min: 14, max: 60, standard: 30, schritt: 2, gruppe: 'Mehr' },
		],
	},
	'x-tangram': {
		name: 'Tangram',
		katalog: {
			kategorie: 'Geometrie',
			suchbegriffe: ['Legespiel', 'Formen', 'Puzzle'],
			ort: 'aufgabe',
			faecher: ['mathematik'],
		},
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
				name: 'Im Blatt steht schon',
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
				name: 'Zum Ausschneiden (12 cm)',
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

/** Der Name eines Elements in Ebenen, Pfad, Inspektor und Katalog. */
export const abbildungsName = (tag: string) => {
	const schema = schemaVon(tag);
	return schema ? (schema.anzeige ?? schema.name) : undefined;
};

export const attributeVon = (schema: AbbildungSchema) =>
	schema.felder.flatMap((f) => {
		if (f.art === 'plan') {
			return [f.attribut, f.objekte];
		}
		return f.loesung ? [f.attribut, f.loesung.attribut] : [f.attribut];
	});

// ── Werte lesen und schreiben ───────────────────────────────────────────────

const amInhalt = (schema: AbbildungSchema, a: string) =>
	schema.felder.some((f) => f.attribut === a && f.quelle === 'inhalt');

/** Mit `quelle: 'inhalt'` braucht es die Zerlegung, weil der Wert der Text im Element ist. */
export const werteVon = (schema: AbbildungSchema, k: Knoten, z?: Zerlegung): Werte =>
	Object.fromEntries(
		attributeVon(schema).map((a) => {
			if (amInhalt(schema, a)) {
				const feld = schema.felder.find((f) => f.attribut === a);
				const innen = z ? innenVon(z, k) : '';
				const roh = entschluessele(feld?.auszeichnung ? innen.replace(/<[^>]*>/g, '') : innen).trim();
				return [a, roh === '' ? null : roh];
			}
			return [a, attribut(k, a)?.wert ?? null];
		}),
	);

/** Wert eines Feldes und ob er nur in der Lösung steht; mit beiden Attributen gilt, was `abbildungen.js` zeichnet. */
/**
 * Die Zahlen einer geteilten Lösung („30 6“); leer, wenn dort etwas anderes steht (beim Hunderterfeld kann es ein
 * Malwinkel wie „3x7“ sein, der bleibt unberührt).
 */
const zahlenDerLoesung = (wert: string | null) => {
	const zahlen = listeVon(wert);
	return zahlen.every((z) => /^\d+$/.test(z)) ? zahlen : [];
};

export const feldWert = (feld: Feld, w: Werte): { wert: string | null; nurLoesung: boolean } => {
	const sichtbar = w[feld.attribut] ?? null;
	const teil = feld.loesung?.teil;
	if (feld.loesung?.abgeleitet) {
		return { wert: sichtbar, nurLoesung: (w[feld.loesung.attribut] ?? null) !== null };
	}
	if (teil !== undefined && feld.loesung) {
		const zahlen = zahlenDerLoesung(w[feld.loesung.attribut] ?? null);
		return zahlen.length > 0 ? { wert: zahlen[teil] ?? '0', nurLoesung: true } : { wert: sichtbar, nurLoesung: false };
	}
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
		: [text.slice(0, i).trim(), ...teile(text.slice(i + trenner.length), trenner, anzahl - 1)];
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

export const MINI_ARTEN: Option[] = [
	{ wert: '', name: 'Text' },
	{ wert: 'bild', name: 'Bild' },
	{ wert: 'uhr', name: 'Uhr' },
	{ wert: 'wuerfel', name: 'Würfel' },
	{ wert: 'menge', name: 'Menge' },
	{ wert: 'geld', name: 'Geld' },
	{ wert: 'rhythmus', name: 'Rhythmus' },
];

/** `uhr:7:30` → Art und Wert; ohne bekannte Art ist alles Text. */
export const miniTeile = (wert: string): { art: string; inhalt: string } => {
	const t = /^(uhr|wuerfel|menge|geld|rhythmus|bild):(.*)$/s.exec(wert);
	return t ? { art: t[1] ?? '', inhalt: t[2] ?? '' } : { art: '', inhalt: wert };
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

const LISTEN_SPALTE = ' | ';

/** Eine Liste als Text: eine Zeile je Eintrag, Unterfelder mit ` | ` getrennt. Nur für `alsText`-Listen im Panel. */
export const zeilenAlsText = (feld: ListeFeld, zeilen: string[][]) =>
	zeilen
		.map((z) =>
			feld.unter
				.map((_, j) => z[j] ?? '')
				.join(LISTEN_SPALTE)
				.replace(/( \| )+$/, ''),
		)
		.join('\n');

/** Gegenstück zu `zeilenAlsText`. Leere Zeilen fallen weg; was im Text fehlt, bleibt leer oder kommt aus `standard`. */
export const zeilenAusText = (feld: ListeFeld, text: string) =>
	text
		.split('\n')
		.map((z) => z.trim())
		.filter(Boolean)
		.map((z) => {
			const spalten = z.split('|').map((t) => t.trim());
			return feld.unter.map((u, j) => spalten[j] ?? u.standard ?? '');
		});

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
 * Stellen einer Stellentafel, bleiben die Zahlen rechtsbündig an ihrer Stelle (der Einer bleibt der Einer). Was das Feld
 * sonst braucht, nimmt es per `mitnehmen` mit.
 */
export const aendereFeld = (
	schema: AbbildungSchema,
	w: Werte,
	feld: Feld,
	wert: string | null,
	nurLoesung = feldWert(feld, w).nurLoesung,
): Werte => {
	const neu = { ...w };
	const teil = feld.loesung?.teil;
	if (feld.loesung && teil !== undefined) {
		// Alle Felder mit diesem Lösungs-Attribut wandern zusammen (197-10).
		const lAttr = feld.loesung.attribut;
		const geschwister = schema.felder.filter((f) => f.loesung?.attribut === lAttr && f.loesung.teil !== undefined);
		const zahlen = geschwister.map((f) =>
			f === feld ? (wert ?? '0') : (feldWert(f, w).wert ?? String(f.art === 'zahl' ? f.standard : 0)),
		);
		for (const f of geschwister) {
			neu[f.attribut] = null;
		}
		if (nurLoesung) {
			neu[lAttr] = zahlen.join(' ');
		} else {
			// Ein Malwinkel in der Lösung („3x7“) gehört nicht zu den Plättchen und bleibt.
			neu[lAttr] = zahlenDerLoesung(w[lAttr] ?? null).length > 0 ? null : (w[lAttr] ?? null);
			geschwister.forEach((f, i) => {
				const z = zahlen[i] ?? null;
				neu[f.attribut] = f.art === 'zahl' && z !== null && alsZahl(z) === f.standard ? null : z;
			});
		}
	} else if (feld.loesung?.abgeleitet) {
		neu[feld.attribut] = wert;
		neu[feld.loesung.attribut] = nurLoesung ? feld.loesung.abgeleitet(neu) : null;
	} else if (feld.loesung) {
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
		// 197-07: Fiele vorn eine Ziffer außer 0 weg, bleibt die Tafel, wie sie ist; die Prüfung meldet es am Feld.
		if (jetzt < alt && liste.slice(0, alt - jetzt).some((z) => z !== '' && z !== '0' && z !== '?')) {
			continue;
		}
		// 197-U4: Eine neue Stelle vorn bekommt eine 0, damit die Tafel gezeichnet wird („Bei „T“ fehlt eine Zahl“).
		const vorn = liste.some((z) => z !== '' && z !== '?') ? '0' : '';
		const gerueckt = jetzt > alt ? [...Array<string>(jetzt - alt).fill(vorn), ...liste] : liste.slice(alt - jetzt);
		Object.assign(neu, aendereFeld(schema, neu, f, ziffernText(gerueckt), nur));
	}
	return feld.mitnehmen ? { ...neu, ...feld.mitnehmen(neu, w) } : neu;
};

/** Die Attribute, die sich zwischen zwei Fassungen unterscheiden. */
export const unterschiede = (alt: Werte, neu: Werte) =>
	Object.keys(neu).filter((a) => (alt[a] ?? null) !== (neu[a] ?? null));

// ── Prüfen ──────────────────────────────────────────────────────────────────

/** Wie die Oberfläche Zahlen schreibt: Komma, ab 10 000 mit Tausenderpunkt (207-N03); Jahreszahlen bleiben 2100. */
const zahlText = (n: number) =>
	Math.abs(n) >= 10_000 ? n.toLocaleString('de-DE', { maximumFractionDigits: 6 }) : String(n).replace('.', ',');

const pruefeUnterfeld = (u: UnterFeld, wert: string): string | null => {
	if (wert === '') {
		return u.leer ? null : `Trag „${u.name}“ ein.`;
	}
	if (u.art === 'zahl') {
		const n = alsZahl(wert);
		if (Number.isNaN(n)) {
			return `Schreib bei „${u.name}“ eine Zahl. „${wert}“ ist keine.`;
		}
		if ((u.min !== undefined && n < u.min) || (u.max !== undefined && n > u.max)) {
			return `Nimm für „${u.name}“ eine Zahl von ${u.min ?? ''} bis ${u.max ?? ''}.`;
		}
	}
	if ((u.art === 'auswahl' || u.art === 'muster') && u.optionen && !u.optionen.some((o) => o.wert === wert)) {
		return `Wähle bei „${u.name}“ etwas aus der Liste. „${wert}“ gibt es nicht.`;
	}
	return null;
};

const pruefeListe = (feld: ListeFeld, wert: string | null): string | null => {
	const zeilen = zeilenVon(feld, wert);
	if (wert !== null && feld.min !== undefined && zeilen.length < feld.min) {
		return `Bitte mindestens ${feld.min} ${feld.min === 1 ? 'Zeile' : 'Zeilen'}.`;
	}
	if (feld.max !== undefined && zeilen.length > feld.max) {
		return `Nimm höchstens ${feld.max} Zeilen.`;
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

const pruefeZahl = (feld: ZahlFeld, wert: string | null, klasse?: number) => {
	if (wert === null) {
		return null;
	}
	const n = alsZahl(wert);
	const schritt = feld.schritt ?? 1;
	const ganz = Number.isInteger(schritt);
	const passt = ganz ? Number.isInteger(n) : Math.abs(n / schritt - Math.round(n / schritt)) < 1e-6;
	const max = zahlMax(feld, klasse);
	if (passt && n >= feld.min && n <= max) {
		return null;
	}
	return ganz
		? `Bitte eine ganze Zahl von ${zahlText(feld.min)} bis ${zahlText(max)}.`
		: `Bitte eine Zahl von ${zahlText(feld.min)} bis ${zahlText(max)} in Schritten von ${zahlText(schritt)}.`;
};

const pruefePaar = (feld: PaarFeld, wert: string | null, w: Werte) => {
	if (wert === null) {
		return null;
	}
	const zahlen = paarVon(feld, wert);
	const max = (t: PaarTeil) => Math.min(t.max, Math.max(t.min, t.maxJe?.(w) ?? t.max));
	const falsch = feld.teile.find((t, i) => {
		const n = zahlen[i];
		return n === null || n === undefined || !Number.isFinite(n) || n < t.min || n > max(t) || (!t.komma && !Number.isInteger(n));
	});
	return falsch
		? `Nimm für „${falsch.name}“ ${falsch.komma ? 'eine Zahl' : 'eine ganze Zahl'} von ${zahlText(falsch.min)} bis ${zahlText(max(falsch))}.`
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
		const name = stellen.length === 1 ? 'Stelle' : 'Stellen';
		return `Die Tafel hat nur ${stellen.length} ${name}. Lösch erst die Ziffern vorn oder nimm mehr Stellen.`;
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
		return `Nimm höchstens ${feld.max} Zeichen.`;
	}
	return feld.muster && !new RegExp(`^(?:${feld.muster})$`, 'su').test(wert)
		? (feld.musterHilfe ?? 'Diese Zeichen gehen hier nicht.')
		: null;
};

const pruefeMehrfach = (feld: MehrfachFeld, wert: string | null, w: Werte) => {
	const gewaehlt = listeVon(wert ?? feld.standard?.join(' ') ?? null);
	const optionen = mehrfachOptionen(feld, w);
	const falsch = feld.optionenJe ? undefined : gewaehlt.find((g) => !optionen.some((o) => o.wert === g));
	if (falsch !== undefined) {
		return `„${falsch}“ gibt es hier nicht.`;
	}
	return feld.mindestens !== undefined && gewaehlt.length < feld.mindestens
		? `Bitte mindestens ${feld.mindestens} auswählen.`
		: null;
};

const pruefeFeld = (feld: Feld, w: Werte, klasse?: number): string | null => {
	const { wert } = feldWert(feld, w);
	switch (feld.art) {
		case 'zahl':
			return pruefeZahl(feld, wert, klasse);
		case 'uhrzeit':
			return pruefeUhrzeit(wert);
		case 'schalter':
			return wert === null || wert === feld.an || wert === feld.aus
				? null
				: `Nimm „${feld.an}“ oder „${feld.aus}“.`;
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
			return pruefeMehrfach(feld, wert, w);
		case 'paar':
			return pruefePaar(feld, wert, w);
		case 'zeitspanne': {
			const teile = (wert ?? '').split('-');
			return wert === null || (teile.length === 2 && teile.every((t) => pruefeUhrzeit(t) === null))
				? null
				: 'Bitte zwei Uhrzeiten, von und bis.';
		}
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
			return f?.art === 'zahl' ? zahlStandard(f, w) : 0;
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
/** 197-02: Nur die einzelnen Felder, ohne die Regeln über mehrere Felder. */
export const pruefeFelder = (schema: AbbildungSchema, w: Werte, klasse?: number): Fehler => {
	const fehler: Fehler = {};
	for (const feld of schema.felder) {
		const meldung = pruefeFeld(feld, w, klasse);
		if (meldung) {
			fehler[feld.attribut] = meldung;
		}
	}
	return fehler;
};

export const pruefeWerte = (schema: AbbildungSchema, w: Werte, klasse?: number): Fehler => {
	const fehler = pruefeFelder(schema, w, klasse);
	return Object.keys(fehler).length > 0 || !schema.regeln ? fehler : schema.regeln(leser(schema, w));
};

// ── Befehl ──────────────────────────────────────────────────────────────────

/**
 * Setzt die Attribute einer Abbildung (`null` entfernt eines). Nur diese Attribute ändern sich in der Quelle; die
 * Nummern der Elemente bleiben, die Auswahl auch.
 */
const inhaltFuer = (schema: AbbildungSchema, name: string, altInnen: string, wert: string | null) => {
	const neu = schuetzeText(wert ?? '');
	const mitAuszeichnung = schema.felder.some((f) => f.attribut === name && f.auszeichnung) && altInnen.includes('<');
	return mitAuszeichnung ? uebertrageAuszeichnung(altInnen, neu) : neu;
};

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
					? ersetzeInnen(z, knoten, inhaltFuer(schema, name, innenVon(z, knoten), wert))
					: setzeAttribut(z, knoten, name, wert),
			);
		}
	}
	return { quelle: neu, nr };
};

/** Welche Gruppe des Schemas in welchen Abschnitt des Inspektors gehört; ein Test prüft, dass keine fehlt. */
export const GRUPPEN_ABSCHNITT: Readonly<Record<string, AbschnittName>> = {
	'Aufgabe': 'inhalt',
	'Einfach': 'inhalt',
	'Figur': 'inhalt',
	'Listen': 'inhalt',
	'Lücken': 'inhalt',
	'Markierung': 'inhalt',
	'Raster': 'inhalt',
	'Bastelvorlage': 'darstellung',
	'Gitter': 'inhalt',
	'Maße': 'darstellung',
	'Skala': 'darstellung',
	'Mehr': 'weitere',
};

const DARSTELLUNG = new Set([
	'anordnung',
	'ansicht',
	'beschriftung',
	'breite',
	'darstellung',
	'drehung',
	'groesse',
	'je-seite',
	'kaestchen',
	'legende',
	'lineatur',
	'linien',
	'massstab',
	'projektion',
	'rahmen',
	'schrift',
	'ziffern',
]);

/** Ohne Gruppe entscheidet das Attribut: Größe, Rahmen und Ansicht sind Darstellung, alles andere ist Inhalt. */
export const abschnittVon = (feld: Feld): AbschnittName => {
	if (feld.abschnitt) {
		return feld.abschnitt;
	}
	if (feld.gruppe) {
		return GRUPPEN_ABSCHNITT[feld.gruppe] ?? 'darstellung';
	}
	if (feld.attribut === 'loesung') {
		return 'loesung';
	}
	return DARSTELLUNG.has(feld.attribut) ? 'darstellung' : 'inhalt';
};
