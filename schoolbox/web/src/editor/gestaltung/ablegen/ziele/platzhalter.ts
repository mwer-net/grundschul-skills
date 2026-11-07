import { setzeBildEin } from '@schoolbox/kern/src/bildbefehle';

import { nrVon } from '../../../darstellung';
import { bildVonGut } from '../bild-gut';
import type { AblageZiel } from './typ';

/** Platz in der Spalte wie im Bild-Panel: die Innenbreite des Elternelements. */
const spaltenBreite = (element: Element) => {
	const eltern = element.parentElement;
	const fenster = element.ownerDocument.defaultView;
	if (!eltern || !fenster) {
		return Infinity;
	}
	const stil = fenster.getComputedStyle(eltern);
	return eltern.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
};

/**
 * 103: Ein Bild auf einen Bildplatzhalter (`.platzhalter`) füllt ihn („einsetzen“), wie „Bild einsetzen“ im Inspektor:
 * so hoch wie der Platzhalter, höchstens so breit wie er und seine Spalte. Ohne Beschreibung gilt sein Text.
 */
export const ziel: AblageZiel = (unter, gut) => {
	const bild = bildVonGut(gut);
	const platz = bild ? unter.closest('.platzhalter') : null;
	const nr = platz ? nrVon(platz) : null;
	if (!bild || !platz || nr === null) {
		return null;
	}
	return {
		rahmen: platz,
		text: 'einsetzen',
		lege: (q) => {
			const r = platz.getBoundingClientRect();
			const masse = bild.natur ?? { breite: r.width, hoehe: r.height };
			const breite = Math.min(spaltenBreite(platz), r.width, (r.height * masse.breite) / Math.max(1, masse.hoehe));
			const alt = bild.alt || (platz.textContent ?? '').trim().replace(/\s+/g, ' ');
			return setzeBildEin(q, nr, { src: bild.src, alt, breite });
		},
	};
};
