import type { InspektorTeil } from './abschnitte';
import { Kombinieren } from './kombinieren-teile';

/** 121: im Abschnitt Form, für Formen mit und ohne Text (dann mit Grund), nur bei Mehrfachauswahl. */
export const KOMBINIEREN_TEILE: InspektorTeil[] = [
	{
		id: 'kombinieren',
		abschnitt: 3,
		reihenfolge: 9,
		mehrfach: true,
		fuer: (art) => art === 'form' || art === 'formtext',
		Inhalt: Kombinieren,
	},
];
