/**
 * Typ eines Rezepts (Oberfläche) bzw. einer Aufmachung (Code), Briefing 03-modell.md 3.10 und schubladen/7-rezepte.md.
 * Nur Typen und Konstanten, damit `quellen.ts` die Tabelle ohne den Rest des Kerns erzeugen kann.
 */

import type { RahmenArt } from '../seitengestaltung';
import type { Ecke, StreuArt, StreuForm, StreuGroesse, Zone } from '../streuen';

/** Formate mit Rezepten; das Minibuch hat keine (4.8). */
export const AUFMACHUNG_FORMATE = ['a4-hoch', 'a4-quer', 'a5-hoch', 'a3-hoch', 'folie'] as const;
export type AufmachungsFormat = (typeof AUFMACHUNG_FORMATE)[number];

/** Seitenmaße in px wie in `blatt.css`, für die Zonen. */
export const SEITEN_MASSE: Readonly<Record<AufmachungsFormat, { b: number; h: number }>> = {
	'a4-hoch': { b: 794, h: 1123 },
	'a4-quer': { b: 1123, h: 794 },
	'a5-hoch': { b: 559, h: 794 },
	'a3-hoch': { b: 1123, h: 1587 },
	'folie': { b: 1280, h: 720 },
};

export const KOPFBAENDER = ['ohne', 'gerade', 'welle', 'bogen', 'zacken'] as const;
export type Kopfband = (typeof KOPFBAENDER)[number];

export const AUFMACHUNG_RAHMEN = ['ohne', 'linie', 'gestrichelt', 'gepunktet', 'doppelt'] as const satisfies readonly (
	'ohne' | RahmenArt
)[];
export type AufmachungsRahmen = (typeof AUFMACHUNG_RAHMEN)[number];

/** Formen, die der Regler „Konfetti“ anbietet (7-rezepte.md, Regler). */
export const KONFETTI_FORMEN = ['punkt', 'dreieck', 'raute', 'stern'] as const satisfies readonly StreuForm[];
export type KonfettiForm = (typeof KONFETTI_FORMEN)[number];

/** Eine Farbwelt: Werte für `--a1` … `--a4`, `--a-flaeche`, `--a-titel`, alle als Hex. */
export interface Farbwelt {
	name: string;
	a1: string;
	a2: string;
	a3: string;
	a4: string;
	aFlaeche: string;
	/** Titel auf dem Kopfband. */
	aTitel: string;
	/** Titel ohne Kopfband (Regler „ohne“, Thema mit eigenem Kopf): `--a-titel` nimmt dann diesen Wert. */
	aTitelOhneBand: string;
	/** Zweite Farbe eines Musters der Seitenfläche (Streifen auf dem Deckblatt). */
	aMuster: string;
}

export interface Konfetti {
	/** 0–1; 0 heißt: keine Streuung. */
	menge: number;
	formen: readonly KonfettiForm[];
}

/** Stände der Regler; `farben` ist die Nummer der Farbwelt (1–3). */
export interface Regler {
	farben: 1 | 2 | 3;
	kopfband: Kopfband;
	rahmen: AufmachungsRahmen;
	konfetti: Konfetti;
}

/** Was am `body` steht. */
export interface AufmachungWerte extends Regler {
	id: string;
	saat: number;
}

/** Eine Streuung des Rezepts: Rechtecke in px vom Blattrand. */
export interface StreuZone {
	/** Ein Rechteck: Die Streuung ist genau so groß. Mehrere: Sie reicht über alle, mit `data-zonen`. */
	rechtecke: readonly Zone[];
	art: StreuArt;
	formen: readonly StreuForm[];
	/** 0–1 beim Standard der Menge; der Regler „Konfetti“ skaliert sie. */
	dichte: number;
	/** Namen aus `STREU_FARBEN`, Standard `a1 a2 a3 a4`. */
	farben?: readonly string[];
	groesse?: StreuGroesse;
	ecke?: Ecke;
}

interface MusterFlaeche {
	art: 'muster';
	muster: 'streifen' | 'punkte' | 'karo' | 'schraeg';
	f1: string;
	f2: string;
	musterGroesse: number;
}

/** Fläche des Rezepts; Farben als `var(--a-…)` oder Hex. */
export type AufmachungsFlaeche = { art: 'farbe'; f1: string } | MusterFlaeche;

/** Rahmen des Rezepts; die Art kommt vom Regler. */
export interface AufmachungsRahmenWerte {
	farbe: string;
	staerke: number;
	abstand: number;
	ecke: number;
}

/** Maße des Kopfbands in px; ohne Angabe gelten die Standards je Format aus `blatt.css`. */
export interface KopfbandMasse {
	/** Wie weit das Band unter den Kopf reicht. */
	unten?: number;
	/** Höhe der Kante (Welle, Bogen, Zacken). */
	kante?: number;
	/** Breite einer Welle bzw. eines Zackens. */
	welle?: number;
}

export interface FormatDaten {
	flaeche: (istDeckblatt: boolean) => AufmachungsFlaeche | null;
	rahmen: AufmachungsRahmenWerte;
	zonen: (istDeckblatt: boolean) => readonly StreuZone[];
	kopfband?: KopfbandMasse;
}

export interface Aufmachung {
	/** Kleinbuchstaben, steht als `data-aufmachung` am `body`. */
	id: string;
	name: string;
	beschreibung: string;
	farbwelten: readonly [Farbwelt, Farbwelt, Farbwelt];
	/** Standards der Regler. */
	standard: Regler;
	formate: Readonly<Record<AufmachungsFormat, FormatDaten>>;
}
