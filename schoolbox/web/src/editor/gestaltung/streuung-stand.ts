import type { StreuArt } from '@schoolbox/kern/src/streuen';
import { useSyncExternalStore } from 'react';

/**
 * Die Art, die die Lehrkraft zuletzt in der Schublade gewählt hat (109): Das Werkzeug Streuen zieht sie auf, ohne
 * Wahl Konfetti. Wie der Stand der Werkzeuge ein Wert, den Schublade und Werkzeug teilen.
 */
let art: StreuArt = 'konfetti';
const hoerer = new Set<() => void>();

export const streuArt = () => art;

export const waehleStreuArt = (neu: StreuArt) => {
	if (neu !== art) {
		art = neu;
		for (const h of hoerer) {
			h();
		}
	}
};

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const useStreuArt = () => useSyncExternalStore(abonniere, streuArt);
