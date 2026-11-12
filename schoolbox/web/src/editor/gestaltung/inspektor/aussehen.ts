import { kannAussehen } from '@schoolbox/kern/src/aussehen';

import type { InspektorTeil } from './abschnitte';
import { Aussehen, KonturStilWahl } from './aussehen-teile';

/**
 * 108, geordnet in 185: Der Stil der Kontur steht bei der Kontur (Abschnitt 6, nach Füllung und Kontur), Schatten und
 * Deckkraft stehen bei jeder Art unter „Aussehen“ (7). Was eine Art kann, sagt `kannAussehen` im Kern.
 */
export const AUSSEHEN_TEILE: InspektorTeil[] = [
	{
		id: 'kontur-stil',
		abschnitt: 6,
		reihenfolge: 2,
		fuer: (art) => kannAussehen(art, 'kontur-stil'),
		Inhalt: KonturStilWahl,
	},
	{
		id: 'aussehen',
		abschnitt: 7,
		reihenfolge: 1,
		fuer: (art) => kannAussehen(art, 'schatten') || kannAussehen(art, 'deckkraft'),
		Inhalt: Aussehen,
	},
];
