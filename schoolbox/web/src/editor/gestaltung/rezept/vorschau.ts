import type { Konfetti } from '@schoolbox/kern/src/aufmachungen';
import { leseAufmachung, TEIL, wendeAufmachungAn } from '@schoolbox/kern/src/aufmachungen';

import { quellSeiten } from '../blatt/teile';

const STREUUNG = `:scope > .ebene.hinten > [${TEIL}="streuung"]`;

/**
 * Anzeige während des Konfetti-Schiebers (119): Das Rezept rechnet die Streuungen mit dem neuen Wert, und das Blatt
 * zeigt sie an Stelle der alten. Ohne Schritt und ohne Speichern; beim Loslassen schreibt der Regler.
 */
export const zeigeKonfetti = (doc: Document | null, quelle: string, konfetti: Konfetti) => {
	const w = leseAufmachung(quelle);
	if (!doc || !w) {
		return;
	}
	const neu = new DOMParser().parseFromString(wendeAufmachungAn(quelle, w.id, { ...w, konfetti }), 'text/html');
	const neueSeiten = [...neu.querySelectorAll('.seite')];
	quellSeiten(doc).forEach((seite, i) => {
		for (const alt of seite.querySelectorAll(STREUUNG)) {
			alt.remove();
		}
		const ebene = seite.querySelector(':scope > .ebene.hinten');
		for (const e of neueSeiten[i]?.querySelectorAll(STREUUNG) ?? []) {
			ebene?.append(doc.importNode(e, true));
		}
	});
};
