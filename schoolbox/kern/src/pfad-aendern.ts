/**
 * Freie Pfade in der Quelle (116): ablegen (Stift P, Pfad ⇧P) und Punkte bearbeiten. Die Rechnung steckt in `vektor.ts`
 * (rein), das Format in `formen-pfad.ts`. Jede Funktion schreibt `d` normalisiert (`M L C Z`, absolut): Ein Pfad von
 * Claude mit `A` oder relativen Befehlen wird bei der ersten Änderung umgeschrieben, ohne eigenen Schritt.
 *
 * Nach jeder Änderung passt sich das Element dem Rechteck um die Kurven an. Bei gedrehten Pfaden rückt es so, dass alle
 * anderen Punkte auf dem Blatt stehen bleiben.
 */

import { FUELLUNG, KONTUR, pfadStil, stilMit, STRICH } from './formen';
import type { Punkt, Zug } from './formen-geometrie';
import { lesePfadForm, pfadAenderungen, pfadHtml, pfadImRechteck } from './formen-pfad';
import { legeGestaltungAb, leseLage, setzeLage } from './gestaltung';
import { wendeAn } from './quelltext';
import type { StrukturErgebnis } from './struktur';
import { loescheAnker, setzeAnker } from './vektor';

/** Stil eines neuen Pfads: geschlossen gefüllt mit Kontur wie jede Form, offen nur die Kontur mit runden Enden. */
export const neuerPfadStil = (geschlossen: boolean) =>
	geschlossen
		? pfadStil(FUELLUNG, { farbe: KONTUR, staerke: STRICH })
		: (stilMit(pfadStil(null, { farbe: KONTUR, staerke: STRICH }), { 'stroke-linecap': 'round' }) ?? '');

/** HTML und Lage eines neuen Pfads aus Punkten in Koordinaten der Seite (Vorschau im Werkzeug und Ablegen). */
export const neuerPfad = (zuege: readonly Zug[], geschlossen: boolean) => {
	const r = pfadImRechteck(zuege, STRICH);
	return {
		html: pfadHtml({ d: r.d, b: r.b, h: r.h, stil: neuerPfadStil(geschlossen) }),
		lage: { x: r.versatz.x, y: r.versatz.y, b: r.b, h: r.h },
	};
};

export interface PfadAblegen {
	seite: number;
	/** In Koordinaten der Seite, wie `--x`, `--y`. */
	zuege: readonly Zug[];
	geschlossen: boolean;
}

export const legePfad = (quelle: string, { geschlossen, seite, zuege }: PfadAblegen): StrukturErgebnis => {
	const { html, lage } = neuerPfad(zuege, geschlossen);
	return legeGestaltungAb(quelle, { seite, html, lage, ebene: 'vorne' });
};

const drehePunkt = (p: Punkt, grad: number): Punkt => {
	const w = (grad * Math.PI) / 180;
	return { x: p.x * Math.cos(w) - p.y * Math.sin(w), y: p.x * Math.sin(w) + p.y * Math.cos(w) };
};

/**
 * Schreibt neue Züge (in Koordinaten des Elements) in den Pfad `nr`: `d`, `viewBox` und die Lage. Ist das Element
 * gedreht, dreht es sich um seine Mitte; wächst es, wandert die Mitte. Die Lage gleicht das aus, damit Punkte, die sich
 * nicht bewegt haben, auf dem Blatt stehen bleiben.
 */
export const schreibePfadZuege = (quelle: string, nr: number, zuege: readonly Zug[]) => {
	const a = lesePfadForm(quelle, nr);
	if (!a) {
		return quelle;
	}
	const lage = leseLage(quelle, nr);
	const b = lage.b ?? a.viewBox?.b ?? 0;
	const h = lage.h ?? a.viewBox?.h ?? 0;
	const neu = pfadImRechteck(zuege, a.strich);
	const drehen = lage.drehen ?? 0;
	const o = neu.versatz;
	const mitteAlt = { x: b / 2, y: h / 2 };
	const mitteNeu = { x: neu.b / 2, y: neu.h / 2 };
	const gedreht = drehePunkt({ x: o.x + mitteNeu.x - mitteAlt.x, y: o.y + mitteNeu.y - mitteAlt.y }, drehen);
	const x = (lage.x ?? 0) + mitteAlt.x - mitteNeu.x + gedreht.x;
	const y = (lage.y ?? 0) + mitteAlt.y - mitteNeu.y + gedreht.y;
	const mitD = wendeAn(quelle, pfadAenderungen(quelle, nr, neu.d, neu.b, neu.h));
	return setzeLage(mitD, nr, { x: Math.round(x), y: Math.round(y), b: neu.b, h: neu.h });
};

/** Die Züge des Pfads `nr`, normalisiert; `null`, wenn es kein lesbarer Pfad ist. */
export const lesePfadZuege = (quelle: string, nr: number) => lesePfadForm(quelle, nr)?.zuege ?? null;

/**
 * Setzt Punkt `index` (Reihenfolge wie `ankerVon`) auf `punkt` (Koordinaten des Elements). Ohne `griffe` wandern seine
 * Griffe mit; mit `griffe` stehen sie dort.
 */
export const setzePfadPunkt = (
	quelle: string,
	nr: number,
	index: number,
	punkt: Punkt,
	griffe?: { ein?: Punkt | null; aus?: Punkt | null },
) => {
	const zuege = lesePfadZuege(quelle, nr);
	return zuege ? schreibePfadZuege(quelle, nr, setzeAnker(zuege, index, punkt, griffe)) : quelle;
};

/** Löscht Punkt `index`; ein Zug behält mindestens zwei Punkte. */
export const loeschePfadPunkt = (quelle: string, nr: number, index: number) => {
	const zuege = lesePfadZuege(quelle, nr);
	return zuege ? schreibePfadZuege(quelle, nr, loescheAnker(zuege, index)) : quelle;
};
