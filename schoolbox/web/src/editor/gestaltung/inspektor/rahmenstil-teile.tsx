import type { Rahmenstil } from '@schoolbox/kern/src/bildrahmen';
import {
	leseBildrahmen,
	RAHMENSTIL_NAMEN,
	RAHMENSTIL_WAHL,
	setzeMaske,
	setzeRahmenstil,
	setzeZuschnittZurueck,
} from '@schoolbox/kern/src/bildrahmen';
import type { Form } from '@schoolbox/kern/src/formen';
import { standardWerte } from '@schoolbox/kern/src/formen';
import { MASKEN_FORMEN } from '@schoolbox/kern/src/formen-masken';

import { KACHEL } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Tooltip } from '../../../bausteine/Tooltip';
import { Zeile } from '../../../bausteine/Zeile';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeile } from './abschnitte';

/**
 * Rahmen-Stil und Form (111, 5.8 Abschnitt 4), nach „Bild“: Rahmen-Stil (Ohne, Polaroid, Kontur), Form (Ohne, dann
 * die Formen ohne Text; in der Quelle `data-maske`) und „Ausschnitt zurücksetzen“, sobald der Ausschnitt verschoben
 * oder zugeschnitten ist. Form und Rahmen-Stil schließen sich aus: Wählt man das eine, verliert das andere seinen
 * Ring; der Tooltip der Kachel sagt es vorher. Beim leeren Bildrahmen gibt es nur die Form. Ein Stil aus dem Bestand,
 * der nicht mehr zur Wahl steht („Schräg“, „Rund“, 199-01/07), drückt keinen Knopf; „Ohne“ nimmt ihn weg.
 */

type StilWahl = Rahmenstil | 'ohne';

const STILE: { wert: StilWahl; titel: string }[] = [
	{ wert: 'ohne', titel: 'Ohne' },
	...RAHMENSTIL_WAHL.map((wert) => ({ wert, titel: RAHMENSTIL_NAMEN[wert] })),
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
	const stil: StilWahl = stand.rahmenstil ?? 'ohne';
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
							// Ein Stil nimmt die Form weg: Das steht am Knopf.
							const nimmtForm = s.wert !== 'ohne' && stand.maske !== null;
							return (
								<Tooltip key={s.wert} text={nimmtForm ? `${s.titel}: nimmt die Form weg` : s.titel}>
									<button
										type="button"
										className={KACHEL}
										aria-pressed={stil === s.wert && (s.wert === 'ohne' || stand.maske === null)}
										disabled={!aktiv}
										data-rahmenstil-knopf={s.wert}
										onClick={() => {
											setze(
												k,
												s.wert === 'ohne' ? 'Rahmen-Stil entfernt' : 'Rahmen-Stil geändert',
												(q) => setzeRahmenstil(q, k.nr, s.wert === 'ohne' ? null : s.wert),
											);
										}}
									>
										{s.titel}
									</button>
								</Tooltip>
							);
						})}
					</div>
				</Zeile>
			)}
			<Zeile titel="Form" darunter>
				<div
					className="grid grid-cols-5 gap-1"
					role="group"
					aria-label="Form"
					data-maske-wahl={stand.maske ?? 'keine'}
				>
					{!stand.leer && (
						<Tooltip text="Ohne Form">
							<button
								type="button"
								className={KACHEL}
								aria-pressed={stand.maske === null}
								disabled={!aktiv}
								data-maske-knopf="keine"
								onClick={() => setze(k, 'Form entfernt', (q) => setzeMaske(q, k.nr, null))}
							>
								Ohne
							</button>
						</Tooltip>
					)}
					{MASKEN_FORMEN.map((f) => (
						<Tooltip key={f.art} text={stand.rahmenstil ? `${f.name}: nimmt den Rahmen-Stil weg` : f.name}>
							<button
								type="button"
								className={KACHEL}
								aria-pressed={stand.maske === f.art}
								aria-label={f.name}
								disabled={!aktiv}
								data-maske-knopf={f.art}
								onClick={() => setze(k, 'Form geändert', (q) => setzeMaske(q, k.nr, f.art))}
							>
								<FormBild form={f} />
							</button>
						</Tooltip>
					))}
				</div>
			</Zeile>
			{!stand.leer && stand.zuschnitt && (
				<Knopf
					art="zweit"
					groesse="klein"
					className="self-start"
					disabled={!aktiv}
					data-zuschnitt-zurueck
					onClick={() => setze(k, 'Ausschnitt zurückgesetzt', (q) => setzeZuschnittZurueck(q, k.nr))}
				>
					Ausschnitt zurücksetzen
				</Knopf>
			)}
		</div>
	);
};
