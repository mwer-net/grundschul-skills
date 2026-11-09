import { FLAECHE_MIN, setzeFlaechenHoehe } from '@schoolbox/kern/src/flaeche';

import type { GestaltungKontext } from '../kontext';
import type { GriffZug, ZusatzGriff } from './typ';

/** Die Höhe, die der Zug ergibt: ganze px, nie unter `FLAECHE_MIN`. */
const hoeheAus = (zug: GriffZug) => Math.max(FLAECHE_MIN, Math.round(zug.kasten.h + zug.dy));

/**
 * Griff unter der Fläche im Stapel (115): nach unten ziehen macht sie höher, nach oben niedriger, mindestens
 * `FLAECHE_MIN`. Während des Ziehens ändert sich nur `--h` im Blatt, beim Loslassen kommt ein Schritt in den Verlauf.
 * Esc stellt `style` vom Start wieder her (`useGeste`).
 */
export const HOEHE_GRIFFE: ZusatzGriff[] = [
	{
		id: 'hoehe',
		name: 'Höhe der Fläche ändern',
		fuer: (art) => art === 'flaeche',
		wo: (_element, kasten) => ({ x: kasten.b / 2, y: kasten.h }),
		zeiger: 'cursor-ns-resize',
		folgtDemElement: true,
		zeige: (g: GestaltungKontext, zug) => {
			const h = hoeheAus(zug);
			(g.element as HTMLElement).style.setProperty('--h', `${h}px`);
			return { text: `Höhe ${h}` };
		},
		schreibe: (g, zug) => {
			const h = hoeheAus(zug);
			g.fuehreAus('Höhe der Fläche geändert', (q) => ({ quelle: setzeFlaechenHoehe(q, g.nr, h), nr: g.nr }));
		},
	},
];
