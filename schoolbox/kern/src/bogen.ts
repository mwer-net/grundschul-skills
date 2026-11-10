/**
 * Titel im Bogen (110, Briefing 3.4 „Schmuckschrift im Bogen“): Text auf einer Kurve, als SVG mit `textPath`. Alles
 * hier sind reine Umformungen der Quelle.
 *
 * ```html
 * <svg class="schmuck" data-lage="frei" data-schmuck="bogen" data-bogen="35" viewBox="0 0 600 160" style="--b:600px;--h:160px">
 *   <defs><path id="bogen-k3f9" d="M20 140 Q300 20 580 140"/></defs>
 *   <text text-anchor="middle" style="font:600 56px Fredoka,sans-serif;fill:var(--haupt)">
 *     <textPath href="#bogen-k3f9" startOffset="50%">Zahlenzirkus</textPath>
 *   </text>
 * </svg>
 * ```
 *
 * `data-bogen` ist die Krümmung (−100 bis 100, 0 gerade, negativ nach unten gewölbt). Der Pfad hängt nur von
 * Krümmung, Breite, Höhe und Schriftgröße ab, nicht vom Text; der Kern erzeugt ihn und darf ihn bei Claude auch
 * ergänzen (`ergaenzeBoegen`). Schrift, Größe und Farbe stehen im `style` des `text`, die Kontur ebenfalls
 * (`setzeSchriftKontur` in `schmuck.ts`). Die Größe ändert das `viewBox` nicht: Das SVG skaliert als Ganzes
 * (`groesse: 'proportional'`), darum braucht der Bogen keine Zeile in `groessen-folgen.ts`.
 */

import { zahl } from './formen-geometrie';
import type { LageTeil } from './gestaltung';
import { legeGestaltungAb, neueId, setzeStilWerte } from './gestaltung';
import type { Aenderung, Knoten } from './quelltext';
import {
	attribut,
	entschluessele,
	ersetzeInnen,
	innenVon,
	klassenVon,
	schuetzeAttribut,
	schuetzeText,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import type { Schrift, SchriftKontur } from './schmuck';
import { groesseIm, istFarbe, leseSchmuck, leseSchriftKontur, SCHRIFTEN, textImBogen } from './schmuck';
import type { StrukturErgebnis } from './struktur';

export const KRUEMMUNG_MIN = -100;
export const KRUEMMUNG_MAX = 100;
/** Beim Umschalten und für einen neuen Titel im Bogen. */
export const KRUEMMUNG_STANDARD = 40;
export const BOGEN_STANDARD_TEXT = 'Zahlenzirkus';
export const BOGEN_STANDARD_GROESSE = 56;

/** Abstand des Pfads zum linken und rechten Rand des `viewBox`. */
const RAND = 20;
/** Platz über und unter der Grundlinie, in Vielfachen der Schriftgröße. */
const HOCH = 0.9;
const TIEF = 0.25;

export const krummungIm = (wert: number) => Math.min(KRUEMMUNG_MAX, Math.max(KRUEMMUNG_MIN, Math.round(wert)));

/**
 * Der Pfad `d` für Krümmung, Breite und Höhe des `viewBox` und Schriftgröße gr. Eine quadratische Kurve von links
 * nach rechts, bei 0 eine Gerade in der Mitte der Höhe. Positiv wölbt sie sich nach oben, negativ nach unten. Bei
 * ±100 bleiben die Buchstaben gerade noch im `viewBox`: Oben und unten bleibt Platz für Ober- und Unterlängen.
 */
export const bogenPfad = (kruemmung: number, b: number, h: number, gr: number) => {
	const k = krummungIm(kruemmung);
	const hoch = gr * HOCH;
	const tief = gr * TIEF;
	const maximal = Math.max(0, (h - hoch - tief) / 2);
	const grund = hoch + maximal;
	const d = (k / 100) * maximal;
	const links = RAND;
	const rechts = Math.max(RAND + 1, b - RAND);
	if (k === 0) {
		return `M${zahl(links)} ${zahl(grund)} L${zahl(rechts)} ${zahl(grund)}`;
	}
	return `M${zahl(links)} ${zahl(grund + d)} Q${zahl((links + rechts) / 2)} ${zahl(grund - 3 * d)} ${zahl(rechts)} ${zahl(grund + d)}`;
};

/** Breite aus Text und Größe geschätzt (Fredoka, Mittel über Buchstaben), mit Rand. */
export const bogenBreite = (text: string, gr: number) => Math.max(240, Math.round(text.length * gr * 0.62 + 2 * RAND));
export const bogenHoehe = (gr: number) => Math.round(gr * 2.4);

const SCHRIFT_FAMILIE: Record<Schrift, string> = { Fredoka: 'Fredoka', Andika: 'Andika' };

const textStil = (gr: number, schrift: Schrift, farbe: string) =>
	`font:600 ${zahl(gr)}px ${SCHRIFT_FAMILIE[schrift]},sans-serif;fill:${farbe}`;

export interface BogenNeu {
	text?: string;
	kruemmung?: number;
	/** `viewBox` und Größe des Elements; ohne Angabe aus Text und Größe geschätzt. */
	b?: number;
	h?: number;
	gr?: number;
	schrift?: Schrift;
	farbe?: string;
	kontur?: SchriftKontur | null;
	/** Id des Pfads; ohne Angabe die feste `bogen-neu`, die `legeGestaltungAb` neu vergibt. */
	id?: string;
}

/** Standardfarbe der Schmuckschrift, wenn nichts gesetzt ist (wie `.schmuck` in `blatt.css`). */
const STANDARD_FARBE = 'var(--dunkel)';

/** Die Teile hinter dem Start-Tag: `defs` mit Pfad und `text` mit `textPath`. */
const bogenInnen = (id: string, d: string, stil: string, text: string) =>
	`<defs><path id="${id}" d="${d}"/></defs>` +
	`<text text-anchor="middle" style="${schuetzeAttribut(stil)}"><textPath href="#${id}" startOffset="50%">${schuetzeText(text)}</textPath></text>`;

const konturWerte = (kontur: SchriftKontur | null | undefined) =>
	kontur && kontur.staerke > 0 && istFarbe(kontur.farbe)
		? `;stroke:${kontur.farbe.trim()};stroke-width:${Math.round(kontur.staerke)}px;stroke-linejoin:round;paint-order:stroke`
		: '';

/** Das `svg` eines neuen Titels im Bogen, schon mit `data-lage="frei"`; die Lage setzt `legeGestaltungAb`. */
export const bogenHtml = ({
	b,
	farbe,
	gr = BOGEN_STANDARD_GROESSE,
	h,
	id = 'bogen-neu',
	kontur,
	kruemmung = KRUEMMUNG_STANDARD,
	schrift = SCHRIFTEN[0],
	text = BOGEN_STANDARD_TEXT,
}: BogenNeu = {}) => {
	const groesse = groesseIm(gr);
	const breite = b ?? bogenBreite(text, groesse);
	const hoehe = h ?? bogenHoehe(groesse);
	const k = krummungIm(kruemmung);
	const stil =
		textStil(groesse, schrift, farbe && istFarbe(farbe) ? farbe.trim() : STANDARD_FARBE) + konturWerte(kontur);
	return (
		`<svg class="schmuck" data-lage="frei" data-schmuck="bogen" data-bogen="${k}" viewBox="0 0 ${breite} ${hoehe}" ` +
		`style="--b:${breite}px;--h:${hoehe}px">${bogenInnen(id, bogenPfad(k, breite, hoehe, groesse), stil, text)}</svg>`
	);
};

export interface BogenAblegen extends BogenNeu {
	/** Nummer der `.seite` in der Quelle. */
	seite: number;
	lage?: LageTeil;
}

/** Legt einen Titel im Bogen ganz nach vorne in die Ebene `vorne`, mit einer im Dokument freien Id. Ein Schritt. */
export const legeBogen = (quelle: string, { lage, seite, ...neu }: BogenAblegen): StrukturErgebnis =>
	legeGestaltungAb(quelle, {
		seite,
		html: bogenHtml({ ...neu, id: neueId('bogen', quelle) }),
		...(lage ? { lage } : {}),
	});

// ── Lesen ───────────────────────────────────────────────────────────────────

const istBogen = (k: Knoten | undefined): k is Knoten =>
	k !== undefined &&
	k.tag === 'svg' &&
	klassenVon(k).includes('schmuck') &&
	attribut(k, 'data-schmuck')?.wert === 'bogen';

const stilWert = (stil: string | null, name: string) => {
	for (const teil of (stil ?? '').split(';')) {
		const i = teil.indexOf(':');
		if (i > 0 && teil.slice(0, i).trim() === name) {
			return teil.slice(i + 1).trim();
		}
	}
	return null;
};

const zahlAus = (wert: string | null) => {
	const n = parseFloat(wert ?? '');
	return Number.isFinite(n) ? n : null;
};

interface Teile {
	svg: Knoten;
	text: Knoten | null;
	textPfad: Knoten | null;
	pfad: Knoten | null;
	breite: number;
	hoehe: number;
}

/** Der Pfad, auf den `textPath` zeigt, sonst der erste Pfad in `defs`. */
const pfadFuer = (z: ReturnType<typeof zerlege>, svg: Knoten, textPfad: Knoten | null) => {
	const href = textPfad ? (attribut(textPfad, 'href')?.wert ?? attribut(textPfad, 'xlink:href')?.wert ?? null) : null;
	const id = href?.startsWith('#') ? href.slice(1) : null;
	const pfade = z.knoten.filter((k) => k.tag === 'path' && k.start > svg.start && k.ende <= svg.ende);
	return (id ? pfade.find((p) => attribut(p, 'id')?.wert === id) : undefined) ?? pfade[0] ?? null;
};

const teileVon = (quelle: string, nr: number): { z: ReturnType<typeof zerlege>; t: Teile } => {
	const z = zerlege(quelle);
	const svg = z.knoten[nr];
	if (!istBogen(svg)) {
		throw new Error(`Das Element ${nr} ist kein Titel im Bogen.`);
	}
	const text = textImBogen(svg);
	const textPfad = text?.kinder.find((c) => c.tag === 'textpath') ?? null;
	const box = (attribut(svg, 'viewbox')?.wert ?? '')
		.trim()
		.split(/[\s,]+/)
		.map(Number);
	const stil = attribut(svg, 'style')?.wert ?? null;
	const breite = box[2] || zahlAus(stilWert(stil, '--b')) || 600;
	const hoehe = box[3] || zahlAus(stilWert(stil, '--h')) || 160;
	return { z, t: { svg, text, textPfad, pfad: pfadFuer(z, svg, textPfad), breite, hoehe } };
};

export interface BogenStand {
	kruemmung: number;
	text: string;
	gr: number;
	schrift: Schrift;
	farbe: string | null;
	kontur: SchriftKontur | null;
	/** `viewBox`, nicht die Größe auf dem Blatt. */
	b: number;
	h: number;
}

/** Was Inspektor und Leiste zeigen; `null`, wenn `nr` kein Titel im Bogen ist. */
export const leseBogen = (quelle: string, nr: number): BogenStand | null => {
	const z = zerlege(quelle);
	if (!istBogen(z.knoten[nr])) {
		return null;
	}
	const { t } = teileVon(quelle, nr);
	const stil = t.text ? (attribut(t.text, 'style')?.wert ?? null) : null;
	const font = stilWert(stil, 'font') ?? '';
	const farbe = stilWert(stil, 'fill');
	return {
		kruemmung: krummungIm(zahlAus(attribut(t.svg, 'data-bogen')?.wert ?? null) ?? 0),
		text: t.textPfad ? entschluessele(innenVon(z, t.textPfad).replace(/<[^>]*>/g, '')) : '',
		gr:
			zahlAus(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? null) ??
			zahlAus(stilWert(stil, 'font-size')) ??
			BOGEN_STANDARD_GROESSE,
		schrift: /andika/i.test(font) || /andika/i.test(stilWert(stil, 'font-family') ?? '') ? 'Andika' : 'Fredoka',
		farbe: farbe && farbe !== STANDARD_FARBE ? farbe : null,
		kontur: leseSchriftKontur(quelle, nr),
		b: t.breite,
		h: t.hoehe,
	};
};

// ── Ändern ──────────────────────────────────────────────────────────────────

/** Was `setzeBogen` ändert: ein Wert setzt, ohne Angabe bleibt er. `farbe: null` nimmt die Standardfarbe. */
export interface BogenTeil {
	kruemmung?: number;
	text?: string;
	gr?: number;
	schrift?: Schrift;
	farbe?: string | null;
}

/**
 * Krümmung, Text, Größe, Schrift und Farbe. Krümmung und Größe berechnen den Pfad neu, der Text nicht (der Pfad hängt
 * nicht von ihm ab). Leerer Text bleibt, wie er war: Einen Bogen ohne Text gibt es nicht.
 */
const pruefeBogenTeil = (teil: BogenTeil) => {
	if (teil.schrift !== undefined && !SCHRIFTEN.includes(teil.schrift)) {
		throw new Error(`Die Schrift „${String(teil.schrift)}“ ist nicht eingebettet.`);
	}
	if (teil.farbe && !istFarbe(teil.farbe)) {
		throw new Error(`„${teil.farbe}“ ist keine Farbe des Blatts.`);
	}
};

export const setzeBogen = (quelle: string, nr: number, teil: BogenTeil) => {
	const { t, z } = teileVon(quelle, nr);
	const stand = leseBogen(quelle, nr);
	if (!stand || !t.text || !t.textPfad) {
		throw new Error(`Der Titel im Bogen ${nr} ist unvollständig.`);
	}
	pruefeBogenTeil(teil);
	const kruemmung = teil.kruemmung === undefined ? stand.kruemmung : krummungIm(teil.kruemmung);
	const gr = teil.gr === undefined ? stand.gr : groesseIm(teil.gr);
	const schrift = teil.schrift ?? stand.schrift;
	const farbe = teil.farbe === undefined ? stand.farbe : teil.farbe;
	const aenderungen: Aenderung[] = [];
	if (kruemmung !== stand.kruemmung || attribut(t.svg, 'data-bogen') === undefined) {
		aenderungen.push(...setzeAttribut(z, t.svg, 'data-bogen', String(kruemmung)));
	}
	if (t.pfad && (kruemmung !== stand.kruemmung || gr !== stand.gr || !attribut(t.pfad, 'd')?.wert)) {
		aenderungen.push(...setzeAttribut(z, t.pfad, 'd', bogenPfad(kruemmung, t.breite, t.hoehe, gr)));
	}
	if (teil.text !== undefined && teil.text.trim() !== '' && teil.text !== stand.text) {
		aenderungen.push(...ersetzeInnen(z, t.textPfad, schuetzeText(teil.text)));
	}
	const geaendert = wendeAn(quelle, aenderungen);
	if (gr === stand.gr && schrift === stand.schrift && farbe === stand.farbe) {
		return geaendert;
	}
	// Der Stil des `text` liegt hinter den Änderungen oben nicht mehr an derselben Stelle: neu zerlegen.
	const text = textImBogen(zerlege(geaendert).knoten[nr] as Knoten);
	return text
		? setzeStilWerte(geaendert, text.nr, {
				font: `600 ${zahl(gr)}px ${SCHRIFT_FAMILIE[schrift]},sans-serif`,
				fill: farbe ?? STANDARD_FARBE,
			})
		: geaendert;
};

// ── Umschalten: Titel ⇄ Bogen ───────────────────────────────────────────────

/** Variablen der Schmuckschrift in HTML, die im Bogen im `text` stehen. */
const NUR_HTML = ['--gr', '--farbe', '--schrift', '--ausrichtung', '--kontur', '--kontur-farbe'];
const OHNE_UEBERNAHME = new Set([
	'class',
	'style',
	'data-schmuck',
	'data-kontur',
	'data-bogen',
	'viewbox',
	'contenteditable',
]);

const stilOhne = (stil: string | null, namen: readonly string[]) =>
	(stil ?? '')
		.split(';')
		.filter((t) => t.trim() !== '' && !namen.includes(t.slice(0, Math.max(0, t.indexOf(':'))).trim()))
		.join(';');

const uebrigeAttribute = (k: Knoten) =>
	k.attribute
		.filter((a) => !OHNE_UEBERNAHME.has(a.name.toLowerCase()))
		.map((a) => (a.wert === null ? ` ${a.name}` : ` ${a.name}="${schuetzeAttribut(a.wert)}"`))
		.join('');

/** Ob ein Titel farbige Wörter hat (`<span style=…>`), die der Bogen nicht behalten kann. */
export const hatFarbigeWoerter = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	return k !== undefined && k.tag === 'div' && /<span\b/i.test(innenVon(z, k));
};

/** Nur ein Titel (`div.schmuck`, `titel`) lässt sich in den Bogen setzen. */
export const kannInBogen = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	return (
		k !== undefined &&
		k.tag === 'div' &&
		klassenVon(k).includes('schmuck') &&
		attribut(k, 'data-schmuck')?.wert === 'titel'
	);
};

const ersetzeElement = (quelle: string, k: Knoten, neu: string) =>
	wendeAn(quelle, [{ von: k.start, bis: k.ende, text: neu }]);

/**
 * Macht aus dem Titel einen Bogen. Lage, Farbe, Schrift, Größe und Kontur bleiben, ebenso alle anderen Attribute
 * (Name, Anker …). Farben einzelner Wörter gehen verloren, der Bogen hat eine Farbe. Der Pfad bekommt eine neue Id.
 */
export const inBogen = (quelle: string, nr: number, kruemmung: number = KRUEMMUNG_STANDARD) => {
	if (!kannInBogen(quelle, nr)) {
		throw new Error(`Das Element ${nr} ist kein Titel.`);
	}
	const z = zerlege(quelle);
	const k = z.knoten[nr] as Knoten;
	const stand = leseSchmuck(quelle, nr);
	const stil = attribut(k, 'style')?.wert ?? null;
	const text = entschluessele(
		innenVon(z, k)
			.replace(/<br\s*\/?>/gi, ' ')
			.replace(/<[^>]*>/g, ''),
	)
		.replace(/\s+/g, ' ')
		.trim();
	const gr = groesseIm(stand?.gr ?? 56);
	const wort = text === '' ? BOGEN_STANDARD_TEXT : text;
	const b = Math.round(zahlAus(stilWert(stil, '--b')) ?? bogenBreite(wort, gr));
	const h = bogenHoehe(gr);
	const rest = stilOhne(stil, [...NUR_HTML, '--b', '--h']);
	const k0 = krummungIm(kruemmung);
	const id = neueId('bogen', quelle);
	const farbe = stand?.farbe && istFarbe(stand.farbe) ? stand.farbe : STANDARD_FARBE;
	const kontur = leseSchriftKontur(quelle, nr);
	const innen = bogenInnen(
		id,
		bogenPfad(k0, b, h, gr),
		textStil(gr, stand?.schrift ?? SCHRIFTEN[0], farbe) + konturWerte(kontur),
		wort,
	);
	const neu =
		`<svg class="schmuck"${uebrigeAttribute(k)} data-schmuck="bogen" data-bogen="${k0}" viewBox="0 0 ${b} ${h}" ` +
		`style="${schuetzeAttribut(`${rest}${rest ? ';' : ''}--b:${b}px;--h:${h}px`)}">${innen}</svg>`;
	return ersetzeElement(quelle, k, neu);
};

/** Macht aus dem Bogen wieder einen Titel (`div.schmuck`), mit Lage, Farbe, Schrift, Größe und Kontur des Bogens. */
export const ausBogen = (quelle: string, nr: number) => {
	const stand = leseBogen(quelle, nr);
	const { t, z } = teileVon(quelle, nr);
	if (!stand) {
		throw new Error(`Das Element ${nr} ist kein Titel im Bogen.`);
	}
	const stil = attribut(t.svg, 'style')?.wert ?? null;
	const rest = stilOhne(stil, ['--h', '--b']);
	const b = zahlAus(stilWert(stil, '--b'));
	const werte = [
		...(rest ? [rest] : []),
		...(b === null ? [] : [`--b:${zahl(b)}px`]),
		`--gr:${zahl(stand.gr)}px`,
		...(stand.farbe ? [`--farbe:${stand.farbe}`] : []),
		...(stand.schrift === SCHRIFTEN[0] ? [] : [`--schrift:${stand.schrift}`]),
		'--ausrichtung:center',
		...(stand.kontur ? [`--kontur:${zahl(stand.kontur.staerke)}px`, `--kontur-farbe:${stand.kontur.farbe}`] : []),
	];
	const neu =
		`<div class="schmuck"${uebrigeAttribute(t.svg)} data-schmuck="titel"${stand.kontur ? ' data-kontur=""' : ''} ` +
		`style="${schuetzeAttribut(werte.join(';'))}">${schuetzeText(stand.text)}</div>`;
	void z;
	return ersetzeElement(quelle, t.svg, neu);
};

// ── Claude darf den Pfad weglassen ──────────────────────────────────────────

/**
 * Ein Titel im Bogen von Claude darf den Pfad weglassen (4.4): Fehlen `defs`, der Pfad oder sein `d`, `viewBox`, die
 * Größe oder der Sprung des `textPath`, entsteht es aus `data-bogen` (ohne: gerade) und der Schriftgröße. Was da ist,
 * bleibt, wie es ist. Ohne Bögen kommt die Quelle Zeichen für Zeichen zurück.
 */
export const ergaenzeBoegen = (quelle: string) => {
	if (!quelle.includes('data-schmuck="bogen"') && !/data-schmuck=['"]?bogen/.test(quelle)) {
		return quelle;
	}
	let jetzt = quelle;
	// Je Bogen höchstens vier Schritte; die Grenze schützt vor einer Schleife.
	for (let runde = 0; runde < 1000; runde += 1) {
		const z = zerlege(jetzt);
		const neu = z.knoten.map((k) => (istBogen(k) ? ergaenzeEinen(z, k) : null)).find((q) => q !== null);
		if (neu === undefined || neu === null) {
			return jetzt;
		}
		jetzt = neu;
	}
	return jetzt;
};

const ergaenzeBox = (z: ReturnType<typeof zerlege>, svg: Knoten, stil: string | null, wort: string, gr: number) => {
	const b = Math.round(zahlAus(stilWert(stil, '--b')) ?? bogenBreite(wort, gr));
	const h = Math.round(zahlAus(stilWert(stil, '--h')) ?? bogenHoehe(gr));
	return wendeAn(z.quelle, [
		...setzeAttribut(z, svg, 'viewBox', `0 0 ${b} ${h}`),
		...(zahlAus(stilWert(stil, '--b')) === null || zahlAus(stilWert(stil, '--h')) === null
			? setzeAttribut(z, svg, 'style', stilMitGroesse(stil, b, h))
			: []),
	]);
};

const ergaenzePfad = (z: ReturnType<typeof zerlege>, svg: Knoten, textPfad: Knoten, d: string) => {
	const id = neueId('bogen', z.quelle);
	const defs = svg.kinder.find((c) => c.tag === 'defs');
	const einzeln = `<path id="${id}" d="${d}"/>`;
	return wendeAn(z.quelle, [
		...(defs
			? [{ von: defs.schliesserStart, bis: defs.schliesserStart, text: einzeln }]
			: [{ von: svg.oeffnerEnde, bis: svg.oeffnerEnde, text: `<defs>${einzeln}</defs>` }]),
		...setzeAttribut(z, textPfad, 'href', `#${id}`),
	]);
};

const ergaenzeVerweis = (z: ReturnType<typeof zerlege>, pfad: Knoten, textPfad: Knoten, d: string) => {
	const aenderungen: Aenderung[] = [];
	if (!attribut(pfad, 'd')?.wert?.trim()) {
		aenderungen.push(...setzeAttribut(z, pfad, 'd', d));
	}
	const id = attribut(pfad, 'id')?.wert;
	if (!id) {
		return null;
	}
	if (attribut(textPfad, 'href')?.wert !== `#${id}` && !attribut(textPfad, 'xlink:href')) {
		aenderungen.push(...setzeAttribut(z, textPfad, 'href', `#${id}`));
	}
	return aenderungen.length > 0 ? wendeAn(z.quelle, aenderungen) : null;
};

const schriftgroesseIm = (text: Knoten) => {
	const font = stilWert(attribut(text, 'style')?.wert ?? null, 'font') ?? '';
	return (
		zahlAus(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? null) ??
		zahlAus(stilWert(attribut(text, 'style')?.wert ?? null, 'font-size')) ??
		BOGEN_STANDARD_GROESSE
	);
};

const ergaenzeEinen = (z: ReturnType<typeof zerlege>, svg: Knoten): string | null => {
	const text = textImBogen(svg);
	const textPfad = text?.kinder.find((c) => c.tag === 'textpath') ?? null;
	if (!text || !textPfad) {
		return null;
	}
	const stil = attribut(svg, 'style')?.wert ?? null;
	const gr = schriftgroesseIm(text);
	const box = (attribut(svg, 'viewbox')?.wert ?? '')
		.trim()
		.split(/[\s,]+/)
		.map(Number);
	const wort = entschluessele(innenVon(z, textPfad).replace(/<[^>]*>/g, ''));
	if (!(box[2] && box[3])) {
		return ergaenzeBox(z, svg, stil, wort, gr);
	}
	const kruemmung = krummungIm(zahlAus(attribut(svg, 'data-bogen')?.wert ?? null) ?? 0);
	const d = bogenPfad(kruemmung, box[2], box[3], gr);
	const pfad = pfadFuer(z, svg, textPfad);
	if (!pfad) {
		return ergaenzePfad(z, svg, textPfad, d);
	}
	return ergaenzeVerweis(z, pfad, textPfad, d);
};

const stilMitGroesse = (stil: string | null, b: number, h: number) => {
	const rest = stilOhne(stil, ['--b', '--h']);
	return `${rest}${rest ? ';' : ''}--b:${b}px;--h:${h}px`;
};
