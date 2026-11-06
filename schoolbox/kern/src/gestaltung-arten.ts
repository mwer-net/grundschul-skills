/**
 * Die Arten der Gestaltung (Phase 12, Entscheidungen 41 und 45): alles, was frei auf der Seite liegt
 * (`data-lage="frei"`), dazu die Behälter und Flächen, in denen es liegt. Alle Arten bis E5 stehen schon hier, auch wenn
 * es sie in der Oberfläche noch nicht gibt. Spätere Tickets ändern nur ihre eigene Zeile. Das Register in
 * `bausteine.ts` übernimmt die Einträge so, wie sie hier stehen, direkt hinter `aufgabe`. Die Tabelle in
 * `references/gestaltung.md` erzeugt `quellen.ts` aus dieser Liste.
 */

import type { Baustein, Faehigkeit } from './bausteine';

/** Wie die Griffe an den Ecken und Kanten die Größe ändern. */
export type Groesse =
	/** Ecken halten das Seitenverhältnis. */
	| 'proportional'
	| 'frei'
	/** Ecke skaliert die Schrift, Kante die Breite. */
	| 'text'
	/** Nur die Breite, die Höhe kommt aus dem Inhalt. */
	| 'breite';

export type EbenenName = 'hinten' | 'vorne';

export const EBENEN: readonly EbenenName[] = ['hinten', 'vorne'];

/** Etappe der Phase 12, in der die Art in die Oberfläche kommt. Nur zur Doku. */
export type Etappe = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';

export interface GestaltungArt extends Baustein {
	/** Nur mit `lage`. */
	groesse?: Groesse;
	/** Nur mit `lage`: wohin ein neues Element dieser Art kommt. */
	ebene?: EbenenName;
	ab: Etappe;
}

/** Das Attribut, das ein Gestaltungselement ausmacht. Nie `…Frei…` im Namen: `frei` heißt in `bausteine.ts` etwas anderes (054). */
export const LAGE = 'data-lage';
export const GESTALTUNG_SELEKTOR = `[${LAGE}="frei"]`;

/**
 * Woran Gestaltung mit `data-anker` hängen kann: die Aufgaben und alles, was direkt auf der Seite im Fluss liegt.
 * `blatt.css` (091) schreibt denselben Selektor, ein Test vergleicht beides. Absichtlich keine Fähigkeit im Register.
 */
export const ANKER_SELEKTOR = '.aufgabe, .seite > :not(.ebene)';

/**
 * Druckrand in px (5 mm, Briefing 4.1): Was mit Text oder Bild hineinragt, meldet die Prüfung als `druckrand` (096).
 * `pruefung.js` schreibt denselben Wert, ein Test vergleicht beides.
 */
export const DRUCKRAND = 19;

/** Was jedes Gestaltungselement kann (Briefing 3.12). */
const LAGE_GRUND = ['lage', 'duplizieren', 'loeschen', 'loesung'] as const satisfies readonly Faehigkeit[];

const liegend = (
	art: string,
	name: string,
	selektor: string,
	zusatz: readonly Faehigkeit[],
	groesse: Groesse,
	ebene: EbenenName,
	ab: Etappe,
): GestaltungArt => ({
	art,
	name,
	selektor: `${selektor}${GESTALTUNG_SELEKTOR}`,
	faehigkeiten: [...LAGE_GRUND, ...zusatz],
	groesse,
	ebene,
	ab,
});

export const GESTALTUNG_ARTEN: readonly GestaltungArt[] = [
	// Feste Einträge zuerst: Sie sind keine Rahmen frei gestalteten Materials (054), auch wenn sie nur Blöcke enthalten.
	{ art: 'ebene', name: 'Ebene', selektor: '.ebene', faehigkeiten: [], ab: 'E1' },
	{ art: 'seitenflaeche', name: 'Seitenfläche', selektor: '.seitenflaeche', faehigkeiten: ['fuellung'], ab: 'E1' },
	{ art: 'seitenrahmen', name: 'Seitenrahmen', selektor: '.seitenrahmen', faehigkeiten: ['fuellung'], ab: 'E1' },
	{
		art: 'flaeche',
		name: 'Fläche',
		selektor: '.flaeche',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen', 'hoehe'],
		ordnenIn: '.seite',
		ab: 'E4',
	},
	liegend('bildfrei', 'Bild', 'img.bild-frei', ['bild'], 'proportional', 'vorne', 'E2'),
	liegend('figurfrei', 'Figur', 'img.figur-frei', ['bild'], 'proportional', 'vorne', 'E2'),
	liegend('form', 'Form', 'svg.form', ['fuellung'], 'frei', 'vorne', 'E2'),
	liegend('formtext', 'Form mit Text', '.form-text', ['fuellung', 'text'], 'frei', 'vorne', 'E2'),
	liegend('schmuck', 'Schmuckschrift', 'div.schmuck', ['fuellung', 'text'], 'text', 'vorne', 'E2'),
	liegend('schmuckbogen', 'Titel im Bogen', 'svg.schmuck', ['fuellung'], 'proportional', 'vorne', 'E3'),
	liegend('streuung', 'Streuung', 'svg.streuung', ['fuellung'], 'frei', 'hinten', 'E3'),
	liegend('gruppe', 'Gruppe', '.gruppe', [], 'frei', 'vorne', 'E4'),
	liegend('stapel', 'Stapel', '.stapel', ['fuellung'], 'breite', 'vorne', 'E5'),
	// Der Rückfall zuletzt: alles Freie, auch was Claude gebaut hat (`[data-frei]` mit `data-lage`, 117).
	liegend('gestaltung', 'Gestaltung', '', [], 'frei', 'vorne', 'E2'),
];

export const gestaltungArtNach = (art: string) => GESTALTUNG_ARTEN.find((a) => a.art === art);

/** Aus `data-figur`: `wilma` → „Wilma“, `willi-winkt` → „Willi winkt“. */
const figurName = (wert: string) => {
	const text = wert.trim().replace(/[-_]+/g, ' ');
	return text ? `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}` : '';
};

/**
 * Der Name eines Gestaltungselements in Ebenen und Pfad: `data-name`, sonst die Figur aus `data-figur`, sonst der Name
 * der Art. `null` für alles, was kein Gestaltungselement ist; dann gilt der Name aus dem Register.
 */
export const nameDerGestaltung = (baustein: Baustein, wert: (name: string) => string | null): string | null => {
	if (!baustein.faehigkeiten.includes('lage')) {
		return null;
	}
	return wert('data-name')?.trim() || figurName(wert('data-figur') ?? '') || baustein.name;
};
