import { formVon } from '@schoolbox/kern/src/formen';
import { leseForm } from '@schoolbox/kern/src/formen-aendern';

import { FarbZeile } from '../blatt/flaeche';
import type { InspektorTeil, InspektorTeile } from './abschnitte';
import { FuellungWahl, KonturWahl } from './form-farben';

/** Abschnitt 4 „Füllung und Kontur“ (5.8), einfarbig (E2). Verlauf, Kontur-Stile, Schatten und Deckkraft: 108. */
const Fuellung = (t: InspektorTeile) => (
	<div className="flex flex-col gap-1" data-gestaltung-fuellung>
		{/* 107: Die Linie hat keine Füllung, nur Kontur. */}
		{formVon(leseForm(t.quelle, t.k.nr)?.art)?.klasse !== 'linie' && (
			<FarbZeile titel="Füllung">
				<FuellungWahl {...t} />
			</FarbZeile>
		)}
		<FarbZeile titel="Kontur">
			<KonturWahl {...t} />
		</FarbZeile>
	</div>
);

export const FUELLUNG_TEILE: InspektorTeil[] = [
	// 107: auch Form mit Text
	{ id: 'fuellung', abschnitt: 4, reihenfolge: 1, fuer: (art) => art === 'form' || art === 'formtext', Inhalt: Fuellung },
];
