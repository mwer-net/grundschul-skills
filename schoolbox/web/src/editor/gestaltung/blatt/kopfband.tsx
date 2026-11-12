import type { Kopfband, KopfbandArt, KopfbandForm } from '@schoolbox/kern/src/seitengestaltung';
import {
	KOPFBAND_FARBE,
	KOPFBAND_FARBE_2,
	KOPFBAND_HOEHE,
	KOPFBAND_WINKEL,
	setzeKopfband,
} from '@schoolbox/kern/src/seitengestaltung';

import { Abschnitt } from '../../../bausteine/Abschnitt';
import { KACHEL } from '../../../bausteine/klassen';
import { Segment } from '../../../bausteine/Segment';
import { Zeile } from '../../../bausteine/Zeile';
import { SwZeile } from './flaeche';
import { FuellungZeilen } from './fuellung';
import { useGiltFuer, zielVon } from './gilt';
import { GiltFuer } from './gilt-fuer';
import { bestandHoehe, kopfbandHoehe } from './kopfband-messen';
import { Regler } from './regler';
import type { BlattTeile } from './teile';
import { quellSeiten } from './teile';

type Art = KopfbandArt | 'keine';

const ARTEN: { wert: Art; titel: string }[] = [
	{ wert: 'keine', titel: 'Keine' },
	{ wert: 'farbe', titel: 'Farbe' },
	{ wert: 'verlauf', titel: 'Verlauf' },
];

/** Jede Form als Kante unter einem Streifen, 28×16. */
const FORMEN: { wert: KopfbandForm; titel: string; d: string }[] = [
	{ wert: 'gerade', titel: 'Gerade', d: 'M2 3h24v8H2Z' },
	{ wert: 'welle', titel: 'Welle', d: 'M2 3h24v6c-3 0-3 4-6 4s-3-4-6-4-3 4-6 4-3-4-6-4Z' },
	{ wert: 'bogen', titel: 'Bogen', d: 'M2 3h24v4Q14 19 2 7Z' },
	{ wert: 'zacken', titel: 'Zacken', d: 'M2 3h24v6l-3 4-3-4-3 4-3-4-3 4-3-4-3 4-3-4Z' },
];

/** Kleinste Höhe; die größte ist die halbe Seite. */
const MIN_HOEHE = 40;

/**
 * Kopfband: ein Band oben auf der Seite, für eine Seite oder alle (181). Ein neues reicht bis unter den Kopf. Das alte
 * Band eines Rezepts zeigt der Abschnitt mit denselben Werten; die erste Änderung schreibt es als `.kopfband` auf die
 * Seite, mit der gemessenen Höhe. Nicht im Mini-Book.
 */
export const BlattKopfband = (t: BlattTeile) => {
	const [gilt, setGilt] = useGiltFuer('kopfband', t.quelle, t.index);
	if (t.minibuch) {
		return null;
	}
	const jetzt = t.gestaltung.kopfband;
	const art: Art = jetzt?.art ?? 'keine';
	const seite = t.doc ? (quellSeiten(t.doc)[t.index] ?? null) : null;
	const setze = (beschreibung: string, neu: Kopfband | null) =>
		t.aendere(beschreibung, (q) => setzeKopfband(q, zielVon(gilt, t), neu));
	/** Im Bestand gilt die Höhe des alten Bands, damit nach dem Umwandeln alles bleibt, wie es war. */
	const hoeheJetzt = jetzt?.hoehe ?? (jetzt?.bestand ? bestandHoehe(seite) : null);
	const aendere = (beschreibung: string, teil: Partial<Kopfband>) => {
		if (jetzt) {
			setze(beschreibung, { ...jetzt, hoehe: hoeheJetzt, ...teil });
		}
	};
	const waehleArt = (neu: Art) => {
		if (neu === 'keine') {
			setze('Kopfband entfernt', null);
			return;
		}
		const name = `Kopfband: ${ARTEN.find((a) => a.wert === neu)?.titel ?? neu}`;
		const f2 = neu === 'verlauf' ? KOPFBAND_FARBE_2 : null;
		if (jetzt) {
			aendere(name, { art: neu, f2: jetzt.f2 ?? f2 });
			return;
		}
		setze(name, { form: 'gerade', art: neu, f1: KOPFBAND_FARBE, f2, hoehe: kopfbandHoehe(seite) });
	};
	const zeige = (werte: Record<string, string>) => t.zeige('kopfband', gilt === 'alle', werte);
	const maxHoehe = seite ? Math.max(MIN_HOEHE, Math.round(seite.clientHeight / 2)) : 560;
	return (
		<Abschnitt titel="Kopfband" name="kopfband">
			<div className="contents" data-blatt-kopfband={jetzt?.form ?? 'keine'}>
				<GiltFuer gilt={gilt} setze={setGilt} t={t} />
				<Zeile titel="Art" einstellung="kopfband" darunter>
					<Segment beschriftung="Kopfband" werte={ARTEN} wert={art} waehle={waehleArt} voll />
				</Zeile>
				{jetzt && (
					<>
						<Zeile titel="Form" darunter>
							<div className="grid grid-cols-4 gap-1" role="group" aria-label="Form" data-kopfband-form>
								{FORMEN.map((f) => (
									<button
										key={f.wert}
										type="button"
										className={KACHEL}
										aria-pressed={jetzt.form === f.wert}
										aria-label={f.titel}
										title={f.titel}
										data-wert={f.wert}
										onClick={() => aendere(`Kopfband: ${f.titel}`, { form: f.wert })}
									>
										<svg aria-hidden viewBox="0 0 28 16" className="h-4 w-7 flex-none text-leise">
											<path d={f.d} fill="currentColor" />
										</svg>
									</button>
								))}
							</div>
						</Zeile>
						<FuellungZeilen
							art={jetzt.art}
							name="kopfband"
							teil="des Kopfbands"
							doc={t.doc}
							werte={{
								f1: jetzt.f1 ?? KOPFBAND_FARBE,
								f2: jetzt.f2 ?? KOPFBAND_FARBE_2,
								winkel: jetzt.winkel,
							}}
							winkel={KOPFBAND_WINKEL}
							setze={aendere}
							zeige={zeige}
						/>
						<Regler
							name="hoehe"
							titel="Höhe"
							einheit=" px"
							min={MIN_HOEHE}
							max={maxHoehe}
							wert={Math.round(hoeheJetzt ?? KOPFBAND_HOEHE)}
							zeige={(h) => zeige({ '--h': `${h}px` })}
							setze={(hoehe) => aendere('Höhe des Kopfbands', { hoehe })}
						/>
						<SwZeile
							wert={jetzt.sw === 'grau' ? 'grau' : 'weg'}
							setze={(sw) => aendere('Kopfband in s/w', { sw: sw === 'grau' ? 'grau' : null })}
						/>
					</>
				)}
			</div>
		</Abschnitt>
	);
};
