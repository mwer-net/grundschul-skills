/**
 * Anker (106, Briefing 3.5): Ein Gestaltungselement hängt **im** Baustein, als dessen letztes Kind mit `data-anker`, und
 * wandert mit ihm, ohne dass Code nachführt. Hier stehen Anhängen und Lösen als Umformungen der Quelle. Der Kern kann
 * nicht messen: Der Editor misst die Lage in Seitenkoordinaten (`offsetLeft`/`offsetTop` bis zur `.seite`, nicht das
 * umschließende Rechteck) und übergibt Material-px. Beides ist ein Schritt, die Lage im Blatt bleibt.
 */

import type { Baustein } from './bausteine';
import { kann } from './bausteine';
import type { Lage } from './gestaltung';
import { istEbene, istGestaltung, legeGestaltungAb, leseLage, raeumeEbenenAuf, setzeLage } from './gestaltung';
import { ANKER_SELEKTOR, nameDerGestaltung } from './gestaltung-arten';
import type { Aenderung, Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	einrueckung,
	entferne,
	klassenVon,
	quelleVon,
	rueckeUm,
	setzeAttribut,
	wendeAn,
	zerlege,
} from './quelltext';
import { bausteinVonKnoten, passt } from './referenz';
import type { StrukturErgebnis } from './struktur';

export const ANKER = 'data-anker';

const EINZUG = '  ';

/**
 * Bausteine, an die nichts hängen darf, obwohl `ANKER_SELEKTOR` sie trifft. Kein Baustein erster Ebene schneidet in
 * `blatt.css` seinen Inhalt ab (`overflow: hidden` haben nur `.seite`, `.ebene` und `.spiel-zelle` in einem Spiel).
 * Ausgenommen sind darum: die Marke „Lösung“, die selbst absolut liegt (`position: relative` verschöbe sie), und die
 * Abbildungen (`x-…`), deren Inhalt `abbildungen.js` beim Zeichnen ersetzt; ein Element darin wäre danach weg. Dazu
 * kommt jeder Textbaustein (Fähigkeit `text`, siehe `ankerbar`): Ein `div` in einem `<p>` schlösse der Browser vorher,
 * und die Textsitzung schriebe den Inhalt ohne das fremde Element zurück.
 */
export const NICHT_ANKERBAR: readonly string[] = ['.loesung-marke', 'x-*'];

const trifftNichtAnkerbar = (k: Knoten) =>
	NICHT_ANKERBAR.some((s) => (s.endsWith('*') ? k.tag.startsWith(s.slice(0, -1)) : passt(k, s, false)));

const istSeite = (k: Knoten | null | undefined) => Boolean(k && klassenVon(k).includes('seite'));

const seiteUm = (k: Knoten) => {
	let e = k.eltern;
	while (e && !istSeite(e)) {
		e = e.eltern;
	}
	return e;
};

/** In einer Ebene oder in einem Gestaltungselement (Gruppe): kein Baustein des Stapels. */
const imFreien = (k: Knoten) => {
	for (let e = k.eltern; e; e = e.eltern) {
		if (istEbene(e) || istGestaltung(e)) {
			return true;
		}
	}
	return false;
};

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

/** Im Register und kein Textbaustein (siehe `NICHT_ANKERBAR`). */
const ohneText = (b: Baustein | undefined) => b !== undefined && !kann(b, 'text');

const ankerbar = (k: Knoten) =>
	!istSeite(k) &&
	!istGestaltung(k) &&
	!imFreien(k) &&
	seiteUm(k) !== null &&
	passt(k, ANKER_SELEKTOR, false) &&
	!trifftNichtAnkerbar(k) &&
	ohneText(bausteinVonKnoten(k, false));

const hatAnker = (k: Knoten) => istGestaltung(k) && attribut(k, ANKER) !== undefined;

/** Ankerbar: `ANKER_SELEKTOR`, ein Eintrag im Register, selbst kein `[data-lage]`, nicht in `NICHT_ANKERBAR`. */
export const istAnkerbar = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	return Boolean(k && ankerbar(k));
};

/** Die ankerbaren Bausteine der Seite `seite` (Nummer der `.seite`), in der Reihenfolge der Quelle. */
export const ankerZiele = (quelle: string, seite: number): number[] => {
	const z = zerlege(quelle);
	const s = z.knoten[seite];
	if (!s || !istSeite(s)) {
		return [];
	}
	return z.knoten.filter((k) => k.start > s.start && k.ende <= s.ende && seiteUm(k) === s && ankerbar(k)).map((k) => k.nr);
};

/** Nummer des Bausteins, an dem das Element hängt; `null`, wenn es in einer Ebene liegt. */
export const ankerVon = (quelle: string, nr: number): number | null => {
	const k = zerlege(quelle).knoten[nr];
	return k && hatAnker(k) ? (k.eltern?.nr ?? null) : null;
};

/** Ein Attribut ohne Wert am Ende des Start-Tags von `html`. */
const mitSchalter = (html: string, name: string) => {
	const k = zerlege(html).wurzeln[0];
	if (!k || attribut(k, name)) {
		return html;
	}
	const tag = html.slice(k.start, k.oeffnerEnde);
	const pos = k.start + (/\s*\/?>$/.exec(tag)?.index ?? tag.length);
	return `${html.slice(0, pos)} ${name}${html.slice(pos)}`;
};

const ohneAttribut = (html: string, name: string) => {
	const z = zerlege(html);
	const k = z.wurzeln[0];
	return k ? wendeAn(html, setzeAttribut(z, k, name, null)) : html;
};

/** Fügt `html` als letztes Kind von `ziel` ein, auf eigener Zeile, wenn der Baustein so geschrieben ist. */
const alsLetztesKind = (z: Zerlegung, ziel: Knoten, html: string, alt: string | null): Aenderung => {
	const davor = z.quelle.slice(ziel.oeffnerEnde, ziel.schliesserStart);
	const zeile = /\n([ \t]*)$/.exec(davor);
	if (!zeile) {
		return { von: ziel.schliesserStart, bis: ziel.schliesserStart, text: html };
	}
	const aussen = zeile[1] ?? '';
	const letztes = ziel.kinder.at(-1);
	const innen = (letztes && einrueckung(z, letztes)) ?? `${aussen}${EINZUG}`;
	const pos = ziel.schliesserStart - aussen.length;
	return { von: pos, bis: pos, text: `${innen}${rueckeUm(html, alt, innen)}\n` };
};

export interface Anhaengen {
	/** Linke obere Ecke des Elements vor dem Drehen, in Koordinaten der Seite. */
	lage: { x: number; y: number };
	/** Linke obere Ecke des Bausteins (Innenkante), in Koordinaten der Seite. */
	ursprung: { x: number; y: number };
}

/**
 * Hängt das Gestaltungselement `nr` an den Baustein `ziel` derselben Seite: letztes Kind, `data-anker`, `--x/--y` relativ
 * zum Baustein. Aus einer Ebene genommen bleibt keine leere Ebene zurück; hing es schon an einem anderen Baustein, ist
 * der Wechsel derselbe Aufruf. Am Anker liegt es immer vorne (3.5).
 */
export const haengeAn = (quelle: string, nr: number, ziel: number, { lage, ursprung }: Anhaengen): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const baustein = knotenAn(z, ziel);
	if (!ankerbar(baustein)) {
		throw new Error('An diesen Baustein lässt sich nichts hängen.');
	}
	if (seiteUm(k) !== seiteUm(baustein)) {
		throw new Error('Anhängen geht nur an Bausteine derselben Seite.');
	}
	if (baustein.start > k.start && baustein.ende <= k.ende) {
		throw new Error('Ein Element hängt nicht an sich selbst.');
	}
	const x = Math.round(lage.x - ursprung.x);
	const y = Math.round(lage.y - ursprung.y);
	if (k.eltern === baustein && hatAnker(k)) {
		return { quelle: setzeLage(quelle, nr, { x, y }), nr };
	}
	const html = mitSchalter(setzeLage(quelleVon(z, k), 0, { x, y }), ANKER);
	const raus = entferne(z, k);
	const rein = alsLetztesKind(z, baustein, html, einrueckung(z, k));
	const neu = raeumeEbenenAuf(wendeAn(quelle, [...raus, rein]));
	// Wo das Element jetzt beginnt: Was davor entfernt wurde, rückt alles auf. Eine leere Ebene liegt immer dahinter.
	const versatz = raus.reduce((v, a) => (a.bis <= rein.von ? v + a.text.length - (a.bis - a.von) : v), 0);
	const start = rein.von + versatz + rein.text.indexOf('<');
	return { quelle: neu, nr: zerlege(neu).knoten.find((n) => n.start === start)?.nr ?? null };
};

/**
 * Löst das Element vom Baustein: ohne `data-anker`, letztes (vorderstes) Kind von `.ebene.vorne` seiner Seite,
 * `--x/--y = lage` (Koordinaten der Seite). Ein Element ohne Anker bleibt, wie es ist.
 */
export const loeseAnker = (quelle: string, nr: number, { lage }: { lage: { x: number; y: number } }): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = gestaltungAn(z, nr);
	const seite = seiteUm(k);
	if (!hatAnker(k) || !seite) {
		return { quelle, nr };
	}
	const html = ohneAttribut(quelleVon(z, k), ANKER);
	// Die Seite steht vor dem Element: Ihre Nummer bleibt, wenn es herauskommt.
	const ohne = wendeAn(quelle, entferne(z, k));
	return legeGestaltungAb(ohne, { seite: seite.nr, ebene: 'vorne', html, lage: { x: lage.x, y: lage.y } });
};

/**
 * Für `verschiebeAufSeite` (097): Ein Element am Anker wird vorher gelöst und liegt dann vorne. Die Zahlen von `--x/--y`
 * bleiben; wer die Lage auf der neuen Seite kennt, gibt sie `verschiebeAufSeite` mit. `seite` (Nummer der Zielseite)
 * kommt umgerechnet zurück, denn die neue Ebene verschiebt die Nummern dahinter.
 */
export const loeseVorSeitenwechsel = (quelle: string, nr: number, seite: number) => {
	if (ankerVon(quelle, nr) === null) {
		return { quelle, nr, seite };
	}
	const platz = zerlege(quelle).knoten.filter(istSeite).findIndex((k) => k.nr === seite);
	const { x = 0, y = 0 }: Lage = leseLage(quelle, nr);
	const r = loeseAnker(quelle, nr, { lage: { x, y } });
	const neu = zerlege(r.quelle).knoten.filter(istSeite)[platz];
	if (r.nr === null || !neu) {
		throw new Error('Das Element ließ sich nicht vom Baustein lösen.');
	}
	return { quelle: r.quelle, nr: r.nr, seite: neu.nr };
};

/** Die Namen der Elemente, die am Baustein `nr` oder darin hängen, das vorderste zuerst (wie in den Ebenen). */
export const ankerNamen = (quelle: string, nr: number): string[] => {
	if (!quelle.includes(ANKER)) {
		return [];
	}
	const z = zerlege(quelle);
	const b = z.knoten[nr];
	if (!b || istGestaltung(b)) {
		return [];
	}
	return z.knoten
		.filter((k) => k.start > b.start && k.ende <= b.ende && hatAnker(k) && !imFreien(k))
		.reverse()
		.map((k) => {
			const art = bausteinVonKnoten(k, false);
			const name = art && kann(art, 'lage') ? nameDerGestaltung(art, (n) => attribut(k, n)?.wert ?? null) : null;
			return name ?? art?.name ?? 'Gestaltung';
		});
};

/** Für die Beschreibung beim Löschen: „, mit Wilma“, „, mit Wilma und Sprechblase“; ohne Anker leer. */
export const mitAnkern = (quelle: string, nr: number) => {
	const namen = ankerNamen(quelle, nr);
	if (namen.length === 0) {
		return '';
	}
	const liste = namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}`;
	return `, mit ${liste}`;
};
