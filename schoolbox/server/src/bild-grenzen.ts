/**
 * Grenzen der Bildwerkzeuge (237). Eigenes Modul ohne Importe, damit `bild-werkzeug.ts` sie nicht aus `ki.ts` holen
 * muss: `ki.ts` hängt sie als `KI_GRENZEN.bild` ein (dasselbe Objekt) und importiert selbst die Bildwerkzeuge.
 *
 * Das Ratenlimit der Stufe „Build“ liegt bei 20 Bildern je Minute; OpenAI nennt bis zu 2 Minuten je Bild, gemessen
 * 17–42 s mit 2.6 Sunburst. `gesamtMs` gilt für einen Werkzeugaufruf mit Warteschlange und Wiederholungen: Er bleibt
 * unter den 30 min, nach denen Claude Code einen stummen stdio-Aufruf abbricht.
 */
export const BILD_GRENZEN = {
	gleichzeitig: 3,
	zeitMs: 180_000,
	gesamtMs: 20 * 60_000,
	/** Höchstens so viele Aufrufe je Lauf, nach Art des Laufs. */
	aufrufe: { einheit: 90, blatt: 8, schublade: 3 },
};
