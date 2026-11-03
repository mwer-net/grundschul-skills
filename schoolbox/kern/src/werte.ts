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

/** Was die Start-Abfrage je Art anbietet. Aus dieser Tabelle entstehen die Tabellen in `rueckfragen.md` (`pnpm run quellen`). */
export interface ArtAngaben {
	/** Name in den Tabellen; Arten mit gleichen Angaben stehen in einer Zeile. */
	name: string;
	/** Format beim Anlegen ohne `--format`. */
	format: Format;
	/** Angebotene Fassungen, die erste ist die Empfehlung; leer: Die Art hat keine eigene Zeile. */
	optionen: string[];
	/** Umsetzung im Material, für die Spalte „Format“. */
	umsetzung?: string;
	/** Die Fassung steht fest und wird nicht erfragt. */
	nichtFragen?: boolean;
	/** Zusatzbausteine; ohne Angabe wird nicht danach gefragt. */
	bausteine?: { selbsteinschaetzung: string; niveaus: string; sternchen: string };
}

const A4_OPTIONEN = {
	format: 'a4-hoch',
	optionen: ['A4 hoch', 'A4 quer', 'A5 (Heftformat)'],
	umsetzung: 'Standard; `a4-quer`; `a5-hoch`',
} as const;
const ALLE_BAUSTEINE = { selbsteinschaetzung: 'ja', niveaus: 'ja', sternchen: 'ja' };

export const ART_ANGABEN: Record<Art, ArtAngaben> = {
	arbeitsblatt: { name: 'Arbeitsblatt', ...A4_OPTIONEN, optionen: [...A4_OPTIONEN.optionen], bausteine: ALLE_BAUSTEINE },
	lesetext: { name: 'Lesetext', ...A4_OPTIONEN, optionen: [...A4_OPTIONEN.optionen], bausteine: ALLE_BAUSTEINE },
	lernzielkontrolle: {
		name: 'Lernzielkontrolle',
		...A4_OPTIONEN,
		optionen: [...A4_OPTIONEN.optionen],
		bausteine: { selbsteinschaetzung: 'ja', niveaus: '–', sternchen: '–' },
	},
	klassenarbeit: {
		name: 'Klassenarbeit',
		...A4_OPTIONEN,
		optionen: [...A4_OPTIONEN.optionen],
		bausteine: {
			selbsteinschaetzung: 'ja (vor der Abgabe, nie benotet)',
			niveaus: '– (keine Niveau-Wahl)',
			sternchen: 'ja (außerhalb der Wertung)',
		},
	},
	karten: {
		name: 'Bild-/Wortkarten',
		format: 'a4-hoch',
		optionen: ['Tischkarten 8 pro A4', 'A5-Karten (2 pro A4)', 'Tafelkarten A4 quer', 'digital am Whiteboard'],
		umsetzung: '`.karten` auf A4 bzw. `folie`',
	},
	lernspiel: {
		name: 'Lernspiel',
		format: 'a4-hoch',
		optionen: ['Karten auf A4 zum Ausschneiden', 'Spielplan A3/A4'],
		umsetzung: '`.karten` auf A4 / `a3-hoch`',
		bausteine: { selbsteinschaetzung: '–', niveaus: 'ja', sternchen: '–' },
	},
	lernplakat: {
		name: 'Lernplakat',
		format: 'a3-hoch',
		optionen: ['A3', 'A2 aus A4-Kacheln'],
		umsetzung: '`a3-hoch`',
	},
	stationen: {
		name: 'Stationenlernen',
		format: 'a5-hoch',
		optionen: ['Stationskarten A5 + Laufzettel A4', 'Stationskarten A4'],
		umsetzung: '`a5-hoch` oder `a4-quer` mit 2 Karten / Standard',
		bausteine: ALLE_BAUSTEINE,
	},
	praesentation: {
		name: 'Präsentation',
		format: 'folie',
		optionen: ['Folien 16:9 für Beamer, Smartboard oder Display'],
		umsetzung: '`folie`',
		nichtFragen: true,
		bausteine: {
			selbsteinschaetzung: 'ja, wenn eine Reflexionsfolie entsteht',
			niveaus: 'ja, wenn eine Lernaufgaben-Folie entsteht',
			sternchen: 'ja, wenn eine Lernaufgaben-Folie entsteht',
		},
	},
	unterrichtsplanung: { name: 'Unterrichtsplanung', format: 'a4-hoch', optionen: [] },
	sonstiges: { name: 'Sonstiges', format: 'a4-hoch', optionen: [] },
};

/** Vorlagen mit festem Format. */
export const VORLAGE_FORMAT: Record<string, { name: string; format: Format; optionen: string[] }> = {
	minibuch: { name: 'Mini-Book', format: 'minibuch', optionen: ['Faltbuch aus einem A4-Blatt, 8 Seiten'] },
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
