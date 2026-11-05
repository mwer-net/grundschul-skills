/**
 * Baustein-Register: welche Teile des Materials der Editor kennt und was sich mit ihnen tun lässt. Editor, Server und
 * der Chat mit Claude benutzen dieselben Namen. Ein neuer Baustein ist ein neuer Eintrag, kein neuer Code. Die Reihenfolge
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
	/** Gilt nur, wenn zusätzlich die Regel für frei gestaltetes Material passt (054); Selektoren allein reichen dafür nicht. */
	frei?: FreieRegel;
}

export type FreieRegel = 'text' | 'block' | 'tabelle' | 'tabellenteil';

/** Die eigenen Elemente aus `abbildungen.js`; ihren Inhalt zeichnet erst der Browser. */
export const ABBILDUNGEN = Object.keys(ABBILDUNG_SCHEMA) as Abbildung[];

/**
 * Teile eines Textträgers, die beim Tippen unverändert bleiben: Nummern, Niveau-Punkte, Antwortlinien und
 * Lösungen (019), Abbildungen (018), Bilder (017). Sie lassen sich weder ändern noch löschen.
 */
const GESCHUETZT_OHNE_ATTRIBUT = [
	'.nr',
	'.niveau',
	'.antwort',
	'.leerstelle',
	'.loesung-marke',
	'.box',
	'.nur-loesung',
	'.nicht-loesung',
	'img',
	'svg',
	'math',
	...ABBILDUNGEN,
].join(', ');
export const GESCHUETZT = `${GESCHUETZT_OHNE_ATTRIBUT}, [data-l]`;

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
	{ art: 'tabelle', name: 'Tabelle', selektor: 'table', faehigkeiten: GRUND, frei: 'tabelle', ...KLEIN },
	{
		art: 'tabellenzeile',
		name: 'Zeile',
		selektor: 'table tr',
		faehigkeiten: ['ordnen', 'duplizieren', 'loeschen'],
		zaehlen: true,
		frei: 'tabellenteil',
	},
	{
		art: 'tabellenzelle',
		name: 'Zelle',
		selektor: 'table th, table td',
		faehigkeiten: ['text'],
		frei: 'tabellenteil',
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
		name: 'Eintrag',
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
	{ art: 'themaband', name: 'Band des Themas', selektor: '.thema-band', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'themakopf', name: 'Kopf des Themas', selektor: '.thema-kopf', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'punkte', name: 'Punkte', selektor: '.punkte', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'schreiblinie', name: 'Schreiblinie', selektor: '.schreiblinie', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'malfeld', name: 'Malfeld', selektor: '.malfeld', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'leerstelle', name: 'Leerstelle', selektor: '.leerstelle', faehigkeiten: GRUND, ...KLEIN },
	{ art: 'loesungstext', name: 'Lösungstext', selektor: 'body.loesung .nur-loesung', faehigkeiten: ['text'] },
	{ art: 'ueberschrift', name: 'Überschrift', selektor: 'h1, h2, h3', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'ziel', name: 'Lernziel', selektor: '.ziel', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'wahlhilfe', name: 'Wahlhilfe', selektor: '.wahlhilfe', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
	{ art: 'anweisung', name: 'Aufgabentext', selektor: '.anw .text', faehigkeiten: [...GRUND, 'text'], ...KLEIN },
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
	{
		art: 'freitext',
		name: 'Text',
		selektor:
			'div, td, th, h4, h5, h6, figcaption, caption, dt, dd, label, summary, blockquote, address, a, abbr, b, cite, code, em, font, i, kbd, mark, q, s, small, span, strong, sub, sup, u, var',
		faehigkeiten: [...GRUND, 'text'],
		zeilen: 'umbruch',
		frei: 'text',
		...KLEIN,
	},
	{
		art: 'block',
		name: 'Block',
		selektor:
			'div, section, article, aside, main, header, footer, nav, figure, ul, ol, dl, table, blockquote, pre, hr, center, form, details, h4, h5, h6, a, b, small, span, strong, label, svg',
		faehigkeiten: GRUND,
		frei: 'block',
	},
];

/** Sicht auf ein Element: dieselben Regeln gelten im Browser (DOM) und ohne Browser (Zerlegung der Quelle). */
export interface Sicht<T> {
	passt: (t: T, selektor: string) => boolean;
	tag: (t: T) => string;
	eltern: (t: T) => T | null;
	kinder: (t: T) => readonly T[];
	/** Text direkt im Element, ohne den seiner Kinder. */
	eigenerText: (t: T) => boolean;
	attribut: (t: T, name: string) => string | null;
}

const menge = (...teile: string[]) => new Set(teile.flatMap((t) => t.split(' ')));
const INLINE = menge('a abbr b bdi bdo br cite code em font i kbd mark q s small span strong sub sup u var wbr');
const RAHMEN = menge('div section article aside main');
const TABELLE = 'kit-tabelle';

const geschuetzt = <T>(s: Sicht<T>, t: T) => s.passt(t, GESCHUETZT_OHNE_ATTRIBUT) || s.attribut(t, 'data-l') !== null;

const imGeschuetzten = <T>(s: Sicht<T>, t: T) => {
	for (let a: T | null = t; a; a = s.eltern(a)) {
		if (geschuetzt(s, a)) {
			return true;
		}
	}
	return false;
};

const inSeite = <T>(s: Sicht<T>, t: T) => {
	for (let a = s.eltern(t); a; a = s.eltern(a)) {
		if (s.passt(a, '.seite')) {
			return true;
		}
	}
	return false;
};

const hatBlockKind = <T>(s: Sicht<T>, t: T) => s.kinder(t).some((k) => !INLINE.has(s.tag(k)) && !geschuetzt(s, k));

/** Ein Eintrag des Registers mit festen Regeln: Der Baustein ist schon, was er ist, und zählt nicht als freier Text. */
const festerBaustein = <T>(s: Sicht<T>, t: T) => BAUSTEINE.some((b) => !b.frei && s.passt(t, b.selektor));

const traegtText = <T>(s: Sicht<T>, t: T): boolean =>
	s.eigenerText(t) ||
	s.kinder(t).some((k) => INLINE.has(s.tag(k)) && !geschuetzt(s, k) && !festerBaustein(s, k) && traegtText(s, k));

const unterTextTraeger = <T>(s: Sicht<T>, t: T) => {
	for (let a = s.eltern(t); a; a = s.eltern(a)) {
		const b = bausteinUeber(s, a);
		if (b && kann(b, 'text')) {
			return true;
		}
		if (!INLINE.has(s.tag(a))) {
			return false;
		}
	}
	return false;
};

/** Text ohne Block darunter, außerhalb von Abbildungen und allem, was beim Tippen unverändert bleibt. */
const freierText = <T>(s: Sicht<T>, t: T) =>
	inSeite(s, t) &&
	!imGeschuetzten(s, t) &&
	!hatBlockKind(s, t) &&
	traegtText(s, t) &&
	!(INLINE.has(s.tag(t)) && unterTextTraeger(s, t));

/** Eine Hülle ohne eigenen Text und ohne feste Bedeutung, z. B. der Rahmen eines frei gestalteten Blatts. */
const einfacherRahmen = <T>(s: Sicht<T>, t: T, tiefe = 0): boolean => {
	const eltern = s.eltern(t);
	return (
		tiefe < 3 &&
		eltern !== null &&
		RAHMEN.has(s.tag(t)) &&
		!geschuetzt(s, t) &&
		!s.eigenerText(t) &&
		hatBlockKind(s, t) &&
		!festerBaustein(s, t) &&
		(s.passt(eltern, '.seite') || einfacherRahmen(s, eltern, tiefe + 1))
	);
};

/** Liegt das Element so, dass es als ganzer Block zwischen seine Geschwister gehört: direkt auf der Seite oder im Rahmen? */
export const liegtFrei = <T>(s: Sicht<T>, t: T) => {
	const eltern = s.eltern(t);
	return (
		eltern !== null &&
		!s.passt(t, 'style, script, template, link, meta, br') &&
		(s.passt(eltern, '.seite') || einfacherRahmen(s, eltern))
	);
};

const tabelleVon = <T>(s: Sicht<T>, t: T) => {
	for (let a = s.eltern(t); a; a = s.eltern(a)) {
		if (s.tag(a) === 'table') {
			return a;
		}
	}
	return null;
};

/** Rechteckig, ohne verbundene Zellen, ohne Beschriftung: Die Befehle aus 047 lesen und schreiben sie vollständig. */
const einfacheTabelle = <T>(s: Sicht<T>, t: T) => {
	const zeilen = (e: T): T[] => s.kinder(e).flatMap((k) => (['thead', 'tbody'].includes(s.tag(k)) ? zeilen(k) : [k]));
	const alle = zeilen(t);
	if (alle.length === 0 || alle.some((z) => s.tag(z) !== 'tr')) {
		return false;
	}
	const breite = s.kinder(alle[0] as T).length;
	return alle.every((z) => {
		const zellen = s.kinder(z);
		return (
			zellen.length === breite &&
			zellen.every(
				(c) =>
					['td', 'th'].includes(s.tag(c)) &&
					(s.attribut(c, 'colspan') ?? '1') === '1' &&
					(s.attribut(c, 'rowspan') ?? '1') === '1',
			)
		);
	});
};

const tabelleGilt = <T>(s: Sicht<T>, t: T) =>
	s.passt(t, `.${TABELLE}`) || (inSeite(s, t) && !imGeschuetzten(s, t) && einfacheTabelle(s, t));

const tabellenteil = <T>(s: Sicht<T>, t: T) => {
	const tabelle = tabelleVon(s, t);
	if (!tabelle || !tabelleGilt(s, tabelle)) {
		return false;
	}
	if (s.tag(t) === 'tr') {
		return s.tag(s.eltern(t) as T) !== 'thead';
	}
	return s.passt(tabelle, `.${TABELLE}`) || !hatBlockKind(s, t);
};

const REGELN: Record<FreieRegel, <T>(s: Sicht<T>, t: T) => boolean> = {
	text: freierText,
	block: liegtFrei,
	tabelle: tabelleGilt,
	tabellenteil,
};

/** Der erste passende Eintrag des Registers, mit den Regeln für frei gestaltetes Material. */
export const bausteinUeber = <T>(s: Sicht<T>, t: T): Baustein | undefined =>
	BAUSTEINE.find((b) => s.passt(t, b.selektor) && (!b.frei || REGELN[b.frei](s, t)));

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
		id: 'thema-band',
		name: 'Band des Themas',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Schmuck', 'Reihe', 'Thema'],
		ort: 'seite',
	},
	{
		id: 'thema-kopf',
		name: 'Kopf des Themas',
		kategorie: 'Kopf und Rahmen',
		suchbegriffe: ['Titel', 'Reihe', 'Thema'],
		ort: 'seite',
	},
	{
		id: 'lesetext-zeilennummern',
		name: 'Lesetext mit Zeilennummern',
		kategorie: 'Sprache',
		suchbegriffe: ['Absatz', 'Zeilen', 'Nummern', 'Lesen'],
		ort: 'aufgabe',
		faecher: ['deutsch'],
	},
	{
		id: 'silbentext',
		name: 'Silbentext',
		kategorie: 'Sprache',
		suchbegriffe: ['Silbenbögen', 'Lesen lernen', 'Text'],
		ort: 'aufgabe',
		faecher: ['deutsch'],
	},
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
		suchbegriffe: ['Arbeitsauftrag', 'Anweisung'],
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
