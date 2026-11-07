import { leseLage } from '@schoolbox/kern/src/gestaltung';

import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import type { LeistenKnoepfe } from './typen';

const gespiegelt = (quelle: string, nr: number) => {
	try {
		return (leseLage(quelle, nr).spiegeln ?? 1) < 0;
	} catch {
		return false;
	}
};

/** Leiste der Figur (102, Briefing 5.7): Spiegeln; Drehen und ⋯ kommen aus dem Rahmen der Leiste. */
export const FIGUR_LEISTE: LeistenKnoepfe | null = ({ aktiv, befehle, k, quelle }) => (
	<Knopf
		art="leise"
		groesse="klein"
		title="Spiegeln (⇧H)"
		aria-pressed={gespiegelt(quelle, k.nr)}
		disabled={!aktiv}
		data-spiegeln
		onClick={() => befehle.fuehreAus('auswahl.spiegeln')}
	>
		<Symbol name="spiegeln" />
		Spiegeln
	</Knopf>
);
