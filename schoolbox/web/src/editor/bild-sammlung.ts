import type { SammlungsBild } from '@schoolbox/kern/src/bildbefehle';

export const gesehen = () => {
	try {
		return window.sessionStorage.getItem(HINWEIS_GESEHEN) === '1';
	} catch {
		return false;
	}
};

export const merkeGesehen = () => {
	try {
		window.sessionStorage.setItem(HINWEIS_GESEHEN, '1');
	} catch {
		// Ohne Speicher kommt der Hinweis eben noch einmal.
	}
};

/** Findet nach Name, Beschreibungen und Mappe, ohne Groß- und Kleinschreibung und Umlaute. */
export const passt = (eintrag: SammlungsBild, suche: string) => {
	const text = falte([eintrag.name, ...eintrag.alt, eintrag.mappe ?? ''].join(' '));
	return falte(suche)
		.split(' ')
		.filter(Boolean)
		.every((wort) => text.includes(wort));
};

/** Der Hinweis zum Datenschutz kommt einmal je Sitzung im Browser (Leitlinie aus 007). */
export const HINWEIS_GESEHEN = 'schoolbox-foto-hinweis';

export const falte = (text: string) =>
	text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, ' ');
