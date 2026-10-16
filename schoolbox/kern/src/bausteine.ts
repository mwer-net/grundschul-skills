/**
 * Baustein-Register: welche Teile des Materials der Editor kennt und was sich mit ihnen tun lässt. Editor, Server und
 * „Claude fragen“ benutzen dieselben Namen. Ein neuer Baustein ist ein neuer Eintrag, kein neuer Code. Die Reihenfolge
 * zählt: Passt ein Element auf mehrere Einträge, gilt der erste.
 */

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
] as const;

export type Faehigkeit = (typeof FAEHIGKEITEN)[number];

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
	/** Ein Element, das zusätzlich hierauf passt, heißt so (z. B. die Sternchenaufgabe). */
	sonderfall?: { selektor: string; name: string };
}

/** Die eigenen Elemente aus `abbildungen.js`; ihren Inhalt zeichnet erst der Browser. */
export const ABBILDUNGEN = [
	'x-uhr',
	'x-menge',
	'x-dienes',
	'x-strichpunkt',
	'x-stellentafel',
	'x-zwanzigerfeld',
	'x-zahlenstrahl',
	'x-timer',
] as const;

export const BAUSTEINE: readonly Baustein[] = [
	{
		art: 'seite',
		name: 'Seite',
		selektor: '.seite',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen', 'hinzufuegen'],
		zaehlen: true,
	},
	{
		art: 'aufgabe',
		name: 'Aufgabe',
		selektor: '.aufgabe',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
		zaehlen: true,
		sonderfall: { selektor: '.aufgabe:has(> .nr.stern)', name: 'Sternchenaufgabe' },
	},
	{ art: 'reihe', name: 'Reihe', selektor: '.reihe', faehigkeiten: ['spalten'] },
	{ art: 'karten', name: 'Kartenbogen', selektor: '.karten', faehigkeiten: ['spalten'] },
	{
		art: 'item',
		name: 'Item',
		selektor: '.reihe > .zelle',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
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
	{ art: 'ueberschrift', name: 'Überschrift', selektor: 'h1, h2, h3', faehigkeiten: ['text'] },
	{ art: 'ziel', name: 'Lernziel', selektor: '.ziel', faehigkeiten: ['text'] },
	{ art: 'wahlhilfe', name: 'Wahlhilfe', selektor: '.wahlhilfe', faehigkeiten: ['text'] },
	{ art: 'anweisung', name: 'Anweisung', selektor: '.anw .text', faehigkeiten: ['text'] },
	{ art: 'blase', name: 'Sprechblase', selektor: '.blase', faehigkeiten: ['text'] },
	{ art: 'kartentext', name: 'Kartentext', selektor: '.kartentext', faehigkeiten: ['text'] },
	{ art: 'platzhalter', name: 'Bildplatzhalter', selektor: '.platzhalter', faehigkeiten: ['bild'] },
	{ art: 'notiz', name: 'Notiz', selektor: '.notiz', faehigkeiten: [] },
	{ art: 'absatz', name: 'Absatz', selektor: 'p, li', faehigkeiten: ['text'] },
];

export const bausteinNach = (art: string) => BAUSTEINE.find((b) => b.art === art);

export const kann = (baustein: Baustein, faehigkeit: Faehigkeit) => baustein.faehigkeiten.includes(faehigkeit);
