/**
 * Rahmen-Stile, Masken und Bildrahmen (111, Briefing schubladen/6-bilder.md und 3-formen.md „Bildrahmen“).
 *
 * - **Rahmen-Stil** (`data-rahmenstil`: `schraeg`, `polaroid`, `rund`, `kontur`) nur an `img.bild-frei`. Das Aussehen
 *   steht in `blatt.css`.
 * - **Maske** (`data-maske` = Name einer Form ohne Text, dazu ihre Parameter als `data-*` wie bei der Form) mit dem
 *   `clip-path` im `style`, gerechnet von `maskeFuer` (`formen-masken.ts`).
 * - Maske und Rahmen-Stil schließen sich aus: Wer das eine setzt, verliert das andere.
 * - **Bildrahmen leer:** `div.bildrahmen.platzhalter[data-lage="frei"][data-maske]`, grau, die Prüfung meldet ihn als
 *   `platzhalter`. Ein Bild darin macht daraus `img.bild-frei` mit derselben Lage und Maske; eine Form ohne Text ebenso.
 *
 * Alles reine Umformungen der Quelle, jede ein Schritt im Verlauf.
 */

import { formVon, parameterText, setzeAttributAn, stilWert, vollstaendig } from './formen';
import type { FormWerte } from './formen';
import { istMaskenForm, maskeFuer } from './formen-masken';
import type { Ablegen } from './gestaltung';
import { legeGestaltungAb, leseLage, setzeLage, setzeStilWerte } from './gestaltung';
import { LAGE } from './gestaltung-arten';
import type { Knoten } from './quelltext';
import { attribut, klassenVon, schuetzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';

export const RAHMENSTILE = ['schraeg', 'polaroid', 'rund', 'kontur'] as const;
export type Rahmenstil = (typeof RAHMENSTILE)[number];

export const RAHMENSTIL_NAMEN: Record<Rahmenstil, string> = {
	schraeg: 'Schräg',
	polaroid: 'Polaroid',
	rund: 'Rund',
	kontur: 'Kontur',
};

/** So schräg liegt ein Bild, wenn „schräg“ gewählt wird und es vorher gerade lag. */
export const SCHRAEG_GRAD = -3;

/** Größe eines leeren Bildrahmens, wenn nichts anderes gesagt ist. */
export const BILDRAHMEN_GROESSE = { b: 220, h: 220 };

const istBildFrei = (k: Knoten | undefined): k is Knoten =>
	Boolean(k && k.tag === 'img' && klassenVon(k).includes('bild-frei') && attribut(k, LAGE)?.wert === 'frei');

/** Ein leerer Bildrahmen: `.bildrahmen` mit `data-lage="frei"`. */
export const istBildrahmenLeer = (k: Knoten | undefined): k is Knoten =>
	Boolean(k && klassenVon(k).includes('bildrahmen') && attribut(k, LAGE)?.wert === 'frei');

/** Eine Form ohne Text, in die ein Bild fallen kann (`svg.form`, nicht `.form-text`, keine Linie). */
export const istMaskenFormKnoten = (k: Knoten | undefined): k is Knoten =>
	Boolean(
		k &&
			k.tag === 'svg' &&
			klassenVon(k).includes('form') &&
			attribut(k, LAGE)?.wert === 'frei' &&
			istMaskenForm(attribut(k, 'data-form')?.wert),
	);

const knotenAn = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

/** Ein Attribut setzen (`null` entfernt); jede Änderung für sich, die Nummer des Elements bleibt. */
const mitAttribut = (quelle: string, nr: number, name: string, wert: string | null) => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!k) {
		return quelle;
	}
	const alt = attribut(k, name)?.wert ?? null;
	if (alt === wert || (wert === null && !attribut(k, name))) {
		return quelle;
	}
	return wendeAn(quelle, setzeAttributAn(z, k, name, wert));
};

/** `--b` und `--h` aus dem `style`; ohne `--h` gilt die Breite (ein Bild ohne Zuschnitt hat seine Höhe aus der Datei). */
const groesseVon = (quelle: string, nr: number) => {
	const lage = leseLage(quelle, nr);
	const b = lage.b ?? BILDRAHMEN_GROESSE.b;
	return { b, h: lage.h ?? b };
};

export interface BildrahmenStand {
	/** Leerer Bildrahmen (kein Bild darin). */
	leer: boolean;
	rahmenstil: Rahmenstil | null;
	/** `data-form` der Maske, `null` ohne. */
	maske: string | null;
	param: FormWerte;
	/** `--h`, `--bx` oder `--by` stehen im `style`. */
	zuschnitt: boolean;
}

const alsRahmenstil = (wert: string | null | undefined): Rahmenstil | null =>
	RAHMENSTILE.find((s) => s === wert) ?? null;

/** Was Inspektor und Leiste zeigen; `null` für alles, was weder freies Bild noch Bildrahmen ist. */
export const leseBildrahmen = (quelle: string, nr: number): BildrahmenStand | null => {
	const k = zerlege(quelle).knoten[nr];
	if (!istBildFrei(k) && !istBildrahmenLeer(k)) {
		return null;
	}
	const maske = attribut(k, 'data-maske')?.wert ?? null;
	const form = formVon(maske);
	const stil = attribut(k, 'style')?.wert ?? null;
	return {
		leer: istBildrahmenLeer(k),
		rahmenstil: alsRahmenstil(attribut(k, 'data-rahmenstil')?.wert),
		maske: form ? maske : null,
		param: form ? vollstaendig(form, (a) => attribut(k, a)?.wert) : {},
		zuschnitt: ['--h', '--bx', '--by'].some((v) => stilWert(stil, v) !== null),
	};
};

/** Entfernt Maske, Parameter der alten Maske und `clip-path`. */
const ohneMaske = (quelle: string, nr: number) => {
	const k = knotenAn(quelle, nr);
	const alt = formVon(attribut(k, 'data-maske')?.wert);
	let q = mitAttribut(quelle, nr, 'data-maske', null);
	for (const p of alt?.parameter ?? []) {
		q = mitAttribut(q, nr, p.attr, null);
	}
	return setzeStilWerte(q, nr, { 'clip-path': null });
};

/**
 * Rahmen-Stil am freien Bild; `null` heißt gerade. Ein Stil nimmt die Maske weg. „Schräg“ dreht ein gerade liegendes
 * Bild um −3°.
 */
export const setzeRahmenstil = (quelle: string, nr: number, stil: Rahmenstil | null): string => {
	if (!istBildFrei(knotenAn(quelle, nr))) {
		throw new Error('Rahmen-Stile gibt es nur für freie Bilder.');
	}
	let q = mitAttribut(quelle, nr, 'data-rahmenstil', stil);
	if (stil !== null) {
		q = ohneMaske(q, nr);
	}
	if (stil === 'schraeg' && !leseLage(q, nr).drehen) {
		q = setzeLage(q, nr, { drehen: SCHRAEG_GRAD });
	}
	return q;
};

/**
 * Maske am freien Bild oder am leeren Bildrahmen: `form` ist eine Form ohne Text, `param` ihre Parameter (fehlende
 * bleiben, wenn die Form gleich bleibt, sonst Standard). `null` nimmt die Maske weg (nur am Bild; ein Rahmen braucht
 * eine). Eine Maske nimmt den Rahmen-Stil weg.
 */
export const setzeMaske = (
	quelle: string,
	nr: number,
	form: string | null,
	param: Readonly<Record<string, number>> = {},
): string => {
	const k = knotenAn(quelle, nr);
	const leer = istBildrahmenLeer(k);
	if (!leer && !istBildFrei(k)) {
		throw new Error('Eine Maske gibt es nur für freie Bilder und Bildrahmen.');
	}
	if (form === null) {
		if (leer) {
			throw new Error('Ein Bildrahmen braucht eine Form.');
		}
		return ohneMaske(quelle, nr);
	}
	const neu = formVon(form);
	if (!neu || !istMaskenForm(form)) {
		throw new Error(`„${form}“ ist keine Form ohne Text.`);
	}
	const gleich = attribut(k, 'data-maske')?.wert === form;
	const werte = vollstaendig(neu, (a) => param[a] ?? (gleich ? attribut(k, a)?.wert : undefined));
	let q = gleich ? quelle : ohneMaske(quelle, nr);
	q = mitAttribut(q, nr, 'data-rahmenstil', null);
	q = mitAttribut(q, nr, 'data-maske', form);
	for (const p of neu.parameter) {
		q = mitAttribut(q, nr, p.attr, parameterText(p, werte[p.attr] ?? p.standard));
	}
	const { b, h } = groesseVon(q, nr);
	return setzeStilWerte(q, nr, { 'clip-path': maskeFuer(form, werte, b, h) });
};

export interface NeuerBildrahmen {
	form: string;
	param?: Readonly<Record<string, number>>;
	b: number;
	h: number;
}

/** Das HTML eines leeren Bildrahmens ohne Lage (die setzt das Ablegen), mit `clip-path` für `b` × `h`. */
export const bildrahmenHtml = ({ b, form, h, param = {} }: NeuerBildrahmen) => {
	const f = formVon(form);
	if (!f || !istMaskenForm(form)) {
		throw new Error(`„${form}“ ist keine Form ohne Text.`);
	}
	const werte = vollstaendig(f, (a) => param[a]);
	const attr = f.parameter.map((p) => ` ${p.attr}="${parameterText(p, werte[p.attr] ?? p.standard)}"`).join('');
	const maske = maskeFuer(form, werte, b, h) ?? '';
	return `<div class="bildrahmen platzhalter" data-lage="frei" data-maske="${form}"${attr} style="clip-path:${schuetzeAttribut(maske)}"></div>`;
};

/** Legt einen leeren Bildrahmen auf die Seite (`seite`: Nummer der `.seite`), vorne. Ein Schritt. */
export const legeBildrahmen = (
	quelle: string,
	{ form, lage = {}, param, seite }: { seite: number; form: string; lage?: Ablegen['lage']; param?: Readonly<Record<string, number>> },
): StrukturErgebnis => {
	const b = lage.b ?? BILDRAHMEN_GROESSE.b;
	const h = lage.h ?? BILDRAHMEN_GROESSE.h;
	return legeGestaltungAb(quelle, {
		seite,
		html: bildrahmenHtml({ form, b, h, ...(param ? { param } : {}) }),
		lage: { ...lage, b, h },
	});
};

/** Diese Attribute des alten Elements gehen nicht ans Bild: Sie gehören zur Form bzw. zum Rahmen. */
const NICHT_UEBERNEHMEN = new Set(['class', 'style', 'src', 'alt', 'viewbox', 'xmlns', 'aria-hidden', 'role', 'data-form', 'data-maske']);

/**
 * Ersetzt das Element `k` durch ein freies Bild an derselben Stelle der Quelle: Ebene, Reihenfolge, Lage (auch
 * `--drehen`), Anker und Name bleiben. `maske` ist der Name der Form, `style` bekommt den `clip-path`.
 */
const ersetzeDurchBild = (quelle: string, k: Knoten, maske: string, clipPath: string | null, bild: { src: string; alt: string }) => {
	const klassen = klassenVon(k).filter((c) => !['bildrahmen', 'platzhalter', 'form'].includes(c));
	const attr = k.attribute
		.filter((a) => !NICHT_UEBERNEHMEN.has(a.name))
		.map((a) => (a.wert === null ? ` ${a.name}` : ` ${a.name}="${schuetzeAttribut(a.wert)}"`))
		.join('');
	const stil = setzeStil(attribut(k, 'style')?.wert ?? null, clipPath);
	const html =
		`<img class="${['bild-frei', ...klassen].join(' ')}"${attr} data-maske="${maske}"` +
		` src="${schuetzeAttribut(bild.src)}" alt="${schuetzeAttribut(bild.alt.trim())}"` +
		(stil ? ` style="${schuetzeAttribut(stil)}"` : '') +
		'>';
	// Davor ändert sich nichts: Das Bild hat die Nummer des alten Elements.
	return { quelle: wendeAn(quelle, [{ von: k.start, bis: k.ende, text: html }]), nr: k.nr };
};

/** `clip-path` im `style` setzen bzw. ersetzen; der Rest bleibt an seinem Platz. */
const setzeStil = (stil: string | null, clipPath: string | null) => {
	const teile = (stil ?? '')
		.split(';')
		.map((t) => t.trim())
		.filter(Boolean)
		.filter((t) => t.slice(0, t.indexOf(':')).trim().toLowerCase() !== 'clip-path');
	if (clipPath) {
		teile.push(`clip-path:${clipPath}`);
	}
	return teile.join(';') || null;
};

/** Ein Bild in den leeren Bildrahmen `nr`: Der Rahmen wird zum Bild mit derselben Maske und Lage. Ein Schritt. */
export const fuelleBildrahmen = (quelle: string, nr: number, bild: { src: string; alt: string }): StrukturErgebnis => {
	const k = knotenAn(quelle, nr);
	if (!istBildrahmenLeer(k)) {
		throw new Error('Das ist kein leerer Bildrahmen.');
	}
	const maske = attribut(k, 'data-maske')?.wert ?? 'ellipse';
	const form = formVon(maske);
	const { b, h } = groesseVon(quelle, nr);
	const clip = form ? maskeFuer(maske, vollstaendig(form, (a) => attribut(k, a)?.wert), b, h) : null;
	return ersetzeDurchBild(quelle, k, maske, clip ?? stilWert(attribut(k, 'style')?.wert ?? null, 'clip-path'), bild);
};

/**
 * Ein Bild in die Form ohne Text `formNr`: Die Form verschwindet, an ihrer Stelle liegt ein freies Bild mit ihrer Lage
 * (auch `--drehen`) und ihrer Form als Maske. Ebene und Reihenfolge bleiben. Ein Schritt.
 */
export const bildInForm = (quelle: string, formNr: number, bild: { src: string; alt: string }): StrukturErgebnis => {
	const k = knotenAn(quelle, formNr);
	if (!istMaskenFormKnoten(k)) {
		throw new Error('Zuschneiden geht nur in eine Form ohne Text.');
	}
	const art = attribut(k, 'data-form')?.wert ?? '';
	const form = formVon(art);
	const { b, h } = groesseVon(quelle, formNr);
	const clip = form ? maskeFuer(art, vollstaendig(form, (a) => attribut(k, a)?.wert), b, h) : null;
	// Pfad und Verlauf stehen im svg und fallen mit ihm weg.
	return ersetzeDurchBild(quelle, k, art, clip, bild);
};

/** Der Ausschnitt (`--bx`, `--by`) in Prozent, 0–100, auf ganze Prozent gerundet. */
export const setzeAusschnitt = (quelle: string, nr: number, bx: number, by: number) => {
	if (!istBildFrei(knotenAn(quelle, nr))) {
		throw new Error('Den Ausschnitt gibt es nur bei freien Bildern.');
	}
	const prozent = (w: number) => `${Math.round(Math.min(100, Math.max(0, Number.isFinite(w) ? w : 50)))}%`;
	return setzeStilWerte(quelle, nr, { '--bx': prozent(bx), '--by': prozent(by) });
};

/** Nimmt den Zuschnitt weg: `--h`, `--bx`, `--by`. Das Bild hat danach wieder die Höhe aus der Datei. */
export const setzeZuschnittZurueck = (quelle: string, nr: number) => {
	if (!istBildFrei(knotenAn(quelle, nr))) {
		throw new Error('Den Zuschnitt gibt es nur bei freien Bildern.');
	}
	return setzeStilWerte(quelle, nr, { '--h': null, '--bx': null, '--by': null });
};
