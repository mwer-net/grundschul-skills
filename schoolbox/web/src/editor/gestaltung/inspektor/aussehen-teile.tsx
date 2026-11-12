import type { KonturEnden, KonturStil, Schatten } from '@schoolbox/kern/src/aussehen';
import {
	kannAussehen,
	leseDeckkraft,
	leseKonturStil,
	leseSchatten,
	setzeDeckkraft,
	setzeKonturStil,
	setzeSchatten,
} from '@schoolbox/kern/src/aussehen';
import { formVon } from '@schoolbox/kern/src/formen';
import { leseForm } from '@schoolbox/kern/src/formen-aendern';

import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import { Regler } from '../blatt/regler';
import type { InspektorTeile } from './abschnitte';

/**
 * Aussehen (108): Stil und Enden der Kontur unter „Füllung und Kontur“, Schatten und Deckkraft unter „Aussehen“ (185).
 * Den Verlauf zeigt der Farbwähler der Füllung (`form-farben.tsx`). Was eine Art kann, sagt `kannAussehen` im Kern.
 */

const STILE: { wert: KonturStil; titel: string }[] = [
	{ wert: 'durchgezogen', titel: 'Linie' },
	{ wert: 'gestrichelt', titel: 'Striche' },
	{ wert: 'gepunktet', titel: 'Punkte' },
];

const ENDEN: { wert: KonturEnden; titel: string }[] = [
	{ wert: 'eckig', titel: 'Eckig' },
	{ wert: 'rund', titel: 'Rund' },
];

type SchattenStufe = Schatten | 'kein';

const SCHATTEN_WAHL: { wert: SchattenStufe; titel: string }[] = [
	{ wert: 'kein', titel: 'Kein' },
	{ wert: 'leicht', titel: 'Leicht' },
	{ wert: 'mittel', titel: 'Mittel' },
	{ wert: 'stark', titel: 'Stark' },
];

/**
 * Enden wirken nur an offenen Strichen: an den Strichen einer gestrichelten Kontur und am offenen Pfad. Linie und Pfeil
 * enden immer rund, Punkte sind immer rund (`konturStilNeu` im Kern).
 */
const endenWirken = (klasse: string | undefined, stil: KonturStil) =>
	klasse !== 'linie' && (stil === 'gestrichelt' || (klasse === 'pfad' && stil === 'durchgezogen'));

export const KonturStilWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const form = leseKonturStil(quelle, k.nr);
	const stand = leseForm(quelle, k.nr);
	// Bei der Form ohne Kontur gibt es nichts zu stricheln; Form mit Text (107) hat ihre Kontur immer.
	const ohneKontur = k.art === 'form' && !stand?.kontur;
	const setze = (beschreibung: string, neu: typeof form) =>
		k.fuehreAus(beschreibung, (q) => ({ quelle: setzeKonturStil(q, k.nr, neu), nr: k.nr }));
	return (
		<div className="flex flex-col gap-1" data-gestaltung-kontur-stil>
			<Zeile titel="Stil" name="Stil der Kontur">
				<span data-aussehen-kontur-stil={form.stil}>
					<Segment
						beschriftung="Stil der Kontur"
						werte={STILE}
						wert={form.stil}
						aus={!aktiv || ohneKontur}
						waehle={(stil) => setze('Stil der Kontur', { ...form, stil })}
					/>
				</span>
			</Zeile>
			{endenWirken(formVon(stand?.art)?.klasse, form.stil) && (
				<Zeile titel="Enden" name="Enden der Kontur">
					<span data-aussehen-kontur-enden={form.enden}>
						<Segment
							beschriftung="Enden der Kontur"
							werte={ENDEN}
							wert={form.enden}
							aus={!aktiv || ohneKontur}
							waehle={(enden) => setze('Enden der Kontur', { ...form, enden })}
						/>
					</span>
				</Zeile>
			)}
		</div>
	);
};

const SchattenWahl = ({ aktiv, k, quelle }: InspektorTeile) => {
	const wert = leseSchatten(quelle, k.nr) ?? 'kein';
	return (
		<Zeile titel="Schatten" name="Schatten" darunter>
			<span className="flex" data-aussehen-schatten={wert}>
				<Segment
					beschriftung="Schatten"
					werte={SCHATTEN_WAHL}
					wert={wert}
					aus={!aktiv}
					voll
					waehle={(neu) => {
						k.fuehreAus(neu === 'kein' ? 'Schatten entfernt' : 'Schatten geändert', (q) => ({
							quelle: setzeSchatten(q, k.nr, neu === 'kein' ? null : neu),
							nr: k.nr,
						}));
					}}
				/>
			</span>
		</Zeile>
	);
};

/** Regler wie überall: Anzeige beim Ziehen am Element im `iframe`, ein Schritt beim Loslassen. */
const DeckkraftWahl = ({ aktiv, k, quelle }: InspektorTeile) => (
	<div data-aussehen-deckkraft>
		<Regler
			name="deckkraft"
			titel="Deckkraft"
			einheit=" %"
			min={10}
			max={100}
			schritt={5}
			wert={leseDeckkraft(quelle, k.nr)}
			aus={!aktiv}
			zeige={(w) => (k.element as HTMLElement | SVGElement).style.setProperty('opacity', String(w / 100))}
			setze={(w) => k.fuehreAus('Deckkraft geändert', (q) => ({ quelle: setzeDeckkraft(q, k.nr, w), nr: k.nr }))}
		/>
	</div>
);

export const Aussehen = (t: InspektorTeile) => (
	<div className="flex flex-col gap-1" data-gestaltung-aussehen>
		{kannAussehen(t.k.art, 'schatten') && <SchattenWahl {...t} />}
		{kannAussehen(t.k.art, 'deckkraft') && <DeckkraftWahl {...t} />}
	</div>
);
