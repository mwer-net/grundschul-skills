import { leseBlatt } from '@schoolbox/kern/src/kit-einstellungen';
import { bleibtNummer, leseSeitengestaltung, seitenNummern } from '@schoolbox/kern/src/seitengestaltung';
import { useMemo } from 'react';

import { elementZu, nrVon } from '../../darstellung';
import type { Struktur } from '../../struktur';
import { BlattFlaeche } from './flaeche';
import { BlattKopfband } from './kopfband';
import { BlattRahmen } from './rahmen';
import type { BlattTeile } from './teile';
import { quellSeiten, zeigeAmTeil } from './teile';

/** Welche Seite die Abschnitte zeigen: die der Auswahl, ohne Auswahl die sichtbare (wie die Palette). */
export interface BlattSeite {
	auswahl: number | null;
	/** Die sichtbare Seite im Blatt, ab 1, wie `useSichtbareSeite` sie zählt. */
	sichtbar: number;
}

/**
 * Index der Seite unter den Seiten der Quelle. Über den Index, nicht die Nummer: Nach einer Änderung auf einer früheren
 * Seite verschieben sich die Nummern, solange das Blatt noch die alte Fassung zeigt.
 */
const seitenIndex = (doc: Document | null, { auswahl, sichtbar }: BlattSeite) => {
	if (!doc) {
		return 0;
	}
	const seiten = quellSeiten(doc);
	const nrDer = (e: Element | null | undefined) => (e ? nrVon(e) : null);
	const gewaehlt = auswahl === null ? null : nrDer(elementZu(doc, auswahl)?.closest('.seite'));
	const nr = gewaehlt ?? nrDer(doc.querySelectorAll('.seite')[sichtbar - 1]);
	return Math.max(
		0,
		seiten.findIndex((s) => nrVon(s) === nr),
	);
};

interface Eigenschaften {
	doc: Document | null;
	quelle: string;
	struktur: Struktur;
	seite: BlattSeite;
}

/** Reiter „Blatt“ › Seitenfläche, Rahmen und Kopfband (5.8, 181): drei Abschnitte, immer offen, je mit „Gilt für“. */
export const BlattGestaltung = ({ doc, quelle, seite, struktur }: Eigenschaften) => {
	const nummern = useMemo(() => seitenNummern(quelle), [quelle]);
	const index = Math.min(seitenIndex(doc, seite), Math.max(0, nummern.length - 1));
	const nr = nummern[index] ?? null;
	const gestaltung = useMemo(() => (nr === null ? null : leseSeitengestaltung(quelle, nr)), [quelle, nr]);
	const minibuch = useMemo(() => leseBlatt(quelle).format === 'minibuch', [quelle]);
	if (nr === null || !gestaltung) {
		return null;
	}
	const teile: BlattTeile = {
		doc,
		quelle,
		seite: nr,
		index,
		seiten: nummern.length,
		gestaltung,
		minibuch,
		aendere: (beschreibung, rechne) => {
			const { auswahl } = seite;
			struktur.fuehreAus(beschreibung, (q) => {
				const neu = rechne(q);
				return { quelle: neu, nr: auswahl !== null && bleibtNummer(q, neu, auswahl) ? auswahl : null };
			});
		},
		zeige: (teil, alle, werte) => zeigeAmTeil(doc, alle ? null : [index], teil, werte),
	};
	return (
		<>
			<BlattFlaeche {...teile} />
			<BlattRahmen {...teile} />
			<BlattKopfband {...teile} />
		</>
	);
};
