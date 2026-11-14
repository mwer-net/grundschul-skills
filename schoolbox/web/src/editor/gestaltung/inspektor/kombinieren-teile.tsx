import { useEffect } from 'react';

import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { Tooltip } from '../../../bausteine/Tooltip';
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
 * Abschnitt „Kombinieren“ (121, 198-16): Knöpfe mit Symbol und Wort, zwei je Zeile, sichtbar ab zwei gewählten Formen.
 * Der Tooltip sagt, was aus den Formen wird. Geht es nicht (Form mit Text, andere Ebene), steht der Grund da; ein leeres
 * Ergebnis meldet sich hier.
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
			<div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Kombinieren">
				{KOMBI_ARTEN.map(({ art, id, symbol, titel }) => (
					<Tooltip key={art} text={grund ?? KOMBI_HINWEIS}>
						<Knopf
							art="zweit"
							groesse="klein"
							className="w-full justify-start"
							data-befehl={id}
							disabled={!aktiv || grund !== null}
							onClick={() => kombiniereIm(k, art)}
						>
							<Symbol name={symbol} />
							{titel}
						</Knopf>
					</Tooltip>
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
