import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { MARKE } from '@schoolbox/kern/src/quelltext';

import { bausteinVon, elementZu, nrVon } from './darstellung';
import type { Ordnung, Platz } from './ziele';
import { ordnungVon } from './ziele';

/**
 * Die Lücke beim Ziehen (094): Der Baustein steht schon vor dem Loslassen halb durchsichtig an seiner neuen Stelle im
 * `iframe`, die Nummern dahinter sind nachgerückt. Das ändert nur die Anzeige, nie die Quelle: kein Schritt, kein
 * Speichern. `entferneLuecke` stellt die Anzeige wieder her, auch die alten Nummern.
 */

export const LUECKE = 'data-luecke';
/** Das Original beim Ziehen im Blatt, solange die Lücke es zeigt. */
const VERBORGEN = 'data-luecke-weg';
/** Lücke und ausgeblendetes Original: Einblendungen über dem Blatt übergehen beide. */
export const LUECKE_UND_ORIGINAL = `[${LUECKE}], [${VERBORGEN}]`;
/** Meldet dem Editor (Leinwand), dass sich die Anzeige verschoben hat: Rahmen und Leisten messen neu. */
export const LUECKE_GEAENDERT = 'schoolbox-luecke';

interface Stand {
	luecke: Element;
	schluessel: string;
	/** Die Seiten, die `abbildungen.js` schon vorher erzeugt hatte; neue gehören zur Lücke. */
	erzeugt: Set<Element>;
	verborgen: { element: HTMLElement; display: string } | null;
	nummern: Map<Element, string>;
}

const STAENDE = new WeakMap<Document, Stand>();

const schluesselVon = (a: Ablage) => ('in' in a ? `in ${a.in}` : `${a.wo} ${a.nr}`);

const melde = (doc: Document) => doc.dispatchEvent(new Event(LUECKE_GEAENDERT));

/** Ein Element aus HTML oder als Kopie, ohne `data-sb`: Sonst fände `trefferAn` ein Element, das es nicht gibt. */
const baue = (doc: Document, inhalt: string | Element) => {
	let element: Element | null;
	if (typeof inhalt === 'string') {
		const vorlage = doc.createElement('template');
		vorlage.innerHTML = inhalt.trim();
		const erstes = vorlage.content.firstElementChild;
		element = erstes ? doc.importNode(erstes, true) : null;
	} else {
		element = inhalt.cloneNode(true) as Element;
	}
	if (!element) {
		return null;
	}
	for (const e of [element, ...element.querySelectorAll(`[${MARKE}], [contenteditable]`)]) {
		e.removeAttribute(MARKE);
		e.removeAttribute('contenteditable');
	}
	return element;
};

const erzeugteSeiten = (doc: Document) => new Set(doc.querySelectorAll('.seite[data-erzeugt]'));

const setzeAn = (doc: Document, ablage: Ablage, luecke: Element) => {
	if ('in' in ablage) {
		const eltern = elementZu(doc, ablage.in);
		if (!eltern) {
			return false;
		}
		const fuss = [...eltern.children].find((k) => k !== luecke && k.matches('.fuss, .ebene'));
		eltern.insertBefore(luecke, fuss ?? null);
		return true;
	}
	const ziel = elementZu(doc, ablage.nr);
	if (!ziel) {
		return false;
	}
	if (ablage.wo === 'vor') {
		ziel.before(luecke);
	} else {
		ziel.after(luecke);
	}
	return true;
};

/**
 * Schreibt die Ziffern in `.aufgabe > .nr` der Anzeige neu, nach derselben Regel wie `nummeriere`: je Seite oder durch
 * das ganze Dokument, ★ bleibt ★, was keine Zahl ist, bleibt. Mitgezählt wird die Lücke, nicht das ausgeblendete Original.
 */
export const zaehleNummernInAnzeige = (doc: Document, jeSeite: boolean) => {
	const stand = STAENDE.get(doc);
	const zaehler = new Map<Element | null, number>();
	for (const nr of doc.querySelectorAll('.aufgabe > .nr')) {
		const inLuecke = nr.closest(`[${LUECKE}]`) !== null;
		const alt = stand?.nummern.get(nr) ?? nr.textContent ?? '';
		if (
			nr.classList.contains('stern') ||
			nr.children.length > 0 ||
			!/^\d+$/.test(alt.trim()) ||
			nr.closest(`[data-erzeugt], [${VERBORGEN}]`) ||
			(!inLuecke && nrVon(nr) === null)
		) {
			continue;
		}
		const gruppe = jeSeite ? nr.closest('.seite') : null;
		const n = (zaehler.get(gruppe) ?? 0) + 1;
		zaehler.set(gruppe, n);
		if (alt.trim() !== String(n)) {
			if (stand && !inLuecke && !stand.nummern.has(nr)) {
				stand.nummern.set(nr, alt);
			}
			nr.textContent = String(n);
		} else if (stand?.nummern.has(nr)) {
			nr.textContent = alt;
			stand.nummern.delete(nr);
		}
	}
};

/** Stellt die Anzeige wieder her: Lücke weg, Original sichtbar, alte Nummern. */
export const entferneLuecke = (doc: Document) => {
	const stand = STAENDE.get(doc);
	if (!stand) {
		return;
	}
	STAENDE.delete(doc);
	stand.luecke.remove();
	for (const s of erzeugteSeiten(doc)) {
		if (!stand.erzeugt.has(s)) {
			s.remove();
		}
	}
	if (stand.verborgen) {
		stand.verborgen.element.style.display = stand.verborgen.display;
		stand.verborgen.element.removeAttribute(VERBORGEN);
	}
	for (const [nr, text] of stand.nummern) {
		nr.textContent = text;
	}
	melde(doc);
};

interface LueckenOptionen {
	jeSeite: boolean;
	/** Beim Ziehen im Blatt: das Original, das währenddessen ausgeblendet ist. */
	verbirg?: Element;
}

/**
 * Setzt `inhalt` (Starter-HTML oder das gezogene Element, als Kopie) halb durchsichtig an die Ablage. Nur wenn sich der
 * Platz ändert, sonst bleibt alles, wie es ist (4.12: nicht je Mausbewegung). `false`, wenn die Ablage nicht zu finden
 * ist; dann ist auch keine Lücke zu sehen.
 */
export const zeigeLuecke = (doc: Document, platz: Platz, inhalt: string | Element, o: LueckenOptionen) => {
	const schluessel = schluesselVon(platz.ablage);
	const alt = STAENDE.get(doc);
	if (alt?.schluessel === schluessel) {
		return true;
	}
	let stand = alt;
	if (!stand) {
		const luecke = baue(doc, inhalt);
		if (!luecke) {
			return false;
		}
		luecke.setAttribute(LUECKE, '');
		luecke.setAttribute('aria-hidden', 'true');
		const { style } = luecke as HTMLElement;
		style.opacity = '.45';
		style.pointerEvents = 'none';
		stand = { luecke, schluessel: '', erzeugt: erzeugteSeiten(doc), verborgen: null, nummern: new Map() };
	}
	if (!setzeAn(doc, platz.ablage, stand.luecke)) {
		entferneLuecke(doc);
		return false;
	}
	stand.schluessel = schluessel;
	if (!alt) {
		STAENDE.set(doc, stand);
		const original = o.verbirg as HTMLElement | undefined;
		if (original?.style) {
			stand.verborgen = { element: original, display: original.style.display };
			original.setAttribute(VERBORGEN, '');
			original.style.display = 'none';
		}
		// Abbildungen zeichnet `abbildungen.js` nicht von selbst (keine Custom Elements); die Kopie ist schon gezeichnet.
		if (typeof inhalt === 'string') {
			const fenster = doc.defaultView as (Window & { zeichneAbbildungen?: (wurzel: Element) => void }) | null;
			fenster?.zeichneAbbildungen?.(stand.luecke);
		}
	}
	zaehleNummernInAnzeige(doc, o.jeSeite);
	melde(doc);
	return true;
};

/** Steht der Punkt (Koordinaten des Materials) in der Lücke? Dann bleibt der Platz, wo er ist, sonst flackerte er. */
export const inLuecke = (doc: Document, x: number, y: number) => {
	const r = STAENDE.get(doc)?.luecke.getBoundingClientRect();
	return Boolean(r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
};

/** Liegt der Punkt auf einer Seite? Außerhalb zeigt der Zug von außen nichts. */
export const aufSeite = (doc: Document, x: number, y: number) =>
	[...doc.querySelectorAll('.seite:not([data-erzeugt])')].some((s) => {
		const r = s.getBoundingClientRect();
		return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	});

/** Für Starter, die das Register nicht kennt oder die sich nicht ordnen: ein Block zwischen den Kindern der Seiten. */
const BLOCK: Baustein = { art: 'block', name: 'Baustein', selektor: '*', faehigkeiten: ['ordnen'] };

/**
 * Eine `Ordnung` für einen Baustein, der noch nicht im Blatt ist: mit einem unsichtbaren Probe-Element auf der ersten
 * Seite gebaut wie bei `ordnungVon`, danach ist die Probe wieder weg und steht unter keinem Glied. `element` ist die
 * Probe; `platzAn` verträgt das (kein Platz „ohne Wirkung“).
 */
export const ordnungFuer = (doc: Document, html: string): Ordnung | null => {
	const seite = doc.querySelector('.seite:not([data-erzeugt])');
	const probe = baue(doc, html);
	if (!seite || !probe) {
		return null;
	}
	probe.setAttribute(MARKE, '-1');
	probe.setAttribute('hidden', '');
	seite.append(probe);
	try {
		const gefunden = bausteinVon(probe);
		const baustein =
			gefunden && kann(gefunden, 'ordnen') && !gefunden.ordnenInLeiste && !gefunden.ordnenNurKnopf
				? gefunden
				: BLOCK;
		const ordnung = ordnungVon(probe, baustein);
		return {
			...ordnung,
			gruppen: ordnung.gruppen.map((g) => ({ ...g, glieder: g.glieder.filter((e) => e !== probe) })),
		};
	} finally {
		probe.remove();
	}
};
