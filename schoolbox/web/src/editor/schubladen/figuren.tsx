import type { Schublade } from '.';
import { kopf } from './reihe';

/** Platzhalter: Die Taste ist reserviert, die Schublade erscheint nirgends. Füllt 102. */
export const schublade: Schublade = { ...kopf('figuren'), bereit: () => false, Inhalt: () => null };
