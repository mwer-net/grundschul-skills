import { flaecheHtml, hoeheUm, inNeueFlaeche } from '@schoolbox/kern/src/flaeche';
import type { Ablage } from '@schoolbox/kern/src/struktur';

import type { Befehl } from '../../befehle';
import { nrVon } from '../../darstellung';
import { ordnungFuer } from '../../luecke';
import { platzAn } from '../../ziele';
import { lageInSeite } from '../anker-lage';
import type { GestaltungKontext } from '../kontext';

/** Liegt das Element schon in einer Fläche, bleibt dem Befehl nichts zu tun. */
const inEinerFlaeche = (g: GestaltungKontext) => Boolean(g.element.parentElement?.matches('.flaeche'));

/**
 * Wohin die neue Fläche kommt: an die Stelle des Stapels unter der Mitte des Elements, sonst ans Ende der Seite (vor
 * den Fuß). `null`, wenn die Seite keinen Baustein hat.
 */
const ablageFuer = (g: GestaltungKontext, hoehe: number): Ablage | null => {
	const r = g.element.getBoundingClientRect();
	const ordnung = ordnungFuer(g.doc, flaecheHtml(hoehe));
	const platz = ordnung ? platzAn(ordnung, r.left + r.width / 2, r.top + r.height / 2) : null;
	if (platz?.ablage) {
		return platz.ablage;
	}
	const seite = g.element.closest('.seite');
	const kinder = [...(seite?.children ?? [])].filter((c) => !c.matches('.ebene') && nrVon(c) !== null);
	const letztes = kinder.at(-1);
	const nr = letztes ? nrVon(letztes) : null;
	if (!letztes || nr === null) {
		return null;
	}
	return { nr, wo: letztes.matches('.fuss') && kinder.length > 1 ? 'vor' : 'nach' };
};

/**
 * „In den Stapel“ (115, Briefing 5.3): Das Element zieht in eine neue Fläche im Stapel um, ein Schritt. Die Fläche ist
 * so hoch wie das Element plus Rand und liegt dort, wo seine Mitte im Stapel steht. In der Palette und im ⋯.
 */
export const STAPEL_BEFEHLE: Befehl[] = [
	{
		id: 'auswahl.in-stapel',
		titel: 'In den Stapel',
		gruppe: 'ordnen',
		symbol: 'stapel',
		modus: ['auswahl'],
		suchwoerter: ['stapel', 'fläche', 'einordnen', 'zwischen aufgaben', 'fest'],
		orte: ['palette', 'gestaltung'],
		sichtbarUnter: 'mehr',
		verfuegbar: (k) => Boolean(k.aktiv && k.gestaltung && !inEinerFlaeche(k.gestaltung)),
		aus: (k) => {
			const g = k.gestaltung;
			if (!g || inEinerFlaeche(g)) {
				return false;
			}
			const hoehe = hoeheUm(g.element.getBoundingClientRect().height);
			const ablage = ablageFuer(g, hoehe);
			const seite = g.element.closest('.seite');
			if (!ablage || !seite) {
				return false;
			}
			// Das Element liegt in der Fläche so weit rechts wie auf der Seite; die Fläche beginnt am Seitenrand innen.
			const rand = parseFloat(g.doc.defaultView?.getComputedStyle(seite).paddingLeft ?? '') || 0;
			const x = lageInSeite(g.element).x - rand;
			return g.fuehreAus('In den Stapel gelegt', (q) =>
				inNeueFlaeche(q, g.nr, ablage, { jeSeite: k.format === 'folie' }, { hoehe, x }),
			);
		},
	},
];
