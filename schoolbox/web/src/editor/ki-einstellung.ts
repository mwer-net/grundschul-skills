import { useSyncExternalStore } from 'react';

import { lade, sende } from '../api';

/**
 * Modell und Gründlichkeit für Claude (232): eine Einstellung für die ganze Schoolbox, auf dem Server gespeichert. Alle
 * Chips teilen diesen Stand; geladen wird einmal und wieder, wenn das Fenster den Fokus bekommt (Mac und iPad).
 */

export type KiEffortWahl = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface KiEinstellung {
	modell: string | null;
	effort: KiEffortWahl;
	standardModell: string;
	modelle: { id: string; name: string }[];
}

export const EFFORT_NAMEN: { wert: KiEffortWahl; titel: string }[] = [
	{ wert: 'auto', titel: 'Automatisch' },
	{ wert: 'low', titel: 'Niedrig' },
	{ wert: 'medium', titel: 'Mittel' },
	{ wert: 'high', titel: 'Hoch' },
	{ wert: 'xhigh', titel: 'Sehr hoch' },
	{ wert: 'max', titel: 'Maximal' },
];

let stand: KiEinstellung | null = null;
let laden: Promise<void> | null = null;
const HOERER = new Set<() => void>();

const melde = () => {
	for (const hoerer of HOERER) {
		hoerer();
	}
};

const ladeEinstellung = () => {
	laden ??= lade<KiEinstellung>('/api/ki/einstellung')
		.then((antwort) => {
			stand = antwort;
			melde();
		})
		.catch(() => undefined)
		.finally(() => {
			laden = null;
		});
	return laden;
};

const imFokus = () => void ladeEinstellung();

const abonniere = (hoerer: () => void) => {
	if (HOERER.size === 0) {
		window.addEventListener('focus', imFokus);
	}
	HOERER.add(hoerer);
	if (!stand) {
		void ladeEinstellung();
	}
	return () => {
		HOERER.delete(hoerer);
		if (HOERER.size === 0) {
			window.removeEventListener('focus', imFokus);
		}
	};
};

/** Gilt sofort in allen Chips; scheitert das Speichern, springt der Stand zurück und der Fehler geht an den Aufrufer. */
const setze = async (teil: Partial<Pick<KiEinstellung, 'modell' | 'effort'>>) => {
	const vorher = stand;
	if (!vorher) {
		return;
	}
	stand = { ...vorher, ...teil };
	melde();
	try {
		stand = await sende<KiEinstellung>('/api/ki/einstellung', teil, 'PUT');
	} catch (fehler) {
		stand = vorher;
		throw fehler;
	} finally {
		melde();
	}
};

/** `einstellung` ist `null`, bis der Server geantwortet hat. */
export const useKiEinstellung = () => ({ einstellung: useSyncExternalStore(abonniere, () => stand), setze });

/** Der Name des Modells, das gerade gilt, auch wenn der Standard gewählt ist. */
export const modellName = (e: KiEinstellung) => {
	const id = e.modell ?? e.standardModell;
	return e.modelle.find((m) => m.id === id)?.name ?? id;
};
