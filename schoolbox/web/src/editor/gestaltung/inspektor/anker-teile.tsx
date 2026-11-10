import { ankerVon, ankerZiele, haengeAn, loeseAnker } from '@schoolbox/kern/src/anker';

import { elementZu } from '../../darstellung';
import { ankerBeschriftung, lageInSeite, messeAnhaengen } from '../anker-lage';
import type { InspektorTeile } from './abschnitte';

const FELD =
	'h-feld min-w-0 flex-1 rounded-md border border-rand-feld bg-flaeche px-1 text-sm text-tinte disabled:opacity-50';

const FREI = '';

/**
 * „Hängt an“ (106, Briefing 5.8 Abschnitt 8): „Seite (frei)“ oder ein Baustein derselben Seite, beschriftet wie in den
 * Ebenen. Ein Wechsel ist ein Schritt; die Lage im Blatt bleibt.
 */
export const Anker = ({ aktiv, k, quelle }: InspektorTeile) => {
	const seite = k.seiteVon(k.nr);
	const jetzt = ankerVon(quelle, k.nr);
	// Hängt es (von Claude) an einem Baustein, der sonst nicht in der Liste stünde, steht er trotzdem darin.
	const nrn = seite === null ? [] : ankerZiele(quelle, seite);
	const alle = jetzt === null || nrn.includes(jetzt) ? nrn : [jetzt, ...nrn];
	const ziele = alle.flatMap((nr) => {
		const element = elementZu(k.doc, nr);
		return element ? [{ nr, element, titel: ankerBeschriftung(element) }] : [];
	});
	const waehle = (wert: string) => {
		if (wert === FREI) {
			const lage = lageInSeite(k.element);
			k.fuehreAus('Vom Baustein gelöst', (q) => loeseAnker(q, k.nr, { lage }));
			return;
		}
		const ziel = ziele.find((z) => String(z.nr) === wert);
		if (ziel) {
			const mass = messeAnhaengen(k.element, ziel.element);
			k.fuehreAus(`An ${ziel.titel.split(' · ')[0] ?? 'Baustein'} gehängt`, (q) =>
				haengeAn(q, k.nr, ziel.nr, mass),
			);
		}
	};
	return (
		<label className="flex h-zeile items-center justify-between gap-2" data-gestaltung-anker>
			<span className="flex-none text-leise">Hängt an</span>
			<select
				aria-label="Hängt an"
				className={FELD}
				value={jetzt === null ? FREI : String(jetzt)}
				disabled={!aktiv || (ziele.length === 0 && jetzt === null)}
				onChange={({ target: { value } }) => waehle(value)}
			>
				<option value={FREI}>Seite (frei)</option>
				{ziele.map((z) => (
					<option key={z.nr} value={String(z.nr)}>
						{z.titel}
					</option>
				))}
			</select>
		</label>
	);
};
