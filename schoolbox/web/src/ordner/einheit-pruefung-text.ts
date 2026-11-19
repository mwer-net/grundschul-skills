import type { BildHinweis } from '@schoolbox/kern/src/einheit';
import { BILDER_SCHRITT } from '@schoolbox/kern/src/einheit-bau';
import { FACHLICH_PRUEFEN } from '@schoolbox/kern/src/einheit-pruefung';

/** Der Satz über den offenen fachlichen Befunden der Prüfung (244). */
export const fachlichOffenSatz = (n: number) =>
	`${n === 1 ? 'Ein fachlicher Befund' : `${n} fachliche Befunde`} nach den Korrekturrunden offen: bitte ${FACHLICH_PRUEFEN}.`;

/** Der Satz über den Bildern, die nach zwei neuen Versuchen nicht gelungen sind (248). */
export const bilderOffenSatz = (n: number) =>
	`${n === 1 ? 'Ein Bild ist' : `${n} Bilder sind`} nicht gelungen: bitte neu erzeugen oder ersetzen.`;

/** Je Bild eine Zeile: Datei, das Material, in dessen Lauf es auffiel, und der Fehler. */
export const bildHinweisZeile = (h: BildHinweis, titel: (slug: string) => string) =>
	`${h.datei}${h.von && h.von !== BILDER_SCHRITT ? ` („${titel(h.von)}“)` : ''}: ${h.text}`;
