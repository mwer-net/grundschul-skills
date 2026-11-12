import type { Schublade } from '.';
import { suche } from './figuren-daten';
import { Inhalt } from './figuren-teile';
import { kopf } from './reihe';

/** ⌥4: Figuren frei hinlegen (102, 177). Nur wo frei bearbeitet werden darf, wie „Bausteine“. */
export const schublade: Schublade = { ...kopf('figuren'), bereit: (k) => k.frei, Inhalt, suche };
