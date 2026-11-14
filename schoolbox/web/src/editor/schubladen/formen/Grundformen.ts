import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import { symbolVon } from './Blasen';
import { gutVon as linieGut, LINIEN, namenVon as linieNamen } from './Blasen-daten';
import { GRUNDFORMEN, gutVon, namenVon } from './Grundformen-daten';
import { Kacheln } from './Grundformen-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

export const abschnitt: FormenAbschnitt | null = {
	id: 'grundformen',
	titel: 'Formen',
	zeigt: ({ suche }) =>
		GRUNDFORMEN.some((g) => passtZurSuche(namenVon(g), suche)) ||
		LINIEN.some((e) => passtZurSuche(linieNamen(e), suche)),
	Inhalt: Kacheln,
	suche: (z) => [
		...GRUNDFORMEN.map((g) => ({
			...ablegenEintrag(gutVon(g), z, GRUPPE),
			symbol: 'formen' as const,
			suchwoerter: namenVon(g).slice(1).filter(Boolean),
		})),
		...LINIEN.map((e) => ({
			...ablegenEintrag(linieGut(e, undefined), z, GRUPPE),
			symbol: symbolVon(e),
			suchwoerter: linieNamen(e).slice(1),
		})),
	],
};
