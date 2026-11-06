import type { ComponentType } from 'react';

import type { Befehle } from '../../useBefehle';
import type { GestaltungKontext } from '../inspektor/kontext-ersatz';

/** Was die Knöpfe einer Art in der Leiste am Element bekommen. `aktiv`: Die Quelle darf gerade geändert werden. */
export interface LeistenTeile {
	k: GestaltungKontext;
	befehle: Befehle;
	quelle: string;
	aktiv: boolean;
}

/** Die Knöpfe einer Art, links vor „Drehen“ und ⋯ (Briefing 5.7). */
export type LeistenKnoepfe = ComponentType<LeistenTeile>;
