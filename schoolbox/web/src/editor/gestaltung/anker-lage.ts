import type { Anhaengen } from '@schoolbox/kern/src/anker';
import { NICHT_ANKERBAR } from '@schoolbox/kern/src/anker';
import { kann } from '@schoolbox/kern/src/bausteine';
import { ANKER_SELEKTOR, GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';

import { bausteinVon, nameVon, nrVon, trefferAn } from '../darstellung';

/**
 * Messen für den Anker (106). Der Kern rechnet in Seitenkoordinaten: Ursprung ist die Innenkante der `.seite`, wie für
 * `--x/--y` in einer Ebene. Gemessen wird über `offsetLeft`/`offsetTop` und den berechneten Stil, nie über
 * `getBoundingClientRect`: Das Rechteck eines gedrehten Elements ist nicht seine Ecke vor dem Drehen, und eine skalierte
 * Folie verzerrte es.
 */

type Punkt = { x: number; y: number };

const istHtml = (e: Element): e is HTMLElement => 'offsetLeft' in e;

/** Linke obere Ecke (Innenkante) eines Bausteins in Koordinaten seiner Seite. */
export const ursprungInSeite = (baustein: Element): Punkt => {
	const seite = baustein.closest('.seite');
	if (!istHtml(baustein)) {
		const r = baustein.getBoundingClientRect();
		const s = seite?.getBoundingClientRect();
		return { x: r.left - (s?.left ?? 0) - (seite?.clientLeft ?? 0), y: r.top - (s?.top ?? 0) - (seite?.clientTop ?? 0) };
	}
	let x = baustein.clientLeft;
	let y = baustein.clientTop;
	let e: HTMLElement | null = baustein;
	while (e && e !== seite) {
		x += e.offsetLeft;
		y += e.offsetTop;
		const eltern: HTMLElement | null = e.offsetParent as HTMLElement | null;
		// Bis zur Seite: Ihre Innenkante ist der Ursprung, ihr Rand zählt nicht.
		if (eltern && eltern !== seite) {
			x += eltern.clientLeft;
			y += eltern.clientTop;
		}
		e = eltern === seite ? null : eltern;
	}
	return { x, y };
};

/** Linke obere Ecke des Gestaltungselements vor dem Drehen, in Koordinaten seiner Seite. */
export const lageInSeite = (element: Element): Punkt => {
	const stil = element.ownerDocument.defaultView?.getComputedStyle(element);
	const x = parseFloat(stil?.left ?? '') || 0;
	const y = parseFloat(stil?.top ?? '') || 0;
	const behaelter = element.parentElement;
	if (!behaelter || behaelter.matches('.ebene')) {
		return { x, y };
	}
	const u = ursprungInSeite(behaelter);
	return { x: x + u.x, y: y + u.y };
};

/** Was `haengeAn` braucht, gemessen im Blatt. */
export const messeAnhaengen = (element: Element, baustein: Element): Anhaengen => ({
	lage: lageInSeite(element),
	ursprung: ursprungInSeite(baustein),
});

/** Hängt das Element an einem Baustein? Dann dieser, sonst `null`. */
export const ankerBausteinVon = (element: Element) =>
	element.hasAttribute('data-anker') && element.parentElement && nrVon(element.parentElement) !== null
		? element.parentElement
		: null;

const nichtAnkerbar = (e: Element) =>
	NICHT_ANKERBAR.some((s) => (s.endsWith('*') ? e.localName.startsWith(s.slice(0, -1)) : e.matches(s)));

/** Dieselben Regeln wie `istAnkerbar` im Kern, am Element im Blatt. Der Kern prüft beim Schreiben noch einmal. */
export const istAnkerbarImBlatt = (e: Element) => {
	if (!e.matches(ANKER_SELEKTOR) || e.matches(GESTALTUNG_SELEKTOR) || e.closest('.ebene, [data-lage]') || nichtAnkerbar(e)) {
		return false;
	}
	const baustein = bausteinVon(e);
	return Boolean(baustein && !kann(baustein, 'text'));
};

const seiteNr = (e: Element) => {
	const seite = e.closest('.seite');
	return seite ? nrVon(seite) : null;
};

/** Der ankerbare Baustein unter dem Punkt (Koordinaten im `iframe`), auf derselben Seite wie `element`. */
export const ankerZielUnter = (element: Element, x: number, y: number) => {
	const seite = seiteNr(element);
	for (const e of element.ownerDocument.elementsFromPoint(x, y)) {
		if (e.closest('[data-lage]')) {
			continue;
		}
		const ziel = e.closest(ANKER_SELEKTOR);
		if (ziel && istAnkerbarImBlatt(ziel)) {
			return seiteNr(ziel) === seite ? ziel : null;
		}
	}
	return null;
};

/** Liegt der Punkt auf der Seite von `element`? */
export const aufEigenerSeite = (element: Element, x: number, y: number) => {
	const seite = seiteNr(element);
	return element.ownerDocument
		.elementsFromPoint(x, y)
		.some((e) => e.matches('.seite') && seite !== null && nrVon(e) === seite);
};

/** Alle ankerbaren Bausteine auf der Seite von `element` (auch auf ihren erzeugten Fortsetzungen). */
export const ankerZieleImBlatt = (element: Element) => {
	const seite = seiteNr(element);
	if (seite === null) {
		return [];
	}
	return [...element.ownerDocument.querySelectorAll(`.seite`)]
		.filter((s) => nrVon(s) === seite)
		.flatMap((s) => [...s.querySelectorAll(ANKER_SELEKTOR)])
		.filter(istAnkerbarImBlatt);
};

/** Wie der Baustein in Pfad und Ebenen heißt, z. B. „Aufgabe 3“. */
export const ankerName = (baustein: Element) => {
	const t = trefferAn(baustein);
	return t ? nameVon(t, trefferAn(baustein.parentElement)?.element ?? null) : 'Baustein';
};

const TEXT_LAENGE = 40;

/** Beschriftung wie in den Ebenen: „Aufgabe 3 · Zeichne ein Haus …“. */
export const ankerBeschriftung = (baustein: Element) => {
	const name = ankerName(baustein);
	const quelle = baustein.matches('.aufgabe') ? baustein.querySelector('.anw') : null;
	const text = (quelle?.textContent ?? '').replace(/\s+/g, ' ').trim();
	if (!text) {
		return name;
	}
	return `${name} · ${text.length > TEXT_LAENGE ? `${text.slice(0, TEXT_LAENGE - 1)} …` : text}`;
};

/** `auswahl.anhaengen` ohne Ziel: der Baustein, der die Mitte enthält, sonst der nächste (kleinster Abstand der Rechtecke). */
export const naechstesAnkerZiel = (element: Element) => {
	const eigener = ankerBausteinVon(element);
	const ziele = ankerZieleImBlatt(element).filter((z) => z !== eigener);
	const r = element.getBoundingClientRect();
	const mx = r.left + r.width / 2;
	const my = r.top + r.height / 2;
	let bestes: Element | null = null;
	let abstand = Infinity;
	for (const z of ziele) {
		const b = z.getBoundingClientRect();
		const dx = Math.max(b.left - mx, 0, mx - b.right);
		const dy = Math.max(b.top - my, 0, my - b.bottom);
		const d = Math.hypot(dx, dy);
		// Enthält einer die Mitte (d = 0), gewinnt der innerste: Er kommt in der Liste später.
		if (d <= abstand) {
			if (d < abstand || d === 0) {
				bestes = z;
			}
			abstand = d;
		}
	}
	return bestes;
};
