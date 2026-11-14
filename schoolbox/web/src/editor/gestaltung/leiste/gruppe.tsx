import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
import { kuerzelVon } from '../../befehle';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Gruppe (120): „Gruppe auflösen“, dasselbe Wort wie im Register (204-14). */
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
			Gruppe auflösen
		</Knopf>
	</Tooltip>
);

export const GRUPPE_LEISTE: LeistenKnoepfe | null = GruppeKnoepfe;
