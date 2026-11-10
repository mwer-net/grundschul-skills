import type { InspektorTeil } from './abschnitte';
import { GruppeKopf } from './gruppe-teile';

/** Gruppe (120): Abschnitt 2 beginnt mit der Zahl der Teile, danach Lage, Größe und Drehen aus `position.tsx`. */
export const GRUPPE_TEILE: InspektorTeil[] = [
	{ id: 'gruppe-kopf', abschnitt: 2, reihenfolge: -1, fuer: (art) => art === 'gruppe', Inhalt: GruppeKopf },
];
