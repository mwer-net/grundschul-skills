/**
 * Was die Prüfung der Gestaltung (096) selbst reparieren kann: „In die Seite holen“ an der Meldung `aussen`. Eine eigene
 * Datei, damit `gestaltung.ts` frei bleibt für die Umformungen beim Ziehen (097).
 */

import type { LageTeil } from './gestaltung';
import { istGestaltung, leseLage, setzeLage } from './gestaltung';
import { DRUCKRAND } from './gestaltung-arten';
import { zerlege } from './quelltext';

export interface Mass {
	breite: number;
	hoehe: number;
}

/** In px, relativ zur linken oberen Ecke der Seite. */
export interface Seitenrechteck extends Mass {
	links: number;
	oben: number;
}

/** Was der Editor aus der Darstellung misst; der Kern kennt keine Darstellung. */
export interface Seitenmass {
	/** Breite und Höhe der Seite. */
	seite: Mass;
	/** Das Element nach dem Drehen (`getBoundingClientRect`), relativ zur Seite. */
	rechteck: Seitenrechteck;
	/** Das Element vor dem Drehen (`offsetWidth`, `offsetHeight`). */
	groesse: Mass;
}

/** Ein px mehr als der Druckrand: Die Lage wird auf ganze px gerundet und soll danach sicher nicht mehr melden. */
const INNEN = DRUCKRAND + 1;

const klemme = (wert: number, min: number, max: number) => Math.min(Math.max(wert, min), Math.max(min, max));

/**
 * Holt ein Gestaltungselement in die Seite: Es rückt so, dass es ganz innerhalb des Druckrands liegt. Nur wenn es
 * größer ist als die Fläche dort, wird es verkleinert, mit gleichem Seitenverhältnis und um seine Mitte (wie das
 * Drehen in `blatt.css`). Gilt auch am Anker: Verschoben wird um den Unterschied, nicht auf eine Koordinate der Seite.
 * Nur Attribute ändern sich, die Nummern bleiben.
 */
export const holeInSeite = (quelle: string, nr: number, { groesse, rechteck, seite }: Seitenmass): string => {
	const k = zerlege(quelle).knoten[nr];
	if (!k || !istGestaltung(k)) {
		throw new Error(`Das Element ${nr} ist keine Gestaltung.`);
	}
	const platzB = seite.breite - 2 * INNEN;
	const platzH = seite.hoehe - 2 * INNEN;
	const faktor = Math.min(1, platzB / Math.max(rechteck.breite, 1), platzH / Math.max(rechteck.hoehe, 1));
	const aussenB = Math.floor(rechteck.breite * faktor);
	const aussenH = Math.floor(rechteck.hoehe * faktor);
	const mitteX = rechteck.links + rechteck.breite / 2;
	const mitteY = rechteck.oben + rechteck.hoehe / 2;
	const links = klemme(mitteX - aussenB / 2, INNEN, seite.breite - INNEN - aussenB);
	const oben = klemme(mitteY - aussenH / 2, INNEN, seite.hoehe - INNEN - aussenH);
	const b = groesse.breite * faktor;
	const h = groesse.hoehe * faktor;
	// Die Mitte bleibt beim Drehen stehen: Die linke obere Ecke vor dem Drehen liegt eine halbe Größe davor.
	const dx = links + aussenB / 2 - b / 2 - (mitteX - groesse.breite / 2);
	const dy = oben + aussenH / 2 - h / 2 - (mitteY - groesse.hoehe / 2);
	const lage = leseLage(quelle, nr);
	const teil: LageTeil = { x: (lage.x ?? 0) + dx, y: (lage.y ?? 0) + dy };
	if (faktor < 1) {
		// Ohne Angabe ergibt sich die Höhe aus der Breite (Bild, Figur); die Breite setzen genügt dann.
		if (lage.b !== undefined || lage.h === undefined) {
			teil.b = Math.floor(b);
		}
		if (lage.h !== undefined) {
			teil.h = Math.floor(h);
		}
	}
	return setzeLage(quelle, nr, teil);
};
