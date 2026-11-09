import { nrVon } from '../../darstellung';
import type { EbenenZeichen } from '../ebenen-zeichen';

/**
 * Rezept-Zeichen (119): an Fläche, Rahmen und Streuungen eines Rezepts (`data-aufmachung-teil`). Kein Schalter; der
 * Klick öffnet Blatt › Gestaltung dieser Seite, wo das Rezept steht.
 */
export const REZEPT_ZEICHEN: EbenenZeichen[] = [
	{
		id: 'rezept',
		fuer: (element) => element.hasAttribute('data-aufmachung-teil'),
		gesetzt: () => true,
		schalter: false,
		symbol: () => 'rezepte',
		titel: () => 'Teil des Rezepts: im Reiter „Blatt“ anpassen',
		klick: (k) => {
			const seite = k.element.closest('.seite');
			const nr = seite ? nrVon(seite) : null;
			if (nr !== null) {
				k.zeigeSeitengestaltung(nr);
			}
		},
	},
];
