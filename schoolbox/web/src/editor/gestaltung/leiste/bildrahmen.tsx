import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { oeffneBilder } from './bild';
import type { LeistenKnoepfe } from './typen';

/**
 * Leiste am leeren Bildrahmen (172): Der leere Rahmen wird gefüllt wie ein Platzhalter. „Bild einsetzen“ öffnet die
 * Schublade „Bilder“ wie „Austauschen“ am freien Bild; ein Klick dort oder „Foto hochladen“ füllt den Rahmen.
 */
export const BILDRAHMEN_LEISTE: LeistenKnoepfe = ({ aktiv, befehle }) => (
	<Knopf art="leise" groesse="klein" disabled={!aktiv} data-bild-einsetzen onClick={() => oeffneBilder(befehle)}>
		<Symbol name="bild" />
		Bild einsetzen
	</Knopf>
);
