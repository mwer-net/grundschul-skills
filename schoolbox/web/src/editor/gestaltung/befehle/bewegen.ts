import type { Befehl } from '../../befehle';

/**
 * Bewegen (097): nichts Neues. Duplizieren (⌘D) und Löschen (⌫) gelten für Gestaltung schon über `auswahl.duplizieren`
 * und `auswahl.loeschen` (Kern: `dupliziereBaustein` → `dupliziereGestaltung`, 092). Esc (`auswahl.eltern`) geht zur
 * Seite, weil `pfadZu` die Ebene überspringt. Ziehen, Größe und Drehen sind Gesten (`useGeste.ts`), keine Befehle.
 */
export const BEWEGEN_BEFEHLE: Befehl[] = [];
