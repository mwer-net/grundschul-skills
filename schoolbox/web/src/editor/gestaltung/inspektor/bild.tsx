import { useBildKontext } from '../../bild';
import { Bildwerkzeug } from '../../Bildpanel';
import type { InspektorTeil, InspektorTeile } from './abschnitte';

/**
 * Abschnitt „Bild“ bei freien Bildern (103): Vorschau, Hinweise (unscharf, s/w-Fassung), Austauschen (Hochladen, Aus
 * der Sammlung) und Beschreibung aus dem Bild-Panel, ohne den Regler „Größe“: Die Größe steht in `--b` und gehört zu
 * „Position und Größe“ und den Griffen. Rahmen-Stil und Zuschnitt: 111.
 */
const Inhalt = ({ k }: InspektorTeile) => {
	const bild = useBildKontext();
	return bild?.werte?.nr === k.nr ? <Bildwerkzeug bild={bild} ohneEntfernen /> : null;
};

export const BILD_TEILE: InspektorTeil[] = [
	{ id: 'bild', abschnitt: 6, reihenfolge: 1, fuer: (art) => art === 'bildfrei', Inhalt },
];
