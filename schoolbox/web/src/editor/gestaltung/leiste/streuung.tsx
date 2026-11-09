import { leseStreuung } from '@schoolbox/kern/src/streuen';

import { Knopf } from '../../../bausteine/Knopf';
import { Popover } from '../../../bausteine/Popover';
import { DichteRegler, WuerfelKnopf } from '../inspektor/streuung';
import type { LeistenKnoepfe, LeistenTeile } from './typen';

/** Würfeln und Dichte (5.7), vor „Drehen“ und ⋯. Alles Weitere steht im Abschnitt „Streuung“ des Inspektors. */
const StreuungKnoepfe = ({ aktiv, k, quelle }: LeistenTeile) => {
	const stand = leseStreuung(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<>
			<WuerfelKnopf k={k} aktiv={aktiv} />
			<Popover
				name="Dichte"
				className="w-56"
				ausloeser={
					<Knopf art="leise" groesse="klein" data-leiste-dichte disabled={!aktiv}>
						<span className="tabular-nums">{`Dichte ${Math.round(stand.dichte * 100)} %`}</span>
					</Knopf>
				}
			>
				<DichteRegler k={k} quelle={quelle} aktiv={aktiv} />
			</Popover>
		</>
	);
};

export const STREUUNG_LEISTE: LeistenKnoepfe | null = StreuungKnoepfe;
