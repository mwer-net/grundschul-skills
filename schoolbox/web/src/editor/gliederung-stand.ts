import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SeitenSpur } from './gliederung-modell';
import { seitenAbgleich, seitenTexte } from './gliederung-modell';

const LEUCHTEN_MS = 1200;

/**
 * Was vom Reiter bleibt, wenn er zugeht: auf- und zugeklappte Zeilen (für die Sitzung, nie in der Quelle), als Schlüssel aus
 * `gliederung-modell`. Liegt darum beim Editor. Aufgeklappt wird, was zur Auswahl führt, das macht die Gliederung.
 */
export const useGliederungStand = (zerlegung: Zerlegung | null, auswahl: number | null) => {
	const spuren = useRef<SeitenSpur[]>([]);
	const naechsteId = useRef(1);
	const ids = useMemo(() => {
		if (!zerlegung) {
			return [];
		}
		spuren.current = seitenAbgleich(spuren.current, seitenTexte(zerlegung), () => {
			naechsteId.current += 1;
			return naechsteId.current;
		});
		return spuren.current.map((s) => s.id);
	}, [zerlegung]);
	/** Abweichungen von der Vorgabe (Seiten offen, alles darunter zu); wahr heißt offen. */
	const [geschaltet, setGeschaltet] = useState<ReadonlyMap<string, boolean>>(new Map());
	const [leuchtet, setLeuchtet] = useState<number | null>(null);
	/** Eine Ablage aus der Gliederung lässt die neue Stelle kurz leuchten. */
	const eigene = useRef({ leuchten: false });

	useEffect(() => {
		if (auswahl === null) {
			return undefined;
		}
		const { leuchten } = eigene.current;
		eigene.current = { leuchten: false };
		if (!leuchten) {
			return undefined;
		}
		setLeuchtet(auswahl);
		const timer = window.setTimeout(() => setLeuchtet(null), LEUCHTEN_MS);
		return () => window.clearTimeout(timer);
	}, [auswahl]);

	return {
		ids,
		leuchtet,
		eigene,
		/** Seiten sind ohne Zutun offen, alles darunter zu, damit die Liste kurz bleibt. */
		offen: (schluessel: string) => geschaltet.get(schluessel) ?? !schluessel.includes('/'),
		klappe: (schluessel: string, oeffnen: boolean) =>
			setGeschaltet((alt) => (alt.get(schluessel) === oeffnen ? alt : new Map(alt).set(schluessel, oeffnen))),
		/** Öffnet alle genannten Zeilen auf einmal, ohne neuen Zustand, wenn sie schon offen sind. */
		oeffne: (schluessel: readonly string[]) =>
			setGeschaltet((alt) => {
				const fehlt = schluessel.filter((s) => alt.get(s) !== true);
				return fehlt.length ? new Map([...alt, ...fehlt.map((s): [string, boolean] => [s, true])]) : alt;
			}),
		setzeAlle: (schluessel: readonly string[], oeffnen: boolean) =>
			setGeschaltet(new Map(schluessel.map((s) => [s, oeffnen]))),
	};
};

export type GliederungStand = ReturnType<typeof useGliederungStand>;
