import { useBildKontext } from '../../bild';
import { Bildwerkzeug } from '../../Bildpanel';
import type { InspektorTeile } from './abschnitte';

/**
 * Abschnitt „Bild“ bei freien Bildern (103): Austauschen (Foto hochladen, Aus Bildern wählen), Hinweise (unscharf,
 * s/w-Fassung) und Beschreibung aus dem Bild-Panel, ohne den Regler „Größe“: Die Größe steht in `--b` und gehört zu
 * „Anordnen“ und den Griffen. Beim leeren Bildrahmen (172) „Bild einsetzen“ wie beim Platzhalter. Form und
 * Ausschnitt: 111.
 */
export const Inhalt = ({ k }: InspektorTeile) => {
	const bild = useBildKontext();
	return bild?.werte?.nr === k.nr ? <Bildwerkzeug bild={bild} /> : null;
};
