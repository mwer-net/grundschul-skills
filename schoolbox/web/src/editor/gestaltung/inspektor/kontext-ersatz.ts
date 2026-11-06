import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';

import type { PfadTeil } from '../../darstellung';
import { elementZu, nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';

/**
 * ERSATZ bis 097 zusammengeführt ist: dieselbe Form wie `GestaltungKontext` in `../kontext.ts` (097). Beim
 * Zusammenführen ersetzt der Orchestrator die Schnittstelle unten durch
 * `export type { GestaltungKontext } from '../kontext';`. `kontextFuerGestaltung` bleibt: Es nimmt anders als 097 auch
 * Seitenfläche und Seitenrahmen, deren Inspektor nur „Druck“ zeigt.
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

/** Seitenfläche und Seitenrahmen liegen nicht frei, haben aber den Gestaltungs-Inspektor (nur „Druck“). */
const FLAECHEN = new Set(['seitenflaeche', 'seitenrahmen']);

/** Die Weiche für Inspektor und Leiste: Gestaltung statt Baustein. */
export const istGestaltungAuswahl = (baustein: Baustein | undefined) =>
	Boolean(baustein && (kann(baustein, 'lage') || FLAECHEN.has(baustein.art)));

/** Hat die Art Lage, Ebene und Leiste, oder ist sie Seitenfläche bzw. -rahmen? */
export const liegtFreiAuf = (baustein: Baustein) => kann(baustein, 'lage');

const VARIABLE: Record<keyof LageTeil, { name: string; einheit: string }> = {
	x: { name: '--x', einheit: 'px' },
	y: { name: '--y', einheit: 'px' },
	b: { name: '--b', einheit: 'px' },
	h: { name: '--h', einheit: 'px' },
	drehen: { name: '--drehen', einheit: 'deg' },
	spiegeln: { name: '--spiegeln', einheit: '' },
};

const zeigeLageAm = (element: Element, teil: LageTeil) => {
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
	struktur: Pick<Struktur, 'fuehreAus'>;
}

/** `null`, wenn keine Gestaltung gewählt ist oder das Dokument nicht zur Quelle passt. */
export const kontextFuerGestaltung = ({ doc, pfad, struktur }: Optionen): GestaltungKontext | null => {
	const gewaehlt = pfad.at(-1);
	const element = doc && gewaehlt ? elementZu(doc, gewaehlt.nr) : null;
	if (!doc || !gewaehlt || !element || !istGestaltungAuswahl(gewaehlt.baustein)) {
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
