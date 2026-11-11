import { useEffect, useRef, useState } from 'react';

import type { SchubladenId } from './schubladen/reihe';
import type { LinksStand, LinksZeigt } from './schubladen/spalten';
import { ALT, linksAusSpeicher, schalte, schalteLeiste, SPEICHER } from './schubladen/spalten';

export type RechtsName = 'inspektor' | 'versionen';

const SPEICHER_RECHTS = 'schoolbox-panel-rechts';

const lies = (schluessel: string) => {
	try {
		return localStorage.getItem(schluessel);
	} catch {
		return null;
	}
};

const merke = (schluessel: string, wert: string) => {
	try {
		localStorage.setItem(schluessel, wert);
	} catch {
		// Ohne Speicher gilt der Zustand bis zum Neuladen.
	}
};

const vergiss = (schluessel: string) => {
	try {
		localStorage.removeItem(schluessel);
	} catch {
		// Ohne Speicher gibt es nichts zu löschen.
	}
};

/**
 * Zwei Plätze für Panels, je Gerät gemerkt, nicht je Material. Links die Schubladen (093, 183): Die Ebenen bleiben
 * offen, bis man sie schließt; von den anderen ist eine offen oder keine. Was davon zu sehen ist, rechnet
 * `schubladen/spalten.ts`. Ein neues Material öffnet „Bausteine“ und merkt das erst mit der nächsten Änderung.
 * „Versionen“ ist eine Aufgabe des Augenblicks: Das Panel geht nach dem Öffnen eines Dokuments nicht von selbst wieder
 * auf.
 */
export const usePanels = (neu: boolean) => {
	const [start] = useState(() => linksAusSpeicher(lies, neu));
	const [stand, setStand] = useState<LinksStand>(start.stand);
	// Was „Linke Leiste“ geschlossen hat, bis zum Neuladen.
	const vorher = useRef<LinksStand | null>(null);
	const [rechts, setRechts] = useState<RechtsName>('inspektor');
	const [rechtsOffen, setRechtsZustand] = useState(() => lies(SPEICHER_RECHTS) !== 'zu');

	useEffect(() => {
		if (start.uebernehmen) {
			merke(SPEICHER.ebenen, start.stand.ebenen ? '1' : '0');
			for (const schluessel of ALT) {
				vergiss(schluessel);
			}
		}
	}, [start]);

	const setze = (naechster: LinksStand) => {
		setStand(naechster);
		merke(SPEICHER.links, naechster.offen ? naechster.schublade : 'zu');
		merke(SPEICHER.ebenen, naechster.ebenen ? '1' : '0');
	};

	return {
		stand,
		rechts,
		rechtsOffen,
		setRechts,
		/** Klick in der Leiste, ⌥1 … ⌥5 und ⌘K. */
		schalteLinks: (id: SchubladenId, zeigt: LinksZeigt, eng: boolean) => setze(schalte(stand, id, zeigt, eng)),
		/** „Linke Leiste“ in der Statusleiste. */
		schalteLeiste: (zeigt: LinksZeigt) => {
			const ergebnis = schalteLeiste(stand, zeigt, vorher.current);
			vorher.current = ergebnis.vorher;
			setze(ergebnis.stand);
		},
		setRechtsOffen: (offen: boolean) => {
			setRechtsZustand(offen);
			merke(SPEICHER_RECHTS, offen ? 'offen' : 'zu');
		},
		/** „Versionen“ im Kopf: noch einmal drücken führt zurück zum Inspektor. */
		wechsleRechts: (name: RechtsName) => {
			const zurueck = rechts === name && rechtsOffen;
			setRechts(zurueck ? 'inspektor' : name);
			setRechtsZustand(true);
		},
	};
};
