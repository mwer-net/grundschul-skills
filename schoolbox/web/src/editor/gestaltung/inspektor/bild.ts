import type { InspektorTeil } from './abschnitte';
import { Inhalt } from './bild-teile';

export const BILD_TEILE: InspektorTeil[] = [
	{ id: 'bild', abschnitt: 6, reihenfolge: 1, fuer: (art) => art === 'bildfrei', Inhalt },
];
