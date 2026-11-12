import { wechsleEbene } from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import { leseUeberlagertOk, setzeUeberlagertOk } from '@schoolbox/kern/src/gestaltung-inspektor';

import { Schalter } from '../../../bausteine/Schalter';
import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import type { InspektorTeile } from './abschnitte';

const EBENEN: { wert: EbenenName; titel: string }[] = [
	{ wert: 'vorne', titel: 'Vorne' },
	{ wert: 'hinten', titel: 'Hinten' },
];

/** In welcher Ebene das Element liegt; `null` am Anker. Nur beide Klassen zusammen: `vorne` allein gibt es auch im Bestand. */
const ebeneVon = (element: Element): EbenenName | null => {
	const eltern = element.parentElement;
	if (!eltern?.classList.contains('ebene')) {
		return null;
	}
	if (eltern.classList.contains('hinten')) {
		return 'hinten';
	}
	return eltern.classList.contains('vorne') ? 'vorne' : null;
};

/** Zeile „Ebene“; am Anker gibt es kein „hinten“ (3.5), also keine Zeile (106, 182). */
export const Ebene = ({ aktiv, k }: InspektorTeile) => {
	const ebene = ebeneVon(k.element);
	if (!ebene) {
		return null;
	}
	return (
		<div data-gestaltung-ebene={ebene}>
			<Zeile titel="Ebene">
				<Segment
					beschriftung="Ebene"
					werte={EBENEN}
					wert={ebene}
					aus={!aktiv}
					waehle={(neu) => {
						k.fuehreAus(neu === 'hinten' ? 'In die hintere Ebene' : 'In die vordere Ebene', (q) =>
							wechsleEbene(q, k.nr, neu),
						);
					}}
				/>
			</Zeile>
		</div>
	);
};

export const Ueberdecken = ({ aktiv, k, quelle }: InspektorTeile) => (
	<div data-gestaltung-ueberdecken>
		<Zeile titel="Darf Inhalt überdecken">
			<Schalter
				name="Darf Inhalt überdecken"
				an={leseUeberlagertOk(quelle, k.nr)}
				aus={!aktiv}
				setze={(an) => {
					k.fuehreAus(an ? 'Überdecken erlaubt' : 'Überdecken nicht erlaubt', (q) => ({
						quelle: setzeUeberlagertOk(q, k.nr, an),
						nr: k.nr,
					}));
				}}
			/>
		</Zeile>
	</div>
);
