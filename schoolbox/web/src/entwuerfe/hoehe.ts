import type { RefObject } from 'react';
import { useEffect } from 'react';

/** Abstand zum unteren Fensterrand. */
const RAND = 16;

/**
 * Setzt am Element `--rest`: die Höhe vom Element bis zum unteren Fensterrand. So passen die Entwürfe ins Fenster,
 * egal wie hoch Kopfzeile, Hinweis und Titel gerade sind. `da`: Das Element ist gerendert (nach dem Laden der Daten).
 */
export const useRestHoehe = (ref: RefObject<HTMLElement | null>, da: boolean) => {
	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return undefined;
		}
		const messe = () => {
			const oben = element.getBoundingClientRect().top + window.scrollY;
			element.style.setProperty('--rest', `${Math.max(0, Math.floor(window.innerHeight - oben - RAND))}px`);
		};
		messe();
		const beobachter = new ResizeObserver(messe);
		beobachter.observe(document.body);
		window.addEventListener('resize', messe);
		return () => {
			beobachter.disconnect();
			window.removeEventListener('resize', messe);
		};
	}, [ref, da]);
};
