/**
 * Baustein-Register: welche Teile des Materials der Editor kennt und was sich mit ihnen tun lässt. Editor, Server und
 * „Claude fragen“ benutzen dieselben Namen. Ein neuer Baustein ist ein neuer Eintrag, kein neuer Code. Die Reihenfolge
 * zählt: Passt ein Element auf mehrere Einträge, gilt der erste.
 */

import type { Abbildung, KatalogAngaben } from './abbildungen';
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
	/** Nur mit `ordnen`: Verschieben über ↑ ↓ im Panel; Ziehen bleibt dem umgebenden Baustein (046). */
	ordnenNurKnopf?: boolean;
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

/** Das Mindeste für alles aus dem Katalog (046). Gezogen wird weiter der umgebende Baustein, sonst griffe man daneben. */
const KLEIN = { ordnenNurKnopf: true } as const;
const GRUND = ['ordnen', 'duplizieren', 'loeschen'] as const;

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
	{ art: 'tabelle', name: 'Tabelle', selektor: 'table.kit-tabelle', faehigkeiten: GRUND, ...KLEIN },
	{
		art: 'tabellenzeile',
		name: 'Zeile',
		selektor: 'table.kit-tabelle tbody tr',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
		zaehlen: true,
	},
	{
		art: 'tabellenzelle',
		name: 'Zelle',
		selektor: 'table.kit-tabelle th, table.kit-tabelle td',
		faehigkeiten: ['text'],
	},
	{ art: 'namenszeile', name: 'Namenszeile', selektor: '.namenszeile', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'kopf', name: 'Kopf', selektor: '.kopf', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'fuss', name: 'Fuß', selektor: '.fuss', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'reflexion', name: 'Reflexion', selektor: '.reflexion', faehigkeiten: GRUND, ...KLEIN },
	{
		art: 'reihe',
		name: 'Reihe',
		selektor: '.reihe',
		faehigkeiten: [...GRUND, 'spalten'],
		spaltenStandard: 3,
		...KLEIN,
	},
	{
		art: 'karten',
		name: 'Kartenbogen',
		selektor: '.karten',
		faehigkeiten: [...GRUND, 'spalten'],
		spaltenStandard: 2,
		...KLEIN,
	},
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
	{ art: 'tipp', name: 'Tipp', selektor: '.tipp', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'figur', name: 'Leitfigur', selektor: 'img.figur', faehigkeiten: [...GRUND, 'bild'], ...KLEIN },
	{ art: 'bild', name: 'Bild', selektor: 'img', faehigkeiten: [...GRUND, 'bild'], ...KLEIN },
	{
		art: 'abbildung',
		name: 'Abbildung',
		selektor: ABBILDUNGEN.join(', '),
		faehigkeiten: [...GRUND, 'abbildung'],
		...KLEIN,
	},
	// Den Lösungstext ändern geht nur in der Lösungsansicht (loesung.ts): Auf dem Arbeitsblatt ist die Linie leer.
	{ art: 'antwort', name: 'Antwortlinie', selektor: '.antwort', faehigkeiten: [...GRUND, 'loesung'], ...KLEIN },
	{ art: 'box', name: 'Kästchen', selektor: '.box', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'punkte', name: 'Punkte', selektor: '.punkte', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'schreiblinie', name: 'Schreiblinie', selektor: '.schreiblinie', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'malfeld', name: 'Malfeld', selektor: '.malfeld', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'leerstelle', name: 'Leerstelle', selektor: '.leerstelle', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'loesungstext', name: 'Lösungstext', selektor: 'body.loesung .nur-loesung', faehigkeiten: ['text'] },
	{ art: 'ueberschrift', name: 'Überschrift', selektor: 'h1, h2, h3', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'ziel', name: 'Lernziel', selektor: '.ziel', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'wahlhilfe', name: 'Wahlhilfe', selektor: '.wahlhilfe', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'anweisung', name: 'Anweisung', selektor: '.anw .text', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{
		art: 'blase',
		name: 'Sprechblase',
		selektor: '.blase',
		faehigkeiten: [...GRUND, 'text'],
		zeilen: 'umbruch',
		...KLEIN,
	},
	{ art: 'kartentext', name: 'Kartentext', selektor: '.kartentext', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{
		art: 'platzhalter',
		name: 'Bildplatzhalter',
		selektor: '.platzhalter',
		faehigkeiten: [...GRUND, 'bild'],
		...KLEIN,
	},
	{ art: 'notiz', name: 'Notiz', selektor: '.notiz', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'absatz', name: 'Absatz', selektor: 'p, li', faehigkeiten: [...GRUND, 'text'], zeilen: 'absatz', ...KLEIN },
	{ art: 'zeile', name: 'Rechenzeile', selektor: '.zeile', faehigkeiten: GRUND, ...KLEIN },
];

export const bausteinNach = (art: string) => BAUSTEINE.find((b) => b.art === art);

export const kann = (baustein: Baustein, faehigkeit: Faehigkeit) => baustein.faehigkeiten.includes(faehigkeit);

/** Im Mini-Book steht die Zahl der Seiten fest: Sie lassen sich ordnen, aber nicht vermehren oder löschen. */
export const kannImFormat = (baustein: Baustein, faehigkeit: Faehigkeit, format: string | undefined) =>
	kann(baustein, faehigkeit) && !(format === 'minibuch' && baustein.art === 'seite' && faehigkeit !== 'ordnen');

export const zeilenVon = (baustein: Baustein): Zeilen => baustein.zeilen ?? 'eine';

export interface KitEintrag extends KatalogAngaben {
	id: string;
	/** Name und Fähigkeiten stehen im Register, wenn der Baustein dort steht. */
	art?: string;
	/** Nur ohne Register-Eintrag. */
	name?: string;
	/** Kein eigenes Element, sondern eine Klasse am `<body>` (`ort: 'blatt'`) oder am gewählten Item (`ort: 'zeile'`). */
	klasse?: string;
}

/** Die Kit-Bausteine für den Katalog (`katalog.ts`). Starter stehen in `assets/muster/bausteine.html` (`data-katalog`). */
export const KIT_KATALOG: readonly KitEintrag[] = [
	{
		id: 'namenszeile',
		name: 'Namenszeile',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Name', 'Datum'],
		ort: 'seite',
	},
	{ id: 'kopf', name: 'Kopf', kategorie: 'Kopf und Rahmen', suchbegriffe: ['Titel', 'Überschrift'], ort: 'seite' },
	{
		id: 'ziel',
		art: 'ziel',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Ich-kann-Ziel', 'Lernziel'],
		ort: 'zeile',
	},
	{
		id: 'wahlhilfe',
		art: 'wahlhilfe',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Niveau', 'Wählen'],
		ort: 'zeile',
	},
	{
		id: 'fuss',
		name: 'Fuß',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Selbsteinschätzung', 'Wachstum'],
		ort: 'seite',
	},
	{
		id: 'reflexion',
		name: 'Reflexion',
		kategorie: 'Selbstkontrolle',
		suchbegriffe: ['Was hat dir geholfen'],
		ort: 'zeile',
	},
	{
		id: 'trenner',
		name: 'Trennlinien',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Linie', 'Trennung'],
		ort: 'blatt',
		klasse: 'trenner',
	},
	{
		id: 'aufgabe',
		art: 'aufgabe',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Nummer', 'Aufgabenblock'],
		ort: 'seite',
	},
	{
		id: 'anweisung',
		art: 'anweisung',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Arbeitsauftrag'],
		ort: 'zeile',
	},
	{ id: 'text', art: 'absatz', kategorie: 'Aufgabe und Text', suchbegriffe: ['Absatz', 'Fließtext'], ort: 'aufgabe' },
	{
		id: 'tabelle',
		art: 'tabelle',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Raster', 'Spalten', 'Zeilen', 'Übersicht'],
		ort: 'aufgabe',
	},
	{ id: 'reihe', art: 'reihe', kategorie: 'Aufgabe und Text', suchbegriffe: ['Spalten', 'Raster'], ort: 'aufgabe' },
	{ id: 'zelle', art: 'item', kategorie: 'Aufgabe und Text', suchbegriffe: ['Item', 'Spalte'], ort: 'zeile' },
	{
		id: 'zeile',
		name: 'Rechenzeile',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Satz', 'Zeile'],
		ort: 'aufgabe',
	},
	{
		id: 'beispiel',
		name: 'Beispiel',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['vorgelöst', 'Muster'],
		ort: 'zeile',
		klasse: 'beispiel',
	},
	{
		id: 'vermutung',
		art: 'vermutung',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Forscherfrage', 'Antwort A'],
		ort: 'aufgabe',
	},
	{
		id: 'punkte',
		name: 'Punkte',
		kategorie: 'Aufgabe und Text',
		suchbegriffe: ['Bewertung', 'Klassenarbeit'],
		ort: 'zeile',
	},
	{ id: 'antwort', art: 'antwort', kategorie: 'Schreiben', suchbegriffe: ['Antwortlinie', 'Lücke'], ort: 'zeile' },
	{
		id: 'schreiblinie',
		name: 'Schreiblinie',
		kategorie: 'Schreiben',
		suchbegriffe: ['Zeile', 'Linie'],
		ort: 'aufgabe',
	},
	{ id: 'box', name: 'Kästchen', kategorie: 'Schreiben', suchbegriffe: ['Ankreuzen', 'Kasten'], ort: 'zeile' },
	{ id: 'malfeld', name: 'Malfeld', kategorie: 'Schreiben', suchbegriffe: ['Zeichnen', 'Malen'], ort: 'aufgabe' },
	{ id: 'tipp', art: 'tipp', kategorie: 'Bilder', suchbegriffe: ['Leitfigur', 'Hilfe'], ort: 'seite' },
	{ id: 'blase', art: 'blase', kategorie: 'Bilder', suchbegriffe: ['Sprechblase', 'Sagen'], ort: 'zeile' },
	{ id: 'willi', name: 'Willi', kategorie: 'Bilder', suchbegriffe: ['Leitfigur', 'Waschbär'], ort: 'zeile' },
	{ id: 'wilma', name: 'Wilma', kategorie: 'Bilder', suchbegriffe: ['Leitfigur', 'Waschbär'], ort: 'zeile' },
	{ id: 'platzhalter', art: 'platzhalter', kategorie: 'Bilder', suchbegriffe: ['Bild', 'Foto'], ort: 'aufgabe' },
	{
		id: 'karten',
		art: 'karten',
		kategorie: 'Spiele und Rätsel',
		suchbegriffe: ['Kartenbogen', 'Ausschneiden', 'Memory', 'Quartett'],
		ort: 'seite',
	},
	{
		id: 'karte',
		art: 'karte',
		kategorie: 'Spiele und Rätsel',
		suchbegriffe: ['Wortkarte', 'Bildkarte'],
		ort: 'zeile',
	},
	{
		id: 'notiz',
		art: 'notiz',
		kategorie: 'Folien',
		suchbegriffe: ['Sprechernotiz', 'Lehrkraft'],
		ort: 'seite',
		arten: ['praesentation'],
	},
];
