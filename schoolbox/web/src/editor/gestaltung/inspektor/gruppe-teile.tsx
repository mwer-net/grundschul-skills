import { kinderDerGruppe } from '@schoolbox/kern/src/gruppen';

import type { InspektorTeile } from './abschnitte';

/** „Gruppe · 3 Teile“ über Lage und Größe; Füllung und Kontur gibt es nur an den Kindern (einzeln wählen). */
export const GruppeKopf = ({ k, quelle }: InspektorTeile) => {
	let teile = 0;
	try {
		teile = kinderDerGruppe(quelle, k.nr).length;
	} catch {
		return null;
	}
	return (
		<p className="text-sm text-leise" data-gruppe-teile={teile}>
			{`Gruppe · ${teile} ${teile === 1 ? 'Teil' : 'Teile'}`}
		</p>
	);
};
