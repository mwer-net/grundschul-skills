/**
 * Masken aus Formen (111, Briefing schubladen/3-formen.md „Bildrahmen“): Eine Form ohne Text schneidet ein Bild zu. Der
 * Kern rechnet den `clip-path` aus der Form: Ellipse als `ellipse()`, Rechteck als `inset()`, alles andere als
 * `polygon()` mit 64 Punkten **in Prozent**. Prozent heißt: Eine Größenänderung braucht keine neue Berechnung, ein Stern
 * in einem breiten Rahmen wird breit (gewollt). `path()` kommt nie vor (Safari, Allow-Liste).
 *
 * Abgetastet wird der Pfad aus `zeichne`. Er besteht nur aus `M`, `L`, `C`, `Q`, `Z` (`zuegeAus` in
 * `formen-geometrie.ts`). Diese Datei hängt nur an `formen.ts` und `formen-geometrie.ts`, damit der Browser sie ohne
 * `gestaltung.ts` laden kann.
 */

import type { Form, FormWerte } from './formen';
import { FORMEN, formVon, vollstaendig } from './formen';
import type { Punkt, Segment } from './formen-geometrie';
import { zahl, zuegeAus } from './formen-geometrie';

/** So viele Punkte hat ein `polygon()` der Maske. */
export const MASKEN_PUNKTE = 64;

/** Feinheit der Längentabelle je Kurve; genug für weit unter 0,5 px Fehler bei Formen bis 1000 px. */
const STUFEN = 48;

const linear = (a: Punkt, b: Punkt, t: number): Punkt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Der Punkt bei `t` (0–1) auf dem Segment, das bei `von` beginnt: genau auf der Kurve. */
const punktAuf = (von: Punkt, s: Segment, t: number): Punkt => {
	if (s.art === 'L') {
		return linear(von, s.p, t);
	}
	const u = 1 - t;
	if (s.art === 'Q') {
		return {
			x: u * u * von.x + 2 * u * t * s.c.x + t * t * s.p.x,
			y: u * u * von.y + 2 * u * t * s.c.y + t * t * s.p.y,
		};
	}
	return {
		x: u * u * u * von.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p.x,
		y: u * u * u * von.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p.y,
	};
};

interface Stueck {
	von: Punkt;
	s: Segment;
	/** Länge bis `t = i / Stufen` (für `L` nur Anfang und Ende). */
	bis: number[];
	laenge: number;
}

const stueck = (von: Punkt, s: Segment): Stueck => {
	const stufen = s.art === 'L' ? 1 : STUFEN;
	const bis = [0];
	let vorher = von;
	let summe = 0;
	for (let i = 1; i <= stufen; i += 1) {
		const p = punktAuf(von, s, i / stufen);
		summe += Math.hypot(p.x - vorher.x, p.y - vorher.y);
		bis.push(summe);
		vorher = p;
	}
	return { von, s, bis, laenge: summe };
};

/** Der Punkt nach dem Anteil `f` (0–1) der Länge des Stücks, über die Tabelle auf `t` gebracht. */
const nachLaenge = (st: Stueck, f: number): Punkt => {
	const ziel = f * st.laenge;
	const stufen = st.bis.length - 1;
	let i = 0;
	while (i < stufen - 1 && (st.bis[i + 1] ?? 0) < ziel) {
		i += 1;
	}
	const a = st.bis[i] ?? 0;
	const b = st.bis[i + 1] ?? a;
	const t = (i + (b > a ? (ziel - a) / (b - a) : 0)) / stufen;
	return punktAuf(st.von, st.s, Math.min(1, Math.max(0, t)));
};

/** Wie viele Punkte jedes Stück bekommt: nach seiner Länge, mindestens einen (die Ecke), zusammen genau `n`. */
const verteile = (laengen: readonly number[], n: number) => {
	const summe = laengen.reduce((a, b) => a + b, 0) || 1;
	const roh = laengen.map((l) => (l / summe) * n);
	const anzahl = roh.map((r) => Math.max(1, Math.floor(r)));
	let rest = n - anzahl.reduce((a, b) => a + b, 0);
	const nachRest = roh.map((r, i) => ({ i, r: r - Math.floor(r) })).sort((a, b) => b.r - a.r);
	for (let k = 0; rest > 0 && nachRest.length > 0; k = (k + 1) % nachRest.length) {
		const i = nachRest[k]?.i ?? 0;
		anzahl[i] = (anzahl[i] ?? 0) + 1;
		rest -= 1;
	}
	// Zu viele, weil jedes Stück seine Ecke behält: beim Stück mit den meisten Punkten wegnehmen.
	while (rest < 0) {
		let gross = 0;
		for (let i = 1; i < anzahl.length; i += 1) {
			if ((anzahl[i] ?? 0) > (anzahl[gross] ?? 0)) {
				gross = i;
			}
		}
		if ((anzahl[gross] ?? 0) <= 1) {
			break;
		}
		anzahl[gross] = (anzahl[gross] ?? 0) - 1;
		rest += 1;
	}
	return anzahl;
};

/**
 * `n` Punkte auf dem Umriss des Pfads `d`, gleichmäßig nach Bogenlänge. Jedes Segment beginnt mit seinem Anfangspunkt,
 * damit Ecken (Sternspitzen) nicht abgeschnitten werden; dazwischen liegen die Punkte gleichmäßig. Ein offener Zug
 * wird geschlossen. Leer, wenn sich `d` nicht lesen lässt.
 */
export const tastePfadAb = (d: string, n: number = MASKEN_PUNKTE): Punkt[] => {
	const zuege = zuegeAus(d);
	if (!zuege || n < 1) {
		return [];
	}
	const stuecke: Stueck[] = [];
	for (const z of zuege) {
		let von = z.start;
		for (const s of z.segmente) {
			stuecke.push(stueck(von, s));
			von = s.p;
		}
		if (Math.hypot(von.x - z.start.x, von.y - z.start.y) > 1e-9) {
			stuecke.push(stueck(von, { art: 'L', p: z.start }));
		}
	}
	const mitLaenge = stuecke.filter((s) => s.laenge > 1e-9);
	if (mitLaenge.length === 0) {
		return [];
	}
	const anzahl = verteile(
		mitLaenge.map((s) => s.laenge),
		n,
	);
	const punkte: Punkt[] = [];
	mitLaenge.forEach((s, i) => {
		const k = anzahl[i] ?? 0;
		for (let j = 0; j < k; j += 1) {
			punkte.push(nachLaenge(s, j / k));
		}
	});
	return punkte.slice(0, n);
};

const prozent = (wert: number, ganz: number) => `${zahl((wert / ganz) * 100)}%`;

/** Die Formen, die eine Maske sein können: alle ohne Text, in der Reihenfolge der Liste. */
export const MASKEN_FORMEN: readonly Form[] = Object.values(FORMEN).filter((f) => f.klasse === 'ohne-text');

export const istMaskenForm = (art: string | null | undefined) => formVon(art)?.klasse === 'ohne-text';

/**
 * Der `clip-path` für die Form `art` in der Größe `b` × `h` (px): `null` für unbekannte Formen, Formen mit Text und
 * Linien. Ellipse `ellipse(50% 50% at 50% 50%)`, Rechteck `inset(0)` bzw. `inset(0 round Rpx)`, sonst `polygon()` in
 * Prozent.
 */
export const maskeFuer = (art: string, param: FormWerte, b: number, h: number): string | null => {
	const form = formVon(art);
	if (!form || form.klasse !== 'ohne-text') {
		return null;
	}
	const breite = Math.max(1, b);
	const hoehe = Math.max(1, h);
	const werte = vollstaendig(form, (a) => param[a]);
	if (art === 'ellipse') {
		return 'ellipse(50% 50% at 50% 50%)';
	}
	if (art === 'rechteck') {
		const r = Math.max(0, Math.min(werte['data-radius'] ?? 0, breite / 2, hoehe / 2));
		return r > 0 ? `inset(0 round ${zahl(r)}px)` : 'inset(0)';
	}
	const punkte = tastePfadAb(form.zeichne(werte, breite, hoehe, 0).d);
	if (punkte.length < 3) {
		return null;
	}
	return `polygon(${punkte.map((p) => `${prozent(p.x, breite)} ${prozent(p.y, hoehe)}`).join(', ')})`;
};

/** Unter dem Namen aus der Andockstelle von 104 („Familien der Formen“). */
export const maskeAusForm = maskeFuer;
