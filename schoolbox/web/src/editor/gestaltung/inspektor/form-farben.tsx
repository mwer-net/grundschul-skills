import type { Kontur } from '@schoolbox/kern/src/formen';
import { KONTUR, KONTUR_MAX, STRICH } from '@schoolbox/kern/src/formen';
import { leseVerlauf, setzeVerlauf } from '@schoolbox/kern/src/aussehen';
import { leseForm, setzeFuellung, setzeKontur } from '@schoolbox/kern/src/formen-aendern';

import type { VerlaufWahl } from '../../../bausteine/Farbwahl';
import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { pfadDerForm } from '../anzeige-folgen';
import type { GestaltungKontext } from '../kontext';

export const SCHWARZ = '#000000';

const istSchwarz = (wert: string | null) => wert !== null && ['#000', '#000000'].includes(wert.toLowerCase());

const RUND =
	'flex size-knopf-klein flex-none items-center justify-center rounded-full border border-rand p-0.5 aria-pressed:border-tinte aria-pressed:ring-1 aria-pressed:ring-tinte disabled:opacity-50';

/**
 * „Keine“ und „Schwarz“ vor dem Farbwähler aus 095, der die fünf Farben des Blatts, Weiß und „Eigene Farbe“ zeigt
 * (3-formen.md, Füllung und Kontur E2).
 */
export const Farben = ({
	aus,
	beschriftung,
	doc,
	name,
	setze,
	verlauf,
	wert,
	zeige,
}: {
	beschriftung: string;
	name: string;
	wert: string | null;
	setze: (wert: string | null) => void;
	zeige: (wert: string) => void;
	doc: Document;
	aus: boolean;
	/** 108: Füllung mit Verlauf; „Keine“ und „Schwarz“ stehen dann in der Reihe des Farbwählers. */
	verlauf?: VerlaufWahl;
}) => {
	const knoepfe = (
		<>
			<button
				type="button"
				className={RUND}
				aria-pressed={wert === null && !verlauf?.wert}
				aria-label={`Keine ${beschriftung}`}
				title="Keine"
				disabled={aus}
				data-farbe="keine"
				onClick={() => setze(null)}
			>
				<span
					aria-hidden
					className="block size-full min-h-4 rounded-full border border-black/10 bg-white"
					style={{ background: 'linear-gradient(135deg, #fff 45%, #e11d48 45% 55%, #fff 55%)' }}
				/>
			</button>
			<button
				type="button"
				className={RUND}
				aria-pressed={istSchwarz(wert)}
				aria-label="Schwarz"
				title="Schwarz"
				disabled={aus}
				data-farbe={SCHWARZ}
				onClick={() => setze(SCHWARZ)}
			>
				<span aria-hidden className="block size-full min-h-4 rounded-full bg-black" />
			</button>
		</>
	);
	const wahl = (
		<Farbwahl
			name={name}
			beschriftung={beschriftung}
			doc={doc}
			wert={istSchwarz(wert) ? null : wert}
			aus={aus}
			setze={setze}
			zeige={zeige}
			{...(verlauf ? { verlauf, vor: knoepfe } : {})}
		/>
	);
	return (
		<div className="flex flex-wrap items-center gap-1" data-form-farben={name}>
			{verlauf ? null : knoepfe}
			{wahl}
		</div>
	);
};

/** Nur ansehen: eine Eigenschaft im `style` des Pfads im `iframe`. */
const zeigeAmPfad = (k: GestaltungKontext, eigenschaft: string, wert: string) => {
	const pfad = pfadDerForm(k.element) as SVGElement | null; // 107: auch in `.form-text`
	pfad?.style.setProperty(eigenschaft, wert);
};

export interface FarbTeile {
	k: GestaltungKontext;
	quelle: string;
	aktiv: boolean;
}

export const FuellungWahl = ({ aktiv, k, quelle }: FarbTeile) => {
	const stand = leseForm(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<Farben
			name="form-fuellung"
			beschriftung="Füllung"
			doc={k.doc}
			aus={!aktiv}
			wert={stand.fuellung}
			setze={(farbe) =>
				k.fuehreAus(farbe === null ? 'Füllung entfernt' : 'Füllung geändert', (q) => ({
					quelle: setzeFuellung(q, k.nr, farbe),
					nr: k.nr,
				}))
			}
			zeige={(farbe) => zeigeAmPfad(k, 'fill', farbe)}
			verlauf={{
				// 108: Verlauf über den Farbwähler; die Leiste am Element bekommt ihn so von selbst.
				wert: leseVerlauf(quelle, k.nr),
				setze: (verlauf) =>
					k.fuehreAus('Verlauf geändert', (q) => ({ quelle: setzeVerlauf(q, k.nr, verlauf), nr: k.nr })),
			}}
		/>
	);
};

export const KonturWahl = ({ aktiv, k, quelle }: FarbTeile) => {
	const stand = leseForm(quelle, k.nr);
	if (!stand) {
		return null;
	}
	const { kontur } = stand;
	const setze = (beschreibung: string, neu: Kontur | null) =>
		k.fuehreAus(beschreibung, (q) => ({ quelle: setzeKontur(q, k.nr, neu), nr: k.nr }));
	return (
		<div className="flex flex-col gap-1">
			<Farben
				name="form-kontur"
				beschriftung="Kontur"
				doc={k.doc}
				aus={!aktiv}
				wert={kontur?.farbe ?? null}
				setze={(farbe) =>
					farbe === null
						? setze('Kontur entfernt', null)
						: setze('Kontur geändert', { farbe, staerke: kontur?.staerke || STRICH })
				}
				zeige={(farbe) => zeigeAmPfad(k, 'stroke', farbe)}
			/>
			<Zeile titel="Stärke" name="Stärke der Kontur">
				<span data-form-staerke>
					<Stepper
						name="Stärke der Kontur"
						wert={kontur?.staerke ?? 0}
						min={0}
						max={KONTUR_MAX}
						aus={!aktiv}
						setze={(staerke) =>
							setze(
								'Stärke der Kontur',
								staerke > 0 ? { farbe: kontur?.farbe ?? KONTUR, staerke } : null,
							)
						}
					/>
				</span>
			</Zeile>
		</div>
	);
};
