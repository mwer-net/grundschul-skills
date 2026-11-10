/**
 * Gestaltung in der Quelle (Phase 12, Entscheidungen 41 und 45): Elemente mit `data-lage="frei"` in den Ebenen
 * `.ebene.hinten` und `.ebene.vorne` am Ende jeder Seite oder mit `data-anker` in einem Baustein. Alles hier sind reine
 * Umformungen der Quelle über Text-Patches (`quelltext.ts`), wie in `struktur.ts`. Ein Material ohne Gestaltung kommt
 * Zeichen für Zeichen unverändert zurück (Entscheidung 26).
 *
 * Eine Ebene gibt es nur, wenn sie etwas enthält: Sie entsteht mit dem ersten Element und verschwindet mit dem letzten.
 * In einer Ebene liegt vorne, was in der Quelle später kommt.
 */

import { loeseVorSeitenwechsel } from './anker';
import type { EbenenName } from './gestaltung-arten';
import { GESTALTUNG_ARTEN, LAGE } from './gestaltung-arten';
import { nachGroesse } from './groessen-folgen';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	fuegeEin,
	innenVon,
	klassenVon,
	quelleVon,
	rueckeUm,
	schuetzeAttribut,
	setzeAttribut,
	verschiebe,
	wendeAn,
	zerlege,
} from './quelltext';
import { passt } from './referenz';
import type { StrukturErgebnis } from './struktur';

const EINZUG = '  ';
/** Um so viel liegt eine Kopie nach rechts unten versetzt (3.11). */
export const VERSATZ_KOPIE = 16;

// ── Lage ────────────────────────────────────────────────────────────────────

/** Die Lage als CSS-Variablen im `style` (3.3). Fehlt ein Wert, gilt der Standard aus `blatt.css`. */
export interface Lage {
	x?: number;
	y?: number;
	b?: number;
	h?: number;
	drehen?: number;
	spiegeln?: number;
}

/** Was `setzeLage` ändert: eine Zahl setzt, `null` entfernt, ohne Angabe bleibt der Wert. */
export type LageTeil = { [S in keyof Lage]?: number | null };

const LAGE_VARIABLEN: readonly { schluessel: keyof Lage; name: string; schreibe: (wert: number) => string }[] = [
	{ schluessel: 'x', name: '--x', schreibe: (w) => `${Math.round(w)}px` },
	{ schluessel: 'y', name: '--y', schreibe: (w) => `${Math.round(w)}px` },
	{ schluessel: 'b', name: '--b', schreibe: (w) => `${Math.round(w)}px` },
	{ schluessel: 'h', name: '--h', schreibe: (w) => `${Math.round(w)}px` },
	{ schluessel: 'drehen', name: '--drehen', schreibe: (w) => `${Math.round(w * 10) / 10}deg` },
	{ schluessel: 'spiegeln', name: '--spiegeln', schreibe: (w) => (w < 0 ? '-1' : '1') },
];

const stilTeile = (stil: string | null) =>
	(stil ?? '')
		.split(';')
		.map((teil) => teil.trim())
		.filter(Boolean);

const eigenschaft = (teil: string) => teil.slice(0, teil.indexOf(':')).trim();

const lageAusStil = (stil: string | null): Lage => {
	const lage: Lage = {};
	for (const teil of stilTeile(stil)) {
		const v = LAGE_VARIABLEN.find((l) => l.name === eigenschaft(teil));
		const zahl = parseFloat(teil.slice(teil.indexOf(':') + 1));
		if (v && Number.isFinite(zahl)) {
			lage[v.schluessel] = zahl;
		}
	}
	return lage;
};

/**
 * Setzt die Lage im `style`-Wert. Neue Variablen kommen an ihren Platz in der Reihenfolge `--x --y --b --h --drehen
 * --spiegeln`, alles andere im `style` bleibt, wo es ist. `null`, wenn nichts übrig bleibt.
 */
export const stilMitLage = (stil: string | null, teil: LageTeil): string | null => {
	const teile = stilTeile(stil);
	const rang = (t: string) => LAGE_VARIABLEN.findIndex((l) => l.name === eigenschaft(t));
	for (const [i, v] of LAGE_VARIABLEN.entries()) {
		const wert = teil[v.schluessel];
		if (wert === undefined) {
			continue;
		}
		const da = teile.findIndex((t) => eigenschaft(t) === v.name);
		if (wert === null || !Number.isFinite(wert)) {
			if (da !== -1) {
				teile.splice(da, 1);
			}
			continue;
		}
		const neu = `${v.name}:${v.schreibe(wert)}`;
		if (da !== -1) {
			teile[da] = neu;
			continue;
		}
		const davor = teile.findLastIndex((t) => rang(t) !== -1 && rang(t) < i);
		const dahinter = teile.findIndex((t) => rang(t) > i);
		let stelle = 0;
		if (davor !== -1) {
			stelle = davor + 1;
		} else if (dahinter !== -1) {
			stelle = dahinter;
		}
		teile.splice(stelle, 0, neu);
	}
	return teile.join(';') || null;
};

// ── Hilfen ──────────────────────────────────────────────────────────────────

const hat = (k: Knoten | null | undefined, klasse: string) => Boolean(k && klassenVon(k).includes(klasse));

/** Ein Gestaltungselement: `data-lage="frei"`. */
export const istGestaltung = (k: Knoten) => attribut(k, LAGE)?.wert === 'frei';

export const istEbene = (k: Knoten | null | undefined) => hat(k, 'ebene');

const ebeneName = (k: Knoten | null | undefined): EbenenName | null => {
	if (!istEbene(k)) {
		return null;
	}
	if (hat(k, 'hinten')) {
		return 'hinten';
	}
	return hat(k, 'vorne') ? 'vorne' : null;
};

const seitenIn = (z: Zerlegung) => z.knoten.filter((k) => hat(k, 'seite'));

const seiteUm = (k: Knoten) => {
	let e = k.eltern;
	while (e && !hat(e, 'seite')) {
		e = e.eltern;
	}
	return e;
};

const ebeneIn = (seite: Knoten, name: EbenenName) => seite.kinder.find((k) => istEbene(k) && hat(k, name));

/** Seitenfläche und Seitenrahmen liegen immer zuunterst in `.ebene.hinten` (3.6). */
const zuunterst = (k: Knoten) => hat(k, 'seitenflaeche') || hat(k, 'seitenrahmen');

const knotenAn = (z: Zerlegung, nr: number) => {
	const k = z.knoten[nr];
	if (!k) {
		throw new Error(`Das Element ${nr} gibt es nicht.`);
	}
	return k;
};

const gestaltungAn = (z: Zerlegung, nr: number) => {
	const k = knotenAn(z, nr);
	if (!istGestaltung(k)) {
		throw new Error(`Das Element ${nr} ist keine Gestaltung.`);
	}
	return k;
};

/** Das Gestaltungselement liegt in einer Ebene der Seite, nicht an einem Baustein (Anker: 106). */
const inEbeneAn = (z: Zerlegung, nr: number) => {
	const k = gestaltungAn(z, nr);
	const ebene = ebeneName(k.eltern);
	const seite = seiteUm(k);
	if (!ebene || !seite) {
		throw new Error('Das Element hängt an einem Baustein und liegt in keiner Ebene.');
	}
	return { k, ebene, seite: seitenIn(z).indexOf(seite) };
};

/** Wo der erste Buchstabe von `a.text` steht, nachdem alle Änderungen angewendet sind (wie in `struktur.ts`). */
const positionNach = (aenderungen: Aenderung[], a: Aenderung, versatz: number) =>
	aenderungen.reduce(
		(pos, c) => (c !== a && c.bis <= a.von ? pos + c.text.length - (c.bis - c.von) : pos),
		a.von + versatz,
	);

/** Die neue Quelle und die Nummer des Elements, das an `versatz` in `eingefuegt.text` beginnt. */
const ergebnis = (
	quelle: string,
	aenderungen: Aenderung[],
	eingefuegt: Aenderung | undefined,
	versatz: number,
): StrukturErgebnis => {
	const neu = wendeAn(quelle, aenderungen);
	if (!eingefuegt) {
		return { quelle: neu, nr: null };
	}
	const start = positionNach(aenderungen, eingefuegt, versatz);
	return { quelle: neu, nr: zerlege(neu).knoten.find((k) => k.start === start)?.nr ?? null };
};

/** Ein Attribut ohne Wert (`data-aus`), am Ende des Start-Tags. */
const setzeSchalter = (z: Zerlegung, k: Knoten, name: string, an: boolean): Aenderung[] => {
	if (!an) {
		return setzeAttribut(z, k, name, null);
	}
	if (attribut(k, name)) {
		return [];
	}
	const tag = z.quelle.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	return [{ von: pos, bis: pos, text: ` ${name}` }];
};

/** Ein Attribut mit Wert; neu am Ende des Start-Tags, vorhanden an seiner Stelle. */
const setzeWert = (z: Zerlegung, k: Knoten, name: string, wert: string | null): Aenderung[] => {
	if (wert === null || attribut(k, name)) {
		return setzeAttribut(z, k, name, wert);
	}
	const tag = z.quelle.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	return [{ von: pos, bis: pos, text: ` ${name}="${schuetzeAttribut(wert)}"` }];
};

/** Die äußere Hülle von `html` mit Lage und `data-lage="frei"`; der Rest bleibt Zeichen für Zeichen. */
export const htmlMitLage = (html: string, teil: LageTeil) => {
	const z = zerlege(html);
	const k = z.wurzeln[0];
	if (!k) {
		throw new Error('Das Element ist leer.');
	}
	const stil = stilMitLage(attribut(k, 'style')?.wert ?? null, teil);
	// Beide kommen ans Ende des Start-Tags; was später in der Liste steht, landet weiter vorne.
	const aenderungen = [
		...(stil === (attribut(k, 'style')?.wert ?? null) ? [] : setzeWert(z, k, 'style', stil)),
		...(istGestaltung(k) ? [] : setzeWert(z, k, LAGE, 'frei')),
	];
	return wendeAn(html, aenderungen);
};

/** Ohne Angabe: die Ebene, die das Register der Art zuordnet (Streuung hinten, sonst vorne). */
const standardEbene = (html: string): EbenenName => {
	const k = zerlege(html).wurzeln[0];
	const art = k && GESTALTUNG_ARTEN.find((a) => a.ebene && passt(k, a.selektor, false));
	return art?.ebene ?? 'vorne';
};

const istLeer = (z: Zerlegung, k: Knoten) =>
	k.kinder.length === 0 &&
	innenVon(z, k)
		.replace(/<!--[\s\S]*?-->/g, '')
		.trim() === '';

/** Entfernt ein Element; war es das letzte seiner Ebene, gleich die ganze Ebene. */
export const entferneMitEbene = (z: Zerlegung, k: Knoten): Aenderung[] => {
	const eltern = k.eltern;
	if (eltern && istEbene(eltern) && eltern.kinder.length === 1) {
		const rest = innenVon(z, eltern)
			.replace(quelleVon(z, k), '')
			.replace(/<!--[\s\S]*?-->/g, '');
		if (rest.trim() === '') {
			return entferne(z, eltern);
		}
	}
	return entferne(z, k);
};

/**
 * Legt `html` in die Ebene `ebene` der Seite mit Index `seite`: ans Ende (ganz vorne) oder an den Anfang (ganz hinten,
 * aber über Seitenfläche und Seitenrahmen). Fehlt die Ebene, entsteht sie am Ende der Seite, `hinten` vor `vorne`.
 * `einzug`: die Einrückung, in der `html` geschrieben ist, damit Folgezeilen mitwandern.
 */
const legeIn = (
	quelle: string,
	seite: number,
	ebene: EbenenName,
	html: string,
	wo: 'anfang' | 'ende',
	einzug: string | null = null,
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const s = seitenIn(z)[seite];
	if (!s) {
		throw new Error('Diese Seite gibt es nicht.');
	}
	const vorhanden = ebeneIn(s, ebene);
	if (vorhanden) {
		const erstes = vorhanden.kinder.find((k) => !zuunterst(k));
		const ziel = wo === 'anfang' && erstes ? erstes : vorhanden.kinder.at(-1);
		if (!ziel) {
			const a: Aenderung = { von: vorhanden.oeffnerEnde, bis: vorhanden.schliesserStart, text: html };
			return ergebnis(quelle, [a], a, 0);
		}
		const davor = wo === 'anfang' && erstes ? 'vor' : 'nach';
		const neu = rueckeUm(html, einzug, einrueckung(z, ziel));
		const a = fuegeEin(z, ziel, davor, neu);
		return ergebnis(quelle, a, a[0], a[0]?.text.indexOf(neu) ?? 0);
	}
	const vorne = ebene === 'hinten' ? ebeneIn(s, 'vorne') : undefined;
	const ziel = vorne ?? s.kinder.at(-1);
	const huelle = `<div class="ebene ${ebene}">`;
	if (!ziel) {
		const text = `${huelle}${html}</div>`;
		const a: Aenderung = { von: s.schliesserStart, bis: s.schliesserStart, text };
		return ergebnis(quelle, [a], a, huelle.length);
	}
	const aussen = einrueckung(z, ziel);
	const innen = aussen === null ? null : `${aussen}${EINZUG}`;
	const neu = rueckeUm(html, einzug, innen);
	const block = aussen === null ? `${huelle}${neu}</div>` : `${huelle}\n${innen}${neu}\n${aussen}</div>`;
	const a = fuegeEin(z, ziel, vorne ? 'vor' : 'nach', block);
	const erste = a[0];
	return ergebnis(quelle, a, erste, (erste?.text.indexOf(huelle) ?? 0) + block.indexOf(neu));
};

/** Nimmt das Element heraus und legt es neu in eine Ebene, auf Wunsch mit neuer Lage. */
const legeUm = (
	quelle: string,
	nr: number,
	ziel: { seite: number; ebene: EbenenName; wo: 'anfang' | 'ende'; lage?: LageTeil },
): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const html = ziel.lage ? htmlMitLage(quelleVon(z, k), ziel.lage) : quelleVon(z, k);
	const ohne = wendeAn(quelle, entferneMitEbene(z, k));
	return legeIn(ohne, ziel.seite, ziel.ebene, html, ziel.wo, einrueckung(z, k));
};

// ── Ablegen und Lage ────────────────────────────────────────────────────────

export interface Ablegen {
	/** Nummer der Seite (`.seite`) in der Quelle. */
	seite: number;
	/** Ohne Angabe die Standard-Ebene der Art. */
	ebene?: EbenenName;
	/** Ein Element; `data-lage="frei"` setzt die Funktion selbst. */
	html: string;
	lage?: LageTeil;
}

/** Legt ein neues Gestaltungselement ganz nach vorne in seine Ebene. Fehlt die Ebene, entsteht sie. */
export const legeGestaltungAb = (quelle: string, { ebene, html, lage, seite }: Ablegen): StrukturErgebnis => {
	const z = zerlege(quelle);
	const index = seitenIn(z).indexOf(knotenAn(z, seite));
	if (index === -1) {
		throw new Error(`Das Element ${seite} ist keine Seite.`);
	}
	// 110: Ein Gut mit Ids (Titel im Bogen) bekommt beim Ablegen eigene, im Dokument freie Ids.
	const mitLage = htmlMitLage(html.trim(), lage ?? {});
	const fertig = /\sid\s*=/.test(mitLage) ? neueSvgIds(mitLage, quelle) : mitLage;
	return legeIn(quelle, index, ebene ?? standardEbene(fertig), fertig, 'ende');
};

export const leseLage = (quelle: string, nr: number): Lage => {
	const z = zerlege(quelle);
	return lageAusStil(attribut(knotenAn(z, nr), 'style')?.wert ?? null);
};

/** Ganze px, die Drehung auf eine Nachkommastelle. Fehlende Werte bleiben weg, sie werden nicht als 0 geschrieben. */
export const setzeLage = (quelle: string, nr: number, teil: LageTeil) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	const alt = attribut(k, 'style')?.wert ?? null;
	const neu = stilMitLage(alt, teil);
	if (neu === alt) {
		return quelle;
	}
	const geaendert = wendeAn(quelle, setzeWert(z, k, 'style', neu));
	// 104: Was seinen Inhalt aus der Größe erzeugt (Formen …), zeichnet sich neu (`groessen-folgen.ts`).
	return teil.b === undefined && teil.h === undefined ? geaendert : nachGroesse(geaendert, nr);
};

// ── Reihenfolge und Ebenen ──────────────────────────────────────────────────

export type Richtung = 'vor' | 'zurueck' | 'ganz-vor' | 'ganz-zurueck';

/**
 * Ein Platz nach vorne bzw. hinten, oder ganz. An der Grenze wechselt die Ebene (5.6): Wer in `hinten` schon vorne
 * liegt, kommt mit „nach vorne“ zuunterst nach `vorne`, mit „ganz nach vorne“ an dessen Spitze; umgekehrt genauso.
 * Am Anker gibt es keine zweite Ebene, dort bleibt es an der Grenze, wie es ist.
 */
export const ordneInEbene = (quelle: string, nr: number, richtung: Richtung): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const geschwister = (k.eltern?.kinder ?? []).filter(istGestaltung);
	const i = geschwister.indexOf(k);
	const vor = richtung === 'vor' || richtung === 'ganz-vor';
	const ganz = richtung === 'ganz-vor' || richtung === 'ganz-zurueck';
	const ziel = vor ? geschwister[ganz ? geschwister.length - 1 : i + 1] : geschwister[ganz ? 0 : i - 1];
	if (ziel && ziel !== k) {
		const a = verschiebe(z, k, ziel, vor ? 'nach' : 'vor');
		return ergebnis(quelle, a, a[1], a[1]?.text.indexOf('<') ?? 0);
	}
	const ebene = ebeneName(k.eltern);
	const seite = seiteUm(k);
	const andere = vor ? 'vorne' : 'hinten';
	if (!ebene || ebene === andere || !seite) {
		return { quelle, nr };
	}
	const wo = vor === ganz ? 'ende' : 'anfang';
	return legeUm(quelle, nr, { seite: seitenIn(z).indexOf(seite), ebene: andere, wo });
};

/** In die andere Ebene derselben Seite, dort ganz nach vorne. Nur für Elemente in einer Ebene, nicht am Anker. */
export const wechsleEbene = (quelle: string, nr: number, ebene: EbenenName): StrukturErgebnis => {
	const z = zerlege(quelle);
	const jetzt = inEbeneAn(z, nr);
	if (jetzt.ebene === ebene) {
		return { quelle, nr };
	}
	return legeUm(quelle, nr, { seite: jetzt.seite, ebene, wo: 'ende' });
};

/**
 * Auf eine andere Seite (`seite`: Nummer der `.seite`), in dieselbe Ebene, ganz nach vorne, mit neuer Lage. Ein Element
 * am Anker wird dabei gelöst und liegt danach vorne (106).
 */
export const verschiebeAufSeite = (vorher: string, alt: number, ziel: number, lage: LageTeil): StrukturErgebnis => {
	const { nr, quelle, seite } = loeseVorSeitenwechsel(vorher, alt, ziel); // 106
	const z = zerlege(quelle);
	const jetzt = inEbeneAn(z, nr);
	const index = seitenIn(z).indexOf(knotenAn(z, seite));
	if (index === -1) {
		throw new Error(`Das Element ${seite} ist keine Seite.`);
	}
	return legeUm(quelle, nr, { seite: index, ebene: jetzt.ebene, wo: 'ende', lage });
};

// ── Schalter und Namen ──────────────────────────────────────────────────────

/** `data-aus`: nicht im Blatt, nicht im Druck, nur in den Ebenen. */
export const setzeAus = (quelle: string, nr: number, aus: boolean) => {
	const z = zerlege(quelle);
	return wendeAn(quelle, setzeSchalter(z, knotenAn(z, nr), 'data-aus', aus));
};

/** `data-gesperrt`: im Blatt nicht wählbar und nicht ziehbar. */
export const setzeGesperrt = (quelle: string, nr: number, gesperrt: boolean) => {
	const z = zerlege(quelle);
	return wendeAn(quelle, setzeSchalter(z, knotenAn(z, nr), 'data-gesperrt', gesperrt));
};

export type SwVerhalten = 'grau' | 'weg';

/** `data-sw` (Entscheidung 46); `null` heißt: der Standard der Art. */
export const setzeSw = (quelle: string, nr: number, sw: SwVerhalten | null) => {
	const z = zerlege(quelle);
	return wendeAn(quelle, setzeWert(z, knotenAn(z, nr), 'data-sw', sw));
};

/** `data-name`, der Name in den Ebenen; leer heißt: wieder der Name der Art. */
export const setzeName = (quelle: string, nr: number, name: string | null) => {
	const z = zerlege(quelle);
	return wendeAn(quelle, setzeWert(z, knotenAn(z, nr), 'data-name', name?.trim() || null));
};

// ── Ids in SVG (3.11) ───────────────────────────────────────────────────────

const ID = /\sid\s*=\s*"([^"]*)"/g;

const idsIn = (html: string) => [...html.matchAll(ID)].map((t) => t[1] ?? '');

/** Vier Zeichen aus a–z und 0–9, aus `text` berechnet (FNV-1a): Gleiche Quelle, gleiche Ids. */
const kurz = (text: string) => {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(36).padStart(4, '0').slice(-4);
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Eine neue Id `<art>-<4 Zeichen>`, die in `quelle` und in `vergeben` noch nicht vorkommt. */
export const neueId = (art: string, quelle: string, vergeben: ReadonlySet<string> = new Set()) => {
	const da = new Set([...idsIn(quelle), ...vergeben]);
	for (let n = 0; ; n += 1) {
		const id = `${art}-${kurz(`${art}|${quelle.length}|${n}`)}`;
		if (!da.has(id)) {
			return id;
		}
	}
};

/**
 * Gibt jeder Id in `html` eine neue, die in `quelle` noch nicht vorkommt, und schreibt die Verweise in `html` um
 * (`url(#…)`, `href="#…"`). Die Art bleibt: aus `verlauf-k3f9` wird `verlauf-…`.
 */
export const neueSvgIds = (html: string, quelle: string) => {
	const vergeben = new Set<string>();
	let umbenannt = html;
	for (const alt of new Set(idsIn(html))) {
		if (!alt) {
			continue;
		}
		const art = /^([a-z][a-z0-9]*)-/i.exec(alt)?.[1]?.toLowerCase() ?? 'id';
		const neu = neueId(art, `${quelle}${html}`, vergeben);
		vergeben.add(neu);
		const a = escape(alt);
		umbenannt = umbenannt
			.replace(new RegExp(`(\\sid\\s*=\\s*")${a}"`, 'g'), `$1${neu}"`)
			.replace(new RegExp(`url\\(\\s*#${a}\\s*\\)`, 'g'), `url(#${neu})`)
			.replace(new RegExp(`(href\\s*=\\s*")#${a}"`, 'g'), `$1#${neu}"`);
	}
	return umbenannt;
};

/** In einer Kopie (Seite, Aufgabe mit Anker) bekommt jedes Gestaltungselement neue Ids; der Rest bleibt, wie er ist. */
export const neueIdsInGestaltung = (html: string, quelle: string) => {
	if (!html.includes(LAGE)) {
		return html;
	}
	const z = zerlege(html);
	const oberste = z.knoten.filter((k) => {
		if (!istGestaltung(k)) {
			return false;
		}
		for (let e = k.eltern; e; e = e.eltern) {
			if (istGestaltung(e)) {
				return false;
			}
		}
		return true;
	});
	let bisher = quelle;
	const aenderungen = oberste.map((k): Aenderung => {
		const neu = neueSvgIds(quelleVon(z, k), bisher);
		bisher += neu;
		return { von: k.start, bis: k.ende, text: neu };
	});
	return wendeAn(html, aenderungen);
};

// ── Duplizieren und Löschen ─────────────────────────────────────────────────

/** Die Kopie liegt direkt davor, 16 px nach rechts unten versetzt, mit neuen Ids. */
export const dupliziereGestaltung = (quelle: string, nr: number): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const { x = 0, y = 0 } = lageAusStil(attribut(k, 'style')?.wert ?? null);
	const kopie = htmlMitLage(neueSvgIds(quelleVon(z, k), quelle), {
		x: x + VERSATZ_KOPIE,
		y: y + VERSATZ_KOPIE,
	});
	const a = fuegeEin(z, k, 'nach', kopie);
	return ergebnis(quelle, a, a[0], a[0]?.text.indexOf('<') ?? 0);
};

/** Löscht das Element, mit ihm eine leer gewordene Ebene. Gewählt ist danach der Nachbar, sonst die Seite bzw. der Baustein. */
export const loescheGestaltung = (quelle: string, nr: number): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const geschwister = (k.eltern?.kinder ?? []).filter(istGestaltung);
	const i = geschwister.indexOf(k);
	const folge = geschwister[i + 1] ?? geschwister[i - 1] ?? (istEbene(k.eltern) ? seiteUm(k) : k.eltern);
	const aenderungen = entferneMitEbene(z, k);
	const neu = wendeAn(quelle, aenderungen);
	if (!folge) {
		return { quelle: neu, nr: null };
	}
	const start = aenderungen.reduce(
		(pos, a) => (a.bis <= folge.start ? pos + a.text.length - (a.bis - a.von) : pos),
		folge.start,
	);
	return { quelle: neu, nr: zerlege(neu).knoten.find((n) => n.start === start)?.nr ?? null };
};

/** Entfernt jede leere Ebene. Ohne leere Ebene kommt die Quelle unverändert zurück. */
export const raeumeEbenenAuf = (quelle: string) => {
	if (!quelle.includes('ebene')) {
		return quelle;
	}
	const z = zerlege(quelle);
	const leer = z.knoten.filter((k) => istEbene(k) && istLeer(z, k));
	return leer.length
		? wendeAn(
				quelle,
				leer.flatMap((k) => entferne(z, k)),
			)
		: quelle;
};

// ── Gesten (097) ────────────────────────────────────────────────────────────

/**
 * Setzt eigene Eigenschaften im `style`, die keine Lage sind, z. B. `--gr` der Schmuckschrift beim Skalieren an der
 * Ecke. Lage und alles andere bleiben, wo sie sind; neue Eigenschaften kommen ans Ende. `null` entfernt.
 */
export const setzeStilWerte = (quelle: string, nr: number, werte: Readonly<Record<string, string | null>>) => {
	const z = zerlege(quelle);
	const k = knotenAn(z, nr);
	const alt = attribut(k, 'style')?.wert ?? null;
	const teile = stilTeile(alt);
	for (const [name, wert] of Object.entries(werte)) {
		const da = teile.findIndex((t) => eigenschaft(t) === name);
		if (wert === null) {
			if (da !== -1) {
				teile.splice(da, 1);
			}
		} else if (da === -1) {
			teile.push(`${name}:${wert}`);
		} else {
			teile[da] = `${name}:${wert}`;
		}
	}
	const neu = teile.join(';') || null;
	return neu === alt ? quelle : wendeAn(quelle, setzeWert(z, k, 'style', neu));
};

/**
 * ⌥ beim Loslassen: eine Kopie an der neuen Lage, das Original bleibt. Mit `seite` (Nummer der `.seite`) liegt die
 * Kopie auf jener Seite, in derselben Ebene ganz vorne. Ein Schritt.
 */
export const kopiereGestaltungNach = (quelle: string, nr: number, lage: LageTeil, seite?: number): StrukturErgebnis => {
	const z = zerlege(quelle);
	const index = seite === undefined ? -1 : seitenIn(z).indexOf(knotenAn(z, seite));
	if (seite !== undefined && index === -1) {
		throw new Error(`Das Element ${seite} ist keine Seite.`);
	}
	const kopie = dupliziereGestaltung(quelle, nr);
	if (kopie.nr === null) {
		return kopie;
	}
	const neu = zerlege(kopie.quelle);
	const ziel = index === -1 ? undefined : seitenIn(neu)[index];
	const eigene = seiteUm(knotenAn(neu, kopie.nr));
	if (!ziel || ziel === eigene) {
		return { quelle: setzeLage(kopie.quelle, kopie.nr, lage), nr: kopie.nr };
	}
	return verschiebeAufSeite(kopie.quelle, kopie.nr, ziel.nr, lage);
};

// ── Mehrfachauswahl (113) ───────────────────────────────────────────────────

/**
 * Wendet `f` auf jedes Element aus `nrn` an, in **einem** Ergebnis (ein Schritt). Von hinten nach vorne, weil Löschen und
 * Duplizieren die Nummern dahinter verschieben. `nr` ist danach das, was aus dem ersten Element (der Hauptauswahl)
 * wurde; `alle` sagt dasselbe für jedes Element in der Reihenfolge von `nrn`. Beim Löschen zeigen beide auf die
 * Nachbarn, die `loescheGestaltung` wählt; der Editor nimmt sie dann nicht.
 */
export const fuerAlle = (
	quelle: string,
	nrn: readonly number[],
	f: (quelle: string, nr: number) => string | StrukturErgebnis,
): StrukturErgebnis & { alle: (number | null)[] } => {
	const liste = [...new Set(nrn)];
	const alle: (number | null)[] = [...liste];
	let q = quelle;
	for (const nr of [...liste].sort((a, b) => b - a)) {
		const vorher = zerlege(q).knoten.length;
		const r = f(q, nr);
		const e = typeof r === 'string' ? { quelle: r, nr } : r;
		const verschoben = zerlege(e.quelle).knoten.length - vorher;
		liste.forEach((n, i) => {
			const jetzt = alle[i] ?? null;
			if (n === nr) {
				alle[i] = e.nr;
			} else if (jetzt !== null && jetzt > nr) {
				alle[i] = jetzt + verschoben;
			}
		});
		q = e.quelle;
	}
	return { quelle: q, nr: alle[0] ?? null, alle };
};

const MEHRFACH_MARKE = 'data-mehrfach-schritt';

const findeMarke = (quelle: string, i: number) =>
	zerlege(quelle).knoten.find((k) => attribut(k, MEHRFACH_MARKE)?.wert === String(i))?.nr ?? null;

/**
 * Nach vorne bzw. hinten für mehrere (113), ein Schritt; die Gewählten behalten ihre Reihenfolge untereinander.
 * Umordnen verschiebt Nummern, ohne dass Elemente dazukommen. Darum trägt jedes Element für die Dauer der Rechnung eine
 * Marke, über die es wiedergefunden wird; die Marken sind am Ende wieder weg. `nr` ist die neue Nummer von `nrn[0]`.
 */
export const ordneAlle = (quelle: string, nrn: readonly number[], richtung: Richtung): StrukturErgebnis => {
	const liste = [...new Set(nrn)];
	const z = zerlege(quelle);
	let q = wendeAn(
		quelle,
		liste.flatMap((nr, i) => setzeWert(z, knotenAn(z, nr), MEHRFACH_MARKE, String(i))),
	);
	// Wer zuerst dran ist: beim Schritt nach vorne das vorderste, beim Sprung ganz nach vorne das hinterste (es landet
	// zuerst vorne und wird von den anderen überholt); nach hinten spiegelbildlich.
	const aufsteigend = liste.map((nr, i) => ({ nr, i })).sort((a, b) => a.nr - b.nr);
	const vorderstesZuerst = richtung === 'vor' || richtung === 'ganz-zurueck';
	for (const { i } of vorderstesZuerst ? aufsteigend.reverse() : aufsteigend) {
		const nr = findeMarke(q, i);
		if (nr !== null) {
			q = ordneInEbene(q, nr, richtung).quelle;
		}
	}
	const haupt = findeMarke(q, 0);
	const fertig = zerlege(q);
	q = wendeAn(
		q,
		fertig.knoten
			.filter((k) => attribut(k, MEHRFACH_MARKE))
			.flatMap((k) => setzeAttribut(fertig, k, MEHRFACH_MARKE, null)),
	);
	return { quelle: q, nr: haupt };
};
