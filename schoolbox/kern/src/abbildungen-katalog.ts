import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ElementBeschreibung } from './einheit-bau';
import { ABBILDUNGEN_DATEIEN, beschreibungenAus } from './einheit-bau';
import { WURZEL } from './konfig';

/** Die Überschriften aller Dateien des Katalogs der Abbildungen (226), für den Index in `quellen.ts` und für `bauen`. */
export const leseAbbildungsKatalog = (skills = path.join(WURZEL, 'skills')): ElementBeschreibung[] =>
	ABBILDUNGEN_DATEIEN.flatMap((d) => beschreibungenAus(d, readFileSync(path.join(skills, d), 'utf8')));
