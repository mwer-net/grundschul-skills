import type { Schublade } from '.';
import { kopf } from './reihe';

/** Platzhalter: Die Taste ist reserviert, die Schublade erscheint nirgends. Füllt 104. */
export const schublade: Schublade = { ...kopf('formen'), bereit: () => false, Inhalt: () => null };
