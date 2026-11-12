import { formVon } from '@schoolbox/kern/src/formen';
import { leseForm } from '@schoolbox/kern/src/formen-aendern';

import { Zeile } from '../../../bausteine/Zeile';
import type { InspektorTeile } from './abschnitte';
import { FuellungWahl, KonturWahl } from './form-farben';

/** Abschnitt 6 „Füllung und Kontur“ (5.8), einfarbig (E2). Verlauf und Stil der Kontur: 108. */
export const Fuellung = (t: InspektorTeile) => (
	<div className="flex flex-col gap-1" data-gestaltung-fuellung>
		{/* 107: Die Linie hat keine Füllung, nur Kontur. */}
		{/* 185: „Farbe / Verlauf“ steht neben dem Titel (161). */}
		{formVon(leseForm(t.quelle, t.k.nr)?.art)?.klasse !== 'linie' && <FuellungWahl {...t} titel="Füllung" />}
		<Zeile titel="Kontur" darunter>
			<KonturWahl {...t} />
		</Zeile>
	</div>
);
