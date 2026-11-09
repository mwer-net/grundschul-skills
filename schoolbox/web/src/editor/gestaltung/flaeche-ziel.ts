import { nrVon } from '../darstellung';

/**
 * Die Fläche im Stapel im Blatt (115): wo der Zeiger sie trifft, wohin ein gezogenes Element dabei gehört und wie ihr
 * Auswahlrahmen gemessen wird. Alles in Koordinaten des Materials (`clientX` im `iframe`). Gemessen wird über
 * `getBoundingClientRect` der Flächen, nicht über `elementsFromPoint`: Das gezogene Element läge sonst über seiner
 * eigenen Fläche und träfe sie immer.
 */

type Punkt = { x: number; y: number };

/** Linke obere Ecke der Innenkante, also der Nullpunkt für `--x`/`--y` der Kinder. */
const ursprungVon = (e: Element): Punkt => {
	const r = e.getBoundingClientRect();
	return { x: r.left + e.clientLeft, y: r.top + e.clientTop };
};

const enthaelt = (e: Element, x: number, y: number) => {
	const r = e.getBoundingClientRect();
	return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

/** Die Fläche unter dem Zeiger; bei mehreren (sie liegen untereinander) die erste. */
export const flaecheUnter = (doc: Document, x: number, y: number): Element | null =>
	[...doc.querySelectorAll('.flaeche')].find((f) => nrVon(f) !== null && enthaelt(f, x, y)) ?? null;

const seiteUnter = (doc: Document, x: number, y: number): Element | null =>
	[...doc.querySelectorAll('.seite')].find((s) => nrVon(s) !== null && !s.hasAttribute('data-erzeugt') && enthaelt(s, x, y)) ??
	null;

/** Wohin ein gezogenes Element beim Loslassen gehört, wenn nicht dorthin, wo es liegt. */
export interface FlaechenWechsel {
	/** Die Fläche, in die es geht; `null`: heraus auf die Seite `seite`. */
	ziel: Element | null;
	seite: Element | null;
	/** Linke obere Ecke im Behälter des Ziels (Fläche oder Seite), ganze px. */
	lage: Punkt;
	text: string;
}

/**
 * Ändert sich der Behälter des Elements, weil der Zeiger in einer anderen Fläche (oder keiner) steht? `ursprung` und
 * `jetzt` sind Ursprung und Lage des Elements im bisherigen Behälter; `null`, wenn es bleibt, wo es ist.
 */
export const flaechenWechsel = (
	doc: Document,
	element: Element,
	ursprung: Punkt,
	jetzt: Punkt,
	zeiger: Punkt,
): FlaechenWechsel | null => {
	const eltern = element.parentElement;
	const von = eltern?.matches('.flaeche') ? eltern : null;
	const ziel = flaecheUnter(doc, zeiger.x, zeiger.y);
	if (ziel === von) {
		return null;
	}
	const hier = { x: ursprung.x + jetzt.x, y: ursprung.y + jetzt.y };
	const seite = ziel ? null : seiteUnter(doc, zeiger.x, zeiger.y);
	const behaelter = ziel ?? seite;
	if (!behaelter) {
		return null;
	}
	const o = ursprungVon(behaelter);
	return {
		ziel,
		seite,
		lage: { x: Math.round(hier.x - o.x), y: Math.round(hier.y - o.y) },
		text: ziel ? 'In die Fläche' : 'Aus der Fläche',
	};
};

/**
 * Messung der gewählten Fläche für den Auswahlrahmen: Kasten in Koordinaten der Seite, Ursprung ist deren Innenkante.
 * Gleiche Form wie `Messung` in `useGeste`.
 */
export const kastenDerFlaeche = (flaeche: Element) => {
	const seite = flaeche.closest('.seite') ?? flaeche.ownerDocument.body;
	const o = ursprungVon(seite);
	const r = flaeche.getBoundingClientRect();
	return {
		kasten: { x: r.left - o.x, y: r.top - o.y, b: r.width, h: r.height, drehen: 0 },
		ursprung: o,
		behaelter: seite,
	};
};

/** Während einer Geste darf eine Fläche nicht abschneiden: Das Element soll beim Herausziehen zu sehen sein. */
export const OFFEN = 'data-flaeche-offen';

export const oeffneFlaechen = (doc: Document, offen: boolean) => {
	if (offen) {
		doc.documentElement.setAttribute(OFFEN, '');
	} else {
		doc.documentElement.removeAttribute(OFFEN);
	}
};
