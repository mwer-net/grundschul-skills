/** Ausgeschrieben, damit Tailwind jede Klasse findet. */
const SPALTEN = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' } as const;

/** Raster für Kacheln, 8 px Abstand. Wird die Schublade breiter, wachsen die Kacheln; die Spaltenzahl bleibt. */
export const raster = (spalten: keyof typeof SPALTEN) => `grid gap-2 ${SPALTEN[spalten]}`;

/** Der eine Wortlaut nach einer Suche ohne Treffer. */
export const nichtsPasst = (suche: string) => `Nichts passt zu „${suche.trim()}“.`;
