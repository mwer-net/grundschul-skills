import type { Flaeche } from './useGeste';

/**
 * 5 mm bei 96 dpi (Briefing 4.1). TODO(096): auf die Konstante aus der Prüfung umstellen, sobald es sie gibt; 096 lief
 * parallel.
 */
export const DRUCKRAND = 19;

/**
 * Die gestrichelte Linie 19 px innerhalb der Blattkante, nur solange gezogen wird. Sie liegt in der Überlagerung, nie im
 * `iframe`, und kommt darum nie in Vorschau oder Druck.
 */
export const Druckrand = ({ links, seite, skala }: { links: number; seite: Flaeche; skala: number }) => (
	<div
		className="pointer-events-none absolute border border-dashed border-brand-500/70"
		data-druckrand
		style={{
			left: links + (seite.links + DRUCKRAND) * skala,
			top: (seite.oben + DRUCKRAND) * skala,
			width: Math.max(0, seite.breite - 2 * DRUCKRAND) * skala,
			height: Math.max(0, seite.hoehe - 2 * DRUCKRAND) * skala,
		}}
	/>
);
