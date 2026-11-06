import { useSyncExternalStore } from 'react';

/** Das aktive Werkzeug; `halten`: bleibt nach dem Strich (⇧ beim Wählen), bis Esc. */
export interface WerkzeugStand {
	id: string;
	halten: boolean;
}

const V: WerkzeugStand = { id: 'auswahl', halten: false };
let stand = V;
const hoerer = new Set<() => void>();

export const werkzeugStand = () => stand;

/** Wählt ein Werkzeug; V hält nie. Befehle, Knöpfe und das Blatt teilen diesen einen Stand. */
export const waehleWerkzeug = (id: string, halten = false) => {
	const neu = id === V.id ? V : { id, halten };
	if (neu.id !== stand.id || neu.halten !== stand.halten) {
		stand = neu;
		for (const h of hoerer) {
			h();
		}
	}
};

export const zurAuswahl = () => waehleWerkzeug(V.id);

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const useWerkzeugStand = () => useSyncExternalStore(abonniere, werkzeugStand);
