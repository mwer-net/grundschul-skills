import { leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';

import type { Befehl, Kontext } from '../../befehle';

/** Nur Bild und Figur lassen sich spiegeln (Briefing 5.6); Bilder im Stapel sind kein Gestaltungselement. */
const SPIEGELBAR = new Set(['figurfrei', 'bildfrei']);

const verfuegbar = (k: Kontext) => k.aktiv && Boolean(k.gestaltung && SPIEGELBAR.has(k.gestaltung.art));

/** Ein Buchstabe ohne ⌘: nie beim Tippen (wie die Werkzeug-Tasten, 098). */
const tippfrei = (k: Kontext) => !k.textsitzung && !k.feldBehaeltUndo();

/**
 * Spiegeln (102): setzt `--spiegeln: -1` bzw. entfernt es, ein Schritt. `transform` schreibt nur die gemeinsame Regel
 * aus `blatt.css` (091), darum hier nur die Variable.
 */
export const SPIEGELN_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.spiegeln',
		titel: 'Spiegeln',
		gruppe: 'ordnen',
		symbol: 'spiegeln',
		kuerzel: [{ code: 'KeyH', umschalt: true, befehl: false, wenn: tippfrei }],
		modus: ['auswahl'],
		tasteWenn: verfuegbar,
		suchwoerter: ['spiegeln', 'umdrehen', 'blickrichtung', 'links', 'rechts', 'waagerecht'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		verfuegbar,
		aus: (k) => {
			const g = k.gestaltung;
			return g?.fuehreAus('Gespiegelt', (q) => {
				const gespiegelt = (leseLage(q, g.nr).spiegeln ?? 1) < 0;
				return { quelle: setzeLage(q, g.nr, { spiegeln: gespiegelt ? null : -1 }), nr: g.nr };
			});
		},
	},
];
