import type { LageTeil } from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';

import type { SymbolName } from '../../../bausteine/Symbol';
import type { Kuerzel } from '../../befehle';
import type { SchubladenLage } from '../../schubladen';

/** In Koordinaten der Seite, wie `--x` und `--y`. */
export interface Punkt {
	x: number;
	y: number;
}

/** Umschalttasten während des Strichs (⇧ Quadrat, ⌥ aus der Mitte …). */
export interface Tasten {
	umschalt: boolean;
	wahl: boolean;
	befehl: boolean;
}

/** Was das Werkzeug während des Strichs zeigt: nur im `iframe`, ohne Schritt. */
export interface Entwurf {
	html: string;
	lage: LageTeil;
}

/** Was am Ende des Strichs abgelegt wird; ohne `ebene` die Standard-Ebene der Art. */
export interface Strich extends Entwurf {
	ebene?: EbenenName;
}

/**
 * Ein Werkzeug (098, Briefing 5.10): zieht ein Gestaltungselement auf dem Blatt auf. Es gilt für einen Strich, danach
 * ist wieder V aktiv; mit ⇧ beim Wählen bleibt es bis Esc. Aus jedem Werkzeug entsteht der Befehl `werkzeug.<id>`.
 */
export interface Werkzeug {
	id: string;
	titel: string;
	symbol: SymbolName;
	/** Ohne ⌘ und ohne ⌥; nie beim Tippen. Stern und Streuen haben keine Taste, nur den Knopf. */
	taste?: Kuerzel;
	/** CSS-Cursor über dem Blatt, solange das Werkzeug aktiv ist. */
	zeiger: string;
	/** Nur bereite Werkzeuge haben Befehl, Taste und Knopf. */
	bereit: (k: SchubladenLage) => boolean;
	/** `seite`: die Seite, auf der der Strich beginnt (109: Streuen wählt danach die dichte Ecke). */
	beginne: (p: Punkt, seite?: Element) => void;
	bewege: (p: Punkt, mod: Tasten) => Entwurf | null;
	ende: (p: Punkt, mod: Tasten) => Strich | null;
	/** Ein Klick ohne Strich, etwa T setzt dort Schmuckschrift. Ohne Angabe tut ein Klick nichts. */
	klick?: (p: Punkt) => Strich | null;
}
