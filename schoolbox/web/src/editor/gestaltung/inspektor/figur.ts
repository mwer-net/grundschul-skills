import type { InspektorTeil } from './abschnitte';
import { FigurWahl } from './figur-teile';

export const FIGUR_TEILE: InspektorTeil[] = [
	{ id: 'figur', abschnitt: 6, reihenfolge: 2, fuer: (art) => art === 'figurfrei', Inhalt: FigurWahl },
];
