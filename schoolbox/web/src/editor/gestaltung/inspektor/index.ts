/**
 * Andockstelle des Gestaltungs-Inspektors (099): Jedes Ticket füllt nur seine eigene Datei, die Liste hier bleibt.
 * Reihenfolge und Titel der Abschnitte stehen in `abschnitte.ts` (Briefing 5.8, Entscheidung 31).
 */

import type { InspektorTeil } from './abschnitte';
import { ANKER_TEILE } from './anker';
import { AUSSEHEN_TEILE } from './aussehen';
import { BILD_TEILE } from './bild';
import { DRUCK_TEILE } from './druck';
import { EBENE_TEILE } from './ebene';
import { FIGUR_TEILE } from './figur';
import { FORM_TEILE } from './form';
import { FUELLUNG_TEILE } from './fuellung';
import { KOMBINIEREN_TEILE } from './kombinieren';
import { KONTUR_BOGEN_TEILE } from './kontur-bogen';
import { POSITION_TEILE } from './position';
import { RAHMENSTIL_TEILE } from './rahmenstil';
import { STREUUNG_TEILE } from './streuung';
import { TEXT_TEILE } from './text';

export type { AbschnittNr, Gruppe, InspektorTeil, InspektorTeile } from './abschnitte';
export { ABSCHNITTE, gruppiere, gruppiereMehrfach } from './abschnitte';
/** 113: Teile nur für die Mehrfachauswahl; nicht in `INSPEKTOR_TEILE`, sonst erschienen sie auch einzeln. */
export { MEHRFACH_TEILE } from './mehrfach';

export const INSPEKTOR_TEILE: readonly InspektorTeil[] = [
	...POSITION_TEILE, // 099
	...FORM_TEILE, // 104
	...FUELLUNG_TEILE, // 104
	...AUSSEHEN_TEILE, // 108
	...TEXT_TEILE, // 105
	...KONTUR_BOGEN_TEILE, // 110
	...BILD_TEILE, // 103
	...FIGUR_TEILE, // 102
	...RAHMENSTIL_TEILE, // 111
	...STREUUNG_TEILE, // 109
	...EBENE_TEILE, // 099
	...ANKER_TEILE, // 106
	...DRUCK_TEILE, // 099
	...KOMBINIEREN_TEILE, // 121
];
