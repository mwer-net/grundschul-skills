import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
import { kuerzelVon } from '../../befehle';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Gruppe (120, Briefing 5.7): „Auflösen“ vor „Drehen“ und ⋯. */
const GruppeKnoepfe = ({ aktiv, befehle }: LeistenTeile) => (
	<Tooltip text="Gruppe auflösen" kuerzel={kuerzelVon('auswahl.gruppe-aufloesen')}>
		<Knopf
			art="leise"
			groesse="klein"
			data-befehl="auswahl.gruppe-aufloesen"
			disabled={!aktiv}
			onClick={() => befehle.fuehreAus('auswahl.gruppe-aufloesen')}
		>
			<Symbol name="aufloesen" />
			Auflösen
		</Knopf>
	</Tooltip>
);

export const GRUPPE_LEISTE: LeistenKnoepfe | null = GruppeKnoepfe;
