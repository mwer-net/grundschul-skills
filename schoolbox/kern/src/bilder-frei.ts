/**
 * Freie Bilder (103, Briefing schubladen/6-bilder.md): ein Bild-Baustein aus dem Stapel wird zum freien Bild
 * (`img.bild-frei` in `.ebene.vorne`), eine Bildunterschrift dabei zur Schmuckschrift darunter. Die Lage misst der Editor
 * in der Darstellung. 117: Ebenso wird ein freies Element von Claude (088, `data-frei`) frei gelegt.
 */

import { BILD_MIN } from './bildbefehle';
import { legeGestaltungAb } from './gestaltung';
import { LAGE } from './gestaltung-arten';
import type { Knoten } from './quelltext';
import { attribut, entferne, innenVon, klassenVon, schuetzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';

/** Breiter wird ein frei abgelegtes Bild nicht (Falle „Große Fotos“); ist die Datei schmaler, gilt ihre Breite. */
export const BILD_FREI_BREITE = 320;

/** Abstand zwischen Bild und Bildunterschrift nach dem Freilegen, in px. */
const ABSTAND_UNTERSCHRIFT = 8;
/** Schriftgröße der Bildunterschrift als Schmuckschrift, in px. */
const UNTERSCHRIFT_GROESSE = 18;

/** Die Breite beim Ablegen: höchstens 320 px bzw. die Breite der Datei. */
export const breiteBeimAblegen = (natur: { breite: number } | null | undefined) =>
	Math.round(Math.max(BILD_MIN, Math.min(BILD_FREI_BREITE, natur?.breite || BILD_FREI_BREITE)));

/** Ein freies Bild ohne Lage; die Lage setzt `legeGestaltungAb`. */
export const bildFreiHtml = (src: string, alt: string) =>
	`<img class="bild-frei" src="${schuetzeAttribut(src)}" alt="${schuetzeAttribut(alt.trim())}">`;

const inAbbildung = (k: Knoten) => {
	for (let e = k.eltern; e; e = e.eltern) {
		if (e.tag.startsWith('x-')) {
			return true;
		}
	}
	return false;
};

/** Ein Bild-Baustein im Stapel: `img` ohne `data-lage`, keine Leitfigur, nicht in einer Abbildung. */
export const istBildBaustein = (k: Knoten | null | undefined): k is Knoten =>
	Boolean(k && k.tag === 'img' && !attribut(k, LAGE) && !klassenVon(k).includes('figur') && !inAbbildung(k));

export const seiteUm = (k: Knoten) => {
	let e = k.eltern;
	while (e && !klassenVon(e).includes('seite')) {
		e = e.eltern;
	}
	return e;
};

/** In Koordinaten der Seite (wie `--x`, `--y`), gemessen in der Darstellung; `h` braucht nur die Bildunterschrift. */
export interface LageImStapel {
	x: number;
	y: number;
	b: number;
	h: number;
}

/**
 * Macht aus einem Bild-Baustein ein freies Bild an derselben Stelle, ganz vorne in `.ebene.vorne` seiner Seite. Steht
 * das Bild mit einer Bildunterschrift in einer `figure`, wird diese zur Schmuckschrift `titel` darunter. Ein Schritt;
 * das Ergebnis meldet das Bild.
 */
export const legeBildFrei = (quelle: string, nr: number, lage: LageImStapel): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!istBildBaustein(k)) {
		throw new Error('Frei legen geht nur mit einem Bild aus dem Stapel.');
	}
	const seite = seiteUm(k);
	if (!seite) {
		throw new Error('Das Bild liegt auf keiner Seite.');
	}
	const figur = k.eltern?.tag === 'figure' ? k.eltern : null;
	const unterschrift = figur?.kinder.find((c) => c.tag === 'figcaption');
	// Die ganze `figure` nur, wenn sonst nichts darin steht; sonst bliebe Inhalt ohne Platz.
	const weg = figur && figur.kinder.every((c) => c === k || c === unterschrift) ? figur : k;
	const text = unterschrift && weg === figur ? innenVon(z, unterschrift).trim() : '';
	const html = bildFreiHtml(attribut(k, 'src')?.wert ?? '', attribut(k, 'alt')?.wert ?? '');
	const ohne = wendeAn(quelle, entferne(z, weg));
	// Die Seite steht vor dem Bild in der Quelle: Ihre Nummer bleibt beim Entfernen gleich.
	const bild = legeGestaltungAb(ohne, { seite: seite.nr, ebene: 'vorne', html, lage: { x: lage.x, y: lage.y, b: lage.b } });
	if (!text) {
		return bild;
	}
	const schrift = `<div class="schmuck" data-schmuck="titel" style="--gr:${UNTERSCHRIFT_GROESSE}px">${text}</div>`;
	const mit = legeGestaltungAb(bild.quelle, {
		seite: seite.nr,
		ebene: 'vorne',
		html: schrift,
		lage: { x: lage.x, y: lage.y + lage.h + ABSTAND_UNTERSCHRIFT, b: lage.b },
	});
	// Die Schrift liegt in der Quelle hinter dem Bild: Dessen Nummer bleibt.
	return { quelle: mit.quelle, nr: bild.nr };
};

// Freie Elemente von Claude (088) frei legen
/** Ein freies Element von Claude im Stapel: `data-frei` ohne `data-lage` (das wäre schon Gestaltung). */
export const istFreiesElement = (k: Knoten | null | undefined): k is Knoten =>
	Boolean(k && attribut(k, 'data-frei') && !attribut(k, LAGE));

/**
 * Legt ein freies Element von Claude an derselben Stelle frei in `.ebene.vorne` seiner Seite. Es bleibt dasselbe
 * Element mit `data-frei` und `data-frei-titel`; dazu kommen `data-lage="frei"` und `--x --y --b` (gemessen, damit
 * `width="100%"` nicht die ganze Seite wird). `--h` nur für ein SVG ohne `viewBox`, das keine Höhe aus dem Inhalt hat.
 * Ein Schritt.
 */
export const legeFreiesElementFrei = (quelle: string, nr: number, lage: LageImStapel): StrukturErgebnis => {
	const z = zerlege(quelle);
	const k = z.knoten[nr];
	if (!istFreiesElement(k)) {
		throw new Error('Frei legen geht nur mit einem freien Element aus dem Stapel.');
	}
	const seite = seiteUm(k);
	if (!seite) {
		throw new Error('Das Element liegt auf keiner Seite.');
	}
	const html = quelle.slice(k.start, k.ende);
	const ohneHoehe = k.tag === 'svg' && !attribut(k, 'viewBox');
	const ohne = wendeAn(quelle, entferne(z, k));
	return legeGestaltungAb(ohne, {
		seite: seite.nr,
		ebene: 'vorne',
		html,
		lage: { x: lage.x, y: lage.y, b: lage.b, ...(ohneHoehe ? { h: lage.h } : {}) },
	});
};
