/**
 * Formen mit Text (107, Klasse `mit-text`): Sprechblase (`data-blase` rund, eckig, gedanke) und Band. Das HTML ist
 * `div.form-text` mit `svg` (absolut, `overflow: visible`) und `div.form-inhalt` (03-modell „Form mit Text“).
 *
 * **Der Zipfel** steht in `data-zipfel="x,y"`, px relativ zur linken oberen Ecke vor dem Drehen. Er darf außerhalb der
 * Box liegen; liegt er darin, entfällt er. Bei `gedanke` führen statt des Zipfels kleiner werdende Kreise zur Spitze.
 * Die Box ist das Maß für Auswahl, `aussen` und `druckrand`; der Zipfel zählt nicht mit (gewollt).
 *
 * Diese Datei lädt zur Laufzeit nur `formen-geometrie.ts` und `quelltext.ts` (kein Ladekreis mit `formen.ts`).
 */

import type { Form, FormParameter, FormWerte } from './formen';
import type { Kasten, Punkt, Segment, Zug } from './formen-geometrie';
import { ellipsenZug, innen, KAPPA, pfadText, vieleckZug, zahl } from './formen-geometrie';
import { attribut, schuetzeAttribut, wendeAn, zerlege } from './quelltext';

export const BLASEN = [
	{ wert: 'rund', name: 'Rund' },
	{ wert: 'eckig', name: 'Eckig' },
	{ wert: 'gedanke', name: 'Gedanke' },
] as const;

export type BlasenArt = (typeof BLASEN)[number]['wert'];

const BLASE: FormParameter = {
	attr: 'data-blase',
	name: 'Blase',
	min: 0,
	max: BLASEN.length - 1,
	schritt: 1,
	standard: 0,
	werte: BLASEN,
};

const KERBE: FormParameter = { attr: 'data-kerbe', name: 'Kerbe', min: 0, max: 0.3, schritt: 0.01, standard: 0.15, einheit: '%' };

/** Standardgröße (Entscheidung im Ticket): 180 × 84. */
export const BLASEN_GROESSE = { b: 180, h: 84 };

/** Mindestens 22 px, damit `schrift-klein` nicht anschlägt; sonst die Schriftgröße der Klasse (`--fs`). */
export const blasenSchrift = (fs?: number) => Math.max(22, fs && Number.isFinite(fs) ? Math.round(fs) : 0);

/** Wo der Zipfel einer neuen Sprechblase hinzeigt: links unten aus der Box heraus. */
export const standardZipfel = (b: number, h: number): Punkt => ({ x: Math.round(b * 0.22), y: Math.round(h + 34) });

export const zipfelText = (p: Punkt) => `${zahl(p.x)},${zahl(p.y)}`;

/** `"x,y"` → Punkt; sonst `null`. */
export const zipfelAus = (wert: string | null | undefined): Punkt | null => {
	const m = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(wert ?? '');
	if (!m) {
		return null;
	}
	const x = Number(m[1]);
	const y = Number(m[2]);
	return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const ZX = 'zipfel-x';
const ZY = 'zipfel-y';

const zipfelVon = (p: FormWerte, b: number, h: number): Punkt => {
	const x = p[ZX];
	const y = p[ZY];
	return x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y) ? standardZipfel(b, h) : { x, y };
};

/** Liegt die Spitze in der Box, gibt es keinen Zipfel. */
export const zipfelInBox = (t: Punkt, b: number, h: number) => t.x >= 0 && t.x <= b && t.y >= 0 && t.y <= h;

const ergebnis = (b: number, h: number, zuege: Zug[]) => ({ viewBox: `0 0 ${zahl(b)} ${zahl(h)}`, d: pfadText(zuege) });

// ── Rund ────────────────────────────────────────────────────────────────────

const aufEllipse = (cx: number, cy: number, rx: number, ry: number, t: number): Punkt => ({
	x: cx + rx * Math.cos(t),
	y: cy + ry * Math.sin(t),
});

/** Ellipsenbogen von `t1` nach `t2` (Parameterwinkel, `t2 > t1`) als kubische Kurven, je höchstens 90°. */
const ellipsenBogen = (cx: number, cy: number, rx: number, ry: number, t1: number, t2: number): Segment[] => {
	const n = Math.max(1, Math.ceil((t2 - t1) / (Math.PI / 2)));
	const dt = (t2 - t1) / n;
	const f = (4 / 3) * Math.tan(dt / 4);
	const segmente: Segment[] = [];
	for (let i = 0; i < n; i += 1) {
		const a = t1 + i * dt;
		const e = a + dt;
		const p0 = aufEllipse(cx, cy, rx, ry, a);
		const p3 = aufEllipse(cx, cy, rx, ry, e);
		segmente.push({
			art: 'C',
			c1: { x: p0.x - f * rx * Math.sin(a), y: p0.y + f * ry * Math.cos(a) },
			c2: { x: p3.x + f * rx * Math.sin(e), y: p3.y - f * ry * Math.cos(e) },
			p: p3,
		});
	}
	return segmente;
};

/** Parameterwinkel der Richtung zur Spitze, auf die Ellipse bezogen. */
const winkelZu = (cx: number, cy: number, rx: number, ry: number, t: Punkt) =>
	Math.atan2((t.y - cy) / Math.max(ry, 1), (t.x - cx) / Math.max(rx, 1));

const runde = (k: Kasten, spitze: Punkt | null): Zug => {
	const cx = k.x + k.b / 2;
	const cy = k.y + k.h / 2;
	const rx = k.b / 2;
	const ry = k.h / 2;
	if (!spitze) {
		return ellipsenZug(cx, cy, rx, ry);
	}
	const phi = winkelZu(cx, cy, rx, ry, spitze);
	// Halbe Breite des Zipfels am Ansatz, als Winkel: schmaler bei großen Blasen.
	const delta = Math.min(0.42, Math.max(0.16, 14 / Math.max(1, Math.min(rx, ry) * 1.6)));
	return {
		start: aufEllipse(cx, cy, rx, ry, phi + delta),
		segmente: [...ellipsenBogen(cx, cy, rx, ry, phi + delta, phi - delta + 2 * Math.PI), { art: 'L', p: spitze }],
		zu: true,
	};
};

// ── Eckig ───────────────────────────────────────────────────────────────────

type Seite = 'oben' | 'rechts' | 'unten' | 'links';

const eckige = (k: Kasten, spitze: Punkt | null): Zug => {
	const r = Math.max(0, Math.min(14, k.b / 4, k.h / 4));
	const c = r * (1 - KAPPA);
	const { b, h, x, y } = k;
	const halb = Math.max(2, Math.min(12, (b - 2 * r) / 4, (h - 2 * r) / 4));
	const klemme = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
	// Welche Seite zeigt zur Spitze? Gemessen an der Mitte, im Verhältnis zur Box.
	let seite: Seite | null = null;
	if (spitze) {
		const dx = (spitze.x - (x + b / 2)) / Math.max(1, b / 2);
		const dy = (spitze.y - (y + h / 2)) / Math.max(1, h / 2);
		seite = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'oben' : 'unten') : dx < 0 ? 'links' : 'rechts';
	}
	const zipfel = (an: Seite, von: Punkt, nach: Punkt): Segment[] => {
		if (!spitze || an !== seite) {
			return [];
		}
		if (von.y === nach.y) {
			const m = klemme(spitze.x, Math.min(von.x, nach.x) + halb, Math.max(von.x, nach.x) - halb);
			const vor = von.x < nach.x ? -halb : halb;
			return [
				{ art: 'L', p: { x: m + vor, y: von.y } },
				{ art: 'L', p: spitze },
				{ art: 'L', p: { x: m - vor, y: von.y } },
			];
		}
		const m = klemme(spitze.y, Math.min(von.y, nach.y) + halb, Math.max(von.y, nach.y) - halb);
		const vor = von.y < nach.y ? -halb : halb;
		return [
			{ art: 'L', p: { x: von.x, y: m + vor } },
			{ art: 'L', p: spitze },
			{ art: 'L', p: { x: von.x, y: m - vor } },
		];
	};
	const ecke = (p: Punkt, c1: Punkt, c2: Punkt): Segment[] => (r > 0 ? [{ art: 'C', c1, c2, p }] : []);
	const o1 = { x: x + r, y };
	const o2 = { x: x + b - r, y };
	const r1 = { x: x + b, y: y + r };
	const r2 = { x: x + b, y: y + h - r };
	const u1 = { x: x + b - r, y: y + h };
	const u2 = { x: x + r, y: y + h };
	const l1 = { x, y: y + h - r };
	const l2 = { x, y: y + r };
	return {
		start: o1,
		segmente: [
			...zipfel('oben', o1, o2),
			{ art: 'L', p: o2 },
			...ecke(r1, { x: x + b - c, y }, { x: x + b, y: y + c }),
			...zipfel('rechts', r1, r2),
			{ art: 'L', p: r2 },
			...ecke(u1, { x: x + b, y: y + h - c }, { x: x + b - c, y: y + h }),
			...zipfel('unten', u1, u2),
			{ art: 'L', p: u2 },
			...ecke(l1, { x: x + c, y: y + h }, { x, y: y + h - c }),
			...zipfel('links', l1, l2),
			{ art: 'L', p: l2 },
			...ecke(o1, { x, y: y + c }, { x: x + c, y }),
		],
		zu: true,
	};
};

// ── Gedanke ─────────────────────────────────────────────────────────────────

/** Eine Wolke aus Bögen um eine Ellipse; die Bögen bleiben in der Box. */
const wolke = (k: Kasten): Zug => {
	const cx = k.x + k.b / 2;
	const cy = k.y + k.h / 2;
	const huebel = Math.max(2, Math.min(k.b, k.h) * 0.14);
	// Ein Bogen mit Kontrollpunkten im Abstand `huebel` ragt etwa 0,75 × `huebel` hinaus.
	const rx = Math.max(1, k.b / 2 - huebel * 0.75);
	const ry = Math.max(1, k.h / 2 - huebel * 0.75);
	const umfang = Math.PI * (rx + ry);
	const n = Math.max(6, Math.min(16, Math.round(umfang / 38)));
	const dt = (2 * Math.PI) / n;
	const t0 = Math.PI / 2 + dt / 2;
	const p = (t: number) => aufEllipse(cx, cy, rx, ry, t);
	const nach = (t: number, weg: number) => {
		const q = p(t);
		const nx = Math.cos(t) / rx;
		const ny = Math.sin(t) / ry;
		const l = Math.hypot(nx, ny) || 1;
		return { x: q.x + (nx / l) * weg, y: q.y + (ny / l) * weg };
	};
	const segmente: Segment[] = [];
	for (let i = 0; i < n; i += 1) {
		const a = t0 + i * dt;
		segmente.push({ art: 'C', c1: nach(a + dt * 0.1, huebel), c2: nach(a + dt * 0.9, huebel), p: p(a + dt) });
	}
	return { start: p(t0), segmente, zu: true };
};

/** Zwei bis drei Kreise vom Rand der Wolke zur Spitze, jeder kleiner als der vorige. */
const kreiseZu = (k: Kasten, spitze: Punkt): Zug[] => {
	const cx = k.x + k.b / 2;
	const cy = k.y + k.h / 2;
	const t = winkelZu(cx, cy, k.b / 2, k.h / 2, spitze);
	const rand = aufEllipse(cx, cy, k.b / 2, k.h / 2, t);
	const weg = Math.hypot(spitze.x - rand.x, spitze.y - rand.y);
	const gross = Math.max(3, Math.min(k.b, k.h) * 0.13);
	const kreise = weg > gross * 5 ? [0.22, 0.58, 0.88] : [0.3, 0.8];
	return kreise.map((f, i) => {
		const r = Math.max(2, gross * (1 - i * 0.34));
		return ellipsenZug(rand.x + (spitze.x - rand.x) * f, rand.y + (spitze.y - rand.y) * f, r, r);
	});
};

// ── Band ────────────────────────────────────────────────────────────────────

/** Ein Band mit Kerben an beiden Enden; die Tiefe ist ein Anteil der Breite, höchstens ein Drittel davon. */
const band = (k: Kasten, kerbe: number): Zug => {
	const t = Math.min(Math.max(0, kerbe) * k.b, k.b / 3);
	return vieleckZug([
		{ x: k.x, y: k.y },
		{ x: k.x + k.b, y: k.y },
		{ x: k.x + k.b - t, y: k.y + k.h / 2 },
		{ x: k.x + k.b, y: k.y + k.h },
		{ x: k.x, y: k.y + k.h },
		{ x: k.x + t, y: k.y + k.h / 2 },
	]);
};

const wert = (p: FormWerte, attr: string, ersatz: number) => {
	const w = p[attr];
	return w === undefined || !Number.isFinite(w) ? ersatz : w;
};

/** Die Art der Blase aus dem Index des Parameters. */
export const blasenArt = (p: FormWerte): BlasenArt => BLASEN[Math.round(wert(p, 'data-blase', 0))]?.wert ?? 'rund';

/** `data-zipfel` als Werte für `zeichne`. */
const zipfelExtra = (lies: (attr: string) => string | null | undefined): FormWerte => {
	const p = zipfelAus(lies('data-zipfel'));
	return p ? { [ZX]: p.x, [ZY]: p.y } : {};
};

export const TEXT_FORMEN: readonly Form[] = [
	{
		art: 'sprechblase',
		name: 'Sprechblase',
		klasse: 'mit-text',
		parameter: [BLASE],
		standardGroesse: BLASEN_GROESSE,
		extra: zipfelExtra,
		zeichne: (p, b, h, strich) => {
			const k = innen(b, h, strich);
			const t = zipfelVon(p, b, h);
			const spitze = zipfelInBox(t, b, h) ? null : t;
			const art = blasenArt(p);
			if (art === 'eckig') {
				return ergebnis(b, h, [eckige(k, spitze)]);
			}
			if (art === 'gedanke') {
				return ergebnis(b, h, [wolke(k), ...(spitze ? kreiseZu(k, spitze) : [])]);
			}
			return ergebnis(b, h, [runde(k, spitze)]);
		},
	},
	{
		art: 'band',
		name: 'Band',
		klasse: 'mit-text',
		parameter: [KERBE],
		standardGroesse: BLASEN_GROESSE,
		zeichne: (p, b, h, strich) => ergebnis(b, h, [band(innen(b, h, strich), wert(p, 'data-kerbe', 0.15))]),
	},
];

const pxAus = (stil: string, name: string) => {
	const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(-?[\\d.]+)(?:px)?\\s*(?:;|$)`).exec(stil);
	return m ? Number(m[1]) : null;
};

/**
 * Größenfolge der Sprechblase (`groessen-folgen.ts`, vor `zeichneFormNeu`): Wird die Box größer oder kleiner, behält
 * der Zipfel seine Länge. Liegt die Spitze rechts bzw. unter der Box, wandert sie um die Änderung mit, dazwischen
 * anteilig. So verschwindet er nicht in einer größer gezogenen Blase. Gemessen an der alten `viewBox` des `svg`.
 */
export const skaliereZipfel = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || k.tag !== 'div' || attribut(k, 'data-form')?.wert !== 'sprechblase') {
		return quelle;
	}
	const zipfel = attribut(k, 'data-zipfel');
	const p = zipfelAus(zipfel?.wert);
	const svg = k.kinder.find((c) => c.tag === 'svg');
	const [, , ab = Number.NaN, ah = Number.NaN] = (attribut(svg ?? k, 'viewbox')?.wert ?? '').trim().split(/[\s,]+/).map(Number);
	const stil = attribut(k, 'style')?.wert ?? '';
	const b = pxAus(stil, '--b');
	const h = pxAus(stil, '--h');
	if (!zipfel || !p || b === null || h === null || !Number.isFinite(ab) || !Number.isFinite(ah) || ab <= 0 || ah <= 0) {
		return quelle;
	}
	const achse = (v: number, alt: number, neu: number) => (v < 0 ? v : v > alt ? v + neu - alt : (v * neu) / alt);
	const neu = zipfelText({ x: Math.round(achse(p.x, ab, b)), y: Math.round(achse(p.y, ah, h)) });
	return neu === zipfel.wert
		? quelle
		: wendeAn(quelle, [{ von: zipfel.start, bis: zipfel.ende, text: `data-zipfel="${schuetzeAttribut(neu)}"` }]);
};
