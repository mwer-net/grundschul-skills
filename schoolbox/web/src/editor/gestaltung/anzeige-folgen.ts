import { formVon, spitzenStil, strichAus, werteVon } from '@schoolbox/kern/src/formen';

/**
 * Anzeige während einer Geste (104): Was seinen Inhalt aus der Größe erzeugt, zeichnet sich im `iframe` schon beim
 * Ziehen neu, damit nichts verzerrt, auch nicht kurz. Gegenstück zu `kern/src/groessen-folgen.ts`, je Art eine Zeile.
 * Eine Folge tut nur bei Elementen ihrer Art etwas und nur, wenn die Größe von der gezeichneten abweicht.
 */
export type AnzeigeFolge = (element: Element, b: number, h: number) => void;

const NS = 'http://www.w3.org/2000/svg';

/** Das zeichnende `svg`: die Form selbst oder (107) das `svg` in `.form-text`. */
export const svgDerForm = (element: Element) =>
	element.matches('svg.form') ? element : element.matches('.form-text') ? element.querySelector(':scope > svg') : null;

/** Der Pfad der Form (ohne `path.spitzen` der Linie, 107). */
export const pfadDerForm = (element: Element) => {
	const svg = svgDerForm(element);
	return svg ? ([...svg.children].find((c) => c.localName === 'path' && !c.classList.contains('spitzen')) ?? null) : null;
};

/** Zeichnet eine Form im `iframe` in der Größe `b` × `h` (px des Materials), nur Darstellung, kein Schritt. */
export const zeichneFormAnzeige: AnzeigeFolge = (element, b, h) => {
	const svg = svgDerForm(element);
	const form = svg ? formVon(element.getAttribute('data-form')) : undefined;
	const pfad = form ? pfadDerForm(element) : null;
	if (!svg || !form || !pfad) {
		return;
	}
	const breite = Math.max(1, Math.round(b));
	const hoehe = Math.max(1, Math.round(h));
	const param = werteVon(form, (attr) => element.getAttribute(attr));
	const stil = pfad.getAttribute('style');
	const { d, spitzen, viewBox } = form.zeichne(param, breite, hoehe, strichAus(stil));
	if (svg.getAttribute('viewBox') !== viewBox) {
		svg.setAttribute('viewBox', viewBox);
	}
	if (pfad.getAttribute('d') !== d) {
		pfad.setAttribute('d', d);
	}
	// 107: Pfeilspitzen der Linie, gefüllt mit der Farbe der Kontur.
	let spitze = [...svg.children].find((c) => c.localName === 'path' && c.classList.contains('spitzen')) ?? null;
	if (!spitzen) {
		spitze?.remove();
		return;
	}
	if (!spitze) {
		spitze = svg.ownerDocument.createElementNS(NS, 'path');
		spitze.setAttribute('class', 'spitzen');
		pfad.after(spitze);
	}
	spitze.setAttribute('d', spitzen);
	const farbe = /(?:^|;)\s*stroke\s*:\s*([^;]+)/.exec(stil ?? '')?.[1]?.trim() ?? null;
	spitze.setAttribute('style', spitzenStil(farbe === 'none' ? null : farbe));
};

const FOLGEN: readonly AnzeigeFolge[] = [
	zeichneFormAnzeige, // 104 Formen; 107 Form mit Text und Linie in derselben Funktion
	// 109 Streuung, 110 Titel im Bogen, 111 Bildrahmen, 116 Pfad: je eine Zeile
];

/** Während der Geste nach jeder Größenänderung, und beim Abbrechen mit der Größe vom Start. */
export const zeigeNachGroesse = (element: Element, b: number, h: number) => {
	for (const folge of FOLGEN) {
		folge(element, b, h);
	}
};
