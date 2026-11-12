import { kann } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './abschnitte';
import { Position } from './position-teile';

export const POSITION_TEILE: InspektorTeil[] = [
	{
		id: 'position',
		abschnitt: 8,
		reihenfolge: 2,
		fuer: (_art, baustein) => kann(baustein, 'lage'),
		Inhalt: Position,
	},
];
