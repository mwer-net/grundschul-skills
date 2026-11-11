import type { StreuArt } from '@schoolbox/kern/src/streuen';
import { saatAus, STANDARD_MASS, streuungHtml } from '@schoolbox/kern/src/streuen';

import type { Punkt, Strich, Werkzeug } from './typ';

/** Weniger als das (px des Materials) wird zu klein, um Teile zu zeigen. */
const MIN = 24;

const ART: StreuArt = 'konfetti';

let start: Punkt = { x: 0, y: 0 };
let saat = 1;

const rechteck = (p: Punkt) => {
	const x = Math.min(start.x, p.x);
	const y = Math.min(start.y, p.y);
	return { x, y, b: Math.max(MIN, Math.abs(p.x - start.x)), h: Math.max(MIN, Math.abs(p.y - start.y)) };
};

const strichAus = (lage: { x: number; y: number; b: number; h: number }): Strich => ({
	html: streuungHtml({ art: ART, saat, b: lage.b, h: lage.h }),
	lage,
});

/**
 * Streuen (5.10): Aufziehen legt Konfetti in dieser Größe an, hinten; Punkte und Sterne wählt der Inspektor (174). Die
 * Vorschau zeigt die Teile schon beim Aufziehen. Keine Taste, nur der Knopf.
 */
export const werkzeug: Werkzeug | null = {
	id: 'streuen',
	titel: 'Streuen',
	symbol: 'streuung',
	suchwoerter: ['streuung', 'konfetti', 'punkte', 'sterne'],
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	beginne: (p) => {
		start = p;
		saat = saatAus(Date.now());
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
