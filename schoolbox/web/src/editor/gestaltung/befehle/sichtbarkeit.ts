import { setzeAus, setzeGesperrt } from '@schoolbox/kern/src/gestaltung';

import type { Befehl, Kontext } from '../../befehle';

const gesetzt = (k: Kontext, attribut: string) => Boolean(k.gestaltung?.element.hasAttribute(attribut));

const verfuegbar = (k: Kontext) => k.aktiv && k.gestaltung !== null;

/**
 * Sperren und Ausblenden (101). Briefing 5.6 sieht ⇧⌘L und ⇧⌘H vor; ⌘ mit L und H behält Safari für sich (Seitenleiste,
 * Startseite; Sperrliste aus 069 in `befehle.test.ts`). Darum ⇧⌥L und ⇧⌥H, `code`-basiert wie die anderen ⌥-Tasten.
 * Die Zeichen in den Ebenen tun dasselbe (`ebenen-zeichen/sichtbarkeit.ts`).
 */
export const SICHTBARKEIT_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.sperren',
		titel: (k) => (gesetzt(k, 'data-gesperrt') ? 'Entsperren' : 'Sperren'),
		gruppe: 'ordnen',
		symbol: (k) => (gesetzt(k, 'data-gesperrt') ? 'entsperrt' : 'schloss'),
		kuerzel: [{ code: 'KeyL', wahl: true, umschalt: true }],
		modus: ['auswahl'],
		tasteWenn: verfuegbar,
		suchwoerter: ['sperren', 'entsperren', 'schloss', 'festhalten', 'gesperrt'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar,
		aus: (k) => {
			const g = k.gestaltung;
			const an = gesetzt(k, 'data-gesperrt');
			return g?.fuehreAus(an ? 'Entsperrt' : 'Gesperrt', (q) => ({ quelle: setzeGesperrt(q, g.nr, !an), nr: g.nr }));
		},
	},
	{
		id: 'auswahl.ausblenden',
		titel: (k) => (gesetzt(k, 'data-aus') ? 'Einblenden' : 'Ausblenden'),
		gruppe: 'ordnen',
		symbol: (k) => (gesetzt(k, 'data-aus') ? 'auge' : 'ausgeblendet'),
		kuerzel: [{ code: 'KeyH', wahl: true, umschalt: true }],
		modus: ['auswahl'],
		tasteWenn: verfuegbar,
		suchwoerter: ['ausblenden', 'einblenden', 'verstecken', 'auge', 'unsichtbar', 'nicht drucken'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar,
		aus: (k) => {
			const g = k.gestaltung;
			const an = gesetzt(k, 'data-aus');
			return g?.fuehreAus(an ? 'Eingeblendet' : 'Ausgeblendet', (q) => ({ quelle: setzeAus(q, g.nr, !an), nr: g.nr }));
		},
	},
];
