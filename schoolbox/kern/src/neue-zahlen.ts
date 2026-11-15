import type { Werte } from './abbildungen';

/**
 * 197-U6: „Neue Zahlen“ für Arten, die `abbildungen.js` nicht würfelt und bei denen es einfach ist: eine Anzahl im
 * Zahlenraum der Klasse. Stellentafel, Punktfeld, Rechenstrich und Diagramm haben keinen (Zahlen hängen zusammen).
 */

/** Zahlenraum je Klasse 1–4. */
const ZAHLENRAUM = new Map([
	[1, 20],
	[2, 100],
	[3, 1000],
	[4, 1_000_000],
]);

/** Zahlenraum je Klasse; ohne Klasse bis 100. */
export const zahlenraumDerKlasse = (klasse: number | undefined) =>
	(klasse === undefined ? undefined : ZAHLENRAUM.get(klasse)) ?? 100;

const zwischen = (von: number, bis: number, zufall: () => number) =>
	bis < von ? von : von + Math.floor(zufall() * (bis - von + 1));

const zahl = (w: Werte, a: string, standard: number) => {
	const n = Number(w[a] ?? standard);
	return Number.isFinite(n) ? n : standard;
};

type Erzeuger = (w: Werte, raum: number, zufall: () => number) => Werte | null;

/** Zweite Sorte nur, wenn es sie schon gibt; zusammen höchstens `platz`. */
const plaettchen = (w: Werte, platz: number, zufall: () => number): Werte => {
	const n = zwischen(1, platz, zufall);
	return zahl(w, 'n2', 0) > 0 ? { n: String(n), n2: String(zwischen(0, platz - n, zufall)) } : { n: String(n) };
};

export const KERN_NEUE_ZAHLEN: Record<string, Erzeuger> = {
	'x-menge': (_, raum, zufall) => ({ n: String(zwischen(1, Math.min(100, raum), zufall)) }),
	'x-strichpunkt': (_, raum, zufall) => {
		const n = zwischen(11, Math.min(99, raum), zufall);
		return { z: String(Math.floor(n / 10)), e: String(n % 10) };
	},
	'x-zwanzigerfeld': (w, raum, zufall) => plaettchen(w, Math.min(20, raum), zufall),
	'x-hunderterfeld': (w, raum, zufall) =>
		plaettchen(w, Math.min(raum, zahl(w, 'zeilen', 10) * zahl(w, 'spalten', 10)), zufall),
	// 197-N03: Bei „Zahl“ steht die Zahl im Inhalt, nicht in `augen`; Füllung und Text haben keine neuen Zahlen.
	'x-wuerfel': (w, _, zufall): Werte | null => {
		if ((w.ansicht ?? 'flach') !== 'flach') {
			return null;
		}
		const art = w.art ?? 'augen';
		if (art === 'augen') {
			return { augen: String(zwischen(1, 6, zufall)) };
		}
		return art === 'zahl' ? { inhalt: String(zwischen(1, 6, zufall)) } : null;
	},
};

export const neueZahlenImKern = (tag: string, w: Werte, klasse: number | undefined, zufall = Math.random) =>
	KERN_NEUE_ZAHLEN[tag]?.(w, zahlenraumDerKlasse(klasse), zufall) ?? null;

/** Gibt es für diese Werte neue Zahlen aus dem Kern? Sonst fehlt der Knopf (197-N03). */
export const hatNeueZahlenImKern = (tag: string, w: Werte | null) =>
	Boolean(KERN_NEUE_ZAHLEN[tag]) && (w === null || neueZahlenImKern(tag, w, undefined, () => 0) !== null);
