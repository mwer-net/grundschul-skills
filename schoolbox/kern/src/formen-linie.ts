/**
 * Die Linie (107, Klasse `linie`): `svg.form[data-form="linie"]` mit `data-punkte="x1,y1 x2,y2"` in px des Elements
 * und `data-anfang`/`data-ende` (`keine`, `pfeil`, `punkt`). `--x --y --b --h` sind das umschließende Rechteck plus
 * ein Rand für Strich und Spitzen (`linienRand`); eine Linie hat kein `--drehen`.
 *
 * **Spitzen als eigener Pfad** (`path.spitzen`, Abweichung vom Briefing, dort SVG-`marker`): gefüllt mit der Farbe der
 * Kontur, die der Kern bei jedem Neuzeichnen aus dem Strich der Linie übernimmt. So braucht es keine Ids (3.11).
 *
 * Diese Datei lädt zur Laufzeit nur `formen-geometrie.ts` und `quelltext.ts` (kein Ladekreis mit `formen.ts`).
 * `setzeLinie` steht in `formen-aendern.ts`, weil es `setzeLage` braucht.
 */

import type { Form, FormParameter, FormWerte } from './formen';
import type { Punkt, Zug } from './formen-geometrie';
import { ellipsenZug, pfadText, vieleckZug, zahl } from './formen-geometrie';
import { attribut, schuetzeAttribut, wendeAn, zerlege } from './quelltext';

export const ENDEN = [
	{ wert: 'keine', name: 'Keine' },
	{ wert: 'pfeil', name: 'Pfeil' },
	{ wert: 'punkt', name: 'Punkt' },
] as const;

export type Ende = (typeof ENDEN)[number]['wert'];

const ende = (attr: string, name: string): FormParameter => ({
	attr,
	name,
	min: 0,
	max: ENDEN.length - 1,
	schritt: 1,
	standard: 0,
	werte: ENDEN,
});

/** Maße der Spitzen zur Strichstärke `s`. */
const spitzeLaenge = (s: number) => 3 * s + 9;
const spitzeHalb = (s: number) => 1.5 * s + 4.5;
const punktRadius = (s: number) => s + 3;

/**
 * Abstand der Endpunkte zum Rand des Elements: Platz für Strich, Pfeilspitze und Punkt. Er hängt nur an der Strichstärke,
 * damit eine Spitze im Inspektor das Rechteck nicht verschiebt. Eine senkrechte Linie ist so nie 0 px breit.
 */
export const linienRand = (strich: number) => {
	const s = Math.max(0, strich);
	return Math.ceil(Math.max(s / 2, spitzeHalb(s), punktRadius(s))) + 1;
};

const STANDARD_LAENGE = 160;
const RAND = linienRand(3);

export const LINIEN_GROESSE = { b: STANDARD_LAENGE + 2 * RAND, h: 2 * RAND };

/** `"x1,y1 x2,y2"` → zwei Punkte; sonst `null`. */
export const punkteAus = (wert: string | null | undefined): [Punkt, Punkt] | null => {
	const zahlen = (wert ?? '').trim().split(/[\s,]+/).map(Number);
	if (zahlen.length !== 4 || zahlen.some((n) => !Number.isFinite(n))) {
		return null;
	}
	const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = zahlen;
	return [
		{ x: x1, y: y1 },
		{ x: x2, y: y2 },
	];
};

export const punkteText = (a: Punkt, b: Punkt) => `${zahl(a.x)},${zahl(a.y)} ${zahl(b.x)},${zahl(b.y)}`;

/**
 * Rechteck und Punkte einer Linie von `a` nach `b` (beide in Koordinaten der Seite): `lage` für `--x … --h`,
 * `punkte` für `data-punkte` (px des Elements).
 */
export const linieAus = (a: Punkt, b: Punkt, strich: number) => {
	const rand = linienRand(strich);
	const x = Math.round(Math.min(a.x, b.x) - rand);
	const y = Math.round(Math.min(a.y, b.y) - rand);
	const breite = Math.max(2 * rand, Math.round(Math.max(a.x, b.x) + rand) - x);
	const hoehe = Math.max(2 * rand, Math.round(Math.max(a.y, b.y) + rand) - y);
	return {
		lage: { x, y, b: breite, h: hoehe },
		punkte: punkteText({ x: a.x - x, y: a.y - y }, { x: b.x - x, y: b.y - y }),
	};
};

/** ⇧ beim Ziehen: `p` rastet in 45°-Schritten um `fest` ein, die Länge bleibt. */
export const in45 = (fest: Punkt, p: Punkt): Punkt => {
	const dx = p.x - fest.x;
	const dy = p.y - fest.y;
	const laenge = Math.hypot(dx, dy);
	const w = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
	return { x: fest.x + Math.round(Math.cos(w) * laenge), y: fest.y + Math.round(Math.sin(w) * laenge) };
};

const P1 = ['linie-x1', 'linie-y1', 'linie-x2', 'linie-y2'] as const;

/** Die Endpunkte aus den Werten, sonst waagerecht durch die Mitte. */
export const linienPunkte = (p: FormWerte, b: number, h: number): [Punkt, Punkt] => {
	const [x1, y1, x2, y2] = P1.map((k) => p[k]);
	if ([x1, y1, x2, y2].every((n) => n !== undefined && Number.isFinite(n))) {
		return [
			{ x: x1 ?? 0, y: y1 ?? 0 },
			{ x: x2 ?? 0, y: y2 ?? 0 },
		];
	}
	const rand = Math.min(linienRand(3), b / 2);
	return [
		{ x: rand, y: h / 2 },
		{ x: b - rand, y: h / 2 },
	];
};

const endeVon = (p: FormWerte, attr: string): Ende => ENDEN[Math.round(p[attr] ?? 0)]?.wert ?? 'keine';

/** Spitze an `ziel`, die Linie kommt von `von`; dazu, wie weit die Linie vor `ziel` endet. */
const spitzeAn = (art: Ende, von: Punkt, ziel: Punkt, s: number, laenge: number): { zug: Zug | null; kuerzer: number } => {
	if (art === 'punkt') {
		return { zug: ellipsenZug(ziel.x, ziel.y, punktRadius(s), punktRadius(s)), kuerzer: 0 };
	}
	if (art !== 'pfeil' || laenge === 0) {
		return { zug: null, kuerzer: 0 };
	}
	const l = Math.min(spitzeLaenge(s), laenge * 0.6);
	const w = spitzeHalb(s) * (l / spitzeLaenge(s));
	const ux = (ziel.x - von.x) / laenge;
	const uy = (ziel.y - von.y) / laenge;
	const basis = { x: ziel.x - ux * l, y: ziel.y - uy * l };
	return {
		zug: vieleckZug([ziel, { x: basis.x - uy * w, y: basis.y + ux * w }, { x: basis.x + uy * w, y: basis.y - ux * w }]),
		// Die Linie endet in der Spitze, nicht an ihrer Spitze: Ihr runder Strich ragte sonst heraus.
		kuerzer: l * 0.7,
	};
};

const zeichneLinie = (p: FormWerte, b: number, h: number, strich: number) => {
	const [a, z] = linienPunkte(p, b, h);
	const laenge = Math.hypot(z.x - a.x, z.y - a.y);
	const vorn = spitzeAn(endeVon(p, 'data-anfang'), z, a, strich, laenge);
	const hinten = spitzeAn(endeVon(p, 'data-ende'), a, z, strich, laenge);
	const weg = (von: Punkt, nach: Punkt, um: number): Punkt =>
		laenge === 0 ? von : { x: von.x + ((nach.x - von.x) / laenge) * um, y: von.y + ((nach.y - von.y) / laenge) * um };
	const start = weg(a, z, vorn.kuerzer);
	const schluss = weg(z, a, hinten.kuerzer);
	const spitzen = [vorn.zug, hinten.zug].filter((s): s is Zug => s !== null);
	return {
		viewBox: `0 0 ${zahl(b)} ${zahl(h)}`,
		d: pfadText([{ start, segmente: [{ art: 'L', p: schluss }], zu: false }]),
		...(spitzen.length ? { spitzen: pfadText(spitzen) } : {}),
	};
};

const punkteExtra = (lies: (attr: string) => string | null | undefined): FormWerte => {
	const p = punkteAus(lies('data-punkte'));
	return p ? { [P1[0]]: p[0].x, [P1[1]]: p[0].y, [P1[2]]: p[1].x, [P1[3]]: p[1].y } : {};
};

export const LINIEN_FORMEN: readonly Form[] = [
	{
		art: 'linie',
		name: 'Linie',
		klasse: 'linie',
		parameter: [ende('data-anfang', 'Anfang'), ende('data-ende', 'Ende')],
		standardGroesse: LINIEN_GROESSE,
		extra: punkteExtra,
		zeichne: zeichneLinie,
	},
];

/** `data-punkte` einer neuen Linie in Standardgröße. */
export const standardPunkte = () => punkteText({ x: RAND, y: RAND }, { x: RAND + STANDARD_LAENGE, y: RAND });

const pxAus = (stil: string, name: string) => {
	const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(-?[\\d.]+)(?:px)?\\s*(?:;|$)`).exec(stil);
	return m ? Number(m[1]) : null;
};

/**
 * Größenfolge der Linie (`groessen-folgen.ts`, vor `zeichneFormNeu`): Ändert sich `--b`/`--h` (Inspektor, Claude),
 * wandern die Punkte mit. Gemessen wird an `viewBox`, die noch die alte Größe trägt; der Rand bleibt gleich.
 */
export const skaliereLinie = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || k.tag !== 'svg' || attribut(k, 'data-form')?.wert !== 'linie') {
		return quelle;
	}
	const punkte = attribut(k, 'data-punkte');
	const p = punkteAus(punkte?.wert);
	const alt = (attribut(k, 'viewbox')?.wert ?? '').trim().split(/[\s,]+/).map(Number);
	const stil = attribut(k, 'style')?.wert ?? '';
	const b = pxAus(stil, '--b');
	const h = pxAus(stil, '--h');
	const [, , ab = Number.NaN, ah = Number.NaN] = alt;
	if (!punkte || !p || b === null || h === null || !Number.isFinite(ab) || !Number.isFinite(ah) || (ab === b && ah === h)) {
		return quelle;
	}
	const pfad = k.kinder.find((c) => c.tag === 'path');
	const strich = Number.parseFloat(/stroke-width\s*:\s*([\d.]+)/.exec(attribut(pfad ?? k, 'style')?.wert ?? '')?.[1] ?? '3');
	const rand = linienRand(Number.isFinite(strich) ? strich : 3);
	const achse = (v: number, von: number, nach: number) =>
		von - 2 * rand > 0 ? rand + ((v - rand) * Math.max(0, nach - 2 * rand)) / (von - 2 * rand) : nach / 2;
	const neu = punkteText(
		{ x: achse(p[0].x, ab, b), y: achse(p[0].y, ah, h) },
		{ x: achse(p[1].x, ab, b), y: achse(p[1].y, ah, h) },
	);
	return neu === punkte.wert
		? quelle
		: wendeAn(quelle, [{ von: punkte.start, bis: punkte.ende, text: `data-punkte="${schuetzeAttribut(neu)}"` }]);
};
