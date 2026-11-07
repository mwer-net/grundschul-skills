import { haengeAn, loeseAnker } from '@schoolbox/kern/src/anker';

import type { Befehl, Kontext } from '../../befehle';
import { nrVon } from '../../darstellung';
import { ankerBausteinVon, ankerName, lageInSeite, messeAnhaengen, naechstesAnkerZiel } from '../anker-lage';

const amAnker = (k: Kontext) => Boolean(k.gestaltung && ankerBausteinVon(k.gestaltung.element));

/**
 * Anhängen und Lösen ohne Griff (106): in der Palette und im ⋯ der Leiste am Element, keine Taste (5.11). Ohne Ziel
 * hängt `auswahl.anhaengen` an den Baustein, der die Mitte des Elements enthält, sonst an den nächsten auf der Seite.
 * Gezielt wählen Griff, Inspektor und Ebenen.
 */
export const ANKER_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.anhaengen',
		titel: 'Anhängen an Baustein',
		gruppe: 'ordnen',
		symbol: 'anker',
		modus: ['auswahl'],
		suchwoerter: ['anker', 'anhängen', 'festmachen', 'mitwandern', 'an aufgabe'],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => {
			const g = k.gestaltung;
			return Boolean(k.aktiv && g && !amAnker(k) && naechstesAnkerZiel(g.element));
		},
		aus: (k) => {
			const g = k.gestaltung;
			const ziel = g ? naechstesAnkerZiel(g.element) : null;
			const nr = ziel ? nrVon(ziel) : null;
			if (!g || !ziel || nr === null) {
				return false;
			}
			const mass = messeAnhaengen(g.element, ziel);
			return g.fuehreAus(`An ${ankerName(ziel)} gehängt`, (q) => haengeAn(q, g.nr, nr, mass));
		},
	},
	{
		id: 'auswahl.loesen',
		titel: 'Vom Baustein lösen',
		gruppe: 'ordnen',
		symbol: 'anker',
		modus: ['auswahl'],
		suchwoerter: ['anker', 'lösen', 'abhängen', 'frei'],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => k.aktiv && amAnker(k),
		aus: (k) => {
			const g = k.gestaltung;
			if (!g) {
				return false;
			}
			const lage = lageInSeite(g.element);
			return g.fuehreAus('Vom Baustein gelöst', (q) => loeseAnker(q, g.nr, { lage }));
		},
	},
];
