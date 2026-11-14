import type { InspektorTeil } from './abschnitte';
import { Kombinieren } from './kombinieren-teile';

/** 121, 198-16: eigener Abschnitt nach „Form“, für Formen mit und ohne Text (dann mit Grund), nur bei Mehrfachauswahl. */
export const KOMBINIEREN_TEILE: InspektorTeil[] = [
	{
		id: 'kombinieren',
		abschnitt: 10,
		reihenfolge: 1,
		mehrfach: true,
		fuer: (art) => art === 'form' || art === 'formtext',
		Inhalt: Kombinieren,
	},
];
