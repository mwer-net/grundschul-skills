import { SchoolboxFehler } from './fehler';

export const FAECHER = [
	'deutsch',
	'mathematik',
	'sachunterricht',
	'englisch',
	'kunst',
	'musik',
	'faecheruebergreifend',
] as const;

export const ARTEN = [
	'arbeitsblatt',
	'klassenarbeit',
	'lernzielkontrolle',
	'lesetext',
	'lernspiel',
	'karten',
	'lernplakat',
	'praesentation',
	'stationen',
	'unterrichtsplanung',
	'sonstiges',
] as const;

export const FORMATE = ['a4-hoch', 'a4-quer', 'a3-hoch', 'a5-hoch', 'folie', 'minibuch'] as const;
export const DRUCKPROFILE = ['sw', 'farbe'] as const;
export const KLASSEN = [1, 2, 3, 4, 'gemischt'] as const;
export const STATUS = ['entwurf', 'fertig'] as const;
export const URHEBER = ['claude', 'lehrkraft'] as const;

export type Fach = (typeof FAECHER)[number];
export type Art = (typeof ARTEN)[number];
export type Format = (typeof FORMATE)[number];
export type Druckprofil = (typeof DRUCKPROFILE)[number];
export type Klasse = (typeof KLASSEN)[number];
export type Status = (typeof STATUS)[number];
export type Urheber = (typeof URHEBER)[number];

export const STANDARD_FORMAT: Format = 'a4-hoch';

/** Eine Fassung, die die Start-Abfrage anbietet: Name in der Tabelle und im Assistenten, Format des Dokuments. */
export interface FormatOption {
	name: string;
	format: Format;
	/** Weitere Formate, in denen die Fassung auch gebaut wird (Spalte „Format“); der Assistent bietet sie beim leeren Blatt an. */
	auch?: readonly Format[];
	/** Gerüst, mit dem das Dokument angelegt wird (z. B. Mini-Book). Steht nicht in der Tabelle je Art, sondern als eigene Zeile. */
	vorlage?: string;
	/** Kurz unter dem Namen im Assistenten. */
	hinweis?: string;
}

/** Was die Start-Abfrage je Art anbietet. Aus dieser Tabelle entstehen die Tabellen in `rueckfragen.md` (`pnpm run quellen`). */
export interface ArtAngaben {
	/** Name in den Tabellen; Arten mit gleichen Angaben stehen in einer Zeile. */
	name: string;
	/** Format beim Anlegen ohne `--format`; gleich dem Format der ersten Option. */
	format: Format;
	/** Angebotene Fassungen, die erste ist die Empfehlung; leer: Die Art hat keine eigene Zeile. */
	optionen: readonly FormatOption[];
	/** Umsetzung im Material, für die Spalte „Format“. */
	umsetzung?: string;
	/** Die Fassung steht fest und wird nicht erfragt. */
	nichtFragen?: boolean;
	/** Zusatzbausteine; ohne Angabe wird nicht danach gefragt. */
	bausteine?: { selbsteinschaetzung: string; niveaus: string; sternchen: string };
	/** Empfohlener Umfang im Assistenten (131); ohne Angabe wird nicht nach Seiten gefragt. */
	umfang?: '1' | 'claude';
}

const A4_OPTIONEN = {
	format: 'a4-hoch',
	optionen: [
		{ name: 'A4 hoch', format: 'a4-hoch' },
		{ name: 'A4 quer', format: 'a4-quer', hinweis: 'breite Tabellen, Zuordnungen' },
		{ name: 'A5 (Heftformat)', format: 'a5-hoch' },
	],
	umsetzung: 'Standard; `a4-quer`; `a5-hoch`',
} as const satisfies Partial<ArtAngaben>;
const ALLE_BAUSTEINE = { selbsteinschaetzung: 'ja', niveaus: 'ja', sternchen: 'ja' };

const MINIBUCH = {
	name: 'Mini-Book',
	format: 'minibuch',
	optionen: ['Faltbuch aus einem A4-Blatt, 8 Seiten'],
} as const;

/** Vorlagen mit festem Format. Sie stehen in `rueckfragen.md` als eigene Zeile. */
export const VORLAGE_FORMAT: Record<string, { name: string; format: Format; optionen: readonly string[] }> = {
	minibuch: MINIBUCH,
};

export const ART_ANGABEN: Record<Art, ArtAngaben> = {
	arbeitsblatt: { name: 'Arbeitsblatt', ...A4_OPTIONEN, bausteine: ALLE_BAUSTEINE, umfang: '1' },
	// Lesebüchlein als Mini-Book nennt der Skill `lesetext`.
	lesetext: {
		name: 'Lesetext',
		...A4_OPTIONEN,
		optionen: [
			...A4_OPTIONEN.optionen,
			{ name: MINIBUCH.name, format: MINIBUCH.format, vorlage: 'minibuch', hinweis: MINIBUCH.optionen[0] },
		],
		bausteine: ALLE_BAUSTEINE,
		umfang: '1',
	},
	lernzielkontrolle: {
		name: 'Lernzielkontrolle',
		...A4_OPTIONEN,
		bausteine: { selbsteinschaetzung: 'ja', niveaus: '–', sternchen: '–' },
		umfang: 'claude',
	},
	klassenarbeit: {
		name: 'Klassenarbeit',
		...A4_OPTIONEN,
		bausteine: {
			selbsteinschaetzung: 'ja (vor der Abgabe, nie benotet)',
			niveaus: '– (keine Niveau-Wahl)',
			sternchen: 'ja (außerhalb der Wertung)',
		},
		umfang: 'claude',
	},
	karten: {
		name: 'Bild-/Wortkarten',
		format: 'a4-hoch',
		optionen: [
			{ name: 'Tischkarten 8 pro A4', format: 'a4-hoch' },
			{ name: 'A5-Karten (2 pro A4)', format: 'a4-hoch' },
			{ name: 'Tafelkarten A4 quer', format: 'a4-quer' },
			{ name: 'digital am Whiteboard', format: 'folie' },
		],
		umsetzung: '`.karten` auf A4 bzw. `folie`',
	},
	lernspiel: {
		name: 'Lernspiel',
		format: 'a4-hoch',
		optionen: [
			{ name: 'Karten auf A4 zum Ausschneiden', format: 'a4-hoch' },
			{ name: 'Spielplan A3/A4', format: 'a3-hoch', auch: ['a4-hoch'] },
		],
		umsetzung: '`.karten` auf A4 / `a3-hoch`',
		bausteine: { selbsteinschaetzung: '–', niveaus: 'ja', sternchen: '–' },
	},
	lernplakat: {
		name: 'Lernplakat',
		format: 'a3-hoch',
		// A2 entsteht im Copyshop aus dem A3-PDF (Skill `lernplakat`).
		optionen: [
			{ name: 'A3', format: 'a3-hoch' },
			{ name: 'A2 aus A4-Kacheln', format: 'a3-hoch' },
		],
		umsetzung: '`a3-hoch`',
	},
	stationen: {
		name: 'Stationenlernen',
		format: 'a5-hoch',
		optionen: [
			{ name: 'Stationskarten A5 + Laufzettel A4', format: 'a5-hoch', auch: ['a4-quer'] },
			{ name: 'Stationskarten A4', format: 'a4-hoch' },
		],
		umsetzung: '`a5-hoch` oder `a4-quer` mit 2 Karten / Standard',
		bausteine: ALLE_BAUSTEINE,
	},
	praesentation: {
		name: 'Präsentation',
		format: 'folie',
		optionen: [{ name: 'Folien 16:9 für Beamer, Smartboard oder Display', format: 'folie' }],
		umsetzung: '`folie`',
		nichtFragen: true,
		bausteine: {
			selbsteinschaetzung: 'ja, wenn eine Reflexionsfolie entsteht',
			niveaus: 'ja, wenn eine Lernaufgaben-Folie entsteht',
			sternchen: 'ja, wenn eine Lernaufgaben-Folie entsteht',
		},
	},
	// Das Medium wird erst bei den Materialien der Stunde gefragt (`rueckfragen.md`, Tabelle der Skills).
	unterrichtsplanung: { name: 'Unterrichtsplanung', format: 'a4-hoch', optionen: [], nichtFragen: true },
	sonstiges: { name: 'Sonstiges', format: 'a4-hoch', optionen: [] },
};

/** Die Formate einer Art ohne Gerüst, in der Reihenfolge der Optionen; das erste ist die Empfehlung. */
export const formateVon = (art: Art): readonly Format[] => {
	const { format, optionen } = ART_ANGABEN[art];
	const alle = optionen.filter((o) => !o.vorlage).flatMap((o) => [o.format, ...(o.auch ?? [])]);
	return alle.length > 0 ? [...new Set(alle)] : [format];
};

/** Was die Schoolbox je Art als Format zulässt (045), abgeleitet aus `ART_ANGABEN`. */
export const ART_FORMATE = Object.fromEntries(ARTEN.map((a) => [a, formateVon(a)])) as Record<Art, readonly Format[]>;

export const FORMAT_NAME: Record<Format, string> = {
	'a4-hoch': 'A4 hoch',
	'a4-quer': 'A4 quer',
	'a3-hoch': 'A3 hoch',
	'a5-hoch': 'A5 (Heftformat)',
	'folie': 'Folien 16:9',
	'minibuch': 'Mini-Book',
};

/** Startvorlagen, die nur zu einer Art passen (051). */
export const VORLAGE_ART: Record<string, Art> = {
	lesetext: 'lesetext',
	karten: 'karten',
	lernspiel: 'lernspiel',
	stationen: 'stationen',
	lernzielkontrolle: 'lernzielkontrolle',
	lernlandkarte: 'lernzielkontrolle',
	klassenarbeit: 'klassenarbeit',
	lernplakat: 'lernplakat',
};

export const standardFormat = (art: Art, vorlage?: string): Format =>
	(vorlage === undefined ? undefined : VORLAGE_FORMAT[vorlage]?.format) ?? ART_ANGABEN[art].format;

export const FACH_KUERZEL: Record<Fach, string> = {
	deutsch: 'de',
	mathematik: 'ma',
	sachunterricht: 'su',
	englisch: 'en',
	kunst: 'ku',
	musik: 'mu',
	faecheruebergreifend: 'fue',
};

export const waehleWert = <T extends string>(feld: string, wert: string | undefined, gueltig: readonly T[]): T => {
	const treffer = gueltig.find((g) => g === wert?.trim().toLowerCase());
	if (treffer === undefined) {
		const angabe = wert === undefined ? 'fehlt' : `„${wert}“ ist ungültig`;
		throw new SchoolboxFehler(`${feld} ${angabe}. Gültige Werte: ${gueltig.join(', ')}.`);
	}
	return treffer;
};

export const waehleKlasse = (wert: string | undefined): Klasse => {
	const gueltig = KLASSEN.map(String);
	const text = waehleWert('Klasse', wert, gueltig);
	return text === 'gemischt' ? 'gemischt' : (Number(text) as Klasse);
};
