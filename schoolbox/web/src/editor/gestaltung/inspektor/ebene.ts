import { kann } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './abschnitte';
import { Ebene } from './ebene-teile';

export const EBENE_TEILE: InspektorTeil[] = [
	{
		id: 'ebene',
		abschnitt: 8,
		reihenfolge: 1,
		fuer: (_art, baustein) => kann(baustein, 'lage'),
		Inhalt: Ebene,
	},
];
