/**
 * Baustein-Register: welche Teile des Materials der Editor kennt und was sich mit ihnen tun lässt. Editor, Server und
 * der Chat mit Claude benutzen dieselben Namen. Ein neuer Baustein ist ein neuer Eintrag, kein neuer Code. Die Reihenfolge
 * zählt: Passt ein Element auf mehrere Einträge, gilt der erste.
 */

import type { Abbildung, KatalogAngaben } from './abbildungen';
import { ABBILDUNG_SCHEMA } from './abbildungen';
import { FIGUREN } from './figuren';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import type { Art } from './werte';
import { ARTEN } from './werte';

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
	/** Liegt frei auf der Seite (`data-lage="frei"`): Griffe statt Ziehen im Stapel (Phase 12). */
	'lage',
	/** Farbe, Kontur und Aussehen im Inspektor (Phase 12). */
	'fuellung',
	/** Höhen-Griff am unteren Rand, nur die Fläche im Stapel (E4). */
	'hoehe',
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

/** Was Claude ohne Baustein gebaut hat (Entscheidung 38): Keine Einstellungen, Änderungen laufen über den Chat. */
const FREI_NAME = 'Freies Element';
export const FREI_TITEL = 'data-frei-titel';
export const FREIES_ELEMENT = new Set(['freiestext', 'freieselement']);
export const nameFreiesElement = (titel: string | null | undefined) => titel?.trim() || FREI_NAME;

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
	// Gestaltung vor allem, was sonst auf dasselbe Element passte: auch vor `[data-frei]`, `img` und `block` (Phase 12).
	...GESTALTUNG_ARTEN,
	// Vor allem anderen, was auf dasselbe `div` oder `table` passte: Die Kennzeichnung gilt, nicht die Form.
	{
		art: 'freiestext',
		name: FREI_NAME,
		selektor: '[data-frei]',
		faehigkeiten: [...GRUND, 'text'],
		zeilen: 'umbruch',
		frei: 'text',
	},
	{ art: 'freieselement', name: FREI_NAME, selektor: '[data-frei]', faehigkeiten: GRUND },
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
	{ art: 'fuss', name: 'Selbsteinschätzung', selektor: '.fuss', faehigkeiten: GRUND, ...KLEIN }, // 203-15: hieß „Fuß“
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
	{
		art: 'figur',
		name: 'Leitfigur',
		selektor: 'img.figur:not([data-lage])',
		faehigkeiten: [...GRUND, 'bild'],
		...KLEIN,
	},
	{ art: 'bild', name: 'Bild', selektor: 'img:not([data-lage])', faehigkeiten: [...GRUND, 'bild'], ...KLEIN },
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
		selektor: '.platzhalter:not([data-lage])', // 111: ein leerer Bildrahmen ist Gestaltung
		faehigkeiten: [...GRUND, 'bild'],
		...KLEIN,
	},
	// 203-N03: der Inhalt einer Folie (Bild links, Figur oder Reihe rechts); hieße sonst „Block“.
	{ art: 'buehne', name: 'Folieninhalt', selektor: '.buehne', faehigkeiten: GRUND },
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

/**
 * In einer Ebene oder in einem Gestaltungselement (Phase 12) gelten die Regeln für frei gestaltetes Material nicht: Die
 * Ebene ist kein Rahmen, ihr Inhalt kein Block im Stapel und kein freier Text.
 */
const inGestaltung = <T>(s: Sicht<T>, t: T) => {
	for (let a: T | null = t; a; a = s.eltern(a)) {
		if (s.passt(a, '.ebene, [data-lage]')) {
			return true;
		}
	}
	return false;
};

/** Liegt das Element so, dass es als ganzer Block zwischen seine Geschwister gehört: direkt auf der Seite oder im Rahmen? */
export const liegtFrei = <T>(s: Sicht<T>, t: T) => {
	const eltern = s.eltern(t);
	return (
		eltern !== null &&
		!s.passt(t, 'style, script, template, link, meta, br') &&
		!inGestaltung(s, t) &&
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
	BAUSTEINE.find((b) => s.passt(t, b.selektor) && (!b.frei || (!inGestaltung(s, t) && REGELN[b.frei](s, t))));

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

const WILLI = '<img class="figur" src="bilder/willi.png" alt="Willi">';
/** Platz für ein Bild auf der Bühne einer Folie, Maße wie in der Vorlage der Präsentation. */
const BILDPLATZ = (h: number, b: number) => `<div class="platzhalter" style="--h:${h}px;width:${b}px">Bild</div>`;
const SPALTE = '<div class="reihe" style="--spalten:1;width:620px">';
const abstimmung = (buchstabe: string) => `<div class="vermutung"><span class="nr">${buchstabe}</span>Antwort</div>`;
const schritt = (n: number, text: string) => `<div class="zelle links" data-schritt="${n}"><b>${text}</b></div>`;
const lernaufgabe = (n: number, text: string) =>
	`<div class="aufgabe"><span class="nr">${n}</span><div class="anw"><span class="text">${text}</span></div></div>`;
const LESETEXT = [
	'Hier steht dein Lesetext. Schreibe ihn selbst oder füge ihn ein.',
	'Die Nummern am Rand zählt das Blatt von selbst, jede fünfte Zeile bekommt eine.',
	'So finden die Kinder eine Stelle im Text schnell wieder.',
	'Ein guter Lesetext hat kurze Sätze und bekannte Wörter.',
	'Schwierige Wörter erklärst du in einem Wortspeicher oder unter dem Text.',
	'Nach dem Lesen beantworten die Kinder eine Frage zum Text.',
	'Die Frage steht in einer eigenen Aufgabe mit zwei Schreiblinien.',
	'Weitere Fragen bekommst du mit „Duplizieren“ an der Aufgabe.',
	'Mehr Linien stellst du an der Schreiblinie unter „Anzahl“ ein.',
].join(' ');
const RHYTHMEN = [
	'takt="2/4" noten="4 8 8" silben="ta"',
	'takt="3/4" noten="4 4 4" silben="ta"',
	'takt="4/4" noten="2 4 4" silben="ta"',
	'takt="2/4" noten="r4 4"',
	'takt="3/4" noten="2."',
	'takt="4/4" noten="4 r4 2"',
	'takt="2/4" noten="8 8 8 8" silben="ta"',
	'takt="4/4" noten="1" silben="ta"',
];
/** Materialarten mit Namenszeile und Selbsteinschätzung: alle außer Folien, Karten und Plakat (203-05). */
const MIT_NAMENSZEILE: readonly Art[] = ARTEN.filter((a) => !['praesentation', 'karten', 'lernplakat'].includes(a));
const KARTEN_ARTEN: readonly Art[] = ['karten', 'lernspiel', 'stationen'];

/**
 * Die Kit-Bausteine für den Katalog (`katalog.ts`). Starter stehen in `assets/muster/bausteine.html` (`data-katalog`);
 * `html` setzt die Zusammensetzungen aus 203 aus vorhandenen Elementen und Klassen zusammen. Was nicht mehr angeboten
 * wird (`angeboten: false`), bleibt hier: Andere Schubladen suchen nach der Kennung, `fuegeZusatzEin` nimmt den Starter.
 */
export const KIT_KATALOG: readonly KitEintrag[] = [
	// Blatt
	{
		id: 'namenszeile',
		name: 'Namenszeile',
		kategorie: 'Blatt',
		suchbegriffe: ['Name', 'Datum'],
		ort: 'seite',
		arten: MIT_NAMENSZEILE,
	},
	{ id: 'kopf', name: 'Kopf', kategorie: 'Blatt', suchbegriffe: ['Titel', 'Überschrift', 'Lernziel', 'Wahlhilfe'], ort: 'seite' },
	{ id: 'tipp', art: 'tipp', kategorie: 'Blatt', suchbegriffe: ['Leitfigur', 'Hilfe', 'Sprechblase', 'Willi'], ort: 'seite' },
	{ id: 'platzhalter', art: 'platzhalter', kategorie: 'Blatt', suchbegriffe: ['Bild', 'Foto'], ort: 'aufgabe' },
	// Fläche im Stapel: Platz zum freien Gestalten zwischen den Aufgaben (Briefing 3.7); Starter in `muster/bausteine.html`
	{
		id: 'flaeche',
		art: 'flaeche',
		kategorie: 'Blatt',
		suchbegriffe: ['Fläche', 'Gestalten', 'Zeichnung', 'Freifläche', 'Stapel', 'Platz'],
		ort: 'seite',
	},
	{
		id: 'fuss',
		art: 'fuss',
		kategorie: 'Blatt',
		suchbegriffe: ['Fuß', 'Reflexion', 'Was hat dir geholfen', 'Wachstum'],
		ort: 'seite',
		arten: MIT_NAMENSZEILE,
	},
	{
		id: 'abschluss',
		name: 'Punkte und Unterschrift',
		kategorie: 'Blatt',
		suchbegriffe: ['Gesamtpunkte', 'Unterschrift', 'Datum', 'Eltern', 'Bewertung'],
		ort: 'seite',
		arten: ['klassenarbeit', 'lernzielkontrolle'],
		stelle: 'nach-letzter-aufgabe',
		html: '<x-gesamtpunkte></x-gesamtpunkte><x-unterschrift felder="beides" text="Unterschrift der Eltern"></x-unterschrift>',
	},
	{
		id: 'auswertung',
		name: 'Auswertung für die Lehrkraft',
		kategorie: 'Blatt',
		suchbegriffe: ['Erwartungshorizont', 'Notenschlüssel', 'Notenspiegel', 'Bewertung', 'Noten'],
		ort: 'seite',
		arten: ['klassenarbeit'],
		stelle: 'neue-seite',
		html:
			'<div class="kopf"><div class="titel"><h1>Für die Lehrkraft</h1></div></div>' +
			'<x-erwartungshorizont></x-erwartungshorizont><x-notenschluessel></x-notenschluessel><x-notenspiegel></x-notenspiegel>',
	},
	// Aufgaben
	{
		id: 'aufgabe',
		art: 'aufgabe',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Nummer', 'Aufgabenblock', 'Aufgabentext', 'Anweisung'],
		ort: 'seite',
		// 203-18: Nummer und Aufgabentext, den Inhalt holt die nächste Kachel in die gewählte Aufgabe.
		html: '<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Anweisung</span></div><div class="koerper"></div></div>',
	},
	{ id: 'text', art: 'absatz', kategorie: 'Aufgaben', suchbegriffe: ['Absatz', 'Fließtext'], ort: 'aufgabe' },
	{ id: 'reihe', art: 'reihe', kategorie: 'Aufgaben', suchbegriffe: ['Spalten', 'Raster', 'Eintrag'], ort: 'aufgabe' },
	{
		id: 'tabelle',
		art: 'tabelle',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Raster', 'Spalten', 'Zeilen', 'Übersicht'],
		ort: 'aufgabe',
	},
	{
		id: 'antwort',
		art: 'antwort',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Antwortlinie', 'Lücke', 'Rechenzeile', 'Satz'],
		ort: 'zeile',
		// 203-06: Ohne Zeile drumherum kommt der ganze Satz, wie früher die „Rechenzeile“.
		umZeile: ['Es ist ', '.'],
	},
	{
		id: 'schreiblinie',
		name: 'Schreiblinien',
		kategorie: 'Aufgaben',
		suchbegriffe: ['Schreiblinie', 'Zeile', 'Linie', 'Frage mit Schreiblinie', 'Freitext'],
		ort: 'aufgabe',
		// 203-06: drei Linien, die Zahl stellt „Anzahl“ im Inspektor.
		html: '<div class="schreiblinie"></div>'.repeat(3),
		anweisung: 'Schreibe deine Antwort auf.',
	},
	{ id: 'malfeld', name: 'Malfeld', kategorie: 'Aufgaben', suchbegriffe: ['Zeichnen', 'Malen'], ort: 'aufgabe' },
	// Deutsch
	{
		id: 'lesetext-zeilennummern',
		name: 'Lesetext mit Fragen',
		kategorie: 'Deutsch',
		suchbegriffe: ['Lesetext mit Zeilennummern', 'Absatz', 'Zeilen', 'Nummern', 'Lesen', 'Frage'],
		ort: 'seite',
		faecher: ['deutsch'],
		// 203-08: Text direkt auf der Seite, darunter eine Frage mit zwei Linien.
		html:
			`<p class="text" data-zeilennummern="5">${LESETEXT}</p>` +
			'<div class="aufgabe"><span class="nr">0</span><div class="anw"><span class="text">Frage zum Text?</span></div>' +
			'<div class="koerper"><div class="schreiblinie"></div><div class="schreiblinie"></div></div></div>',
	},
	// Musik
	{
		id: 'rhythmuskarten',
		name: 'Rhythmuskarten',
		kategorie: 'Musik',
		suchbegriffe: ['Rhythmus', 'Karten', 'Klatschen', 'Takt'],
		ort: 'seite',
		faecher: ['musik'],
		arten: KARTEN_ARTEN,
		// 203-09: der Kartenbogen aus `muster/musik.html`
		html: `<div class="karten" style="--spalten:2">${RHYTHMEN.map(
			(r) =>
				`<div class="karte"><div class="kartentext" style="font-weight:400"><x-rhythmus art="karte" ${r}></x-rhythmus></div></div>`,
		).join('')}</div>`,
	},
	// Spiele und Rätsel
	{
		id: 'karten',
		art: 'karten',
		kategorie: 'Spiele und Rätsel',
		suchbegriffe: ['Kartenbogen', 'Ausschneiden', 'Memory', 'Quartett', 'Karte'],
		ort: 'seite',
		arten: KARTEN_ARTEN,
	},
	// Folien (203-10): je der Inhalt einer Folie
	{
		id: 'folie-bild',
		name: 'Bild und Frage',
		kategorie: 'Folien',
		suchbegriffe: ['Folie', 'Bild', 'Frage', 'Einstieg', 'Impuls'],
		ort: 'folie',
		arten: ['praesentation'],
		html: `<div class="buehne">${BILDPLATZ(400, 520)}<div class="tipp">${WILLI}<div class="blase">Was siehst du?</div></div></div>`,
	},
	{
		id: 'vermutung',
		name: 'Abstimmung',
		kategorie: 'Folien',
		suchbegriffe: ['Folie', 'Vermutung', 'Antwort A', 'Forscherfrage', 'Abstimmen', 'Antwort'],
		ort: 'folie',
		arten: ['praesentation'],
		// 192: Die Kinder zeigen A, B oder C, ausgewertet wird an der Tafel; ein Feld zum Eintragen gäbe es am Beamer nicht.
		html: `<div class="buehne">${BILDPLATZ(400, 420)}${SPALTE}${['A', 'B', 'C'].map(abstimmung).join('')}</div></div>`,
	},
	{
		id: 'folie-schritte',
		name: 'Schritt für Schritt',
		kategorie: 'Folien',
		suchbegriffe: ['Folie', 'Aufdecken', 'Schritte', 'nacheinander', 'Ablauf'],
		ort: 'folie',
		arten: ['praesentation'],
		html:
			`<div class="buehne">${BILDPLATZ(420, 520)}${SPALTE}` +
			`${schritt(1, 'Zuerst …')}${schritt(2, 'Dann …')}${schritt(3, 'Am Ende …')}</div></div>`,
	},
	{
		id: 'folie-merksatz',
		name: 'Merksatz zum Aufdecken',
		kategorie: 'Folien',
		suchbegriffe: ['Folie', 'Merke', 'Aufdecken', 'Lösung', 'Sicherung'],
		ort: 'folie',
		arten: ['praesentation'],
		html:
			`<div class="buehne">${BILDPLATZ(300, 440)}<div class="tipp">${WILLI}<div class="blase">Merke dir: Hier steht der ` +
			'Satz mit dem <span class="aufdecken"><b>Schlüsselwort</b></span>.</div></div></div>',
	},
	{
		id: 'folie-arbeitszeit',
		name: 'Arbeitszeit',
		kategorie: 'Folien',
		suchbegriffe: ['Folie', 'Timer', 'Lernaufgabe', 'Arbeitsphase', 'Zeit'],
		ort: 'folie',
		arten: ['praesentation'],
		html:
			`<div class="buehne"><div style="flex:1">${lernaufgabe(1, 'Erste Lernaufgabe')}${lernaufgabe(2, 'Zweite Lernaufgabe')}` +
			'</div><x-timer minuten="20" groesse="280"></x-timer></div>',
	},
	{
		id: 'notiz',
		art: 'notiz',
		kategorie: 'Folien',
		suchbegriffe: ['Sprechernotiz', 'Lehrkraft'],
		ort: 'seite',
		arten: ['praesentation'],
	},
	// Nicht mehr im Angebot (203-04, 203-06): Der Weg in der Klammer ist einfacher.
	...(
		[
			// Gestaltung einer Reihe, setzt die Vorlage
			{ id: 'thema-band', name: 'Band des Themas', suchbegriffe: ['Schmuck', 'Reihe', 'Thema'], ort: 'seite' },
			{ id: 'thema-kopf', name: 'Kopf des Themas', suchbegriffe: ['Titel', 'Reihe', 'Thema'], ort: 'seite' },
			// Kopf wählen › „Lernziel zeigen“ bzw. „Wahlhilfe zeigen“
			{ id: 'ziel', art: 'ziel', suchbegriffe: ['Ich-kann-Ziel', 'Lernziel'], ort: 'zeile' },
			{ id: 'wahlhilfe', art: 'wahlhilfe', suchbegriffe: ['Niveau', 'Wählen'], ort: 'zeile' },
			// steht in der Selbsteinschätzung
			{ id: 'reflexion', name: 'Reflexion', suchbegriffe: ['Was hat dir geholfen'], ort: 'zeile' },
			// jede Aufgabe hat ihren Aufgabentext
			{ id: 'anweisung', art: 'anweisung', suchbegriffe: ['Arbeitsauftrag', 'Anweisung'], ort: 'zeile' },
			// „Duplizieren“ am Eintrag
			{ id: 'zelle', art: 'item', suchbegriffe: ['Item', 'Spalte'], ort: 'zeile' },
			// „Antwortlinie“
			{ id: 'zeile', name: 'Rechenzeile', suchbegriffe: ['Satz', 'Zeile'], ort: 'aufgabe' },
			// Eintrag wählen › „Als Beispiel“
			{
				id: 'beispiel',
				name: 'Beispiel',
				suchbegriffe: ['vorgelöst', 'Muster'],
				ort: 'zeile',
				klasse: 'beispiel',
			},
			// Inspektor der Aufgabe › „Bewertung · Punkte“
			{ id: 'punkte', name: 'Punkte', suchbegriffe: ['Bewertung', 'Klassenarbeit'], ort: 'zeile' },
			// „Ankreuzen“
			{ id: 'box', name: 'Kästchen', suchbegriffe: ['Ankreuzen', 'Kasten'], ort: 'zeile' },
			// „Tipp“ oder Schublade „Werkzeuge“ › Blasen
			{ id: 'blase', art: 'blase', suchbegriffe: ['Sprechblase', 'Sagen'], ort: 'zeile' },
			// Schublade „Figuren“; `figuren-daten.ts` nimmt den Starter von `willi` für ⌘-Ziehen (199)
			...FIGUREN.map((f) => ({ id: f.id, name: f.name, suchbegriffe: [...f.suchwoerter], ort: 'zeile' as const })),
			// „Duplizieren“ an der Karte
			{ id: 'karte', art: 'karte', suchbegriffe: ['Wortkarte', 'Bildkarte'], ort: 'zeile' },
			// „Silben“
			{ id: 'silbentext', name: 'Silbentext', suchbegriffe: ['Silbenbögen', 'Lesen lernen', 'Text'], ort: 'aufgabe' },
		] satisfies Omit<KitEintrag, 'kategorie'>[]
	).map((e): KitEintrag => ({ ...e, kategorie: 'Blatt', angeboten: false })),
];
