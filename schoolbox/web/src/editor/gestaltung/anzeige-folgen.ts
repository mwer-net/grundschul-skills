import { formVon, spitzenStil, strichAus, werteVon } from '@schoolbox/kern/src/formen';
import { streckePfad, strichImStil } from '@schoolbox/kern/src/formen-pfad'; // 116
import { leseStreuAngaben, parameterVon, streuungInnen } from '@schoolbox/kern/src/streuen'; // 109
import { liesPfad, schreibePfad } from '@schoolbox/kern/src/vektor'; // 116

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
	// 116: Beim Pfad ist `d` die Quelle, ihn streckt `zeichnePfadAnzeige`.
	if (!svg || !form || !pfad || form.klasse === 'pfad') {
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

// >> 109 Streuung
/** Was zuletzt in eine Streuung gezeichnet wurde: Größe und Parameter, damit gleiches Zeichnen nichts tut. */
const GEZEICHNET = new WeakMap<Element, string>();

/**
 * Zeichnet die Teile einer Streuung im `iframe` neu, in der Größe `b` × `h` und mit den Parametern, die gerade am Element
 * stehen (`data-*`). Dieselbe Saat ergibt dieselben Teile, darum springt nichts beim Ziehen. Nur Darstellung, kein
 * Schritt. Mit `neu` wird auch gezeichnet, wenn nur ein Attribut geändert wurde (Regler für die Dichte).
 */
export const zeichneStreuungAnzeige = (element: Element, b: number, h: number, neu = false) => {
	const a = element.matches('svg.streuung') ? leseStreuAngaben((name) => element.getAttribute(name)) : null;
	if (!a) {
		return;
	}
	const breite = Math.max(1, Math.round(b));
	const hoehe = Math.max(1, Math.round(h));
	const parameter = parameterVon(a, breite, hoehe);
	const schluessel = JSON.stringify(parameter);
	const viewBox = `0 0 ${breite} ${hoehe}`;
	// Ohne eigenen Stand gilt: Passt die Größe schon, ist nichts zu tun (so ruft `zeigeNachGroesse` auch beim Abbrechen).
	if (!neu && (GEZEICHNET.get(element) ?? (element.getAttribute('viewBox') === viewBox ? schluessel : null)) === schluessel) {
		return;
	}
	element.setAttribute('viewBox', viewBox);
	element.innerHTML = streuungInnen(parameter);
	GEZEICHNET.set(element, schluessel);
};
// << 109

// >> 116 Pfad
/** Was der Pfad vor der Geste zeigte: `d` und Größe. Gestreckt wird immer von dort, damit sich nichts aufrundet. */
const PFAD_START = new WeakMap<Element, { d: string; b: number; h: number; geschrieben: string }>();

/** Streckt die Punkte eines Pfads im `iframe` auf `b` × `h`, der Strich bleibt (wie `skalierePfad` im Kern). */
export const zeichnePfadAnzeige: AnzeigeFolge = (element, b, h) => {
	const pfad = element.matches('svg.form[data-form="pfad"]') ? pfadDerForm(element) : null;
	if (!pfad) {
		return;
	}
	const d = pfad.getAttribute('d') ?? '';
	let start = PFAD_START.get(element);
	if (!start || start.geschrieben !== d) {
		const [, , vb = Number.NaN, vh = Number.NaN] = (element.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
		if (!Number.isFinite(vb) || !Number.isFinite(vh)) {
			return;
		}
		start = { d, b: vb, h: vh, geschrieben: d };
	}
	const breite = Math.max(1, Math.round(b));
	const hoehe = Math.max(1, Math.round(h));
	const zuege = liesPfad(start.d);
	if (!zuege) {
		return;
	}
	const neu =
		breite === start.b && hoehe === start.h
			? start.d
			: schreibePfad(streckePfad(zuege, start, { b: breite, h: hoehe }, strichImStil(pfad.getAttribute('style')) / 2));
	pfad.setAttribute('d', neu);
	element.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
	PFAD_START.set(element, { ...start, geschrieben: neu });
};
// << 116

const FOLGEN: readonly AnzeigeFolge[] = [
	zeichneFormAnzeige, // 104 Formen; 107 Form mit Text und Linie in derselben Funktion
	zeichneStreuungAnzeige, // 109 Streuung
	zeichnePfadAnzeige, // 116 Pfad: Punkte strecken sich, der Strich bleibt
	// 110 Titel im Bogen, 111 Bildrahmen: je eine Zeile
];

/** Während der Geste nach jeder Größenänderung, und beim Abbrechen mit der Größe vom Start. */
export const zeigeNachGroesse = (element: Element, b: number, h: number) => {
	for (const folge of FOLGEN) {
		folge(element, b, h);
	}
};
