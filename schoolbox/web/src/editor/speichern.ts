import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiFehler, meldung, sende } from '../api';

/** So lange nach der letzten Änderung wird gespeichert. */
export const SPEICHERN_MS = 1500;
/** Ohne Verbindung: so oft ein neuer Versuch. */
const ERNEUT_MS = 5000;

/** Der Stand, den der Server zuletzt bestätigt hat; `version` ist die `basisVersion` für das nächste Speichern. */
export interface Basis {
	quelle: string;
	version: string;
}

/** `konflikt`: Jemand anderes hat material.html geändert, während es hier offene Änderungen gibt. Speichern ruht. */
export type SpeicherStand = { art: 'gespeichert' | 'wartet' | 'speichert' | 'offline' | 'konflikt' } | Speicherfehler;

interface Speicherfehler {
	art: 'fehler';
	text: string;
}

interface Optionen {
	adresse: string;
	quelle: string | null;
	/** Der Server meldet beim Speichern einen neueren Stand (409). */
	beiKonflikt: () => void;
}

/**
 * Speichert von selbst, 1,5 s nach der letzten Änderung, immer mit der zuletzt bestätigten Version. Ohne Änderung
 * gegenüber dieser Version wird nie gespeichert. Ohne Verbindung versucht es alle paar Sekunden weiter.
 */
export const useSpeichern = ({ adresse, beiKonflikt, quelle }: Optionen) => {
	const [stand, setStand] = useState<SpeicherStand>({ art: 'gespeichert' });
	const basis = useRef<Basis | null>(null);
	const aktuell = useRef(quelle);
	const laeuft = useRef<Promise<boolean> | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const konflikt = useRef(false);
	const konfliktMelden = useRef(beiKonflikt);

	useEffect(() => {
		konfliktMelden.current = beiKonflikt;
	}, [beiKonflikt]);

	const offen = useCallback(() => aktuell.current !== null && aktuell.current !== basis.current?.quelle, []);

	const speichere = useCallback((): Promise<boolean> => {
		clearTimeout(timer.current);
		if (laeuft.current) {
			return laeuft.current;
		}
		const gesendet = aktuell.current;
		const vorher = basis.current;
		if (konflikt.current || gesendet === null || !vorher || gesendet === vorher.quelle) {
			return Promise.resolve(!konflikt.current);
		}
		setStand({ art: 'speichert' });
		const lauf = (async () => {
			try {
				const { version } = await sende<{ version: string }>(
					adresse,
					{ quelle: gesendet, basisVersion: vorher.version },
					'PUT',
				);
				basis.current = { quelle: gesendet, version };
				return true;
			} catch (grund) {
				const status = grund instanceof ApiFehler ? grund.status : 0;
				if (status === 409) {
					konflikt.current = true;
					setStand({ art: 'konflikt' });
					konfliktMelden.current();
				} else if (status === 0) {
					setStand({ art: 'offline' });
					timer.current = setTimeout(() => void speichere(), ERNEUT_MS);
				} else {
					setStand({ art: 'fehler', text: meldung(grund) });
				}
				return false;
			} finally {
				laeuft.current = null;
			}
		})();
		laeuft.current = lauf;
		return lauf.then((ok) => {
			if (!ok) {
				return false;
			}
			// Während des Speicherns weiter bearbeitet: gleich noch einmal.
			if (offen()) {
				return speichere();
			}
			setStand({ art: 'gespeichert' });
			return true;
		});
	}, [adresse, offen]);

	useEffect(() => {
		aktuell.current = quelle;
		if (konflikt.current) {
			return;
		}
		if (!offen()) {
			// Per Rückgängig zurück zum gespeicherten Stand: nichts mehr zu tun.
			if (!laeuft.current) {
				clearTimeout(timer.current);
				setStand({ art: 'gespeichert' });
			}
			return;
		}
		setStand((alt) => (alt.art === 'speichert' || alt.art === 'offline' ? alt : { art: 'wartet' }));
		clearTimeout(timer.current);
		timer.current = setTimeout(() => void speichere(), SPEICHERN_MS);
	}, [quelle, offen, speichere]);

	// Seite schließen oder neu laden mit offenen Änderungen: Der Browser fragt nach.
	useEffect(() => {
		const warnen = (e: BeforeUnloadEvent) => {
			if (offen() || laeuft.current) {
				e.preventDefault();
			}
		};
		window.addEventListener('beforeunload', warnen);
		return () => {
			window.removeEventListener('beforeunload', warnen);
			clearTimeout(timer.current);
		};
	}, [offen]);

	/** Neuer Stand vom Server (erstes Laden, Neuladen, Wiederherstellen): Er gilt als gespeichert. */
	const setzeBasis = useCallback((neu: Basis) => {
		clearTimeout(timer.current);
		basis.current = neu;
		aktuell.current = neu.quelle;
		konflikt.current = false;
		setStand({ art: 'gespeichert' });
	}, []);

	const meldeKonflikt = useCallback(() => {
		clearTimeout(timer.current);
		konflikt.current = true;
		setStand({ art: 'konflikt' });
	}, []);

	/** Wartet, bis ein laufendes Speichern fertig ist, ohne ein neues anzustoßen. */
	const ruhig = useCallback(async () => {
		await laeuft.current;
	}, []);

	/** Speichert sofort alles Offene, z. B. vor dem PDF oder dem Verlassen. `false`: Es ist nicht gespeichert. */
	const alles = useCallback(async () => {
		let ok = true;
		while (ok && (offen() || laeuft.current)) {
			ok = await speichere();
		}
		return ok && !konflikt.current;
	}, [offen, speichere]);

	return { stand, basis, offen, alles, speichere, setzeBasis, meldeKonflikt, ruhig };
};
