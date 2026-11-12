/**
 * Besitzer: 176. Die Canva-Läufe im Editor: Liste, Start einer Figur, Abbrechen und Verwerfen, die Meldung am Ende.
 * 179 nutzt Liste, Aktionen und Meldung für `art: 'bild'` mit.
 */
import type { CanvaStand } from '@schoolbox/kern/src/canva-auftrag';
import { figurenIn } from '@schoolbox/kern/src/figuren-namen';
import { useCallback, useEffect, useRef, useState } from 'react';

import { lade, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useEreignisse } from '../ereignisse';
import { figurenJetzt, ladeFigurenNeu } from './gestaltung/figuren-quelle';
// >> 179
import type { SchubladenId } from './schubladen/reihe';
// << 179

/**
 * Die Aufträge, die dieser Tab gestartet hat, mit dem Namen der Figur (`null`: neue Figur). Nur hier kommt die Meldung
 * (das Ereignis geht an alle Tabs).
 */
const EIGENE = new Map<string, string | null>();

/** Alle Läufe des Servers: laufend, wartend, mit Fehler. Neu bei `canva-stand` und nach einer Verbindungslücke. */
export const useCanvaLaeufe = () => {
	const [laeufe, setLaeufe] = useState<CanvaStand[]>([]);
	const neu = useCallback(() => {
		lade<{ laeufe: CanvaStand[] }>('/api/canva').then(
			({ laeufe: liste }) => setLaeufe(liste),
			() => undefined,
		);
	}, []);
	useEffect(neu, [neu]);
	useEreignisse((e) => {
		if (e.typ === 'canva-stand' || e.typ === 'verbunden') {
			neu();
		}
	});
	return { laeufe, neu };
};

/** `POST /api/canva/figur`. Wirft mit dem Text des Servers (400, 409). Den Namen bestimmt der Server genauso. */
export const starteFigur = async (text: string) => {
	const { id } = await sende<{ id: string }>('/api/canva/figur', { text });
	EIGENE.set(id, figurenIn(text, figurenJetzt())[0]?.name ?? null);
	return id;
};

// >> 179
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
// << 179

export const canvaAktion = (id: string, aktion: 'abbrechen' | 'verwerfen') =>
	sende(`/api/canva/${id}/${aktion}`).catch(() => undefined);

// >> 179
/**
 * Meldung unten, wenn ein Auftrag dieses Tabs fertig wird oder scheitert, solange seine Schublade („Figuren“ oder
 * „Bilder“) nicht zu sehen ist. „Ansehen“ öffnet sie. Jede fertige Figur lädt die Bibliothek neu, auch bei zugeklappter
 * Schublade: Sonst zeigte „Ansehen“ den alten Stand.
 */
export const useCanvaMeldung = (offen: readonly SchubladenId[], oeffne: (id: SchubladenId) => void) => {
	const zeige = useHinweis();
	const offenJetzt = useRef(offen);
	useEffect(() => {
		offenJetzt.current = offen;
	}, [offen]);
	useEreignisse((e) => {
		const id = e.id ?? '';
		if (e.typ === 'canva-stand' && e.status === 'fertig' && e.art === 'figur') {
			void ladeFigurenNeu();
		}
		const bild = EIGENE_BILDER.has(id);
		if (e.typ !== 'canva-stand' || (!EIGENE.has(id) && !bild)) {
			return;
		}
		const schublade: SchubladenId = bild ? 'bilder' : 'figuren';
		const zu = () => !offenJetzt.current.includes(schublade);
		const ansehen = { titel: 'Ansehen', ausfuehren: () => zu() && oeffne(schublade) };
		if (e.status === 'fertig') {
			const name = EIGENE.get(id);
			EIGENE.delete(id);
			EIGENE_BILDER.delete(id);
			const text = bild ? 'Neues Bild ist fertig.' : name ? `Neue Pose von ${name} ist fertig.` : 'Neue Figur ist fertig.';
			if (zu()) {
				zeige({ text, aktion: ansehen });
			}
		} else if (e.status === 'abgebrochen') {
			EIGENE.delete(id);
			EIGENE_BILDER.delete(id);
		} else if (e.status === 'fehler' && zu()) {
			void lade<{ laeufe: CanvaStand[] }>('/api/canva').then(({ laeufe }) => {
				const grund = laeufe.find((l) => l.id === id)?.fehler;
				if (grund && zu()) {
					zeige({ text: grund, art: 'fehler', aktion: ansehen });
				}
			}, () => undefined);
		}
	});
};
// << 179
