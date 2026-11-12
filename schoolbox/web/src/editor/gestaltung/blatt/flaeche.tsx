import type { MusterArt, Seitenflaeche } from '@schoolbox/kern/src/seitengestaltung';
import { MUSTER_GROESSE, setzeSeitenflaeche, WINKEL } from '@schoolbox/kern/src/seitengestaltung';

import { Abschnitt } from '../../../bausteine/Abschnitt';
import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import { FuellungZeilen } from './fuellung';
import { useGiltFuer, zielVon } from './gilt';
import { GiltFuer } from './gilt-fuer';
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

type Sw = 'weg' | 'grau';

/** „In s/w“ in allen drei Abschnitten: erst „Weg“, dann „Grau“, wie im Reiter „Auswahl“ (182). */
const SW: { wert: Sw; titel: string }[] = [
	{ wert: 'weg', titel: 'Weg' },
	{ wert: 'grau', titel: 'Grau' },
];

export const SwZeile = ({ setze, wert }: { wert: Sw; setze: (wert: Sw) => void }) => (
	<Zeile titel="In s/w">
		<Segment beschriftung="In s/w" werte={SW} wert={wert} waehle={setze} />
	</Zeile>
);

/** Ein ruhiger, heller Grund wie im Vorbild „Deckblatt ruhig“; die Farben lassen sich danach ändern. */
const VORGABE: Record<Seitenflaeche['art'], Seitenflaeche> = {
	farbe: { art: 'farbe', f1: '#fff7e6' },
	verlauf: { art: 'verlauf', f1: '#fff7e6', f2: '#ffe0b8', winkel: WINKEL },
	muster: { art: 'muster', f1: '#ffffff', f2: '#ffe0b8', muster: 'punkte', musterGroesse: MUSTER_GROESSE },
};

const NAME: Record<Seitenflaeche['art'], string> = { farbe: 'Farbe', verlauf: 'Verlauf', muster: 'Muster' };

/** Seitenfläche: keine, Farbe, Verlauf oder Muster, für eine Seite oder alle (3.6). */
export const BlattFlaeche = (t: BlattTeile) => {
	const [gilt, setGilt] = useGiltFuer('seitenflaeche', t.quelle, t.index);
	const jetzt = t.gestaltung.flaeche;
	const art: Art = jetzt?.art ?? 'keine';
	const setze = (beschreibung: string, neu: Seitenflaeche | null) =>
		t.aendere(beschreibung, (q) => setzeSeitenflaeche(q, zielVon(gilt, t), neu));
	const aendere = (beschreibung: string, teil: Partial<Seitenflaeche>) => {
		if (jetzt) {
			setze(beschreibung, { ...jetzt, ...teil });
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
	const zeige = (werte: Record<string, string>) => t.zeige('seitenflaeche', gilt === 'alle', werte);
	return (
		<Abschnitt titel="Seitenfläche" name="seitenflaeche">
			<div className="contents" data-blatt-flaeche={art}>
				<GiltFuer gilt={gilt} setze={setGilt} t={t} />
				<Zeile titel="Art" einstellung="seitenflaeche" darunter>
					<Segment beschriftung="Seitenfläche" werte={ARTEN} wert={art} waehle={waehleArt} voll />
				</Zeile>
				{jetzt && (
					<>
						<FuellungZeilen
							art={jetzt.art}
							name="flaeche"
							teil="der Seitenfläche"
							doc={t.doc}
							werte={jetzt}
							winkel={WINKEL}
							setze={aendere}
							zeige={zeige}
						/>
						{jetzt.art === 'muster' && (
							<>
								<Zeile titel="Muster" darunter>
									<Segment
										beschriftung="Muster"
										werte={MUSTER}
										wert={jetzt.muster ?? 'streifen'}
										waehle={(muster) => aendere('Muster', { muster })}
										voll
									/>
								</Zeile>
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
							wert={jetzt.sw === 'grau' ? 'grau' : 'weg'}
							setze={(sw) => aendere('Seitenfläche in s/w', { sw: sw === 'grau' ? 'grau' : null })}
						/>
					</>
				)}
			</div>
		</Abschnitt>
	);
};
