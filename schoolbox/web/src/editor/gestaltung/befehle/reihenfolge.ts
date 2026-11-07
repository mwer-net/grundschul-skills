import type { Richtung } from '@schoolbox/kern/src/gestaltung';
import { ordneInEbene } from '@schoolbox/kern/src/gestaltung';

import type { SymbolName } from '../../../bausteine/Symbol';
import type { Befehl, Kontext, Kuerzel } from '../../befehle';

/**
 * Reihenfolge (100, Briefing 5.6). Ganz nach vorne bzw. hinten wechselt an der Grenze die Ebene; das macht der Kern
 * (`ordneInEbene`, 092). Tasten wie in Keynote (⌥⇧⌘F, ⇧⌘F, ⌥⇧⌘B, ⇧⌘B) statt ⌘] ⌘[: Auf der deutschen Tastatur
 * entstehen `[` und `]` erst mit ⌥, das Register sperrt sie mit ⌘ (069). Die Ids erwartet das ⋯ (`leiste/mehr.ts`).
 */
const EINTRAEGE: { id: string; titel: string; richtung: Richtung; taste: Kuerzel; symbol: SymbolName }[] = [
	{
		id: 'auswahl.nach-vorne',
		titel: 'Nach vorne',
		richtung: 'vor',
		taste: { code: 'KeyF', befehl: true, wahl: true, umschalt: true },
		symbol: 'hoch',
	},
	{
		id: 'auswahl.ganz-vorne',
		titel: 'Ganz nach vorne',
		richtung: 'ganz-vor',
		taste: { code: 'KeyF', befehl: true, umschalt: true },
		symbol: 'hoch',
	},
	{
		id: 'auswahl.nach-hinten',
		titel: 'Nach hinten',
		richtung: 'zurueck',
		taste: { code: 'KeyB', befehl: true, wahl: true, umschalt: true },
		symbol: 'runter',
	},
	{
		id: 'auswahl.ganz-hinten',
		titel: 'Ganz nach hinten',
		richtung: 'ganz-zurueck',
		taste: { code: 'KeyB', befehl: true, umschalt: true },
		symbol: 'runter',
	},
];

/** Ändert sich nichts (schon ganz vorne in „vorne“), steht der Eintrag gesperrt im Menü. */
const bewirktNichts = (k: Kontext, richtung: Richtung) => {
	const g = k.gestaltung;
	if (!g || !k.quelle) {
		return true;
	}
	try {
		return ordneInEbene(k.quelle, g.nr, richtung).quelle === k.quelle;
	} catch {
		return true;
	}
};

export const REIHENFOLGE_BEFEHLE: Befehl[] = EINTRAEGE.map(
	({ id, richtung, symbol, taste, titel }): Befehl => ({
		id,
		titel,
		gruppe: 'ordnen',
		symbol,
		kuerzel: [taste],
		// Ohne Gestaltung bleiben die Tasten beim Browser.
		tasteWenn: (k) => k.gestaltung !== null,
		suchwoerter: ['reihenfolge', 'ebene', 'vordergrund', 'hintergrund', 'überlappen'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && k.gestaltung !== null,
		gesperrt: (k) => bewirktNichts(k, richtung),
		aus: (k) => {
			const g = k.gestaltung;
			if (g) {
				g.fuehreAus(titel, (q) => ordneInEbene(q, g.nr, richtung));
			}
		},
	}),
);
