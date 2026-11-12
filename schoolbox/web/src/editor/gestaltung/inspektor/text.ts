import type { InspektorTeil } from './abschnitte';
import { Text } from './text-teile';

/** Schmuckschrift und Form mit Text (107) lesen dieselben Variablen; Hintergrund hat nur das Etikett. */
const istTextArt = (art: string) => art === 'schmuck' || art === 'formtext';

export const TEXT_TEILE: InspektorTeil[] = [
	{
		id: 'text',
		abschnitt: 3,
		reihenfolge: 1,
		fuer: (art, b) => istTextArt(art) && b.faehigkeiten.includes('text'),
		Inhalt: Text,
	},
];
