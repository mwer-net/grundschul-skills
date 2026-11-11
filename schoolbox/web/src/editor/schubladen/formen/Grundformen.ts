import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import { GRUNDFORMEN, gutVon, namenVon } from './Grundformen-daten';
import { Kacheln } from './Grundformen-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

export const abschnitt: FormenAbschnitt | null = {
	id: 'grundformen',
	titel: 'Grundformen',
	hinweis: 'Klick oder ziehen',
	zeigt: ({ suche }) => GRUNDFORMEN.some((g) => passtZurSuche(namenVon(g), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		GRUNDFORMEN.map((g) => ({
			...ablegenEintrag(gutVon(g), z, GRUPPE),
			symbol: 'formen',
			suchwoerter: namenVon(g).slice(1).filter(Boolean),
		})),
};
