import { useState } from 'react';

import type { SchubladenId } from './schubladen/reihe';
import { alsSchublade } from './schubladen/reihe';

export type RechtsName = 'inspektor' | 'versionen';

const SPEICHER_LINKS = 'schoolbox-panel-links';
const SPEICHER_RECHTS = 'schoolbox-panel-rechts';
const SPEICHER_ANGEHEFTET = 'schoolbox-ebenen-angeheftet';
const SPEICHER_TEILUNG = 'schoolbox-ebenen-teilung';

/** Anteil der offenen Schublade an der Spalte, wenn die Ebenen angeheftet sind; der Rest gehört den Ebenen. */
export const TEILUNG = { min: 0.2, max: 0.8, vorgabe: 0.55 };

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

export const begrenzeTeilung = (wert: number) =>
	Number.isFinite(wert) ? Math.min(TEILUNG.max, Math.max(TEILUNG.min, wert)) : TEILUNG.vorgabe;

/**
 * Zwei Plätze für Panels, je Gerät gemerkt, nicht je Material. Links die Schubladen (093): eine offen oder keine, ein
 * neues Material öffnet „Bausteine“, ein alter Wert (`gliederung`, `seiten`) die Ebenen. „Versionen“ ist eine Aufgabe des
 * Augenblicks: Das Panel geht nach dem Öffnen eines Dokuments nicht von selbst wieder auf.
 */
export const usePanels = (neu: boolean) => {
	const [links, setLinksName] = useState<SchubladenId>(() =>
		neu ? 'bausteine' : (alsSchublade(lies(SPEICHER_LINKS)) ?? 'ebenen'),
	);
	const [linksOffen, setLinksZustand] = useState(() => neu || lies(SPEICHER_LINKS) !== 'zu');
	const [angeheftet, setAngeheftet] = useState(() => lies(SPEICHER_ANGEHEFTET) === '1');
	const [teilung, setTeilungWert] = useState(() => begrenzeTeilung(Number(lies(SPEICHER_TEILUNG) ?? NaN)));
	const [rechts, setRechts] = useState<RechtsName>('inspektor');
	const [rechtsOffen, setRechtsZustand] = useState(() => lies(SPEICHER_RECHTS) !== 'zu');

	const setLinksOffen = (offen: boolean) => {
		setLinksZustand(offen);
		merke(SPEICHER_LINKS, offen ? links : 'zu');
	};

	return {
		links,
		linksOffen,
		angeheftet,
		teilung,
		rechts,
		rechtsOffen,
		setRechts,
		/** Klick in der Leiste und ⌥1 … ⌥6: öffnen, wechseln, und die offene noch einmal schließt sie. */
		schalteLinks: (name: SchubladenId) => {
			if (linksOffen && links === name) {
				setLinksOffen(false);
				return;
			}
			setLinksName(name);
			setLinksZustand(true);
			merke(SPEICHER_LINKS, name);
		},
		setLinksOffen,
		schalteAnheften: () => {
			setAngeheftet(!angeheftet);
			merke(SPEICHER_ANGEHEFTET, angeheftet ? '0' : '1');
		},
		/** Während des Ziehens nur zeigen, beim Loslassen merken. */
		setTeilung: (wert: number, merken: boolean) => {
			const neuWert = begrenzeTeilung(wert);
			setTeilungWert(neuWert);
			if (merken) {
				merke(SPEICHER_TEILUNG, String(Math.round(neuWert * 1000) / 1000));
			}
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

export type Panels = ReturnType<typeof usePanels>;
