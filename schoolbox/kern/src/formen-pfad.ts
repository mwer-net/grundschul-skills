/**
 * Der freie Pfad (116): `svg.form[data-form="pfad"]`, `viewBox = 0 0 b h`, ein `path`, dessen `d` die Quelle ist (es
 * gibt keine Parameter). Der Strich liegt innen wie bei allen Formen: Die Punkte halten die halbe Strichstärke Abstand
 * zum Rand. Größe ändern streckt die Punkte (`skalierePfad`, eine Zeile in `groessen-folgen.ts`), der Strich bleibt.
 *
 * Darf `formen.ts` nur als Typ laden (es lädt diese Datei) und `gestaltung.ts` gar nicht (Ladekreis).
 */

import type { Form } from './formen';
import type { Zug } from './formen-geometrie';
import { zahl } from './formen-geometrie';
import type { Aenderung } from './quelltext';
import { attribut, schuetzeAttribut, wendeAn, zerlege } from './quelltext';
import { bildePfad, liesPfad, schreibePfad, umschliessendesRechteck } from './vektor';

/** Ein runder Klecks als Ersatz, wo eine Vorschau ohne eigenes `d` gezeichnet wird (Liste der Formen, Referenz). */
const klecks = (b: number, h: number, strich: number) => {
	const r = strich / 2;
	const x = (t: number) => zahl(r + t * Math.max(0, b - strich));
	const y = (t: number) => zahl(r + t * Math.max(0, h - strich));
	return (
		`M${x(0.5)} ${y(0)} C${x(0.85)} ${y(0)} ${x(1)} ${y(0.2)} ${x(1)} ${y(0.5)} ` +
		`C${x(1)} ${y(0.85)} ${x(0.75)} ${y(1)} ${x(0.45)} ${y(1)} ` +
		`C${x(0.15)} ${y(1)} ${x(0)} ${y(0.75)} ${x(0)} ${y(0.45)} ` +
		`C${x(0)} ${y(0.15)} ${x(0.2)} ${y(0)} ${x(0.5)} ${y(0)} Z`
	);
};

export const PFAD_FORMEN: readonly Form[] = [
	{
		art: 'pfad',
		name: 'Eigene Form',
		klasse: 'pfad',
		parameter: [],
		standardGroesse: { b: 120, h: 120 },
		zeichne: (_param, b, h, strich) => ({ viewBox: `0 0 ${b} ${h}`, d: klecks(b, h, strich) }),
	},
];

/** Strichstärke aus dem `style` des Pfads; ohne Kontur 0. */
export const strichImStil = (stil: string | null | undefined) => {
	const s = stil ?? '';
	if (/(?:^|;)\s*stroke\s*:\s*none/.test(s) || !/(?:^|;)\s*stroke\s*:/.test(s)) {
		return 0;
	}
	const w = Number.parseFloat(/(?:^|;)\s*stroke-width\s*:\s*([\d.]+)/.exec(s)?.[1] ?? '1');
	return Number.isFinite(w) ? w : 1;
};

/**
 * Streckt die Punkte von Größe `von` auf `nach`, mit festem Rand `r` (halbe Strichstärke): Was am Rand lag, bleibt am
 * Rand, der Strich wird nicht dicker.
 */
export const streckePfad = (
	zuege: readonly Zug[],
	von: { b: number; h: number },
	nach: { b: number; h: number },
	r: number,
) => {
	const achse = (v: number, alt: number, neu: number) =>
		alt - 2 * r > 0 ? r + ((v - r) * Math.max(0, neu - 2 * r)) / (alt - 2 * r) : neu / 2;
	return bildePfad(zuege, (p) => ({ x: achse(p.x, von.b, nach.b), y: achse(p.y, von.h, nach.h) }));
};

/**
 * Lage eines Pfads aus Punkten in irgendeinem Koordinatensystem: das Rechteck um die Kurven plus halbe Strichstärke,
 * auf ganze px. `versatz` ist, wo die linke obere Ecke des Elements im alten System liegt; `d` ist relativ dazu.
 */
export const pfadImRechteck = (zuege: readonly Zug[], strich: number) => {
	const u = umschliessendesRechteck(zuege);
	const r = strich / 2;
	const x = Math.floor(u.x - r);
	const y = Math.floor(u.y - r);
	const b = Math.max(1, Math.ceil(u.x + u.b + r) - x);
	const h = Math.max(1, Math.ceil(u.y + u.h + r) - y);
	const verschoben = bildePfad(zuege, (p) => ({ x: p.x - x, y: p.y - y }));
	return { versatz: { x, y }, b, h, d: schreibePfad(verschoben), zuege: verschoben };
};

/** Das `svg` eines neuen Pfads; die Lage setzt `legeGestaltungAb`. */
export const pfadHtml = ({ b, d, h, stil }: { d: string; b: number; h: number; stil: string }) =>
	`<svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 ${b} ${h}"><path d="${schuetzeAttribut(d)}" style="${schuetzeAttribut(stil)}"/></svg>`;

const pxIm = (stil: string, name: string) => {
	const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(-?[\\d.]+)px`).exec(stil);
	const n = m ? Number.parseFloat(m[1] ?? '') : Number.NaN;
	return Number.isFinite(n) ? n : null;
};

/** Ändert `d` und `viewBox` des Pfads `nr` (für `skalierePfad` und `pfad-aendern.ts`). */
export const pfadAenderungen = (quelle: string, nr: number, d: string, b: number, h: number): Aenderung[] => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const pfad = k?.kinder.find((c) => c.tag === 'path');
	if (!k || !pfad) {
		return [];
	}
	const box = attribut(k, 'viewbox');
	const vb = `viewBox="0 0 ${zahl(b)} ${zahl(h)}"`;
	const dAlt = attribut(pfad, 'd');
	const aenderungen: Aenderung[] = [];
	if (box) {
		aenderungen.push({ von: box.start, bis: box.ende, text: vb });
	} else {
		const tag = quelle.slice(k.start, k.oeffnerEnde);
		const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
		aenderungen.push({ von: pos, bis: pos, text: ` ${vb}` });
	}
	if (dAlt) {
		aenderungen.push({ von: dAlt.start, bis: dAlt.ende, text: `d="${schuetzeAttribut(d)}"` });
	}
	return aenderungen;
};

/** `viewBox` und `d` des Pfads `nr`, gelesen; `null`, wenn es kein lesbarer Pfad ist. */
export const lesePfadForm = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k || k.tag !== 'svg' || attribut(k, 'data-form')?.wert !== 'pfad') {
		return null;
	}
	const pfad = k.kinder.find((c) => c.tag === 'path');
	const d = attribut(pfad ?? k, 'd')?.wert ?? '';
	const zuege = pfad ? liesPfad(d) : null;
	const [, , b = Number.NaN, h = Number.NaN] = (attribut(k, 'viewbox')?.wert ?? '').trim().split(/[\s,]+/).map(Number);
	if (!pfad || !zuege) {
		return null;
	}
	return {
		d,
		zuege,
		viewBox: Number.isFinite(b) && Number.isFinite(h) ? { b, h } : null,
		strich: strichImStil(attribut(pfad, 'style')?.wert),
		stil: attribut(k, 'style')?.wert ?? '',
	};
};

/**
 * Größenfolge (`groessen-folgen.ts`): Hat sich `--b`/`--h` gegenüber dem `viewBox` geändert, streckt sie die Punkte.
 * `zeichneFormNeu` lässt Pfade aus, ihr `d` ist die Quelle.
 */
export const skalierePfad = (quelle: string, nr: number) => {
	const a = lesePfadForm(quelle, nr);
	if (!a?.viewBox) {
		return quelle;
	}
	const b = pxIm(a.stil, '--b');
	const h = pxIm(a.stil, '--h');
	if (b === null || h === null || (a.viewBox.b === b && a.viewBox.h === h)) {
		return quelle;
	}
	const d = schreibePfad(streckePfad(a.zuege, a.viewBox, { b, h }, a.strich / 2));
	return wendeAn(quelle, pfadAenderungen(quelle, nr, d, b, h));
};
