/**
 * Rechnen mit Pfaden der Formen (104): Züge aus `M`, `L`, `C`, `Q` und `Z`, nur absolut und ohne Bögen. So lassen sie
 * sich ohne DOM lesen, umranden und abtasten (111 Maske als Polygon). Rein, läuft im Kern und im Browser.
 */

export interface Punkt {
	x: number;
	y: number;
}

export type Segment =
	| { art: 'L'; p: Punkt }
	| { art: 'C'; c1: Punkt; c2: Punkt; p: Punkt }
	| { art: 'Q'; c: Punkt; p: Punkt };

/** Ein Teilpfad: Start, Segmente, mit `Z` geschlossen oder offen. */
export interface Zug {
	start: Punkt;
	segmente: Segment[];
	zu: boolean;
}

/** Ein Rechteck in px; `x`, `y` ist die linke obere Ecke. */
export interface Kasten {
	x: number;
	y: number;
	b: number;
	h: number;
}

/** Höchstens zwei Nachkommastellen, ohne Nullen am Ende (Falle „Rundungen“): `3`, `41.6`, `0.45`. */
export const zahl = (n: number) => {
	const r = Math.round(n * 100) / 100;
	return String(Object.is(r, -0) ? 0 : r);
};

const pt = (p: Punkt) => `${zahl(p.x)} ${zahl(p.y)}`;

/** `M60 3 L73.4 41.6 C… Z`: Befehl vor jedem Segment, Zahlen mit Leerzeichen. */
export const pfadText = (zuege: readonly Zug[]) =>
	zuege
		.map((z) => {
			const teile = [`M${pt(z.start)}`];
			for (const s of z.segmente) {
				if (s.art === 'L') {
					teile.push(`L${pt(s.p)}`);
				} else if (s.art === 'C') {
					teile.push(`C${pt(s.c1)} ${pt(s.c2)} ${pt(s.p)}`);
				} else {
					teile.push(`Q${pt(s.c)} ${pt(s.p)}`);
				}
			}
			if (z.zu) {
				teile.push('Z');
			}
			return teile.join(' ');
		})
		.join(' ');

/**
 * Liest einen Pfad aus `M`, `L`, `C`, `Q`, `Z` (absolut). Andere Befehle (`A`, relative, `H`, `V`) liefern `null`:
 * Solche Pfade erzeugt der Kern nie.
 */
export const zuegeAus = (d: string): Zug[] | null => {
	const marken = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
	const zuege: Zug[] = [];
	let i = 0;
	let jetzt: Zug | null = null;
	const zahlen = (n: number) => {
		const werte = marken.slice(i, i + n).map(Number);
		if (werte.length < n || werte.some((w) => !Number.isFinite(w))) {
			return null;
		}
		i += n;
		return werte;
	};
	while (i < marken.length) {
		const befehl = marken[i];
		i += 1;
		if (befehl === 'M') {
			const w = zahlen(2);
			if (!w) {
				return null;
			}
			jetzt = { start: { x: w[0] ?? 0, y: w[1] ?? 0 }, segmente: [], zu: false };
			zuege.push(jetzt);
		} else if (befehl === 'Z') {
			if (!jetzt) {
				return null;
			}
			jetzt.zu = true;
		} else if (befehl === 'L' || befehl === 'C' || befehl === 'Q') {
			const n = { L: 2, C: 6, Q: 4 }[befehl];
			const w = zahlen(n);
			if (!w || !jetzt) {
				return null;
			}
			const p = (k: number) => ({ x: w[k] ?? 0, y: w[k + 1] ?? 0 });
			if (befehl === 'L') {
				jetzt.segmente.push({ art: 'L', p: p(0) });
			} else if (befehl === 'C') {
				jetzt.segmente.push({ art: 'C', c1: p(0), c2: p(2), p: p(4) });
			} else {
				jetzt.segmente.push({ art: 'Q', c: p(0), p: p(2) });
			}
		} else {
			return null;
		}
	}
	return zuege;
};

/** Nullstellen in (0, 1) der Ableitung je Achse: dort liegen die Extrempunkte einer Kurve. */
const extremaKubisch = (a: number, b: number, c: number, d: number) => {
	// B'(t)/3 = (−a + 3b − 3c + d) t² + 2(a − 2b + c) t + (b − a)
	const qa = -a + 3 * b - 3 * c + d;
	const qb = 2 * (a - 2 * b + c);
	const qc = b - a;
	if (Math.abs(qa) < 1e-12) {
		return Math.abs(qb) < 1e-12 ? [] : [-qc / qb];
	}
	const disk = qb * qb - 4 * qa * qc;
	if (disk < 0) {
		return [];
	}
	const w = Math.sqrt(disk);
	return [(-qb + w) / (2 * qa), (-qb - w) / (2 * qa)];
};

const kubisch = (a: number, b: number, c: number, d: number, t: number) => {
	const u = 1 - t;
	return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const quadratisch = (a: number, b: number, c: number, t: number) => {
	const u = 1 - t;
	return u * u * a + 2 * u * t * b + t * t * c;
};

/** Das umschließende Rechteck der Kurven selbst (nicht der Kontrollpunkte). */
export const umrandung = (zuege: readonly Zug[]): Kasten => {
	const xs: number[] = [];
	const ys: number[] = [];
	const nimm = (p: Punkt) => {
		xs.push(p.x);
		ys.push(p.y);
	};
	for (const z of zuege) {
		let von = z.start;
		nimm(von);
		for (const s of z.segmente) {
			nimm(s.p);
			if (s.art === 'C') {
				for (const t of extremaKubisch(von.x, s.c1.x, s.c2.x, s.p.x)) {
					if (t > 0 && t < 1) {
						xs.push(kubisch(von.x, s.c1.x, s.c2.x, s.p.x, t));
					}
				}
				for (const t of extremaKubisch(von.y, s.c1.y, s.c2.y, s.p.y)) {
					if (t > 0 && t < 1) {
						ys.push(kubisch(von.y, s.c1.y, s.c2.y, s.p.y, t));
					}
				}
			} else if (s.art === 'Q') {
				const tx = (von.x - s.c.x) / (von.x - 2 * s.c.x + s.p.x);
				const ty = (von.y - s.c.y) / (von.y - 2 * s.c.y + s.p.y);
				if (tx > 0 && tx < 1) {
					xs.push(quadratisch(von.x, s.c.x, s.p.x, tx));
				}
				if (ty > 0 && ty < 1) {
					ys.push(quadratisch(von.y, s.c.y, s.p.y, ty));
				}
			}
			von = s.p;
		}
	}
	if (xs.length === 0) {
		return { x: 0, y: 0, b: 0, h: 0 };
	}
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, b: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

const bilde = (zuege: readonly Zug[], f: (p: Punkt) => Punkt): Zug[] =>
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

/** Streckt die Züge so, dass ihre Umrandung genau `ziel` füllt (je Achse für sich). */
export const passeEin = (zuege: readonly Zug[], ziel: Kasten): Zug[] => {
	const u = umrandung(zuege);
	const sx = u.b > 0 ? ziel.b / u.b : 0;
	const sy = u.h > 0 ? ziel.h / u.h : 0;
	return bilde(zuege, (p) => ({
		x: ziel.x + (u.b > 0 ? (p.x - u.x) * sx : ziel.b / 2),
		y: ziel.y + (u.h > 0 ? (p.y - u.y) * sy : ziel.h / 2),
	}));
};

/** Kreis und Ellipse als vier kubische Kurven (kein `A`, damit 111 ohne DOM abtasten kann). */
export const KAPPA = 0.5522847498;

export const ellipsenZug = (cx: number, cy: number, rx: number, ry: number): Zug => {
	const kx = rx * KAPPA;
	const ky = ry * KAPPA;
	return {
		start: { x: cx, y: cy - ry },
		segmente: [
			{ art: 'C', c1: { x: cx + kx, y: cy - ry }, c2: { x: cx + rx, y: cy - ky }, p: { x: cx + rx, y: cy } },
			{ art: 'C', c1: { x: cx + rx, y: cy + ky }, c2: { x: cx + kx, y: cy + ry }, p: { x: cx, y: cy + ry } },
			{ art: 'C', c1: { x: cx - kx, y: cy + ry }, c2: { x: cx - rx, y: cy + ky }, p: { x: cx - rx, y: cy } },
			{ art: 'C', c1: { x: cx - rx, y: cy - ky }, c2: { x: cx - kx, y: cy - ry }, p: { x: cx, y: cy - ry } },
		],
		zu: true,
	};
};

/** Ein geschlossener Zug aus geraden Linien. */
export const vieleckZug = (punkte: readonly Punkt[]): Zug => {
	const [erster, ...rest] = punkte;
	return { start: erster ?? { x: 0, y: 0 }, segmente: rest.map((p) => ({ art: 'L', p })), zu: true };
};

/** Punkt auf dem Einheitskreis, 0° oben, im Uhrzeigersinn. */
export const aufKreis = (grad: number, r = 1): Punkt => {
	const w = ((grad - 90) * Math.PI) / 180;
	return { x: Math.cos(w) * r, y: Math.sin(w) * r };
};

/** Der Strich liegt innen (03-modell): die Geometrie um die halbe Strichstärke eingerückt. */
export const innen = (b: number, h: number, strich: number): Kasten => {
	const s = Math.max(0, Math.min(strich, b, h));
	return { x: s / 2, y: s / 2, b: Math.max(0, b - s), h: Math.max(0, h - s) };
};
