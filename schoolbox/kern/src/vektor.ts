/**
 * Rechnen mit freien Pfaden (116): Stift, Pfad-Werkzeug und Punkte bearbeiten. Rein, ohne DOM und ohne Quelltext, läuft
 * im Kern und im Browser. Der Name `pfade.ts` ist vergeben (Dateipfade), darum `vektor.ts`.
 *
 * Gerechnet wird mit den Zügen aus `formen-geometrie.ts` (104), hier nur mit `L` und `C`: `normalisiere` macht aus jedem
 * SVG-Pfad (auch relativ, `H`, `V`, `S`, `Q`, `T`, `A`) absolute `M L C Z`. So sieht der Editor bei Pfaden von Claude
 * dieselben Punkte wie bei eigenen.
 */

import type { Punkt, Segment, Zug } from './formen-geometrie';
import { pfadText, umrandung } from './formen-geometrie';

export type { Punkt, Zug } from './formen-geometrie';

// ── Lesen ───────────────────────────────────────────────────────────────────

/** Ein Befehl, wie er im `d` steht (Großbuchstabe absolut, Kleinbuchstabe relativ). */
export interface Befehl {
	art: string;
	werte: number[];
}

const ANZAHL: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Zerlegt `d` in Befehle. Wiederholte Zahlenpaare ohne Buchstaben gehören zum letzten Befehl (nach `M` als `L`). Die
 * Flags von `A` dürfen ohne Trenner stehen (`a5 5 0 011 1`). Unlesbares liefert `null`.
 */
export const zerlegePfad = (d: string): Befehl[] | null => {
	const befehle: Befehl[] = [];
	let i = 0;
	const text = d.trim();
	const leer = () => {
		while (i < text.length && /[\s,]/.test(text[i] ?? '')) {
			i += 1;
		}
	};
	const zahl = (flag: boolean): number | null => {
		leer();
		if (flag) {
			const c = text[i];
			if (c === '0' || c === '1') {
				i += 1;
				return Number(c);
			}
			return null;
		}
		const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(i));
		if (!m) {
			return null;
		}
		i += m[0].length;
		return Number(m[0]);
	};
	let letzter: string | null = null;
	while (true) {
		leer();
		if (i >= text.length) {
			break;
		}
		const c = text[i] ?? '';
		let art: string;
		if (/[a-zA-Z]/.test(c)) {
			art = c;
			i += 1;
		} else if (letzter && letzter.toUpperCase() !== 'Z') {
			art = letzter === 'M' ? 'L' : letzter === 'm' ? 'l' : letzter;
		} else {
			return null;
		}
		const n = ANZAHL[art.toUpperCase()];
		if (n === undefined) {
			return null;
		}
		const werte: number[] = [];
		for (let j = 0; j < n; j += 1) {
			const w = zahl(art.toUpperCase() === 'A' && (j === 3 || j === 4));
			if (w === null || !Number.isFinite(w)) {
				return null;
			}
			werte.push(w);
		}
		befehle.push({ art, werte });
		letzter = art;
	}
	return befehle;
};

// ── Bogen zu Kurven (SVG 1.1, Anhang F.6.5 und F.6.6) ──────────────────────

const winkel = (ux: number, uy: number, vx: number, vy: number) => {
	const w = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
	return w;
};

/** Ein elliptischer Bogen als kubische Kurven, je höchstens 90°. */
export const bogenZuKurven = (
	von: Punkt,
	rxRoh: number,
	ryRoh: number,
	drehungGrad: number,
	gross: boolean,
	positiv: boolean,
	nach: Punkt,
): Segment[] => {
	if (von.x === nach.x && von.y === nach.y) {
		return [];
	}
	let rx = Math.abs(rxRoh);
	let ry = Math.abs(ryRoh);
	if (rx === 0 || ry === 0) {
		return [{ art: 'L', p: nach }];
	}
	const phi = (drehungGrad * Math.PI) / 180;
	const cos = Math.cos(phi);
	const sin = Math.sin(phi);
	const dx = (von.x - nach.x) / 2;
	const dy = (von.y - nach.y) / 2;
	const x1 = cos * dx + sin * dy;
	const y1 = -sin * dx + cos * dy;
	// F.6.6: zu kleine Radien wachsen, bis der Bogen passt.
	const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
	if (lambda > 1) {
		const s = Math.sqrt(lambda);
		rx *= s;
		ry *= s;
	}
	const zaehler = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
	const nenner = rx * rx * y1 * y1 + ry * ry * x1 * x1;
	const faktor = (gross === positiv ? -1 : 1) * Math.sqrt(Math.max(0, zaehler / nenner));
	const cx1 = (faktor * rx * y1) / ry;
	const cy1 = (-faktor * ry * x1) / rx;
	const cx = cos * cx1 - sin * cy1 + (von.x + nach.x) / 2;
	const cy = sin * cx1 + cos * cy1 + (von.y + nach.y) / 2;
	const t1 = winkel(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
	let dt = winkel((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
	if (!positiv && dt > 0) {
		dt -= 2 * Math.PI;
	} else if (positiv && dt < 0) {
		dt += 2 * Math.PI;
	}
	const teile = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
	const schritt = dt / teile;
	const k = (4 / 3) * Math.tan(schritt / 4);
	const auf = (t: number): Punkt => ({
		x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
		y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
	});
	const ableitung = (t: number): Punkt => ({
		x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
		y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
	});
	const segmente: Segment[] = [];
	for (let j = 0; j < teile; j += 1) {
		const a = t1 + j * schritt;
		const b = a + schritt;
		const pa = auf(a);
		const pb = j === teile - 1 ? nach : auf(b);
		const da = ableitung(a);
		const db = ableitung(b);
		segmente.push({
			art: 'C',
			c1: { x: pa.x + k * da.x, y: pa.y + k * da.y },
			c2: { x: pb.x - k * db.x, y: pb.y - k * db.y },
			p: pb,
		});
	}
	return segmente;
};

// ── Normalisieren ───────────────────────────────────────────────────────────

/** Aus allen Befehlen absolute Züge aus `L` und `C` (`Q`, `T`, `S`, `A` werden kubisch, `H`, `V` gerade). */
export const normalisiere = (befehle: readonly Befehl[]): Zug[] => {
	const zuege: Zug[] = [];
	let jetzt: Zug | null = null;
	let p: Punkt = { x: 0, y: 0 };
	let start: Punkt = { x: 0, y: 0 };
	// Für `S` und `T`: der letzte Kontrollpunkt und von welcher Art er war.
	let letzteC: Punkt | null = null;
	let letzteQ: Punkt | null = null;
	const zug = () => {
		if (!jetzt) {
			jetzt = { start: { ...p }, segmente: [], zu: false };
			zuege.push(jetzt);
		}
		return jetzt;
	};
	for (const { art, werte } of befehle) {
		const relativ = art !== art.toUpperCase();
		const A = art.toUpperCase();
		const o = relativ ? p : { x: 0, y: 0 };
		const pt = (i: number): Punkt => ({ x: (werte[i] ?? 0) + o.x, y: (werte[i + 1] ?? 0) + o.y });
		let neuC: Punkt | null = null;
		let neuQ: Punkt | null = null;
		if (A === 'M') {
			p = pt(0);
			start = { ...p };
			jetzt = { start: { ...p }, segmente: [], zu: false };
			zuege.push(jetzt);
		} else if (A === 'Z') {
			const z = zug();
			z.zu = true;
			p = { ...start };
			jetzt = null;
		} else if (A === 'L' || A === 'H' || A === 'V') {
			const ziel =
				A === 'L'
					? pt(0)
					: A === 'H'
						? { x: (werte[0] ?? 0) + (relativ ? p.x : 0), y: p.y }
						: { x: p.x, y: (werte[0] ?? 0) + (relativ ? p.y : 0) };
			zug().segmente.push({ art: 'L', p: ziel });
			p = ziel;
		} else if (A === 'C' || A === 'S') {
			const c1 = A === 'C' ? pt(0) : letzteC ? { x: 2 * p.x - letzteC.x, y: 2 * p.y - letzteC.y } : { ...p };
			const c2 = A === 'C' ? pt(2) : pt(0);
			const ziel = A === 'C' ? pt(4) : pt(2);
			zug().segmente.push({ art: 'C', c1, c2, p: ziel });
			neuC = c2;
			p = ziel;
		} else if (A === 'Q' || A === 'T') {
			const c: Punkt = A === 'Q' ? pt(0) : letzteQ ? { x: 2 * p.x - letzteQ.x, y: 2 * p.y - letzteQ.y } : { ...p };
			const ziel = A === 'Q' ? pt(2) : pt(0);
			zug().segmente.push({
				art: 'C',
				c1: { x: p.x + (2 / 3) * (c.x - p.x), y: p.y + (2 / 3) * (c.y - p.y) },
				c2: { x: ziel.x + (2 / 3) * (c.x - ziel.x), y: ziel.y + (2 / 3) * (c.y - ziel.y) },
				p: ziel,
			});
			neuQ = c;
			p = ziel;
		} else if (A === 'A') {
			const ziel = pt(5);
			const z = zug();
			z.segmente.push(
				...bogenZuKurven(p, werte[0] ?? 0, werte[1] ?? 0, werte[2] ?? 0, werte[3] === 1, werte[4] === 1, ziel),
			);
			p = ziel;
		}
		letzteC = neuC;
		letzteQ = neuQ;
	}
	return zuege.filter((z) => z.segmente.length > 0 || zuege.length === 1);
};

/** Liest einen beliebigen SVG-Pfad als Züge aus `L` und `C`; `null`, wenn er nicht lesbar ist. */
export const liesPfad = (d: string): Zug[] | null => {
	const befehle = zerlegePfad(d);
	return befehle ? normalisiere(befehle) : null;
};

/** Absolute `M L C Z`, höchstens zwei Nachkommastellen. */
export const schreibePfad = (zuege: readonly Zug[]) => pfadText(zuege);

/** Das umschließende Rechteck, exakt auch für Kurven (Extrempunkte, nicht die Kontrollpunkte). */
export const umschliessendesRechteck = (zuege: readonly Zug[]) => umrandung(zuege);

/** Verschiebt und streckt alle Punkte. */
export const bildePfad = (zuege: readonly Zug[], f: (p: Punkt) => Punkt): Zug[] =>
	zuege.map((z) => ({
		zu: z.zu,
		start: f(z.start),
		segmente: z.segmente.map((s): Segment => {
			if (s.art === 'L') {
				return { art: 'L', p: f(s.p) };
			}
			if (s.art === 'C') {
				return { art: 'C', c1: f(s.c1), c2: f(s.c2), p: f(s.p) };
			}
			return { art: 'Q', c: f(s.c), p: f(s.p) };
		}),
	}));

// ── Punkte eines Pfads (Bearbeiten) ─────────────────────────────────────────

/** Ein Ankerpunkt mit seinen Griffen: `ein` gehört zur Kurve davor, `aus` zur Kurve danach (je nur bei `C`). */
export interface Anker {
	zug: number;
	/** `-1` der Start des Zugs, sonst das Segment, an dessen Ende der Punkt sitzt. */
	segment: number;
	p: Punkt;
	ein: Punkt | null;
	aus: Punkt | null;
}

const gleich = (a: Punkt, b: Punkt) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/**
 * Endet ein geschlossener Zug genau auf seinem Start, ist dieser letzte Punkt kein eigener Anker: Er gehört zum Start
 * (sonst lägen zwei Griffe übereinander).
 */
const doppelterSchluss = (z: Zug) => {
	const letztes = z.segmente.at(-1);
	return z.zu && letztes !== undefined && z.segmente.length > 1 && gleich(letztes.p, z.start);
};

/** Alle Ankerpunkte in Reihenfolge; der Index ist die Nummer für `setzeAnker` und `loescheAnker`. */
export const ankerVon = (zuege: readonly Zug[]): Anker[] =>
	zuege.flatMap((z, zi) => {
		const doppelt = doppelterSchluss(z);
		const n = z.segmente.length;
		const anzahl = doppelt ? n : n + 1;
		const liste: Anker[] = [];
		for (let i = 0; i < anzahl; i += 1) {
			// Anker i sitzt am Ende von Segment i − 1 (i = 0: Start), Griff `aus` am Anfang von Segment i.
			const segment = i - 1;
			const p = i === 0 ? z.start : (z.segmente[segment]?.p ?? z.start);
			const davor = i === 0 ? (doppelt ? z.segmente[n - 1] : undefined) : z.segmente[segment];
			const danach = i < n ? z.segmente[i] : undefined;
			liste.push({
				zug: zi,
				segment,
				p,
				ein: davor?.art === 'C' ? davor.c2 : null,
				aus: danach?.art === 'C' ? danach.c1 : null,
			});
		}
		return liste;
	});

const kopie = (zuege: readonly Zug[]): Zug[] => bildePfad(zuege, (p) => ({ ...p }));

/** Wo Anker `index` liegt: Zug und Stelle (`i` wie in `ankerVon`). */
const stelle = (zuege: readonly Zug[], index: number) => {
	let rest = index;
	for (let zi = 0; zi < zuege.length; zi += 1) {
		const z = zuege[zi];
		if (!z) {
			continue;
		}
		const anzahl = doppelterSchluss(z) ? z.segmente.length : z.segmente.length + 1;
		if (rest < anzahl) {
			return { zi, i: rest, doppelt: doppelterSchluss(z) };
		}
		rest -= anzahl;
	}
	return null;
};

/**
 * Setzt Anker `index` auf `p`. Ohne `griffe` wandern seine Griffe mit (die Form bleibt glatt), mit `griffe` stehen sie
 * dort (Kurvenpunkt beim Ziehen eines Griffs).
 */
export const setzeAnker = (
	zuege: readonly Zug[],
	index: number,
	p: Punkt,
	griffe?: { ein?: Punkt | null; aus?: Punkt | null },
): Zug[] => {
	const neu = kopie(zuege);
	const s = stelle(neu, index);
	const z = s ? neu[s.zi] : undefined;
	if (!s || !z) {
		return neu;
	}
	const alt = s.i === 0 ? z.start : (z.segmente[s.i - 1]?.p ?? z.start);
	const dx = p.x - alt.x;
	const dy = p.y - alt.y;
	const schiebe = (q: Punkt): Punkt => ({ x: q.x + dx, y: q.y + dy });
	const n = z.segmente.length;
	const davorIndex = s.i === 0 ? (s.doppelt ? n - 1 : -1) : s.i - 1;
	const davor = davorIndex >= 0 ? z.segmente[davorIndex] : undefined;
	const danach = s.i < n ? z.segmente[s.i] : undefined;
	if (s.i === 0) {
		z.start = { ...p };
	}
	if (davor) {
		davor.p = { ...p };
		if (davor.art === 'C') {
			davor.c2 = griffe?.ein ?? schiebe(davor.c2);
		}
	}
	if (danach?.art === 'C') {
		danach.c1 = griffe?.aus ?? schiebe(danach.c1);
	}
	return neu;
};

/**
 * Löscht Anker `index`. Die Nachbarn verbinden sich: zwei Kurven werden eine (mit ihren äußeren Griffen), sonst eine
 * Gerade. Ein Zug behält mindestens zwei Punkte; dann bleibt alles, wie es ist.
 */
export const loescheAnker = (zuege: readonly Zug[], index: number): Zug[] => {
	const neu = kopie(zuege);
	const s = stelle(neu, index);
	const z = s ? neu[s.zi] : undefined;
	if (!s || !z) {
		return neu;
	}
	const anzahl = s.doppelt ? z.segmente.length : z.segmente.length + 1;
	if (anzahl <= 2) {
		return neu;
	}
	if (s.i === 0) {
		const erstes = z.segmente.shift();
		if (!erstes) {
			return neu;
		}
		if (s.doppelt) {
			// Der Schluss endete auf dem alten Start: er endet nun auf dem neuen.
			const letztes = z.segmente.at(-1);
			if (letztes) {
				z.segmente[z.segmente.length - 1] = verbinde(letztes, erstes);
			}
		}
		z.start = { ...erstes.p };
		return neu;
	}
	const davor = z.segmente[s.i - 1];
	const danach = z.segmente[s.i];
	if (!davor) {
		return neu;
	}
	if (!danach) {
		z.segmente.pop();
		return neu;
	}
	z.segmente.splice(s.i - 1, 2, verbinde(davor, danach));
	return neu;
};

/** Zwei Segmente als eines: von Anfang des ersten bis Ende des zweiten, mit den äußeren Griffen. */
const verbinde = (a: Segment, b: Segment): Segment => {
	const c1 = a.art === 'C' ? a.c1 : null;
	const c2 = b.art === 'C' ? b.c2 : null;
	if (!c1 && !c2) {
		return { art: 'L', p: b.p };
	}
	return { art: 'C', c1: c1 ?? anfangVon(a), c2: c2 ?? b.p, p: b.p };
};

/** Der Anfang eines Segments ist nicht in ihm gespeichert; für die Gerade genügt ihr Ende als Griff (gerade Kante). */
const anfangVon = (s: Segment): Punkt => (s.art === 'C' ? s.c1 : s.art === 'Q' ? s.c : s.p);

// ── Glätten (Stift) ─────────────────────────────────────────────────────────

const abstandZurStrecke = (p: Punkt, a: Punkt, b: Punkt) => {
	const vx = b.x - a.x;
	const vy = b.y - a.y;
	const l2 = vx * vx + vy * vy;
	if (l2 === 0) {
		return Math.hypot(p.x - a.x, p.y - a.y);
	}
	const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
	return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy);
};

/** Ramer–Douglas–Peucker, ohne Rekursion (lange Züge): die Indizes der Punkte, die bleiben. */
export const duenneAus = (punkte: readonly Punkt[], toleranz: number): number[] => {
	const n = punkte.length;
	if (n <= 2) {
		return punkte.map((_, i) => i);
	}
	const behalten = new Uint8Array(n);
	behalten[0] = 1;
	behalten[n - 1] = 1;
	const stapel: [number, number][] = [[0, n - 1]];
	while (stapel.length > 0) {
		const [a, b] = stapel.pop() ?? [0, 0];
		const pa = punkte[a];
		const pb = punkte[b];
		if (!pa || !pb) {
			continue;
		}
		let weitester = -1;
		let max = toleranz;
		for (let i = a + 1; i < b; i += 1) {
			const p = punkte[i];
			const d = p ? abstandZurStrecke(p, pa, pb) : 0;
			if (d > max) {
				max = d;
				weitester = i;
			}
		}
		if (weitester !== -1) {
			behalten[weitester] = 1;
			stapel.push([a, weitester], [weitester, b]);
		}
	}
	const indizes: number[] = [];
	for (let i = 0; i < n; i += 1) {
		if (behalten[i]) {
			indizes.push(i);
		}
	}
	return indizes;
};

/** Ab diesem Knick (Grad) ist ein Punkt eine Ecke: Dort bleibt der Zug spitz, statt rund zu werden. */
const ECKE = 55;

const knick = (a: Punkt, b: Punkt, c: Punkt) => {
	const w1 = Math.atan2(b.y - a.y, b.x - a.x);
	const w2 = Math.atan2(c.y - b.y, c.x - b.x);
	let d = Math.abs(w2 - w1);
	if (d > Math.PI) {
		d = 2 * Math.PI - d;
	}
	return (d * 180) / Math.PI;
};

const kubischAn = (a: Punkt, s: Segment, t: number): Punkt => {
	if (s.art !== 'C') {
		return { x: a.x + (s.p.x - a.x) * t, y: a.y + (s.p.y - a.y) * t };
	}
	const u = 1 - t;
	return {
		x: u * u * u * a.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p.x,
		y: u * u * u * a.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p.y,
	};
};

/** Kubische Kurven durch die Stützpunkte (Tangenten nach Catmull-Rom); an Ecken gerade. */
const kurvenDurch = (stuetzen: readonly Punkt[], zu: boolean): Segment[] => {
	const n = stuetzen.length;
	const an = (i: number): Punkt => {
		const j = zu ? (i + n) % n : Math.max(0, Math.min(n - 1, i));
		return stuetzen[j] ?? { x: 0, y: 0 };
	};
	const istEcke = (i: number) => {
		if (!zu && (i <= 0 || i >= n - 1)) {
			return true;
		}
		return knick(an(i - 1), an(i), an(i + 1)) > ECKE;
	};
	const segmente: Segment[] = [];
	const anzahl = zu ? n : n - 1;
	for (let i = 0; i < anzahl; i += 1) {
		const p0 = an(i - 1);
		const p1 = an(i);
		const p2 = an(i + 1);
		const p3 = an(i + 2);
		const e1 = istEcke(i);
		const e2 = istEcke(i + 1);
		if (e1 && e2) {
			segmente.push({ art: 'L', p: p2 });
			continue;
		}
		// Richtung wie Catmull-Rom, Länge ein Drittel der Sehne: Bögen werden so fast kreisrund.
		const laenge = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 3;
		const richtung = (a: Punkt, b: Punkt) => {
			const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
			return { x: ((b.x - a.x) / l) * laenge, y: ((b.y - a.y) / l) * laenge };
		};
		const t1 = richtung(p0, p2);
		const t2 = richtung(p1, p3);
		const c1 = e1 ? p1 : { x: p1.x + t1.x, y: p1.y + t1.y };
		const c2 = e2 ? p2 : { x: p2.x - t2.x, y: p2.y - t2.y };
		segmente.push({ art: 'C', c1, c2, p: p2 });
	}
	return segmente;
};

/** Größter Abstand der Zeigerpunkte zur geglätteten Kurve, je Segment nur gegen die eigenen Punkte (schnell). */
const fehler = (punkte: readonly Punkt[], indizes: readonly number[], segmente: readonly Segment[], start: Punkt) => {
	let max = 0;
	let von = start;
	for (let s = 0; s < segmente.length; s += 1) {
		const seg = segmente[s];
		const a = indizes[s] ?? 0;
		const b = indizes[s + 1] ?? punkte.length - 1;
		if (!seg) {
			continue;
		}
		const proben: Punkt[] = [];
		for (let t = 0; t <= 16; t += 1) {
			proben.push(kubischAn(von, seg, t / 16));
		}
		for (let i = a + 1; i < b; i += 1) {
			const p = punkte[i];
			if (!p) {
				continue;
			}
			let best = Number.POSITIVE_INFINITY;
			for (let j = 0; j < proben.length - 1; j += 1) {
				const q1 = proben[j];
				const q2 = proben[j + 1];
				if (q1 && q2) {
					best = Math.min(best, abstandZurStrecke(p, q1, q2));
				}
			}
			max = Math.max(max, best);
		}
		von = seg.p;
	}
	return max;
};

/**
 * Glättet einen Zug aus Zeigerpunkten (Stift P): erst ausdünnen (Ramer–Douglas–Peucker), dann Catmull-Rom zu kubischen
 * Kurven (Richtung wie Catmull-Rom, Griff ein Drittel der Sehne). Ein Knick über 55° bleibt Ecke. Die Ausdünnung beginnt grob und wird feiner, bis die Kurve höchstens
 * `toleranz` von den Zeigerpunkten abweicht. `toleranz` in denselben Einheiten wie die Punkte.
 */
export const glaette = (punkte: readonly Punkt[], toleranz: number, zu = false): Zug => {
	// Doppelte Punkte (Zeiger stand still) stören Knick und Tangenten.
	const sauber = punkte.filter((p, i) => i === 0 || !gleich(p, punkte[i - 1] ?? p));
	const erster = sauber[0] ?? { x: 0, y: 0 };
	if (sauber.length < 2) {
		return { start: erster, segmente: [], zu: false };
	}
	// Geschlossen: Der letzte Punkt fällt auf den ersten, damit die Naht nicht doppelt ist.
	const liste = zu && sauber.length > 3 ? sauber.slice(0, -1) : sauber;
	let eps = toleranz * 6;
	let bestes: { indizes: number[]; segmente: Segment[] } | null = null;
	for (let versuch = 0; versuch < 6; versuch += 1) {
		const indizes = duenneAus(zu ? [...liste, erster] : liste, eps);
		const stuetzen = indizes.map((i) => (zu ? ([...liste, erster][i] ?? erster) : (liste[i] ?? erster)));
		const ohneNaht = zu ? stuetzen.slice(0, -1) : stuetzen;
		if (zu && ohneNaht.length < 3) {
			eps /= 2;
			continue;
		}
		const segmente = kurvenDurch(ohneNaht, zu);
		bestes = { indizes, segmente };
		if (fehler(zu ? [...liste, erster] : liste, indizes, segmente, erster) <= toleranz) {
			break;
		}
		eps /= 2;
	}
	return { start: erster, segmente: bestes?.segmente ?? [{ art: 'L', p: liste.at(-1) ?? erster }], zu };
};
