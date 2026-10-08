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

export const FORMATE = ['a4-hoch', 'a4-quer', 'a3-hoch', 'a5-hoch', 'folie'] as const;
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
