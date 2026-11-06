import type { Kasten } from './geste';

/**
 * Einrasten beim Ziehen (Andockstelle für 100). Hier ohne Wirkung: Die Lage kommt unverändert zurück. `useGeste.ts`
 * sammelt die Kandidaten **einmal** beim Start der Geste und ruft `rasteEin` bei jeder Bewegung; die `linien` zeichnet
 * die Überlagerung. Alle Werte in Koordinaten des Behälters (wie `--x`/`--y`), Fangweiten in Bildschirm-px über `skala`.
 */

/** Ein Rechteck, an dessen Kanten und Mitte eingerastet werden kann. */
export interface Kandidat {
	links: number;
	oben: number;
	rechts: number;
	unten: number;
}

/** Eine Hilfslinie von (x1, y1) nach (x2, y2). */
export interface Hilfslinie {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Eingerastet {
	lage: Kasten;
	linien: Hilfslinie[];
}

/** Was in Frage kommt: Seite, Druckrand, andere Gestaltung, Bausteine. Einmal je Geste. */
export const sammleKandidaten = (_element: Element, _behaelter: Element): Kandidat[] => [];

export const rasteEin = (lage: Kasten, _kandidaten: readonly Kandidat[], _skala: number): Eingerastet => ({
	lage,
	linien: [],
});
