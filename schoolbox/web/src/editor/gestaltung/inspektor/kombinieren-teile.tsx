import { useEffect } from 'react';

import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
import { Zeile } from '../../../bausteine/Zeile';
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
 * Kombinieren im Inspektor (121): Zeile „Kombinieren“ mit vier Symbol-Knöpfen rechts wie in Figma, sichtbar ab zwei
 * gewählten Formen; die Namen stehen im Tooltip. Geht es nicht (Form mit Text, andere Ebene), steht der Grund da; ein
 * leeres Ergebnis meldet sich hier.
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
		<div className="flex flex-col gap-1" data-kombinieren>
			<Zeile titel="Kombinieren">
				<span className="flex items-center gap-0.5" role="group" aria-label="Kombinieren">
					{KOMBI_ARTEN.map(({ art, id, symbol, titel }) => (
						<Tooltip key={art} text={grund ?? `${titel}: ${KOMBI_HINWEIS}`}>
							<Knopf
								art="leise"
								groesse="klein"
								aria-label={titel}
								data-befehl={id}
								disabled={!aktiv || grund !== null}
								onClick={() => kombiniereIm(k, art)}
							>
								<Symbol name={symbol} />
							</Knopf>
						</Tooltip>
					))}
				</span>
			</Zeile>
			{(grund ?? meldung) && (
				<p className="text-xs text-leise" role="status" data-kombi-hinweis>
					{grund ?? meldung}
				</p>
			)}
		</div>
	);
};
