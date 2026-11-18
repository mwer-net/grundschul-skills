/**
 * Besitzer: 176. Die Läufe für neue KI-Bilder im Editor (237): Liste, Start einer Figur, Abbrechen und Verwerfen, die
 * Meldung am Ende.
 * 179 nutzt Liste, Aktionen und Meldung für `art: 'bild'` mit.
 */
import type { BildlaufStand } from '@schoolbox/kern/src/bild-auftrag';
import { figurenIn } from '@schoolbox/kern/src/figuren-namen';
import { useCallback, useEffect, useRef, useState } from 'react';

import { lade, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useEreignisse } from '../ereignisse';
import { figurenJetzt, ladeFigurenNeu } from './gestaltung/figuren-quelle';
import type { SchubladenId } from './schubladen/reihe';

/**
 * Die Aufträge, die dieser Tab gestartet hat, mit dem Namen der Figur (`null`: neue Figur). Nur hier kommt die Meldung
 * (das Ereignis geht an alle Tabs).
 */
const EIGENE = new Map<string, string | null>();

/** Alle Läufe des Servers: laufend, wartend, mit Fehler. Neu bei `bildlauf-stand` und nach einer Verbindungslücke. */
export const useBildlaufLaeufe = () => {
	const [laeufe, setLaeufe] = useState<BildlaufStand[]>([]);
	const neu = useCallback(() => {
		lade<{ laeufe: BildlaufStand[] }>('/api/bildlauf').then(
			({ laeufe: liste }) => setLaeufe(liste),
			() => undefined,
		);
	}, []);
	useEffect(neu, [neu]);
	useEreignisse((e) => {
		if (e.typ === 'bildlauf-stand' || e.typ === 'verbunden') {
			neu();
		}
	});
	return { laeufe, neu };
};

/** `POST /api/bildlauf/figur`. Wirft mit dem Text des Servers (400, 409). Den Namen bestimmt der Server genauso. */
export const starteFigur = async (text: string) => {
	const { id } = await sende<{ id: string }>('/api/bildlauf/figur', { text });
	EIGENE.set(id, figurenIn(text, figurenJetzt())[0]?.name ?? null);
	return id;
};

/** Die Bilder, die dieser Tab gestartet hat (aus „Bilder“). */
const EIGENE_BILDER = new Set<string>();

/** `POST …/bilder/beschreiben`. Wirft mit dem Text des Servers (400, 409). */
export const starteBild = async (ort: { mappe: string; dok: string }, text: string) => {
	const { id } = await sende<{ id: string }>(
		`/api/dokumente/${encodeURIComponent(ort.mappe)}/${encodeURIComponent(ort.dok)}/bilder/beschreiben`,
		{ text },
	);
	EIGENE_BILDER.add(id);
	return id;
};

/** Die Bilder aus „Bilder“ für dieses Blatt, Fehler zuerst. Leer, wenn es keine gibt. */
export const bildLaeufe = (laeufe: readonly BildlaufStand[], ort: { mappe: string; dok: string }) =>
	laeufe
		.filter((l) => l.art === 'bild' && l.ziel.mappe === ort.mappe && l.ziel.dok === ort.dok)
		.sort((a, b) => Number(b.status === 'fehler') - Number(a.status === 'fehler'));

export const bildlaufAktion = (id: string, aktion: 'abbrechen' | 'verwerfen') =>
	sende(`/api/bildlauf/${id}/${aktion}`).catch(() => undefined);

/**
 * Meldung unten, wenn ein Auftrag dieses Tabs fertig wird oder scheitert, solange seine Schublade („Figuren“ oder
 * „Bilder“) nicht zu sehen ist. „Ansehen“ öffnet sie. Jede fertige Figur lädt die Bibliothek neu, auch bei zugeklappter
 * Schublade: Sonst zeigte „Ansehen“ den alten Stand.
 */
export const useBildlaufMeldung = (offen: readonly SchubladenId[], oeffne: (id: SchubladenId) => void) => {
	const zeige = useHinweis();
	const offenJetzt = useRef(offen);
	useEffect(() => {
		offenJetzt.current = offen;
	}, [offen]);
	useEreignisse((e) => {
		const id = e.id ?? '';
		if (e.typ === 'bildlauf-stand' && e.status === 'fertig' && e.art === 'figur') {
			void ladeFigurenNeu();
		}
		const bild = EIGENE_BILDER.has(id);
		if (e.typ !== 'bildlauf-stand' || (!EIGENE.has(id) && !bild)) {
			return;
		}
		const schublade: SchubladenId = bild ? 'bilder' : 'figuren';
		const zu = () => !offenJetzt.current.includes(schublade);
		const ansehen = { titel: 'Ansehen', ausfuehren: () => zu() && oeffne(schublade) };
		if (e.status === 'fertig') {
			const name = EIGENE.get(id);
			EIGENE.delete(id);
			EIGENE_BILDER.delete(id);
			const figurText = name ? `Neue Pose von ${name} ist fertig.` : 'Neue Figur ist fertig.';
			const text = bild ? 'Neues Bild ist fertig.' : figurText;
			if (zu()) {
				zeige({ text, aktion: ansehen });
			}
		} else if (e.status === 'abgebrochen') {
			EIGENE.delete(id);
			EIGENE_BILDER.delete(id);
		} else if (e.status === 'fehler' && zu()) {
			void lade<{ laeufe: BildlaufStand[] }>('/api/bildlauf').then(
				({ laeufe }) => {
					const grund = laeufe.find((l) => l.id === id)?.fehler;
					if (grund && zu()) {
						zeige({ text: grund, art: 'fehler', aktion: ansehen });
					}
				},
				() => undefined,
			);
		}
	});
};
