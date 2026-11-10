import type { Schublade } from '.';
import { Inhalt } from './ebenen-teile';
import { kopf } from './reihe';

/** ⌥1: der Baum der Seiten, bis 093 „Gliederung“; seit 101 mit Gestaltung, Auge und Schloss. */
export const schublade: Schublade = { ...kopf('ebenen'), bereit: () => true, Inhalt };
