import { STRICH } from '@schoolbox/kern/src/formen';
import { linieHtml } from '@schoolbox/kern/src/formen-aendern';
import { in45, linieAus } from '@schoolbox/kern/src/formen-linie';

import type { Entwurf, Punkt, Werkzeug } from './typ';

let start: Punkt = { x: 0, y: 0 };

const entwurf = (p: Punkt, umschalt: boolean): Entwurf => {
	const ende = umschalt ? in45(start, p) : p;
	const { lage, punkte } = linieAus(start, ende, STRICH);
	return { html: linieHtml({ punkte, groesse: { b: lage.b, h: lage.h } }), lage };
};

/**
 * L (107, 5.10): Linie von Punkt zu Punkt, ⇧ in 45°-Schritten. Ein Klick ohne Ziehen legt nichts ab; Pfeilspitzen
 * kommen danach im Inspektor.
 */
export const werkzeug: Werkzeug | null = {
	id: 'linie',
	titel: 'Linie',
	symbol: 'linie',
	taste: { code: 'KeyL' },
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	beginne: (p) => {
		start = p;
	},
	bewege: (p, mod) => entwurf(p, mod.umschalt),
	ende: (p, mod) => ({ ...entwurf(p, mod.umschalt), ebene: 'vorne' }),
};
