import type { SchubladenLage } from '../../schubladen';
import { passtZurSuche } from '../../schubladen/formen/typ';
import type { Werkzeug } from '.';
import { WERKZEUGE } from '.';

/** Die Namen, unter denen die Suche der Schublade ein Werkzeug findet. */
export const namenVon = (w: Werkzeug) => [w.titel, ...(w.suchwoerter ?? [])];

/** 198-10: Werkzeuge mit eigener Kachel im Abschnitt „Zeichnen“, in dieser Lage und zu dieser Suche. */
export const zeichenwerkzeuge = (lage: SchubladenLage, suche = '') =>
	WERKZEUGE.filter((w) => w.kachel && w.bereit(lage) && passtZurSuche(namenVon(w), suche));
