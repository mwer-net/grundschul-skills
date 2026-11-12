import type { InspektorTeil } from './abschnitte';
import { Inhalt } from './bild-teile';

export const BILD_TEILE: InspektorTeil[] = [
	{ id: 'bild', abschnitt: 4, reihenfolge: 1, fuer: (art) => art === 'bildfrei' || art === 'bildrahmen', Inhalt },
];
