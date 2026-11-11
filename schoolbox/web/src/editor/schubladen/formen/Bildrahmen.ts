import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import { gutVon, namenVon, RAHMEN } from './Bildrahmen-daten';
import { Kacheln } from './Bildrahmen-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

/** 111: Abschnitt „Bildrahmen“ der Schublade „Werkzeuge“: leere Rahmen, in die später ein Bild gezogen wird. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'bildrahmen',
	titel: 'Bildrahmen',
	hinweis: 'Bild hineinziehen',
	zeigt: ({ suche }) => RAHMEN.some((r) => passtZurSuche(namenVon(r), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		RAHMEN.map((r) => ({
			...ablegenEintrag(gutVon(r), z, GRUPPE),
			symbol: 'bild',
			suchwoerter: namenVon(r).slice(1),
		})),
};
