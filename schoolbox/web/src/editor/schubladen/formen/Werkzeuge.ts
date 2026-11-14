import { zeichenwerkzeuge } from '../../gestaltung/werkzeuge/werkzeugknoepfe';
import type { FormenAbschnitt } from './typ';
import { LAGE } from './Werkzeuge-daten';
import { Inhalt } from './Werkzeuge-teile';

/** 198-10: Abschnitt „Zeichnen“ mit den Werkzeugen, die es nur als Werkzeug gibt. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'werkzeuge',
	titel: 'Zeichnen',
	zeigt: ({ suche }) => zeichenwerkzeuge(LAGE, suche).length > 0,
	Inhalt,
};
