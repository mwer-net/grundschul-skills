import { useEffect } from 'react';

import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import {
	KOMBI_ARTEN,
	KOMBI_HINWEIS,
	kombiGrundIm,
	kombiniereIm,
	useKombiMeldung,
	vergissKombiMeldung,
} from '../befehle/kombinieren';
import type { InspektorTeile } from './abschnitte';

/**
 * Kombinieren im Inspektor (121): vier Symbol-Knöpfe in einer Reihe wie in Figma, sichtbar ab zwei gewählten Formen.
 * Geht es nicht (Form mit Text, andere Ebene), steht der Grund da; ein leeres Ergebnis meldet sich hier.
 */
export const Kombinieren = ({ aktiv, k }: InspektorTeile) => {
	const meldung = useKombiMeldung();
	const auswahl = k.nrn.join(',');
	useEffect(() => vergissKombiMeldung, [auswahl]);
	if (k.nrn.length < 2) {
		return null;
	}
	const grund = kombiGrundIm(k);
	return (
		<div className="flex flex-col gap-1.5" data-kombinieren>
			<div className="flex items-center gap-1" role="group" aria-label="Kombinieren">
				{KOMBI_ARTEN.map(({ art, id, symbol, titel }) => (
					<Knopf
						key={art}
						art="leise"
						groesse="klein"
						aria-label={titel}
						title={grund ?? `${titel}: ${KOMBI_HINWEIS}`}
						data-befehl={id}
						disabled={!aktiv || grund !== null}
						onClick={() => kombiniereIm(k, art)}
					>
						<Symbol name={symbol} />
					</Knopf>
				))}
			</div>
			{(grund ?? meldung) && (
				<p className="text-xs text-leise" role="status" data-kombi-hinweis>
					{grund ?? meldung}
				</p>
			)}
		</div>
	);
};
