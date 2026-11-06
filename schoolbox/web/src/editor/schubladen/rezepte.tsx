import type { Schublade } from '.';
import { kopf } from './reihe';

/** Platzhalter: Die Taste ist reserviert, die Schublade erscheint nirgends. Füllt 119. */
export const schublade: Schublade = { ...kopf('rezepte'), bereit: () => false, Inhalt: () => null };
