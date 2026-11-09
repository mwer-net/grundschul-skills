import type { KopfbandMass } from '@schoolbox/kern/src/aufmachungen';
import { kopfbandPfad, leseAufmachung } from '@schoolbox/kern/src/aufmachungen';

import { nrVon } from '../../darstellung';
import { eckeVon } from '../ablegen/vorschau';
import { quellSeiten } from '../blatt/teile';

const zahl = (wert: string) => {
	const n = Number.parseFloat(wert);
	return Number.isFinite(n) ? n : 0;
};

/**
 * Misst das Kopfband jeder Seite fürs Freilegen (119): `::before` am `.kopf` hat kein eigenes Rechteck. Links und rechts
 * kommen aus `left`/`right` des `::before` (bis zum Blattrand), oben beginnt es bei 0 (die Seite schneidet `top:-2000px`
 * ab), unten endet es `--kopfband-unten` unter dem Kopf. Den Umriss mit derselben Kante wie die Maske rechnet der Kern.
 */
export const missKopfbaender = (doc: Document, quelle: string): KopfbandMass[] => {
	const w = leseAufmachung(quelle);
	const ansicht = doc.defaultView;
	if (!w || w.kopfband === 'ohne' || !ansicht) {
		return [];
	}
	const form = w.kopfband;
	return quellSeiten(doc).flatMap((seite) => {
		const nr = nrVon(seite);
		const kopf = seite.querySelector<HTMLElement>('.kopf');
		if (nr === null || !kopf) {
			return [];
		}
		const vor = ansicht.getComputedStyle(kopf, '::before');
		if (vor.content === 'none' || vor.display === 'none') {
			return [];
		}
		const ecke = eckeVon(seite);
		const r = kopf.getBoundingClientRect();
		const links = r.left - ecke.x + zahl(vor.left);
		const b = r.width - zahl(vor.left) - zahl(vor.right);
		const h = r.bottom - ecke.y - zahl(vor.bottom);
		if (!(b > 0) || !(h > 0)) {
			return [];
		}
		const kante = zahl(vor.getPropertyValue('--kopfband-kante'));
		const welle = zahl(vor.getPropertyValue('--kopfband-welle'));
		return [{ seite: nr, x: links, y: 0, b, h, d: kopfbandPfad(form, b, h, kante, welle) }];
	});
};
