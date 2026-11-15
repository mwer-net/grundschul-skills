import { formHtml, formVon } from '@schoolbox/kern/src/formen';

import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';

/** Reihenfolge der Kacheln. Raute ist ein Vieleck mit vier Ecken, Sechseck eines mit sechs. */
export const GRUNDFORMEN: readonly Grundform[] = [
	{ name: 'Kreis', art: 'ellipse', auch: ['Ellipse', 'Punkt'], werkzeug: 'ellipse' },
	{ name: 'Rechteck', art: 'rechteck', auch: ['Quadrat', 'Viereck'], werkzeug: 'rechteck' },
	{
		name: 'Abgerundetes Rechteck',
		art: 'rechteck',
		param: { 'data-radius': 20 },
		// 198-18: An 40 px Vorschau wäre Radius 20 ein Kreis.
		vorschau: { 'data-radius': 6 },
		auch: ['Quadrat', 'Ecken rund'],
	},
	{ name: 'Dreieck', art: 'dreieck' },
	{ name: 'Stern', art: 'stern' },
	{ name: 'Herz', art: 'herz' },
	{ name: 'Blockpfeil', art: 'pfeil', auch: ['Pfeil'] },
	{ name: 'Wolke', art: 'wolke' },
	{ name: 'Sechseck', art: 'vieleck', auch: ['Vieleck'], werkzeug: 'vieleck' },
	{ name: 'Raute', art: 'vieleck', param: { 'data-ecken': 4 }, auch: ['Vieleck', 'Viereck'] },
];

export const namenVon = (g: Grundform) => [g.name, ...(g.auch ?? [])];

/** Das Gut zum Ablegen: Standardgröße und -farben der Form (Füllung Akzent, Kontur Dunkel, 3 px). */
export const gutVon = (g: Grundform): GestaltungsGut => {
	const groesse = formVon(g.art)?.standardGroesse ?? { b: 120, h: 120 };
	return gestaltungsgut({
		name: g.name,
		html: formHtml({ art: g.art, ...groesse, ...(g.param ? { param: g.param } : {}) }),
		groesse,
	});
};

export interface Grundform {
	name: string;
	art: string;
	param?: Readonly<Record<string, number>>;
	/** Parameter nur für die Vorschau der Kachel, wo `param` dort anders aussähe (198-18). */
	vorschau?: Readonly<Record<string, number>>;
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
	/** 198 (Urteil 1): Werkzeug zum Aufziehen dieser Form; seine Taste steht im Tooltip der Kachel. */
	werkzeug?: string;
}
