import { tauscheBild } from '@schoolbox/kern/src/bildbefehle';

import { nrVon } from '../../../darstellung';
import { bildVonGut } from '../bild-gut';
import type { AblageZiel } from './typ';

const inAbbildung = (e: Element) => {
	for (let a = e.parentElement; a; a = a.parentElement) {
		if (a.tagName.startsWith('X-')) {
			return true;
		}
	}
	return false;
};

/**
 * 103: Ein Bild auf ein Bild im Blatt tauscht es aus („austauschen“). Lage, Größe, Drehung und Klassen bleiben, nur
 * `src` und `alt` ändern sich. Gilt für freie Bilder und Bild-Bausteine, nicht für Figuren, Leitfiguren und Bilder in
 * Abbildungen (`x-…`).
 */
export const ziel: AblageZiel = (unter, gut) => {
	const bild = bildVonGut(gut);
	if (
		!bild ||
		unter.tagName !== 'IMG' ||
		unter.matches('.figur, .figur-frei') ||
		unter.closest('[data-ablage-vorschau]')
	) {
		return null;
	}
	if (inAbbildung(unter)) {
		return null;
	}
	const nr = nrVon(unter);
	return nr === null
		? null
		: { rahmen: unter, text: 'austauschen', lege: (q) => tauscheBild(q, nr, bild.src, bild.alt) };
};
