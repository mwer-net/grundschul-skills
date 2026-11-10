import type { InspektorTeil } from './abschnitte';
import { StreuungTeil } from './streuung-teile';

export const STREUUNG_TEILE: InspektorTeil[] = [
	{ id: 'streuung', abschnitt: 7, reihenfolge: 1, fuer: (art) => art === 'streuung', Inhalt: StreuungTeil },
];
