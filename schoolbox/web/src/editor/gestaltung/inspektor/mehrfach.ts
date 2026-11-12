import type { InspektorTeil } from './abschnitte';
import { MehrfachFuellung, MehrfachPosition } from './mehrfach-teile';

/** Teile, die nur bei Mehrfachauswahl erscheinen; `fuer` prüft jede gewählte Art. */
export const MEHRFACH_TEILE: InspektorTeil[] = [
	{
		id: 'mehrfach-position',
		abschnitt: 8,
		reihenfolge: 2,
		mehrfach: true,
		fuer: () => true,
		Inhalt: MehrfachPosition,
	},
	{
		id: 'mehrfach-fuellung',
		abschnitt: 6,
		reihenfolge: 0,
		mehrfach: true,
		fuer: (art) => art === 'form' || art === 'formtext',
		Inhalt: MehrfachFuellung,
	},
];
