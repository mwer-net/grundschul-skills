import type { InspektorTeil } from './abschnitte';
import { Fuellung } from './fuellung-teile';

export const FUELLUNG_TEILE: InspektorTeil[] = [
	// 107: auch Form mit Text
	{
		id: 'fuellung',
		abschnitt: 6,
		reihenfolge: 1,
		fuer: (art) => art === 'form' || art === 'formtext',
		Inhalt: Fuellung,
	},
];
