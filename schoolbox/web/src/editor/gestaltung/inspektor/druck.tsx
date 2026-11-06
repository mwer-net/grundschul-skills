import type { SwVerhalten } from '@schoolbox/kern/src/gestaltung';
import { setzeSw } from '@schoolbox/kern/src/gestaltung';
import { leseSw, swZumSchreiben } from '@schoolbox/kern/src/gestaltung-inspektor';
import { leseSichtbarkeit, setzeSichtbarkeit } from '@schoolbox/kern/src/kit-einstellungen';

import { Segment } from '../../../bausteine/Segment';
import type { InspektorTeil, InspektorTeile } from './abschnitte';

const SW: { wert: SwVerhalten; titel: string }[] = [
	{ wert: 'grau', titel: 'grau' },
	{ wert: 'weg', titel: 'weg' },
];

/** Dieselben Klassen wie „Sichtbarkeit“ bei Bausteinen (`nur-loesung`, `nicht-loesung`), andere Worte (Briefing 4.5). */
const ZEIGEN = [
	{ wert: '', titel: 'immer' },
	{ wert: 'loesung', titel: 'nur in der Lösung' },
	{ wert: 'arbeitsblatt', titel: 'nicht in der Lösung' },
];

const FELD =
	'h-feld min-w-0 flex-1 rounded-md border border-rand-feld bg-flaeche px-1 text-sm text-tinte disabled:opacity-50';

const Druck = ({ aktiv, k, quelle }: InspektorTeile) => {
	const sw = leseSw(quelle, k.nr, k.art);
	const zeigen = leseSichtbarkeit(quelle, k.nr);
	return (
		<div className="flex flex-col gap-1" data-gestaltung-druck>
			<div className="flex h-zeile items-center justify-between gap-2">
				<span className="text-leise">In s/w</span>
				<Segment
					beschriftung="In s/w"
					werte={SW}
					wert={sw}
					aus={!aktiv}
					waehle={(neu) =>
						k.fuehreAus(neu === 'weg' ? 'In s/w weg' : 'In s/w grau', (q) => ({
							quelle: setzeSw(q, k.nr, swZumSchreiben(k.art, neu)),
							nr: k.nr,
						}))
					}
				/>
			</div>
			<label className="flex h-zeile items-center justify-between gap-2">
				<span className="flex-none text-leise">Zeigen</span>
				<select
					aria-label="Zeigen"
					className={FELD}
					value={zeigen}
					disabled={!aktiv}
					data-gestaltung-zeigen
					onChange={({ target: { value } }) =>
						k.fuehreAus('Sichtbarkeit geändert', (q) => ({
							quelle: setzeSichtbarkeit(q, k.nr, value),
							nr: k.nr,
						}))
					}
				>
					{ZEIGEN.map((z) => (
						<option key={z.wert} value={z.wert}>
							{z.titel}
						</option>
					))}
				</select>
			</label>
		</div>
	);
};

/** Für jede Gestaltung, auch Seitenfläche und Seitenrahmen. */
export const DRUCK_TEILE: InspektorTeil[] = [{ id: 'druck', abschnitt: 9, reihenfolge: 1, fuer: () => true, Inhalt: Druck }];
