import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiFehler, meldung, sende } from '../api';

/** So lange nach der letzten Änderung wird gespeichert. */
export const SPEICHERN_MS = 1500;
/** Ohne Verbindung: so oft ein neuer Versuch. */
const ERNEUT_MS = 5000;
/** 193-17: Antwortet der Server so lange nicht, gilt das Speichern als ohne Verbindung. */
export const ANTWORT_MS = 15000;
/** 193-02: Proxy ohne Server dahinter (Neustart beim Ausrollen): wie keine Verbindung, also selbst weiter versuchen. */
const WIE_OFFLINE = new Set([0, 502, 503, 504]);
/** Größer darf ein Aufruf mit `keepalive` nicht sein (Fetch-Standard: 64 KiB für alle offenen zusammen). */
const KEEPALIVE_BYTES = 60_000;
/** Solange der Fluss (206) noch umlegt: so oft nachsehen, höchstens so lange vor dem PDF oder Verlassen. */
const FLUSS_NACHSEHEN_MS = 300;
const FLUSS_HOECHSTENS_MS = 5000;

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
	/** Der Editor legt die Seiten noch um (206): mit dem Speichern warten, bis die Fassung fertig ist. */
	wartet?: () => boolean;
}

/**
 * Speichert von selbst, 1,5 s nach der letzten Änderung, immer mit der zuletzt bestätigten Version. Ohne Änderung
 * gegenüber dieser Version wird nie gespeichert. Ohne Verbindung versucht es alle paar Sekunden weiter.
 */
export const useSpeichern = ({ adresse, beiKonflikt, quelle, wartet }: Optionen) => {
	const [stand, setStand] = useState<SpeicherStand>({ art: 'gespeichert' });
	const basis = useRef<Basis | null>(null);
	const aktuell = useRef(quelle);
	const laeuft = useRef<Promise<boolean> | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const konflikt = useRef(false);
	const konfliktMelden = useRef(beiKonflikt);
	const fliesst = useRef(wartet);

	useEffect(() => {
		konfliktMelden.current = beiKonflikt;
		fliesst.current = wartet;
	}, [beiKonflikt, wartet]);

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
			const abbruch = new AbortController();
			const frist = setTimeout(() => abbruch.abort(), ANTWORT_MS);
			try {
				const { version } = await sende<{ version: string }>(
					adresse,
					{ quelle: gesendet, basisVersion: vorher.version },
					'PUT',
					{ signal: abbruch.signal },
				);
				basis.current = { quelle: gesendet, version };
				return true;
			} catch (grund) {
				const status = grund instanceof ApiFehler ? grund.status : 0;
				if (status === 409) {
					konflikt.current = true;
					setStand({ art: 'konflikt' });
					konfliktMelden.current();
				} else if (WIE_OFFLINE.has(status)) {
					setStand({ art: 'offline' });
					timer.current = setTimeout(() => void speichere(), ERNEUT_MS);
				} else {
					setStand({ art: 'fehler', text: meldung(grund) });
				}
				return false;
			} finally {
				clearTimeout(frist);
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
		const spaeter = () => {
			if (fliesst.current?.()) {
				timer.current = setTimeout(spaeter, FLUSS_NACHSEHEN_MS);
				return;
			}
			void speichere();
		};
		timer.current = setTimeout(spaeter, SPEICHERN_MS);
	}, [quelle, offen, speichere]);

	/**
	 * Was beim Verlassen der Seite noch offen ist, als Inhalt für einen Aufruf mit `keepalive`; `null`, wenn es dafür
	 * zu groß ist oder gerade ein Speichern läuft (dessen Antwort käme nicht mehr an).
	 */
	const zumSchluss = useCallback(() => {
		const vorher = basis.current;
		const gesendet = aktuell.current;
		if (!offen() || !vorher || gesendet === null || konflikt.current || laeuft.current) {
			return null;
		}
		const inhalt = JSON.stringify({ quelle: gesendet, basisVersion: vorher.version });
		return new TextEncoder().encode(inhalt).length <= KEEPALIVE_BYTES ? inhalt : null;
	}, [offen]);

	// Seite schließen oder neu laden mit offenen Änderungen: Was in einen letzten Aufruf passt, speichert `pagehide`
	// (193-U4); nur sonst fragt der Browser nach.
	useEffect(() => {
		const warnen = (e: BeforeUnloadEvent) => {
			if ((offen() || laeuft.current) && zumSchluss() === null) {
				e.preventDefault();
			}
		};
		const verlassen = () => {
			const inhalt = zumSchluss();
			if (inhalt === null) {
				return;
			}
			clearTimeout(timer.current);
			void fetch(adresse, {
				method: 'PUT',
				keepalive: true,
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'x-schoolbox': '1' },
				body: inhalt,
			}).catch(() => undefined);
		};
		window.addEventListener('beforeunload', warnen);
		window.addEventListener('pagehide', verlassen);
		return () => {
			window.removeEventListener('beforeunload', warnen);
			window.removeEventListener('pagehide', verlassen);
			clearTimeout(timer.current);
		};
	}, [adresse, offen, zumSchluss]);

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
		const ende = Date.now() + FLUSS_HOECHSTENS_MS;
		while (fliesst.current?.() && Date.now() < ende) {
			await new Promise((weiter) => setTimeout(weiter, FLUSS_NACHSEHEN_MS));
		}
		let ok = true;
		while (ok && (offen() || laeuft.current)) {
			ok = await speichere();
		}
		return ok && !konflikt.current;
	}, [offen, speichere]);

	return { stand, basis, offen, alles, speichere, setzeBasis, meldeKonflikt, ruhig };
};
