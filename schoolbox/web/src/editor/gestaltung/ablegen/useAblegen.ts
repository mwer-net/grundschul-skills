import { useCallback, useEffect, useRef, useState } from 'react';

import type { ZugAmZeiger } from '../../zug-von-aussen';
import { zieheVonAussen } from '../../zug-von-aussen';
import type { AblegenTeile } from './ablegen';
import { legeInMitte, ziehgutGestaltung } from './ablegen';
import type { GestaltungsGut } from './ziehgut';

/** Zeiger beim Start des Zugs, Koordinaten des Elternfensters. */
export interface ZugStart {
	x: number;
	y: number;
	id: number;
	cmd: boolean;
}

/**
 * Ablegen aus einer Schublade (098): verbindet den Zug von außen (094) mit Vorschau, Zielen und ⌘-Wechsel. Die Lücke
 * zeigt `zug-von-aussen.ts` bei `stapel`, die Vorschau `ablegen.ts` bei `frei`; Esc bricht dort ab. Erweitern: 115 (⌘ →
 * Fläche) und 125 (⌘ bei Bausteinen → Stapel) setzen `imStapel` am Gut, hier ändert sich nichts.
 */
export const useAblegen = (teile: AblegenTeile) => {
	const [amZeiger, setAmZeiger] = useState<ZugAmZeiger | null>(null);
	const abbrechen = useRef<(() => void) | null>(null);
	const jetzt = useRef(teile);
	useEffect(() => {
		jetzt.current = teile;
	});
	useEffect(() => () => abbrechen.current?.(), []);

	/** Beginnt den Zug; `false`, wenn schon einer läuft oder das Blatt nicht bereit ist. */
	const ziehe = useCallback((gut: GestaltungsGut, start: ZugStart) => {
		const { doc, folien } = jetzt.current;
		const ziehgut = ziehgutGestaltung(jetzt.current, gut);
		if (!doc || !ziehgut || abbrechen.current) {
			return false;
		}
		abbrechen.current = zieheVonAussen({
			doc,
			gut: ziehgut,
			jeSeite: folien,
			...start,
			zeige: (anzeige) => {
				setAmZeiger(anzeige);
				if (!anzeige) {
					abbrechen.current = null;
				}
			},
		});
		return true;
	}, []);

	const klick = useCallback((gut: GestaltungsGut) => legeInMitte(jetzt.current, gut), []);

	return { ziehe, klick, amZeiger };
};
