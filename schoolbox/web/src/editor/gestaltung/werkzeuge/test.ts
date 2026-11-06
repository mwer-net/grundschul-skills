import { imTest } from '../testzugang';
import type { Punkt, Werkzeug } from './typ';

let start: Punkt = { x: 0, y: 0 };

const rechteck = (p: Punkt) => ({
	html: '<div class="testform" style="background:#fde68a;border:2px solid #92400e"></div>',
	lage: {
		x: Math.min(start.x, p.x),
		y: Math.min(start.y, p.y),
		b: Math.max(1, Math.abs(p.x - start.x)),
		h: Math.max(1, Math.abs(p.y - start.y)),
	},
});

/** Nur im Test (`gestaltung-ablegen.spec.ts`): zieht ein Rechteck auf, Taste Q. */
export const werkzeug: Werkzeug = {
	id: 'test',
	titel: 'Testrechteck',
	symbol: 'formen',
	taste: { code: 'KeyQ' },
	zeiger: 'crosshair',
	bereit: imTest,
	beginne: (p) => {
		start = p;
	},
	bewege: rechteck,
	ende: (p) => ({ ...rechteck(p), ebene: 'vorne' }),
};
