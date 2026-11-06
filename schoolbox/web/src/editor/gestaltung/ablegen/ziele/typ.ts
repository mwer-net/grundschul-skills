import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';

import type { GestaltungsGut } from '../ziehgut';

/** Was ein Ziel beim Loslassen täte: Rahmen um `rahmen`, `text` am Zeiger, `lege` als ein Schritt. */
export interface AblageTreffer {
	rahmen: Element;
	text: string;
	lege: (quelle: string) => StrukturErgebnis;
}

/**
 * Ein Ziel bekommt das Element unter dem Zeiger (im `iframe`) und das Gut. Passt es nicht, gibt es `null` zurück; dann
 * fragt das Ablegen das nächste Ziel und am Ende gilt „frei ablegen“.
 */
export type AblageZiel = (unter: Element, gut: GestaltungsGut) => AblageTreffer | null;
