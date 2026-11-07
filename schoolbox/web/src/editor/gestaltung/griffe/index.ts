import { ANKER_GRIFFE } from './anker';
import { HOEHE_GRIFFE } from './hoehe';
import { LINIE_GRIFFE } from './linie';
import { PFAD_GRIFFE } from './pfad';
import type { ZusatzGriff } from './typ';
import { ZIPFEL_GRIFFE } from './zipfel';

export type { GriffZug, ZusatzAnzeige, ZusatzGriff } from './typ';

/** Alle Zusatzgriffe. Ein Ticket füllt nur seine Datei, diese Liste bleibt. */
export const ZUSATZ_GRIFFE: readonly ZusatzGriff[] = [
	...ZIPFEL_GRIFFE,
	...LINIE_GRIFFE,
	...ANKER_GRIFFE,
	...HOEHE_GRIFFE,
	...PFAD_GRIFFE,
];
