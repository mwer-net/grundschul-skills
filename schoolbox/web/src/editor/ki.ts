import { useCallback, useEffect, useState } from 'react';

import { lade, meldung, sende } from '../api';
import { useEreignisse } from '../ereignisse';

export type KiStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';

export interface KiAuftrag {
	id: string;
	status: KiStatus;
	schritte: string[];
	fehler: string | null;
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
}

/** Auftrag und Vorschlag eines Dokuments. Beides überlebt Neuladen: Der Server hält den Stand. */
export const useKiAuftrag = (mappe: string, dok: string, nachLauf: () => void) => {
	const basis = `/api/dokumente/${mappe}/${dok}`;
	const [auftrag, setAuftrag] = useState<KiAuftrag | null>(null);
	const [vorschlag, setVorschlag] = useState<Vorschlag | null>(null);
	const [fehler, setFehler] = useState<string | null>(null);

	const ladeVorschlag = useCallback(async () => {
		const { vorschlag: neu } = await lade<{ vorschlag: Vorschlag | null }>(`${basis}/vorschlag`);
		setVorschlag(neu);
	}, [basis]);

	const pruefe = useCallback(
		async (id: string) => {
			try {
				const { auftrag: neu } = await lade<{ auftrag: KiAuftrag }>(`/api/ki/${id}`);
				setAuftrag(neu);
				if (neu.status === 'fertig' || neu.status === 'fehler' || neu.status === 'abgebrochen') {
					setFehler(neu.fehler);
					await ladeVorschlag();
					nachLauf();
				}
			} catch (grund) {
				setAuftrag(null);
				setFehler(meldung(grund));
			}
		},
		[ladeVorschlag, nachLauf],
	);

	useEffect(() => {
		void ladeVorschlag().catch(() => undefined);
		lade<{ auftraege: KiAuftrag[] }>(`${basis}/ki`).then(
			({ auftraege }) => {
				setAuftrag(auftraege[0] ?? null);
			},
			() => undefined,
		);
	}, [basis, ladeVorschlag]);

	useEreignisse((e) => {
		if (e.typ === 'ki-stand' && e.id && e.mappe === mappe && e.dok === dok) {
			void pruefe(e.id);
		}
		// Nach einem Neustart des Servers kommt kein Ende mehr: dann den Stand selbst nachsehen.
		if (e.typ === 'verbunden' && e.wieder && auftrag) {
			void pruefe(auftrag.id);
		}
		if (e.typ === 'dokument-geaendert' && e.mappe === mappe && e.dok === dok) {
			void ladeVorschlag().catch(() => undefined);
		}
	});

	const starte = async (wunsch: Wunsch) => {
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
		abbrechen: () => (auftrag ? handle(() => sende(`/api/ki/${auftrag.id}/abbrechen`)) : Promise.resolve()),
		annehmen: () => handle(() => sende(`${basis}/vorschlag/annehmen`)),
		verwerfen: () => handle(() => sende(`${basis}/vorschlag/verwerfen`)),
	};
};
