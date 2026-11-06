/**
 * Befehle für Gestaltungselemente (Andockstelle aus 097). Jede Datei gehört einem Ticket und exportiert eine Liste;
 * `befehle.ts` hängt `GESTALTUNG_BEFEHLE` an `BEFEHLE` an. Die Dateien importieren aus `befehle.ts` nur Typen, sonst
 * entsteht beim Laden ein Kreis. Befehle rufen den Kern selbst über `k.gestaltung` (`GestaltungKontext`).
 */
import type { Befehl } from '../../befehle';
import { ANKER_BEFEHLE } from './anker';
import { AUSRICHTEN_BEFEHLE } from './ausrichten';
import { BEWEGEN_BEFEHLE } from './bewegen';
import { BILD_BEFEHLE } from './bild';
import { DURCHBLICK_BEFEHLE } from './durchblick';
import { GRUPPEN_BEFEHLE } from './gruppen';
import { KOMBINIEREN_BEFEHLE } from './kombinieren';
import { PFEIL_BEFEHLE } from './pfeile';
import { REIHENFOLGE_BEFEHLE } from './reihenfolge';
import { REZEPT_BEFEHLE } from './rezept';
import { SICHTBARKEIT_BEFEHLE } from './sichtbarkeit';
import { SPIEGELN_BEFEHLE } from './spiegeln';
import { STAPEL_BEFEHLE } from './stapel';

export const GESTALTUNG_BEFEHLE: Befehl[] = [
	...BEWEGEN_BEFEHLE,
	...REIHENFOLGE_BEFEHLE,
	...PFEIL_BEFEHLE,
	...DURCHBLICK_BEFEHLE,
	...SICHTBARKEIT_BEFEHLE,
	...SPIEGELN_BEFEHLE,
	...BILD_BEFEHLE,
	...ANKER_BEFEHLE,
	...AUSRICHTEN_BEFEHLE,
	...STAPEL_BEFEHLE,
	...GRUPPEN_BEFEHLE,
	...KOMBINIEREN_BEFEHLE,
	...REZEPT_BEFEHLE,
];
