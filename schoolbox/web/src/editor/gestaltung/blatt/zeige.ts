import type { SeitenTeil } from './teile';

/**
 * Aus den Ebenen: Seite `nr` wählen, Reiter „Blatt“ zeigen und zum Abschnitt des Teils springen.
 * `zeigeEinstellung` ist die Sprungfunktion des Editors (wie aus der Palette).
 */
export const zeigeBlattGestaltung = (
	nr: number,
	teil: SeitenTeil,
	zeigeAn: (nr: number) => void,
	zeigeEinstellung: (ort: string) => void,
) => {
	zeigeAn(nr);
	zeigeEinstellung(teil);
};
