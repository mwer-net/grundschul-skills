import { useEffect, useRef } from 'react';

/**
 * Meldet die Höhe der Kopfzeile als CSS-Variable `--kopf`. Was unter ihr mitlaufen soll (`sticky`), setzt
 * `top-[var(--kopf)]` und bleibt so auch dann sichtbar, wenn die Kopfzeile auf dem iPad hoch umbricht.
 */
export const useKopfHoehe = <T extends HTMLElement>() => {
	const kopf = useRef<T>(null);
	useEffect(() => {
		const element = kopf.current;
		if (!element) {
			return undefined;
		}
		const wurzel = document.documentElement;
		const setze = () => wurzel.style.setProperty('--kopf', `${element.offsetHeight}px`);
		setze();
		const beobachter = new ResizeObserver(setze);
		beobachter.observe(element);
		return () => {
			beobachter.disconnect();
			wurzel.style.removeProperty('--kopf');
		};
	}, []);
	return kopf;
};
