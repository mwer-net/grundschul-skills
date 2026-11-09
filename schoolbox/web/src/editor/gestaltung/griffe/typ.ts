import type { ReactNode } from 'react';

import type { Kasten } from '../geste';
import type { GestaltungKontext } from '../kontext';

/** Ein Zug an einem Zusatzgriff. Wege in Koordinaten des Elements vor dem Drehen (also mit dem Element gedreht). */
export interface GriffZug {
	/** Lage beim Start. */
	kasten: Kasten;
	/** Wo der Griff beim Start saß. */
	start: { x: number; y: number };
	dx: number;
	dy: number;
	umschalt: boolean;
	wahl: boolean;
	/** 106: Der Zeiger in Koordinaten des Materials (= im `iframe`), etwa für `elementsFromPoint`. */
	zeiger: { x: number; y: number };
}

/**
 * 106: Was ein Griff beim Ziehen zusätzlich zeigt, statt des Werts am Zeiger: einen Text, einen Rahmen um ein Ziel im
 * Blatt und eine Linie vom Griff zum Zeiger.
 */
export interface ZusatzAnzeige {
	text?: string;
	ziel?: Element | null;
	linie?: boolean;
}

/**
 * Ein Griff zusätzlich zu Ecken, Kanten und Drehgriff (097, Andockstelle). Jede Datei in `griffe/` exportiert eine Liste
 * davon, `index.ts` setzt sie zusammen, `auswahlrahmen.tsx` zeichnet sie. Esc setzt die Attribute des Elements zurück,
 * die beim Start galten; wer mehr ändert, gibt `zuruecksetzen` an.
 */
export interface ZusatzGriff {
	id: string;
	/** Name für Hilfsmittel und Hinweis beim Überfahren. */
	name: string;
	/**
	 * 107: Der Griff ersetzt den Rahmen: keine Ecken, Kanten, kein Drehgriff und keine Linie um das Element (Linie mit
	 * zwei Endpunkten).
	 */
	ersetztRahmen?: boolean;
	/** Für welche Art (aus `gestaltung-arten.ts`) bzw. welches Element. */
	fuer: (art: string, element: Element) => boolean;
	/** Wo er sitzt, in Koordinaten des Elements vor dem Drehen; `null`: gerade nicht. */
	wo: (element: Element, kasten: Kasten) => { x: number; y: number } | null;
	/** Wie er aussieht; ohne Angabe ein runder Punkt. */
	zeichne?: () => ReactNode;
	/** Zeiger-Klasse, z. B. `cursor-crosshair`. */
	zeiger?: string;
	/** Während des Ziehens: nur Anzeige im `iframe`, kein Schritt. Was er zurückgibt, zeigt die Überlagerung (106). */
	zeige: (g: GestaltungKontext, zug: GriffZug) => ZusatzAnzeige | void;
	/** Beim Loslassen: ein Schritt über `g.fuehreAus`. */
	schreibe: (g: GestaltungKontext, zug: GriffZug) => void;
	zuruecksetzen?: (g: GestaltungKontext) => void;
	/** 115: Der Griff ändert die Größe des Elements selbst; der Auswahlrahmen misst es bei jeder Bewegung neu. */
	folgtDemElement?: boolean;
}
