import { haengeAn, loeseAnker } from '@schoolbox/kern/src/anker';
import { createElement } from 'react';

import { Symbol } from '../../../bausteine/Symbol';
import { nrVon } from '../../darstellung';
import {
	ankerBausteinVon,
	ankerName,
	ankerZielUnter,
	aufEigenerSeite,
	lageInSeite,
	messeAnhaengen,
} from '../anker-lage';
import type { GestaltungKontext } from '../kontext';
import type { GriffZug, ZusatzAnzeige, ZusatzGriff } from './typ';

/**
 * ⚓ sitzt links neben der oberen Ecke des Auswahlrahmens, in px des Materials (vor dem Drehen). Nicht darüber: Dort
 * liegen Drehgriff und die Leiste am Element (099).
 */
const ABSTAND = 18;
const UNTER_DER_KANTE = 8;

type Wirkung = { art: 'anhaengen'; ziel: Element; nr: number } | { art: 'loesen' } | null;

/**
 * Was Loslassen an dieser Stelle täte (106): Auf einem ankerbaren Baustein derselben Seite hängt es an. Auf freier
 * Fläche der eigenen Seite löst es ein Element am Anker. Auf dem eigenen Baustein oder außerhalb der Seite: nichts.
 */
const wirkung = (g: GestaltungKontext, zug: GriffZug): Wirkung => {
	const { x, y } = zug.zeiger;
	const eigener = ankerBausteinVon(g.element);
	const ziel = ankerZielUnter(g.element, x, y);
	const nr = ziel ? nrVon(ziel) : null;
	if (ziel && nr !== null) {
		return ziel === eigener ? null : { art: 'anhaengen', ziel, nr };
	}
	return eigener && aufEigenerSeite(g.element, x, y) ? { art: 'loesen' } : null;
};

const anzeige = (w: Wirkung, amAnker: boolean): ZusatzAnzeige => {
	if (w?.art === 'anhaengen') {
		return { text: `hängt an ${ankerName(w.ziel)}`, ziel: w.ziel, linie: true };
	}
	if (w?.art === 'loesen') {
		return { text: 'vom Baustein lösen', ziel: null, linie: true };
	}
	return { text: amAnker ? 'hängt weiter am Baustein' : 'auf einen Baustein ziehen', ziel: null, linie: true };
};

/**
 * ⚓ links oben neben dem Auswahlrahmen (106, Briefing 5.4 „Anker“): auf einen Baustein ziehen hängt an, vom Baustein
 * weg auf die Seite ziehen löst. Je ein Schritt; Esc bricht ab (`useGeste`). Gesperrtes zeigt keine Griffe.
 */
export const ANKER_GRIFFE: ZusatzGriff[] = [
	{
		id: 'anker',
		name: 'Anker: auf einen Baustein ziehen',
		fuer: (_art, element) => !element.hasAttribute('data-gesperrt'),
		wo: () => ({ x: -ABSTAND, y: UNTER_DER_KANTE }),
		zeichne: () =>
			createElement(
				'span',
				{
					className:
						'flex size-5 flex-none items-center justify-center rounded-full border border-brand-500 bg-flaeche text-brand-600 shadow',
					'data-anker-griff': '',
				},
				createElement(Symbol, { name: 'anker', className: 'size-3 flex-none' }),
			),
		zeiger: 'cursor-grab',
		zeige: (g, zug) => anzeige(wirkung(g, zug), ankerBausteinVon(g.element) !== null),
		schreibe: (g, zug) => {
			const w = wirkung(g, zug);
			if (w?.art === 'anhaengen') {
				const mass = messeAnhaengen(g.element, w.ziel);
				g.fuehreAus(`An ${ankerName(w.ziel)} gehängt`, (q) => haengeAn(q, g.nr, w.nr, mass));
			} else if (w?.art === 'loesen') {
				const lage = lageInSeite(g.element);
				g.fuehreAus('Vom Baustein gelöst', (q) => loeseAnker(q, g.nr, { lage }));
			}
		},
	},
];
