/**
 * Streuung ablegen (109). Getrennt von `streuen.ts`, weil `legeGestaltungAb` aus `gestaltung.ts` kommt und
 * `groessen-folgen.ts` (von `gestaltung.ts` geladen) `streuen.ts` ohne Ladekreis braucht.
 */

import type { LageTeil } from './gestaltung';
import { legeGestaltungAb } from './gestaltung';
import type { NeueStreuung } from './streuen';
import { saatAus, STANDARD_MASS, streuungHtml } from './streuen';

export interface StreuungAblegen extends Omit<NeueStreuung, 'b' | 'h' | 'saat'> {
	/** Nummer der `.seite` in der Quelle. */
	seite: number;
	/** Ohne `b`, `h` 300 × 300. */
	lage?: LageTeil;
	/** Ohne Angabe eine feste Saat aus Art, Lage und Länge der Quelle; der Editor übergibt eine aus `Date.now()`. */
	saat?: number;
}

/** Eine feste Saat aus den Angaben, damit der Kern ohne Zufall auskommt. */
const saatAusLage = (quelle: string, art: string, lage: LageTeil) => {
	let h = 2166136261;
	for (const c of `${art}|${quelle.length}|${lage.x ?? 0}|${lage.y ?? 0}|${lage.b ?? 0}|${lage.h ?? 0}`) {
		h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	}
	return saatAus(h >>> 0);
};

/** Legt eine neue Streuung mit ihren Teilen hinten ab (Standard-Ebene der Art). Ein Schritt. */
export const legeStreuung = (quelle: string, { lage = {}, saat, seite, ...rest }: StreuungAblegen) => {
	const b = Math.round(lage.b ?? STANDARD_MASS.b);
	const h = Math.round(lage.h ?? STANDARD_MASS.h);
	const html = streuungHtml({ ...rest, b, h, saat: saat ?? saatAusLage(quelle, rest.art, lage) });
	return legeGestaltungAb(quelle, { seite, html, lage: { ...lage, b, h } });
};
