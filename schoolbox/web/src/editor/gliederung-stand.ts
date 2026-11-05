import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SeitenSpur } from './gliederung-modell';
import { seitenAbgleich, seitenStelle, seitenTexte } from './gliederung-modell';

const SPEICHER_MINIATUREN = 'schoolbox-gliederung-miniaturen';
const LEUCHTEN_MS = 1200;

/**
 * Was vom Reiter bleibt, wenn er zugeht: eingeklappte Seiten (für die Sitzung, nie in der Quelle) und ob Miniaturen zu
 * sehen sind (je Gerät). Liegt darum beim Editor. Ein Klick im Blatt klappt die Seite auf, in der er landet.
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
	const [zu, setZu] = useState<ReadonlySet<number>>(new Set());
	const [miniaturen, setMiniaturenZustand] = useState(() => localStorage.getItem(SPEICHER_MINIATUREN) !== 'aus');
	const [leuchtet, setLeuchtet] = useState<number | null>(null);
	/** Was die Gliederung gerade selbst ausgelöst hat, gilt nicht als Klick im Blatt. */
	const eigene = useRef({ bleibtZu: false, leuchten: false });
	const zerlegungJetzt = useRef(zerlegung);
	zerlegungJetzt.current = zerlegung;
	const idsJetzt = useRef(ids);
	idsJetzt.current = ids;

	useEffect(() => {
		if (auswahl === null) {
			return undefined;
		}
		const { bleibtZu, leuchten } = eigene.current;
		eigene.current = { bleibtZu: false, leuchten: false };
		if (!bleibtZu) {
			const stelle = seitenStelle(zerlegungJetzt.current, auswahl);
			const id = stelle === null ? undefined : idsJetzt.current[stelle];
			if (id !== undefined) {
				setZu((alt) => (alt.has(id) ? new Set([...alt].filter((x) => x !== id)) : alt));
			}
		}
		if (!leuchten) {
			return undefined;
		}
		setLeuchtet(auswahl);
		const timer = window.setTimeout(() => setLeuchtet(null), LEUCHTEN_MS);
		return () => window.clearTimeout(timer);
	}, [auswahl]);

	return {
		zu,
		ids,
		miniaturen,
		leuchtet,
		eigene,
		setzeMiniaturen: (an: boolean) => {
			setMiniaturenZustand(an);
			localStorage.setItem(SPEICHER_MINIATUREN, an ? 'an' : 'aus');
		},
		klappe: (id: number, oeffnen: boolean) =>
			setZu((alt) => {
				const neu = new Set(alt);
				if (oeffnen) {
					neu.delete(id);
				} else {
					neu.add(id);
				}
				return neu;
			}),
		klappeAlle: (schliessen: boolean) => setZu(new Set(schliessen ? ids : [])),
	};
};

export type GliederungStand = ReturnType<typeof useGliederungStand>;
