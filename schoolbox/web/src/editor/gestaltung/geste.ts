/**
 * Rechnen für die Gesten an Gestaltungselementen (097), ohne DOM. Ein `Kasten` ist die Lage vor dem Drehen in
 * Koordinaten des Behälters (Briefing 3.3): `x`/`y` die linke obere Ecke **vor** dem Drehen, gedreht wird um die Mitte.
 * Verschiebungen `dx`/`dy` kommen in Koordinaten des Behälters, also so, wie der Zeiger sich auf dem Blatt bewegt.
 */

export interface Kasten {
	x: number;
	y: number;
	b: number;
	h: number;
	/** Grad, im Uhrzeigersinn. */
	drehen: number;
}

/** Griffe am Rahmen: Ecken und Kantenmitten. `x`/`y` sagen, an welcher Seite der Griff zieht (−1, 0, 1). */
export const GRIFFE = {
	'oben-links': { x: -1, y: -1 },
	'oben': { x: 0, y: -1 },
	'oben-rechts': { x: 1, y: -1 },
	'rechts': { x: 1, y: 0 },
	'unten-rechts': { x: 1, y: 1 },
	'unten': { x: 0, y: 1 },
	'unten-links': { x: -1, y: 1 },
	'links': { x: -1, y: 0 },
} as const;

export type GriffName = keyof typeof GRIFFE;

export const ECKEN: readonly GriffName[] = ['oben-links', 'oben-rechts', 'unten-rechts', 'unten-links'];
export const KANTEN: readonly GriffName[] = ['oben', 'rechts', 'unten', 'links'];

export const istEcke = (griff: GriffName) => GRIFFE[griff].x !== 0 && GRIFFE[griff].y !== 0;

/** Kleiner wird nichts: Sonst verschwindet das Element unter seinen Griffen. */
export const MIN_GROESSE = 8;

const bogen = (grad: number) => (grad * Math.PI) / 180;

/** Dreht einen Vektor um `grad`. */
const dreheVektor = (x: number, y: number, grad: number) => {
	const w = bogen(grad);
	const c = Math.cos(w);
	const s = Math.sin(w);
	return { x: x * c - y * s, y: x * s + y * c };
};

/** Mitte des Kastens im Behälter. */
export const mitteVon = (k: Kasten) => ({ x: k.x + k.b / 2, y: k.y + k.h / 2 });

/** Ein Punkt des Kastens (in Koordinaten vor dem Drehen, vom linken oberen Eck) im Behälter, also nach dem Drehen. */
export const punktImBehaelter = (k: Kasten, px: number, py: number) => {
	const m = mitteVon(k);
	const v = dreheVektor(px - k.b / 2, py - k.h / 2, k.drehen);
	return { x: m.x + v.x, y: m.y + v.y };
};

/** Eine Verschiebung im Behälter in die Richtungen des gedrehten Kastens. */
export const inKasten = (k: Kasten, dx: number, dy: number) => dreheVektor(dx, dy, -k.drehen);

/** Ziehen: ⇧ sperrt auf die Achse mit dem größeren Weg. */
export const bewege = (k: Kasten, dx: number, dy: number, { achse = false } = {}): Kasten => {
	if (achse) {
		if (Math.abs(dx) >= Math.abs(dy)) {
			return { ...k, x: k.x + dx };
		}
		return { ...k, y: k.y + dy };
	}
	return { ...k, x: k.x + dx, y: k.y + dy };
};

interface SkalierOptionen {
	/** Seitenverhältnis halten (an Ecken). */
	verhaeltnis?: boolean;
	/** ⌥: von der Mitte aus, beide Seiten wachsen. */
	mitte?: boolean;
	min?: number;
}

/**
 * Größe am Griff. Ohne `mitte` bleibt die gegenüberliegende Ecke bzw. Kante **im Blatt** stehen, auch bei gedrehtem
 * Kasten; mit `mitte` die Mitte.
 */
export const skaliere = (
	k: Kasten,
	griff: GriffName,
	dx: number,
	dy: number,
	{ min = MIN_GROESSE, mitte = false, verhaeltnis = false }: SkalierOptionen = {},
): Kasten => {
	const { x: sx, y: sy } = GRIFFE[griff];
	const lokal = inKasten(k, dx, dy);
	const faktor = mitte ? 2 : 1;
	let b = sx === 0 ? k.b : k.b + sx * lokal.x * faktor;
	let h = sy === 0 ? k.h : k.h + sy * lokal.y * faktor;
	if (verhaeltnis && sx !== 0 && sy !== 0 && k.b > 0 && k.h > 0) {
		const fb = b / k.b;
		const fh = h / k.h;
		let f = Math.abs(fb - 1) >= Math.abs(fh - 1) ? fb : fh;
		f = Math.max(f, min / k.b, min / k.h);
		b = k.b * f;
		h = k.h * f;
	} else {
		b = Math.max(min, b);
		h = Math.max(min, h);
	}
	// Die Mitte wandert um die halbe Änderung zur gezogenen Seite, gedreht wie der Kasten.
	const verschiebung = mitte ? { x: 0, y: 0 } : dreheVektor((sx * (b - k.b)) / 2, (sy * (h - k.h)) / 2, k.drehen);
	const m = mitteVon(k);
	return { ...k, b, h, x: m.x + verschiebung.x - b / 2, y: m.y + verschiebung.y - h / 2 };
};

/** Auf eine Nachkommastelle, zwischen −180 und 180. */
export const normiereWinkel = (grad: number) => {
	let w = ((((grad + 180) % 360) + 360) % 360) - 180;
	w = Math.round(w * 10) / 10;
	return Object.is(w, -0) ? 0 : w;
};

/** Drehen auf einen Winkel; ⇧ rastet in 15°-Schritten. */
export const drehe = (k: Kasten, winkel: number, { raster15 = false } = {}): Kasten => ({
	...k,
	drehen: normiereWinkel(raster15 ? Math.round(winkel / 15) * 15 : winkel),
});

/** Richtung vom Mittelpunkt zum Zeiger: 0° zeigt nach oben (dort sitzt der Drehgriff), im Uhrzeigersinn. */
export const winkelZu = (mitte: { x: number; y: number }, zeiger: { x: number; y: number }) =>
	(Math.atan2(zeiger.y - mitte.y, zeiger.x - mitte.x) * 180) / Math.PI + 90;

/** Was am Zeiger steht: „240 × 96“, „−12°“, „X 238 · Y 708“. */
export const wertText = (art: 'bewegen' | 'skalieren' | 'drehen', k: Kasten) => {
	if (art === 'drehen') {
		return `${String(Math.round(k.drehen)).replace('-', '−')}°`;
	}
	if (art === 'skalieren') {
		return `${Math.round(k.b)} × ${Math.round(k.h)}`;
	}
	return `X ${Math.round(k.x)} · Y ${Math.round(k.y)}`;
};

/** Wie die Griffe die Größe ändern; dieselben Werte wie `Groesse` in `kern/src/gestaltung-arten.ts`. */
export type GroessenArt = 'proportional' | 'frei' | 'text' | 'breite';

/**
 * Welche Griffe eine Art hat (Briefing 5.4): Ecken bei allem außer `breite`, Kanten bei `frei`; bei `text` nur links und
 * rechts (die Breite des Textes), bei `breite` nur diese beiden.
 */
export const griffeFuer = (art: GroessenArt): readonly GriffName[] => {
	if (art === 'breite') {
		return ['links', 'rechts'];
	}
	if (art === 'text') {
		return [...ECKEN, 'links', 'rechts'];
	}
	if (art === 'frei') {
		return [...ECKEN, ...KANTEN];
	}
	return ECKEN;
};

/** Ecken halten das Verhältnis bei `proportional` und `text`; ⇧ kehrt das um (bei `text` bleibt es). */
export const haeltVerhaeltnis = (art: GroessenArt, griff: GriffName, umschalt: boolean) => {
	if (!istEcke(griff)) {
		return false;
	}
	if (art === 'text') {
		return true;
	}
	return (art === 'proportional') !== umschalt;
};

// ── Mehrfachauswahl (113) ───────────────────────────────────────────────────

/**
 * Dreht einen Kasten um einen gemeinsamen Punkt `um` (die Mitte der Auswahl): Seine Mitte wandert auf dem Kreis, seine
 * eigene Drehung wächst um denselben Winkel. Alles in denselben Koordinaten (Material).
 */
export const dreheUm = (k: Kasten, um: { x: number; y: number }, grad: number): Kasten => {
	const m = mitteVon(k);
	const v = dreheVektor(m.x - um.x, m.y - um.y, grad);
	return { ...k, x: um.x + v.x - k.b / 2, y: um.y + v.y - k.h / 2, drehen: normiereWinkel(k.drehen + grad) };
};

/**
 * Größe mit der Auswahl: `von` und `nach` sind der umschließende Kasten der Auswahl vorher und nachher (gleiches
 * Verhältnis). Jedes Element wächst um denselben Faktor, seine Mitte bleibt an derselben Stelle relativ zur Auswahl.
 */
export const skaliereMit = (k: Kasten, von: Kasten, nach: Kasten): Kasten => {
	const nachHoehe = von.h > 0 ? nach.h / von.h : 1;
	const f = von.b > 0 ? nach.b / von.b : nachHoehe;
	const m = mitteVon(k);
	const b = Math.max(1, k.b * f);
	const h = Math.max(1, k.h * f);
	const mx = nach.x + (m.x - von.x) * f;
	const my = nach.y + (m.y - von.y) * f;
	return { ...k, b, h, x: mx - b / 2, y: my - h / 2 };
};
