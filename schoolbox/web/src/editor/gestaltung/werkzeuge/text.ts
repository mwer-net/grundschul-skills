import { SCHMUCK_ARTEN, schmuckHtml } from '@schoolbox/kern/src/schmuck';

import { wuenscheTextsitzung } from '../textsitzung';
import type { Punkt, Strich, Werkzeug } from './typ';

/** Der Text, den T setzt; markiert, damit Tippen ihn ersetzt. */
const TEXT = 'Text';
/** Weniger Breite (px des Materials) wäre kaum ein Wort: Dann gilt der Strich als Klick ohne Breite. */
const MIN_BREITE = 24;

const GR = SCHMUCK_ARTEN.titel.gr;
const html = schmuckHtml({ art: 'titel', text: TEXT, gr: GR });

let start: Punkt = { x: 0, y: 0 };

/** Der Zeiger steht mitten in der ersten Zeile, nicht an ihrer Oberkante. */
const oben = (y: number) => y - Math.round(GR * 0.55);

const aufgezogen = (p: Punkt) => {
	const b = Math.abs(p.x - start.x);
	return {
		html,
		lage: { x: Math.min(start.x, p.x), y: oben(start.y), ...(b >= MIN_BREITE ? { b } : {}) },
	};
};

/** Legt Schmuckschrift ab und öffnet danach die Textsitzung (`textsitzung.ts`). */
const mitSitzung = (strich: Strich): Strich => {
	wuenscheTextsitzung();
	return { ...strich, ebene: 'vorne' };
};

/**
 * T (5.10): Klick setzt Schmuckschrift `titel` mit „Text“ an der Stelle, Aufziehen setzt sie mit Breite (`--b`). Die
 * Textsitzung ist sofort offen; Esc beendet sie, mit dem Anlegen ein Schritt. Leer gelassen verschwindet sie wieder.
 */
export const werkzeug: Werkzeug | null = {
	id: 'text',
	titel: 'Text',
	symbol: 'schrift',
	taste: { code: 'KeyT' },
	zeiger: 'text',
	bereit: (k) => k.frei,
	beginne: (p) => {
		start = p;
	},
	bewege: aufgezogen,
	ende: (p) => mitSitzung(aufgezogen(p)),
	klick: (p) => mitSitzung({ html, lage: { x: p.x, y: oben(p.y) } }),
};
