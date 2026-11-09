import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Gruppe (120, Briefing 5.7): „Auflösen“ vor „Drehen“ und ⋯. */
const GruppeKnoepfe = ({ aktiv, befehle }: LeistenTeile) => (
	<Knopf
		art="leise"
		groesse="klein"
		data-befehl="auswahl.gruppe-aufloesen"
		disabled={!aktiv}
		title="Gruppe auflösen (⇧⌘G)"
		onClick={() => befehle.fuehreAus('auswahl.gruppe-aufloesen')}
	>
		<Symbol name="aufloesen" />
		Auflösen
	</Knopf>
);

export const GRUPPE_LEISTE: LeistenKnoepfe | null = GruppeKnoepfe;
