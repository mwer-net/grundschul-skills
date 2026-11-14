import { useEffect, useSyncExternalStore } from 'react';

import type { PalettenEintrag } from '../editor/palette-suche';

/**
 * Befehle der gerade gezeigten Seite für ⌘K (191 Urteil 5): Die Ansicht meldet „Bearbeiten“, „PDF“ … an, die
 * Seitenpalette zeigt sie oben. Es gibt immer nur eine Seite, also eine Liste.
 */
let befehle: readonly PalettenEintrag[] = [];
const hoerer = new Set<() => void>();

const setze = (liste: readonly PalettenEintrag[]) => {
	befehle = liste;
	hoerer.forEach((h) => h());
};

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const useSeitenbefehle = () => useSyncExternalStore(abonniere, () => befehle);

/** Meldet `liste` an, solange die Seite steht; `liste` sollte stabil sein (useMemo). */
export const useMeldeSeitenbefehle = (liste: readonly PalettenEintrag[]) => {
	useEffect(() => {
		setze(liste);
		return () => {
			if (befehle === liste) {
				setze([]);
			}
		};
	}, [liste]);
};
