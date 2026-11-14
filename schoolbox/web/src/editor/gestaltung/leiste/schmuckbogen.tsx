import { BogenTextFeld } from '../inspektor/kontur-bogen-teile';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/**
 * Titel im Bogen an der Leiste (110, 204-12): nur das einzeilige Textfeld, denn im Blatt lässt sich der Bogen nicht
 * tippen. Schrift, Größe, Farbe, Kontur und Krümmung stehen im Inspektor. Das Feld bekommt beim Doppelklick auf den
 * Bogen den Fokus; Enter oder Verlassen übernimmt, Esc verwirft.
 */
const SchmuckbogenKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => (
	<BogenTextFeld k={k} quelle={quelle} aktiv={aktiv} leiste />
);

export const SCHMUCKBOGEN_LEISTE: LeistenKnoepfe | null = SchmuckbogenKnoepfe;
