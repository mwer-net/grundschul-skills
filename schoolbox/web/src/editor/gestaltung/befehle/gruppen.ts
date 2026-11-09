import { gruppiere, loeseGruppe } from '@schoolbox/kern/src/gruppen';

import type { Befehl, Kontext } from '../../befehle';
import { gleicherElternteil, groessenDerKinder, masseZu } from '../gruppe-messen';
import { leereMehrfach, setzeMehrfach } from '../mehrfach';

/** Mindestens zwei Gestaltungselemente gewählt. */
const mehrere = (k: Kontext) => k.aktiv && (k.gestaltung?.nrn.length ?? 0) > 1;

/** Gruppieren geht nur mit demselben Elternteil (Ebene, Fläche, Baustein am Anker). */
const gleich = (k: Kontext) => Boolean(k.gestaltung && gleicherElternteil(k.gestaltung.doc, k.gestaltung.nrn));

const istGruppe = (k: Kontext) => k.aktiv && k.gestaltung?.art === 'gruppe' && k.gestaltung.nrn.length === 1;

/**
 * Gruppen (120, Briefing 5.11): ⌘G gruppiert, ⇧⌘G löst. Beide Tasten nur bei passender Gestaltung in der Auswahl;
 * sonst bleibt ⌘G beim Browser („Weitersuchen“), ohne `preventDefault`.
 */
export const GRUPPEN_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.gruppieren',
		titel: (k) => (mehrere(k) && !gleich(k) ? 'Gruppieren (nur Elemente derselben Ebene)' : 'Gruppieren'),
		gruppe: 'ordnen',
		symbol: 'gruppe',
		kuerzel: [{ code: 'KeyG', befehl: true }],
		modus: ['auswahl'],
		tasteWenn: (k) => mehrere(k) && gleich(k),
		suchwoerter: ['gruppieren', 'gruppe', 'zusammenfassen', 'verbinden', 'zusammen'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		verfuegbar: mehrere,
		gesperrt: (k) => !gleich(k),
		aus: (k) => {
			const g = k.gestaltung;
			if (!g || !gleich(k)) {
				return false;
			}
			const masse = masseZu(g.doc, g.nrn);
			const geklappt = g.fuehreAus('Gruppiert', (q) => gruppiere(q, g.nrn, masse));
			if (geklappt) {
				leereMehrfach();
			}
			return geklappt;
		},
	},
	{
		id: 'auswahl.gruppe-aufloesen',
		titel: 'Gruppe auflösen',
		gruppe: 'ordnen',
		symbol: 'aufloesen',
		kuerzel: [{ code: 'KeyG', befehl: true, umschalt: true }],
		modus: ['auswahl'],
		tasteWenn: istGruppe,
		suchwoerter: ['gruppe', 'auflösen', 'trennen', 'lösen', 'aufheben'],
		orte: ['taste', 'palette', 'gestaltung'],
		sichtbarUnter: 'leiste',
		verfuegbar: istGruppe,
		aus: (k) => {
			const g = k.gestaltung;
			if (!g) {
				return false;
			}
			const groessen = groessenDerKinder(g.element);
			let kinder: number[] = [];
			const geklappt = g.fuehreAus('Gruppe aufgelöst', (q) => {
				const r = loeseGruppe(q, g.nr, groessen);
				kinder = r.kinder;
				return r;
			});
			const [haupt, ...dazu] = kinder;
			if (geklappt && haupt !== undefined) {
				setzeMehrfach(haupt, dazu); // 113: Danach sind alle Kinder gewählt.
			}
			return geklappt;
		},
	},
];
