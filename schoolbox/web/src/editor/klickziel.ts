import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';

import { nrVon, trefferAn } from './darstellung';
import type { Luecke } from './navigation';
import { lueckeAn } from './navigation';

/**
 * Was ein Klick an einer Stelle des Blatts wählt (205): ein Gestaltungselement, die Einfüge-Linie zwischen zwei Teilen
 * einer Seite oder den innersten Baustein. Klick, Rechtsklick und Hover-Rahmen fragen alle hier, damit der Rahmen nie
 * etwas anderes zeigt, als der Klick wählt.
 */
export type Klickziel =
	| { art: 'gestaltung'; nr: number; element: Element }
	| { art: 'baustein'; nr: number; element: Element }
	| { art: 'luecke'; luecke: Luecke };

export interface KlickStelle {
	doc: Document;
	/** Der getroffene Knoten, also `e.target` im Blatt. */
	ziel: Element | null;
	/** Stelle des Zeigers im Blatt. */
	x: number;
	y: number;
	/** ⌥ ist gedrückt (nur mit der Maus): Bei Gestaltung zählt dann das hinterste Element. */
	alt: boolean;
	/** Die Nummer der Auswahl: Liegt sie auf dem Weg, gewinnt sie (120). */
	gewaehlt: number | null;
	/** Die Einfüge-Linie ist an (Struktur änderbar). */
	luecken: boolean;
}

/** Liegt das gewählte Element `gewaehlt` als Geschwister neben `e` in derselben Gruppe? */
const geschwisterIn = (e: Element, gewaehlt: number) => {
	const gruppe = e.parentElement;
	return Boolean(
		gruppe?.matches(GESTALTUNG_SELEKTOR) && [...gruppe.children].some((k) => k !== e && nrVon(k) === gewaehlt),
	);
};

/**
 * Das äußerste Gestaltungselement mit Nummer um `start` (eine Gruppe vor ihren Kindern). 120: Liegt das gewählte
 * Element (`gewaehlt`, etwa ein Kind einer Gruppe) auf dem Weg, gilt es. 198-14 (Canva, Figma): Ist ein Kind gewählt,
 * gilt auch sein Geschwister in derselben Gruppe; erst ein Klick außerhalb der Gruppe verlässt sie.
 */
export const gestaltungUnter = (start: Element | null, gewaehlt: number | null = null) => {
	let gefunden: Element | null = null;
	for (let e = start; e && !e.matches('.seite'); e = e.parentElement) {
		if (e.matches(GESTALTUNG_SELEKTOR) && nrVon(e) !== null) {
			if (gewaehlt !== null && (nrVon(e) === gewaehlt || geschwisterIn(e, gewaehlt))) {
				return e;
			}
			gefunden = e;
		}
	}
	return gefunden;
};

/** ⌥-Klick: das hinterste Gestaltungselement unter dem Zeiger. Gesperrtes trifft die Prüfung nicht (`pointer-events`). */
export const hintersteAn = (doc: Document, x: number, y: number) =>
	doc
		.elementsFromPoint(x, y)
		.filter((e) => e.matches(GESTALTUNG_SELEKTOR) && nrVon(e) !== null)
		.at(-1) ?? null;

/** Mit ⌥ zuerst das gewählte Element unter dem Zeiger, sonst das hinterste dort. */
const gestaltungAn = ({ alt, doc, gewaehlt, x, y, ziel }: KlickStelle) => {
	const element = ziel ? gestaltungUnter(ziel, gewaehlt) : null;
	if (!alt) {
		return element;
	}
	const auswahl = doc.elementsFromPoint(x, y).find((u) => u.matches(GESTALTUNG_SELEKTOR) && nrVon(u) === gewaehlt);
	return auswahl ?? hintersteAn(doc, x, y) ?? element;
};

/**
 * Reihenfolge: (a) Gestaltungselement (äußerstes, mit ⌥ das hinterste), (b) Einfüge-Linie, wenn sie an ist, (c) der
 * innerste Baustein des Katalogs. Wann gewählt wird (Drücken bei Gestaltung, Loslassen bei Bausteinen), regeln die
 * Aufrufer.
 */
export const klickziel = (stelle: KlickStelle): Klickziel | null => {
	const gestaltung = gestaltungAn(stelle);
	const nr = gestaltung ? nrVon(gestaltung) : null;
	if (gestaltung && nr !== null) {
		return { art: 'gestaltung', nr, element: gestaltung };
	}
	const luecke = stelle.luecken ? lueckeAn(stelle.doc, stelle.x, stelle.y) : null;
	if (luecke) {
		return { art: 'luecke', luecke };
	}
	const treffer = trefferAn(stelle.ziel);
	return treffer ? { art: 'baustein', nr: treffer.nr, element: treffer.element } : null;
};

/** Zwei Ziele sind gleich, wenn sie dasselbe Element bzw. dieselbe Linie meinen: Nur dann zeichnet der Rahmen neu. */
export const gleichesZiel = (a: Klickziel | null, b: Klickziel | null) => {
	if (a === null || b === null) {
		return a === b;
	}
	if (a.art === 'luecke' || b.art === 'luecke') {
		return a.art === b.art && 'luecke' in a && 'luecke' in b && a.luecke.nr === b.luecke.nr && a.luecke.y === b.luecke.y;
	}
	return a.art === b.art && a.nr === b.nr;
};

/** Der Knoten eines Zeiger-Ereignisses im Blatt; `instanceof Element` gilt im `iframe` nicht, es hat eigene Klassen. */
export const knotenVon = (e: Event) => ((e.target as Node | null)?.nodeType === 1 ? (e.target as Element) : null);
