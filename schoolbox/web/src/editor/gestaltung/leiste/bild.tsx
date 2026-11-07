import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import type { LeistenKnoepfe } from './typen';

/**
 * Leiste am freien Bild (103): „Austauschen“ öffnet die Schublade „Bilder“ (⌥6); ein Klick dort oder ein Bild aufs
 * gewählte gezogen tauscht es aus. Ist sie schon offen, bleibt sie offen. Rahmen-Stil: 111.
 */
export const BILD_LEISTE: LeistenKnoepfe = ({ aktiv, befehle }) => (
	<Knopf
		art="leise"
		groesse="klein"
		disabled={!aktiv}
		data-bild-austauschen
		onClick={() => {
			const k = befehle.jetzt.current;
			if (k.linksOffen !== 'bilder') {
				k.tu.links('bilder');
			}
		}}
	>
		<Symbol name="bild" />
		Austauschen
	</Knopf>
);
