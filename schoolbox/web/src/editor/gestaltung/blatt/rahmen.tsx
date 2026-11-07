import type { RahmenArt, Seitenrahmen } from '@schoolbox/kern/src/seitengestaltung';
import {
	RAHMEN_ABSTAND,
	RAHMEN_ABSTAND_MINIBUCH,
	RAHMEN_STAERKE,
	setzeSeitenrahmen,
} from '@schoolbox/kern/src/seitengestaltung';
import { useId } from 'react';

import { Farbwahl } from '../../../bausteine/Farbwahl';
import { FELD_KLASSEN, klassen } from '../../../bausteine/klassen';
import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { FarbZeile, SwZeile } from './flaeche';
import { Regler } from './regler';
import type { BlattTeile } from './teile';

type Art = RahmenArt | 'ohne';

const ARTEN: { wert: Art; titel: string }[] = [
	{ wert: 'ohne', titel: 'ohne' },
	{ wert: 'linie', titel: 'Linie' },
	{ wert: 'doppelt', titel: 'doppelt' },
	{ wert: 'gestrichelt', titel: 'gestrichelt' },
	{ wert: 'gepunktet', titel: 'gepunktet' },
];

const SW: { wert: 'grau' | 'weg'; titel: string }[] = [
	{ wert: 'grau', titel: 'grau' },
	{ wert: 'weg', titel: 'weg' },
];

/** Ohne Angabe im Material: `blatt.css` zeichnet den Rahmen in `var(--dunkel)`. */
const FARBE = 'var(--dunkel)';

/** Seitenrahmen: Stil, Farbe, Stärke, Abstand vom Blattrand und Ecken (3.6). */
export const BlattRahmen = (t: BlattTeile) => {
	const id = useId();
	const jetzt = t.gestaltung.rahmen;
	const art: Art = jetzt?.art ?? 'ohne';
	const gesperrt = jetzt?.rezept === true;
	const vorgabeAbstand = t.minibuch ? RAHMEN_ABSTAND_MINIBUCH : RAHMEN_ABSTAND;
	const setze = (beschreibung: string, neu: Seitenrahmen | null) =>
		t.aendere(beschreibung, (q) => setzeSeitenrahmen(q, t.ziel, neu));
	const aendere = (beschreibung: string, teil: Partial<Seitenrahmen>) => {
		if (jetzt) {
			const { rezept: _, ...werte } = jetzt;
			setze(beschreibung, { ...werte, ...teil });
		}
	};
	const waehleArt = (neu: Art) => {
		if (neu === 'ohne') {
			setze('Seitenrahmen entfernt', null);
			return;
		}
		const { rezept: _, ...werte } = jetzt ?? { rezept: false };
		setze(`Seitenrahmen: ${ARTEN.find((a) => a.wert === neu)?.titel ?? neu}`, { ...werte, art: neu });
	};
	const zeige = (werte: Record<string, string>) => t.zeige('seitenrahmen', werte);
	return (
		<div className="flex flex-col gap-1" data-blatt-rahmen={art}>
			<Zeile titel={<span className="font-medium text-tinte">Rahmen</span>} name="Rahmen" fuer={id}>
				<select
					id={id}
					className={klassen(FELD_KLASSEN, 'w-fit! max-w-36 pr-5!')}
					aria-label="Seitenrahmen"
					data-rahmen-art
					disabled={gesperrt}
					value={art}
					onChange={(e) => waehleArt(e.target.value as Art)}
				>
					{ARTEN.map((a) => (
						<option key={a.wert} value={a.wert}>
							{a.titel}
						</option>
					))}
				</select>
			</Zeile>
			{gesperrt && (
				<p className="text-xs text-leise" data-aus-rezept>
					Kommt aus dem Rezept.
				</p>
			)}
			{jetzt && !gesperrt && (
				<>
					<FarbZeile titel="Farbe">
						<Farbwahl
							name="rahmen-farbe"
							beschriftung="Farbe des Rahmens"
							doc={t.doc}
							wert={jetzt.farbe ?? FARBE}
							setze={(farbe) => aendere('Farbe des Rahmens', { farbe })}
							zeige={(farbe) => zeige({ '--rahmen-farbe': farbe })}
						/>
					</FarbZeile>
					<Zeile titel="Stärke" name="Stärke">
						<Stepper
							name="Stärke des Rahmens"
							wert={jetzt.staerke ?? RAHMEN_STAERKE}
							min={1}
							max={12}
							setze={(staerke) => aendere('Stärke des Rahmens', { staerke })}
						/>
					</Zeile>
					<Regler
						name="abstand"
						titel="Abstand zum Blattrand"
						einheit=" px"
						min={0}
						max={60}
						wert={jetzt.abstand ?? vorgabeAbstand}
						zeige={(a) => zeige({ '--rahmen-abstand': `${a}px` })}
						setze={(abstand) => aendere('Abstand des Rahmens', { abstand })}
					/>
					<Regler
						name="ecken"
						titel="Ecken"
						einheit=" px"
						min={0}
						max={48}
						wert={jetzt.ecke ?? 0}
						zeige={(e) => zeige({ '--rahmen-ecke': `${e}px` })}
						setze={(ecke) => aendere('Ecken des Rahmens', { ecke })}
					/>
					<SwZeile
						werte={SW}
						wert={jetzt.sw === 'weg' ? 'weg' : 'grau'}
						setze={(sw) => aendere('Seitenrahmen in s/w', { sw: sw === 'weg' ? 'weg' : null })}
					/>
				</>
			)}
		</div>
	);
};
