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
	/** Weitere Wörter für ⌘K und die Suche der Schublade (174: „Konfetti“ findet „Streuen“). */
	suchwoerter?: readonly string[];
	/** Ohne ⌘ und ohne ⌥; nie beim Tippen. Stern und Streuen haben keine Taste, nur den Knopf. */
	taste?: Kuerzel;
	/** CSS-Cursor über dem Blatt, solange das Werkzeug aktiv ist. */
	zeiger: string;
	/** Nur bereite Werkzeuge haben Befehl, Taste und Knopf. */
	bereit: (k: SchubladenLage) => boolean;
	/**
	 * `seite`: die Seite, auf der der Strich beginnt. `skala`: Bildschirm-px je px des Materials (116: Glätten und
	 * Schließen rechnen in Bildschirm-px, damit der Zoom nichts ändert).
	 */
	beginne: (p: Punkt, seite?: Element, skala?: number) => void;
	bewege: (p: Punkt, mod: Tasten) => Entwurf | null;
	ende: (p: Punkt, mod: Tasten) => Strich | null;
	/** Ein Klick ohne Strich, etwa T setzt dort Schmuckschrift. Ohne Angabe tut ein Klick nichts. */
	klick?: (p: Punkt) => Strich | null;
	/** 116: Ein Werkzeug aus mehreren Klicks (Pfad ⇧P). Ohne Angabe ist jeder Strich für sich. */
	mehrteilig?: Mehrteilig;
}

/** Was ein mehrteiliges Werkzeug am Ende eines Drucks oder bei einer Taste meldet. */
export type Fortgang = { fertig: Strich | null } | 'weiter' | 'abbruch';

/**
 * 116: Werkzeug aus mehreren Drücken auf derselben Seite. Jeder Druck setzt etwas (`runter`, `ziehe`, `hoch`), Bewegen
 * ohne Druck zeigt die Vorschau (`schwebe`). Solange es `laeuft`, gehören Enter, Backspace und Esc ihm (`taste`).
 */
export interface Mehrteilig {
	laeuft: () => boolean;
	runter: (p: Punkt, skala: number) => void;
	ziehe: (p: Punkt) => Entwurf | null;
	hoch: (p: Punkt) => Fortgang;
	schwebe: (p: Punkt) => Entwurf | null;
	taste: (taste: string) => Fortgang | null;
	/** Vergisst alles, ohne Element (Esc, Werkzeugwechsel). */
	abbruch: () => void;
}
