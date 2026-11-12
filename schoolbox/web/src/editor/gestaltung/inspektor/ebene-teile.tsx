import { wechsleEbene } from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import { leseUeberlagertOk, setzeUeberlagertOk } from '@schoolbox/kern/src/gestaltung-inspektor';

import { Schalter } from '../../../bausteine/Schalter';
import { Segment } from '../../../bausteine/Segment';
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

export const Ebene = ({ aktiv, k, quelle }: InspektorTeile) => {
	const ebene = ebeneVon(k.element);
	const ok = leseUeberlagertOk(quelle, k.nr);
	return (
		<div className="flex flex-col gap-1" data-gestaltung-ebene={ebene ?? 'anker'}>
			{/* 106: Am Anker gibt es kein „hinten“ (3.5), also keine Wahl. */}
			{ebene && (
				<Segment
					beschriftung="Ebene"
					className="self-start"
					werte={EBENEN}
					wert={ebene}
					aus={!aktiv}
					waehle={(neu) => {
						k.fuehreAus(neu === 'hinten' ? 'In die hintere Ebene' : 'In die vordere Ebene', (q) =>
							wechsleEbene(q, k.nr, neu),
						);
					}}
				/>
			)}
			<div className="flex h-zeile items-center justify-between gap-2">
				<span className="text-leise">Darf Inhalt überdecken</span>
				<Schalter
					name="Darf Inhalt überdecken"
					an={ok}
					aus={!aktiv}
					setze={(an) => {
						k.fuehreAus(an ? 'Überdecken erlaubt' : 'Überdecken nicht erlaubt', (q) => ({
							quelle: setzeUeberlagertOk(q, k.nr, an),
							nr: k.nr,
						}));
					}}
				/>
			</div>
		</div>
	);
};
