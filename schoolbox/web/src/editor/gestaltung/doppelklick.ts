import type { GestaltungKontext } from './kontext';

/**
 * Doppelklick auf ein gewähltes Gestaltungselement (Andockstelle aus 097). Das erste passende Ziel gewinnt. Spätere
 * Tickets tragen je **eine Zeile** in `DOPPELKLICK` ein: 110 Bogen, 111 Ausschnitt, 116 Punkte bearbeiten,
 * 120 Kind wählen. `punkt` ist in Koordinaten des Materials.
 */
export interface DoppelklickZiel {
	id: string;
	passt: (element: Element, art: string) => boolean;
	tu: (g: GestaltungKontext, punkt: { x: number; y: number }) => void;
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

export const DOPPELKLICK: readonly DoppelklickZiel[] = [
	TEXT,
	BOGEN,
	// 110 Bogen, 111 Ausschnitt, 116 Punkte bearbeiten, 120 Kind wählen: je eine Zeile hier.
];

export const doppelklickZiel = (element: Element, art: string) => DOPPELKLICK.find((z) => z.passt(element, art));
