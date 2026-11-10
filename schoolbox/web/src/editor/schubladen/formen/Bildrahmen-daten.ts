import { bildrahmenHtml } from '@schoolbox/kern/src/bildrahmen';

import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';

/** Die leeren Bildrahmen zum Start (3-formen.md): Kreis, abgerundetes Rechteck, Stern, Wolke. */
export const RAHMEN: readonly Rahmen[] = [
	{
		id: 'kreis',
		name: 'Bildrahmen Kreis',
		art: 'ellipse',
		groesse: { b: 220, h: 220 },
		auch: ['Foto rund', 'Kreis'],
	},
	{
		id: 'rechteck',
		name: 'Bildrahmen Rechteck',
		art: 'rechteck',
		param: { 'data-radius': 24 },
		groesse: { b: 260, h: 190 },
		auch: ['Foto', 'Ecken rund'],
	},
	{ id: 'stern', name: 'Bildrahmen Stern', art: 'stern', groesse: { b: 240, h: 240 }, auch: ['Foto', 'Stern'] },
	{ id: 'wolke', name: 'Bildrahmen Wolke', art: 'wolke', groesse: { b: 280, h: 190 }, auch: ['Foto', 'Wolke'] },
];

export const namenVon = (r: Rahmen) => [r.name, 'Bildrahmen', ...(r.auch ?? [])];

/** Das Gut: ein leerer Bildrahmen, vorne, in seiner Größe; der `clip-path` passt zu dieser Größe. */
export const gutVon = (r: Rahmen): GestaltungsGut =>
	gestaltungsgut({
		name: r.name,
		html: bildrahmenHtml({ form: r.art, ...r.groesse, ...(r.param ? { param: r.param } : {}) }),
		groesse: r.groesse,
	});

export interface Rahmen {
	id: string;
	name: string;
	art: string;
	param?: Readonly<Record<string, number>>;
	groesse: { b: number; h: number };
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}
