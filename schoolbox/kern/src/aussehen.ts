/**
 * Aussehen eines Gestaltungselements (108, Briefing 3-formen „Füllung und Kontur“, Spalte E3): Verlauf in der Füllung,
 * Kontur-Stil und Enden, Schatten, Deckkraft. Jede Funktion ist eine reine Umformung der Quelle und am Ende ein Schritt
 * im Verlauf. Welche Art was kann, steht in `KANN`; sonst gibt es einen Fehler wie bei den anderen Umformungen.
 *
 * - **Verlauf** (3.9, 3.11): `<defs>` mit `<linearGradient>` bzw. `<radialGradient>` im `svg` der Form, Id
 *   `verlauf-xxxx` aus `neueId`. Der Pfad verweist als **Attribut** darauf (`fill="url(#verlauf-xxxx)"`): Die Allow-Liste
 *   (`frei.ts`) lässt `url(#…)` nur als Attribut zu. `fill` im `style` des Pfads fällt dafür weg, sonst gewönne er.
 * - **Kontur-Stil**: `data-kontur-stil`, `data-kontur-enden` am Element; daraus `stroke-dasharray` und `stroke-linecap`
 *   im `style` des Pfads, relativ zur Strichstärke (`konturStilNeu`, auch aus `setzeKontur`).
 * - **Schatten**: `data-schatten`, die Regeln stehen in `blatt.css` (Marke 108).
 * - **Deckkraft**: `opacity` im `style` des Elements.
 */

import { pfadVon, setzeAttributAn, stilMit, stilWert, strichAus } from './formen';
import { zahl } from './formen-geometrie';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import { istGestaltung, neueId, setzeStilWerte } from './gestaltung';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { attribut, entferne, fuegeInnenEin, quelleVon, schuetzeAttribut, wendeAn, zerlege } from './quelltext';
import { passt } from './referenz';

// ── Was für welche Art gilt ─────────────────────────────────────────────────

export type AussehenTeil = 'verlauf' | 'kontur-stil' | 'schatten' | 'deckkraft';

/** Tabelle „Wofür was gilt“ (108). Deckkraft: jede Art mit `lage`, darum hier nicht aufgezählt. */
const KANN: Record<Exclude<AussehenTeil, 'deckkraft'>, ReadonlySet<string>> = {
	'verlauf': new Set(['form', 'formtext']),
	'kontur-stil': new Set(['form', 'formtext']),
	'schatten': new Set(['form', 'formtext', 'schmuck', 'bildfrei', 'figurfrei']),
};

/** Ob eine Art diesen Teil des Aussehens hat; für Inspektor und Leiste. */
export const kannAussehen = (art: string, teil: AussehenTeil) =>
	teil === 'deckkraft'
		? GESTALTUNG_ARTEN.some((a) => a.art === art && a.faehigkeiten.includes('lage'))
		: KANN[teil].has(art);

/** Die Art eines Gestaltungselements aus dem Register (die erste passende, der Rückfall `gestaltung` zuletzt). */
const artVon = (k: Knoten) =>
	GESTALTUNG_ARTEN.find((a) => a.faehigkeiten.includes('lage') && passt(k, a.selektor, false))?.art ?? null;

const KEIN: Record<AussehenTeil, string> = {
	'verlauf': 'keinen Verlauf',
	'kontur-stil': 'keinen Kontur-Stil',
	'schatten': 'keinen Schatten',
	'deckkraft': 'keine Deckkraft',
};

/** Das Element `nr`, wenn es Gestaltung ist und seine Art `teil` kann; sonst ein Fehler. */
const elementFuer = (z: Zerlegung, nr: number, teil: AussehenTeil) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	const art = istGestaltung(k) ? artVon(k) : null;
	if (!art || !kannAussehen(art, teil)) {
		throw new Error(`Das Element ${nr} hat ${KEIN[teil]}.`);
	}
	return k;
};

/** Das `svg`, das zeichnet: die Form selbst, bei Form mit Text das erste `svg` darin. */
const svgVon = (k: Knoten): Knoten | null => {
	if (k.tag === 'svg') {
		return k;
	}
	for (const kind of k.kinder) {
		const svg = svgVon(kind);
		if (svg) {
			return svg;
		}
	}
	return null;
};

const pfadIn = (k: Knoten) => {
	const svg = svgVon(k);
	return svg ? pfadVon(svg) : null;
};

// ── Verlauf ─────────────────────────────────────────────────────────────────

export type VerlaufArt = 'linear' | 'radial';

export interface Verlauf {
	art: VerlaufArt;
	/** Farben wie bei der Füllung: `var(--haupt)` …, Hex. */
	f1: string;
	f2: string;
	/** Grad, 0 = von links nach rechts, im Uhrzeigersinn; nur linear. */
	winkel: number;
}

const SPRUNG = /^url\(\s*#([A-Za-z][\w-]*)\s*\)$/;

/** Der Verlauf, auf den der Pfad verweist, samt Knoten; `null` ohne Verweis oder ohne passendes Element im `svg`. */
const verlaufAn = (k: Knoten) => {
	const svg = svgVon(k);
	const pfad = svg ? pfadVon(svg) : null;
	const id = SPRUNG.exec((pfad ? attribut(pfad, 'fill')?.wert : null)?.trim() ?? '')?.[1];
	if (!svg || !pfad || !id) {
		return null;
	}
	const suche = (n: Knoten): Knoten | null =>
		(['lineargradient', 'radialgradient'].includes(n.tag) && attribut(n, 'id')?.wert === id
			? n
			: null) ?? n.kinder.reduce<Knoten | null>((f, c) => f ?? suche(c), null);
	const verlauf = suche(svg);
	return verlauf ? { svg, pfad, id, verlauf } : null;
};

const stopFarbe = (stop: Knoten | undefined) =>
	(stop && (stilWert(attribut(stop, 'style')?.wert ?? null, 'stop-color') ?? attribut(stop, 'stop-color')?.wert)) ||
	'#000000';

/** Winkel in ganzen Grad, 0–359. */
const imKreis = (winkel: number) => ((Math.round(winkel) % 360) + 360) % 360;

const verlaufHtml = (id: string, { art, f1, f2, winkel }: Verlauf) => {
	const stops =
		`<stop offset="0" style="stop-color:${schuetzeAttribut(f1)}"/>` +
		`<stop offset="1" style="stop-color:${schuetzeAttribut(f2)}"/>`;
	if (art === 'radial') {
		return `<radialGradient id="${id}">${stops}</radialGradient>`;
	}
	const w = imKreis(winkel);
	const drehung = w === 0 ? '' : ` gradientTransform="rotate(${w} .5 .5)"`;
	return `<linearGradient id="${id}"${drehung}>${stops}</linearGradient>`;
};

/** Was der Verlauf des Elements ist; `null` ohne Verlauf. */
export const leseVerlauf = (quelle: string, nr: number): Verlauf | null => {
	const k = zerlege(quelle).knoten[nr];
	const v = k ? verlaufAn(k) : null;
	if (!v) {
		return null;
	}
	const stops = v.verlauf.kinder.filter((c) => c.tag === 'stop');
	const drehung = /rotate\(\s*(-?[\d.]+)/.exec(attribut(v.verlauf, 'gradienttransform')?.wert ?? '');
	return {
		art: v.verlauf.tag === 'radialgradient' ? 'radial' : 'linear',
		f1: stopFarbe(stops[0]),
		f2: stopFarbe(stops.at(-1)),
		winkel: drehung ? imKreis(Number(drehung[1])) : 0,
	};
};

/**
 * Entfernt den Verlauf samt leer gewordenem `<defs>`. Die Füllung wird die erste Farbe des Verlaufs, damit die Form
 * nicht schwarz wird; `setzeFuellung` (104) setzt gleich danach die gewählte Farbe. Ohne Verlauf bleibt die Quelle.
 */
export const entferneVerlauf = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const v = k ? verlaufAn(k) : null;
	if (!v) {
		return quelle;
	}
	const f1 = leseVerlauf(quelle, nr)?.f1 ?? null;
	const defs = v.verlauf.eltern;
	const weg: Aenderung[] =
		defs && defs.tag === 'defs' && defs.kinder.length === 1 ? entferne(z, defs) : entferne(z, v.verlauf);
	const stil = attribut(v.pfad, 'style')?.wert ?? null;
	const aenderungen = [
		...setzeAttributAn(z, v.pfad, 'fill', null),
		...(stilWert(stil, 'fill') === null && f1 ? setzeAttributAn(z, v.pfad, 'style', stilMit(stil, { fill: f1 }) ?? '') : []),
		...weg,
	];
	return wendeAn(quelle, aenderungen);
};

/**
 * Setzt den Verlauf der Füllung oder ändert ihn (Art, Farben, Winkel); die Id bleibt dabei. `null` entfernt ihn. Nur
 * `form` und `formtext`; ohne Pfad kommt die Quelle unverändert zurück.
 */
export const setzeVerlauf = (quelle: string, nr: number, verlauf: Verlauf | null) => {
	const z = zerlege(quelle);
	const k = elementFuer(z, nr, 'verlauf');
	if (verlauf === null) {
		return entferneVerlauf(quelle, nr);
	}
	const da = verlaufAn(k);
	if (da) {
		const neu = verlaufHtml(da.id, verlauf);
		return neu === quelleVon(z, da.verlauf) ? quelle : wendeAn(quelle, [{ von: da.verlauf.start, bis: da.verlauf.ende, text: neu }]);
	}
	const svg = svgVon(k);
	const pfad = svg ? pfadVon(svg) : null;
	if (!svg || !pfad) {
		return quelle;
	}
	const id = neueId('verlauf', quelle);
	const html = verlaufHtml(id, verlauf);
	const defs = svg.kinder.find((c) => c.tag === 'defs');
	const stil = attribut(pfad, 'style')?.wert ?? null;
	const ohneFill = stilMit(stil, { fill: null });
	return wendeAn(quelle, [
		...(defs ? fuegeInnenEin(z, defs, 'ende', html) : fuegeInnenEin(z, svg, 'anfang', `<defs>${html}</defs>`)),
		...setzeAttributAn(z, pfad, 'fill', `url(#${id})`),
		...(ohneFill === stil ? [] : setzeAttributAn(z, pfad, 'style', ohneFill)),
	]);
};

// ── Kontur-Stil ─────────────────────────────────────────────────────────────

export type KonturStil = 'durchgezogen' | 'gestrichelt' | 'gepunktet';
export type KonturEnden = 'eckig' | 'rund';

export interface KonturForm {
	stil: KonturStil;
	enden: KonturEnden;
}

const STIL = 'data-kontur-stil';
const ENDEN = 'data-kontur-enden';

export const leseKonturStil = (quelle: string, nr: number): KonturForm => {
	const k = zerlege(quelle).knoten[nr];
	const stil = k ? attribut(k, STIL)?.wert : null;
	return {
		stil: stil === 'gestrichelt' || stil === 'gepunktet' ? stil : 'durchgezogen',
		enden: k && attribut(k, ENDEN)?.wert === 'rund' ? 'rund' : 'eckig',
	};
};

/**
 * Schreibt `stroke-dasharray` und `stroke-linecap` in den `style` des Pfads, passend zu `data-kontur-stil`,
 * `data-kontur-enden` und der Strichstärke s: gestrichelt `3s 2s`, gepunktet `0 2s` (immer mit runden Enden). Die Ecken
 * bleiben rund wie in 104 (der Strich liegt innen). Ohne Kontur fallen beide Werte weg, die Attribute bleiben.
 * `setzeKontur` (104) ruft das nach jeder Änderung der Stärke. Ohne Pfad oder ohne Stil kommt die Quelle unverändert
 * zurück.
 */
export const konturStilNeu = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const pfad = k ? pfadIn(k) : null;
	if (!k || !pfad) {
		return quelle;
	}
	const { enden, stil } = leseKonturStil(quelle, nr);
	const alt = attribut(pfad, 'style')?.wert ?? null;
	const s = strichAus(alt);
	const strich = s > 0 && stil !== 'durchgezogen';
	const rund = s > 0 && (enden === 'rund' || stil === 'gepunktet');
	const werte: Record<string, string | null> = {
		'stroke-dasharray': strich ? (stil === 'gestrichelt' ? `${zahl(3 * s)} ${zahl(2 * s)}` : `0 ${zahl(2 * s)}`) : null,
		'stroke-linecap': rund ? 'round' : null,
		...(rund ? { 'stroke-linejoin': 'round' } : {}),
	};
	const neu = stilMit(alt, werte);
	return neu === alt ? quelle : wendeAn(quelle, setzeAttributAn(z, pfad, 'style', neu ?? ''));
};

/** Kontur-Stil und Enden; durchgezogen und eckig schreiben nichts. Nur `form` und `formtext`. */
export const setzeKonturStil = (quelle: string, nr: number, { enden, stil }: KonturForm) => {
	const z = zerlege(quelle);
	const k = elementFuer(z, nr, 'kontur-stil');
	const neu = wendeAn(quelle, [
		...setzeAttributAn(z, k, STIL, stil === 'durchgezogen' ? null : stil),
		...setzeAttributAn(z, k, ENDEN, enden === 'rund' ? 'rund' : null),
	]);
	return konturStilNeu(neu, nr);
};

// ── Schatten und Deckkraft ──────────────────────────────────────────────────

export const SCHATTEN = ['leicht', 'mittel', 'stark'] as const;
export type Schatten = (typeof SCHATTEN)[number];

export const leseSchatten = (quelle: string, nr: number): Schatten | null => {
	const k = zerlege(quelle).knoten[nr];
	const wert = k ? attribut(k, 'data-schatten')?.wert : null;
	return SCHATTEN.find((s) => s === wert) ?? null;
};

/** `data-schatten`; die Regeln stehen in `blatt.css`. `null` entfernt. */
export const setzeSchatten = (quelle: string, nr: number, stufe: Schatten | null) => {
	const z = zerlege(quelle);
	const k = elementFuer(z, nr, 'schatten');
	if (stufe !== null && !SCHATTEN.includes(stufe)) {
		throw new Error(`Einen Schatten „${String(stufe)}“ gibt es nicht.`);
	}
	return wendeAn(quelle, setzeAttributAn(z, k, 'data-schatten', stufe));
};

export const DECKKRAFT_MIN = 10;

/** Deckkraft in Prozent, 10–100, auf 5 gerundet. */
export const deckkraftImBereich = (prozent: number) =>
	Math.max(DECKKRAFT_MIN, Math.min(100, Math.round(prozent / 5) * 5));

/** Deckkraft in Prozent; 100 ohne Angabe. */
export const leseDeckkraft = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	const wert = Number.parseFloat(stilWert(k ? (attribut(k, 'style')?.wert ?? null) : null, 'opacity') ?? '');
	return Number.isFinite(wert) ? deckkraftImBereich(wert * 100) : 100;
};

/** `opacity` im `style` des Elements; 100 % und `null` schreiben nichts. Jede Art mit `lage`. */
export const setzeDeckkraft = (quelle: string, nr: number, prozent: number | null) => {
	elementFuer(zerlege(quelle), nr, 'deckkraft');
	const p = prozent === null ? 100 : deckkraftImBereich(prozent);
	return setzeStilWerte(quelle, nr, { opacity: p === 100 ? null : zahl(p / 100) });
};
