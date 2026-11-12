import type { Verlauf } from '@schoolbox/kern/src/aussehen';

import type { FarbreiheEigenschaften } from './Farbfeld';
import { Farbreihe } from './Farbfeld';
import { Segment } from './Segment';
import { Stepper } from './Stepper';
import { verlaufCss } from './verlauf';
import { Zeile } from './Zeile';

/**
 * Farben des Blatts als Variablen (Briefing 3.9): Sie folgen Palette und Thema. Weiß und eine eigene Farbe kommen als
 * Hex dazu. Die Punkte zeichnet `Farbreihe` (182); 108 ergänzt Verläufe (Feld `verlauf`).
 */
type Eigenschaften = FarbreiheEigenschaften & {
	/**
	 * 108: Mit diesem Feld zeigt der Wähler oben „Farbe / Verlauf“. Beim Verlauf: linear oder radial, zwei Farben und
	 * (nur linear) den Winkel. Jede Änderung ist ein Schritt; „Farbe“ setzt die erste Farbe einfarbig über `setze`.
	 */
	verlauf?: VerlaufWahl;
};

export interface VerlaufWahl {
	wert: Verlauf | null;
	setze: (verlauf: Verlauf) => void;
}

/** Ein neuer Verlauf geht von der bisherigen Farbe aus, nach unten (90°). */
const ersterVerlauf = (wert: string | null): Verlauf => {
	const f1 = wert ?? 'var(--haupt)';
	return { art: 'linear', f1, f2: f1 === 'var(--akzent)' ? 'var(--haupt)' : 'var(--akzent)', winkel: 90 };
};

const MitVerlauf = ({ verlauf, ...e }: Eigenschaften & { verlauf: VerlaufWahl }) => {
	const { aus, beschriftung, doc, name, wert } = e;
	const v = verlauf.wert;
	// Kein eigener Zustand: „Verlauf“ legt sofort einen an, „Farbe“ setzt die erste Farbe einfarbig.
	const modus = v ? 'verlauf' : 'farbe';
	const waehle = (neu: 'farbe' | 'verlauf') => {
		if (neu === 'verlauf' && !v) {
			verlauf.setze(ersterVerlauf(wert));
		} else if (neu === 'farbe' && v) {
			e.setze(v.f1);
		}
	};
	return (
		<div className="flex flex-col gap-1.5" data-farbwahl-verlauf={name ?? beschriftung}>
			<Segment
				beschriftung={`${beschriftung}: Farbe oder Verlauf`}
				werte={[
					{ wert: 'farbe', titel: 'Farbe' },
					{ wert: 'verlauf', titel: 'Verlauf' },
				]}
				wert={modus}
				waehle={waehle}
				aus={aus}
				voll
			/>
			{!v ? (
				<Farbreihe {...e} />
			) : (
				<div className="flex flex-col gap-1" data-verlauf={v.art}>
					<div className="flex items-center justify-between gap-2">
						<Segment
							beschriftung="Art des Verlaufs"
							werte={[
								{ wert: 'linear', titel: 'Linear' },
								{ wert: 'radial', titel: 'Radial' },
							]}
							wert={v.art}
							waehle={(art) => verlauf.setze({ ...v, art })}
							aus={aus}
						/>
						<span
							aria-hidden
							className="block h-5 w-10 flex-none rounded-sm border border-black/10"
							style={{ background: verlaufCss(doc, v) }}
							data-verlauf-vorschau
						/>
					</div>
					{(['f1', 'f2'] as const).map((f, i) => (
						<Zeile key={f} titel={`Farbe ${i + 1}`} darunter>
							<Farbreihe
								beschriftung={`${beschriftung}, Farbe ${i + 1}`}
								name={`${name ?? beschriftung}-${f}`}
								doc={doc}
								aus={aus}
								wert={v[f]}
								setze={(farbe) => verlauf.setze({ ...v, [f]: farbe })}
							/>
						</Zeile>
					))}
					{v.art === 'linear' && (
						<div data-verlauf-winkel className="contents">
							<Zeile titel="Winkel" name="Winkel des Verlaufs">
								<Stepper
									name="Winkel des Verlaufs"
									wert={v.winkel}
									min={0}
									max={345}
									schritt={15}
									einheit="°"
									aus={aus}
									setze={(winkel) => verlauf.setze({ ...v, winkel })}
								/>
							</Zeile>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

/** Fünf Farben des Blatts, Weiß und „Eigene Farbe“. Ein Klick wählt, ein Schritt im Verlauf. Mit `verlauf` auch Verläufe. */
export const Farbwahl = (e: Eigenschaften) =>
	e.verlauf ? <MitVerlauf {...e} verlauf={e.verlauf} /> : <Farbreihe {...e} />;
