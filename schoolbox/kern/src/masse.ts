/**
 * Maße im Inspektor (197-U3, 196-28): Gespeichert bleibt px, gezeigt und getippt wird in cm mit einer Nachkommastelle.
 * Erst eine Eingabe schreibt einen Wert; das Öffnen eines Materials ändert nichts. Eine Umrechnung für alle Felder.
 */

export const PX_JE_CM = 96 / 2.54;

const zehntel = (n: number) => Math.round(n * 10) / 10;

export const pxZuCm = (px: number) => zehntel(px / PX_JE_CM);
export const cmZuPx = (cm: number) => Math.round(cm * PX_JE_CM);

/** Nachkommastellen eines Schritts, damit 0,1 + 0,2 nicht 0,30000000000000004 ergibt (197-19). */
const stellen = (schritt: number) => (String(schritt).split('.')[1] ?? '').length;

/** Auf den Schritt gerundet und auf die Grenzen gesetzt (196-10, 196-29). */
export const rasteEin = (wert: number, { max, min, schritt }: Grenzen) => {
	const gerundet = Number((Math.round(wert / schritt) * schritt).toFixed(stellen(schritt)));
	return Math.min(max, Math.max(min, gerundet));
};

/** Mit Komma, wie im Blatt. */
export const zahlMitKomma = (n: number) => String(n).replace('.', ',');

/** Getippt mit Komma oder Punkt; `NaN` für leer oder Text. */
export const liesZahl = (text: string) => {
	const t = text.trim().replace(/−/g, '-').replace(',', '.');
	return /^-?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : Number.NaN;
};

export interface Grenzen {
	min: number;
	max: number;
	schritt: number;
}

/** Grenzen in px als Grenzen in cm; die Ränder bleiben so, dass sie umgerechnet innerhalb der px-Grenzen liegen. */
export const grenzenInCm = ({ max, min, schritt }: Grenzen): Grenzen => {
	let von = Math.max(0.1, pxZuCm(min));
	if (cmZuPx(von) < min) {
		von = zehntel(von + 0.1);
	}
	let bis = pxZuCm(max);
	if (cmZuPx(bis) > max) {
		bis = zehntel(bis - 0.1);
	}
	return { min: von, max: Math.max(von, bis), schritt: Math.max(0.1, pxZuCm(schritt)) };
};

/** Welche px-Felder in cm erscheinen: alle Maße, nicht die Schriftgröße (sie bleibt in px wie im Textprogramm). */
export const inCm = (feld: { einheit?: string | undefined; attribut: string }) =>
	feld.einheit === 'px' && feld.attribut !== 'schrift';
