import { formVon, strichAus, vollstaendig } from '@schoolbox/kern/src/formen';

/**
 * Anzeige während einer Geste (104): Was seinen Inhalt aus der Größe erzeugt, zeichnet sich im `iframe` schon beim
 * Ziehen neu, damit nichts verzerrt, auch nicht kurz. Gegenstück zu `kern/src/groessen-folgen.ts`, je Art eine Zeile.
 * Eine Folge tut nur bei Elementen ihrer Art etwas und nur, wenn die Größe von der gezeichneten abweicht.
 */
export type AnzeigeFolge = (element: Element, b: number, h: number) => void;

const pfadIn = (element: Element) => [...element.children].find((c) => c.localName === 'path') ?? null;

/** Zeichnet eine Form im `iframe` in der Größe `b` × `h` (px des Materials), nur Darstellung, kein Schritt. */
export const zeichneFormAnzeige: AnzeigeFolge = (element, b, h) => {
	const form = element.matches('svg.form') ? formVon(element.getAttribute('data-form')) : undefined;
	const pfad = form ? pfadIn(element) : null;
	if (!form || !pfad) {
		return;
	}
	const breite = Math.max(1, Math.round(b));
	const hoehe = Math.max(1, Math.round(h));
	const param = vollstaendig(form, (attr) => element.getAttribute(attr));
	const { d, viewBox } = form.zeichne(param, breite, hoehe, strichAus(pfad.getAttribute('style')));
	if (element.getAttribute('viewBox') !== viewBox) {
		element.setAttribute('viewBox', viewBox);
	}
	if (pfad.getAttribute('d') !== d) {
		pfad.setAttribute('d', d);
	}
};

const FOLGEN: readonly AnzeigeFolge[] = [
	zeichneFormAnzeige, // 104 Formen
	// 109 Streuung, 110 Titel im Bogen, 111 Bildrahmen, 116 Pfad: je eine Zeile
];

/** Während der Geste nach jeder Größenänderung, und beim Abbrechen mit der Größe vom Start. */
export const zeigeNachGroesse = (element: Element, b: number, h: number) => {
	for (const folge of FOLGEN) {
		folge(element, b, h);
	}
};
