import { useSyncExternalStore } from 'react';

import type { Kasten } from './geste';

/**
 * Die Lage während einer Geste (171), damit der Inspektor mitläuft: Die Geste meldet hier denselben Kasten wie am
 * Zeiger, beim Ende `null`. Schreibt nichts in Quelle oder Verlauf; das tut weiter einmal das Loslassen. Muster wie
 * `mehrfach.ts`.
 */
export interface LiveLage {
	nr: number;
	/** Eine Mehrfachauswahl: Der Kasten gilt der ganzen Auswahl, nicht dem Element `nr`. */
	gruppe: boolean;
	kasten: Kasten;
}

let stand: LiveLage | null = null;
const hoerer = new Set<() => void>();

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const setzeLiveLage = (neu: LiveLage | null) => {
	if (neu === stand) {
		return;
	}
	stand = neu;
	for (const h of hoerer) {
		h();
	}
};

export const useLiveLage = () => useSyncExternalStore(abonniere, () => stand);
