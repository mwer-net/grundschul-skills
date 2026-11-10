import { formHtml, formVon } from '@schoolbox/kern/src/formen';

import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';

/** Reihenfolge der Kacheln. Raute ist ein Vieleck mit vier Ecken, Sechseck eines mit sechs. */
export const GRUNDFORMEN: readonly Grundform[] = [
	{ name: 'Kreis', art: 'ellipse', auch: ['Ellipse', 'Punkt'] },
	{ name: 'Rechteck', art: 'rechteck', auch: ['Quadrat', 'Viereck'] },
	{ name: 'Abgerundetes Rechteck', art: 'rechteck', param: { 'data-radius': 20 }, auch: ['Quadrat', 'Ecken rund'] },
	{ name: 'Dreieck', art: 'dreieck' },
	{ name: 'Stern', art: 'stern' },
	{ name: 'Herz', art: 'herz' },
	{ name: 'Pfeil', art: 'pfeil' },
	{ name: 'Wolke', art: 'wolke' },
	{ name: 'Sechseck', art: 'vieleck', auch: ['Vieleck'] },
	{ name: 'Raute', art: 'vieleck', param: { 'data-ecken': 4 }, auch: ['Vieleck', 'Viereck'] },
];

export const namenVon = (g: Grundform) => [g.name, formVon(g.art)?.name ?? '', ...(g.auch ?? [])];

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
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}
