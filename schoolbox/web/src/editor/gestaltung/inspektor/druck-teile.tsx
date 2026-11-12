import type { SwVerhalten } from '@schoolbox/kern/src/gestaltung';
import { setzeSw } from '@schoolbox/kern/src/gestaltung';
import { leseSw, swZumSchreiben } from '@schoolbox/kern/src/gestaltung-inspektor';
import { leseSichtbarkeit, setzeSichtbarkeit, SICHTBARKEITEN } from '@schoolbox/kern/src/kit-einstellungen';

import { FELD_KLASSEN } from '../../../bausteine/klassen';
import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import type { InspektorTeile } from './abschnitte';

const SW: { wert: SwVerhalten; titel: string }[] = [
	{ wert: 'grau', titel: 'Grau' },
	{ wert: 'weg', titel: 'Weg' },
];

/**
 * Abschnitt 9 „Sichtbarkeit“ (185): oben dasselbe Menü wie bei den Bausteinen (`SICHTBARKEITEN`, Klassen `nur-loesung`
 * und `nicht-loesung`), ohne eigene Beschriftung; darunter, wie das Element in s/w aussieht (Entscheidung 46).
 */
export const Druck = ({ aktiv, k, quelle }: InspektorTeile) => (
	<div className="flex flex-col gap-1" data-gestaltung-druck>
		<select
			aria-label="Sichtbarkeit"
			className={FELD_KLASSEN}
			value={leseSichtbarkeit(quelle, k.nr)}
			disabled={!aktiv}
			data-gestaltung-zeigen
			onChange={({ target: { value } }) => {
				k.fuehreAus('Sichtbarkeit geändert', (q) => ({
					quelle: setzeSichtbarkeit(q, k.nr, value),
					nr: k.nr,
				}));
			}}
		>
			{SICHTBARKEITEN.map((s) => (
				<option key={s.wert} value={s.wert}>
					{s.titel}
				</option>
			))}
		</select>
		<Zeile titel="In s/w">
			<Segment
				beschriftung="In s/w"
				werte={SW}
				wert={leseSw(quelle, k.nr, k.art)}
				aus={!aktiv}
				waehle={(neu) => {
					k.fuehreAus(neu === 'weg' ? 'In s/w weg' : 'In s/w grau', (q) => ({
						quelle: setzeSw(q, k.nr, swZumSchreiben(k.art, neu)),
						nr: k.nr,
					}));
				}}
			/>
		</Zeile>
	</div>
);
