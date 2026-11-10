/**
 * Familie der Grundformen (104): Rechteck, Ellipse, Dreieck, Vieleck (Raute = 4 Ecken), Stern, Herz, Wolke, Pfeil.
 * Jede Form zeichnet sich in Elementgröße, der Strich liegt innen. Was ein Seitenverhältnis braucht (Vieleck, Stern,
 * Herz, Wolke), wird in Einheiten gebaut und auf die Fläche gestreckt; Rechteck und Pfeil rechnen in px, damit Ecken
 * und Spitzen beim Strecken stimmen.
 */

import type { Form, FormParameter, FormWerte } from './formen';
import type { Kasten, Punkt, Segment, Zug } from './formen-geometrie';
import { aufKreis, ellipsenZug, innen, KAPPA, passeEin, pfadText, vieleckZug, zahl } from './formen-geometrie';

const GROESSE = { b: 120, h: 120 };

const viewBox = (b: number, h: number) => `0 0 ${zahl(b)} ${zahl(h)}`;

const ergebnis = (b: number, h: number, zuege: Zug[]) => ({ viewBox: viewBox(b, h), d: pfadText(zuege) });

const wert = (p: FormWerte, attr: string, ersatz: number) => {
	const w = p[attr];
	return w === undefined || !Number.isFinite(w) ? ersatz : w;
};

const RADIUS: FormParameter = {
	attr: 'data-radius',
	name: 'Eckenradius',
	min: 0,
	max: 200,
	schritt: 1,
	standard: 0,
	einheit: 'px',
};

/** Abgerundete Ecken als kubische Kurven; der Radius ist höchstens die halbe kurze Seite. */
const rechteck = (k: Kasten, radius: number): Zug => {
	const r = Math.max(0, Math.min(radius, k.b / 2, k.h / 2));
	const { b, h, x, y } = k;
	if (r === 0) {
		return vieleckZug([
			{ x, y },
			{ x: x + b, y },
			{ x: x + b, y: y + h },
			{ x, y: y + h },
		]);
	}
	const c = r * (1 - KAPPA);
	const ecke = (p: Punkt, c1: Punkt, c2: Punkt): Segment => ({ art: 'C', c1, c2, p });
	return {
		start: { x: x + r, y },
		segmente: [
			{ art: 'L', p: { x: x + b - r, y } },
			ecke({ x: x + b, y: y + r }, { x: x + b - c, y }, { x: x + b, y: y + c }),
			{ art: 'L', p: { x: x + b, y: y + h - r } },
			ecke({ x: x + b - r, y: y + h }, { x: x + b, y: y + h - c }, { x: x + b - c, y: y + h }),
			{ art: 'L', p: { x: x + r, y: y + h } },
			ecke({ x, y: y + h - r }, { x: x + c, y: y + h }, { x, y: y + h - c }),
			{ art: 'L', p: { x, y: y + r } },
			ecke({ x: x + r, y }, { x, y: y + c }, { x: x + c, y }),
		],
		zu: true,
	};
};

/** Herz in einem Feld von 100 × 100; die Kontrollpunkte liegen im Feld, also auch die Kurve. */
const HERZ =
	'M50 100 C22 78 0 56 0 30 C0 13 13 0 28 0 C39 0 46 6 50 14 C54 6 61 0 72 0 C87 0 100 13 100 30 C100 56 78 78 50 100 Z';

const herzZug = (): Zug => {
	const zahlen = (HERZ.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
	const p = (i: number): Punkt => ({ x: zahlen[i] ?? 0, y: zahlen[i + 1] ?? 0 });
	const segmente: Segment[] = [];
	for (let i = 2; i + 5 < zahlen.length; i += 6) {
		segmente.push({ art: 'C', c1: p(i), c2: p(i + 2), p: p(i + 4) });
	}
	return { start: p(0), segmente, zu: true };
};

/** Bögen um eine flache Ellipse, die Kontrollpunkte auf einer größeren: Zwischen zwei Bögen bleibt eine Kerbe. */
const wolkeZug = (boegen: number): Zug => {
	const n = Math.max(3, Math.round(boegen));
	const schritt = 360 / n;
	const weit = 1 + 2.2 / n;
	const ellipse = (grad: number, r: number): Punkt => {
		const p = aufKreis(grad, r);
		return { x: p.x, y: p.y * 0.62 };
	};
	// Der erste Bogen beginnt links unten, damit die Wolke unten flacher wirkt als oben.
	const versatz = 180 + schritt / 2;
	const ecke = (i: number) => ellipse(versatz + i * schritt, 1);
	const segmente: Segment[] = [];
	for (let i = 0; i < n; i += 1) {
		const a = versatz + i * schritt;
		segmente.push({
			art: 'C',
			c1: ellipse(a + schritt * 0.08, weit + 0.35),
			c2: ellipse(a + schritt * 0.92, weit + 0.35),
			p: ecke(i + 1),
		});
	}
	return { start: ecke(0), segmente, zu: true };
};

export const GRUND_FORMEN: readonly Form[] = [
	{
		art: 'rechteck',
		name: 'Rechteck',
		klasse: 'ohne-text',
		parameter: [RADIUS],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) => ergebnis(b, h, [rechteck(innen(b, h, strich), wert(p, 'data-radius', 0))]),
	},
	{
		art: 'ellipse',
		name: 'Ellipse',
		klasse: 'ohne-text',
		parameter: [],
		standardGroesse: GROESSE,
		zeichne: (_p, b, h, strich) => {
			const k = innen(b, h, strich);
			return ergebnis(b, h, [ellipsenZug(k.x + k.b / 2, k.y + k.h / 2, k.b / 2, k.h / 2)]);
		},
	},
	{
		art: 'dreieck',
		name: 'Dreieck',
		klasse: 'ohne-text',
		parameter: [
			{ attr: 'data-spitze', name: 'Spitze', min: 0, max: 1, schritt: 0.05, standard: 0.5, einheit: '%' },
		],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) => {
			const k = innen(b, h, strich);
			const t = wert(p, 'data-spitze', 0.5);
			return ergebnis(b, h, [
				vieleckZug([
					{ x: k.x + k.b * t, y: k.y },
					{ x: k.x + k.b, y: k.y + k.h },
					{ x: k.x, y: k.y + k.h },
				]),
			]);
		},
	},
	{
		art: 'vieleck',
		name: 'Vieleck',
		klasse: 'ohne-text',
		parameter: [{ attr: 'data-ecken', name: 'Ecken', min: 3, max: 12, schritt: 1, standard: 6 }],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) => {
			const n = Math.round(wert(p, 'data-ecken', 6));
			const punkte = Array.from({ length: n }, (_, i) => aufKreis((i * 360) / n));
			return ergebnis(b, h, passeEin([vieleckZug(punkte)], innen(b, h, strich)));
		},
	},
	{
		art: 'stern',
		name: 'Stern',
		klasse: 'ohne-text',
		parameter: [
			{ attr: 'data-zacken', name: 'Zacken', min: 3, max: 12, schritt: 1, standard: 5 },
			{ attr: 'data-innen', name: 'Innen', min: 0.2, max: 0.9, schritt: 0.05, standard: 0.45, einheit: '%' },
		],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) => {
			const n = Math.round(wert(p, 'data-zacken', 5));
			const r = wert(p, 'data-innen', 0.45);
			const punkte = Array.from({ length: 2 * n }, (_, i) => aufKreis((i * 180) / n, i % 2 === 0 ? 1 : r));
			return ergebnis(b, h, passeEin([vieleckZug(punkte)], innen(b, h, strich)));
		},
	},
	{
		art: 'herz',
		name: 'Herz',
		klasse: 'ohne-text',
		parameter: [],
		standardGroesse: GROESSE,
		zeichne: (_p, b, h, strich) => ergebnis(b, h, passeEin([herzZug()], innen(b, h, strich))),
	},
	{
		art: 'wolke',
		name: 'Wolke',
		klasse: 'ohne-text',
		parameter: [{ attr: 'data-bogen', name: 'Bögen', min: 4, max: 10, schritt: 1, standard: 6 }],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) =>
			ergebnis(b, h, passeEin([wolkeZug(wert(p, 'data-bogen', 6))], innen(b, h, strich))),
	},
	{
		art: 'pfeil',
		name: 'Pfeil',
		klasse: 'ohne-text',
		parameter: [
			{ attr: 'data-spitze', name: 'Spitze', min: 0.1, max: 0.6, schritt: 0.05, standard: 0.35, einheit: '%' },
			{ attr: 'data-schaft', name: 'Schaft', min: 0.2, max: 0.8, schritt: 0.05, standard: 0.45, einheit: '%' },
		],
		standardGroesse: GROESSE,
		zeichne: (p, b, h, strich) => {
			const k = innen(b, h, strich);
			const spitze = k.b * wert(p, 'data-spitze', 0.35);
			const halb = (k.h * wert(p, 'data-schaft', 0.45)) / 2;
			const mitte = k.y + k.h / 2;
			const xs = k.x + k.b - spitze;
			return ergebnis(b, h, [
				vieleckZug([
					{ x: k.x, y: mitte - halb },
					{ x: xs, y: mitte - halb },
					{ x: xs, y: k.y },
					{ x: k.x + k.b, y: mitte },
					{ x: xs, y: k.y + k.h },
					{ x: xs, y: mitte + halb },
					{ x: k.x, y: mitte + halb },
				]),
			]);
		},
	},
];
