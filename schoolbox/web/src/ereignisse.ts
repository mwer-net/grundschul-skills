import { useEffect, useRef } from 'react';

const SERVER_TYPEN = ['mappe-neu', 'mappe-entfernt', 'dokument-geaendert', 'vorschau-fertig', 'pdf-fertig'] as const;

/** `verbunden`: Die Verbindung steht (wieder), z. B. nach dem Aufwachen des iPads. Es kann etwas verpasst worden sein. */
export type EreignisTyp = (typeof SERVER_TYPEN)[number] | 'verbunden';

export interface Ereignis {
	typ: EreignisTyp;
	mappe?: string;
	dok?: string;
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
	strom.addEventListener('open', () => verteile({ typ: 'verbunden' }));
	for (const typ of SERVER_TYPEN) {
		strom.addEventListener(typ, (nachricht: MessageEvent<string>) => {
			const daten = JSON.parse(nachricht.data) as { mappe?: string; dok?: string };
			verteile({ typ, mappe: daten.mappe, dok: daten.dok });
		});
	}
	return strom;
};

/** Eine gemeinsame Verbindung für alle Seiten; sie besteht, solange jemand zuhört. Safari verbindet selbst neu. */
export const useEreignisse = (hoerer: Hoerer) => {
	const aktuell = useRef(hoerer);
	useEffect(() => {
		aktuell.current = hoerer;
	}, [hoerer]);
	useEffect(() => {
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
	}, []);
};
