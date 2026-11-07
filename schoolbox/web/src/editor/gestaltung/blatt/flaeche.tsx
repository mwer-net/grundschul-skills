import type { MusterArt, Seitenflaeche } from '@schoolbox/kern/src/seitengestaltung';
import { MUSTER_GROESSE, setzeSeitenflaeche, WINKEL } from '@schoolbox/kern/src/seitengestaltung';
import type { ReactNode } from 'react';

import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Segment } from '../../../bausteine/Segment';
import { Regler } from './regler';
import type { BlattTeile } from './teile';

type Art = Seitenflaeche['art'] | 'keine';

const ARTEN: { wert: Art; titel: string }[] = [
	{ wert: 'keine', titel: 'Keine' },
	{ wert: 'farbe', titel: 'Farbe' },
	{ wert: 'verlauf', titel: 'Verlauf' },
	{ wert: 'muster', titel: 'Muster' },
];

const MUSTER: { wert: MusterArt; titel: string }[] = [
	{ wert: 'streifen', titel: 'Streifen' },
	{ wert: 'punkte', titel: 'Punkte' },
	{ wert: 'karo', titel: 'Karo' },
	{ wert: 'schraeg', titel: 'Schräg' },
];

const SW: { wert: 'weg' | 'grau'; titel: string }[] = [
	{ wert: 'weg', titel: 'weg' },
	{ wert: 'grau', titel: 'grau' },
];

/** Ein ruhiger, heller Grund wie im Vorbild „Deckblatt ruhig“; die Farben lassen sich danach ändern. */
const VORGABE: Record<Seitenflaeche['art'], Seitenflaeche> = {
	farbe: { art: 'farbe', f1: '#fff7e6' },
	verlauf: { art: 'verlauf', f1: '#fff7e6', f2: '#ffe0b8', winkel: WINKEL },
	muster: { art: 'muster', f1: '#ffffff', f2: '#ffe0b8', muster: 'punkte', musterGroesse: MUSTER_GROESSE },
};

const NAME: Record<Seitenflaeche['art'], string> = { farbe: 'Farbe', verlauf: 'Verlauf', muster: 'Muster' };

export const FarbZeile = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<div className="flex flex-col gap-1 py-0.5">
		<span className="text-leise">{titel}</span>
		{children}
	</div>
);

export const SwZeile = ({
	aus,
	setze,
	wert,
	werte,
}: {
	wert: 'weg' | 'grau';
	werte: { wert: 'weg' | 'grau'; titel: string }[];
	setze: (wert: 'weg' | 'grau') => void;
	aus?: boolean;
}) => (
	<div className="flex min-h-zeile items-center justify-between gap-x-2">
		<span className="text-leise">In s/w</span>
		<Segment beschriftung="In s/w" werte={werte} wert={wert} waehle={setze} aus={aus} className="ml-auto" />
	</div>
);

/** Seitenfläche: keine, Farbe, Verlauf oder Muster, für diese Seite oder alle (3.6). */
export const BlattFlaeche = (t: BlattTeile) => {
	const jetzt = t.gestaltung.flaeche;
	const art: Art = jetzt?.art ?? 'keine';
	const gesperrt = jetzt?.rezept === true;
	const setze = (beschreibung: string, neu: Seitenflaeche | null) =>
		t.aendere(beschreibung, (q) => setzeSeitenflaeche(q, t.ziel, neu));
	const aendere = (beschreibung: string, teil: Partial<Seitenflaeche>) => {
		if (jetzt) {
			const { rezept: _, ...werte } = jetzt;
			setze(beschreibung, { ...werte, ...teil });
		}
	};
	const waehleArt = (neu: Art) => {
		if (neu === 'keine') {
			setze('Seitenfläche entfernt', null);
			return;
		}
		// Die Farben bleiben beim Wechsel der Art, was fehlt, kommt aus der Vorgabe.
		const vorgabe = VORGABE[neu];
		setze(`Seitenfläche: ${NAME[neu]}`, {
			...vorgabe,
			f1: jetzt?.f1 ?? vorgabe.f1 ?? null,
			f2: jetzt?.f2 ?? vorgabe.f2 ?? null,
			sw: jetzt?.sw ?? null,
		});
	};
	const zeige = (werte: Record<string, string>) => t.zeige('seitenflaeche', werte);
	return (
		<div className="flex flex-col gap-1" data-blatt-flaeche={art}>
			<span className="font-medium">Seitenfläche</span>
			<Segment
				beschriftung="Seitenfläche"
				werte={ARTEN}
				wert={art}
				waehle={waehleArt}
				aus={gesperrt}
				className="w-full justify-between"
			/>
			{gesperrt && (
				<p className="text-xs text-leise" data-aus-rezept>
					Kommt aus dem Rezept.
				</p>
			)}
			{jetzt && !gesperrt && (
				<>
					<FarbZeile titel={{ farbe: 'Farbe', verlauf: 'Farbe 1', muster: 'Grund' }[jetzt.art]}>
						<Farbwahl
							name="flaeche-f1"
							beschriftung={jetzt.art === 'muster' ? 'Grund' : 'Farbe 1'}
							doc={t.doc}
							wert={jetzt.f1 ?? null}
							setze={(f1) => aendere('Farbe der Seitenfläche', { f1 })}
							zeige={(f1) => zeige({ '--f1': f1 })}
						/>
					</FarbZeile>
					{jetzt.art !== 'farbe' && (
						<FarbZeile titel={jetzt.art === 'muster' ? 'Musterfarbe' : 'Farbe 2'}>
							<Farbwahl
								name="flaeche-f2"
								beschriftung={jetzt.art === 'muster' ? 'Musterfarbe' : 'Farbe 2'}
								doc={t.doc}
								wert={jetzt.f2 ?? null}
								setze={(f2) => aendere('Farbe der Seitenfläche', { f2 })}
								zeige={(f2) => zeige({ '--f2': f2 })}
							/>
						</FarbZeile>
					)}
					{jetzt.art === 'verlauf' && (
						<Regler
							name="winkel"
							titel="Winkel"
							einheit="°"
							min={0}
							max={360}
							schritt={15}
							wert={jetzt.winkel ?? WINKEL}
							zeige={(w) => zeige({ '--winkel': `${w}deg` })}
							setze={(winkel) => aendere('Winkel des Verlaufs', { winkel })}
						/>
					)}
					{jetzt.art === 'muster' && (
						<>
							<div className="flex min-h-zeile items-center">
								<Segment
									beschriftung="Muster"
									werte={MUSTER}
									wert={jetzt.muster ?? 'streifen'}
									waehle={(muster) => aendere('Muster', { muster })}
									className="w-full justify-between"
								/>
							</div>
							<Regler
								name="mustergroesse"
								titel="Größe"
								einheit=" px"
								min={8}
								max={64}
								schritt={2}
								wert={jetzt.musterGroesse ?? MUSTER_GROESSE}
								zeige={(g) => zeige({ '--muster-groesse': `${g}px` })}
								setze={(musterGroesse) => aendere('Größe des Musters', { musterGroesse })}
							/>
						</>
					)}
					<SwZeile
						werte={SW}
						wert={jetzt.sw === 'grau' ? 'grau' : 'weg'}
						setze={(sw) => aendere('Seitenfläche in s/w', { sw: sw === 'grau' ? 'grau' : null })}
					/>
				</>
			)}
		</div>
	);
};
