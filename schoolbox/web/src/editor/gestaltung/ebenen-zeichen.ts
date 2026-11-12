import type { SeitenTeil } from '@schoolbox/kern/src/seitengestaltung';

import type { SymbolName } from '../../bausteine/Symbol';
import type { Struktur } from '../struktur';
import { ANKER_ZEICHEN } from './ebenen-zeichen/anker';
import { SICHTBARKEIT_ZEICHEN } from './ebenen-zeichen/sichtbarkeit';

/** Was ein Zeichen beim Klick tun kann. */
export interface EbenenZeichenKontext {
	nr: number;
	element: Element;
	struktur: Pick<Struktur, 'aktiv' | 'aendereAttribute' | 'fuehreAus'>;
	/** Wählt das Element (oder einen Baustein), rollt hin und zeigt rechts seine Einstellungen. */
	zeigeAn: (nr: number) => void;
	/** Öffnet im Reiter „Blatt“ den Abschnitt des Teils der Seite mit dieser Nummer. */
	zeigeSeitengestaltung: (seite: number, teil: SeitenTeil) => void;
}

/**
 * Ein Zeichen rechts in einer Zeile der Ebenen (101, 1-ebenen.md „Zeichen rechts in der Zeile“). Ein Schalter (Auge,
 * Schloss) steht da, wenn er gesetzt ist, sonst bei Hover und an der gewählten Zeile, unter `any-pointer: coarse` im ⋯
 * der Zeile. Kein Schalter (Anker) steht nur da, wenn er gesetzt ist.
 */
export interface EbenenZeichen {
	id: string;
	/** Gehört das Zeichen in die Zeile dieses Elements? */
	fuer: (element: Element) => boolean;
	gesetzt: (element: Element) => boolean;
	schalter: boolean;
	symbol: (gesetzt: boolean) => SymbolName;
	/** Was der Klick tut, z. B. „Ausblenden“. */
	titel: (gesetzt: boolean) => string;
	klick: (k: EbenenZeichenKontext, gesetzt: boolean) => void;
}

/**
 * Das Register (Andockstelle aus 101). Jede Datei unter `ebenen-zeichen/` gehört einem Ticket: 101 Auge und Schloss,
 * 106 Anker. Die Reihenfolge hier ist die von links nach rechts.
 */
export const EBENEN_ZEICHEN: readonly EbenenZeichen[] = [...ANKER_ZEICHEN, ...SICHTBARKEIT_ZEICHEN];
