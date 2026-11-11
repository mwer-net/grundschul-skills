import type { Schublade } from '.';
import { ABSCHNITTE } from './formen-daten';
import { Inhalt } from './formen-teile';
import { kopf } from './reihe';

/**
 * ⌥3: Werkzeuge zum Zeichnen, Text, Formen, Blasen und Bildrahmen zum Hinlegen (175: vorher „Formen“ und „Text“). Nur
 * wo frei bearbeitet werden darf, wie „Bausteine“.
 */
export const schublade: Schublade = {
	...kopf('werkzeuge'),
	bereit: (k) => k.frei,
	Inhalt,
	suche: (_k, z) => ABSCHNITTE.flatMap((a) => a.suche?.(z) ?? []),
};
