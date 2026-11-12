import type { InspektorTeil } from './abschnitte';
import { FigurWahl } from './figur-teile';

export const FIGUR_TEILE: InspektorTeil[] = [
	// >> 185
	{ id: 'figur', abschnitt: 4, reihenfolge: 2, fuer: (art) => art === 'figurfrei', Inhalt: FigurWahl },
	// << 185
];
