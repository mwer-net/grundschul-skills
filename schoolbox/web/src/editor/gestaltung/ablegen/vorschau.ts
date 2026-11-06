import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { stilMitLage } from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import { LAGE } from '@schoolbox/kern/src/gestaltung-arten';
import { MARKE } from '@schoolbox/kern/src/quelltext';

import { nrVon } from '../../darstellung';

/**
 * Die Vorschau beim Ablegen und beim Aufziehen mit einem Werkzeug (098): Das Element steht halb durchsichtig an seiner
 * künftigen Stelle im `iframe`, in einer eigenen Ebene am Ende der Seite. Wie die Lücke (094) ändert das nur die
 * Anzeige: ohne `data-sb`, ohne Schritt, ohne Speichern. `entferneVorschau` räumt sie weg.
 */

/** Steht an der Ebene der Vorschau: Einblendungen und Treffer übergehen sie. */
export const VORSCHAU = 'data-ablage-vorschau';
/** Steht am Ziel, das beim Loslassen mitentscheidet (`ziele/`). */
export const ZIEL = 'data-ablage-ziel';

const STIL = 'data-ablage-stil';
const STIL_REGELN =
	`[${VORSCHAU}]>*{opacity:.5;pointer-events:none!important}` +
	`[${ZIEL}]{outline:2px solid #2563eb!important;outline-offset:2px}`;

interface Stand {
	ebene: Element;
	element: Element;
	html: string;
}

const STAENDE = new WeakMap<Document, Stand>();

/** Ein Element aus HTML, ohne `data-sb` und `contenteditable`: Sonst fände `trefferAn` ein Element, das es nicht gibt. */
export const baueElement = (doc: Document, html: string) => {
	const vorlage = doc.createElement('template');
	vorlage.innerHTML = html.trim();
	const erstes = vorlage.content.firstElementChild;
	const element = erstes ? doc.importNode(erstes, true) : null;
	for (const e of element ? [element, ...element.querySelectorAll(`[${MARKE}], [contenteditable]`)] : []) {
		e.removeAttribute(MARKE);
		e.removeAttribute('contenteditable');
	}
	return element;
};

const stil = (doc: Document) => {
	if (!doc.querySelector(`style[${STIL}]`)) {
		const s = doc.createElement('style');
		s.setAttribute(STIL, '');
		s.textContent = STIL_REGELN;
		doc.head.append(s);
	}
};

/** Die Seiten des Materials, die eine Nummer haben (keine von `abbildungen.js` erzeugten). */
export const seitenIn = (doc: Document) =>
	[...doc.querySelectorAll('.seite:not([data-erzeugt])')].filter((s) => nrVon(s) !== null);

/** Die Seite unter einem Punkt in Koordinaten des Materials. */
export const seiteUnter = (doc: Document, x: number, y: number) =>
	seitenIn(doc).find((s) => {
		const r = s.getBoundingClientRect();
		return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	}) ?? null;

/** Ecke der Fläche, in der `--x` und `--y` gelten (die Ebene liegt mit `inset: 0` in der Seite). */
export const eckeVon = (seite: Element) => {
	const r = seite.getBoundingClientRect();
	return { x: r.left + seite.clientLeft, y: r.top + seite.clientTop };
};

/** Zeigt `html` mit `lage` auf `seite` an; dasselbe HTML wird nur verschoben. Rückgabe: das Element zum Messen. */
export const zeigeVorschau = (doc: Document, seite: Element, html: string, lage: LageTeil, ebene: EbenenName) => {
	stil(doc);
	let stand = STAENDE.get(doc);
	if (!stand || stand.html !== html || stand.ebene.parentElement !== seite || !stand.ebene.classList.contains(ebene)) {
		entferneVorschau(doc);
		const element = baueElement(doc, html);
		if (!element) {
			return null;
		}
		element.setAttribute(LAGE, 'frei');
		const huelle = doc.createElement('div');
		huelle.className = `ebene ${ebene}`;
		huelle.setAttribute(VORSCHAU, '');
		huelle.append(element);
		seite.append(huelle);
		stand = { ebene: huelle, element, html };
		STAENDE.set(doc, stand);
	}
	const neu = stilMitLage(stand.element.getAttribute('style'), lage);
	if (neu === null) {
		stand.element.removeAttribute('style');
	} else {
		stand.element.setAttribute('style', neu);
	}
	return stand.element;
};

export const entferneVorschau = (doc: Document) => {
	STAENDE.get(doc)?.ebene.remove();
	STAENDE.delete(doc);
};

/** Wie hoch `html` bei dieser Breite wird, wenn die Höhe aus dem Inhalt kommt; misst unsichtbar auf `seite`. */
export const missHoehe = (doc: Document, seite: Element, html: string, b: number) => {
	const element = zeigeVorschau(doc, seite, html, { x: 0, y: 0, b }, 'vorne');
	// Im `iframe` misst `getBoundingClientRect` ohne den Maßstab der Leinwand.
	const hoehe = element?.getBoundingClientRect().height ?? 0;
	entferneVorschau(doc);
	return hoehe;
};

/** Hebt ein Ziel hervor (`null` nimmt die Hervorhebung weg). */
export const markiereZiel = (doc: Document, ziel: Element | null) => {
	stil(doc);
	for (const e of doc.querySelectorAll(`[${ZIEL}]`)) {
		if (e !== ziel) {
			e.removeAttribute(ZIEL);
		}
	}
	ziel?.setAttribute(ZIEL, '');
};
