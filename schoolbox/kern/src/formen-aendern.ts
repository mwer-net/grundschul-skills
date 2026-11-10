/**
 * Umformungen an Formen (104): ablegen, Parameter, Form wechseln, Füllung und Kontur, fehlende Pfade ergänzen. Jede
 * ist eine reine Umformung der Quelle und am Ende ein Schritt im Verlauf. Nach jeder Änderung, die die Geometrie
 * betrifft, stehen `viewBox` und `d` wieder passend da (`zeichneFormNeu`).
 */

import { entferneVerlauf, konturStilNeu } from './aussehen';
import type { Kontur } from './formen';
import {
	formAngaben,
	formHtml,
	formVon,
	fuellungAus,
	fuellungStandard,
	KONTUR,
	KONTUR_MAX,
	konturAus,
	parameterText,
	pfadStil,
	setzeAttributAn,
	standardWerte,
	stilMit,
	stilWert,
	STRICH,
	strichAus,
	vollstaendig,
	zeichneFormNeu,
} from './formen';
import type { Punkt } from './formen-geometrie';
import { zahl } from './formen-geometrie';
import type { Ende } from './formen-linie';
import { ENDEN, linieAus, LINIEN_GROESSE, linienPunkte, punkteText, standardPunkte } from './formen-linie';
import type { BlasenArt } from './formen-text';
import { BLASEN, BLASEN_GROESSE, blasenSchrift, standardZipfel, zipfelText } from './formen-text';
import type { LageTeil } from './gestaltung';
import { legeGestaltungAb, setzeLage, stilMitLage } from './gestaltung';
import type { Knoten, Zerlegung } from './quelltext';
import { attribut, fuegeInnenEin, wendeAn, zerlege } from './quelltext';

export interface FormAblegen {
	/** Nummer der `.seite` in der Quelle. */
	seite: number;
	art: string;
	param?: Readonly<Record<string, number>>;
	/** Ohne `b`, `h` die Standardgröße der Form. */
	lage?: LageTeil;
	fuellung?: string | null;
	kontur?: Kontur | null;
}

/** Legt eine neue Form ganz nach vorne in ihre Ebene; Größe ohne Angabe 120 × 120. */
export const legeForm = (quelle: string, { art, fuellung, kontur, lage = {}, param, seite }: FormAblegen) => {
	const form = formVon(art);
	if (!form) {
		throw new Error(`Die Form „${art}“ gibt es nicht.`);
	}
	const b = lage.b ?? form.standardGroesse.b;
	const h = lage.h ?? form.standardGroesse.h;
	const html = formHtml({
		art,
		b,
		h,
		...(form.klasse === 'linie' ? { attribute: { 'data-punkte': punkteText(...linienPunkte({}, b, h)) } } : {}),
		...(param ? { param } : {}),
		...(fuellung === undefined ? {} : { fuellung }),
		...(kontur === undefined ? {} : { kontur }),
	});
	return legeGestaltungAb(quelle, { seite, html, lage: { ...lage, b, h } });
};

const formAn = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const a = k ? formAngaben(k) : null;
	if (!k || !a) {
		throw new Error(`Das Element ${nr} ist keine Form.`);
	}
	return { z, k, a };
};

/** Setzt Parameter (in ihren Bereich gebracht) und zeichnet neu. */
export const setzeFormParameter = (quelle: string, nr: number, teil: Readonly<Record<string, number>>) => {
	const { a, k, z } = formAn(quelle, nr);
	const werte = vollstaendig(a.form, (attr) => teil[attr] ?? a.param[attr]);
	const aenderungen = a.form.parameter
		.filter((p) => p.attr in teil && attribut(k, p.attr)?.wert !== parameterText(p, werte[p.attr] ?? p.standard))
		.flatMap((p) => setzeAttributAn(z, k, p.attr, parameterText(p, werte[p.attr] ?? p.standard)));
	return aenderungen.length ? zeichneFormNeu(wendeAn(quelle, aenderungen), nr) : quelle;
};

/**
 * Wechselt die Form innerhalb derselben Klasse (3-formen.md). Die Parameter der alten Form fallen weg, die neue
 * bekommt ihre Standards; Füllung, Kontur und Lage bleiben.
 */
export const wechsleForm = (quelle: string, nr: number, art: string) => {
	const { a, k, z } = formAn(quelle, nr);
	const neu = formVon(art);
	if (!neu) {
		throw new Error(`Die Form „${art}“ gibt es nicht.`);
	}
	if (neu.klasse !== a.form.klasse) {
		throw new Error(`${a.form.name} lässt sich nicht in ${neu.name} wechseln.`);
	}
	if (neu === a.form) {
		return quelle;
	}
	const standard = standardWerte(neu);
	const weg = a.form.parameter.filter((p) => !neu.parameter.some((n) => n.attr === p.attr));
	const aenderungen = [
		...setzeAttributAn(z, k, 'data-form', art),
		...weg.flatMap((p) => setzeAttributAn(z, k, p.attr, null)),
		...neu.parameter.flatMap((p) =>
			setzeAttributAn(z, k, p.attr, parameterText(p, standard[p.attr] ?? p.standard)),
		),
	];
	return zeichneFormNeu(wendeAn(quelle, aenderungen), nr);
};

const setzePfadStil = (quelle: string, nr: number, werte: Readonly<Record<string, string | null>>) => {
	const { a, z } = formAn(quelle, nr);
	if (!a.pfad) {
		return quelle;
	}
	const neu = stilMit(a.stil, werte);
	return neu === a.stil ? quelle : wendeAn(quelle, setzeAttributAn(z, a.pfad, 'style', neu));
};

/** `var(--haupt)` …, Hex oder `null` (keine Füllung). */
export const setzeFuellung = (quelle: string, nr: number, farbe: string | null) =>
	setzePfadStil(entferneVerlauf(quelle, nr), nr, { fill: farbe ?? 'none' }); // 108: einfarbig ersetzt den Verlauf

/** Farbe und Stärke 0–12 px oder `null` (keine Kontur). Der Strich liegt innen, darum wird neu gezeichnet. */
export const setzeKontur = (quelle: string, nr: number, kontur: Kontur | null) => {
	const staerke = kontur ? Math.max(0, Math.min(KONTUR_MAX, Math.round(kontur.staerke * 10) / 10)) : 0;
	const werte: Record<string, string | null> =
		kontur && staerke > 0
			? { 'stroke': kontur.farbe, 'stroke-width': `${zahl(staerke)}px`, 'stroke-linejoin': 'round' }
			: { 'stroke': 'none', 'stroke-width': null };
	return konturStilNeu(zeichneFormNeu(setzePfadStil(quelle, nr, werte), nr), nr); // 108: Kontur-Stil folgt der Stärke
};

export interface FormStand {
	art: string;
	param: Readonly<Record<string, number>>;
	fuellung: string | null;
	kontur: Kontur | null;
}

/** Was Inspektor und Leiste zeigen. `null`, wenn `nr` keine Form der Liste ist. */
export const leseForm = (quelle: string, nr: number): FormStand | null => {
	const k = zerlege(quelle).knoten[nr];
	const a = k ? formAngaben(k) : null;
	if (!a) {
		return null;
	}
	return { art: a.form.art, param: a.param, fuellung: fuellungAus(a.stil), kontur: konturAus(a.stil) };
};

// ── Fehlende Pfade (Claude, 4.4) ────────────────────────────────────────────

/** Was an einer Form fehlt, eins nach dem anderen; `null`, wenn alles da ist. */
/** Kinder, die nichts zeichnen. */
const NUR_BEIWERK = new Set(['defs', 'title', 'desc']);

const ergaenzeEins = (z: Zerlegung, k: Knoten): string | null => {
	const a = formAngaben(k);
	if (!a) {
		return null;
	}
	const { quelle } = z;
	if (!a.groesse) {
		const stil = attribut(k, 'style')?.wert ?? null;
		const da = (name: string) => stilWert(stil, name) !== null;
		const neu = stilMitLage(stil, {
			...(da('--b') ? {} : { b: a.form.standardGroesse.b }),
			...(da('--h') ? {} : { h: a.form.standardGroesse.h }),
		});
		return neu === stil ? null : wendeAn(quelle, setzeAttributAn(z, k, 'style', neu));
	}
	const { b, h } = a.groesse;
	if (!a.pfad) {
		const { d } = a.form.zeichne(a.param, b, h, STRICH);
		const grund = pfadStil(fuellungStandard(a.form), { farbe: KONTUR, staerke: STRICH });
		const stil = a.form.klasse === 'linie' ? (stilMit(grund, { 'stroke-linecap': 'round' }) ?? grund) : grund;
		const pfad = `<path d="${d}" style="${stil}"/>`;
		// 107: Fehlt der Form mit Text das `svg`, kommt es samt Pfad vor den Text.
		if (!a.svg) {
			return zeichneFormNeu(
				wendeAn(
					quelle,
					fuegeInnenEin(z, k, 'anfang', `<svg viewBox="0 0 ${b} ${h}" aria-hidden="true">${pfad}</svg>`),
				),
				k.nr,
			);
		}
		const svg = a.svg;
		// Zeichnet die Form schon selbst (etwa `<rect>`), bleibt sie, wie sie ist; nur eine leere Form bekommt den Pfad.
		if (svg.kinder.some((kind) => !NUR_BEIWERK.has(kind.tag))) {
			return null;
		}
		const tag = quelle.slice(svg.start, svg.oeffnerEnde);
		if (svg.oeffnerEnde === svg.ende && tag.endsWith('/>')) {
			return zeichneFormNeu(
				wendeAn(quelle, [
					{ von: svg.start, bis: svg.ende, text: `${tag.replace(/\s*\/>$/, '>')}${pfad}</svg>` },
				]),
				k.nr,
			);
		}
		// 107: zeichneFormNeu ergänzt viewBox und die Spitzen der Linie.
		return zeichneFormNeu(wendeAn(quelle, fuegeInnenEin(z, svg, 'ende', pfad)), k.nr);
	}
	if (attribut(a.pfad, 'd')?.wert?.trim()) {
		return a.svg && !attribut(a.svg, 'viewbox')
			? wendeAn(quelle, setzeAttributAn(z, a.svg, 'viewBox', `0 0 ${b} ${h}`))
			: null;
	}
	const neu = zeichneFormNeu(quelle, k.nr);
	return neu === quelle ? null : neu;
};

/**
 * Claude darf bei Formen den Pfad weglassen (4.4): Fehlen `--b`/`--h`, `viewBox`, der Pfad oder sein `d`, entsteht es
 * aus den Parametern. Ein vorhandenes `d` bleibt, wie es ist. Ohne Formen kommt die Quelle Zeichen für Zeichen zurück.
 */
export const ergaenzeFormen = (quelle: string) => {
	if (!quelle.includes('data-form')) {
		return quelle;
	}
	let jetzt = quelle;
	// Jede Form braucht höchstens drei Schritte (Größe, Pfad bzw. d, viewBox); die Grenze schützt vor einer Schleife.
	for (let runde = 0; runde < 1000; runde += 1) {
		const z = zerlege(jetzt);
		let neu: string | null = null;
		for (const k of z.knoten) {
			neu = ergaenzeEins(z, k);
			if (neu !== null) {
				break;
			}
		}
		if (neu === null) {
			return jetzt;
		}
		jetzt = neu;
	}
	return jetzt;
};

// ── 107: Linie und Zipfel ───────────────────────────────────────────────────

/**
 * Setzt die Linie `nr` von `a` nach `b` (Koordinaten der Seite, wie `--x`): Rechteck, `data-punkte`, Pfad und
 * Spitzen neu. Ein Schritt für Werkzeug L und die Endpunkt-Griffe.
 */
export const setzeLinie = (quelle: string, nr: number, a: Punkt, b: Punkt) => {
	const { a: angaben } = formAn(quelle, nr);
	if (angaben.form.klasse !== 'linie') {
		throw new Error(`Das Element ${nr} ist keine Linie.`);
	}
	const { lage, punkte } = linieAus(a, b, strichAus(angaben.stil));
	const mitLage = setzeLage(quelle, nr, lage);
	const { k, z } = formAn(mitLage, nr);
	const neu =
		attribut(k, 'data-punkte')?.wert === punkte
			? mitLage
			: wendeAn(mitLage, setzeAttributAn(z, k, 'data-punkte', punkte));
	return zeichneFormNeu(neu, nr);
};

/** Setzt die Spitze des Zipfels der Sprechblase `nr` (px relativ zur linken oberen Ecke vor dem Drehen). */
export const setzeZipfel = (quelle: string, nr: number, spitze: Punkt) => {
	const { k, z } = formAn(quelle, nr);
	const text = zipfelText({ x: Math.round(spitze.x), y: Math.round(spitze.y) });
	return attribut(k, 'data-zipfel')?.wert === text
		? quelle
		: zeichneFormNeu(wendeAn(quelle, setzeAttributAn(z, k, 'data-zipfel', text)), nr);
};

export interface FormMitTextAblegen {
	seite: number;
	art: 'sprechblase' | 'band';
	/** `data-blase` bei der Sprechblase. */
	blase?: BlasenArt;
	text?: string;
	/** `--fs` des Blatts: `--gr` ist mindestens das, mindestens 22 px. */
	fs?: number;
	lage?: LageTeil;
}

/** Das HTML einer neuen Form mit Text in Standardgröße: weiß, Kontur dunkel, Zipfel links unten, Text mittig. */
export const formMitTextHtml = ({ art, blase, fs, text }: Omit<FormMitTextAblegen, 'seite' | 'lage'>) => {
	const { b, h } = BLASEN_GROESSE;
	return formHtml({
		art,
		b,
		h,
		...(art === 'sprechblase'
			? {
					param: {
						'data-blase': Math.max(
							0,
							BLASEN.findIndex((w) => w.wert === (blase ?? 'rund')),
						),
					},
					attribute: { 'data-zipfel': zipfelText(standardZipfel(b, h)) },
				}
			: {}),
		text: text ?? 'Text',
		stil: `--gr:${blasenSchrift(fs)}px;--ausrichtung:center`,
	});
};

/** Legt eine Form mit Text ganz nach vorne in die Ebene `vorne`; ein Schritt, danach gewählt. */
export const legeFormMitText = (quelle: string, { lage = {}, seite, ...neu }: FormMitTextAblegen) =>
	legeGestaltungAb(quelle, { seite, html: formMitTextHtml(neu), lage: { ...BLASEN_GROESSE, ...lage } });

/** Das HTML einer neuen Linie in Standardgröße; mit `ende: 'pfeil'` ein Pfeil. */
export const linieHtml = ({
	anfang,
	ende,
	groesse,
	punkte,
}: { anfang?: Ende; ende?: Ende; punkte?: string; groesse?: { b: number; h: number } } = {}) => {
	const index = (e: Ende | undefined) =>
		Math.max(
			0,
			ENDEN.findIndex((w) => w.wert === (e ?? 'keine')),
		);
	const { b, h } = groesse ?? LINIEN_GROESSE;
	return formHtml({
		art: 'linie',
		b,
		h,
		param: { 'data-anfang': index(anfang), 'data-ende': index(ende) },
		attribute: { 'data-punkte': punkte ?? standardPunkte() },
	});
};
