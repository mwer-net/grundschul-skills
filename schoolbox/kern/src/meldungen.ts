export const MELDUNG_CODES = [
	'schrift-fehlt',
	'ueberlauf',
	'rand',
	'abgeschnitten',
	'ueberlappung',
	'schrift-klein',
	'farbe-sw',
	'flaeche',
	'bild-fehlt',
	'bild-unscharf',
	'bild-farbig',
	'aufgaben-viele',
	'abstand-knapp',
	'platz-frei',
	'notiz-fehlt',
	'platzhalter',
	'pruefskript',
	/** Nur im Editor: Antwortlinien ohne Lösung (019). */
	'loesung-fehlt',
	/** Nur im Editor: „Zu 3: …“ zeigt nach dem Umsortieren auf eine andere Aufgabe (016). */
	'verweis',
] as const;

export type MeldungCode = (typeof MELDUNG_CODES)[number];

/** Ein betroffenes Element: `data-sb` im Editor (sonst `null`), Kurzname und Rechteck `[x, y, b, h]` auf der Seite. */
export interface MeldungZiel {
	sb: number | null;
	name: string;
	rechteck: number[];
}

/** Eine Meldung aus dem Prüfbericht von blatt.py (`pruefung.js`). Ältere Berichte haben weder Code noch Ziele. */
export interface Meldung {
	stufe: 'FEHLER' | 'WARNUNG' | 'HINWEIS';
	seite: number;
	text: string;
	code?: MeldungCode;
	ziele?: MeldungZiel[];
}

/** Zum Ablegen und Verschicken: ohne Rechtecke, die nur im Editor etwas bedeuten. */
export const ohneZiele = ({ code, seite, stufe, text }: Meldung): Meldung =>
	code === undefined ? { stufe, seite, text } : { stufe, seite, text, code };

const LOESUNG = 'Lösungsblatt: ';
/** `kurz()` in pruefung.js schneidet nach 40 Zeichen ab. */
const KURZ_MAX = 40;

export const zitat = (text: string) => `„${text.length >= KURZ_MAX ? `${text}…` : text}“`;

const aufzaehlung = (namen: string[]) =>
	namen.length > 1 ? `${namen.slice(0, -1).join(', ')} und ${namen.at(-1) ?? ''}` : (namen[0] ?? '');

/** Was die Lehrkraft liest: ein Satz und, wo es einen gibt, ein Tipp, was sie im Editor tun kann. */
export interface Erklaerung {
	satz: string;
	tipp: string | null;
}

type Uebersetzung = (namen: string[], text: string) => Erklaerung;

const KUERZEN = 'Text kürzen, ein Item löschen oder die Spalten erhöhen. Oder eine neue Seite anlegen.';

/** Code → verständlicher Satz. `namen` sind die betroffenen Elemente, schon so geschrieben, wie sie dastehen sollen. */
const TABELLE: Record<MeldungCode, Uebersetzung> = {
	'schrift-fehlt': (_n, text) => ({
		satz: `Die Schrift ${/^Schrift (\S+)/.exec(text)?.[1] ?? ''} fehlt, das Blatt sieht dadurch anders aus.`,
		tipp: null,
	}),
	'ueberlauf': ([a = 'Etwas']) => ({
		satz: `${a} ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.`,
		tipp: KUERZEN,
	}),
	'rand': ([a = 'Etwas']) => ({
		satz: `${a} ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.`,
		tipp: KUERZEN,
	}),
	'abgeschnitten': ([a = 'einem Text']) => ({
		satz: `Von ${a} ist ein Teil nicht zu sehen.`,
		tipp: 'Text kürzen oder die Spalten verringern, damit er mehr Platz hat.',
	}),
	'ueberlappung': ([a = 'Zwei Dinge', b]) => ({
		satz: b ? `${a} und ${b} liegen übereinander.` : `${a} liegen übereinander.`,
		tipp: 'Text kürzen, ein Bild kleiner machen oder die Spalten verringern.',
	}),
	'schrift-klein': (namen) => ({
		satz:
			namen.length > 0
				? `Die Schrift bei ${aufzaehlung(namen)} ist sehr klein.`
				: 'Die Schrift ist stellenweise sehr klein.',
		tipp: 'Claude bitten, die Schrift größer zu machen.',
	}),
	'farbe-sw': (namen) => ({
		satz: `${namen.length > 0 ? aufzaehlung(namen) : 'Etwas'} ist farbig, das Blatt wird aber schwarz-weiß gedruckt.`,
		tipp: 'Im Druck wird die Farbe grau. Prüfe, ob man dann noch alles erkennt.',
	}),
	'flaeche': ([a]) => ({
		satz: a ? `Hinter ${a} liegt eine graue Fläche.` : 'Auf dem Blatt liegt eine graue Fläche.',
		tipp: 'Flächen kosten Druckerfarbe und lenken ab. Claude kann sie entfernen.',
	}),
	'bild-fehlt': () => ({ satz: 'Ein Bild fehlt.', tipp: 'Das Bild antippen und ein anderes auswählen.' }),
	'bild-unscharf': ([a = 'Ein Bild']) => ({
		satz: `${a} wird im Druck unscharf.`,
		tipp: 'Das Bild kleiner machen oder ein größeres Bild nehmen.',
	}),
	'bild-farbig': ([a = 'Ein Bild']) => ({
		satz: `${a} ist farbig, das Blatt wird aber schwarz-weiß gedruckt.`,
		tipp: 'Das Bild antippen und „In Graustufen umwandeln“ wählen.',
	}),
	'aufgaben-viele': (_n, text) => {
		const [, anzahl, klasse, hoechstens] = /^(\d+) Aufgaben .*Klasse (\d) sind höchstens (\d+)/.exec(text) ?? [];
		return {
			satz: anzahl
				? `Auf der Seite stehen ${anzahl} Aufgaben. Für Klasse ${klasse ?? ''} sind höchstens ${hoechstens ?? ''} übersichtlich.`
				: 'Auf der Seite stehen viele Aufgaben.',
			tipp: 'Eine Aufgabe löschen oder auf eine neue Seite ziehen.',
		};
	},
	'abstand-knapp': ([a, b]) => ({
		satz: a && b ? `${a} und ${b} stehen sehr dicht beieinander.` : 'Zwei Aufgaben stehen sehr dicht beieinander.',
		tipp: 'Ohne Auswahl unter „Ganzes Blatt“ den Abstand vergrößern.',
	}),
	'platz-frei': (_n, text) => ({
		satz: 'Unten auf der Seite ist noch viel Platz frei.',
		tipp: text.includes('--abstand')
			? 'Ohne Auswahl unter „Ganzes Blatt“ den Abstand vergrößern.'
			: 'Ein Item oder eine Aufgabe ergänzen, zum Beispiel durch Duplizieren.',
	}),
	'notiz-fehlt': () => ({ satz: 'Diese Folie hat keine Notiz für dich.', tipp: null }),
	'platzhalter': (namen) => ({
		satz: namen.length > 1 ? `Hier fehlen noch ${namen.length} Bilder.` : 'Hier fehlt noch ein Bild.',
		tipp: 'Den Platzhalter antippen und ein Bild auswählen.',
	}),
	'pruefskript': () => ({
		satz: 'Die automatische Prüfung ist nicht durchgelaufen. Bitte das PDF genau ansehen.',
		tipp: null,
	}),
	'loesung-fehlt': (_n, text) => ({
		satz: text,
		tipp: 'In der Lösungsansicht die gestreifte Linie antippen und die Lösung eintragen.',
	}),
	'verweis': (_n, text) => ({ satz: text, tipp: 'Die Sprechblase antippen und die Nummer ändern.' }),
};

type Regel = [RegExp, (...teile: string[]) => string];

/** Für Berichte ohne Code. Von speziell nach allgemein; die erste passende Regel gewinnt. */
const REGELN: Regel[] = [
	[
		/^„(.*)“ ragt aus der Seite/,
		(a = '') => `${zitat(a)} ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.`,
	],
	[
		/^„(.*)“ ragt in den Seitenrand/,
		(a = '') => `${zitat(a)} ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.`,
	],
	[/^„(.*)“ ist abgeschnitten/, (a = '') => `Von ${zitat(a)} ist ein Teil nicht zu sehen.`],
	[/^„(.*)“ überlappt „(.*)“/, (a = '', b = '') => `${zitat(a)} und ${zitat(b)} liegen übereinander.`],
	[/^Bild fehlt/, () => 'Ein Bild fehlt.'],
	[/^Schrift (\S+) nicht geladen/, (s = '') => `Die Schrift ${s} fehlt, das Blatt sieht dadurch anders aus.`],
	[
		/^(Prüfskript|Prüfung lief nicht durch)/,
		() => 'Die automatische Prüfung ist nicht durchgelaufen. Bitte das PDF genau ansehen.',
	],
];

const ohnePraefix = (text: string) => (text.startsWith(LOESUNG) ? text.slice(LOESUNG.length) : text);

const nachText = (kern: string): Erklaerung => {
	for (const [muster, uebersetze] of REGELN) {
		const treffer = muster.exec(kern);
		if (treffer) {
			return { satz: uebersetze(...treffer.slice(1)), tipp: null };
		}
	}
	return { satz: kern.replace(/\s*→.*$/s, '').trim(), tipp: null };
};

/**
 * Satz und Tipp zu einer Meldung, ohne Seite. `namen` ersetzt die Kurznamen aus pruefung.js, z. B. durch „Aufgabe 4“
 * im Editor; sonst stehen die Texte der Elemente in Anführungszeichen da.
 */
export const erklaere = (m: Meldung, namen?: string[]): Erklaerung => {
	const kern = ohnePraefix(m.text);
	const uebersetze = m.code === undefined ? undefined : TABELLE[m.code];
	if (!uebersetze) {
		return nachText(kern);
	}
	return uebersetze(namen ?? (m.ziele ?? []).map((z) => zitat(z.name)), kern);
};

/**
 * Übersetzt eine Prüfmeldung in einen Satz für die Lehrkraft, z. B. „„Kreuze an …“ ragt in den Seitenrand (12 px)
 * → kürzen, …“ zu „Seite 1: „Kreuze an …“ ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.“
 * Unbekannte Meldungen bleiben stehen, nur ohne den Tipp für Claude nach dem Pfeil.
 */
export const verstaendlich = (m: Meldung): string => {
	const ort = [m.text.startsWith(LOESUNG) ? 'Im Lösungsblatt' : '', m.seite > 0 ? `Seite ${m.seite}` : ''].filter(
		Boolean,
	);
	const { satz } = erklaere(m);
	return ort.length > 0 ? `${ort.join(', ')}: ${satz}` : satz;
};
