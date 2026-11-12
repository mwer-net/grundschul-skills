import { KOPFBAND_HOEHE, KOPFBAND_ZUGABE } from '@schoolbox/kern/src/seitengestaltung';

import { eckeVon } from '../ablegen/vorschau';

const zahl = (wert: string) => {
	const n = Number.parseFloat(wert);
	return Number.isFinite(n) ? n : 0;
};

/**
 * Was ein neues Band tragen soll: der `.kopf`; ohne ihn das Kind der Seite mit der ersten `h1`, solange es nicht höher
 * als ein Drittel der Seite ist, sonst die `h1` selbst.
 */
const kopfVon = (seite: HTMLElement): Element | null => {
	const kopf = seite.querySelector('.kopf');
	if (kopf) {
		return kopf;
	}
	const h1 = [...seite.querySelectorAll('h1')].find((h) => !h.closest('.ebene'));
	if (!h1) {
		return null;
	}
	// Kein `instanceof`: Das Blatt liegt in einem iframe mit eigenen Klassen.
	const kind = [...seite.children].find((k) => k.contains(h1));
	return kind && kind.getBoundingClientRect().height <= seite.clientHeight / 3 ? kind : h1;
};

/** Höhe eines neuen Bands: bis `KOPFBAND_ZUGABE` unter den Kopf, in ganzen px; ohne Kopf `KOPFBAND_HOEHE`. */
export const kopfbandHoehe = (seite: HTMLElement | null) => {
	const kopf = seite ? kopfVon(seite) : null;
	if (!seite || !kopf) {
		return KOPFBAND_HOEHE;
	}
	return Math.round(kopf.getBoundingClientRect().bottom - eckeVon(seite).y + KOPFBAND_ZUGABE);
};

/**
 * Höhe des alten Bands am `.kopf` (180), wie `--h` eines `.kopfband` sie zeichnet: Unterkante des Kopfs minus `bottom`
 * des `::before` minus die Kante, bezogen auf die Seite. Auf zwei Nachkommastellen, nicht gerundet: Sonst entstehen
 * Pixel an der Kante. `null`, wenn die Seite kein altes Band hat.
 */
export const bestandHoehe = (seite: HTMLElement | null) => {
	const kopf = seite?.querySelector('.kopf');
	const ansicht = seite?.ownerDocument.defaultView;
	if (!seite || !kopf || !ansicht) {
		return null;
	}
	const vor = ansicht.getComputedStyle(kopf, '::before');
	// Auch in s/w ausgeblendet hat es seine Maße; ohne die Regel des Bestands gibt es kein `::before`.
	if (vor.content === 'none') {
		return null;
	}
	const kante = zahl(vor.getPropertyValue('--kopfband-kante'));
	const h = kopf.getBoundingClientRect().bottom - eckeVon(seite).y - zahl(vor.bottom) - kante;
	return h > 0 ? Math.round(h * 100) / 100 : null;
};
