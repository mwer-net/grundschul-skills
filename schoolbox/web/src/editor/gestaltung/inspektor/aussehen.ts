import { kannAussehen } from '@schoolbox/kern/src/aussehen';

import type { InspektorTeil } from './abschnitte';
import { Aussehen } from './aussehen-teile';

/** Bild und Figur: Abschnitt 6 „Bild“ statt „Füllung und Kontur“. */
const AUF_BILD = new Set(['bildfrei', 'figurfrei']);

export const AUSSEHEN_TEILE: InspektorTeil[] = [
	{
		id: 'aussehen',
		abschnitt: 4,
		reihenfolge: 2,
		fuer: (art) => !AUF_BILD.has(art) && kannAussehen(art, 'deckkraft'),
		Inhalt: Aussehen,
	},
	{ id: 'aussehen-bild', abschnitt: 6, reihenfolge: 9, fuer: (art) => AUF_BILD.has(art), Inhalt: Aussehen },
];
