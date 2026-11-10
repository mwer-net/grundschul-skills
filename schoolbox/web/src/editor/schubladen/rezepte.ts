import type { Schublade } from '.';
import { kopf } from './reihe';
import { Inhalt } from './rezepte-teile';

/** Rezepte (119, 7-rezepte.md): Kacheln mit dem offenen Material, Regler, Würfeln, Freilegen, Entfernen. */
export const schublade: Schublade = { ...kopf('rezepte'), bereit: (k) => k.frei, Inhalt };
