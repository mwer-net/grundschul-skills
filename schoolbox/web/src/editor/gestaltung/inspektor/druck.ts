import type { InspektorTeil } from './abschnitte';
import { Druck } from './druck-teile';

/** Für jede Gestaltung, auch Seitenfläche und Seitenrahmen. */
export const DRUCK_TEILE: InspektorTeil[] = [
	{ id: 'druck', abschnitt: 9, reihenfolge: 1, fuer: () => true, Inhalt: Druck },
];
