import { ablegenEintrag } from '../gestaltung/ablegen/ablegen';
import type { Schublade } from '.';
import { kopf } from './reihe';
import { ARTEN, bogenGut, fsVon, gutVon, konturGut } from './text-daten';
import { Inhalt } from './text-teile';

/** ⌥5: Schmuckschrift (liegt frei) und Inhalt (rastet ein), sichtbar getrennt, dazu T. Nur wo frei bearbeitet werden darf. */
export const schublade: Schublade = {
	...kopf('text'),
	bereit: (k) => k.frei,
	Inhalt,
	suche: (_k, z) =>
		[...ARTEN.map((art) => gutVon(art, fsVon(z.teile.doc))), konturGut(fsVon(z.teile.doc)), bogenGut()].map(
			(gut) => ({
				...ablegenEintrag(gut, z, 'Text'),
				symbol: 'schrift' as const,
				suchwoerter: ['Schmuckschrift', 'Schrift', 'Kontur', 'Bogen'],
			}),
		),
};
