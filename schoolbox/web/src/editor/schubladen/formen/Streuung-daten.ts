import type { Ecke, StreuArt } from '@schoolbox/kern/src/streuen';
import { naechsteEcke, saatAus, STANDARD_MASS, STREU_NAMEN, streuungHtml } from '@schoolbox/kern/src/streuen';

import { nrVon } from '../../darstellung';
import { seitenIn } from '../../gestaltung/ablegen/vorschau';
import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import { waehleStreuArt } from '../../gestaltung/streuung-stand';

/** Weitere Wörter für Suchfeld und ⌘K; „Streuung“ trifft alle drei. */
export const NAMEN: Readonly<Record<StreuArt, readonly string[]>> = {
	punkte: ['Punkte', 'Streuung', 'Muster', 'Raster'],
	konfetti: ['Konfetti', 'Streuung', 'Feier'],
	sterne: ['Sterne', 'Streuung', 'Stern'],
};

export const SUCHE = ['Streuen', ...Object.values(NAMEN).flat()];

export const gutVon = (art: StreuArt, doc: Document | null): GestaltungsGut => {
	const html = (ecke?: Ecke) => streuungHtml({ art, saat: SAATEN[art], ...STANDARD_MASS, ...(ecke ? { ecke } : {}) });
	return gestaltungsgut({
		name: STREU_NAMEN[art],
		html: html(),
		groesse: { b: STANDARD_MASS.b, h: STANDARD_MASS.h },
		// Die Saat gilt erst beim Ablegen (sie wechselt danach); Punkte werden zur nächsten Blattecke dichter, und die steht
		// erst fest, wenn der Ort feststeht.
		anpassen: (_html, ort) => html(art === 'punkte' ? eckeAn(doc, ort) : undefined),
		vorDemAblegen: () => {
			waehleStreuArt(art);
			// Der Schritt läuft gleich danach mit der alten Saat; erst dann kommt die neue.
			window.setTimeout(() => {
				SAATEN[art] = saatAus(Date.now());
			}, 0);
		},
	});
};

/**
 * Die Saat, mit der die nächste Streuung dieser Art abgelegt wird. Vorschau am Zeiger und Ablegen nehmen dieselbe,
 * sonst springt das Bild beim Loslassen. Nach dem Ablegen kommt eine neue, damit zwei Streuungen nie gleich aussehen.
 */
export const SAATEN: Record<StreuArt, number> = {
	punkte: saatAus(Date.now()),
	konfetti: saatAus(Date.now() + 1),
	sterne: saatAus(Date.now() + 2),
};

/** Die Seite der Nummer `nr` im Material: wohin die Punkte dichter werden, hängt an ihrer Größe. */
export const eckeAn = (doc: Document | null, ort: { seite: number; x: number; y: number }): Ecke | undefined => {
	const seite = doc ? seitenIn(doc).find((s) => nrVon(s) === ort.seite) : undefined;
	return seite instanceof HTMLElement
		? naechsteEcke({ ...ort, ...STANDARD_MASS }, { b: seite.offsetWidth, h: seite.offsetHeight })
		: undefined;
};
