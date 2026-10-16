import { useEffect, useRef } from 'react';

const SERVER_TYPEN = ['mappe-neu', 'mappe-entfernt', 'dokument-geaendert', 'vorschau-fertig', 'pdf-fertig'] as const;

/** `verbunden`: Die Verbindung steht (wieder), z. B. nach dem Aufwachen des iPads. Es kann etwas verpasst worden sein. */
export type EreignisTyp = (typeof SERVER_TYPEN)[number] | 'verbunden';

export interface Ereignis {
	typ: EreignisTyp;
	mappe?: string;
	dok?: string;
	/** Bei `dokument-geaendert`: Kennung des neuen Inhalts und wer ihn geschrieben hat (`null`: nur meta.json). */
	version?: string;
	urheber?: 'claude' | 'lehrkraft' | null;
	/** Bei `verbunden`: Die Verbindung war schon einmal da und ist wieder da (nicht der erste Aufbau). */
	wieder?: boolean;
}

type Hoerer = (ereignis: Ereignis) => void;

const hoererListe = new Set<Hoerer>();
let quelle: EventSource | null = null;

const verteile = (ereignis: Ereignis) => {
	for (const hoerer of hoererListe) {
		hoerer(ereignis);
	}
};

/** Meldet eine eigene Änderung sofort an alle Seiten, statt auf die Dateiüberwachung des Servers zu warten. */
export const melde = verteile;

const oeffne = () => {
	const strom = new EventSource('/api/ereignisse');
	let wieder = false;
	strom.addEventListener('open', () => {
		verteile({ typ: 'verbunden', wieder });
		wieder = true;
	});
	for (const typ of SERVER_TYPEN) {
		strom.addEventListener(typ, (nachricht: MessageEvent<string>) => {
			const daten = JSON.parse(nachricht.data) as Omit<Ereignis, 'typ' | 'wieder'>;
			verteile({ typ, mappe: daten.mappe, dok: daten.dok, version: daten.version, urheber: daten.urheber });
		});
	}
	return strom;
};

/**
 * Eine gemeinsame Verbindung für alle Seiten; sie besteht, solange jemand zuhört. Safari verbindet selbst neu.
 * Teilen-Links haben keine Sitzung und hören deshalb nicht zu (`aktiv` falsch).
 */
export const useEreignisse = (hoerer: Hoerer, aktiv = true) => {
	const aktuell = useRef(hoerer);
	useEffect(() => {
		aktuell.current = hoerer;
	}, [hoerer]);
	useEffect(() => {
		if (!aktiv) {
			return undefined;
		}
		const eigener: Hoerer = (ereignis) => aktuell.current(ereignis);
		hoererListe.add(eigener);
		quelle ??= oeffne();
		return () => {
			hoererListe.delete(eigener);
			if (hoererListe.size === 0) {
				quelle?.close();
				quelle = null;
			}
		};
	}, [aktiv]);
};
