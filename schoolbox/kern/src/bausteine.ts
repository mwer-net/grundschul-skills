/**
 * Baustein-Register: welche Teile des Materials der Editor kennt und was sich mit ihnen tun lässt. Editor, Server und
 * „Claude fragen“ benutzen dieselben Namen. Ein neuer Baustein ist ein neuer Eintrag, kein neuer Code. Die Reihenfolge
 * zählt: Passt ein Element auf mehrere Einträge, gilt der erste.
 */

import type { Abbildung } from './abbildungen';
import { ABBILDUNG_SCHEMA } from './abbildungen';

export const FAEHIGKEITEN = [
	/** Ziehen innerhalb des Elternelements bzw. der Seite (016). */
	'ordnen',
	'duplizieren',
	'loeschen',
	/** Neue Bausteine dieser Art anlegen, z. B. eine leere Seite (016). */
	'hinzufuegen',
	/** Text anklicken und tippen (015). */
	'text',
	/** Bild tauschen und skalieren (017). */
	'bild',
	/** Einstellungen im Abbildungs-Panel (018). */
	'abbildung',
	/** Spalten −/+ (016). */
	'spalten',
	/** Richtige Antwort einer Antwortlinie, `data-l` (019). */
	'loesung',
	/** „Als Beispiel zeigen“: Lösung schon auf dem Arbeitsblatt, `class="beispiel"` (019). */
	'beispiel',
] as const;

export type Faehigkeit = (typeof FAEHIGKEITEN)[number];

/**
 * Was Enter in einem Textträger tut: `eine` beendet die Bearbeitung (Überschrift, Anweisung), `umbruch` setzt ein
 * `<br>` (Sprechblase), `absatz` teilt das Element in zwei gleiche (Absatz, Listenpunkt).
 */
export type Zeilen = 'eine' | 'umbruch' | 'absatz';

export interface Baustein {
	/** Kennung für Code und Tests. */
	art: string;
	/** Für die Lehrkraft, z. B. in der Breadcrumb: „Aufgabe 2“. */
	name: string;
	/** CSS-Selektor; in der Darstellung mit `Element.matches` geprüft. */
	selektor: string;
	faehigkeiten: readonly Faehigkeit[];
	/** Mit Nummer: die wievielte ihrer Art innerhalb des umgebenden Bausteins. */
	zaehlen?: boolean;
	/** Ein Element, das zusätzlich hierauf passt, heißt so (z. B. die Sternchenaufgabe) und zählt für sich. */
	sonderfall?: { selektor: string; name: string; art: string };
	/** Nur mit `text`: was Enter tut; ohne Angabe `eine`. */
	zeilen?: Zeilen;
	/** Nur mit `ordnen`: Ziehen auch in andere Elemente dieses Selektors, sonst nur innerhalb des Elternelements. */
	ordnenIn?: string;
	/** Nur mit `ordnen`: Ziehen in der Seitenleiste statt im Blatt, weil der Baustein größer ist als der Bildschirm. */
	ordnenInLeiste?: boolean;
	/** Nur mit `spalten`: was ohne `--spalten` gilt (wie in blatt.css). */
	spaltenStandard?: number;
}

/** Die eigenen Elemente aus `abbildungen.js`; ihren Inhalt zeichnet erst der Browser. */
export const ABBILDUNGEN = Object.keys(ABBILDUNG_SCHEMA) as Abbildung[];

/**
 * Teile eines Textträgers, die beim Tippen unverändert bleiben: Nummern, Niveau-Punkte, Antwortlinien und
 * Lösungen (019), Abbildungen (018), Bilder (017). Sie lassen sich weder ändern noch löschen.
 */
export const GESCHUETZT = [
	'.nr',
	'.niveau',
	'.antwort',
	'.leerstelle',
	'.loesung-marke',
	'.box',
	'.nur-loesung',
	'.nicht-loesung',
	'[data-l]',
	'img',
	'svg',
	'math',
	...ABBILDUNGEN,
].join(', ');

export const BAUSTEINE: readonly Baustein[] = [
	{
		art: 'seite',
		name: 'Seite',
		selektor: '.seite',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen', 'hinzufuegen'],
		zaehlen: true,
		ordnenInLeiste: true,
	},
	{
		art: 'aufgabe',
		name: 'Aufgabe',
		selektor: '.aufgabe',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
		zaehlen: true,
		sonderfall: { selektor: '.aufgabe:has(> .nr.stern)', name: 'Sternchenaufgabe', art: 'sternchenaufgabe' },
		ordnenIn: '.seite',
	},
	{ art: 'reihe', name: 'Reihe', selektor: '.reihe', faehigkeiten: ['spalten'], spaltenStandard: 3 },
	{ art: 'karten', name: 'Kartenbogen', selektor: '.karten', faehigkeiten: ['spalten'], spaltenStandard: 2 },
	{
		art: 'item',
		name: 'Item',
		selektor: '.reihe > .zelle',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen', 'beispiel'],
		zaehlen: true,
	},
	{
		art: 'karte',
		name: 'Karte',
		selektor: '.karten > .karte',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
		zaehlen: true,
	},
	{
		art: 'vermutung',
		name: 'Antwort',
		selektor: '.vermutung',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen', 'text'],
		zaehlen: true,
	},
	{ art: 'tipp', name: 'Tipp', selektor: '.tipp', faehigkeiten: [] },
	{ art: 'figur', name: 'Leitfigur', selektor: 'img.figur', faehigkeiten: ['bild'] },
	{ art: 'bild', name: 'Bild', selektor: 'img', faehigkeiten: ['bild'] },
	{ art: 'abbildung', name: 'Abbildung', selektor: ABBILDUNGEN.join(', '), faehigkeiten: ['abbildung'] },
	// Nur in der Lösungsansicht wählbar: Auf dem Arbeitsblatt ist die Linie leer und der Lösungstext unsichtbar.
	{ art: 'antwort', name: 'Antwortlinie', selektor: 'body.loesung .antwort', faehigkeiten: ['loesung'] },
	{ art: 'loesungstext', name: 'Lösungstext', selektor: 'body.loesung .nur-loesung', faehigkeiten: ['text'] },
	{ art: 'ueberschrift', name: 'Überschrift', selektor: 'h1, h2, h3', faehigkeiten: ['text'] },
	{ art: 'ziel', name: 'Lernziel', selektor: '.ziel', faehigkeiten: ['text'] },
	{ art: 'wahlhilfe', name: 'Wahlhilfe', selektor: '.wahlhilfe', faehigkeiten: ['text'] },
	{ art: 'anweisung', name: 'Anweisung', selektor: '.anw .text', faehigkeiten: ['text'] },
	{ art: 'blase', name: 'Sprechblase', selektor: '.blase', faehigkeiten: ['text'], zeilen: 'umbruch' },
	{ art: 'kartentext', name: 'Kartentext', selektor: '.kartentext', faehigkeiten: ['text'] },
	{ art: 'platzhalter', name: 'Bildplatzhalter', selektor: '.platzhalter', faehigkeiten: ['bild'] },
	{ art: 'notiz', name: 'Notiz', selektor: '.notiz', faehigkeiten: [] },
	{ art: 'absatz', name: 'Absatz', selektor: 'p, li', faehigkeiten: ['text'], zeilen: 'absatz' },
];

export const bausteinNach = (art: string) => BAUSTEINE.find((b) => b.art === art);

export const kann = (baustein: Baustein, faehigkeit: Faehigkeit) => baustein.faehigkeiten.includes(faehigkeit);

export const zeilenVon = (baustein: Baustein): Zeilen => baustein.zeilen ?? 'eine';
