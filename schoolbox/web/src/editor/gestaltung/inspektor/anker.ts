import { kann } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './abschnitte';
import { Anker } from './anker-teile';

/** Nach „Ebene“ (099, `reihenfolge` 1) im Abschnitt 8 „Ebene und Anker“. */
export const ANKER_TEILE: InspektorTeil[] = [
	{ id: 'anker', abschnitt: 8, reihenfolge: 2, fuer: (_art, baustein) => kann(baustein, 'lage'), Inhalt: Anker },
];
