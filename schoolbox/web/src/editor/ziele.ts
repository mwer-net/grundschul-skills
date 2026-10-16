import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { kann } from '@schoolbox/kern/src/bausteine';
import type { Ablage } from '@schoolbox/kern/src/struktur';

import { bausteinVon, nrVon } from './darstellung';

/** Eine Einfügemarke in Koordinaten des Materials: waagerechte Linie zwischen Zeilen, senkrechte im Raster. */
export interface Marke {
	x: number;
	y: number;
	laenge: number;
	senkrecht: boolean;
}

export interface Platz {
	ablage: Ablage;
	marke: Marke;
}

interface Gruppe {
	bereich: Element;
	/** Die Bausteine gleicher Art im Bereich, in Dokumentreihenfolge, mit dem gezogenen. */
	glieder: Element[];
}

export interface Ordnung {
	element: Element;
	baustein: Baustein;
	gruppen: Gruppe[];
}

/** Ziehen im Blatt: alles mit `ordnen`, außer was dafür in der Seitenleiste liegt. */
export const ziehbarImBlatt = (baustein: Baustein) => kann(baustein, 'ordnen') && !baustein.ordnenInLeiste;

/** Wohin der Baustein darf (Register: `ordnenIn`, sonst das Elternelement) und zwischen welche Geschwister. */
export const ordnungVon = (element: Element, baustein: Baustein): Ordnung => {
	const doc = element.ownerDocument;
	const { ordnenIn } = baustein;
	const bereiche = ordnenIn ? [...doc.querySelectorAll(ordnenIn)] : [element.parentElement];
	const gleiche = [...doc.querySelectorAll(baustein.selektor)].filter(
		(e) => nrVon(e) !== null && bausteinVon(e) === baustein && (e === element || !element.contains(e)),
	);
	const gruppen = bereiche
		.filter((b): b is Element => b !== null && nrVon(b) !== null && !element.contains(b))
		.map((bereich) => ({
			bereich,
			glieder: gleiche.filter(
				(e) => (ordnenIn ? e.parentElement?.closest(ordnenIn) : e.parentElement) === bereich,
			),
		}));
	return { element, baustein, gruppen };
};

const rechteck = (e: Element) => e.getBoundingClientRect();

/** Liegen die Glieder nebeneinander (Raster mit mehreren Spalten) statt untereinander? */
export const nebeneinander = (glieder: Element[]) => {
	const r = glieder.map(rechteck);
	return r.some((a, i) => r.slice(i + 1).some((b) => Math.abs(a.top - b.top) < 4 && Math.abs(a.left - b.left) > 4));
};

const abstandZu = ({ laenge, senkrecht, x, y }: Marke, px: number, py: number) => {
	const [breite, hoehe] = senkrecht ? [0, laenge] : [laenge, 0];
	const dx = Math.max(x - px, 0, px - (x + breite));
	const dy = Math.max(y - py, 0, py - (y + hoehe));
	return Math.hypot(dx, dy);
};

const RAND = 6;

/** Die Plätze vor und hinter jedem Glied außer dem gezogenen, mit Marke mitten in der Lücke zum Nachbarn. */
const plaetzeIn = (glieder: Element[], element: Element): (Platz & { ohneWirkung: boolean })[] => {
	const quer = nebeneinander(glieder);
	const i = glieder.indexOf(element);
	return glieder.flatMap((g, j) => {
		const nr = nrVon(g);
		if (g === element || nr === null) {
			return [];
		}
		const r = rechteck(g);
		const vorher = glieder[j - 1] ? rechteck(glieder[j - 1] as Element) : null;
		const nachher = glieder[j + 1] ? rechteck(glieder[j + 1] as Element) : null;
		const marke = (wo: 'vor' | 'nach'): Marke => {
			if (quer) {
				const nachbar = wo === 'vor' ? vorher : nachher;
				const gleicheZeile = nachbar && Math.abs(nachbar.top - r.top) < 4;
				const kante = wo === 'vor' ? r.left : r.right;
				const mitte = gleicheZeile ? (kante + (wo === 'vor' ? nachbar.right : nachbar.left)) / 2 : null;
				return {
					x: mitte ?? kante + (wo === 'vor' ? -RAND : RAND),
					y: r.top,
					laenge: r.height,
					senkrecht: true,
				};
			}
			const oben = vorher ? (vorher.bottom + r.top) / 2 : r.top - RAND;
			const unten = nachher ? (r.bottom + nachher.top) / 2 : r.bottom + RAND;
			return { x: r.left, y: wo === 'vor' ? oben : unten, laenge: r.width, senkrecht: false };
		};
		return (['vor', 'nach'] as const).map((wo) => ({
			ablage: { nr, wo },
			marke: marke(wo),
			ohneWirkung: (wo === 'vor' && j === i + 1) || (wo === 'nach' && j === i - 1),
		}));
	});
};

/** Ein Bereich ohne passende Geschwister, etwa eine neue Seite: Marke unter dem letzten Inhalt. */
const platzAmEnde = (bereich: Element): Platz | null => {
	const nr = nrVon(bereich);
	if (nr === null) {
		return null;
	}
	const r = rechteck(bereich);
	const kinder = [...bereich.children].filter((k) => !k.classList.contains('fuss'));
	const letztes = kinder.at(-1);
	const stil = bereich.ownerDocument.defaultView?.getComputedStyle(bereich);
	const innen = parseFloat(stil?.paddingLeft ?? '0') || 0;
	const oben = letztes ? rechteck(letztes).bottom + 12 : r.top + (parseFloat(stil?.paddingTop ?? '0') || 0);
	return { ablage: { in: nr }, marke: { x: r.left + innen, y: oben, laenge: r.width - 2 * innen, senkrecht: false } };
};

const naechsteGruppe = (gruppen: Gruppe[], x: number, y: number) => {
	let beste: Gruppe | null = null;
	let abstand = Infinity;
	for (const g of gruppen) {
		const r = rechteck(g.bereich);
		const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
		if (d < abstand) {
			abstand = d;
			beste = g;
		}
	}
	return beste;
};

/** Der Platz, an dem der gezogene Baustein bei (x, y) landet; `null`, wenn er dort bliebe, wo er ist. */
export const platzAn = ({ element, gruppen }: Ordnung, x: number, y: number): Platz | null => {
	const gruppe = naechsteGruppe(gruppen, x, y);
	if (!gruppe) {
		return null;
	}
	if (gruppe.glieder.every((g) => g === element)) {
		return gruppe.glieder.length ? null : platzAmEnde(gruppe.bereich);
	}
	let bester: (Platz & { ohneWirkung: boolean }) | null = null;
	let abstand = Infinity;
	for (const p of plaetzeIn(gruppe.glieder, element)) {
		const d = abstandZu(p.marke, x, y);
		if (d < abstand) {
			abstand = d;
			bester = p;
		}
	}
	return bester && !bester.ohneWirkung ? { ablage: bester.ablage, marke: bester.marke } : null;
};

/** Für die Knöpfe „nach oben/unten“: eins weiter in Dokumentreihenfolge, über Bereichsgrenzen hinweg an den Rand. */
export const nachbarAblage = ({ element, gruppen }: Ordnung, richtung: -1 | 1): Ablage | null => {
	const folge = gruppen.flatMap((g) => g.glieder.map((e) => ({ e, bereich: g.bereich })));
	const i = folge.findIndex((f) => f.e === element);
	const eigen = folge[i];
	const ziel = folge[i + richtung];
	const nr = ziel ? nrVon(ziel.e) : null;
	if (!eigen || !ziel || nr === null) {
		return null;
	}
	const gleicherBereich = ziel.bereich === eigen.bereich;
	if (richtung === 1) {
		return { nr, wo: gleicherBereich ? 'nach' : 'vor' };
	}
	return { nr, wo: gleicherBereich ? 'vor' : 'nach' };
};
