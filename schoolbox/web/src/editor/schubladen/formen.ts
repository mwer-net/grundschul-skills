import type { Schublade } from '.';
import { ABSCHNITTE } from './formen-daten';
import { Inhalt } from './formen-teile';
import { kopf } from './reihe';

/** ⌥3: Formen zum Hinlegen und die Werkzeuge zum Zeichnen. Nur wo frei bearbeitet werden darf, wie „Bausteine“. */
export const schublade: Schublade = {
	...kopf('formen'),
	bereit: (k) => k.frei,
	Inhalt,
	suche: (_k, z) => ABSCHNITTE.flatMap((a) => a.suche?.(z) ?? []),
};
