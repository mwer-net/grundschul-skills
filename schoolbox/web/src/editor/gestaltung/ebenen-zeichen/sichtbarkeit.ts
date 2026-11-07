import { setzeAus, setzeGesperrt } from '@schoolbox/kern/src/gestaltung';
import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';

import type { EbenenZeichen } from '../ebenen-zeichen';

/** Auge und Schloss (101): je ein Schritt, die Auswahl bleibt, wo sie ist. */
export const SICHTBARKEIT_ZEICHEN: EbenenZeichen[] = [
	{
		id: 'schloss',
		fuer: (e) => e.matches(GESTALTUNG_SELEKTOR),
		gesetzt: (e) => e.hasAttribute('data-gesperrt'),
		schalter: true,
		symbol: (an) => (an ? 'schloss' : 'entsperrt'),
		titel: (an) => (an ? 'Entsperren' : 'Sperren'),
		klick: ({ nr, struktur }, an) =>
			struktur.aendereAttribute(an ? 'Entsperrt' : 'Gesperrt', (q) => setzeGesperrt(q, nr, !an)),
	},
	{
		id: 'auge',
		fuer: (e) => e.matches(GESTALTUNG_SELEKTOR),
		gesetzt: (e) => e.hasAttribute('data-aus'),
		schalter: true,
		symbol: (an) => (an ? 'ausgeblendet' : 'auge'),
		titel: (an) => (an ? 'Einblenden' : 'Ausblenden'),
		klick: ({ nr, struktur }, an) =>
			struktur.aendereAttribute(an ? 'Eingeblendet' : 'Ausgeblendet', (q) => setzeAus(q, nr, !an)),
	},
];
