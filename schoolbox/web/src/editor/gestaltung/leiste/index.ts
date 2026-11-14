/**
 * Andockstelle der Leiste am Element (099): je Art, was zwischen „Claude“ und „Duplizieren“ steht. Nach 204-12 sind
 * das nur Dinge, die nicht im Inspektor stehen: das Feld „Text im Bogen“, „Gruppe auflösen“ und bei Mehrfachauswahl
 * „Gruppieren“ und „Ausrichten“. Schlüssel ist die Art aus `gestaltung-arten.ts`, `mehrfach` die Mehrfachauswahl (113).
 */

import { GRUPPE_LEISTE } from './gruppe';
import { MEHRFACH_LEISTE } from './mehrfach';
import { SCHMUCKBOGEN_LEISTE } from './schmuckbogen';
import type { LeistenKnoepfe } from './typen';

export type { LeistenKnoepfe, LeistenTeile } from './typen';

export const LEISTEN: Readonly<Record<string, LeistenKnoepfe | null>> = {
	schmuckbogen: SCHMUCKBOGEN_LEISTE, // 110
	mehrfach: MEHRFACH_LEISTE, // 113
	gruppe: GRUPPE_LEISTE, // 120
};
