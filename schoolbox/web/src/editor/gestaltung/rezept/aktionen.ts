import {
	entferneAufmachung,
	legeAufmachungFrei,
	leseAufmachung,
	wuerfleAufmachung,
} from '@schoolbox/kern/src/aufmachungen';

import { missKopfbaender } from './kopfband-messen';

/** Ein Schritt im Verlauf, wie `aendereAttribute` der Struktur bzw. `aendere` im Reiter „Blatt“. */
export type Aendere = (beschreibung: string, rechne: (q: string) => string) => unknown;

/** Eine neue Saat, sicher anders als die alte. */
export const neueSaat = (alt: number) => {
	const saat = 1 + Math.floor(Math.random() * 99_998);
	return saat === alt ? saat + 1 : saat;
};

export const wuerfle = (aendere: Aendere) =>
	aendere('Rezept gewürfelt', (q) => wuerfleAufmachung(q, neueSaat(leseAufmachung(q)?.saat ?? 0)));

/** Freilegen misst vorher das Kopfband im Blatt. */
export const legeFrei = (aendere: Aendere, doc: Document | null) =>
	aendere('Rezept freigelegt', (q) => legeAufmachungFrei(q, doc ? missKopfbaender(doc, q) : []));

export const entferne = (aendere: Aendere) => aendere('Rezept entfernt', entferneAufmachung);

export const FREILEGEN_HINWEIS = 'Alles wird normale Gestaltung. Das Rezept ändert es danach nicht mehr.';

/** Ereignis am `window`: Der Inspektor ohne Rezept öffnet die Schublade „Rezepte“ (Editor hört zu). */
export const REZEPTE_OEFFNEN = 'schoolbox-rezepte-oeffnen';
