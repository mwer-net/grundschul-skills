/**
 * Besitzer: 176 (angelegt), 179 ergänzt den Filter für „Bilder“. Welche Figuren ein Text nennt, nach den Regeln aus
 * 158: NFC und klein, an Wortgrenzen aus Buchstaben und Ziffern (nicht `\b`, das kennt keine Umlaute), mit Genitiv.
 * Ohne Abhängigkeiten, damit Server und Browser dasselbe Ergebnis haben.
 */

import type { BibliotheksFigur } from './figuren';

const ZEICHEN = '[\\p{L}\\p{N}\\p{M}]';

const klein = (text: string) => text.normalize('NFC').toLocaleLowerCase('de');

const maskiert = (wort: string) => wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ein Name aus mehreren Wörtern mit beliebigem Leerraum dazwischen, dahinter `s`, `'s`, `’s`, `'` oder `’`. */
const muster = (name: string) =>
	new RegExp(
		`(?<!${ZEICHEN})${name.split(/\s+/).map(maskiert).join('\\s+')}(?=(?:['’]s?|s)?(?!${ZEICHEN}))`,
		'gu',
	);

/**
 * Die Figuren, deren `name` im Text steht, in der Reihenfolge ihres ersten Vorkommens, jede einmal, ungekürzt. Längere
 * Namen zuerst; eine getroffene Stelle zählt für keinen weiteren Namen. Kein Filter auf Steckbrief oder Referenz (179
 * filtert vor dem Aufruf).
 */
export const figurenIn = <F extends Pick<BibliotheksFigur, 'name'>>(text: string, figuren: readonly F[]): F[] => {
	const quelle = klein(text);
	const belegt = new Array<boolean>(quelle.length).fill(false);
	const treffer: { figur: F; stelle: number }[] = [];
	const namen = figuren
		.map((figur) => ({ figur, name: klein(figur.name).trim() }))
		.filter((n) => n.name !== '')
		.sort((a, b) => b.name.length - a.name.length);
	for (const { figur, name } of namen) {
		let erste = -1;
		for (const m of quelle.matchAll(muster(name))) {
			const von = m.index;
			const bis = von + m[0].length;
			if (belegt.slice(von, bis).some(Boolean)) {
				continue;
			}
			belegt.fill(true, von, bis);
			if (erste < 0) {
				erste = von;
			}
		}
		if (erste >= 0 && !treffer.some((t) => t.figur === figur)) {
			treffer.push({ figur, stelle: erste });
		}
	}
	return treffer.sort((a, b) => a.stelle - b.stelle).map((t) => t.figur);
};

// >> 179
/** Höchstens so viele Figuren trägt ein Bild aus „Bilder“. */
export const MAX_FIGUREN_JE_BILD = 4;

/**
 * Die Figuren für ein Bild aus „Bilder“: nur solche mit Steckbrief oder Media-ID. Im Bildlauf gibt es kein
 * `referenz/<id>.png`, aus dem Claude das Aussehen ablesen könnte; jeder andere Name gilt als gewöhnlicher Name.
 */
export const figurenFuerBild = <F extends Pick<BibliotheksFigur, 'name' | 'steckbrief' | 'canva'>>(
	text: string,
	figuren: readonly F[],
): F[] => figurenIn(text, figuren.filter((f) => f.steckbrief || f.canva));
// << 179
