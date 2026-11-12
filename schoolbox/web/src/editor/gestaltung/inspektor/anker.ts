import { kann } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './abschnitte';
import { Anker } from './anker-teile';

/** Im Abschnitt 8 „Anordnen“ nach Ebene (1) und Lage (2), vor „Darf Inhalt überdecken“ (4). */
export const ANKER_TEILE: InspektorTeil[] = [
	{ id: 'anker', abschnitt: 8, reihenfolge: 3, fuer: (_art, baustein) => kann(baustein, 'lage'), Inhalt: Anker },
];
