import { useEffect, useRef } from 'react';

import type { PalettenEintrag } from '../editor/palette-suche';

let quelle: (() => PalettenEintrag[]) | null = null;

/** Die Befehle an der Auswahl der offenen Ablage für ⌘K; außerhalb der Ablage keine (S-02). */
export const auswahlFuerPalette = (): PalettenEintrag[] => quelle?.() ?? [];

/** Die Ablage meldet, solange sie offen ist, woher ⌘K ihre Auswahl-Befehle nimmt. */
export const useAuswahlFuerPalette = (eintraege: () => PalettenEintrag[]) => {
	const aktuell = useRef(eintraege);
	aktuell.current = eintraege;
	useEffect(() => {
		const lies = () => aktuell.current();
		quelle = lies;
		return () => {
			if (quelle === lies) {
				quelle = null;
			}
		};
	}, []);
};
