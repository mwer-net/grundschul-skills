import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';

import { nrVon } from '../darstellung';
import { AUSSCHNITT } from './ausschnitt'; // 111
import type { GestaltungKontext } from './kontext';
import { PFAD_PUNKTE } from './pfad-modus'; // 116

/**
 * Doppelklick auf ein gewähltes Gestaltungselement (Andockstelle aus 097). Das erste passende Ziel gewinnt. Spätere
 * Tickets tragen je **eine Zeile** in `DOPPELKLICK` ein: 110 Bogen, 111 Ausschnitt, 116 Punkte bearbeiten,
 * 120 Kind wählen. `punkt` ist in Koordinaten des Materials.
 */
export interface DoppelklickZiel {
	id: string;
	passt: (element: Element, art: string) => boolean;
	/** `waehle` (120): wählt ein anderes Element, ohne Schritt. */
	tu: (g: GestaltungKontext, punkt: { x: number; y: number }, waehle: (nr: number) => void) => void;
}

/**
 * Schmuckschrift und Form mit Text: die Textsitzung wie bei Text heute, mit dem Cursor an der Stelle des Klicks. Der
 * erste Klick wählt nur (die Geste nimmt ihm den Fokus), darum braucht es hier den Fokus von Hand.
 */
const TEXT: DoppelklickZiel = {
	id: 'text',
	passt: (element) => element.matches('div.schmuck, .form-text'),
	tu: ({ doc, element }, { x, y }) => {
		const html = element as HTMLElement;
		if (html.getAttribute('contenteditable') !== 'true') {
			return;
		}
		html.focus({ preventScroll: true });
		const stelle = (doc as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
			.caretRangeFromPoint?.(x, y);
		const auswahl = doc.getSelection();
		if (stelle && auswahl && html.contains(stelle.startContainer)) {
			auswahl.removeAllRanges();
			auswahl.addRange(stelle);
		}
	},
};

/** 110: Titel im Bogen. Der Text steht in der Leiste am Element: Das Feld dort bekommt den Fokus. */
const BOGEN: DoppelklickZiel = {
	id: 'bogen',
	passt: (element) => element.matches('svg.schmuck[data-schmuck="bogen"]'),
	tu: () => {
		const feld = document.querySelector<HTMLInputElement>('[data-leiste-bogen-text]');
		feld?.focus();
		feld?.select();
	},
};

/**
 * 120: Doppelklick auf eine gewählte Gruppe wählt das Kind unter dem Zeiger (verschachtelt: das nächste Kind darin).
 * Ein gesperrtes Kind bleibt so nicht wählbar.
 */
const KIND: DoppelklickZiel = {
	id: 'kind',
	passt: (element) => element.matches('.gruppe'),
	tu: ({ doc, element }, { x, y }, waehle) => {
		for (let e = doc.elementFromPoint(x, y); e && e !== element; e = e.parentElement) {
			if (e.parentElement === element && e.matches(GESTALTUNG_SELEKTOR) && !e.hasAttribute('data-gesperrt')) {
				const nr = nrVon(e);
				if (nr !== null) {
					waehle(nr);
				}
				return;
			}
		}
	},
};

export const DOPPELKLICK: readonly DoppelklickZiel[] = [
	TEXT,
	BOGEN,
	AUSSCHNITT, // 111 Ausschnitt verschieben
	PFAD_PUNKTE, // 116 Punkte bearbeiten
	KIND, // 120 Kind einer Gruppe wählen
	// 110 Bogen, 111 Ausschnitt, 116 Punkte bearbeiten, 120 Kind wählen: je eine Zeile hier.
];

export const doppelklickZiel = (element: Element, art: string) => DOPPELKLICK.find((z) => z.passt(element, art));
