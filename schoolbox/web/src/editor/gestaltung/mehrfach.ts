import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';
import { useSyncExternalStore } from 'react';

import { elementZu, nrVon } from '../darstellung';
import type { Kasten } from './geste';

/**
 * Mehrfachauswahl (113, Briefing 5.9). Die Hauptauswahl bleibt die eine Nummer des Editors (`auswahl`); dazu kommt hier
 * die Liste `dazu` weiterer Gestaltungselemente. Sie gilt nur, solange die Hauptauswahl `haupt` ist: Wählt der Editor
 * etwas anderes (Klick ohne ⇧, Esc, Baustein, Rückgängig), leert `Editor.tsx` sie über `leereMehrfach`.
 */

interface Stand {
	haupt: number | null;
	dazu: readonly number[];
}

const LEER: Stand = { haupt: null, dazu: [] };

let stand: Stand = LEER;
const hoerer = new Set<() => void>();

const setze = (neu: Stand) => {
	if (
		neu.haupt === stand.haupt &&
		neu.dazu.length === stand.dazu.length &&
		neu.dazu.every((n, i) => n === stand.dazu[i])
	) {
		return;
	}
	stand = neu;
	for (const h of hoerer) {
		h();
	}
};

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

/** Der Stand für React: Editor, Ebenen und Überlagerung zeichnen neu, wenn sich `dazu` ändert. */
export const useMehrfach = () => useSyncExternalStore(abonniere, () => stand);

/** Setzt Hauptauswahl und weitere Elemente; der Aufrufer wählt danach `haupt` im Editor. */
export const setzeMehrfach = (haupt: number, dazu: readonly number[]) =>
	setze({ haupt, dazu: dazu.filter((n) => n !== haupt) });

export const leereMehrfach = () => setze(LEER);

/** Leert `dazu`, wenn die Hauptauswahl des Editors nicht mehr die ist, zu der die Liste gehört. */
export const folgeAuswahl = (auswahl: number | null) => {
	if (stand.haupt !== null && stand.haupt !== auswahl) {
		leereMehrfach();
	}
};

const seiteVon = (element: Element) => element.closest('.seite');

/** Wie `istGestaltungElement` in `kontext.ts`; hier eigen, sonst importierten die beiden Dateien einander. */
const istGestaltungElement = (element: Element | null | undefined): element is Element =>
	Boolean(element?.matches(GESTALTUNG_SELEKTOR));

/**
 * Hauptauswahl und alle gültigen weiteren: Gestaltungselemente auf derselben Seite, nicht ausgeblendet. Was nach einem
 * Schritt nicht mehr passt, fällt hier heraus, statt auf ein falsches Element zu zeigen.
 */
export const nrnFuer = (doc: Document, nr: number): number[] => {
	const haupt = elementZu(doc, nr);
	if (stand.haupt !== nr || !istGestaltungElement(haupt)) {
		return [nr];
	}
	const seite = seiteVon(haupt);
	const weitere = stand.dazu.filter((n) => {
		const e = elementZu(doc, n);
		return n !== nr && istGestaltungElement(e) && seiteVon(e) === seite && !e.hasAttribute('data-aus');
	});
	return [nr, ...weitere];
};

/**
 * ⇧-Klick (Blatt) bzw. ⇧- oder ⌘-Klick (Ebenen) auf ein Element: nimmt es dazu oder weg. Ist ein Baustein gewählt oder
 * liegt das Element auf einer anderen Seite, beginnt die Auswahl neu mit ihm (5.9).
 */
export const schalteDazu = (
	doc: Document,
	gewaehlt: number | null,
	nr: number,
	waehle: (nr: number | null) => void,
) => {
	const element = elementZu(doc, nr);
	if (!istGestaltungElement(element)) {
		leereMehrfach();
		waehle(nr);
		return;
	}
	const haupt = gewaehlt === null ? null : elementZu(doc, gewaehlt);
	const jetzt =
		gewaehlt !== null && istGestaltungElement(haupt) && seiteVon(haupt) === seiteVon(element)
			? nrnFuer(doc, gewaehlt)
			: [];
	if (jetzt.includes(nr)) {
		const rest = jetzt.filter((n) => n !== nr);
		const neu = rest.at(-1);
		if (neu === undefined) {
			leereMehrfach();
			waehle(null);
			return;
		}
		setzeMehrfach(neu, rest.slice(0, -1));
		waehle(neu);
		return;
	}
	if (jetzt.length === 0) {
		leereMehrfach();
		waehle(nr);
		return;
	}
	// Das zuletzt geklickte wird Hauptauswahl: Inspektor und Leiste sehen es (Entscheidung im Ticket).
	setzeMehrfach(nr, jetzt);
	waehle(nr);
};

// ── Messen ──────────────────────────────────────────────────────────────────

export interface Rechteck {
	links: number;
	oben: number;
	rechts: number;
	unten: number;
}

/** Das umschließende Rechteck im Material (Koordinaten des `iframe`), auch bei gedrehten Elementen. */
export const rechteckVon = (element: Element): Rechteck => {
	const r = element.getBoundingClientRect();
	return { links: r.left, oben: r.top, rechts: r.right, unten: r.bottom };
};

export const umschliessend = (liste: readonly Rechteck[]): Rechteck | null =>
	liste.length === 0
		? null
		: {
				links: Math.min(...liste.map((r) => r.links)),
				oben: Math.min(...liste.map((r) => r.oben)),
				rechts: Math.max(...liste.map((r) => r.rechts)),
				unten: Math.max(...liste.map((r) => r.unten)),
			};

export const alsKasten = (r: Rechteck): Kasten => ({
	x: r.links,
	y: r.oben,
	b: r.rechts - r.links,
	h: r.unten - r.oben,
	drehen: 0,
});

/** Die Elemente zu den Nummern, ohne fehlende. */
export const elementeZu = (doc: Document, nrn: readonly number[]) =>
	nrn.flatMap((nr) => {
		const e = elementZu(doc, nr);
		return e ? [{ nr, element: e }] : [];
	});

/** Innenfläche der Seite (innerhalb von `--rand`) im Material: Dorthin richtet ein einzelnes Element sich aus. */
export const innenflaecheVon = (element: Element): Rechteck | null => {
	const seite = seiteVon(element);
	const fenster = element.ownerDocument.defaultView;
	if (!seite || !fenster) {
		return null;
	}
	const r = seite.getBoundingClientRect();
	const stil = fenster.getComputedStyle(seite);
	const rand = parseFloat(stil.getPropertyValue('--rand')) || parseFloat(stil.paddingLeft) || 0;
	return { links: r.left + rand, oben: r.top + rand, rechts: r.right - rand, unten: r.bottom - rand };
};

// ── Ausrichten und Verteilen (rein, ohne DOM) ───────────────────────────────

export type Ausrichtung = 'links' | 'mitte' | 'rechts' | 'oben' | 'mittig' | 'unten';

/** Der Weg je Element, damit es an `ziel` ausgerichtet ist. */
export const ausrichten = (
	rechtecke: readonly Rechteck[],
	ziel: Rechteck,
	wie: Ausrichtung,
): { dx: number; dy: number }[] =>
	rechtecke.map((r) => {
		switch (wie) {
			case 'links':
				return { dx: ziel.links - r.links, dy: 0 };
			case 'rechts':
				return { dx: ziel.rechts - r.rechts, dy: 0 };
			case 'mitte':
				return { dx: (ziel.links + ziel.rechts) / 2 - (r.links + r.rechts) / 2, dy: 0 };
			case 'oben':
				return { dx: 0, dy: ziel.oben - r.oben };
			case 'unten':
				return { dx: 0, dy: ziel.unten - r.unten };
			default:
				return { dx: 0, dy: (ziel.oben + ziel.unten) / 2 - (r.oben + r.unten) / 2 };
		}
	});

/**
 * Gleiche Abstände zwischen den umschließenden Rechtecken, ab drei Elementen. Das erste und das letzte (nach Lage)
 * bleiben stehen. Der Weg kommt in der Reihenfolge der Eingabe zurück.
 */
export const verteile = (rechtecke: readonly Rechteck[], richtung: 'waagerecht' | 'senkrecht') => {
	const wege = rechtecke.map(() => ({ dx: 0, dy: 0 }));
	if (rechtecke.length < 3) {
		return wege;
	}
	const waagerecht = richtung === 'waagerecht';
	const anfang = (r: Rechteck) => (waagerecht ? r.links : r.oben);
	const laenge = (r: Rechteck) => (waagerecht ? r.rechts - r.links : r.unten - r.oben);
	const reihe = rechtecke.map((r, i) => ({ r, i })).sort((a, b) => anfang(a.r) - anfang(b.r));
	const erstes = reihe[0]?.r;
	const letztes = reihe.at(-1)?.r;
	if (!erstes || !letztes) {
		return wege;
	}
	const gesamt = anfang(letztes) + laenge(letztes) - anfang(erstes);
	const belegt = reihe.reduce((s, { r }) => s + laenge(r), 0);
	const luecke = (gesamt - belegt) / (reihe.length - 1);
	let pos = anfang(erstes);
	for (const { i, r } of reihe) {
		const weg = pos - anfang(r);
		wege[i] = waagerecht ? { dx: weg, dy: 0 } : { dx: 0, dy: weg };
		pos += laenge(r) + luecke;
	}
	return wege;
};

/** Gestaltungselemente auf der Seite, die ganz im aufgezogenen Rechteck liegen; nicht gesperrt, nicht ausgeblendet. */
export const imRechteck = (seite: Element, r: Rechteck) =>
	[...seite.querySelectorAll('[data-lage="frei"]')].flatMap((e) => {
		const nr = nrVon(e);
		if (nr === null || !istGestaltungElement(e) || e.hasAttribute('data-gesperrt') || e.hasAttribute('data-aus')) {
			return [];
		}
		// Nur äußerste (eine Gruppe vor ihren Kindern, 120).
		if (e.parentElement?.closest('[data-lage="frei"]')) {
			return [];
		}
		const q = rechteckVon(e);
		if (q.rechts - q.links === 0 && q.unten - q.oben === 0) {
			return [];
		}
		return q.links >= r.links && q.rechts <= r.rechts && q.oben >= r.oben && q.unten <= r.unten ? [nr] : [];
	});
