import { setzeZipfel } from '@schoolbox/kern/src/formen-aendern';
import { standardZipfel, zipfelAus, zipfelText } from '@schoolbox/kern/src/formen-text';

import { zeichneFormAnzeige } from '../anzeige-folgen';
import type { Kasten } from '../geste';
import type { GestaltungKontext } from '../kontext';
import { messe } from '../useGeste';
import type { GriffZug, ZusatzGriff } from './typ';

interface Punkt {
	x: number;
	y: number;
}

/** Figuren, an deren Mitte der Zipfel einrastet: freie Figuren (`figurfrei`) und Leitfiguren im Stapel. */
const FIGUREN = 'img.figur-frei, img.figur';

const gedreht = (p: Punkt, grad: number): Punkt => {
	const w = (grad * Math.PI) / 180;
	return { x: p.x * Math.cos(w) - p.y * Math.sin(w), y: p.x * Math.sin(w) + p.y * Math.cos(w) };
};

/**
 * Liegt `lokal` (px der Blase vor dem Drehen) über einer Figur derselben Seite, kommt deren Mitte zurück, in
 * Koordinaten der Blase umgerechnet (auch bei gedrehter Blase); sonst `lokal`.
 */
export const rasteAnFigur = (element: Element, kasten: Kasten, lokal: Punkt): Punkt => {
	const m = messe(element);
	const seite = element.closest('.seite');
	if (!m || !seite) {
		return lokal;
	}
	const mitte = { x: m.ursprung.x + kasten.x + kasten.b / 2, y: m.ursprung.y + kasten.y + kasten.h / 2 };
	const r = gedreht({ x: lokal.x - kasten.b / 2, y: lokal.y - kasten.h / 2 }, kasten.drehen);
	const zeiger = { x: mitte.x + r.x, y: mitte.y + r.y };
	for (const figur of seite.querySelectorAll(FIGUREN)) {
		const f = figur.getBoundingClientRect();
		if (zeiger.x >= f.left && zeiger.x <= f.right && zeiger.y >= f.top && zeiger.y <= f.bottom) {
			const zurueck = gedreht(
				{ x: f.left + f.width / 2 - mitte.x, y: f.top + f.height / 2 - mitte.y },
				-kasten.drehen,
			);
			return { x: Math.round(zurueck.x + kasten.b / 2), y: Math.round(zurueck.y + kasten.h / 2) };
		}
	}
	return lokal;
};

const spitzeVon = (element: Element, b: number, h: number) =>
	zipfelAus(element.getAttribute('data-zipfel')) ?? standardZipfel(b, h);

const neueSpitze = (g: GestaltungKontext, zug: GriffZug) =>
	rasteAnFigur(g.element, zug.kasten, { x: Math.round(zug.start.x + zug.dx), y: Math.round(zug.start.y + zug.dy) });

const groesse = (element: Element) => {
	const html = element as HTMLElement;
	return { b: html.offsetWidth || 1, h: html.offsetHeight || 1 };
};

/**
 * Zipfel der Sprechblase (107, 5.4): ein Punkt an der Spitze. Ziehen zeigt die Blase live; über einer Figur rastet
 * die Spitze an ihrer Mitte ein. Der Zipfel merkt sich keine Figur. Loslassen ist ein Schritt, Esc nimmt alles zurück.
 */
export const ZIPFEL_GRIFFE: ZusatzGriff[] = [
	{
		id: 'zipfel',
		name: 'Zipfel ziehen',
		fuer: (art, element) => art === 'formtext' && element.getAttribute('data-form') === 'sprechblase',
		wo: (element, kasten) => spitzeVon(element, kasten.b, kasten.h),
		zeiger: 'cursor-crosshair',
		zeichne: () => (
			<span className="block size-2.5 flex-none rotate-45 rounded-[1px] border border-brand-500 bg-amber-300 shadow" />
		),
		zeige: (g, zug) => {
			g.element.setAttribute('data-zipfel', zipfelText(neueSpitze(g, zug)));
			zeichneFormAnzeige(g.element, zug.kasten.b, zug.kasten.h);
		},
		schreibe: (g, zug) => {
			const spitze = neueSpitze(g, zug);
			g.fuehreAus('Zipfel gezogen', (q) => ({ quelle: setzeZipfel(q, g.nr, spitze), nr: g.nr }));
		},
		zuruecksetzen: (g) => {
			const { b, h } = groesse(g.element);
			zeichneFormAnzeige(g.element, b, h);
		},
	},
];
