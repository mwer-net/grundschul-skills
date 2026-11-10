export const OEFFNEN = 'schoolbox-blatt-gestaltung';

/** Kommt der Wunsch, bevor der Reiter „Blatt“ zu sehen ist, liest ihn der Abschnitt beim Erscheinen. */
let offenerWunsch: number | null = null;

/** Gibt den offenen Wunsch einmal heraus und vergisst ihn. */
export const nimmOffenenWunsch = () => {
	const nr = offenerWunsch;
	offenerWunsch = null;
	return nr;
};

/**
 * Aus den Ebenen: Seite `nr` wählen, Reiter „Blatt“ zeigen und den Abschnitt „Gestaltung“ aufklappen.
 * `zeigeEinstellung` ist die Sprungfunktion des Editors (wie aus der Palette).
 */
export const zeigeBlattGestaltung = (
	nr: number,
	zeigeAn: (nr: number) => void,
	zeigeEinstellung: (ort: string) => void,
) => {
	offenerWunsch = nr;
	zeigeAn(nr);
	zeigeEinstellung('gestaltung');
	window.dispatchEvent(new CustomEvent(OEFFNEN));
};
