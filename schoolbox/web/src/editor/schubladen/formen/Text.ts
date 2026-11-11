import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import { ARTEN, fsVon, gutVon, namenVon, SUCHWOERTER } from './Text-daten';
import { Kacheln } from './Text-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

/** 175: Abschnitt „Text“ der Schublade „Werkzeuge“: Titel, Stempel und Etikett liegen frei wie eine Form. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'text',
	titel: 'Text',
	zeigt: ({ suche }) => ARTEN.some((art) => passtZurSuche(namenVon(art), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		ARTEN.map((art) => ({
			...ablegenEintrag(gutVon(art, fsVon(z.teile.doc)), z, GRUPPE),
			symbol: 'schrift',
			suchwoerter: SUCHWOERTER,
		})),
};
