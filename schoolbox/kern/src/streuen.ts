/**
 * Streuung: Konfetti, Punkte, Sterne (Phase 12, 109; Briefing schubladen/3-formen.md, 03-modell.md). Eine Streuung ist
 * **ein** `svg.streuung` mit vielen erzeugten Teilen. Die Parameter sind die Quelle (`data-streuung`, `data-saat`,
 * `data-dichte`, `data-formen`, `data-farben`, `data-groesse`, bei Punkten `data-ecke`, auf Wunsch `data-zonen`), die
 * Kinder sind erzeugt und statisch gespeichert, damit Druck und Claude sie ohne Skript sehen. Gleiche Saat und gleiche
 * Parameter ergeben immer dieselben Teile: `zufall` ist ein eigener Generator (mulberry32), nie `Math.random`.
 *
 * Diese Datei hängt nur an `quelltext.ts` und `formen.ts`, damit `groessen-folgen.ts` (von `gestaltung.ts` gerufen) sie
 * ohne Ladekreis nutzen kann. Was `gestaltung.ts` braucht (`legeStreuung`), steht in `streuen-aendern.ts`.
 */

import { groesseAus, setzeAttributAn, stilMit, stilWert } from './formen';
import { zahl } from './formen-geometrie';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { attribut, innenVon, klassenVon, wendeAn, zerlege } from './quelltext';

// ── Werte ───────────────────────────────────────────────────────────────────

export const STREU_ARTEN = ['punkte', 'konfetti', 'sterne'] as const;
export type StreuArt = (typeof STREU_ARTEN)[number];

export const STREU_FORMEN = ['punkt', 'dreieck', 'raute', 'stern', 'streifen'] as const;
export type StreuForm = (typeof STREU_FORMEN)[number];

/** Die Namen, die `data-farben` kennt; jeder wird `var(--name)`. `a1` bis `a4` sind die Farben der Rezepte. */
export const STREU_FARBEN = ['haupt', 'akzent', 'dunkel', 'linie', 'fuell', 'a1', 'a2', 'a3', 'a4'] as const;

export const STREU_GROESSEN = ['klein', 'mittel', 'gross'] as const;
export type StreuGroesse = (typeof STREU_GROESSEN)[number];

/** Die Ecken, zu denen hin Punkte dichter stehen: oben/unten (o, u) und links/rechts (l, r). */
export const STREU_ECKEN = ['ol', 'or', 'ul', 'ur'] as const;
export type Ecke = (typeof STREU_ECKEN)[number];

export const STREU_NAMEN: Readonly<Record<StreuArt, string>> = {
	punkte: 'Punkte',
	konfetti: 'Konfetti',
	sterne: 'Sterne',
};

export const FORM_NAMEN: Readonly<Record<StreuForm, string>> = {
	punkt: 'Punkt',
	dreieck: 'Dreieck',
	raute: 'Raute',
	stern: 'Stern',
	streifen: 'Streifen',
};

/** Höchstens so viele Teile je Streuung (4.12). Mehr Dichte heißt dann größere Teile. */
export const MAX_TEILE = 200;

export const STANDARD_FORMEN: Readonly<Record<StreuArt, readonly StreuForm[]>> = {
	punkte: ['punkt'],
	konfetti: ['punkt', 'dreieck', 'raute', 'streifen'],
	sterne: ['stern'],
};
export const STANDARD_FARBEN: readonly string[] = ['haupt', 'akzent', 'dunkel'];
export const STANDARD_DICHTE = 0.5;
export const STANDARD_GROESSE: StreuGroesse = 'mittel';
export const STANDARD_ECKE: Ecke = 'ul';
/** Größe beim Anlegen (Ticket 109). */
export const STANDARD_MASS = { b: 300, h: 300 } as const;

/** Umkreis-Radius eines mittleren Teils in px, je Größe. */
const RADIUS: Readonly<Record<StreuGroesse, number>> = { klein: 5, mittel: 8, gross: 13 };
/** Wie weit Teile bei Dichte 1 im Mittel auseinander stehen, als Vielfaches des Radius. */
const ABSTAND_FAKTOR = 3.2;
/** Größte Vergrößerung, wenn die Fläche mehr Teile bräuchte als erlaubt. */
const MAX_VERGROESSERUNG = 3;
/** Sicherheitsrand zum Rand der Fläche (Rundung der Zahlen auf eine Stelle). */
const RAND = 0.2;
/** Mindestabstand zweier Teile als Vielfaches der Summe ihrer Radien. */
const LUFT = 1.05;
/** Wie viele Rasterpunkte es je gewolltem Punkt gibt: Zur Ecke hin bleiben mehr stehen als in der Ferne. */
const RASTER_UEBERSCHUSS = 1.8;

export interface Zone {
	x: number;
	y: number;
	b: number;
	h: number;
}

export interface Teil {
	form: StreuForm;
	/** Mitte des Teils in px des Elements. */
	x: number;
	y: number;
	/** Radius des Umkreises: Das Teil liegt immer ganz in diesem Kreis, auch gedreht. */
	r: number;
	/** Grad. */
	drehen: number;
	/** Ein Name aus `STREU_FARBEN`. */
	farbe: string;
}

export interface StreuParameter {
	art: StreuArt;
	saat: number;
	/** 0–1. */
	dichte: number;
	formen: readonly StreuForm[];
	farben: readonly string[];
	groesse: StreuGroesse;
	/** Breite und Höhe des Elements in px. */
	b: number;
	h: number;
	/** Nur bei Punkten: zu dieser Ecke hin stehen sie dichter. */
	ecke?: Ecke;
	/** Rechtecke in px des Elements; Teile entstehen nur darin. Ohne Angabe die ganze Fläche. */
	zonen?: readonly Zone[];
}

// ── Zufall ──────────────────────────────────────────────────────────────────

/** Eine Saat ist eine ganze Zahl von 1 bis 999999; alles andere wird dorthin gebracht. */
export const saatAus = (roh: number) => {
	const n = Math.abs(Math.trunc(Number.isFinite(roh) ? roh : 1)) % 1_000_000;
	return n === 0 ? 1 : n;
};

/** mulberry32: eine Folge von Zahlen in [0, 1), bestimmt allein durch die Saat. */
export const zufall = (saat: number) => {
	let a = Math.trunc(saat) >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const runde = (n: number) => Math.round(n * 10) / 10;

// ── Streuen ─────────────────────────────────────────────────────────────────

/** Die Zonen auf die Fläche gekürzt; ohne Zonen die ganze Fläche. */
const bereiche = (b: number, h: number, zonen: readonly Zone[] | undefined): Zone[] => {
	if (!zonen || zonen.length === 0) {
		return [{ x: 0, y: 0, b, h }];
	}
	return zonen
		.map((z) => {
			const x = Math.max(0, z.x);
			const y = Math.max(0, z.y);
			return { x, y, b: Math.min(b, z.x + z.b) - x, h: Math.min(h, z.y + z.h) - y };
		})
		.filter((z) => z.b > 0 && z.h > 0);
};

const waehle = <T>(liste: readonly T[], rnd: () => number): T => liste[Math.floor(rnd() * liste.length)] as T;

const liegtIn = (z: Zone, x: number, y: number, r: number) =>
	x - r - RAND >= z.x && x + r + RAND <= z.x + z.b && y - r - RAND >= z.y && y + r + RAND <= z.y + z.h;

interface Mass {
	/** Wie viele Teile nach Dichte und Fläche gewollt sind (vor der Obergrenze). */
	gewollt: number;
	/** Faktor für die Radien, wenn die Obergrenze greift. */
	vergroessert: number;
}

const masse = (p: StreuParameter, flaeche: number, mal: number, grenze: number): Mass => {
	const s = RADIUS[p.groesse] * ABSTAND_FAKTOR;
	const gewollt = (Math.max(0, Math.min(1, p.dichte)) * flaeche * mal) / (s * s);
	return {
		gewollt,
		vergroessert: gewollt > grenze ? Math.min(MAX_VERGROESSERUNG, Math.sqrt(gewollt / grenze)) : 1,
	};
};

const eckPunkt = (ecke: Ecke, b: number, h: number) => ({
	x: ecke === 'ol' || ecke === 'ul' ? 0 : b,
	y: ecke === 'ol' || ecke === 'or' ? 0 : h,
});

/** Punkte im versetzten Raster, zur Ecke hin dichter und größer. */
const streuePunkte = (p: StreuParameter, rnd: () => number, felder: Zone[], flaeche: number, rMax: number): Teil[] => {
	const { gewollt, vergroessert } = masse(p, flaeche, RASTER_UEBERSCHUSS, MAX_TEILE * 2);
	const anzahl = Math.min(MAX_TEILE * 2, Math.round(gewollt));
	if (anzahl < 1) {
		return [];
	}
	const schritt = Math.sqrt(flaeche / anzahl);
	const basis = RADIUS[p.groesse] * vergroessert;
	const ecke = eckPunkt(p.ecke ?? STANDARD_ECKE, p.b, p.h);
	const diagonale = Math.hypot(p.b, p.h) || 1;
	const fertig: (Teil & { t: number })[] = [];
	for (let zeile = 0, y = schritt / 2; y < p.h; zeile += 1, y += schritt) {
		for (let x = zeile % 2 === 0 ? schritt / 2 : schritt; x < p.b; x += schritt) {
			// Die Würfe stehen fest, auch wenn das Teil wegfällt: Ein Teil ändert die Folge der anderen nicht.
			const ax = x + (rnd() - 0.5) * schritt * 0.2;
			const ay = y + (rnd() - 0.5) * schritt * 0.2;
			const behalte = rnd();
			const form = waehle(p.formen, rnd);
			const farbe = waehle(p.farben, rnd);
			const drehen = Math.floor(rnd() * 360);
			const t = Math.min(1, Math.hypot(ax - ecke.x, ay - ecke.y) / diagonale);
			if (behalte >= 1 - 0.9 * t ** 0.8) {
				continue;
			}
			const r = runde(Math.min(rMax, Math.max(1.5, basis * (1 - 0.5 * t))));
			if (felder.some((z) => liegtIn(z, ax, ay, r))) {
				fertig.push({ form, x: runde(ax), y: runde(ay), r, drehen: form === 'punkt' ? 0 : drehen, farbe, t });
			}
		}
	}
	// Reicht die Obergrenze nicht, bleiben die, die der Ecke am nächsten sind.
	return fertig
		.sort((a, b) => a.t - b.t)
		.slice(0, MAX_TEILE)
		.map(({ drehen, farbe, form, r, x, y }) => ({ form, x, y, r, drehen, farbe }));
};

/** Konfetti und Sterne: zufällig mit Mindestabstand (Poisson-Scheibe, Versuche begrenzt). */
const streueMitAbstand = (p: StreuParameter, rnd: () => number, felder: Zone[], flaeche: number, rMax: number): Teil[] => {
	const { gewollt, vergroessert } = masse(p, flaeche, 1, MAX_TEILE);
	const ziel = Math.min(MAX_TEILE, p.dichte > 0 ? Math.max(1, Math.round(gewollt)) : 0);
	const basis = RADIUS[p.groesse] * vergroessert;
	const gesamt = felder.reduce((s, z) => s + z.b * z.h, 0);
	// Ein Gitter aus Zellen, so groß wie der größte Abstand: Geprüft werden nur die Nachbarzellen.
	const zelle = Math.max(2, 2 * Math.min(rMax, basis * (p.art === 'sterne' ? 2.2 : 1.25)) * LUFT);
	const spalten = Math.ceil(p.b / zelle) + 1;
	const gitter = new Map<number, Teil[]>();
	const fertig: Teil[] = [];
	for (let versuch = 0; fertig.length < ziel && versuch < ziel * 40; versuch += 1) {
		const form = waehle(p.formen, rnd);
		const farbe = waehle(p.farben, rnd);
		const wurf = rnd();
		const dreh = rnd();
		// Sterne: wenige große, viele kleine. Konfetti: ähnlich groß.
		const faktor = p.art === 'sterne' ? (wurf < 0.18 ? 1.7 + rnd() * 0.5 : 0.6 + rnd() * 0.4) : 0.75 + wurf * 0.5;
		const r = runde(Math.min(rMax, Math.max(1.5, basis * faktor)));
		let rest = rnd() * gesamt;
		const feld = felder.find((z) => (rest -= z.b * z.h) < 0) ?? felder.at(-1);
		const rand = r + RAND;
		if (!feld || feld.b < 2 * rand || feld.h < 2 * rand) {
			continue;
		}
		const x = runde(feld.x + rand + rnd() * (feld.b - 2 * rand));
		const y = runde(feld.y + rand + rnd() * (feld.h - 2 * rand));
		const sx = Math.floor(x / zelle);
		const sy = Math.floor(y / zelle);
		let frei = true;
		for (let dx = -1; frei && dx <= 1; dx += 1) {
			for (let dy = -1; frei && dy <= 1; dy += 1) {
				frei = !gitter
					.get((sy + dy) * spalten + sx + dx)
					?.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * LUFT);
			}
		}
		if (!frei) {
			continue;
		}
		const drehen = p.art === 'sterne' ? Math.round(dreh * 50 - 25) : Math.floor(dreh * 360);
		const teil: Teil = { form, x, y, r, drehen, farbe };
		fertig.push(teil);
		const platz = sy * spalten + sx;
		gitter.set(platz, [...(gitter.get(platz) ?? []), teil]);
	}
	return fertig;
};

/**
 * Die Teile einer Streuung. Rein, ohne DOM: gleiche Parameter ergeben dieselben Teile. Höchstens `MAX_TEILE`; jedes
 * Teil liegt mit seinem Umkreis ganz auf der Fläche (und ganz in einer Zone, wenn es Zonen gibt).
 */
export const streue = (p: StreuParameter): Teil[] => {
	const felder = bereiche(p.b, p.h, p.zonen);
	const flaeche = felder.reduce((s, z) => s + z.b * z.h, 0);
	const rMax = Math.max(1, Math.min(p.b, p.h) / 2 - 2 * RAND);
	if (flaeche <= 0 || p.formen.length === 0 || p.farben.length === 0 || p.b < 4 || p.h < 4) {
		return [];
	}
	const rnd = zufall(p.saat);
	return p.art === 'punkte'
		? streuePunkte(p, rnd, felder, flaeche, rMax)
		: streueMitAbstand(p, rnd, felder, flaeche, rMax);
};

// ── Als SVG ─────────────────────────────────────────────────────────────────

const STERN_INNEN = 0.45;
const RAUTE_BREITE = 0.62;
/** Streifen: Seitenverhältnis 3 : 1, die halbe Diagonale ist der Radius. */
const STREIFEN_HALB = { b: 0.948, h: 0.316 };

const ecken = (winkel: readonly number[], x: number, y: number, r: number) =>
	winkel.map((w) => `${zahl(x + r * Math.cos(w))} ${zahl(y + r * Math.sin(w))}`).join(' ');

const grad = (g: number) => (g * Math.PI) / 180;

/** Die Eckpunkte von Dreieck, Raute und Stern um die Mitte (x, y); `null` bei Punkt und Streifen. */
const polygonPunkte = (form: StreuForm, x: number, y: number, r: number): string | null => {
	switch (form) {
		case 'dreieck':
			return ecken([-90, 30, 150].map(grad), x, y, r);
		case 'raute':
			return [
				[x, y - r],
				[x + r * RAUTE_BREITE, y],
				[x, y + r],
				[x - r * RAUTE_BREITE, y],
			]
				.map(([px, py]) => `${zahl(px ?? 0)} ${zahl(py ?? 0)}`)
				.join(' ');
		case 'stern':
			return Array.from({ length: 10 }, (_, i) => {
				const w = grad(-90 + i * 36);
				const abstand = i % 2 === 0 ? r : r * STERN_INNEN;
				return `${zahl(x + abstand * Math.cos(w))} ${zahl(y + abstand * Math.sin(w))}`;
			}).join(' ');
		default:
			return null;
	}
};

/** Das Standard-Mapping: der Name wird `var(--name)`. */
const alsVariable = (name: string) => `var(--${name})`;

/**
 * Die Kinder des `svg`: `circle`, `polygon`, `rect`, je mit `style="fill:var(--haupt)"` und, wo es etwas ändert,
 * `transform="rotate(…)"`. Zahlen mit höchstens zwei Nachkommastellen. `farbe` kann den Namen anders auflösen, etwa für
 * die Vorschau in der Schublade.
 */
export const teileAlsSvg = (teile: readonly Teil[], farbe: (name: string) => string = alsVariable) =>
	teile
		.map((t) => {
			const name = /^[a-z][a-z0-9]*$/.test(t.farbe) ? t.farbe : 'haupt';
			const stil = `style="fill:${farbe(name)}"`;
			const dreh = t.drehen % 360 === 0 ? '' : ` transform="rotate(${zahl(t.drehen)} ${zahl(t.x)} ${zahl(t.y)})"`;
			if (t.form === 'punkt') {
				return `<circle cx="${zahl(t.x)}" cy="${zahl(t.y)}" r="${zahl(t.r)}" ${stil}/>`;
			}
			if (t.form === 'streifen') {
				const b = t.r * STREIFEN_HALB.b;
				const h = t.r * STREIFEN_HALB.h;
				return `<rect x="${zahl(t.x - b)}" y="${zahl(t.y - h)}" width="${zahl(2 * b)}" height="${zahl(2 * h)}" ${stil}${dreh}/>`;
			}
			return `<polygon points="${polygonPunkte(t.form, t.x, t.y, t.r) ?? ''}" ${stil}${dreh}/>`;
		})
		.join('');

// ── Parameter lesen und schreiben ───────────────────────────────────────────

/** Was an den Attributen steht, gelesen und in den Bereich gebracht. Ohne Saat ist `saat` `null`. */
export interface StreuAngaben {
	art: StreuArt;
	saat: number | null;
	dichte: number;
	formen: StreuForm[];
	farben: string[];
	groesse: StreuGroesse;
	ecke: Ecke;
	zonen: Zone[] | null;
}

const liste = (wert: string | null | undefined) =>
	(wert ?? '')
		.toLowerCase()
		.split(/[\s,;]+/)
		.filter(Boolean);

const aus = <T extends string>(erlaubt: readonly T[], wert: string | null | undefined): T | undefined =>
	erlaubt.find((e) => e === wert?.trim().toLowerCase());

const einmalig = <T extends string>(erlaubt: readonly T[], roh: string | null | undefined): T[] => {
	const da = new Set(liste(roh));
	return erlaubt.filter((e) => da.has(e));
};

const MAX_ZONEN = 20;

/** `x,y,b,h;x,y,b,h` → Rechtecke; was nicht passt, fällt weg. */
export const zonenAus = (wert: string | null | undefined): Zone[] | null => {
	const zonen = (wert ?? '')
		.split(';')
		.map((teil) => teil.split(',').map((n) => Number(n.trim())))
		.filter((n) => n.length === 4 && n.every(Number.isFinite) && (n[2] ?? 0) > 0 && (n[3] ?? 0) > 0)
		.slice(0, MAX_ZONEN)
		.map(([x = 0, y = 0, b = 0, h = 0]) => ({ x, y, b, h }));
	return zonen.length > 0 ? zonen : null;
};

export const zonenText = (zonen: readonly Zone[]) =>
	zonen.map((z) => [z.x, z.y, z.b, z.h].map(zahl).join(',')).join(';');

export const dichteAus = (roh: unknown) => {
	const n = roh === null || roh === undefined || roh === '' ? NaN : Number(roh);
	return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : STANDARD_DICHTE;
};

/** `null`, wenn `data-streuung` fehlt oder keine bekannte Art nennt. */
export const leseStreuAngaben = (lies: (name: string) => string | null | undefined): StreuAngaben | null => {
	const art = aus(STREU_ARTEN, lies('data-streuung'));
	if (!art) {
		return null;
	}
	const saat = Number(lies('data-saat'));
	const formen = einmalig(STREU_FORMEN, lies('data-formen'));
	const farben = einmalig(STREU_FARBEN, lies('data-farben'));
	return {
		art,
		saat: lies('data-saat') && Number.isFinite(saat) ? saatAus(saat) : null,
		dichte: dichteAus(lies('data-dichte')),
		formen: formen.length > 0 ? formen : [...STANDARD_FORMEN[art]],
		farben: farben.length > 0 ? farben : [...STANDARD_FARBEN],
		groesse: aus(STREU_GROESSEN, lies('data-groesse')) ?? STANDARD_GROESSE,
		ecke: aus(STREU_ECKEN, lies('data-ecke')) ?? STANDARD_ECKE,
		zonen: zonenAus(lies('data-zonen')),
	};
};

/** Die Parameter für `streue`; ohne Saat in den Attributen gilt 1. */
export const parameterVon = (a: StreuAngaben, b: number, h: number): StreuParameter => ({
	art: a.art,
	saat: a.saat ?? 1,
	dichte: a.dichte,
	formen: a.formen,
	farben: a.farben,
	groesse: a.groesse,
	b,
	h,
	...(a.art === 'punkte' ? { ecke: a.ecke } : {}),
	...(a.zonen ? { zonen: a.zonen } : {}),
});

/** Der Bildschirmwert zum Anzeigen im Browser: dieselben Teile wie in der Quelle. */
export const streuungInnen = (p: StreuParameter) => teileAlsSvg(streue(p));

/** Die Ecke der Seite, der die Mitte des Elements am nächsten liegt (Punkte werden dorthin dichter). */
export const naechsteEcke = (
	element: { x: number; y: number; b: number; h: number },
	seite: { b: number; h: number },
): Ecke => {
	const links = element.x + element.b / 2 < seite.b / 2;
	const oben = element.y + element.h / 2 < seite.h / 2;
	return `${oben ? 'o' : 'u'}${links ? 'l' : 'r'}` as Ecke;
};

// ── Neues Element ───────────────────────────────────────────────────────────

export interface NeueStreuung {
	art: StreuArt;
	saat: number;
	b: number;
	h: number;
	dichte?: number;
	formen?: readonly StreuForm[];
	farben?: readonly string[];
	groesse?: StreuGroesse;
	ecke?: Ecke;
	zonen?: readonly Zone[];
}

/** Das `svg` einer neuen Streuung samt Teilen, schon mit `data-lage="frei"`; die Lage setzt `legeGestaltungAb`. */
export const streuungHtml = (n: NeueStreuung) => {
	const b = Math.max(1, Math.round(n.b));
	const h = Math.max(1, Math.round(n.h));
	const saat = saatAus(n.saat);
	const dichte = dichteAus(n.dichte);
	const formen = n.formen?.length ? [...n.formen] : [...STANDARD_FORMEN[n.art]];
	const farben = n.farben?.length ? [...n.farben] : [...STANDARD_FARBEN];
	const groesse = n.groesse ?? STANDARD_GROESSE;
	const ecke = n.ecke ?? STANDARD_ECKE;
	const zonen = n.zonen?.length ? n.zonen : null;
	const kinder = streuungInnen({
		art: n.art,
		saat,
		dichte,
		formen,
		farben,
		groesse,
		b,
		h,
		...(n.art === 'punkte' ? { ecke } : {}),
		...(zonen ? { zonen } : {}),
	});
	return (
		`<svg class="streuung" data-lage="frei" data-streuung="${n.art}" data-saat="${saat}" data-dichte="${zahl(dichte)}"` +
		` data-formen="${formen.join(' ')}" data-farben="${farben.join(' ')}" data-groesse="${groesse}"` +
		`${n.art === 'punkte' ? ` data-ecke="${ecke}"` : ''}${zonen ? ` data-zonen="${zonenText(zonen)}"` : ''}` +
		` viewBox="0 0 ${b} ${h}" style="--b:${b}px;--h:${h}px">${kinder}</svg>`
	);
};

// ── In der Quelle ───────────────────────────────────────────────────────────

/** Eine Streuung: `svg` mit Klasse `streuung` und bekannter `data-streuung`. */
export const istStreuung = (k: Knoten) =>
	k.tag === 'svg' && klassenVon(k).includes('streuung') && aus(STREU_ARTEN, attribut(k, 'data-streuung')?.wert) !== undefined;

const angabenVon = (k: Knoten) => leseStreuAngaben((name) => attribut(k, name)?.wert);

/** Breite und Höhe: `--b`, `--h` im `style`, sonst die `viewBox`. */
const massVon = (k: Knoten) => {
	const stil = groesseAus(attribut(k, 'style')?.wert ?? null);
	if (stil) {
		return stil;
	}
	const v = (attribut(k, 'viewbox')?.wert ?? '').trim().split(/[\s,]+/).map(Number);
	const [, , b, h] = v;
	return v.length === 4 && b !== undefined && h !== undefined && b > 0 && h > 0
		? { b: Math.round(b), h: Math.round(h) }
		: null;
};

/** Ersetzt die Kinder des Elements durch `innen`. */
const ersetzeKinder = (z: Zerlegung, k: Knoten, innen: string): Aenderung[] => {
	if (k.oeffnerEnde === k.ende) {
		const tag = z.quelle.slice(k.start, k.oeffnerEnde).replace(/\s*\/>$/, '>');
		return [{ von: k.start, bis: k.ende, text: `${tag}${innen}</svg>` }];
	}
	return [{ von: k.oeffnerEnde, bis: k.schliesserStart, text: innen }];
};

/**
 * Schreibt `viewBox` und Kinder der Streuung `nr` neu, passend zu Größe und Parametern. Dieselbe Saat ergibt dieselben
 * Teile, auch nach einer Größenänderung. Ohne Größe oder für alles, was keine Streuung ist, kommt die Quelle unverändert
 * zurück. Das ist die Folge für `groessen-folgen.ts`.
 */
export const zeichneStreuungNeu = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const a = k && istStreuung(k) ? angabenVon(k) : null;
	const mass = k && a ? massVon(k) : null;
	if (!k || !a || !mass) {
		return quelle;
	}
	const viewBox = `0 0 ${mass.b} ${mass.h}`;
	const innen = streuungInnen(parameterVon(a, mass.b, mass.h));
	const nurAttribut = attribut(k, 'viewbox')?.wert === viewBox ? [] : setzeAttributAn(z, k, 'viewBox', viewBox);
	const neu = nurAttribut.length ? wendeAn(quelle, nurAttribut) : quelle;
	const z2 = nurAttribut.length ? zerlege(neu) : z;
	const k2 = z2.knoten[nr];
	if (!k2 || (k2.oeffnerEnde !== k2.ende && innenVon(z2, k2) === innen)) {
		return neu;
	}
	return wendeAn(neu, ersetzeKinder(z2, k2, innen));
};

// ── Fehlende Kinder (Claude) ────────────────────────────────────────────────

/** Kinder, die nichts zeichnen. */
const NUR_BEIWERK = new Set(['defs', 'title', 'desc']);

/** Aus der Nummer im Dokument eine feste Saat, wenn Claude keine nennt. */
const saatFuer = (nr: number) => saatAus(nr * 7919 + 4711);

const ergaenzeEins = (z: Zerlegung, k: Knoten): string | null => {
	const a = istStreuung(k) ? angabenVon(k) : null;
	if (!a) {
		return null;
	}
	const { quelle } = z;
	const stil = attribut(k, 'style')?.wert ?? null;
	const fehlt = (name: string) => stilWert(stil, name) === null;
	const mass = massVon(k) ?? STANDARD_MASS;
	// Erst Größe und Saat, dann die Kinder: Jeder Schritt ändert die Quelle, die Schleife prüft danach neu.
	if (fehlt('--b') || fehlt('--h')) {
		const neu = stilMit(stil, {
			...(fehlt('--b') ? { '--b': `${mass.b}px` } : {}),
			...(fehlt('--h') ? { '--h': `${mass.h}px` } : {}),
		});
		return wendeAn(quelle, setzeAttributAn(z, k, 'style', neu));
	}
	if (a.saat === null) {
		return wendeAn(quelle, setzeAttributAn(z, k, 'data-saat', String(saatFuer(k.nr))));
	}
	if (k.kinder.some((kind) => !NUR_BEIWERK.has(kind.tag))) {
		return null;
	}
	const innen = streuungInnen(parameterVon(a, mass.b, mass.h));
	if (innen === '') {
		return null;
	}
	const viewBox = `0 0 ${mass.b} ${mass.h}`;
	const aenderungen =
		attribut(k, 'viewbox')?.wert === viewBox || k.oeffnerEnde === k.ende ? [] : setzeAttributAn(z, k, 'viewBox', viewBox);
	const mitBox = aenderungen.length ? wendeAn(quelle, aenderungen) : quelle;
	const z2 = aenderungen.length ? zerlege(mitBox) : z;
	const k2 = z2.knoten[k.nr];
	return k2 ? wendeAn(mitBox, ersetzeKinder(z2, k2, innen)) : null;
};

/**
 * Claude darf bei Streuungen die Kinder weglassen (4.4, Ticket 109): Fehlen sie, entstehen sie aus den Attributen; ohne
 * Saat bekommt die Streuung eine feste, ohne Größe 300 × 300. Vorhandene Kinder bleiben, wie sie sind. Ohne Streuung
 * kommt die Quelle Zeichen für Zeichen zurück.
 */
export const ergaenzeStreuungen = (quelle: string) => {
	if (!quelle.includes('data-streuung')) {
		return quelle;
	}
	let jetzt = quelle;
	// Jede Streuung braucht höchstens vier Schritte; die Grenze schützt vor einer Schleife.
	for (let durchlauf = 0; durchlauf < 1000; durchlauf += 1) {
		const z = zerlege(jetzt);
		let neu: string | null = null;
		for (const k of z.knoten) {
			neu = ergaenzeEins(z, k);
			if (neu !== null && neu !== jetzt) {
				break;
			}
			neu = null;
		}
		if (neu === null) {
			return jetzt;
		}
		jetzt = neu;
	}
	return jetzt;
};

// ── Ändern ──────────────────────────────────────────────────────────────────

export interface StreuStand extends StreuAngaben {
	/** Größe in px. */
	b: number;
	h: number;
	/** Wie viele Teile gerade im Element stehen. */
	anzahl: number;
}

/** Was Inspektor und Leiste zeigen. `null`, wenn `nr` keine Streuung ist. */
export const leseStreuung = (quelle: string, nr: number): StreuStand | null => {
	const k = zerlege(quelle).knoten[nr];
	const a = k && istStreuung(k) ? angabenVon(k) : null;
	if (!k || !a) {
		return null;
	}
	const mass = massVon(k) ?? STANDARD_MASS;
	return { ...a, ...mass, anzahl: k.kinder.filter((kind) => !NUR_BEIWERK.has(kind.tag)).length };
};

/** Was `setzeStreuung` ändert; was fehlt, bleibt. */
export interface StreuTeil {
	art?: StreuArt;
	saat?: number;
	dichte?: number;
	formen?: readonly StreuForm[];
	farben?: readonly string[];
	groesse?: StreuGroesse;
	ecke?: Ecke;
	/** `null` entfernt die Zonen. */
	zonen?: readonly Zone[] | null;
}

/**
 * Setzt Parameter (in ihren Bereich gebracht) und erzeugt die Teile neu. Wechselt die Art, ohne dass `formen` dabei
 * steht, gelten die Standard-Formen der neuen Art.
 */
export const setzeStreuung = (quelle: string, nr: number, teil: StreuTeil) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const alt = k && istStreuung(k) ? angabenVon(k) : null;
	if (!k || !alt) {
		throw new Error(`Das Element ${nr} ist keine Streuung.`);
	}
	const art = teil.art && STREU_ARTEN.includes(teil.art) ? teil.art : alt.art;
	const formen = einmalig(STREU_FORMEN, (teil.formen ?? (art === alt.art ? alt.formen : [])).join(' '));
	const farben = einmalig(STREU_FARBEN, (teil.farben ?? alt.farben).join(' '));
	const zonen = teil.zonen === undefined ? alt.zonen : teil.zonen;
	const werte: Record<string, string | null> = {
		'data-streuung': art,
		'data-saat': String(saatAus(teil.saat ?? alt.saat ?? saatFuer(nr))),
		'data-dichte': zahl(dichteAus(teil.dichte ?? alt.dichte)),
		'data-formen': (formen.length > 0 ? formen : STANDARD_FORMEN[art]).join(' '),
		'data-farben': (farben.length > 0 ? farben : STANDARD_FARBEN).join(' '),
		'data-groesse': aus(STREU_GROESSEN, teil.groesse) ?? alt.groesse,
		'data-ecke': art === 'punkte' ? (aus(STREU_ECKEN, teil.ecke) ?? alt.ecke) : (attribut(k, 'data-ecke')?.wert ?? null),
		'data-zonen': zonen?.length ? zonenText(zonen) : null,
	};
	const aenderungen = Object.entries(werte)
		.filter(([name, wert]) => (attribut(k, name)?.wert ?? null) !== wert)
		.flatMap(([name, wert]) => setzeAttributAn(z, k, name, wert));
	return zeichneStreuungNeu(aenderungen.length ? wendeAn(quelle, aenderungen) : quelle, nr);
};

/**
 * Würfeln: eine neue Saat, sonst bleibt alles. Der Editor übergibt die Saat (aus `Date.now()`), der Kern würfelt nie
 * selbst. Wäre die neue Saat die alte, rückt sie um eins weiter, damit sich das Bild sicher ändert.
 */
export const wuerfle = (quelle: string, nr: number, saat: number) => {
	const stand = leseStreuung(quelle, nr);
	if (!stand) {
		throw new Error(`Das Element ${nr} ist keine Streuung.`);
	}
	const neu = saatAus(saat);
	return setzeStreuung(quelle, nr, { saat: neu === stand.saat ? saatAus(neu + 1) : neu });
};
