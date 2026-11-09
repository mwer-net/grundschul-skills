/**
 * Neue Schmuckschrift beginnt in der Textsitzung (105): Klick in der Schublade „Text“ und Werkzeug T legen sie ab (ein
 * Schritt) und wünschen sich hier die Sitzung. Sobald die Auswahl auf dem neuen Element landet, öffnet `useText` sie
 * mit markiertem Platzhalter. Endet diese erste Sitzung, wird sie mit dem Anlegen **ein** Schritt; ist der Text leer,
 * verschwindet das Element, und es bleibt kein Schritt (5.10, Entscheidung 36).
 */

/** Wie lange ein Wunsch gilt: Das Blatt lädt nach dem Ablegen neu, das dauert selten mehr als eine Sekunde. */
const GILT_MS = 4000;

// 107: auch Form mit Text (Sprechblase, Band): Klick in der Schublade öffnet die Sitzung mit markiertem „Text“.
const SCHMUCK = 'div.schmuck[data-lage="frei"], .form-text[data-lage="frei"]';

let wunsch = 0;
/** Die Quelle direkt nach dem Anlegen, solange die erste Sitzung läuft. */
let angelegt: string | null = null;

/** Vor dem Ablegen: Die nächste Auswahl einer Schmuckschrift öffnet die Textsitzung. */
export const wuenscheTextsitzung = () => {
	wunsch = Date.now() + GILT_MS;
};

/**
 * Beim Rüsten der Textsitzung: `true`, wenn sie sofort beginnen soll. Merkt sich dann die Quelle, damit das Ende der
 * Sitzung weiß, dass es mit dem Anlegen zusammengehört.
 */
export const nimmTextsitzungWunsch = (element: Element, quelle: string) => {
	if (Date.now() > wunsch || !element.matches(SCHMUCK)) {
		return false;
	}
	wunsch = 0;
	angelegt = quelle;
	return true;
};

/** Am Ende jeder Sitzung: `true`, wenn es die erste Sitzung nach dem Anlegen war (auf der Quelle von damals). */
export const endetNachAnlegen = (quelle: string) => {
	const war = angelegt !== null && angelegt === quelle;
	angelegt = null;
	return war;
};
