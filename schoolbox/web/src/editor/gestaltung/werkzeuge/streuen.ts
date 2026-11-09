import { naechsteEcke, saatAus, STANDARD_MASS, streuungHtml } from '@schoolbox/kern/src/streuen';

import { streuArt } from '../streuung-stand';
import type { Punkt, Strich, Werkzeug } from './typ';

/** Weniger als das (px des Materials) wird zu klein, um Teile zu zeigen. */
const MIN = 24;

let start: Punkt = { x: 0, y: 0 };
let saat = 1;
/** Größe der Seite, auf der der Strich beginnt; daran hängt die dichte Ecke der Punkte. */
let seite: { b: number; h: number } | null = null;

const rechteck = (p: Punkt) => {
	const x = Math.min(start.x, p.x);
	const y = Math.min(start.y, p.y);
	return { x, y, b: Math.max(MIN, Math.abs(p.x - start.x)), h: Math.max(MIN, Math.abs(p.y - start.y)) };
};

const strichAus = (lage: { x: number; y: number; b: number; h: number }): Strich => {
	const art = streuArt();
	const ecke = seite ? naechsteEcke(lage, seite) : undefined;
	return { html: streuungHtml({ art, saat, b: lage.b, h: lage.h, ...(ecke ? { ecke } : {}) }), lage };
};

/**
 * Streuen (5.10): Aufziehen legt eine Streuung in dieser Größe an, hinten. Die Art ist die zuletzt in der Schublade
 * gewählte, sonst Konfetti. Die Vorschau zeigt die Teile schon beim Aufziehen. Keine Taste, nur der Knopf.
 */
export const werkzeug: Werkzeug | null = {
	id: 'streuen',
	titel: 'Streuen',
	symbol: 'streuung',
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	beginne: (p, auf) => {
		start = p;
		saat = saatAus(Date.now());
		seite = auf instanceof HTMLElement ? { b: auf.offsetWidth, h: auf.offsetHeight } : null;
	},
	bewege: (p) => strichAus(rechteck(p)),
	ende: (p) => strichAus(rechteck(p)),
	// Ein Klick ohne Strich legt sie in der Standardgröße an, die Mitte am Zeiger.
	klick: (p) =>
		strichAus({
			x: p.x - STANDARD_MASS.b / 2,
			y: p.y - STANDARD_MASS.h / 2,
			b: STANDARD_MASS.b,
			h: STANDARD_MASS.h,
		}),
};
