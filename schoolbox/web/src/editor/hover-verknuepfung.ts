import { useSyncExternalStore } from 'react';

import { elementZu } from './darstellung';
import type { Klickziel } from './klickziel';

/**
 * Hover zwischen Ebenen und Blatt (195): Ruht der Zeiger auf einer Ebenen-Zeile, zeigt das Blatt den Hover-Rahmen
 * (205) um dasselbe Element; ruht er auf dem Blatt, hebt die Ebenen-Liste die Zeile leicht hervor. Ein Editor ist
 * offen, darum genügt ein Stand für die ganze Seite.
 */
interface Stand {
	/** Unter dem Zeiger im Blatt. */
	blatt: number | null;
	/** Unter dem Zeiger in den Ebenen. */
	zeile: number | null;
}

let stand: Stand = { blatt: null, zeile: null };
const hoerer = new Set<() => void>();

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const setzeHover = (teil: keyof Stand, nr: number | null) => {
	if (stand[teil] === nr) {
		return;
	}
	stand = { ...stand, [teil]: nr };
	for (const h of hoerer) {
		h();
	}
};

export const useHover = (teil: keyof Stand) =>
	useSyncExternalStore(
		abonniere,
		() => stand[teil],
		() => null,
	);

/** Das Ziel des Hover-Rahmens zu einer Ebenen-Zeile; `null`, wenn das Element nicht (mehr) im Blatt steht. */
export const zielZurZeile = (doc: Document, nr: number): Klickziel | null => {
	const element = elementZu(doc, nr);
	if (!element) {
		return null;
	}
	return { art: element.getAttribute('data-lage') === 'frei' ? 'gestaltung' : 'baustein', nr, element };
};
