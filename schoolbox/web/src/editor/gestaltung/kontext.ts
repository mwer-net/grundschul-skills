import type { Baustein } from '@schoolbox/kern/src/bausteine';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';

import type { PfadTeil } from '../darstellung';
import { elementZu, nrVon } from '../darstellung';
import type { Struktur } from '../struktur';

/**
 * Was Befehle, Griffe und Inspektor über das gewählte Gestaltungselement wissen und tun können (097). Spätere Tickets
 * rufen damit den Kern selbst; `Aktionen` in `befehle.ts` bleibt, wie es ist. 113 ergänzt `nrn`.
 */
export interface GestaltungKontext {
	nr: number;
	/** Art aus `gestaltung-arten.ts`, z. B. `bildfrei`. */
	art: string;
	baustein: Baustein;
	/** Das Element im `iframe`. */
	element: Element;
	doc: Document;
	/** Ein Schritt im Verlauf, wie `struktur.fuehreAus`; die Auswahl bleibt bei `ergebnis.nr`. */
	fuehreAus: (beschreibung: string, rechne: (quelle: string) => StrukturErgebnis) => boolean;
	/** Nur zum Ansehen, ohne Schritt: setzt die Lage-Variablen am Element im `iframe`. */
	zeigeLage: (nr: number, teil: LageTeil) => void;
	/** Nummer der `.seite`, auf der das Element liegt. */
	seiteVon: (nr: number) => number | null;
}

/** Ein Element mit `data-lage="frei"`, kein Baustein darum herum. */
export const istGestaltungElement = (element: Element | null | undefined): element is Element =>
	Boolean(element?.matches(GESTALTUNG_SELEKTOR));

const VARIABLE: Record<keyof LageTeil, { name: string; einheit: string }> = {
	x: { name: '--x', einheit: 'px' },
	y: { name: '--y', einheit: 'px' },
	b: { name: '--b', einheit: 'px' },
	h: { name: '--h', einheit: 'px' },
	drehen: { name: '--drehen', einheit: 'deg' },
	spiegeln: { name: '--spiegeln', einheit: '' },
};

/** Setzt die Lage am Element im `iframe`, wie `setzeLage` es in der Quelle täte; `null` entfernt die Variable. */
export const zeigeLageAm = (element: Element, teil: LageTeil) => {
	const stil = (element as HTMLElement | SVGElement).style;
	for (const [schluessel, wert] of Object.entries(teil) as [keyof LageTeil, number | null | undefined][]) {
		const v = VARIABLE[schluessel];
		if (wert === undefined) {
			continue;
		}
		if (wert === null) {
			stil.removeProperty(v.name);
		} else {
			const gerundet = schluessel === 'drehen' ? Math.round(wert * 10) / 10 : Math.round(wert);
			stil.setProperty(v.name, `${gerundet}${v.einheit}`);
		}
	}
};

interface Optionen {
	doc: Document | null;
	pfad: PfadTeil[];
	struktur: Pick<Struktur, 'aktiv' | 'fuehreAus'>;
}

/** `null`, wenn kein Gestaltungselement gewählt ist oder das Dokument nicht zur Quelle passt. */
export const gestaltungKontext = ({ doc, pfad, struktur }: Optionen): GestaltungKontext | null => {
	const gewaehlt = pfad.at(-1);
	const element = doc && gewaehlt ? elementZu(doc, gewaehlt.nr) : null;
	if (!doc || !gewaehlt || !istGestaltungElement(element)) {
		return null;
	}
	return {
		nr: gewaehlt.nr,
		art: gewaehlt.baustein.art,
		baustein: gewaehlt.baustein,
		element,
		doc,
		fuehreAus: (beschreibung, rechne) => struktur.fuehreAus(beschreibung, rechne, false, true) !== null,
		zeigeLage: (nr, teil) => {
			const ziel = elementZu(doc, nr);
			if (ziel) {
				zeigeLageAm(ziel, teil);
			}
		},
		seiteVon: (nr) => {
			const seite = elementZu(doc, nr)?.closest('.seite');
			return seite ? nrVon(seite) : null;
		},
	};
};
