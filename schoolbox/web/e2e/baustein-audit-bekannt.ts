/**
 * Was die Prüfmaschine (084) meldet, aber so sein soll. **Die Liste darf nur schrumpfen**: Der Test in
 * `baustein-audit.spec.ts` zählt sie und schlägt an, wenn ein Eintrag nichts mehr abdeckt. Schlüssel: Regel, Baustein
 * und Feld, wahlweise mit Wert: `W2 x-uhr.format` oder `W2 x-uhr.format=12 Stunden`.
 */
export const BEKANNT: Readonly<Record<string, string>> = {};

/** Darf nur sinken. Steigt die Zahl, schlägt die Maschine an. */
export const BEKANNT_HOECHSTENS = 0;
