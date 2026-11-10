import type { InspektorTeil } from './abschnitte';
import { RahmenstilWahl } from './rahmenstil-teile';

export const RAHMENSTIL_TEILE: InspektorTeil[] = [
	{
		id: 'rahmenstil',
		abschnitt: 6,
		reihenfolge: 2,
		fuer: (art) => art === 'bildfrei' || art === 'bildrahmen',
		Inhalt: RahmenstilWahl,
	},
];
