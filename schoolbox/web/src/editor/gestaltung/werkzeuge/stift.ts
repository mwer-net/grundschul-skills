import { neuerPfad } from '@schoolbox/kern/src/pfad-aendern';
import { glaette } from '@schoolbox/kern/src/vektor';

import type { Entwurf, Punkt, Werkzeug } from './typ';

/** Abweichung der geglätteten Kurve von den Zeigerpunkten, in Bildschirm-px. */
const GLAETTEN = 2;
/** Endet der Zug näher als das am Anfang (Bildschirm-px), ist er geschlossen und gefüllt. */
const SCHLIESSEN = 12;

let punkte: Punkt[] = [];
let skala = 1;

const zu = () => {
	const a = punkte[0];
	const b = punkte.at(-1);
	return (
		punkte.length > 3 && a !== undefined && b !== undefined && Math.hypot(a.x - b.x, a.y - b.y) * skala < SCHLIESSEN
	);
};

/** Während des Zugs die rohen Punkte als Linie, geschlossen schon gefüllt. */
const roh = (): Entwurf | null => {
	const [start, ...rest] = punkte;
	if (!start || rest.length === 0) {
		return null;
	}
	const geschlossen = zu();
	return neuerPfad([{ start, segmente: rest.map((p) => ({ art: 'L', p })), zu: geschlossen }], geschlossen);
};

/**
 * Stift P (116, Briefing „Stift und Pfad“): freihand zeichnen, beim Loslassen geglättet (`glaette` in `vektor.ts`).
 * Endet der Zug am Anfang, ist er geschlossen und gefüllt, sonst nur Kontur. Kein Druck des Stifts (F15).
 */
export const werkzeug: Werkzeug | null = {
	id: 'stift',
	titel: 'Stift',
	symbol: 'stift',
	taste: { code: 'KeyP' },
	zeiger: 'crosshair',
	bereit: (k) => k.frei,
	beginne: (p, _seite, s) => {
		punkte = [p];
		skala = s && s > 0 ? s : 1;
	},
	bewege: (p) => {
		punkte.push(p);
		return roh();
	},
	ende: (p) => {
		punkte.push(p);
		const geschlossen = zu();
		const zug = glaette(punkte, GLAETTEN / skala, geschlossen);
		punkte = [];
		return zug.segmente.length === 0 ? null : { ...neuerPfad([zug], geschlossen), ebene: 'vorne' };
	},
};
