import { useEffect } from 'react';

/** Was `praesentation.js` (bei den Skills) im Iframe als `window.praesentation` anbietet. */
export interface FolienStand {
	folie: number;
	folien: number;
	schwarz: boolean;
	/** Letzte Folie, alles aufgedeckt. */
	ende: boolean;
}

export interface Laufzeit {
	weiter: () => void;
	zurueck: () => void;
	schwarz: (an?: boolean) => void;
	nummer: (an: boolean) => void;
	taste: (e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>) => boolean;
	vorladen: (beiFortschritt?: (fertig: number, gesamt: number) => void) => Promise<{ gesamt: number }>;
	stand: () => FolienStand;
}

type MitLaufzeit = Window & { praesentation?: Laufzeit };

/** Die Laufzeit im Iframe; das Dokument liegt unter `/ansicht` bzw. `/f/…/ansicht`, also im selben Ursprung. */
export const laufzeitVon = (iframe: HTMLIFrameElement | null): Laufzeit | null =>
	(iframe?.contentWindow as MitLaufzeit | null)?.praesentation ?? null;

interface WebkitElement extends HTMLElement {
	webkitRequestFullscreen?: () => void;
}

interface WebkitDocument extends Document {
	webkitFullscreenEnabled?: boolean;
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => void;
}

const dok = () => document as WebkitDocument;

/** Safari auf dem iPad kennt Vollbild für Elemente erst ab iPadOS 16.4 ohne Präfix, davor nur als `webkit…`. */
export const vollbildMoeglich = () => Boolean(dok().fullscreenEnabled || dok().webkitFullscreenEnabled);

export const istVollbild = () => Boolean(dok().fullscreenElement ?? dok().webkitFullscreenElement);

/** Muss direkt in der Nutzergeste laufen (Antippen von „Präsentation starten“), sonst lehnt Safari ab. */
export const starteVollbild = (element: HTMLElement) => {
	const el = element as WebkitElement;
	if (el.requestFullscreen) {
		el.requestFullscreen().catch(() => undefined);
	} else {
		el.webkitRequestFullscreen?.();
	}
};

export const beendeVollbild = () => {
	if (!istVollbild()) {
		return;
	}
	if (document.exitFullscreen) {
		document.exitFullscreen().catch(() => undefined);
	} else {
		dok().webkitExitFullscreen?.();
	}
};

export const VOLLBILD_EREIGNISSE = ['fullscreenchange', 'webkitfullscreenchange'] as const;

export const wachHaltenMoeglich = () => 'wakeLock' in navigator;

/**
 * Hält den Bildschirm an, solange `aktiv` (Screen Wake Lock, Safari ab 16.4). Das System gibt die Sperre frei, wenn
 * der Tab in den Hintergrund geht; kommt er zurück, wird sie neu geholt.
 */
export const useWachHalten = (aktiv: boolean) => {
	useEffect(() => {
		if (!aktiv || !wachHaltenMoeglich()) {
			return undefined;
		}
		let sperre: WakeLockSentinel | null = null;
		let vorbei = false;
		const hole = () => {
			if (document.visibilityState !== 'visible' || (sperre && !sperre.released)) {
				return;
			}
			navigator.wakeLock.request('screen').then(
				(neu) => {
					if (vorbei) {
						void neu.release();
					} else {
						sperre = neu;
					}
				},
				() => undefined,
			);
		};
		hole();
		document.addEventListener('visibilitychange', hole);
		return () => {
			vorbei = true;
			document.removeEventListener('visibilitychange', hole);
			void sperre?.release();
		};
	}, [aktiv]);
};
