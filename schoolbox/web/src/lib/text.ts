import { ART_NAME, FACH_NAME } from '@schoolbox/kern/src/namen';
import type { Art, Fach, Format, Klasse } from '@schoolbox/kern/src/werte';

import type { MappenEintrag } from '../typen';

export type { Art, Fach, Format, Klasse };
export { ART_NAME, FACH_NAME };

/** Heftfarben, wie sie an vielen Grundschulen üblich sind: Deutsch rot, Mathe blau, Sachunterricht grün. */
export const FACH_FARBE: Record<Fach, string> = {
	deutsch: '#d64545',
	mathematik: '#2e6fb7',
	sachunterricht: '#3f9b5f',
	englisch: '#e0a800',
	kunst: '#e2762b',
	musik: '#8a5bb5',
	faecheruebergreifend: '#6b7783',
};

export const FORMAT_NAME: Record<Format, string> = {
	'a4-hoch': 'A4 hoch',
	'a4-quer': 'A4 quer',
	'a3-hoch': 'A3',
	'a5-hoch': 'A5',
	'folie': 'Folie',
};

export const QUERFORMATE: readonly Format[] = ['a4-quer', 'folie'];

/** In dieser Reihenfolge stehen die Klassen zur Wahl. */
export const KLASSEN_NAMEN: Record<string, string> = {
	1: 'Klasse 1',
	2: 'Klasse 2',
	3: 'Klasse 3',
	4: 'Klasse 4',
	gemischt: 'Gemischt',
};

export const klasseName = (klasse: Klasse) => KLASSEN_NAMEN[klasse] ?? `Klasse ${klasse}`;

export const anzahl = (n: number, eins: string, viele: string) => `${n === 1 ? 'Ein' : n} ${n === 1 ? eins : viele}`;

const TAG_MS = 24 * 60 * 60 * 1000;
const DATUM = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

const tagesBeginn = (zeit: Date) => new Date(zeit.getFullYear(), zeit.getMonth(), zeit.getDate()).getTime();

/** „Heute“, „Gestern“ oder „12. Oktober 2026“. */
export const datum = (iso: string, jetzt = new Date()) => {
	const zeit = new Date(iso);
	const tage = Math.round((tagesBeginn(jetzt) - tagesBeginn(zeit)) / TAG_MS);
	if (tage === 0) {
		return 'Heute';
	}
	return tage === 1 ? 'Gestern' : DATUM.format(zeit);
};

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** „10:32 Uhr“ */
export const uhrzeit = (iso: string) => `${UHRZEIT.format(new Date(iso))} Uhr`;

export const tageBis = (iso: string, jetzt = new Date()) =>
	Math.max(0, Math.ceil((new Date(iso).getTime() - jetzt.getTime()) / TAG_MS));

/** Für die Suche: Kleinbuchstaben, Umlaute ausgeschrieben, ohne Akzente. „Größen“ findet „groessen“ und umgekehrt. */
export const falte = (text: string) =>
	text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '');

export interface Filter {
	suche: string;
	fach: string | null;
	klasse: string | null;
	art: string | null;
}

const suchtext = ({ dokumente, mappe }: MappenEintrag) =>
	falte(
		[
			mappe.titel,
			FACH_NAME[mappe.fach],
			klasseName(mappe.klasse),
			...dokumente.flatMap((d) => [d.meta.titel, ART_NAME[d.meta.art]]),
		].join(' '),
	);

export const filtere = (mappen: MappenEintrag[], { art, fach, klasse, suche }: Filter) => {
	const worte = falte(suche).split(/\s+/).filter(Boolean);
	return mappen
		.filter(({ mappe }) => fach === null || mappe.fach === fach)
		.filter(({ mappe }) => klasse === null || String(mappe.klasse) === klasse)
		.filter(({ dokumente }) => art === null || dokumente.some((d) => d.meta.art === art))
		.filter((eintrag) => {
			const text = suchtext(eintrag);
			return worte.every((wort) => text.includes(wort));
		});
};
