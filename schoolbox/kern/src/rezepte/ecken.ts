/**
 * Zonen für Rezepte aus 118: eine Ecke als L im Seitenrand, damit Streuung nie hinter Inhalt liegt (Vorbild
 * `untenLinks` in `zirkus.ts`). Nur Rechnen mit Maßen, keine neue Mechanik.
 */

import type { Ecke, Zone } from '../streuen';
import type { AufmachungsFormat } from './typ';
import { SEITEN_MASSE } from './typ';

/** Breite des Seitenrands je Format, in dem Streuung liegt (etwas weniger als `--rand`, wie bei Zirkus). */
export const SEITENRAND: Readonly<Record<AufmachungsFormat, number>> = {
	'a4-hoch': 54,
	'a4-quer': 54,
	'a5-hoch': 36,
	'a3-hoch': 54,
	'folie': 44,
};

/**
 * Die Ecke `ecke` als L: ein senkrechter Streifen (`rand` breit, `h` hoch) und ein waagerechter (`b` breit, `rand`
 * hoch), beide im Seitenrand.
 */
export const eckeImRand = (format: AufmachungsFormat, ecke: Ecke, b: number, h: number): Zone[] => {
	const seite = SEITEN_MASSE[format];
	const rand = SEITENRAND[format];
	const links = ecke === 'ol' || ecke === 'ul';
	const oben = ecke === 'ol' || ecke === 'or';
	const sx = links ? 0 : seite.b - rand;
	const wx = links ? 0 : seite.b - b;
	return oben
		? [
				{ x: wx, y: 0, b, h: rand },
				{ x: sx, y: rand, b: rand, h: h - rand },
			]
		: [
				{ x: sx, y: seite.h - h, b: rand, h: h - rand },
				{ x: wx, y: seite.h - rand, b, h: rand },
			];
};

/** Größe einer Ecke je Format: wie bei Zirkus, hoch wie breit gedreht im Querformat. */
export const ECKE: Readonly<Record<AufmachungsFormat, { b: number; h: number }>> = {
	'a4-hoch': { b: 260, h: 300 },
	'a4-quer': { b: 300, h: 260 },
	'a5-hoch': { b: 160, h: 180 },
	'a3-hoch': { b: 380, h: 420 },
	'folie': { b: 200, h: 170 },
};

/** Größe der Teile je Format. */
export const GROESSE = {
	'a4-hoch': 'mittel',
	'a4-quer': 'mittel',
	'a5-hoch': 'klein',
	'a3-hoch': 'gross',
	'folie': 'klein',
} as const;
