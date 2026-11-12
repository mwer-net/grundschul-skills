import { DRUCKRAND, GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';
// >> 181
import { SEITEN_TEIL_SELEKTOR } from '@schoolbox/kern/src/seitengestaltung';
// << 181

import { VORSCHAU } from './ablegen/vorschau';
import type { Kasten } from './geste';
import { MIN_GROESSE, punktImBehaelter } from './geste';

/**
 * Einrasten beim Ziehen, Skalieren und Ablegen (100, Briefing 5.5). `sammleKandidaten` misst **einmal** je Geste die
 * Rechtecke der Seite, `rasteEin` rechnet danach bei jeder Bewegung nur mit Zahlen (4.12). Alle Werte in Koordinaten
 * des Behälters (wie `--x`/`--y`), die Fangweite in Bildschirm-px über `skala`.
 */

/** Woran ein Rechteck fängt: alle drei Linien je Achse, nur die Kanten oder nur die Mitte. */
export type Fang = 'alles' | 'kanten' | 'mitte';

/** Ein Rechteck, an dessen Kanten und Mitte eingerastet werden kann. */
export interface Kandidat {
	links: number;
	oben: number;
	rechts: number;
	unten: number;
	/** Ohne Angabe `alles`. */
	fang?: Fang;
}

/** Eine Hilfslinie von (x1, y1) nach (x2, y2). */
export interface Hilfslinie {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Eingerastet {
	lage: Kasten;
	linien: Hilfslinie[];
}

/** Fangweite in Bildschirm-px, unabhängig vom Zoom. */
export const FANGWEITE = 6;

type Seite = -1 | 0 | 1;

export interface RastOptionen {
	/** ⌘ während der Geste: nichts rastet ein. */
	aus?: boolean;
	/** Beim Skalieren: welche Kanten der Griff bewegt (−1 links bzw. oben, 1 rechts bzw. unten, 0 keine). */
	griff?: { x: Seite; y: Seite };
	/** Ecke mit festem Seitenverhältnis: nur eine Achse rastet, die andere folgt. */
	verhaeltnis?: boolean;
	/** ⌥ beim Skalieren: beide Seiten wachsen um die Mitte. */
	mitte?: boolean;
}

interface Rechteck {
	links: number;
	oben: number;
	rechts: number;
	unten: number;
}

type Achse = 'x' | 'y';

/** Das umschließende Rechteck, bei gedrehtem Kasten über seine vier Ecken. */
export const umschliessend = (k: Kasten): Rechteck => {
	if (!k.drehen) {
		return { links: k.x, oben: k.y, rechts: k.x + k.b, unten: k.y + k.h };
	}
	const ecken = [
		punktImBehaelter(k, 0, 0),
		punktImBehaelter(k, k.b, 0),
		punktImBehaelter(k, k.b, k.h),
		punktImBehaelter(k, 0, k.h),
	];
	return {
		links: Math.min(...ecken.map((p) => p.x)),
		oben: Math.min(...ecken.map((p) => p.y)),
		rechts: Math.max(...ecken.map((p) => p.x)),
		unten: Math.max(...ecken.map((p) => p.y)),
	};
};

const anfang = (r: Rechteck, a: Achse) => (a === 'x' ? r.links : r.oben);
const ende = (r: Rechteck, a: Achse) => (a === 'x' ? r.rechts : r.unten);

/** Die Linien eines Kandidaten auf einer Achse. */
const linienVon = (k: Kandidat, a: Achse) => {
	const von = anfang(k, a);
	const bis = ende(k, a);
	const fang = k.fang ?? 'alles';
	if (fang === 'mitte') {
		return [(von + bis) / 2];
	}
	return fang === 'kanten' ? [von, bis] : [von, (von + bis) / 2, bis];
};

/** Die kleinste Verschiebung, mit der einer der `werte` auf eine Linie fällt; `null`, wenn keine nah genug ist. */
const naechste = (werte: readonly number[], kandidaten: readonly Kandidat[], a: Achse, weite: number) => {
	let beste: number | null = null;
	for (const k of kandidaten) {
		for (const linie of linienVon(k, a)) {
			for (const w of werte) {
				const d = linie - w;
				if (Math.abs(d) <= weite && (beste === null || Math.abs(d) < Math.abs(beste))) {
					beste = d;
				}
			}
		}
	}
	return beste;
};

/** Gilt als dieselbe Linie (Rundung beim Messen). */
const GLEICH = 0.5;

/**
 * Hilfslinien für alle Linien der Kandidaten, auf denen jetzt ein Wert des Elements liegt. Eine Linie reicht über das
 * Element und den Kandidaten; mehrere Kandidaten auf derselben Linie ergeben eine lange Linie.
 */
const linienAuf = (r: Rechteck, werte: readonly number[], kandidaten: readonly Kandidat[], a: Achse): Hilfslinie[] => {
	const quer: Achse = a === 'x' ? 'y' : 'x';
	const gefunden = new Map<number, { von: number; bis: number }>();
	for (const k of kandidaten) {
		for (const linie of linienVon(k, a)) {
			if (!werte.some((w) => Math.abs(w - linie) < GLEICH)) {
				continue;
			}
			const schluessel = Math.round(linie * 2) / 2;
			const alt = gefunden.get(schluessel);
			const von = Math.min(anfang(r, quer), anfang(k, quer), alt?.von ?? Infinity);
			const bis = Math.max(ende(r, quer), ende(k, quer), alt?.bis ?? -Infinity);
			gefunden.set(schluessel, { von, bis });
		}
	}
	return [...gefunden].map(([wo, { bis, von }]) =>
		a === 'x' ? { x1: wo, y1: von, x2: wo, y2: bis } : { x1: von, y1: wo, x2: bis, y2: wo },
	);
};

const dreiLinien = (r: Rechteck, a: Achse) => [anfang(r, a), (anfang(r, a) + ende(r, a)) / 2, ende(r, a)];

/** Ziehen: linke, mittlere und rechte bzw. obere, mittlere und untere Linie des umschließenden Rechtecks. */
const rasteBeimBewegen = (lage: Kasten, kandidaten: readonly Kandidat[], weite: number): Eingerastet => {
	const roh = umschliessend(lage);
	const dx = naechste(dreiLinien(roh, 'x'), kandidaten, 'x', weite) ?? 0;
	const dy = naechste(dreiLinien(roh, 'y'), kandidaten, 'y', weite) ?? 0;
	const neu = { ...lage, x: lage.x + dx, y: lage.y + dy };
	const r = umschliessend(neu);
	return {
		lage: neu,
		linien: [
			...linienAuf(r, dreiLinien(r, 'x'), kandidaten, 'x'),
			...linienAuf(r, dreiLinien(r, 'y'), kandidaten, 'y'),
		],
	};
};

/** Verschiebt die bewegte Kante einer Achse um `d`; mit `mitte` wächst die Gegenseite mit. */
const zieheKante = (lage: Kasten, a: Achse, s: Seite, d: number, mitte: boolean): Kasten => {
	const [pos, groesse] = a === 'x' ? (['x', 'b'] as const) : (['y', 'h'] as const);
	const faktor = mitte ? 2 : 1;
	if (s > 0) {
		return { ...lage, [groesse]: lage[groesse] + d * faktor, [pos]: lage[pos] - (mitte ? d : 0) };
	}
	return { ...lage, [pos]: lage[pos] + d, [groesse]: lage[groesse] - d * faktor };
};

/** Die andere Achse folgt dem Verhältnis; fest bleibt die Gegenkante bzw. mit `mitte` die Mitte. */
const folgeVerhaeltnis = (alt: Kasten, neu: Kasten, a: Achse, s: Seite, mitte: boolean): Kasten => {
	const [groesse, andereGroesse, andererPos] = a === 'x' ? (['b', 'h', 'y'] as const) : (['h', 'b', 'x'] as const);
	const f = alt[groesse] > 0 ? neu[groesse] / alt[groesse] : 1;
	const wert = alt[andereGroesse] * f;
	const aenderung = wert - alt[andereGroesse];
	let pos = alt[andererPos];
	if (mitte) {
		pos -= aenderung / 2;
	} else if (s < 0) {
		pos -= aenderung;
	}
	return { ...neu, [andereGroesse]: wert, [andererPos]: pos };
};

/** Skalieren: nur die Kanten, die der Griff bewegt. Gedrehte Kästen rasten beim Skalieren nicht. */
const rasteBeimSkalieren = (
	lage: Kasten,
	kandidaten: readonly Kandidat[],
	weite: number,
	{ griff = { x: 0, y: 0 }, mitte = false, verhaeltnis = false }: RastOptionen,
): Eingerastet => {
	if (lage.drehen) {
		return { lage, linien: [] };
	}
	const roh = umschliessend(lage);
	const kante = (a: Achse, s: Seite) => (s > 0 ? ende(roh, a) : anfang(roh, a));
	const treffer = (['x', 'y'] as const).flatMap((a) => {
		const s = griff[a];
		const d = s === 0 ? null : naechste([kante(a, s)], kandidaten, a, weite);
		return d === null ? [] : [{ a, s, d }];
	});
	// Bei festem Verhältnis zählt nur die Achse mit dem kürzeren Weg; die andere folgt.
	const genommen = verhaeltnis ? treffer.sort((p, q) => Math.abs(p.d) - Math.abs(q.d)).slice(0, 1) : treffer;
	let neu = lage;
	for (const { a, d, s } of genommen) {
		neu = zieheKante(neu, a, s, d, mitte);
		if (verhaeltnis) {
			const andere: Achse = a === 'x' ? 'y' : 'x';
			neu = folgeVerhaeltnis(lage, neu, a, griff[andere] === 0 ? 1 : griff[andere], mitte);
		}
	}
	if (neu.b < MIN_GROESSE || neu.h < MIN_GROESSE) {
		return { lage, linien: [] };
	}
	const r = umschliessend(neu);
	const bewegt = (a: Achse) => {
		const s = griff[a];
		if (s === 0) {
			return [];
		}
		return mitte ? [anfang(r, a), ende(r, a)] : [s > 0 ? ende(r, a) : anfang(r, a)];
	};
	return {
		lage: neu,
		linien: [...linienAuf(r, bewegt('x'), kandidaten, 'x'), ...linienAuf(r, bewegt('y'), kandidaten, 'y')],
	};
};

/**
 * Rastet die Lage ein. Ohne `griff` wird bewegt, mit `griff` skaliert. Fangweite `FANGWEITE / skala` im Material.
 * Rechnet nur mit Zahlen, kein DOM.
 */
export const rasteEin = (
	lage: Kasten,
	kandidaten: readonly Kandidat[],
	skala: number,
	optionen: RastOptionen = {},
): Eingerastet => {
	if (optionen.aus || kandidaten.length === 0) {
		return { lage, linien: [] };
	}
	const weite = FANGWEITE / Math.max(0.01, skala);
	if (optionen.griff) {
		return rasteBeimSkalieren(lage, kandidaten, weite, optionen);
	}
	return rasteBeimBewegen(lage, kandidaten, weite);
};

// ── Messen (DOM) ─────────────────────────────────────────────────────────────

const zahl = (wert: string) => {
	const n = parseFloat(wert);
	return Number.isFinite(n) ? n : 0;
};

/** Ecke der Fläche, in der `--x`/`--y` des Behälters gelten (Innenkante), in Koordinaten des Materials. */
export const eckeDes = (behaelter: Element) => {
	const r = behaelter.getBoundingClientRect();
	return { x: r.left + behaelter.clientLeft, y: r.top + behaelter.clientTop };
};

// >> 181
/** Kein Kandidat: Seitenfläche, -rahmen und Kopfband gehören der Seite, die Vorschau beim Ablegen ist das Element. */
const UEBERGEHEN = `${SEITEN_TEIL_SELEKTOR}, [${VORSCHAU}], [${VORSCHAU}] *`;
// << 181

/**
 * Die Kandidaten einer Seite, verschoben auf `ursprung` (Ecke des Behälters im Material): Seitenmitte, Druckrand,
 * Innenrand (`--rand`, als Polsterung der Seite), andere Gestaltungselemente der Seite und die Bausteine im Hauptstapel
 * (nur die direkten Kinder der Seite). `ausser` und alles darin oder darum zählt nicht.
 */
export const kandidatenAufSeite = (
	seite: Element,
	ursprung: { x: number; y: number },
	ausser: Element | null = null,
): Kandidat[] => {
	const fenster = seite.ownerDocument.defaultView;
	if (!fenster) {
		return [];
	}
	const relativ = (r: DOMRect, fang: Fang): Kandidat => ({
		links: r.left - ursprung.x,
		oben: r.top - ursprung.y,
		rechts: r.right - ursprung.x,
		unten: r.bottom - ursprung.y,
		fang,
	});
	const seitenRechteck = relativ(seite.getBoundingClientRect(), 'mitte');
	const nach = (l: number, o: number, r: number, u: number): Kandidat => ({
		links: seitenRechteck.links + l,
		oben: seitenRechteck.oben + o,
		rechts: seitenRechteck.rechts - r,
		unten: seitenRechteck.unten - u,
		fang: 'kanten',
	});
	const stil = fenster.getComputedStyle(seite);
	const liste: Kandidat[] = [
		seitenRechteck,
		nach(DRUCKRAND, DRUCKRAND, DRUCKRAND, DRUCKRAND),
		nach(
			zahl(stil.borderLeftWidth) + zahl(stil.paddingLeft),
			zahl(stil.borderTopWidth) + zahl(stil.paddingTop),
			zahl(stil.borderRightWidth) + zahl(stil.paddingRight),
			zahl(stil.borderBottomWidth) + zahl(stil.paddingBottom),
		),
	];
	const zaehlt = (e: Element) =>
		!e.matches(UEBERGEHEN) && !(ausser && (e === ausser || ausser.contains(e) || e.contains(ausser)));
	const mitRechteck = (e: Element, fang: Fang) => {
		const r = e.getBoundingClientRect();
		// Ausgeblendetes (`display: none`) hat kein Rechteck.
		return r.width > 0 || r.height > 0 ? [relativ(r, fang)] : [];
	};
	for (const e of seite.querySelectorAll(GESTALTUNG_SELEKTOR)) {
		if (zaehlt(e) && e.closest('.seite') === seite) {
			liste.push(...mitRechteck(e, 'alles'));
		}
	}
	for (const e of seite.children) {
		if (!e.matches('.ebene') && !e.matches(GESTALTUNG_SELEKTOR) && zaehlt(e)) {
			liste.push(...mitRechteck(e, 'kanten'));
		}
	}
	return liste;
};

/** Was für ein Element in Frage kommt, in Koordinaten seines Behälters. Einmal je Geste. */
export const sammleKandidaten = (element: Element, behaelter: Element): Kandidat[] => {
	const seite = element.closest('.seite');
	return seite ? kandidatenAufSeite(seite, eckeDes(behaelter), element) : [];
};
