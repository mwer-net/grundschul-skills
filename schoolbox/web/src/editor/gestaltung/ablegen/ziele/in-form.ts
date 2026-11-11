import { bildInForm, fuelleBildrahmen } from '@schoolbox/kern/src/bildrahmen';
import { istMaskenForm } from '@schoolbox/kern/src/formen-masken';

import { nrVon } from '../../../darstellung';
import { bildVonGut } from '../bild-gut';
import type { AblageZiel } from './typ';

/**
 * 111: Ein Bild auf einen leeren Bildrahmen oder eine Form ohne Text schneidet es in die Form zu. Das Ziel verschwindet,
 * an seiner Stelle liegt ein freies Bild mit derselben Lage (auch `--drehen`) und derselben Form als Maske. Ebene und
 * Reihenfolge bleiben, ein Schritt. Am Zeiger (172): beim leeren Rahmen „einsetzen“ wie beim Platzhalter, bei der Form
 * ohne Text „zuschneiden“, denn dort verschwindet die Form.
 */
export const ziel: AblageZiel = (unter, gut) => {
	const bild = bildVonGut(gut);
	const element = bild ? unter.closest('.bildrahmen[data-lage="frei"], svg.form[data-lage="frei"]') : null;
	if (!bild || !element || element.closest('[data-ablage-vorschau]')) {
		return null;
	}
	const leer = element.matches('.bildrahmen');
	if (!leer && !istMaskenForm(element.getAttribute('data-form'))) {
		return null;
	}
	const nr = nrVon(element);
	if (nr === null) {
		return null;
	}
	return {
		rahmen: element,
		text: leer ? 'einsetzen' : 'zuschneiden',
		lege: (q) => (leer ? fuelleBildrahmen : bildInForm)(q, nr, { src: bild.src, alt: bild.alt }),
	};
};
