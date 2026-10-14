import { useCallback, useEffect, useState } from 'react';

import { ApiFehler, lade, meldung } from '../api';

interface Stand<T> {
	url: string;
	daten: T | null;
	fehler: ApiFehler | null;
}

/**
 * Lädt Daten und lädt sie auf Wunsch neu. Beim Neuladen bleibt das Alte stehen, bis das Neue da ist; die Seite
 * flackert also nicht, wenn sich im Hintergrund etwas ändert. Nur ein Netzfehler lässt alte Daten stehen.
 */
export const useLaden = <T>(url: string) => {
	const [stand, setStand] = useState<Stand<T>>({ url, daten: null, fehler: null });
	const [lauf, setLauf] = useState(0);

	useEffect(() => {
		let aktuell = true;
		lade<T>(url)
			.then((daten) => {
				if (aktuell) {
					setStand({ url, daten, fehler: null });
				}
			})
			.catch((grund: unknown) => {
				if (!aktuell) {
					return;
				}
				const fehler = grund instanceof ApiFehler ? grund : new ApiFehler(0, meldung(grund));
				setStand((alt) => ({ url, daten: alt.url === url && fehler.status === 0 ? alt.daten : null, fehler }));
			});
		return () => {
			aktuell = false;
		};
	}, [url, lauf]);

	const neuLaden = useCallback(() => setLauf((n) => n + 1), []);
	const passt = stand.url === url;
	return { daten: passt ? stand.daten : null, fehler: passt ? stand.fehler : null, neuLaden };
};
