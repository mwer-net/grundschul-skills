/**
 * Testzugang für Ablegen und Werkzeuge (098): Ein Spec setzt vor dem Laden `window.__schoolboxTest = { gestaltung:
 * true }`. Dann sind ein Test-Gut, ein Test-Ziel und ein Test-Werkzeug bereit, sonst erscheinen sie nirgends. So lässt
 * sich das Grundgerüst prüfen, bevor die Schubladen Inhalt haben (102–105).
 */
export const imTest = () =>
	(globalThis as { __schoolboxTest?: { gestaltung?: boolean } }).__schoolboxTest?.gestaltung === true;
