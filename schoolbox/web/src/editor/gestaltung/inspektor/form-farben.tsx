import { leseVerlauf, setzeVerlauf } from '@schoolbox/kern/src/aussehen';
import type { Kontur } from '@schoolbox/kern/src/formen';
import { KONTUR, KONTUR_MAX, STRICH } from '@schoolbox/kern/src/formen';
import { leseForm, setzeFuellung, setzeKontur } from '@schoolbox/kern/src/formen-aendern';

import type { VerlaufWahl } from '../../../bausteine/Farbwahl';
import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { pfadDerForm } from '../anzeige-folgen';
import type { GestaltungKontext } from '../kontext';

/**
 * Füllung und Kontur (3-formen.md, E2): „Keine“, „Schwarz“, die fünf Farben des Blatts, Weiß und „Eigene Farbe“ in
 * einer Reihe (182), mit und ohne Verlauf.
 */
export const Farben = ({
	aus,
	beschriftung,
	doc,
	gemischt,
	name,
	setze,
	titel,
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
	/** 108: Füllung mit Verlauf. */
	verlauf?: VerlaufWahl;
	/** Mehrfachauswahl mit verschiedenen Werten: kein Punkt gewählt. */
	gemischt?: boolean;
	/** 185: Titel der Zeile, neben ihm „Farbe / Verlauf“. */
	titel?: string;
}) => (
	<div data-form-farben={name}>
		<Farbwahl
			name={name}
			beschriftung={beschriftung}
			keine={`Keine ${beschriftung}`}
			schwarz
			gemischt={gemischt}
			doc={doc}
			wert={wert}
			aus={aus}
			setze={setze}
			zeige={zeige}
			verlauf={verlauf}
			titel={titel}
		/>
	</div>
);

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

/** 185: Im Inspektor mit Titel „Füllung“, „Farbe / Verlauf“ daneben; in der Leiste am Element ohne. */
export const FuellungWahl = ({ aktiv, k, quelle, titel }: FarbTeile & { titel?: string }) => {
	const stand = leseForm(quelle, k.nr);
	if (!stand) {
		return null;
	}
	return (
		<Farben
			name="form-fuellung"
			beschriftung="Füllung"
			titel={titel}
			doc={k.doc}
			aus={!aktiv}
			wert={stand.fuellung}
			setze={(farbe) => {
				k.fuehreAus(farbe === null ? 'Füllung entfernt' : 'Füllung geändert', (q) => ({
					quelle: setzeFuellung(q, k.nr, farbe),
					nr: k.nr,
				}));
			}}
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
				setze={(farbe) => {
					if (farbe === null) {
						setze('Kontur entfernt', null);
					} else {
						setze('Kontur geändert', { farbe, staerke: kontur?.staerke || STRICH });
					}
				}}
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
						setze={(staerke) => {
							setze(
								'Stärke der Kontur',
								staerke > 0 ? { farbe: kontur?.farbe ?? KONTUR, staerke } : null,
							);
						}}
					/>
				</span>
			</Zeile>
		</div>
	);
};
