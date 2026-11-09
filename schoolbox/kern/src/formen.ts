/**
 * Formen (Phase 12, 104; Briefing 03-modell „Form“, schubladen/3-formen.md): eine Liste im Kern (Entscheidung 27), aus
 * der Schublade, Inspektor, Allow-Liste und Referenz lesen. **Die Parameter sind die Quelle, der Pfad ist erzeugt**: Aus
 * `data-form`, den Parametern und der Größe (`--b`, `--h`) entstehen `viewBox` und `d` in Elementgröße, der Strich liegt
 * innen. Farben stehen im `style` des Pfads (`fill`, `stroke`, `stroke-width`), bevorzugt als Variable des Blatts.
 *
 * Die Formen kommen aus Familien-Modulen; jedes Ticket füllt nur seine Familie:
 *
 * | Datei | Formen | Ticket |
 * |---|---|---|
 * | `formen-grund.ts` | Rechteck, Ellipse, Dreieck, Vieleck, Stern, Herz, Wolke, Pfeil | 104 |
 * | `formen-text.ts` | Band, Sprechblase | 107 |
 * | `formen-linie.ts` | Linie | 107 |
 * | `formen-masken.ts` | Maske als Polygon aus einer Form | 111 |
 * | `formen-pfad.ts` | Pfad | 116 |
 *
 * Diese Datei hängt nur an `quelltext.ts`, damit `groessen-folgen.ts` (von `gestaltung.ts` gerufen) sie ohne Ladekreis
 * nutzen kann. Umformungen, die `gestaltung.ts` brauchen (`legeForm` …), stehen in `formen-aendern.ts`.
 */

import { zahl } from './formen-geometrie';
import { GRUND_FORMEN } from './formen-grund';
import { LINIEN_FORMEN } from './formen-linie';
import { PFAD_FORMEN } from './formen-pfad';
import { TEXT_FORMEN } from './formen-text';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import { attribut, klassenVon, schuetzeAttribut, schuetzeText, wendeAn, zerlege } from './quelltext';

/** Gewechselt wird nur innerhalb derselben Klasse (3-formen.md, „Form wechseln“). */
export type FormKlasse = 'ohne-text' | 'mit-text' | 'linie' | 'pfad';

export interface FormParameter {
	/** Das Attribut am `svg`, z. B. `data-zacken`. */
	attr: string;
	/** Im Inspektor. */
	name: string;
	min: number;
	max: number;
	schritt: number;
	standard: number;
	/** `%`: ein Anteil 0–1, im Inspektor in Prozent; `px`: Pixel. Ohne Angabe eine Anzahl. */
	einheit?: '%' | 'px';
	/**
	 * 107 „Auswahl“: Das Attribut trägt einen dieser Werte (`data-blase="rund"`), gerechnet wird mit seinem Index
	 * (`min` 0, `max` Anzahl − 1, `schritt` 1, `standard` der Index des Standards).
	 */
	werte?: readonly { wert: string; name: string }[];
}

/** Werte der Parameter, Schlüssel ist das Attribut (`data-zacken`). */
export type FormWerte = Readonly<Record<string, number>>;

export interface Gezeichnet {
	viewBox: string;
	d: string;
	/** 107: ein zweiter Pfad (`path.spitzen`), gefüllt mit der Farbe der Kontur: Pfeilspitzen und Punkte der Linie. */
	spitzen?: string;
}

export interface Form {
	/** `data-form`. */
	art: string;
	name: string;
	klasse: FormKlasse;
	parameter: readonly FormParameter[];
	standardGroesse: { b: number; h: number };
	/** Rein, auch im Browser (Anzeige während der Geste). `b`, `h` in px, `strich` die Strichstärke in px. */
	zeichne: (param: FormWerte, b: number, h: number, strich: number) => Gezeichnet;
	/**
	 * 107: Werte aus Attributen, die kein Parameter im Inspektor sind (`data-zipfel`, `data-punkte`). Sie gehen zusätzlich
	 * zu den Parametern an `zeichne`.
	 */
	extra?: (lies: (attr: string) => string | null | undefined) => FormWerte;
}

const ALLE: readonly Form[] = [
	...GRUND_FORMEN, // 104
	...TEXT_FORMEN, // 107
	...LINIEN_FORMEN, // 107
	...PFAD_FORMEN, // 116
];

export const FORMEN: Readonly<Record<string, Form>> = Object.fromEntries(ALLE.map((f) => [f.art, f]));

export const formVon = (art: string | null | undefined): Form | undefined =>
	art && Object.hasOwn(FORMEN, art) ? FORMEN[art] : undefined;

/** Name in Ebenen und Pfad (`nameDerGestaltung`); `null` für unbekannte Formen. */
export const formName = (art: string | null | undefined) => formVon(art)?.name ?? null;

/** Standards beim Ablegen (3-formen.md). */
export const STRICH = 3;
export const FUELLUNG = 'var(--akzent)';
/** 107: Blasen und Band sind weiß, damit der Text gut lesbar ist; die Linie hat keine Füllung. */
const STANDARD_FUELLUNG: Partial<Record<FormKlasse, string | null>> = { 'mit-text': '#ffffff', 'linie': null };

/** 107: Die Füllung, mit der eine Form dieser Klasse entsteht. */
export const fuellungStandard = (form: Form) =>
	form.klasse in STANDARD_FUELLUNG ? (STANDARD_FUELLUNG[form.klasse] ?? null) : FUELLUNG;
export const KONTUR = 'var(--dunkel)';
export const KONTUR_MAX = 12;

export interface Kontur {
	farbe: string;
	staerke: number;
}

// ── Parameter ───────────────────────────────────────────────────────────────

/** 107: Der Index eines Auswahl-Werts (`rund` → 0); Zahlen bleiben Zahlen. */
const alsZahl = (p: FormParameter, roh: string | number) => {
	if (p.werte && typeof roh === 'string' && !/^-?[\d.]+$/.test(roh.trim())) {
		const i = p.werte.findIndex((w) => w.wert === roh.trim());
		return i === -1 ? Number.NaN : i;
	}
	return Number(roh);
};

/** Wie der Wert im Attribut steht: bei einer Auswahl ihr Wert (`rund`), sonst die Zahl. */
export const parameterText = (p: FormParameter, wert: number) =>
	p.werte ? (p.werte[Math.round(wert)]?.wert ?? p.werte[p.standard]?.wert ?? '') : zahl(wert);

const imBereich = (p: FormParameter, roh: number) => {
	if (!Number.isFinite(roh)) {
		return p.standard;
	}
	const stufen = Math.round((Math.min(p.max, Math.max(p.min, roh)) - p.min) / p.schritt);
	return Number((p.min + stufen * p.schritt).toFixed(4));
};

/** Alle Parameter der Form: gelesen, in den Bereich und auf den Schritt gebracht, fehlende als Standard. */
export const vollstaendig = (form: Form, lies: (attr: string) => string | number | null | undefined): FormWerte =>
	Object.fromEntries(
		form.parameter.map((p) => {
			const roh = lies(p.attr);
			return [p.attr, roh === null || roh === undefined || roh === '' ? p.standard : imBereich(p, alsZahl(p, roh))];
		}),
	);

export const standardWerte = (form: Form): FormWerte => vollstaendig(form, () => null);

/** 107: Parameter und Werte aus `extra` zusammen, so wie `zeichne` sie bekommt. */
export const werteVon = (form: Form, lies: (attr: string) => string | null | undefined): FormWerte => ({
	...vollstaendig(form, lies),
	...form.extra?.(lies),
});

/** `null`, wenn es die Form nicht gibt. */
export const zeichneForm = (art: string, param: FormWerte, b: number, h: number, strich: number) => {
	const form = formVon(art);
	// 107: Werte aus `extra` (Zipfel, Punkte) gehen mit.
	return form ? form.zeichne({ ...param, ...vollstaendig(form, (a) => param[a]) }, Math.max(1, b), Math.max(1, h), strich) : null;
};

// ── style des Pfads ─────────────────────────────────────────────────────────

const teile = (stil: string | null) =>
	(stil ?? '')
		.split(';')
		.map((t) => t.trim())
		.filter(Boolean);

const name = (teil: string) => teil.slice(0, teil.indexOf(':')).trim().toLowerCase();

export const stilWert = (stil: string | null, eigenschaft: string) => {
	const teil = teile(stil).find((t) => name(t) === eigenschaft);
	return teil === undefined ? null : teil.slice(teil.indexOf(':') + 1).trim();
};

/** Setzt Eigenschaften im `style` an ihrer Stelle, neue ans Ende; `null` entfernt. */
export const stilMit = (stil: string | null, werte: Readonly<Record<string, string | null>>) => {
	const liste = teile(stil);
	for (const [eigenschaft, wert] of Object.entries(werte)) {
		const da = liste.findIndex((t) => name(t) === eigenschaft);
		if (wert === null) {
			if (da !== -1) {
				liste.splice(da, 1);
			}
		} else if (da === -1) {
			liste.push(`${eigenschaft}:${wert}`);
		} else {
			liste[da] = `${eigenschaft}:${wert}`;
		}
	}
	return liste.join(';') || null;
};

/** Ein `style`-Wert in px (`3px`, `3`); sonst `null`. */
const px = (wert: string | null) => {
	if (wert === null) {
		return null;
	}
	const n = parseFloat(wert);
	return Number.isFinite(n) && /^-?[\d.]+(px)?$/.test(wert.trim()) ? n : null;
};

/** Die Strichstärke, mit der gezeichnet wird: 0 ohne Kontur, sonst `stroke-width` (ohne Angabe 1 wie in SVG). */
export const strichAus = (stil: string | null) => {
	const stroke = stilWert(stil, 'stroke');
	if (stroke === null || stroke === 'none' || stroke === 'transparent') {
		return 0;
	}
	return Math.max(0, px(stilWert(stil, 'stroke-width')) ?? 1);
};

export const fuellungAus = (stil: string | null) => {
	const fill = stilWert(stil, 'fill');
	return fill === 'none' ? null : fill;
};

export const konturAus = (stil: string | null): Kontur | null => {
	const farbe = stilWert(stil, 'stroke');
	if (farbe === null || farbe === 'none') {
		return null;
	}
	return { farbe, staerke: strichAus(stil) };
};

/** Der `style` eines neuen Pfads. Runde Ecken im Strich, damit spitze Zacken nicht über die Fläche hinausragen. */
export const pfadStil = (fuellung: string | null, kontur: Kontur | null) =>
	kontur && kontur.staerke > 0
		? `fill:${fuellung ?? 'none'};stroke:${kontur.farbe};stroke-width:${zahl(kontur.staerke)}px;stroke-linejoin:round`
		: `fill:${fuellung ?? 'none'};stroke:none`;

// ── HTML ────────────────────────────────────────────────────────────────────

export interface NeueForm {
	art: string;
	/** Fehlende Parameter bekommen ihren Standard. */
	param?: Readonly<Record<string, number>>;
	b: number;
	h: number;
	/** Ohne Angabe `var(--akzent)`, `null`: keine Füllung. */
	fuellung?: string | null;
	/** Ohne Angabe `var(--dunkel)`, 3 px; `null`: keine Kontur. */
	kontur?: Kontur | null;
	/** 107: weitere Attribute wie `data-zipfel`, `data-punkte` (gelesen von `extra`). */
	attribute?: Readonly<Record<string, string>>;
	/** 107, Form mit Text: der Text (geschützt) und der `style` (`--gr` …). */
	text?: string;
	stil?: string;
}

/** Das `svg` einer neuen Form, schon mit `data-lage="frei"`; die Lage (`--x … --h`) setzt `legeGestaltungAb`. */
export const formHtml = ({ art, attribute = {}, b, fuellung, h, kontur, param = {}, stil, text }: NeueForm) => {
	const form = formVon(art);
	if (!form) {
		throw new Error(`Die Form „${art}“ gibt es nicht.`);
	}
	const werte = vollstaendig(form, (a) => param[a]);
	const fuell = fuellung === undefined ? fuellungStandard(form) : fuellung;
	const rand = kontur === undefined ? { farbe: KONTUR, staerke: STRICH } : kontur;
	const strich = rand ? rand.staerke : 0;
	const { d, spitzen, viewBox } = form.zeichne({ ...werte, ...form.extra?.((a) => attribute[a]) }, b, h, strich);
	const attr =
		form.parameter.map((p) => ` ${p.attr}="${parameterText(p, werte[p.attr] ?? p.standard)}"`).join('') +
		Object.entries(attribute)
			.map(([name, wert]) => ` ${name}="${schuetzeAttribut(wert)}"`)
			.join('');
	const pfadStilText = form.klasse === 'linie' ? stilMit(pfadStil(fuell, rand), { 'stroke-linecap': 'round' }) : pfadStil(fuell, rand);
	const pfade =
		`<path d="${d}" style="${schuetzeAttribut(pfadStilText ?? '')}"/>` +
		(spitzen ? `<path class="spitzen" d="${spitzen}" style="${spitzenStil(rand?.farbe ?? null)}"/>` : '');
	if (form.klasse === 'mit-text') {
		const stilAttr = stil ? ` style="${schuetzeAttribut(stil)}"` : '';
		return (
			`<div class="form-text" data-lage="frei" data-form="${art}"${attr}${stilAttr}>` +
			`<svg viewBox="${viewBox}" aria-hidden="true">${pfade}</svg>` +
			`<div class="form-inhalt">${schuetzeText(text ?? 'Text')}</div></div>`
		);
	}
	return `<svg class="form" data-lage="frei" data-form="${art}"${attr} viewBox="${viewBox}">${pfade}</svg>`;
};

/** 107: Der `style` der Pfeilspitzen: die Farbe der Kontur als Füllung, ohne eigenen Strich. */
export const spitzenStil = (farbe: string | null) => `fill:${farbe ?? 'none'};stroke:none`;

// ── In der Quelle ───────────────────────────────────────────────────────────

/** Eine Form der Liste: `svg` mit Klasse `form` oder (107) `div.form-text`, beide mit bekanntem `data-form`. */
export const istForm = (k: Knoten) =>
	((k.tag === 'svg' && klassenVon(k).includes('form')) || (k.tag === 'div' && klassenVon(k).includes('form-text'))) &&
	formVon(attribut(k, 'data-form')?.wert) !== undefined;

/** 107: Das `svg`, das zeichnet: die Form selbst oder bei `div.form-text` ihr erstes `svg`. */
export const svgVon = (k: Knoten) => (k.tag === 'svg' ? k : (k.kinder.find((c) => c.tag === 'svg') ?? null));

const istSpitzen = (k: Knoten) => klassenVon(k).includes('spitzen');

/** Der Pfad der Form: das erste `path` direkt im `svg` (ohne die Pfeilspitzen der Linie). */
export const pfadVon = (k: Knoten) => k.kinder.find((c) => c.tag === 'path' && !istSpitzen(c)) ?? null;

/** 107: Der Pfad der Pfeilspitzen (`path.spitzen`). */
export const spitzenVon = (k: Knoten) => k.kinder.find((c) => c.tag === 'path' && istSpitzen(c)) ?? null;

/** `--b`, `--h` aus dem `style`, in px; `null`, wenn eins fehlt. */
export const groesseAus = (stil: string | null) => {
	const b = px(stilWert(stil, '--b'));
	const h = px(stilWert(stil, '--h'));
	return b === null || h === null ? null : { b: Math.round(b), h: Math.round(h) };
};

export interface FormAngaben {
	form: Form;
	/** 107: das zeichnende `svg` (bei `.form-text` das Kind); `null`, wenn es fehlt. */
	svg: Knoten | null;
	param: FormWerte;
	groesse: { b: number; h: number } | null;
	pfad: Knoten | null;
	stil: string | null;
}

export const formAngaben = (k: Knoten): FormAngaben | null => {
	const form = istForm(k) ? formVon(attribut(k, 'data-form')?.wert) : undefined;
	if (!form) {
		return null;
	}
	const svg = svgVon(k);
	const pfad = svg ? pfadVon(svg) : null;
	return {
		form,
		svg,
		param: werteVon(form, (a) => attribut(k, a)?.wert),
		groesse: groesseAus(attribut(k, 'style')?.wert ?? null),
		pfad,
		stil: pfad ? (attribut(pfad, 'style')?.wert ?? null) : null,
	};
};

/** Ein Attribut setzen oder anlegen (am Ende des Start-Tags). `viewBox` liegt in der Zerlegung klein geschrieben vor. */
export const setzeAttributAn = (z: Zerlegung, k: Knoten, attr: string, wert: string | null): Aenderung[] => {
	const alt = attribut(k, attr.toLowerCase());
	if (wert === null) {
		if (!alt) {
			return [];
		}
		const vorher = z.quelle.slice(0, alt.start).match(/\s+$/)?.[0].length ?? 0;
		return [{ von: alt.start - vorher, bis: alt.ende, text: '' }];
	}
	const neu = `${attr}="${schuetzeAttribut(wert)}"`;
	if (alt) {
		return [{ von: alt.start, bis: alt.ende, text: neu }];
	}
	const tag = z.quelle.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	return [{ von: pos, bis: pos, text: ` ${neu}` }];
};

/** 107: `path.spitzen` passend zu `spitzen`: anlegen, nachführen (Form und Farbe der Kontur) oder entfernen. */
const spitzenAenderungen = (z: Zerlegung, a: FormAngaben, spitzen: string | null): Aenderung[] => {
	const da = a.svg ? spitzenVon(a.svg) : null;
	if (!spitzen) {
		return da ? [{ von: da.start, bis: da.ende, text: '' }] : [];
	}
	const stil = spitzenStil(konturAus(a.stil)?.farbe ?? null);
	if (!da) {
		return a.pfad ? [{ von: a.pfad.ende, bis: a.pfad.ende, text: `<path class="spitzen" d="${spitzen}" style="${stil}"/>` }] : [];
	}
	return [
		...(attribut(da, 'd')?.wert === spitzen ? [] : setzeAttributAn(z, da, 'd', spitzen)),
		...(attribut(da, 'style')?.wert === stil ? [] : setzeAttributAn(z, da, 'style', stil)),
	];
};

/**
 * Schreibt `viewBox` und `d` der Form `nr` neu, passend zu `--b`, `--h`, Parametern und Strich. Ohne Größe im `style`,
 * ohne Pfad oder für alles, was keine Form der Liste ist, kommt die Quelle unverändert zurück.
 */
export const zeichneFormNeu = (quelle: string, nr: number) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	const a = k ? formAngaben(k) : null;
	if (!k || !a?.groesse || !a.pfad || !a.svg) {
		return quelle;
	}
	const { d, spitzen, viewBox } = a.form.zeichne(a.param, a.groesse.b, a.groesse.h, strichAus(a.stil));
	const aenderungen = [
		...(attribut(a.svg, 'viewbox')?.wert === viewBox ? [] : setzeAttributAn(z, a.svg, 'viewBox', viewBox)),
		...(attribut(a.pfad, 'd')?.wert === d ? [] : setzeAttributAn(z, a.pfad, 'd', d)),
		...spitzenAenderungen(z, a, spitzen ?? null),
	];
	return aenderungen.length ? wendeAn(quelle, aenderungen) : quelle;
};

// ── Referenz ────────────────────────────────────────────────────────────────

const bereich = (p: FormParameter) => {
	const einheit = p.einheit === 'px' ? ' px' : '';
	return `\`${p.attr}\` ${zahl(p.min)}–${zahl(p.max)}${einheit}, Standard ${zahl(p.standard)}`;
};

const KLASSE: Record<FormKlasse, string> = {
	'ohne-text': 'ohne Text',
	'mit-text': 'mit Text',
	'linie': 'Linie',
	'pfad': 'Pfad',
};

/** Die Tabelle der Formen für `references/gestaltung.md` (`quellen.ts`, Marke 104). */
export const formenTabelle = () =>
	[
		'| Form | `data-form` | Klasse | Parameter (Bereich, Standard) | Größe beim Ablegen |',
		'|---|---|---|---|---|',
		...ALLE.map(
			(f) =>
				`| ${f.name} | \`${f.art}\` | ${KLASSE[f.klasse]} | ${f.parameter.map(bereich).join('; ') || '–'} | ${f.standardGroesse.b} × ${f.standardGroesse.h} |`,
		),
	].join('\n');
