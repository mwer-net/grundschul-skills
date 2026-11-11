import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiFehler, lade, meldung, sende } from '../api';
import { useEreignisse } from '../ereignisse';

export type KiStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';

export interface KiAuftrag {
	id: string;
	status: KiStatus;
	schritte: string[];
	fehler: string | null;
	ergebnis: 'vorschlag' | 'antwort' | null;
	antwort: string | null;
	limitErreicht?: boolean;
	kontextGross?: boolean;
	/** Ein neues Blatt (133): Das zeigt der Editor auf dem Blatt, nicht der Chat. */
	neuesBlatt?: boolean;
	seit?: string;
	/** Das Gespräch und sein Element (135): So findet die Pille nach dem Neuladen ihren Platz. */
	gespraech?: string;
	referenz?: string;
	/** Nachbessern: der Vorschlag, auf dem er aufbaut. */
	grundlage?: string;
	umfang?: string;
}

export interface KiFenster {
	auslastung: number | null;
	zurueck: string | null;
}

export interface KiLimit {
	status: string;
	fenster: { fuenfStunden: KiFenster; sieben: KiFenster };
	zurueck: string | null;
	guthaben: 'erlaubt' | 'abgelehnt' | null;
	laeuftUeberGuthaben: boolean;
	fensterArt: 'fuenfStunden' | 'woche' | null;
}

export interface KiAktion {
	id: string;
	name: string;
	auf: ('baustein' | 'seite' | 'blatt')[];
}

export interface KiZustand {
	verfuegbar: boolean;
	limit: KiLimit | null;
	warnAb: number;
	aktionen: KiAktion[];
}

export interface Vorschlag {
	auftrag: string;
	umfang: string;
	zeit: string;
	antwort: string;
	fehler: number;
	konflikt: boolean;
	meldungen: { stufe: string; seite: number; text: string }[];
	neuesBlatt?: boolean;
	/** Das Blatt nach dem Annehmen; der Editor zeigt es statt der Quelle (neues Blatt, Blase). */
	quelle?: string;
}

/** Einer von mehreren Vorschlägen am Blatt (135), je Gespräch einer. */
export interface VorschlagAmBlatt extends Vorschlag {
	/** Sein Name am Server: die Id des Gesprächs, aus dem er kam, sonst `blatt` oder `alt`. */
	schluessel: string;
	gespraech?: string;
	/** Das Element, an dem er hängt. Ohne: das ganze Blatt. */
	referenz?: string;
}

const LEER: KiZustand = { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] };

/** Ohne angemeldetes `claude` bleibt `verfuegbar` falsch, und nichts davon erscheint im Editor. */
export const useKiZustand = () => {
	const [zustand, setZustand] = useState(LEER);
	/** Erst danach heißt `verfuegbar: false` wirklich „nicht angemeldet“. */
	const [geladen, setGeladen] = useState(false);
	const neu = useCallback(() => {
		lade<KiZustand>('/api/ki/status')
			.then(setZustand, () => setZustand(LEER))
			.finally(() => setGeladen(true));
	}, []);
	useEffect(neu, [neu]);
	/** Fragt das Konto selbst: Nur so löst sich eine Sperre, zum Beispiel nach dem Kauf von Guthaben. */
	const pruefeLimit = useCallback(async () => {
		setZustand(await sende<KiZustand>('/api/ki/limit/pruefen'));
	}, []);
	return { zustand, geladen, neu, pruefeLimit };
};

const zeit = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleString('de-DE', {
				weekday: 'long',
				day: 'numeric',
				month: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			})
		: null;

/** Kurz wie gesprochen: „Dienstag“ für 0 Uhr, sonst mit Uhrzeit, und am selben Tag nur die Uhrzeit. */
const bisWann = (iso: string) => {
	const d = new Date(iso);
	const tag = d.toLocaleDateString('de-DE', { weekday: 'long' });
	const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
	if (uhr === '00:00') {
		return tag;
	}
	return d.toDateString() === new Date().toDateString() ? `${uhr} Uhr` : `${tag} ${uhr} Uhr`;
};

const LIMIT_NAMEN = { woche: 'Wochenlimit', fuenfStunden: 'Fünf-Stunden-Limit' };

/** Die Meldung zum Limit in einfachen Worten; `null`, solange genug Luft ist. */
export const limitHinweis = (limit: KiLimit | null, warnAb: number) => {
	if (!limit) {
		return null;
	}
	const { fuenfStunden, sieben } = limit.fenster;
	// Ein Stand von vor dem Reset gilt nicht mehr, auch wenn seither kein Lauf ihn ersetzt hat.
	const gilt = !limit.zurueck || new Date(limit.zurueck).getTime() > Date.now();
	const name = limit.fensterArt ? LIMIT_NAMEN[limit.fensterArt] : 'Limit';
	const wann = zeit(limit.zurueck);
	if (gilt && limit.status === 'rejected' && limit.guthaben === 'abgelehnt') {
		return {
			art: 'gesperrt' as const,
			text: `Das Limit des Claude-Kontos ist erreicht${wann ? `. Wieder möglich ab ${wann} Uhr` : ''}.`,
		};
	}
	if (gilt && (limit.laeuftUeberGuthaben || (limit.status === 'rejected' && limit.guthaben === 'erlaubt'))) {
		return {
			art: 'guthaben' as const,
			text: `${name} erreicht. Läuft${limit.zurueck ? ` bis ${bisWann(limit.zurueck)}` : ''} über dein Guthaben.`,
		};
	}
	if (gilt && limit.status === 'rejected') {
		// Das Konto hat nichts zum Guthaben gesagt: Erst der nächste Lauf zeigt, ob es weitergeht.
		return {
			art: 'warnung' as const,
			text: `${name} erreicht${wann ? `, wieder frei ab ${wann} Uhr` : ''}. Du kannst es trotzdem versuchen.`,
		};
	}
	const hoechste = Math.max(fuenfStunden.auslastung ?? 0, sieben.auslastung ?? 0);
	if (hoechste >= warnAb) {
		return {
			art: 'warnung' as const,
			text: `Das Limit des Claude-Kontos ist zu ${Math.round(hoechste * 100)} % ausgeschöpft. Die Claude-App zählt mit.`,
		};
	}
	return null;
};

interface Wunsch {
	auftrag?: string;
	aktion?: string;
	referenz?: string;
	aufVorschlag?: boolean;
	gespraechId?: string;
	verlauf?: { rolle: 'lehrkraft' | 'claude'; text: string }[];
	zitat?: string;
}

/** Passt zum `ID_MUSTER` des Servers. `randomUUID` gibt es nur auf sicheren Seiten. */
export const neueGespraechId = () =>
	Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Sitzung auf dem Server löschen. `keepalive`, damit es auch beim Schließen des Tabs noch abgeht; `sendBeacon` kann den
 * Kopf des CSRF-Schutzes nicht setzen. Der Inhalt muss sein: Ohne ihn gilt die Anfrage nicht als JSON. Kommt sie nie an,
 * läuft die Sitzung nach zwei Stunden ab.
 */
export const beendeGespraechAufServer = (id: string) => {
	void fetch(`/api/ki/gespraech/${id}`, {
		method: 'DELETE',
		keepalive: true,
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json', 'x-schoolbox': '1' },
		body: '{}',
	}).catch(() => undefined);
};

/**
 * Gespräche enden mit dem Editor (Entscheidung 37): beim Verlassen, beim Wechsel des Dokuments und mit dem Tab. Der
 * Abbau im Strict Mode der Entwicklung baut gleich wieder auf; erst danach wird entschieden.
 */
export const useGespraecheEnden = (offene: () => readonly string[]) => {
	const holen = useRef(offene);
	useEffect(() => {
		holen.current = offene;
	});
	useEffect(() => {
		let lebt = true;
		const weg = () => holen.current().forEach(beendeGespraechAufServer);
		window.addEventListener('pagehide', weg);
		return () => {
			lebt = false;
			window.removeEventListener('pagehide', weg);
			window.setTimeout(() => {
				if (!lebt) {
					weg();
				}
			});
		};
	}, []);
};

/**
 * Auftrag und Vorschlag eines Dokuments. Beides überlebt Neuladen: Der Server hält den Stand. `entwurf`: nur das neue
 * Blatt (133), das der Editor auf dem Blatt zeigt; sonst alles andere, für den Chat.
 */
export const useKiAuftrag = (
	mappe: string | null,
	dok: string | null,
	nachLauf: () => void,
	{ entwurf = false, gestartet }: { entwurf?: boolean; gestartet?: string | undefined } = {},
) => {
	const basis = mappe && dok ? `/api/dokumente/${mappe}/${dok}` : null;
	const gehoertHierher = useCallback((x: { neuesBlatt?: boolean }) => Boolean(x.neuesBlatt) === entwurf, [entwurf]);
	const [auftrag, setAuftrag] = useState<KiAuftrag | null>(null);
	const [vorschlag, setVorschlag] = useState<Vorschlag | null>(null);
	const [fehler, setFehler] = useState<string | null>(null);
	// Zählt jede Ablehnung, damit der Chat den Auftrag zurück ins Feld legen kann.
	const [abgelehnt, setAbgelehnt] = useState(0);
	const letzteFrage = useRef(0);

	const ladeVorschlag = useCallback(async () => {
		if (!basis) {
			return;
		}
		const { vorschlag: neu } = await lade<{ vorschlag: Vorschlag | null }>(
			`${basis}/vorschlag${entwurf ? '?quelle=1' : ''}`,
		);
		setVorschlag(neu && gehoertHierher(neu) ? neu : null);
	}, [basis, entwurf, gehoertHierher]);

	const pruefe = useCallback(
		async (id: string) => {
			letzteFrage.current += 1;
			const frage = letzteFrage.current;
			try {
				const { auftrag: neu } = await lade<{ auftrag: KiAuftrag }>(`/api/ki/${id}`);
				// Eine spätere Frage kennt den neueren Stand; „läuft“ darf ein schon gemeldetes Ende nicht überschreiben.
				if (frage !== letzteFrage.current || !gehoertHierher(neu)) {
					return;
				}
				if (neu.status === 'fertig' || neu.status === 'fehler' || neu.status === 'abgebrochen') {
					setFehler(neu.fehler);
					if (neu.limitErreicht) {
						setAbgelehnt((n) => n + 1);
					}
					// Erst der Vorschlag, dann das Ende: Wer das Ende sieht, soll auch den Vorschlag sehen.
					await ladeVorschlag();
					setAuftrag(neu);
					nachLauf();
				} else {
					setAuftrag(neu);
				}
			} catch (grund) {
				setAuftrag(null);
				setFehler(meldung(grund));
			}
		},
		[gehoertHierher, ladeVorschlag, nachLauf],
	);

	useEffect(() => {
		if (!basis) {
			return;
		}
		void ladeVorschlag().catch(() => undefined);
		lade<{ auftraege: KiAuftrag[]; entwurf?: KiAuftrag | null }>(`${basis}/ki`).then(
			({ auftraege, entwurf: amBlatt }) => {
				const zuletzt = entwurf ? (amBlatt ?? null) : (auftraege.find((a) => !a.neuesBlatt) ?? null);
				setAuftrag((alt) => alt ?? zuletzt);
				if (zuletzt) {
					void pruefe(zuletzt.id);
				}
			},
			() => undefined,
		);
	}, [basis, entwurf, ladeVorschlag, pruefe]);

	// Aus dem Assistenten: Der Auftrag kann schon zu Ende sein, bevor der Editor offen ist.
	useEffect(() => {
		if (gestartet) {
			void pruefe(gestartet);
		}
	}, [gestartet, pruefe]);

	useEreignisse((e) => {
		if (e.typ === 'ki-stand' && e.id && e.mappe === mappe && e.dok === dok) {
			void pruefe(e.id);
		}
		// Ein Ende vor dem Verbinden hat niemand gehört, nach einem Neustart des Servers kommt gar keins mehr.
		const bekannt = auftrag?.id ?? gestartet;
		if (e.typ === 'verbunden' && bekannt) {
			void pruefe(bekannt);
		}
		if (e.typ === 'dokument-geaendert' && e.mappe === mappe && e.dok === dok) {
			void ladeVorschlag().catch(() => undefined);
		}
	});

	const beginne = async (adresse: string, wunsch: Wunsch) => {
		setFehler(null);
		try {
			const { auftrag: neu } = await sende<{ auftrag: KiAuftrag }>(adresse, wunsch);
			setAuftrag(neu);
			await pruefe(neu.id);
		} catch (grund) {
			setFehler(meldung(grund));
			if (grund instanceof ApiFehler && grund.status === 429) {
				setAbgelehnt((n) => n + 1);
			}
			nachLauf();
		}
	};
	const starte = (wunsch: Wunsch) => (basis ? beginne(`${basis}/ki`, wunsch) : Promise.resolve());

	const handle = async (arbeit: () => Promise<unknown>) => {
		setFehler(null);
		try {
			await arbeit();
		} catch (grund) {
			setFehler(meldung(grund));
		}
		await ladeVorschlag().catch(() => undefined);
	};

	return {
		auftrag,
		vorschlag,
		fehler,
		abgelehnt,
		starte,
		/** Derselbe erste Auftrag fürs neue Blatt noch einmal; der Server kennt ihn (133). */
		nochmal: () => (basis ? beginne(`${basis}/ki/nochmal`, {}) : Promise.resolve()),
		/** Die Meldung zum neuen Blatt ist gelesen: Nach dem Neuladen steht sie nicht wieder da. */
		vergiss: () => (basis ? sende(`${basis}/ki/entwurf/vergessen`).then(() => undefined) : Promise.resolve()),
		laeuft: auftrag?.status === 'laeuft' || auftrag?.status === 'wartet',
		setFehler,
		abbrechen: () => (auftrag ? handle(() => sende(`/api/ki/${auftrag.id}/abbrechen`)) : Promise.resolve()),
		annehmen: () => handle(() => sende(`${basis}/vorschlag/annehmen`)),
		verwerfen: () => handle(() => sende(`${basis}/vorschlag/verwerfen`)),
	};
};
