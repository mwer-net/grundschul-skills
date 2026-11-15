import type { InspektorTeil } from './abschnitte';
import { KOMBINIEREN_TEILE } from './kombinieren';
import { MehrfachFuellung, MehrfachKontur, MehrfachPosition } from './mehrfach-teile';

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
	{
		id: 'mehrfach-kontur',
		abschnitt: 6,
		reihenfolge: 0.5,
		mehrfach: true,
		fuer: (art) => art === 'form' || art === 'formtext',
		Inhalt: MehrfachKontur,
	},
	// 198-16: „Kombinieren“ nur bei Mehrfachauswahl; in `INSPEKTOR_TEILE` stand der Abschnitt auch einzeln (leer) da.
	...KOMBINIEREN_TEILE,
];
