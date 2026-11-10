import { useSyncExternalStore } from 'react';

import type { Hilfslinie } from './einrasten';

/** `null` oder keine Linien: weg damit. */
export const zeigeAblageLinien = (stand: AblageLinien | null) => {
	const neu = stand && stand.linien.length > 0 ? stand : null;
	if (neu === ablage) {
		return;
	}
	ablage = neu;
	for (const h of hoerer) {
		h();
	}
};

/** Die Linien beim Ablegen in dieses Dokument, sonst `null`. */
export const useAblageLinien = (doc: Document) => {
	const stand = useSyncExternalStore(abonniere, () => ablage);
	return stand?.doc === doc ? stand : null;
};

export interface AblageLinien {
	doc: Document;
	ursprung: { x: number; y: number };
	linien: readonly Hilfslinie[];
}

let ablage: AblageLinien | null = null;

export const hoerer = new Set<() => void>();

export const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};
