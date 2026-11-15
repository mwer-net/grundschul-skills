import { MARKE } from '@schoolbox/kern/src/quelltext';

import { SICHTBARES_OHNE_TEXT } from '../../leistenlage';

/** Ein Rechteck in Koordinaten des Materials (wie `getBoundingClientRect` im `iframe`). */
export interface Feld {
	links: number;
	rechts: number;
	oben: number;
	unten: number;
}

/** Rasterweite der Suche und Abstand zum Inhalt, in px des Materials. */
const ZELLE = 8;
const ABSTAND = 8;

/** Kleiner als so (oder als das Bild selbst) wird ein Bild für eine freie Stelle nicht. */
export const MINDESTBREITE = 80;

/**
 * Was auf der Seite steht: jeder Baustein ohne Bausteine darin, jedes freie Element, Text, Bilder. Was fast die ganze
 * Seite bedeckt (Seitenfläche, Seitenrahmen), zählt nicht: Darüber legt man ohnehin.
 */
export const inhaltAuf = (seite: Element): Feld[] => {
	const s = seite.getBoundingClientRect();
	const flaeche = s.width * s.height;
	const aus: Feld[] = [];
	const nimm = (r: DOMRect) => {
		if (r.width >= 1 && r.height >= 1 && r.width * r.height < flaeche / 2) {
			aus.push({ links: r.left, rechts: r.right, oben: r.top, unten: r.bottom });
		}
	};
	for (const e of seite.querySelectorAll(`[${MARKE}]`)) {
		if (!e.querySelector(`[${MARKE}]`)) {
			nimm(e.getBoundingClientRect());
		}
	}
	for (const m of seite.querySelectorAll(SICHTBARES_OHNE_TEXT)) {
		if (!m.parentElement?.closest('svg')) {
			nimm(m.getBoundingClientRect());
		}
	}
	const doc = seite.ownerDocument;
	const lauf = doc.createTreeWalker(seite, NodeFilter.SHOW_TEXT);
	const bereich = doc.createRange();
	for (let k = lauf.nextNode(); k; k = lauf.nextNode()) {
		if (k.nodeValue?.trim()) {
			bereich.selectNodeContents(k);
			for (const r of bereich.getClientRects()) {
				nimm(r);
			}
		}
	}
	return aus;
};

/** Raster aus `zeilen`×`spalten` Zellen über `bereich`: 1, wo ein Feld aus `inhalt` samt Abstand liegt. */
const belegteZellen = (bereich: Feld, inhalt: readonly Feld[], spalten: number, zeilen: number) => {
	const belegt = Array.from({ length: zeilen }, () => new Uint8Array(spalten));
	for (const r of inhalt) {
		const von = Math.max(0, Math.floor((r.links - ABSTAND - bereich.links) / ZELLE));
		const bis = Math.min(spalten - 1, Math.ceil((r.rechts + ABSTAND - bereich.links) / ZELLE) - 1);
		const oben = Math.max(0, Math.floor((r.oben - ABSTAND - bereich.oben) / ZELLE));
		const unten = Math.min(zeilen - 1, Math.ceil((r.unten + ABSTAND - bereich.oben) / ZELLE) - 1);
		for (let z = oben; z <= unten; z++) {
			belegt[z]?.fill(1, von, bis + 1);
		}
	}
	return belegt;
};

/**
 * S-10: Die beste freie Stelle in `bereich` für ein Element `b`×`h`, an der es nichts aus `inhalt` verdeckt: unter allen
 * freien Rechtecken das, in dem das Element am größten Platz hat (höchstens in voller Größe), bei Gleichstand das
 * größere. `schrumpfen`: Ein Bild darf bis `MINDESTBREITE` kleiner werden. Ergebnis: Mitte und Breite, sonst `null`.
 */
export const freieStelle = (
	bereich: Feld,
	inhalt: readonly Feld[],
	b: number,
	h: number,
	schrumpfen: boolean,
): { x: number; y: number; breite: number } | null => {
	const spalten = Math.floor((bereich.rechts - bereich.links) / ZELLE);
	const zeilen = Math.floor((bereich.unten - bereich.oben) / ZELLE);
	if (spalten <= 0 || zeilen <= 0 || b <= 0 || h <= 0) {
		return null;
	}
	const belegt = belegteZellen(bereich, inhalt, spalten, zeilen);
	const kleinste = schrumpfen ? Math.min(1, MINDESTBREITE / b) : 1;
	let beste: { s: number; flaeche: number; x: number; y: number } | null = null;
	const pruefe = (links: number, rechts: number, oben: number, unten: number) => {
		const w = (rechts - links) * ZELLE;
		const hh = (unten - oben) * ZELLE;
		const s = Math.min(1, w / b, hh / h);
		if (s < kleinste) {
			return;
		}
		const flaeche = w * hh;
		if (!beste || s > beste.s + 1e-6 || (Math.abs(s - beste.s) <= 1e-6 && flaeche > beste.flaeche)) {
			beste = {
				s,
				flaeche,
				x: bereich.links + ((links + rechts) / 2) * ZELLE,
				y: bereich.oben + ((oben + unten) / 2) * ZELLE,
			};
		}
	};
	// Größte leere Rechtecke je Zeile über das Histogramm der freien Zellen darüber.
	const hoehe = new Array<number>(spalten).fill(0);
	for (let z = 0; z < zeilen; z++) {
		const reihe = belegt[z];
		for (let sp = 0; sp < spalten; sp++) {
			hoehe[sp] = reihe?.[sp] ? 0 : (hoehe[sp] ?? 0) + 1;
		}
		const stapel: number[] = [];
		for (let sp = 0; sp <= spalten; sp++) {
			const jetzt = sp === spalten ? 0 : (hoehe[sp] ?? 0);
			while (stapel.length > 0 && (hoehe[stapel.at(-1) ?? 0] ?? 0) >= jetzt) {
				const oben = hoehe[stapel.pop() ?? 0] ?? 0;
				const links = stapel.length > 0 ? (stapel.at(-1) ?? 0) + 1 : 0;
				if (oben > 0) {
					pruefe(links, sp, z + 1 - oben, z + 1);
				}
			}
			stapel.push(sp);
		}
	}
	const ergebnis = beste as { s: number; x: number; y: number } | null;
	return ergebnis ? { x: ergebnis.x, y: ergebnis.y, breite: b * ergebnis.s } : null;
};
