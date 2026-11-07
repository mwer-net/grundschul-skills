import type { ComponentType } from 'react';

import { falte } from '../../../lib/text';
import type { PalettenEintrag } from '../../palette-suche';
import type { SchubladenTeile, SchubladenZiele } from '..';

/** Was jeder Abschnitt der Schublade „Formen“ bekommt. */
export interface FormenTeile {
	teile: SchubladenTeile;
	/** Das Suchfeld oben in der Schublade; leer zeigt alles. */
	suche: string;
}

/**
 * Ein Abschnitt der Schublade „Formen“ (104, Andockstelle): je Datei unter `schubladen/formen/` einer. Eine Datei, deren
 * Abschnitt noch nicht gebaut ist, exportiert `null`; dann erscheint er nicht (5.2: keine ausgegrauten Knöpfe).
 */
export interface FormenAbschnitt {
	id: string;
	titel: string;
	/** Leise rechts neben dem Titel, z. B. „Klick oder ziehen“. */
	hinweis?: string;
	/** Hat der Abschnitt bei dieser Suche etwas zu zeigen? Sonst fehlt er samt Titel. */
	zeigt: (t: FormenTeile) => boolean;
	Inhalt: ComponentType<FormenTeile>;
	/** Einträge für ⌘K, z. B. „Stern“ legt einen Stern ab. */
	suche?: (z: SchubladenZiele) => PalettenEintrag[];
}

/** Passt einer der Namen zur Suche? Jedes Wort der Suche muss in einem Namen vorkommen. */
export const passtZurSuche = (namen: readonly string[], suche: string) => {
	const woerter = falte(suche).split(/\s+/).filter(Boolean);
	const text = falte(namen.join(' '));
	return woerter.every((w) => text.includes(w));
};
