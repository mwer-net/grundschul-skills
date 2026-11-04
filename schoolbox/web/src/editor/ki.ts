import { useCallback, useEffect, useRef, useState } from 'react';

import { lade, meldung, sende } from '../api';
import { useEreignisse } from '../ereignisse';

export type KiStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';

export interface KiAuftrag {
	id: string;
	status: KiStatus;
	schritte: string[];
	fehler: string | null;
	ergebnis: 'vorschlag' | 'antwort' | null;
	antwort: string | null;
}

export interface KiFenster {
	auslastung: number | null;
	zurueck: string | null;
}

export interface KiLimit {
	status: string;
	fenster: { fuenfStunden: KiFenster; sieben: KiFenster };
	zurueck: string | null;
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
	return { zustand, neu };
};

const zeit = (iso: string | null) =>
	iso ? new Date(iso).toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : null;

/** Die Meldung zum Limit in einfachen Worten; `null`, solange genug Luft ist. */
export const limitHinweis = (limit: KiLimit | null, warnAb: number) => {
	if (!limit) {
		return null;
	}
	const { fuenfStunden, sieben } = limit.fenster;
	if (limit.status === 'rejected') {
		const wann = zeit(limit.zurueck);
		return {
			art: 'gesperrt' as const,
			text: `Das Limit des Claude-Kontos ist erreicht${wann ? `. Wieder möglich ab ${wann} Uhr` : ''}. Auch die Claude-App ist so lange betroffen.`,
		};
	}
	const hoechste = Math.max(fuenfStunden.auslastung ?? 0, sieben.auslastung ?? 0);
	if (hoechste >= warnAb) {
		return {
			art: 'warnung' as const,
			text: `Das Limit des Claude-Kontos ist zu ${Math.round(hoechste * 100)} % ausgeschöpft. Ist es erreicht, ist auch die Claude-App betroffen.`,
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
		starte,
		laeuft: auftrag?.status === 'laeuft' || auftrag?.status === 'wartet',
		setFehler,
		abbrechen: () => (auftrag ? handle(() => sende(`/api/ki/${auftrag.id}/abbrechen`)) : Promise.resolve()),
		annehmen: () => handle(() => sende(`${basis}/vorschlag/annehmen`)),
		verwerfen: () => handle(() => sende(`${basis}/vorschlag/verwerfen`)),
	};
};
