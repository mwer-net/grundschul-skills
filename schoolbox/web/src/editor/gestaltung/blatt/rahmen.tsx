import type { RahmenArt, Seitenrahmen } from '@schoolbox/kern/src/seitengestaltung';
import {
	RAHMEN_ABSTAND,
	RAHMEN_ABSTAND_MINIBUCH,
	RAHMEN_STAERKE,
	setzeSeitenrahmen,
} from '@schoolbox/kern/src/seitengestaltung';
import type { ReactNode } from 'react';

import { Abschnitt } from '../../../bausteine/Abschnitt';
import { Farbwahl } from '../../../bausteine/Farbwahl';
import { KACHEL } from '../../../bausteine/klassen';
import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { SwZeile } from './flaeche';
import { useGiltFuer, zielVon } from './gilt';
import { GiltFuer } from './gilt-fuer';
import { Regler } from './regler';
import type { BlattTeile } from './teile';

type Art = RahmenArt | 'keine';

/** Linienprobe 28×16 in der Farbe der Schrift. */
const Linie = ({ children }: { children: ReactNode }) => (
	<svg aria-hidden viewBox="0 0 28 16" className="h-4 w-7 flex-none" fill="none" stroke="currentColor">
		{children}
	</svg>
);

const ARTEN: { wert: Art; titel: string; bild: ReactNode }[] = [
	{ wert: 'keine', titel: 'Keine', bild: 'Keine' },
	{
		wert: 'linie',
		titel: 'Linie',
		bild: (
			<Linie>
				<path d="M2 8h24" strokeWidth={2} />
			</Linie>
		),
	},
	{
		wert: 'doppelt',
		titel: 'Doppelt',
		bild: (
			<Linie>
				<path d="M2 5.5h24M2 10.5h24" strokeWidth={1.5} />
			</Linie>
		),
	},
	{
		wert: 'gestrichelt',
		titel: 'Gestrichelt',
		bild: (
			<Linie>
				<path d="M2 8h24" strokeWidth={2} strokeDasharray="5 3" />
			</Linie>
		),
	},
	{
		wert: 'gepunktet',
		titel: 'Gepunktet',
		bild: (
			<Linie>
				<path d="M3 8h23" strokeWidth={2} strokeDasharray="0 4" strokeLinecap="round" />
			</Linie>
		),
	},
];

/** Ohne Angabe im Material: `blatt.css` zeichnet den Rahmen in `var(--dunkel)`. */
const FARBE = 'var(--dunkel)';

/** Seitenrahmen: Art, Farbe, Stärke, Abstand vom Blattrand und Ecken (3.6). */
export const BlattRahmen = (t: BlattTeile) => {
	const [gilt, setGilt] = useGiltFuer('seitenrahmen', t.quelle, t.index);
	const jetzt = t.gestaltung.rahmen;
	const art: Art = jetzt?.art ?? 'keine';
	const vorgabeAbstand = t.minibuch ? RAHMEN_ABSTAND_MINIBUCH : RAHMEN_ABSTAND;
	const setze = (beschreibung: string, neu: Seitenrahmen | null) =>
		t.aendere(beschreibung, (q) => setzeSeitenrahmen(q, zielVon(gilt, t), neu));
	const aendere = (beschreibung: string, teil: Partial<Seitenrahmen>) => {
		if (jetzt) {
			setze(beschreibung, { ...jetzt, ...teil });
		}
	};
	const waehleArt = (neu: Art) => {
		if (neu === 'keine') {
			setze('Seitenrahmen entfernt', null);
			return;
		}
		setze(`Seitenrahmen: ${ARTEN.find((a) => a.wert === neu)?.titel ?? neu}`, { ...jetzt, art: neu });
	};
	const zeige = (werte: Record<string, string>) => t.zeige('seitenrahmen', gilt === 'alle', werte);
	return (
		<Abschnitt titel="Rahmen" name="seitenrahmen">
			<div className="contents" data-blatt-rahmen={art}>
				<GiltFuer gilt={gilt} setze={setGilt} t={t} />
				<Zeile titel="Art" einstellung="seitenrahmen" darunter>
					<div
						className="grid grid-cols-5 gap-1"
						role="group"
						aria-label="Seitenrahmen"
						data-rahmen-art={art}
					>
						{ARTEN.map((a) => (
							<button
								key={a.wert}
								type="button"
								className={KACHEL}
								aria-pressed={art === a.wert}
								aria-label={a.titel}
								title={a.titel}
								data-wert={a.wert}
								onClick={() => waehleArt(a.wert)}
							>
								{a.bild}
							</button>
						))}
					</div>
				</Zeile>
				{jetzt && (
					<>
						<Zeile titel="Farbe" darunter>
							<Farbwahl
								name="rahmen-farbe"
								beschriftung="Farbe"
								doc={t.doc}
								wert={jetzt.farbe ?? FARBE}
								setze={(farbe) => aendere('Farbe des Rahmens', { farbe })}
								zeige={(farbe) => zeige({ '--rahmen-farbe': farbe })}
							/>
						</Zeile>
						<Zeile titel="Stärke" name="Stärke">
							<Stepper
								name="Stärke"
								einheit="px"
								wert={jetzt.staerke ?? RAHMEN_STAERKE}
								min={1}
								max={12}
								setze={(staerke) => aendere('Stärke des Rahmens', { staerke })}
							/>
						</Zeile>
						<Regler
							name="abstand"
							titel="Abstand"
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
							wert={jetzt.sw === 'weg' ? 'weg' : 'grau'}
							setze={(sw) => aendere('Seitenrahmen in s/w', { sw: sw === 'weg' ? 'weg' : null })}
						/>
					</>
				)}
			</div>
		</Abschnitt>
	);
};
