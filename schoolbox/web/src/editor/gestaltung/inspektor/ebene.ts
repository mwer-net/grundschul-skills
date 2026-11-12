import { kann } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './abschnitte';
import { Ebene, Ueberdecken } from './ebene-teile';

/** Abschnitt 8 „Anordnen“ (185): oben die Ebene, unten „Darf Inhalt überdecken“; dazwischen Lage (2) und Anker (3). */
export const EBENE_TEILE: InspektorTeil[] = [
	{
		id: 'ebene',
		abschnitt: 8,
		reihenfolge: 1,
		fuer: (_art, baustein) => kann(baustein, 'lage'),
		Inhalt: Ebene,
	},
	{
		id: 'ueberdecken',
		abschnitt: 8,
		reihenfolge: 4,
		fuer: (_art, baustein) => kann(baustein, 'lage'),
		Inhalt: Ueberdecken,
	},
];
