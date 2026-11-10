import { STREU_ARTEN } from '@schoolbox/kern/src/streuen';

import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import { gutVon, NAMEN, SUCHE } from './Streuung-daten';
import { Kacheln } from './Streuung-teile';
import type { FormenAbschnitt } from './typ';
import { passtZurSuche } from './typ';

export const abschnitt: FormenAbschnitt | null = {
	id: 'streuung',
	titel: 'Konfetti und Muster',
	hinweis: 'Klick oder ziehen',
	zeigt: ({ suche }) => passtZurSuche(SUCHE, suche),
	Inhalt: Kacheln,
	suche: (z) =>
		STREU_ARTEN.map((art) => ({
			...ablegenEintrag(gutVon(art, z.teile.doc), z, 'Formen'),
			symbol: 'streuung',
			suchwoerter: NAMEN[art].slice(1),
		})),
};
