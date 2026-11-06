/**
 * Andockstelle der Leiste am Element (099): je Art die Knöpfe vor „Drehen“ und ⋯. Jedes Ticket füllt nur seine
 * eigene Datei; die Liste hier bleibt. Schlüssel ist die Art aus `gestaltung-arten.ts`, `mehrfach` die
 * Mehrfachauswahl (113).
 */

import { BILD_LEISTE } from './bild';
import { FIGUR_LEISTE } from './figur';
import { FORM_LEISTE } from './form';
import { FORMTEXT_LEISTE } from './formtext';
import { GRUPPE_LEISTE } from './gruppe';
import { MEHRFACH_LEISTE } from './mehrfach';
import { SCHMUCK_LEISTE } from './schmuck';
import { SCHMUCKBOGEN_LEISTE } from './schmuckbogen';
import { STAPEL_LEISTE } from './stapel';
import { STREUUNG_LEISTE } from './streuung';
import type { LeistenKnoepfe } from './typen';

export type { LeistenKnoepfe, LeistenTeile } from './typen';

export const LEISTEN: Readonly<Record<string, LeistenKnoepfe | null>> = {
	figurfrei: FIGUR_LEISTE, // 102
	bildfrei: BILD_LEISTE, // 103
	form: FORM_LEISTE, // 104
	formtext: FORMTEXT_LEISTE, // 107
	schmuck: SCHMUCK_LEISTE, // 105
	schmuckbogen: SCHMUCKBOGEN_LEISTE, // 110
	streuung: STREUUNG_LEISTE, // 109
	mehrfach: MEHRFACH_LEISTE, // 113
	gruppe: GRUPPE_LEISTE, // 120
	stapel: STAPEL_LEISTE, // 125
};
