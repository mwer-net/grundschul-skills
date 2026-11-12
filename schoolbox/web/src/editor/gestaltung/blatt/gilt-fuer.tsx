import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import type { Gilt } from './gilt';
import type { BlattTeile } from './teile';

/** Die Zeile „Gilt für“, nur bei mehr als einer Seite. */
export const GiltFuer = ({ gilt, setze, t }: { gilt: Gilt; setze: (gilt: Gilt) => void; t: BlattTeile }) =>
	t.seiten > 1 ? (
		<Zeile titel="Gilt für">
			<Segment
				beschriftung="Gilt für"
				werte={[
					{ wert: 'alle', titel: 'Alle Seiten' },
					{ wert: 'seite', titel: `Seite ${t.index + 1}` },
				]}
				wert={gilt}
				waehle={setze}
			/>
		</Zeile>
	) : null;
