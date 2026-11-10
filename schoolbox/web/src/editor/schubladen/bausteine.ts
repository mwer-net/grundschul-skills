import type { Schublade } from '.';
import { Inhalt } from './bausteine-teile';
import { kopf } from './reihe';

/** ⌥2: der Katalog wie bisher. Nur wo frei bearbeitet werden darf. */
export const schublade: Schublade = { ...kopf('bausteine'), bereit: (k) => k.frei, Inhalt };
