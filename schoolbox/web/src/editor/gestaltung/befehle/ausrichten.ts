import { fuerAlle, leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';

import type { SymbolName } from '../../../bausteine/Symbol';
import type { Befehl, Kontext, Kuerzel } from '../../befehle';
import type { GestaltungKontext } from '../kontext';
import type { Ausrichtung } from '../mehrfach';
import { ausrichten, elementeZu, innenflaecheVon, rechteckVon, umschliessend, verteile } from '../mehrfach';

/**
 * Ausrichten und Verteilen (113, Briefing 5.9 und 5.11). Mehrere richten sich an ihrem gemeinsamen Rechteck aus, ein
 * einzelnes an der Innenfläche der Seite (innerhalb von `--rand`), sonst landete „links“ im Druckrand. Gemessen wird das
 * umschließende Rechteck, auch bei gedrehten Elementen. Jede Aktion ist ein Schritt (`fuerAlle`).
 * Die Tasten mit ⌥ über `code`, weil ⌥ am Mac Sonderzeichen erzeugt; nie beim Tippen (wie die Werkzeuge, 098).
 */

const tippfrei = (k: Kontext) => k.gestaltung !== null && !k.textsitzung && !k.feldBehaeltUndo();

/** Gestaltungselemente der Auswahl, die sich bewegen dürfen (gesperrte bleiben stehen). */
const beweglich = (g: GestaltungKontext) =>
	elementeZu(g.doc, g.nrn).filter(({ element }) => !element.hasAttribute('data-gesperrt'));

/** Schreibt die Wege als einen Schritt. Ändert sich nichts, kein Schritt. */
const schiebeAlle = (g: GestaltungKontext, titel: string, wege: { nr: number; dx: number; dy: number }[]) => {
	const echt = wege
		.map((w) => ({ ...w, dx: Math.round(w.dx), dy: Math.round(w.dy) }))
		.filter((w) => w.dx !== 0 || w.dy !== 0);
	if (echt.length === 0) {
		return false;
	}
	const je = new Map(echt.map((w) => [w.nr, w]));
	return g.fuehreAus(titel, (q) => {
		const r = fuerAlle(
			q,
			echt.map((w) => w.nr),
			(q2, nr) => {
				const w = je.get(nr);
				if (!w) {
					return q2;
				}
				const lage = leseLage(q2, nr);
				return setzeLage(q2, nr, { x: (lage.x ?? 0) + w.dx, y: (lage.y ?? 0) + w.dy });
			},
		);
		return { quelle: r.quelle, nr: g.nr };
	});
};

const AUSRICHTUNGEN: { wie: Ausrichtung; titel: string; code: string; symbol: SymbolName }[] = [
	{ wie: 'links', titel: 'Links ausrichten', code: 'KeyA', symbol: 'ausrichten-links' },
	{ wie: 'mitte', titel: 'Waagerecht mittig ausrichten', code: 'KeyH', symbol: 'ausrichten-mitte' },
	{ wie: 'rechts', titel: 'Rechts ausrichten', code: 'KeyD', symbol: 'ausrichten-rechts' },
	{ wie: 'oben', titel: 'Oben ausrichten', code: 'KeyW', symbol: 'ausrichten-oben' },
	{ wie: 'mittig', titel: 'Senkrecht mittig ausrichten', code: 'KeyV', symbol: 'ausrichten-mittig' },
	{ wie: 'unten', titel: 'Unten ausrichten', code: 'KeyS', symbol: 'ausrichten-unten' },
];

/** Die Id je Ausrichtung, wie Briefing 5.11 sie nennt. */
export const AUSRICHTEN_ID: Record<Ausrichtung, string> = {
	links: 'auswahl.ausrichten-links',
	mitte: 'auswahl.ausrichten-mitte',
	rechts: 'auswahl.ausrichten-rechts',
	oben: 'auswahl.ausrichten-oben',
	mittig: 'auswahl.ausrichten-mittig',
	unten: 'auswahl.ausrichten-unten',
};

export const AUSRICHTEN_TITEL: Record<Ausrichtung, string> = Object.fromEntries(
	AUSRICHTUNGEN.map((a) => [a.wie, a.titel]),
) as Record<Ausrichtung, string>;

const richteAus = (g: GestaltungKontext, wie: Ausrichtung, titel: string) => {
	const liste = beweglich(g);
	const ziel =
		g.nrn.length > 1
			? umschliessend(elementeZu(g.doc, g.nrn).map(({ element }) => rechteckVon(element)))
			: innenflaecheVon(g.element);
	if (!ziel || liste.length === 0) {
		return false;
	}
	const wege = ausrichten(
		liste.map(({ element }) => rechteckVon(element)),
		ziel,
		wie,
	);
	return schiebeAlle(
		g,
		titel,
		liste.map(({ nr }, i) => ({ nr, ...(wege[i] ?? { dx: 0, dy: 0 }) })),
	);
};

const verteileAlle = (g: GestaltungKontext, richtung: 'waagerecht' | 'senkrecht') => {
	const liste = beweglich(g);
	const wege = verteile(
		liste.map(({ element }) => rechteckVon(element)),
		richtung,
	);
	return schiebeAlle(
		g,
		richtung === 'waagerecht' ? 'Waagerecht verteilt' : 'Senkrecht verteilt',
		liste.map(({ nr }, i) => ({ nr, ...(wege[i] ?? { dx: 0, dy: 0 }) })),
	);
};

export const AUSRICHTEN_BEFEHLE: Befehl[] = [
	...AUSRICHTUNGEN.map(
		({ code, symbol, titel, wie }): Befehl => ({
			id: AUSRICHTEN_ID[wie],
			titel,
			gruppe: 'ordnen',
			symbol,
			kuerzel: [{ code, wahl: true, wenn: tippfrei } satisfies Kuerzel],
			modus: ['auswahl'],
			tasteWenn: tippfrei,
			suchwoerter: ['ausrichten', 'bündig', 'anordnen', 'mehrere'],
			orte: ['taste', 'palette', 'gestaltung'],
			sichtbarUnter: 'mehr',
			verfuegbar: (k) => k.aktiv && k.gestaltung !== null && beweglich(k.gestaltung).length > 0,
			aus: (k) => {
				const g = k.gestaltung;
				return g ? richteAus(g, wie, titel) : undefined;
			},
		}),
	),
	...(['waagerecht', 'senkrecht'] as const).map(
		(richtung): Befehl => ({
			id: `auswahl.verteilen-${richtung}`,
			symbol: `verteilen-${richtung}`,
			titel: richtung === 'waagerecht' ? 'Waagerecht verteilen' : 'Senkrecht verteilen',
			gruppe: 'ordnen',
			suchwoerter: ['verteilen', 'abstand', 'gleichmäßig', 'mehrere'],
			orte: ['palette', 'gestaltung'],
			sichtbarUnter: 'mehr',
			verfuegbar: (k) => k.aktiv && (k.gestaltung?.nrn.length ?? 0) >= 3,
			aus: (k) => {
				const g = k.gestaltung;
				return g ? verteileAlle(g, richtung) : undefined;
			},
		}),
	),
];
