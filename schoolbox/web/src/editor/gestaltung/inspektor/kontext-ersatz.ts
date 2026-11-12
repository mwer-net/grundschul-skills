import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { SEITEN_TEILE } from '@schoolbox/kern/src/seitengestaltung';

import type { PfadTeil } from '../../darstellung';
import { elementZu, nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';
/** `GestaltungKontext` kommt aus 097. `kontextFuerGestaltung` nimmt anders als 097 auch Seitenfläche und Seitenrahmen,
 * deren Inspektor nur „Sichtbarkeit“ zeigt. */
import type { GestaltungKontext } from '../kontext';
import { nrnFuer } from '../mehrfach';

export type { GestaltungKontext };

/** Seitenfläche, Seitenrahmen und Kopfband liegen nicht frei, haben aber den Gestaltungs-Inspektor (nur „Sichtbarkeit“). */
const FLAECHEN = new Set<string>(SEITEN_TEILE);

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
	doc: Document;
	pfad: PfadTeil[];
	struktur: Pick<Struktur, 'fuehreAus'>;
}

/** `null`, wenn keine Gestaltung gewählt ist. */
export const kontextFuerGestaltung = ({ doc, pfad, struktur }: Optionen): GestaltungKontext | null => {
	const gewaehlt = pfad.at(-1);
	const element = gewaehlt ? elementZu(doc, gewaehlt.nr) : null;
	if (!gewaehlt || !element || !istGestaltungAuswahl(gewaehlt.baustein)) {
		return null;
	}
	return {
		nr: gewaehlt.nr,
		art: gewaehlt.baustein.art,
		baustein: gewaehlt.baustein,
		element,
		doc,
		fuehreAus: (beschreibung, rechne) => struktur.fuehreAus(beschreibung, rechne) !== null,
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
		nrn: kann(gewaehlt.baustein, 'lage') ? nrnFuer(doc, gewaehlt.nr) : [gewaehlt.nr], // 113
	};
};
