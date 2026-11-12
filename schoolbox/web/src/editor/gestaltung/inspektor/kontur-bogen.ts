import type { InspektorTeil } from './abschnitte';
import { KonturBogen } from './kontur-bogen-teile';

/** Nur Schmuckschrift hat Kontur; Form mit Text (107) und die Formen haben ihre eigene. */
const hatKontur = (art: string) => art === 'schmuck' || art === 'schmuckbogen';

export const KONTUR_BOGEN_TEILE: InspektorTeil[] = [
	{ id: 'kontur-bogen', abschnitt: 3, reihenfolge: 2, fuer: (art) => hatKontur(art), Inhalt: KonturBogen },
];
