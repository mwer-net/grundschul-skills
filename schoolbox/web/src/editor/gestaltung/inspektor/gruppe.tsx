import { kinderDerGruppe } from '@schoolbox/kern/src/gruppen';

import type { InspektorTeil, InspektorTeile } from './abschnitte';

/** „Gruppe · 3 Teile“ über Lage und Größe; Füllung und Kontur gibt es nur an den Kindern (einzeln wählen). */
const GruppeKopf = ({ k, quelle }: InspektorTeile) => {
	let teile = 0;
	try {
		teile = kinderDerGruppe(quelle, k.nr).length;
	} catch {
		return null;
	}
	return (
		<p className="text-sm text-leise" data-gruppe-teile={teile}>
			{`Gruppe · ${teile} ${teile === 1 ? 'Teil' : 'Teile'}. Doppelklick wählt ein Teil.`}
		</p>
	);
};

/** Gruppe (120): Abschnitt 2 beginnt mit der Zahl der Teile, danach Lage, Größe und Drehen aus `position.tsx`. */
export const GRUPPE_TEILE: InspektorTeil[] = [
	{ id: 'gruppe-kopf', abschnitt: 2, reihenfolge: -1, fuer: (art) => art === 'gruppe', Inhalt: GruppeKopf },
];
