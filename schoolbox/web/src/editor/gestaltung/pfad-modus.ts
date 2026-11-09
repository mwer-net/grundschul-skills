import { useSyncExternalStore } from 'react';

import type { DoppelklickZiel } from './doppelklick';

/**
 * Modus „Punkte bearbeiten“ (116): Doppelklick auf einen Pfad (`svg.form[data-form="pfad"]`, auch von Claude) zeigt
 * seine Punkte. Ziehen verschiebt, ⌥-Klick löscht, jede Änderung ist ein Schritt (`pfad-punkte.tsx`). Esc, ein Klick
 * daneben oder eine andere Auswahl beendet den Modus; ⌘Z bleibt darin. Gilt für die Nummer des Pfads, nicht für sein
 * Element: Nach jedem Schritt lädt das Blatt neu.
 */

interface Stand {
	nr: number | null;
	/** Der gewählte Punkt (Index wie `ankerVon`): Seine Griffe sind zu sehen. */
	punkt: number | null;
}

const AUS: Stand = { nr: null, punkt: null };
let stand: Stand = AUS;
const hoerer = new Set<() => void>();
let lauscher: AbortController | null = null;

const setze = (neu: Stand) => {
	if (neu.nr === stand.nr && neu.punkt === stand.punkt) {
		return;
	}
	stand = neu;
	for (const h of hoerer) {
		h();
	}
};

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

export const usePfadModus = () => useSyncExternalStore(abonniere, () => stand);

export const pfadModus = () => stand;

export const istPfad = (element: Element | null | undefined) => Boolean(element?.matches('svg.form[data-form="pfad"]'));

export const beendePfadModus = () => {
	lauscher?.abort();
	lauscher = null;
	setze(AUS);
};

export const waehlePfadPunkt = (punkt: number | null) => setze({ ...stand, punkt });

/** Ein Druck auf einen Punkt oder Griff (Überlagerung) bleibt im Modus, alles andere beendet ihn. */
const imModus = (ziel: EventTarget | null) => Boolean((ziel as Element | null)?.closest?.('[data-pfad-punkte]'));

export const startePfadModus = (nr: number, doc: Document) => {
	beendePfadModus();
	setze({ nr, punkt: null });
	lauscher = new AbortController();
	const { signal } = lauscher;
	const taste = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopImmediatePropagation();
			beendePfadModus();
		}
	};
	const druck = (e: PointerEvent) => {
		if (!imModus(e.target)) {
			beendePfadModus();
		}
	};
	window.addEventListener('keydown', taste, { capture: true, signal });
	doc.defaultView?.addEventListener('keydown', taste, { capture: true, signal });
	window.addEventListener('pointerdown', druck, { capture: true, signal });
	doc.defaultView?.addEventListener('pointerdown', druck, { capture: true, signal });
};

/** Zeile für den Doppelklick-Verteiler (`doppelklick.ts`). */
export const PFAD_PUNKTE: DoppelklickZiel = {
	id: 'pfad-punkte',
	passt: (element) => istPfad(element) && !element.hasAttribute('data-gesperrt'),
	tu: (g) => startePfadModus(g.nr, g.doc),
};
