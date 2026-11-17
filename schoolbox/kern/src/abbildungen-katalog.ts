import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ElementBeschreibung } from './einheit-bau';
import { ABBILDUNGEN_DATEIEN, beschreibungenAus, fehlendeAbbildungsTeile } from './einheit-bau';
import { WURZEL } from './konfig';

/** Die Überschriften aller Dateien des Katalogs der Abbildungen (226), für den Index in `quellen.ts` und für `bauen`. */
export const leseAbbildungsKatalog = (skills = path.join(WURZEL, 'skills')): ElementBeschreibung[] =>
	ABBILDUNGEN_DATEIEN.flatMap((d) => beschreibungenAus(d, readFileSync(path.join(skills, d), 'utf8')));

/** `fehlendeAbbildungsTeile` mit dem Katalog, wie er jetzt im Ordner der Skills steht. */
export const abbildungenFehlen = (html: string, gelesen: ReadonlySet<string>, skills?: string) =>
	fehlendeAbbildungsTeile(html, gelesen, leseAbbildungsKatalog(skills));
