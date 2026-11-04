import { useEffect } from 'react';

const DANEBEN = 'schoolbox:daneben';

/** Klicks im `iframe` erreichen das Elternfenster nicht: Der Editor meldet sie hier, damit Menüs und Popover schließen. */
export const meldeDaneben = () => window.dispatchEvent(new Event(DANEBEN));

export const useDaneben = (aktiv: boolean, schliessen: () => void) => {
	useEffect(() => {
		if (!aktiv) {
			return undefined;
		}
		window.addEventListener(DANEBEN, schliessen);
		return () => window.removeEventListener(DANEBEN, schliessen);
	}, [aktiv, schliessen]);
};
