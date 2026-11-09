import { formHtml, formVon } from '@schoolbox/kern/src/formen';

import type { Entwurf, Punkt, Strich, Tasten, Werkzeug } from './typ';

/**
 * Formen aufziehen (107, Briefing 5.10): R, O, Y und ★ teilen sich diese Regeln. ⇧ gibt gleiche Seiten (Quadrat,
 * Kreis), ⌥ zieht aus der Mitte auf. Ein Klick ohne Ziehen legt die Standardgröße mit der Mitte am Klick ab. Beim
 * Aufziehen heißt ⌥ nur „aus der Mitte“, nie „Kopie“ wie in der Geste (097).
 */
export const aufgezogen = (start: Punkt, p: Punkt, mod: Pick<Tasten, 'umschalt' | 'wahl'>) => {
	let dx = p.x - start.x;
	let dy = p.y - start.y;
	if (mod.umschalt) {
		const m = Math.max(Math.abs(dx), Math.abs(dy));
		dx = (dx < 0 ? -1 : 1) * m;
		dy = (dy < 0 ? -1 : 1) * m;
	}
	if (mod.wahl) {
		const b = Math.max(1, Math.round(Math.abs(dx) * 2));
		const h = Math.max(1, Math.round(Math.abs(dy) * 2));
		return { x: Math.round(start.x - b / 2), y: Math.round(start.y - h / 2), b, h };
	}
	return {
		x: Math.round(Math.min(start.x, start.x + dx)),
		y: Math.round(Math.min(start.y, start.y + dy)),
		b: Math.max(1, Math.round(Math.abs(dx))),
		h: Math.max(1, Math.round(Math.abs(dy))),
	};
};

interface FormWerkzeug {
	id: string;
	titel: string;
	art: string;
	symbol: Werkzeug['symbol'];
	taste?: Werkzeug['taste'];
	param?: Readonly<Record<string, number>>;
}

/** Ein Werkzeug, das eine Form der Liste aufzieht; Farben und Strich wie beim Ablegen aus der Schublade (104). */
export const formWerkzeug = ({ art, id, param, symbol, taste, titel }: FormWerkzeug): Werkzeug => {
	let start: Punkt = { x: 0, y: 0 };
	const entwurf = (lage: { x: number; y: number; b: number; h: number }): Entwurf => ({
		html: formHtml({ art, b: lage.b, h: lage.h, ...(param ? { param } : {}) }),
		lage,
	});
	const ende = (p: Punkt, mod: Tasten): Strich => ({ ...entwurf(aufgezogen(start, p, mod)), ebene: 'vorne' });
	return {
		id,
		titel,
		symbol,
		...(taste ? { taste } : {}),
		zeiger: 'crosshair',
		bereit: (k) => k.frei,
		beginne: (p) => {
			start = p;
		},
		bewege: (p, mod) => entwurf(aufgezogen(start, p, mod)),
		ende,
		klick: (p) => {
			const { b, h } = formVon(art)?.standardGroesse ?? { b: 120, h: 120 };
			return { ...entwurf({ x: Math.round(p.x - b / 2), y: Math.round(p.y - h / 2), b, h }), ebene: 'vorne' };
		},
	};
};
