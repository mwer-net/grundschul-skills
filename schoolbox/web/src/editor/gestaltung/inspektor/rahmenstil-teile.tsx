import type { Rahmenstil } from '@schoolbox/kern/src/bildrahmen';
import {
	leseBildrahmen,
	RAHMENSTIL_NAMEN,
	RAHMENSTILE,
	setzeMaske,
	setzeRahmenstil,
	setzeZuschnittZurueck,
} from '@schoolbox/kern/src/bildrahmen';
import type { Form } from '@schoolbox/kern/src/formen';
import { standardWerte } from '@schoolbox/kern/src/formen';
import { MASKEN_FORMEN } from '@schoolbox/kern/src/formen-masken';

import { KACHEL } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Zeile } from '../../../bausteine/Zeile';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeile } from './abschnitte';

/**
 * Rahmen-Stil und Maske (111, 5.8 Abschnitt 6), nach „Bild“: Rahmen-Stil (gerade, schräg, Polaroid, rund, Kontur),
 * Maske (keine, dann die Formen ohne Text) und „Zuschnitt zurücksetzen“. Maske und Rahmen-Stil schließen sich aus:
 * Wählt man das eine, verliert das andere seinen Ring; der `title` der Kachel sagt es vorher. Beim leeren Bildrahmen
 * gibt es nur die Form. Die Leiste am Bild zeigt dieselbe Wahl im Popover „Rahmen-Stil“.
 */

type StilWahl = Rahmenstil | 'gerade';

const STILE: { wert: StilWahl; titel: string }[] = [
	{ wert: 'gerade', titel: 'Gerade' },
	...RAHMENSTILE.map((wert) => ({ wert, titel: RAHMENSTIL_NAMEN[wert] })),
];

/** Kleines Bild der Form für die Knöpfe der Maske. */
const FormBild = ({ form }: { form: Form }) => {
	const { d, viewBox } = form.zeichne(standardWerte(form), 20, 20, 0);
	return (
		<svg aria-hidden viewBox={viewBox} className="size-4 flex-none overflow-visible">
			<path d={d} fill="currentColor" />
		</svg>
	);
};

const setze = (k: GestaltungKontext, beschreibung: string, rechne: (q: string) => string) =>
	k.fuehreAus(beschreibung, (q) => ({ quelle: rechne(q), nr: k.nr }));

/** Die ganze Wahl; Inspektor und Popover der Leiste teilen sie. */
export const RahmenstilWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const stand = leseBildrahmen(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const stil: StilWahl = stand.rahmenstil ?? 'gerade';
	return (
		<div className="flex flex-col gap-1" data-gestaltung-rahmenstil>
			{!stand.leer && (
				<Zeile titel="Rahmen-Stil" darunter>
					<div
						className="grid grid-cols-3 gap-1"
						role="group"
						aria-label="Rahmen-Stil"
						data-rahmenstil-wahl={stil}
					>
						{STILE.map((s) => {
							// Ein Stil nimmt die Maske weg: Das steht am Knopf.
							const nimmtMaske = s.wert !== 'gerade' && stand.maske !== null;
							return (
								<button
									key={s.wert}
									type="button"
									className={KACHEL}
									aria-pressed={stil === s.wert && stand.maske === null}
									disabled={!aktiv}
									data-rahmenstil-knopf={s.wert}
									title={nimmtMaske ? `${s.titel}: nimmt die Maske weg` : s.titel}
									onClick={() => {
										setze(
											k,
											s.wert === 'gerade' ? 'Rahmen-Stil entfernt' : 'Rahmen-Stil geändert',
											(q) => setzeRahmenstil(q, k.nr, s.wert === 'gerade' ? null : s.wert),
										);
									}}
								>
									{s.titel}
								</button>
							);
						})}
					</div>
				</Zeile>
			)}
			<Zeile titel={stand.leer ? 'Form des Rahmens' : 'Maske'} darunter>
				<div
					className="grid grid-cols-5 gap-1"
					role="group"
					aria-label="Maske"
					data-maske-wahl={stand.maske ?? 'keine'}
				>
					{!stand.leer && (
						<button
							type="button"
							className={KACHEL}
							aria-pressed={stand.maske === null}
							disabled={!aktiv}
							data-maske-knopf="keine"
							title="Keine Maske"
							onClick={() => setze(k, 'Maske entfernt', (q) => setzeMaske(q, k.nr, null))}
						>
							Keine
						</button>
					)}
					{MASKEN_FORMEN.map((f) => (
						<button
							key={f.art}
							type="button"
							className={KACHEL}
							aria-pressed={stand.maske === f.art}
							aria-label={f.name}
							disabled={!aktiv}
							data-maske-knopf={f.art}
							title={stand.rahmenstil ? `${f.name}: nimmt den Rahmen-Stil weg` : f.name}
							onClick={() => setze(k, 'Maske geändert', (q) => setzeMaske(q, k.nr, f.art))}
						>
							<FormBild form={f} />
						</button>
					))}
				</div>
			</Zeile>
			{!stand.leer && (
				<Knopf
					art="zweit"
					groesse="klein"
					className="self-start"
					disabled={!aktiv || !stand.zuschnitt}
					data-zuschnitt-zurueck
					onClick={() => setze(k, 'Zuschnitt zurückgesetzt', (q) => setzeZuschnittZurueck(q, k.nr))}
				>
					Zuschnitt zurücksetzen
				</Knopf>
			)}
		</div>
	);
};
