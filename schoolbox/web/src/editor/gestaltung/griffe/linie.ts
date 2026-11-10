import { formVon, strichAus, werteVon } from '@schoolbox/kern/src/formen';
import { setzeLinie } from '@schoolbox/kern/src/formen-aendern';
import { in45, linieAus, linienPunkte } from '@schoolbox/kern/src/formen-linie';

import { pfadDerForm, zeichneFormAnzeige } from '../anzeige-folgen';
import type { Kasten } from '../geste';
import type { GestaltungKontext } from '../kontext';
import type { GriffZug, ZusatzGriff } from './typ';

interface Punkt {
	x: number;
	y: number;
}

const istLinie = (element: Element) => element.matches('svg.form[data-form="linie"]');

/** Die Endpunkte in px des Elements, wie sie gerade im `iframe` stehen. */
const punkteVon = (element: Element) => {
	const form = formVon('linie');
	const html = element as unknown as { getBBox?: unknown; clientWidth: number; clientHeight: number };
	const b = html.clientWidth || 1;
	const h = html.clientHeight || 1;
	return form
		? linienPunkte(
				werteVon(form, (a) => element.getAttribute(a)),
				b,
				h,
			)
		: null;
};

/** Wie weit das Element während des Zugs gegenüber dem Start gewandert ist (`--x`, `--y` am Element). */
const versatz = (element: Element, kasten: Kasten) => {
	const stil = (element as SVGElement).style;
	const x = parseFloat(stil.getPropertyValue('--x'));
	const y = parseFloat(stil.getPropertyValue('--y'));
	return { x: Number.isFinite(x) ? x - kasten.x : 0, y: Number.isFinite(y) ? y - kasten.y : 0 };
};

/** Beide Enden nach dem Zug, in Koordinaten der Seite (wie `--x`). */
const endenNach = (element: Element, i: 0 | 1, zug: GriffZug): [Punkt, Punkt] | null => {
	const punkte = punkteVon(element);
	if (!punkte) {
		return null;
	}
	const v = versatz(element, zug.kasten);
	const seite = punkte.map((p) => ({ x: zug.kasten.x + v.x + p.x, y: zug.kasten.y + v.y + p.y }));
	const fest = seite[1 - i] ?? { x: 0, y: 0 };
	const gezogen = {
		x: Math.round(zug.kasten.x + zug.start.x + zug.dx),
		y: Math.round(zug.kasten.y + zug.start.y + zug.dy),
	};
	const neu = zug.umschalt ? in45(fest, gezogen) : gezogen;
	return i === 0 ? [neu, fest] : [fest, neu];
};

/** Startpunkte merken: Während des Zugs verschiebt sich das Element, der Zug rechnet vom Start aus. */
const start = new WeakMap<Element, [Punkt, Punkt]>();

const griff = (i: 0 | 1): ZusatzGriff => ({
	id: i === 0 ? 'linie-anfang' : 'linie-ende',
	name: i === 0 ? 'Anfang der Linie' : 'Ende der Linie',
	ersetztRahmen: true,
	fuer: (art, element) => art === 'form' && istLinie(element),
	wo: (element, kasten) => {
		const p = punkteVon(element)?.[i];
		if (!p) {
			return null;
		}
		const v = versatz(element, kasten);
		return { x: p.x + v.x, y: p.y + v.y };
	},
	zeiger: 'cursor-crosshair',
	zeige: (g: GestaltungKontext, zug) => {
		const alt = start.get(g.element) ?? endenNach(g.element, i, { ...zug, dx: 0, dy: 0, umschalt: false });
		if (!alt) {
			return;
		}
		start.set(g.element, alt);
		const fest = alt[1 - i] ?? alt[0];
		const gezogen = {
			x: Math.round(zug.kasten.x + zug.start.x + zug.dx),
			y: Math.round(zug.kasten.y + zug.start.y + zug.dy),
		};
		const neu = zug.umschalt ? in45(fest, gezogen) : gezogen;
		const [a, b] = i === 0 ? [neu, fest] : [fest, neu];
		const { lage, punkte } = linieAus(a, b, strichAus(pfadDerForm(g.element)?.getAttribute('style') ?? null));
		const stil = (g.element as SVGElement).style;
		for (const [name, wert] of [
			['--x', lage.x],
			['--y', lage.y],
			['--b', lage.b],
			['--h', lage.h],
		] as const) {
			stil.setProperty(name, `${wert}px`);
		}
		g.element.setAttribute('data-punkte', punkte);
		zeichneFormAnzeige(g.element, lage.b, lage.h);
	},
	schreibe: (g, zug) => {
		const alt = start.get(g.element) ?? endenNach(g.element, i, { ...zug, dx: 0, dy: 0, umschalt: false });
		start.delete(g.element);
		if (!alt) {
			return;
		}
		const fest = alt[1 - i] ?? alt[0];
		const gezogen = {
			x: Math.round(zug.kasten.x + zug.start.x + zug.dx),
			y: Math.round(zug.kasten.y + zug.start.y + zug.dy),
		};
		const neu = zug.umschalt ? in45(fest, gezogen) : gezogen;
		const [a, b] = i === 0 ? [neu, fest] : [fest, neu];
		g.fuehreAus('Linie geändert', (q) => ({ quelle: setzeLinie(q, g.nr, a, b), nr: g.nr }));
	},
	zuruecksetzen: (g) => {
		start.delete(g.element);
		const html = g.element as unknown as { clientWidth: number; clientHeight: number };
		zeichneFormAnzeige(g.element, html.clientWidth || 1, html.clientHeight || 1);
	},
});

/**
 * Enden einer Linie (107, 5.4): zwei Endpunkte statt Rahmen, Ecken und Drehgriff (`ersetztRahmen`). ⇧ rastet in
 * 45°-Schritten um das andere Ende ein. Loslassen ist ein Schritt (`setzeLinie`), Esc nimmt alles zurück.
 */
export const LINIE_GRIFFE: ZusatzGriff[] = [griff(0), griff(1)];
