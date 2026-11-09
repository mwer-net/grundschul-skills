import { fuerAlle, setzeLage, setzeStilWerte } from '@schoolbox/kern/src/gestaltung';
import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';

import { bausteinVon, nrVon } from '../darstellung';
import { zeigeNachGroesse } from './anzeige-folgen';
import type { Kandidat } from './einrasten';
import { kandidatenAufSeite } from './einrasten';
import type { GroessenArt, Kasten } from './geste';
import { zeigeLageAm } from './kontext';
import { alsKasten, rechteckVon, umschliessend } from './mehrfach';

/**
 * Gesten an einer Mehrfachauswahl (113): Bewegen, Drehen und Größe für eine Liste. Die Anzeige im `iframe` ändert jedes
 * Element, geschrieben wird am Ende **ein** Schritt mit `fuerAlle`. Elemente am Anker liegen in einem anderen Behälter:
 * Gerechnet wird darum im Material, jedes Element rechnet mit seinem `ursprung` hin und zurück.
 */

export interface Mitglied {
	nr: number;
	element: Element;
	/** Lage vor dem Drehen in Koordinaten des eigenen Behälters. */
	start: Kasten;
	ursprung: { x: number; y: number };
	attribute: [string, string][];
	hatte: { b: boolean; h: boolean };
	groesse: GroessenArt;
	gr: number | null;
}

export interface Gruppe {
	/** Das erste ist die Hauptauswahl. */
	mitglieder: Mitglied[];
	/** Umschließender Kasten aller im Material, ungedreht. */
	start: Kasten;
	jetzt: Kasten;
	/** Was die Elemente gerade zeigen, je Mitglied in Koordinaten seines Behälters. */
	lagen: Kasten[];
	kandidaten: Kandidat[];
}

const stilHat = (element: Element, name: string) =>
	(element.getAttribute('style') ?? '').split(';').some((t) => t.slice(0, t.indexOf(':')).trim() === name);

/** Wie `messe` in `useGeste.ts`; als Argument, damit die beiden Dateien einander nicht importieren. */
type Messen = (element: Element) => { kasten: Kasten; ursprung: { x: number; y: number } } | null;

const mitgliedVon = (element: Element, messe: Messen): Mitglied | null => {
	const nr = nrVon(element);
	const m = messe(element);
	if (nr === null || !m) {
		return null;
	}
	const groesse = (gestaltungArtNach(bausteinVon(element)?.art ?? '')?.groesse ?? 'frei') as GroessenArt;
	const stil = element.ownerDocument.defaultView?.getComputedStyle(element);
	const gr =
		groesse === 'text' ? parseFloat(stil?.getPropertyValue('--gr') ?? '') || parseFloat(stil?.fontSize ?? '') || null : null;
	return {
		nr,
		element,
		start: m.kasten,
		ursprung: m.ursprung,
		attribute: [...element.attributes].map((a) => [a.name, a.value]),
		hatte: { b: stilHat(element, '--b'), h: stilHat(element, '--h') },
		groesse,
		gr,
	};
};

/** Die Gruppe zu den Elementen, oder `null` bei weniger als zwei. Einmal je Geste gemessen. */
export const gruppeVon = (elemente: readonly Element[], messe: Messen): Gruppe | null => {
	const mitglieder = elemente.flatMap((e) => mitgliedVon(e, messe) ?? []);
	const rahmen = umschliessend(elemente.map(rechteckVon));
	if (mitglieder.length < 2 || !rahmen) {
		return null;
	}
	const seite = elemente[0]?.closest('.seite');
	const kandidaten = seite
		? kandidatenAufSeite(seite, { x: 0, y: 0 }, null).filter(
				(k) =>
					!elemente.some((e) => {
						const r = rechteckVon(e);
						return r.links === k.links && r.oben === k.oben && r.rechts === k.rechts && r.unten === k.unten;
					}),
			)
		: [];
	const start = alsKasten(rahmen);
	return { mitglieder, start, jetzt: start, lagen: mitglieder.map((m) => m.start), kandidaten };
};

export const imMaterial = (m: Mitglied, k: Kasten): Kasten => ({ ...k, x: k.x + m.ursprung.x, y: k.y + m.ursprung.y });
export const imBehaelter = (m: Mitglied, k: Kasten): Kasten => ({ ...k, x: k.x - m.ursprung.x, y: k.y - m.ursprung.y });

/** Stellt jedes Element wieder her, wie es beim Start war (Esc, Abbruch, fehlgeschlagener Schritt). */
export const stelleGruppeHer = (g: Gruppe) => {
	for (const m of g.mitglieder) {
		for (const { name } of [...m.element.attributes]) {
			if (!m.attribute.some(([n]) => n === name)) {
				m.element.removeAttribute(name);
			}
		}
		for (const [name, wert] of m.attribute) {
			if (m.element.getAttribute(name) !== wert) {
				m.element.setAttribute(name, wert);
			}
		}
		zeigeNachGroesse(m.element, m.start.b, m.start.h);
	}
};

const rund = (k: Kasten) => ({ x: Math.round(k.x), y: Math.round(k.y) });

/** Was beim Skalieren in die Quelle kommt, wie `groessenTeil` in `useGeste.ts` für ein einzelnes Element an der Ecke. */
const groessenTeil = (m: Mitglied, k: Kasten) => {
	const teil: LageTeil = rund(k);
	const werte: Record<string, string> = {};
	if (m.groesse === 'text') {
		if (m.hatte.b) {
			teil.b = Math.round(k.b);
		}
		if (m.gr) {
			werte['--gr'] = `${Math.round((m.gr * k.b) / Math.max(1, m.start.b))}px`;
		}
	} else {
		teil.b = Math.round(k.b);
		if (m.hatte.h || m.groesse === 'frei') {
			teil.h = Math.round(k.h);
		}
	}
	return { teil, werte };
};

export type GruppenArt = 'bewegen' | 'drehen' | 'skalieren';

/** Setzt die Lagen `g.lagen` im `iframe`, nur zum Ansehen. */
export const zeigeGruppe = (g: Gruppe, art: GruppenArt) => {
	g.mitglieder.forEach((m, i) => {
		const k = g.lagen[i] ?? m.start;
		if (art === 'skalieren') {
			const { teil, werte } = groessenTeil(m, k);
			zeigeLageAm(m.element, teil);
			zeigeNachGroesse(m.element, k.b, k.h);
			const stil = (m.element as HTMLElement).style;
			for (const [name, wert] of Object.entries(werte)) {
				stil.setProperty(name, wert);
			}
		} else if (art === 'drehen') {
			zeigeLageAm(m.element, { ...rund(k), drehen: k.drehen });
		} else {
			zeigeLageAm(m.element, rund(k));
		}
	});
};

/** Der eine Schritt für die ganze Gruppe. Die Auswahl bleibt bei der Hauptauswahl. */
export const rechneGruppe =
	(g: Gruppe, art: GruppenArt) =>
	(quelle: string): StrukturErgebnis => {
		const je = new Map(g.mitglieder.map((m, i) => [m.nr, { m, k: g.lagen[i] ?? m.start }]));
		const r = fuerAlle(
			quelle,
			g.mitglieder.map((m) => m.nr),
			(q, nr) => {
				const eintrag = je.get(nr);
				if (!eintrag) {
					return q;
				}
				const { k, m } = eintrag;
				if (art === 'skalieren') {
					const { teil, werte } = groessenTeil(m, k);
					return setzeStilWerte(setzeLage(q, nr, teil), nr, werte);
				}
				if (art === 'drehen') {
					return setzeLage(q, nr, { ...rund(k), drehen: k.drehen || null });
				}
				return setzeLage(q, nr, rund(k));
			},
		);
		return { quelle: r.quelle, nr: r.nr };
	};

/** Hat sich etwas geändert? Sonst kein Schritt. */
export const gruppeBewegt = (g: Gruppe) =>
	g.mitglieder.some((m, i) => {
		const a = m.start;
		const b = g.lagen[i] ?? a;
		return (
			Math.round(a.x) !== Math.round(b.x) ||
			Math.round(a.y) !== Math.round(b.y) ||
			Math.round(a.b) !== Math.round(b.b) ||
			Math.round(a.h) !== Math.round(b.h) ||
			a.drehen !== b.drehen
		);
	});
