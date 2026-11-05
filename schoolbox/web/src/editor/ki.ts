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
}

const LEER: KiZustand = { verfuegbar: false, limit: null, warnAb: 1, aktionen: [] };

/** Ohne angemeldetes `claude` bleibt `verfuegbar` falsch, und nichts davon erscheint im Editor. */
export const useKiZustand = () => {
	const [zustand, setZustand] = useState(LEER);
	const neu = useCallback(() => {
		lade<KiZustand>('/api/ki/status').then(setZustand, () => setZustand(LEER));
	}, []);
	useEffect(neu, [neu]);
	/** Fragt das Konto selbst: Nur so löst sich eine Sperre, zum Beispiel nach dem Kauf von Guthaben. */
	const pruefeLimit = useCallback(async () => {
		setZustand(await sende<KiZustand>('/api/ki/limit/pruefen'));
	}, []);
	return { zustand, neu, pruefeLimit };
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
	verlauf?: { rolle: 'lehrkraft' | 'claude'; text: string }[];
	zitat?: string;
}

/** Auftrag und Vorschlag eines Dokuments. Beides überlebt Neuladen: Der Server hält den Stand. */
export const useKiAuftrag = (mappe: string | null, dok: string | null, nachLauf: () => void, gestartet?: string) => {
	const basis = mappe && dok ? `/api/dokumente/${mappe}/${dok}` : null;
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
		const { vorschlag: neu } = await lade<{ vorschlag: Vorschlag | null }>(`${basis}/vorschlag`);
		setVorschlag(neu);
	}, [basis]);

	const pruefe = useCallback(
		async (id: string) => {
			letzteFrage.current += 1;
			const frage = letzteFrage.current;
			try {
				const { auftrag: neu } = await lade<{ auftrag: KiAuftrag }>(`/api/ki/${id}`);
				// Eine spätere Frage kennt den neueren Stand; „läuft“ darf ein schon gemeldetes Ende nicht überschreiben.
				if (frage !== letzteFrage.current) {
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
		[ladeVorschlag, nachLauf],
	);

	useEffect(() => {
		if (!basis) {
			return;
		}
		void ladeVorschlag().catch(() => undefined);
		lade<{ auftraege: KiAuftrag[] }>(`${basis}/ki`).then(
			({ auftraege }) => {
				const zuletzt = auftraege[0] ?? null;
				setAuftrag((alt) => alt ?? zuletzt);
				if (zuletzt) {
					void pruefe(zuletzt.id);
				}
			},
			() => undefined,
		);
	}, [basis, ladeVorschlag, pruefe]);

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

	const starte = async (wunsch: Wunsch) => {
		if (!basis) {
			return;
		}
		setFehler(null);
		try {
			const { auftrag: neu } = await sende<{ auftrag: KiAuftrag }>(`${basis}/ki`, wunsch);
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
		laeuft: auftrag?.status === 'laeuft' || auftrag?.status === 'wartet',
		setFehler,
		abbrechen: () => (auftrag ? handle(() => sende(`/api/ki/${auftrag.id}/abbrechen`)) : Promise.resolve()),
		annehmen: () => handle(() => sende(`${basis}/vorschlag/annehmen`)),
		verwerfen: () => handle(() => sende(`${basis}/vorschlag/verwerfen`)),
	};
};
