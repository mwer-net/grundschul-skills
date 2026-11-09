import { GESTALTUNG_SELEKTOR, gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';
import type { Mass } from '@schoolbox/kern/src/gruppen';

import { bausteinVon, elementZu } from '../darstellung';
import { zeigeNachGroesse } from './anzeige-folgen';
import type { GriffName, Kasten } from './geste';
import { GRIFFE, mitteVon } from './geste';

/**
 * Was die Gruppen (120) im Blatt messen: Kästen vor dem Drehen in Koordinaten des Elternteils, aus dem berechneten Stil
 * (`left`, `top`, `width`, `height`). Das gilt auch für SVG und hängt nicht am Zoom (wie `messe` in `useGeste.ts`).
 */

const zahl = (wert: string | undefined) => {
	const n = parseFloat(wert ?? '');
	return Number.isFinite(n) ? n : 0;
};

export const kastenVon = (element: Element): Mass => {
	const stil = element.ownerDocument.defaultView?.getComputedStyle(element);
	return { x: zahl(stil?.left), y: zahl(stil?.top), b: zahl(stil?.width), h: zahl(stil?.height) };
};

/** Die Kästen zu den Nummern, in derselben Reihenfolge (fehlt eins, `undefined`). */
export const masseZu = (doc: Document, nrn: readonly number[]) =>
	nrn.map((nr) => {
		const e = elementZu(doc, nr);
		return e ? kastenVon(e) : undefined;
	});

const kinderVon = (gruppe: Element) => [...gruppe.children].filter((c) => c.matches(GESTALTUNG_SELEKTOR));

/** Größen der Kinder einer Gruppe in Quellreihenfolge, für `loeseGruppe`. */
export const groessenDerKinder = (gruppe: Element) => kinderVon(gruppe).map(kastenVon);

/** Haben alle dasselbe Elternteil (Ebene, Fläche oder Baustein am Anker)? Nur dann lässt sich gruppieren. */
export const gleicherElternteil = (doc: Document, nrn: readonly number[]) => {
	const eltern = nrn.map((nr) => elementZu(doc, nr)?.parentElement ?? null);
	return eltern.length > 1 && eltern[0] !== null && eltern.every((e) => e === eltern[0]);
};

/** Wie `nurGleichmaessig` im Kern, am Blatt: ein Kind `proportional`/`text` oder gedreht. */
export const nurGleichmaessigIm = (gruppe: Element): boolean =>
	kinderVon(gruppe).some((kind) => {
		const drehen = zahl(kind.ownerDocument.defaultView?.getComputedStyle(kind).getPropertyValue('--drehen'));
		if (drehen !== 0) {
			return true;
		}
		if (kind.matches('.gruppe')) {
			return nurGleichmaessigIm(kind);
		}
		const groesse = gestaltungArtNach(bausteinVon(kind)?.art ?? '')?.groesse;
		return groesse === 'proportional' || groesse === 'text';
	});

/** Ein Kanten-Griff einer solchen Gruppe skaliert beide Seiten: Die Mitte bleibt quer zur gezogenen Kante. */
export const gleichmaessig = (start: Kasten, roh: Kasten, griff: GriffName): Kasten => {
	const { x: sx, y: sy } = GRIFFE[griff];
	if ((sx !== 0 && sy !== 0) || start.b <= 0 || start.h <= 0) {
		return roh;
	}
	const f = sx === 0 ? roh.h / start.h : roh.b / start.b;
	const b = start.b * f;
	const h = start.h * f;
	const m = mitteVon(roh);
	return { ...roh, b, h, x: m.x - b / 2, y: m.y - h / 2 };
};

// ── Anzeige beim Ziehen am Griff ─────────────────────────────────────────────

interface Kind {
	element: HTMLElement | SVGElement;
	stil: string | null;
	kasten: Mass;
	hatH: boolean;
}

/** Stand der Kinder beim Start; Esc stellt ihn her. */
export type GruppenVorschau = readonly Kind[];

export const merkeKinder = (gruppe: Element): GruppenVorschau =>
	kinderVon(gruppe).map((element) => ({
		element: element as HTMLElement | SVGElement,
		stil: element.getAttribute('style'),
		kasten: kastenVon(element),
		hatH: /(^|;)\s*--h\s*:/.test(element.getAttribute('style') ?? ''),
	}));

/** Nur ansehen: Lage und Größe der Kinder wie bei `skaliereGruppe`, ohne Schritt. */
export const zeigeKinder = (kinder: GruppenVorschau, fx: number, fy: number) => {
	for (const { element, hatH, kasten } of kinder) {
		const b = kasten.b * fx;
		const h = kasten.h * fy;
		element.style.setProperty('--x', `${Math.round(kasten.x * fx)}px`);
		element.style.setProperty('--y', `${Math.round(kasten.y * fy)}px`);
		element.style.setProperty('--b', `${Math.round(b)}px`);
		if (hatH) {
			element.style.setProperty('--h', `${Math.round(h)}px`);
		}
		zeigeNachGroesse(element, b, h);
	}
};

export const stelleKinderHer = (kinder: GruppenVorschau) => {
	for (const { element, kasten, stil } of kinder) {
		if (stil === null) {
			element.removeAttribute('style');
		} else {
			element.setAttribute('style', stil);
		}
		zeigeNachGroesse(element, kasten.b, kasten.h);
	}
};
