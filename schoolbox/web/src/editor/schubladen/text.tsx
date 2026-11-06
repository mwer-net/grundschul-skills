import type { Schublade } from '.';
import { kopf } from './reihe';

/** Platzhalter: Die Taste ist reserviert, die Schublade erscheint nirgends. Füllt 105. */
export const schublade: Schublade = { ...kopf('text'), bereit: () => false, Inhalt: () => null };
