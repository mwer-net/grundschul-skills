import { useCallback, useMemo, useRef } from 'react';

import type { Kontext, Modus, Ort } from './befehle';
import { BEFEHLE, befehleFuer, befehlZuTaste } from './befehle';

/** Bedienwege greifen über dieses Objekt aufs Register zu. Es bleibt gleich; der Kontext ist immer der aktuelle. */
export const useBefehle = (kontext: Kontext, melde: (text: string) => void) => {
	const jetzt = useRef(kontext);
	jetzt.current = kontext;

	const fuehreAus = useCallback((id: string): unknown => {
		const befehl = BEFEHLE.find((b) => b.id === id);
		return befehl?.verfuegbar(jetzt.current) ? befehl.aus(jetzt.current) : undefined;
	}, []);

	const fuer = useCallback((ort: Ort) => befehleFuer(ort, jetzt.current), []);

	/** `true`, wenn die Taste zu einem Befehl gehört; dann hat sie der Browser nicht mehr zu sehen. */
	const zuTaste = useCallback(
		(e: KeyboardEvent, modus: Modus) => {
			const befehl = befehlZuTaste(e, modus, jetzt.current);
			if (!befehl) {
				return false;
			}
			e.preventDefault();
			if (befehl.verfuegbar(jetzt.current)) {
				befehl.aus(jetzt.current);
			} else {
				const grund = befehl.warumNicht?.(jetzt.current);
				if (grund) {
					melde(grund);
				}
			}
			return true;
		},
		[melde],
	);

	return useMemo(() => ({ fuehreAus, fuer, zuTaste, jetzt }), [fuehreAus, fuer, zuTaste]);
};

export type Befehle = ReturnType<typeof useBefehle>;
