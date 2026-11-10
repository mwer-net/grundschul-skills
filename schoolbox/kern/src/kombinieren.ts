/**
 * Formen kombinieren (121, Briefing 3-formen „Kombinieren und Formen-Schere“, F8): Vereinen, Abziehen, Schnitt,
 * Ausschluss und die Bereiche der Formen-Schere. Rein, ohne DOM. Die Formen werden zu Polygonen in Koordinaten des
 * Elternteils (Lage, Drehung und Spiegelung schon darin), `polyclip-ts` verknüpft sie, und jeder Ring wird mit `glaette`
 * (116) wieder zu Kurven und Ecken. Das Ergebnis ist ein freier Pfad (`data-form="pfad"`) mit dem Aussehen der vordersten
 * Ausgangsform; Löcher stehen als weitere Teilpfade mit `fill-rule:evenodd`.
 */

import { difference, intersection, union, xor } from 'polyclip-ts';

import { formAngaben, setzeAttributAn, stilMit } from './formen';
import type { Punkt, Zug } from './formen-geometrie';
import { pfadImRechteck, strichImStil } from './formen-pfad';
import { htmlMitLage, istGestaltung, leseLage } from './gestaltung';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { attribut, einrueckung, entferne, quelleVon, setzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';
import { bildePfad, inPolygon, liesPfad, ringZuZug, umschliessendesRechteck } from './vektor';

type Ring = [number, number][];
type Poly = Ring[];
type MultiPoly = Poly[];

export type KombiArt = 'vereinen' | 'abziehen' | 'schneiden' | 'ausschliessen';

/** Abweichung der Sehnen von den Kurven beim Zerlegen, in px. */
const TOLERANZ = 0.25;
/** Abweichung beim Glätten der Ringe zurück zu Kurven, in px. */
const GLAETTEN = 0.5;
/** Kleinere Flächen (px²) sind Splitter und fallen weg. */
const SPLITTER = 1;
/** Mehr Formen nimmt die Schere nicht (Bereiche wachsen schnell). */
export const SCHERE_HOECHSTENS = 8;
/** Nur für die Dauer einer Rechnung: findet die neuen Pfade wieder. */
const MARKE = 'data-kombi-schritt';
/** Attribute der Formen, die keine Parameter sind (107, 104), aber zur alten Form gehören. */
const ALTE_EXTRAS = ['data-zipfel', 'data-punkte'];

// ── Lesen ───────────────────────────────────────────────────────────────────

/** Darf diese Form mitmachen? Nur Formen ohne Text und eigene Pfade (104, 116). */
export const istKombinierbar = (k: Knoten | null | undefined) => {
	const a = k && istGestaltung(k) ? formAngaben(k) : null;
	return Boolean(a?.pfad && (a.form.klasse === 'ohne-text' || a.form.klasse === 'pfad'));
};

/** Warum die Auswahl nicht kombiniert werden kann; `null`, wenn sie es kann. */
export const kombiGrund = (quelle: string, nrn: readonly number[]): string | null => {
	const z = zerlege(quelle);
	const knoten = [...new Set(nrn)].map((nr) => z.knoten[nr]);
	if (knoten.length < 2) {
		return 'Wähle mindestens zwei Formen.';
	}
	if (!knoten.every(istKombinierbar)) {
		return 'Nur Formen ohne Text lassen sich kombinieren.';
	}
	const eltern = knoten[0]?.eltern ?? null;
	if (!knoten.every((k) => k?.eltern === eltern)) {
		return 'Nur Formen derselben Ebene lassen sich kombinieren.';
	}
	return null;
};

const zahlen = (wert: string | null | undefined) =>
	(wert ?? '')
		.trim()
		.split(/[\s,]+/)
		.map(Number);

const rund = (n: number) => Math.round(n * 1000) / 1000;

/** Gespiegelt und gedreht um die Mitte, verschoben an `--x`/`--y`. */
const umDieMitte = (lage: ReturnType<typeof leseLage>, b: number, h: number) => {
	const spiegeln = (lage.spiegeln ?? 1) < 0 ? -1 : 1;
	const w = ((lage.drehen ?? 0) * Math.PI) / 180;
	const cos = Math.cos(w);
	const sin = Math.sin(w);
	const mx = (lage.x ?? 0) + b / 2;
	const my = (lage.y ?? 0) + h / 2;
	return (p: Punkt) => {
		const dx = (p.x - b / 2) * spiegeln;
		const dy = p.y - h / 2;
		// Auf 1/1000 px: Sonst trennen Rechenreste Kanten, die genau aneinanderstoßen.
		return { x: rund(mx + dx * cos - dy * sin), y: rund(my + dx * sin + dy * cos) };
	};
};

/**
 * Die Form `nr` als Polygone in Koordinaten des Elternteils (wie `--x`, `--y`): `d` aus der `viewBox` auf die Größe
 * gestreckt, dann gespiegelt und gedreht um die Mitte, wie `blatt.css` es zeichnet (`rotate() scaleX()`).
 */
export const alsPolygon = (quelle: string, nr: number): Punkt[][] => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const a = k ? formAngaben(k) : null;
	const zuege = a?.pfad ? liesPfad(attribut(a.pfad, 'd')?.wert ?? '') : null;
	if (!k || !a || !zuege) {
		return [];
	}
	const lage = leseLage(quelle, nr);
	const [vx = 0, vy = 0, vb = 0, vh = 0] = zahlen(attribut(k, 'viewbox')?.wert);
	const b = lage.b ?? a.groesse?.b ?? vb;
	const h = lage.h ?? a.groesse?.h ?? vh;
	// Der Strich liegt innen (104): Die Punkte werden auf den Außenrand gestreckt, damit Formen, die sich am Rand berühren,
	// auch als Flächen aneinanderstoßen. `pfadAus` nimmt das am Ende zurück.
	const r = strichImStil(a.stil) / 2;
	const ib = Math.max(1, b - 2 * r);
	const ih = Math.max(1, h - 2 * r);
	const sx = vb > 0 ? b / vb : 1;
	const sy = vh > 0 ? h / vh : 1;
	const aussen = (p: Punkt) => ({ x: ((p.x - vx) * sx - r) * (b / ib), y: ((p.y - vy) * sy - r) * (h / ih) });
	const lege = umDieMitte(lage, b, h);
	return inPolygon(zuege, TOLERANZ / Math.max(sx, sy, 1e-6)).map((ring) => ring.map((roh) => lege(aussen(roh))));
};

const alsRing = (punkte: readonly Punkt[]): Ring => {
	const ring = punkte.map((p): [number, number] => [p.x, p.y]);
	const erster = ring[0];
	return erster ? [...ring, [erster[0], erster[1]]] : ring;
};

/** Die Fläche einer Form; mehrere Teilpfade gelten wie `evenodd` (ein Loch bleibt ein Loch). */
const flaecheVon = (quelle: string, nr: number): MultiPoly => {
	const ringe = alsPolygon(quelle, nr).map(alsRing);
	const [erster, ...rest] = ringe;
	if (!erster) {
		return [];
	}
	return rest.length === 0 ? union([erster]) : xor([erster], ...rest.map((r): Poly => [r]));
};

// ── Rechnen ─────────────────────────────────────────────────────────────────

const ringFlaeche = (ring: Ring) => {
	let s = 0;
	for (let i = 0; i < ring.length - 1; i += 1) {
		const [x1, y1] = ring[i] ?? [0, 0];
		const [x2, y2] = ring[i + 1] ?? [0, 0];
		s += x1 * y2 - x2 * y1;
	}
	return Math.abs(s) / 2;
};

const polyFlaeche = ([aussen, ...loecher]: Poly) =>
	(aussen ? ringFlaeche(aussen) : 0) - loecher.reduce((s, r) => s + ringFlaeche(r), 0);

const ohneSplitter = (mp: MultiPoly): MultiPoly => mp.filter((p) => polyFlaeche(p) >= SPLITTER);

/** Liegt `p` in der Fläche (gerade-ungerade über alle Ringe)? */
export const liegtIn = (poly: Poly, p: Punkt) => {
	let drin = false;
	for (const ring of poly) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
			const [xi, yi] = ring[i] ?? [0, 0];
			const [xj, yj] = ring[j] ?? [0, 0];
			const iUeber = yi > p.y;
			const jUeber = yj > p.y;
			if (iUeber !== jUeber && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
				drin = !drin;
			}
		}
	}
	return drin;
};

const verknuepfe = (art: KombiArt, [erste, ...weitere]: readonly MultiPoly[]): MultiPoly => {
	if (!erste) {
		return [];
	}
	if (weitere.length === 0) {
		return erste;
	}
	switch (art) {
		case 'vereinen':
			return union(erste, ...weitere);
		case 'abziehen':
			return difference(erste, ...weitere);
		case 'schneiden':
			return intersection(erste, ...weitere);
		case 'ausschliessen':
			return xor(erste, ...weitere);
	}
};

/** Jeder Ring als geschlossener Zug: Kurven, wo es rund war, Ecken, wo es spitz war. */
const zuegeAus = (mp: MultiPoly): Zug[] =>
	mp.flatMap((poly) =>
		poly.map((ring) =>
			ringZuZug(
				ring.map(([x, y]) => ({ x, y })),
				GLAETTEN,
			),
		),
	);

// ── Schreiben ───────────────────────────────────────────────────────────────

/** Zurück vom Außenrand: das Rechteck um die Züge um `r` nach innen (Gegenstück zu `aussen` in `alsPolygon`). */
const nachInnen = (zuege: readonly Zug[], r: number) => {
	const u = umschliessendesRechteck(zuege);
	if (r <= 0 || u.b <= 2 * r || u.h <= 2 * r) {
		return [...zuege];
	}
	const fx = (u.b - 2 * r) / u.b;
	const fy = (u.h - 2 * r) / u.h;
	return bildePfad(zuege, (p) => ({ x: u.x + r + (p.x - u.x) * fx, y: u.y + r + (p.y - u.y) * fy }));
};

/**
 * Macht aus dem HTML einer Form (Vorlage für das Aussehen: Füllung, Kontur, Verlauf, Schatten, Deckkraft, Name) einen
 * freien Pfad mit der Fläche `mp`, ohne Drehung und Spiegelung. `null`, wenn die Vorlage keine Form ist.
 */
const pfadAus = (vorlage: string, mp: MultiPoly, marke: number) => {
	const z = zerlege(vorlage);
	const k = z.wurzeln[0];
	const a = k ? formAngaben(k) : null;
	if (!k || !a?.pfad) {
		return null;
	}
	const strich = strichImStil(a.stil);
	const r = pfadImRechteck(nachInnen(zuegeAus(mp), strich / 2), strich);
	const zuege = r.zuege;
	const loecher = zuege.length > 1;
	const stil = stilMit(a.stil, { 'fill-rule': loecher ? 'evenodd' : null }) ?? '';
	const weg = [...a.form.parameter.map((p) => p.attr), ...ALTE_EXTRAS];
	const aenderungen: Aenderung[] = [
		...setzeAttributAn(z, k, 'data-form', 'pfad'),
		...weg.flatMap((attr) => setzeAttributAn(z, k, attr, null)),
		...setzeAttributAn(z, k, 'viewBox', `0 0 ${r.b} ${r.h}`),
		...setzeAttributAn(z, k, MARKE, String(marke)),
		...setzeAttributAn(z, a.pfad, 'd', r.d),
		...setzeAttributAn(z, a.pfad, 'style', stil),
	];
	return htmlMitLage(wendeAn(vorlage, aenderungen), {
		x: r.versatz.x,
		y: r.versatz.y,
		b: r.b,
		h: r.h,
		drehen: null,
		spiegeln: null,
	});
};

interface Ausgang {
	/** Index der Form (hinten → vorne), deren Aussehen der Pfad bekommt. */
	vorlage: number;
	flaeche: MultiPoly;
}

/** Die Formen in Quellreihenfolge (hinten → vorne); wirft, wenn sie nicht kombiniert werden können. */
const formenVon = (quelle: string, nrn: readonly number[]) => {
	const grund = kombiGrund(quelle, nrn);
	if (grund) {
		throw new Error(grund);
	}
	const z = zerlege(quelle);
	return [...new Set(nrn)]
		.map((nr) => z.knoten[nr])
		.filter((k): k is Knoten => Boolean(k))
		.sort((a, b) => a.start - b.start);
};

/** Entfernt die Formen und setzt die neuen Pfade an die Stelle der vordersten; `nrn` sind die neuen Pfade. */
const ersetze = (quelle: string, z: Zerlegung, formen: readonly Knoten[], ausgaenge: readonly Ausgang[]) => {
	const vorderste = formen.at(-1);
	if (!vorderste) {
		return null;
	}
	const einzug = einrueckung(z, vorderste);
	const teile = ausgaenge.flatMap(({ flaeche, vorlage }, i) => {
		const k = formen[vorlage];
		const html = k ? pfadAus(quelleVon(z, k), flaeche, i) : null;
		return html ? [html] : [];
	});
	if (teile.length === 0) {
		return null;
	}
	const text = teile.join(einzug === null ? '' : `\n${einzug}`);
	const neu = wendeAn(quelle, [
		...formen.slice(0, -1).flatMap((k) => entferne(z, k)),
		{ von: vorderste.start, bis: vorderste.ende, text },
	]);
	const zn = zerlege(neu);
	const markiert = zn.knoten
		.filter((k) => attribut(k, MARKE))
		.sort((a, b) => Number(attribut(a, MARKE)?.wert) - Number(attribut(b, MARKE)?.wert));
	const ohneMarken = wendeAn(
		neu,
		markiert.flatMap((k) => setzeAttribut(zn, k, MARKE, null)),
	);
	return { quelle: ohneMarken, nr: markiert[0]?.nr ?? null, nrn: markiert.map((k) => k.nr) };
};

/**
 * Kombiniert die Formen `nrn` (121): Vereinen aller, Abziehen (die hinterste minus alle anderen), Schnitt aller,
 * Ausschluss (was in einer ungeraden Zahl liegt). Das Ergebnis ist ein Pfad an der Stelle der vordersten Form, mit ihrem
 * Aussehen; die Ausgangsformen fallen weg. `null`, wenn das Ergebnis leer wäre (dann ändert sich nichts).
 */
export const kombiniere = (quelle: string, nrn: readonly number[], art: KombiArt): StrukturErgebnis | null => {
	const formen = formenVon(quelle, nrn);
	const flaechen = formen.map((k) => flaecheVon(quelle, k.nr));
	const ergebnis = ohneSplitter(verknuepfe(art, flaechen));
	if (ergebnis.length === 0) {
		return null;
	}
	const r = ersetze(quelle, zerlege(quelle), formen, [{ vorlage: formen.length - 1, flaeche: ergebnis }]);
	return r ? { quelle: r.quelle, nr: r.nr } : null;
};

// ── Formen-Schere ───────────────────────────────────────────────────────────

/** Ein Bereich der Formen-Schere: eine zusammenhängende Fläche, in Koordinaten des Elternteils. */
export interface Bereich {
	id: number;
	flaeche: Poly;
	/** Die Formen (Index hinten → vorne), in denen der Bereich liegt. */
	in: readonly number[];
}

/**
 * Zerlegt die Formen in Bereiche: alle Flächen, die ihre Umrisse bilden. Mit der ersten Form beginnen; für jede weitere
 * Form B wird jeder Bereich R zu `R ∩ B` und `R − B`, dazu kommt `B − (alle bisherigen)`. Leere und Splitter fallen weg,
 * getrennte Stücke werden eigene Bereiche.
 */
export const bereiche = (quelle: string, nrn: readonly number[]): Bereich[] => {
	const formen = formenVon(quelle, nrn);
	const flaechen = formen.map((k) => flaecheVon(quelle, k.nr));
	let liste: { flaeche: MultiPoly; in: number[] }[] = [];
	flaechen.forEach((b, i) => {
		const bisher = flaechen.slice(0, i);
		const neu = liste.flatMap((r) => [
			{ flaeche: ohneSplitter(intersection(r.flaeche, b)), in: [...r.in, i] },
			{ flaeche: ohneSplitter(difference(r.flaeche, b)), in: r.in },
		]);
		const rest = bisher.length === 0 ? b : difference(b, union(bisher[0] ?? [], ...bisher.slice(1)));
		neu.push({ flaeche: ohneSplitter(rest), in: [i] });
		liste = neu.filter((r) => r.flaeche.length > 0);
	});
	return liste.flatMap((r) => r.flaeche.map((flaeche) => ({ flaeche, in: r.in }))).map((r, id) => ({ id, ...r }));
};

/** Bereit für die Schere: höchstens acht Formen, die sich irgendwo überlappen. Sonst der Grund. */
export const schereGrund = (quelle: string, nrn: readonly number[]): string | null => {
	const grund = kombiGrund(quelle, nrn);
	if (grund) {
		return grund;
	}
	if (new Set(nrn).size > SCHERE_HOECHSTENS) {
		return `Höchstens ${SCHERE_HOECHSTENS} Formen.`;
	}
	return bereiche(quelle, nrn).some((b) => b.in.length > 1) ? null : 'Die Formen überlappen sich nicht.';
};

/**
 * Ein Zug der Formen-Schere: Die Bereiche `ids` werden zu einer Form vereint (mit `entfernen` fallen sie weg), alle
 * übrigen Bereiche werden einzelne Formen. Jeder Bereich trägt das Aussehen der vordersten Form, in der er liegt.
 * `nrn` sind alle neuen Pfade; `null`, wenn kein Bereich markiert ist oder nichts übrig bliebe.
 */
export const wendeScherenzugAn = (
	quelle: string,
	nrn: readonly number[],
	ids: readonly number[],
	entfernen: boolean,
): (StrukturErgebnis & { nrn: number[] }) | null => {
	const formen = formenVon(quelle, nrn);
	const alle = bereiche(quelle, nrn);
	const markiert = alle.filter((b) => ids.includes(b.id));
	if (markiert.length === 0) {
		return null;
	}
	const vorderste = (liste: readonly Bereich[]) => Math.max(...liste.flatMap((b) => b.in));
	const ausgaenge: Ausgang[] = alle
		.filter((b) => !ids.includes(b.id))
		.map((b) => ({ vorlage: vorderste([b]), flaeche: [b.flaeche] }));
	if (!entfernen) {
		const [erster, ...rest] = markiert.map((b) => b.flaeche);
		const flaeche = erster ? ohneSplitter(union(erster, ...rest)) : [];
		ausgaenge.push({ vorlage: vorderste(markiert), flaeche });
	}
	if (ausgaenge.length === 0) {
		return null;
	}
	ausgaenge.sort((a, b) => a.vorlage - b.vorlage);
	return ersetze(quelle, zerlege(quelle), formen, ausgaenge);
};
