import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';

import { nrVon } from '../../darstellung';
import type { EbenenZeichen } from '../ebenen-zeichen';

/** ⚓ Anker (106, 1-ebenen.md): hängt am Baustein darüber, Klick wählt den Baustein. Kein Schalter. */
export const ANKER_ZEICHEN: EbenenZeichen[] = [
	{
		id: 'anker',
		fuer: (e) => e.matches(GESTALTUNG_SELEKTOR) && e.hasAttribute('data-anker'),
		gesetzt: () => true,
		schalter: false,
		symbol: () => 'anker',
		titel: () => 'Hängt am Baustein darüber: wählt ihn',
		klick: ({ element, zeigeAn }) => {
			const baustein = element.parentElement ? nrVon(element.parentElement) : null;
			if (baustein !== null) {
				zeigeAn(baustein);
			}
		},
	},
];
