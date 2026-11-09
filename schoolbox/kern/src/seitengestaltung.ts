/**
 * Seitenfläche und Seitenrahmen (Briefing 3.6, Ticket 095): je Seite höchstens eine `.seitenflaeche` und ein
 * `.seitenrahmen`, beide immer zuunterst in `.ebene.hinten`, die Fläche zuerst. Sie haben kein `data-lage`, denn sie
 * füllen die Seite und lassen sich nicht ziehen. Werte stehen als Attribute (`data-flaeche`, `data-muster`,
 * `data-rahmen`, `data-sw`) und als eigene Eigenschaften im `style`; wie sie aussehen, regelt `blatt.css`.
 *
 * Ändert die Lehrkraft Fläche oder Rahmen eines Rezepts (`data-aufmachung-teil`, 114), verlieren sie das Kennzeichen
 * und die Sperre; danach erzeugt das Rezept sie auf dieser Seite nicht mehr neu.
 */

import type { SwVerhalten } from './gestaltung';
import { istEbene, raeumeEbenenAuf } from './gestaltung';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	fuegeEin,
	klassenVon,
	rueckeUm,
	schuetzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';

export const FLAECHEN_ARTEN = ['farbe', 'verlauf', 'muster'] as const;
export type FlaechenArt = (typeof FLAECHEN_ARTEN)[number];

export const MUSTER_ARTEN = ['streifen', 'punkte', 'karo', 'schraeg'] as const;
export type MusterArt = (typeof MUSTER_ARTEN)[number];

export const RAHMEN_ARTEN = ['linie', 'doppelt', 'gestrichelt', 'gepunktet'] as const;
export type RahmenArt = (typeof RAHMEN_ARTEN)[number];

/** Werte der Seitenfläche. Was fehlt (`undefined`/`null`), schreibt der Kern nicht; dann gilt der Standard aus `blatt.css`. */
export interface Seitenflaeche {
	art: FlaechenArt;
	/** Farbe bzw. Grund des Musters. */
	f1?: string | null;
	/** Zweite Farbe des Verlaufs bzw. Farbe des Musters. */
	f2?: string | null;
	/** Grad, nur beim Verlauf. */
	winkel?: number | null;
	muster?: MusterArt | null;
	/** px, nur beim Muster. */
	musterGroesse?: number | null;
	/** `null`: Standard der Seitenfläche, in s/w weg. */
	sw?: SwVerhalten | null;
}

export interface Seitenrahmen {
	art: RahmenArt;
	farbe?: string | null;
	/** px */
	staerke?: number | null;
	/** px vom Blattrand; Standard 24, im Mini-Book 8 */
	abstand?: number | null;
	/** px Eckenradius */
	ecke?: number | null;
	/** `null`: Standard des Seitenrahmens, in s/w grau. */
	sw?: SwVerhalten | null;
}

/** Wie gelesen: dazu, ob das Teil von einem Rezept stammt (`data-aufmachung-teil`). */
export type Gelesen<T> = T & { rezept: boolean };

export interface Seitengestaltung {
	flaeche: Gelesen<Seitenflaeche> | null;
	rahmen: Gelesen<Seitenrahmen> | null;
}

/** Welche Seiten: Nummern der `.seite` in der Quelle (wie `legeGestaltungAb`) oder alle. */
export type Seiten = readonly number[] | 'alle';

/** Standardabstand des Rahmens vom Blattrand: außerhalb des Druckrands (19 px). Im Mini-Book 8 px. */
export const RAHMEN_ABSTAND = 24;
export const RAHMEN_ABSTAND_MINIBUCH = 8;
export const RAHMEN_STAERKE = 2;
export const MUSTER_GROESSE = 24;
export const WINKEL = 180;

const REZEPT = 'data-aufmachung-teil';
const FLAECHE = 'seitenflaeche';
const RAHMEN = 'seitenrahmen';
const EINZUG = '  ';

// ── Werte prüfen ────────────────────────────────────────────────────────────

const FARBE = /^(?:var\(--[a-z][a-z0-9-]*\)|#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;

/** Nur Farben der Palette als Variable und Hex (3.9); alles andere wäre ein Weg, beliebiges CSS ins `style` zu bringen. */
export const istFarbe = (wert: string) => FARBE.test(wert.trim());

const farbe = (wert: string | null | undefined) => {
	if (wert === null || wert === undefined) {
		return null;
	}
	if (!istFarbe(wert)) {
		throw new Error(`„${wert}“ ist keine Farbe.`);
	}
	return wert.trim().toLowerCase();
};

const zahl = (wert: number | null | undefined, min: number, max: number) =>
	wert === null || wert === undefined || !Number.isFinite(wert)
		? null
		: Math.round(Math.max(min, Math.min(max, wert)));

// ── style lesen und schreiben ───────────────────────────────────────────────

const stilTeile = (stil: string | null | undefined) =>
	(stil ?? '')
		.split(';')
		.map((t) => t.trim())
		.filter(Boolean);

const stilWert = (stil: string | null | undefined, name: string) => {
	const teil = stilTeile(stil).find((t) => t.slice(0, t.indexOf(':')).trim() === name);
	return teil === undefined ? null : teil.slice(teil.indexOf(':') + 1).trim();
};

const stilZahl = (stil: string | null | undefined, name: string) => {
	const w = parseFloat(stilWert(stil, name) ?? '');
	return Number.isFinite(w) ? w : null;
};

/**
 * Setzt `werte` im `style`: Diese Eigenschaften stehen danach genau so (in dieser Reihenfolge, `null` fehlt), alles
 * andere im `style` bleibt davor stehen.
 */
const stilMit = (stil: string | null, verwaltet: readonly string[], werte: readonly [string, string | null][]) => {
	const rest = stilTeile(stil).filter((t) => !verwaltet.includes(t.slice(0, t.indexOf(':')).trim()));
	const neu = werte.flatMap(([name, wert]) => (wert === null ? [] : [`${name}:${wert}`]));
	return [...rest, ...neu].join(';') || null;
};

// ── Lesen ───────────────────────────────────────────────────────────────────

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

const seitenIn = (z: Zerlegung) => z.knoten.filter((k) => hat(k, 'seite'));

const hintenIn = (seite: Knoten) => seite.kinder.find((k) => istEbene(k) && hat(k, 'hinten'));

const teilIn = (seite: Knoten, klasse: string) => hintenIn(seite)?.kinder.find((k) => hat(k, klasse));

const auswahl = <T extends string>(liste: readonly T[], wert: string | null | undefined): T | null =>
	liste.find((w) => w === wert) ?? null;

const swVon = (k: Knoten): SwVerhalten | null => auswahl(['grau', 'weg'] as const, attribut(k, 'data-sw')?.wert);

const leseFlaeche = (k: Knoten): Gelesen<Seitenflaeche> => {
	const stil = attribut(k, 'style')?.wert;
	return {
		art: auswahl(FLAECHEN_ARTEN, attribut(k, 'data-flaeche')?.wert) ?? 'farbe',
		f1: stilWert(stil, '--f1'),
		f2: stilWert(stil, '--f2'),
		winkel: stilZahl(stil, '--winkel'),
		muster: auswahl(MUSTER_ARTEN, attribut(k, 'data-muster')?.wert),
		musterGroesse: stilZahl(stil, '--muster-groesse'),
		sw: swVon(k),
		rezept: attribut(k, REZEPT) !== undefined,
	};
};

const leseRahmen = (k: Knoten): Gelesen<Seitenrahmen> => {
	const stil = attribut(k, 'style')?.wert;
	return {
		art: auswahl(RAHMEN_ARTEN, attribut(k, 'data-rahmen')?.wert) ?? 'linie',
		farbe: stilWert(stil, '--rahmen-farbe'),
		staerke: stilZahl(stil, '--rahmen-staerke'),
		abstand: stilZahl(stil, '--rahmen-abstand'),
		ecke: stilZahl(stil, '--rahmen-ecke'),
		sw: swVon(k),
		rezept: attribut(k, REZEPT) !== undefined,
	};
};

const seiteAn = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k || !hat(k, 'seite')) {
		throw new Error(`Das Element ${nr} ist keine Seite.`);
	}
	return k;
};

/** Fläche und Rahmen der Seite `seite` (Nummer der `.seite`), je `null`, wenn es sie nicht gibt. */
export const leseSeitengestaltung = (quelle: string, seite: number): Seitengestaltung => {
	const s = seiteAn(zerlege(quelle), seite);
	const f = teilIn(s, FLAECHE);
	const r = teilIn(s, RAHMEN);
	return { flaeche: f ? leseFlaeche(f) : null, rahmen: r ? leseRahmen(r) : null };
};

// ── Schreiben ───────────────────────────────────────────────────────────────

interface Teil {
	klasse: string;
	/** Attribute in fester Reihenfolge; `null` fehlt. */
	attribute: readonly [string, string | null][];
	/** Eigenschaften, die der Kern im `style` verwaltet, und ihre Werte. */
	verwaltet: readonly string[];
	stil: readonly [string, string | null][];
}

const px = (n: number | null) => (n === null ? null : `${n}px`);

const FLAECHE_STIL = ['--f1', '--f2', '--winkel', '--muster-groesse'] as const;
const RAHMEN_STIL = ['--rahmen-farbe', '--rahmen-staerke', '--rahmen-abstand', '--rahmen-ecke'] as const;

const flaechenTeil = (w: Seitenflaeche): Teil => {
	const verlauf = w.art === 'verlauf';
	const muster = w.art === 'muster';
	const winkel = zahl(w.winkel, -360, 360);
	return {
		klasse: FLAECHE,
		attribute: [
			['data-flaeche', w.art],
			['data-muster', muster ? (w.muster ?? 'streifen') : null],
			// Standard der Fläche ist „weg“: Nur „grau“ steht da.
			['data-sw', w.sw === 'grau' ? 'grau' : null],
		],
		verwaltet: FLAECHE_STIL,
		stil: [
			['--f1', farbe(w.f1)],
			['--f2', verlauf || muster ? farbe(w.f2) : null],
			['--winkel', verlauf && winkel !== null ? `${winkel}deg` : null],
			['--muster-groesse', muster ? px(zahl(w.musterGroesse, 4, 200)) : null],
		],
	};
};

const rahmenTeil = (w: Seitenrahmen): Teil => ({
	klasse: RAHMEN,
	attribute: [
		['data-rahmen', w.art],
		// Standard des Rahmens ist „grau“: Nur „weg“ steht da.
		['data-sw', w.sw === 'weg' ? 'weg' : null],
	],
	verwaltet: RAHMEN_STIL,
	stil: [
		['--rahmen-farbe', farbe(w.farbe)],
		['--rahmen-staerke', px(zahl(w.staerke, 1, 40))],
		['--rahmen-abstand', px(zahl(w.abstand, 0, 200))],
		['--rahmen-ecke', px(zahl(w.ecke, 0, 200))],
	],
});

const attributText = ([name, wert]: readonly [string, string | null]) =>
	wert === null ? '' : ` ${name}="${schuetzeAttribut(wert)}"`;

const neuesElement = (t: Teil) => {
	const stil = stilMit(null, t.verwaltet, t.stil);
	const attribute = [...t.attribute, ['style', stil] as const].map(attributText).join('');
	return `<div class="${t.klasse}"${attribute}></div>`;
};

/** Der neue Start-Tag eines vorhandenen Teils: eigene Attribute ersetzt, fremde (Klassen, `data-name` …) bleiben. */
const neuerStartTag = (z: Zerlegung, k: Knoten, t: Teil) => {
	const eigene = new Set([...t.attribute.map(([n]) => n), 'style', ...(attribut(k, REZEPT) ? [REZEPT, 'data-gesperrt'] : [])]); // 114
	const stil = stilMit(attribut(k, 'style')?.wert ?? null, t.verwaltet, t.stil);
	const fremde = k.attribute
		.filter((a) => !eigene.has(a.name))
		.map((a) => ` ${z.quelle.slice(a.start, a.ende)}`)
		.join('');
	const ende = /\s*\/?>$/.exec(z.quelle.slice(k.start, k.oeffnerEnde))?.[0].trim() ?? '>';
	return `<${k.tag}${fremde}${[...t.attribute, ['style', stil] as const].map(attributText).join('')}${ende}`;
};

/**
 * Legt `html` zuunterst in `.ebene.hinten` der Seite: an den Anfang, bzw. mit `nach` direkt hinter dieses Element. Fehlt
 * die Ebene, entsteht sie am Ende der Seite, vor `.ebene.vorne`.
 */
const legeZuunterst = (z: Zerlegung, seite: Knoten, html: string, nach: Knoten | undefined): Aenderung[] => {
	const ebene = hintenIn(seite);
	if (ebene) {
		if (nach) {
			return fuegeEin(z, nach, 'nach', html);
		}
		const erstes = ebene.kinder[0];
		if (erstes) {
			return fuegeEin(z, erstes, 'vor', html);
		}
		return [{ von: ebene.oeffnerEnde, bis: ebene.oeffnerEnde, text: html }];
	}
	const vorne = seite.kinder.find((k) => istEbene(k) && hat(k, 'vorne'));
	const ziel = vorne ?? seite.kinder.at(-1);
	const huelle = '<div class="ebene hinten">';
	if (!ziel) {
		return [{ von: seite.schliesserStart, bis: seite.schliesserStart, text: `${huelle}${html}</div>` }];
	}
	const aussen = einrueckung(z, ziel);
	const innen = aussen === null ? null : `${aussen}${EINZUG}`;
	const neu = rueckeUm(html, null, innen);
	const block = aussen === null ? `${huelle}${neu}</div>` : `${huelle}\n${innen}${neu}\n${aussen}</div>`;
	return fuegeEin(z, ziel, vorne ? 'vor' : 'nach', block);
};

/** Ein Teil auf einer Seite (Index unter den Seiten) setzen, ändern oder entfernen. */
const setzeTeil = (quelle: string, index: number, klasse: string, teil: Teil | null): string => {
	const z = zerlege(quelle);
	const seite = seitenIn(z)[index];
	if (!seite) {
		return quelle;
	}
	const da = teilIn(seite, klasse);
	if (!teil) {
		return da ? raeumeEbenenAuf(wendeAn(quelle, entferne(z, da))) : quelle;
	}
	if (da) {
		const neu = neuerStartTag(z, da, teil);
		return neu === quelle.slice(da.start, da.oeffnerEnde)
			? quelle
			: wendeAn(quelle, [{ von: da.start, bis: da.oeffnerEnde, text: neu }]);
	}
	// Die Fläche zuerst, der Rahmen direkt darüber.
	const nach = klasse === RAHMEN ? teilIn(seite, FLAECHE) : undefined;
	return wendeAn(quelle, legeZuunterst(z, seite, neuesElement(teil), nach));
};

const indizes = (quelle: string, seiten: Seiten) => {
	const z = zerlege(quelle);
	const alle = seitenIn(z);
	if (seiten === 'alle') {
		return alle.map((_, i) => i);
	}
	return [...new Set(seiten)].map((nr) => alle.indexOf(seiteAn(z, nr)));
};

/** Von hinten nach vorne, damit die Seiten davor ihre Stelle behalten; ein Schritt im Verlauf ist es so oder so. */
const aufSeiten = (quelle: string, seiten: Seiten, klasse: string, teil: Teil | null) =>
	indizes(quelle, seiten)
		.sort((a, b) => b - a)
		.reduce((q, i) => setzeTeil(q, i, klasse, teil), quelle);

/** Setzt die Seitenfläche auf den Seiten (`null` entfernt sie und mit ihr eine leere Ebene). */
export const setzeSeitenflaeche = (quelle: string, seiten: Seiten, wert: Seitenflaeche | null) =>
	aufSeiten(quelle, seiten, FLAECHE, wert ? flaechenTeil(wert) : null);

/** Setzt den Seitenrahmen auf den Seiten (`null` entfernt ihn und mit ihm eine leere Ebene). */
export const setzeSeitenrahmen = (quelle: string, seiten: Seiten, wert: Seitenrahmen | null) =>
	aufSeiten(quelle, seiten, RAHMEN, wert ? rahmenTeil(wert) : null);

/**
 * Liegt das Element `nr` vor allem, was sich von `alt` zu `neu` geändert hat? Dann hat es danach dieselbe Nummer, und die
 * Auswahl darf bleiben. Fläche und Rahmen stehen am Ende der Seite, eine Auswahl auf derselben Seite bleibt also.
 */
export const bleibtNummer = (alt: string, neu: string, nr: number) => {
	const k = zerlege(alt).knoten[nr];
	if (!k || alt === neu) {
		return Boolean(k);
	}
	let gleich = 0;
	while (gleich < alt.length && gleich < neu.length && alt[gleich] === neu[gleich]) {
		gleich += 1;
	}
	// Wo ein neues Element mit denselben Zeichen beginnt wie das alte dort, zählt die Stelle seines `<`.
	return k.start < alt.lastIndexOf('<', gleich);
};

/** Die Nummern aller `.seite` in der Quelle, in ihrer Reihenfolge. */
export const seitenNummern = (quelle: string) => seitenIn(zerlege(quelle)).map((k) => k.nr);
