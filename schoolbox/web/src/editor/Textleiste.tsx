import { BLATT_FARBEN, WEISS } from '@schoolbox/kern/src/blatt-farben';
import { useState } from 'react';

import { Farbpunkt } from '../bausteine/Farbfeld';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { sichtbar } from '../bausteine/verlauf';
import { kuerzelText } from './befehle';
import { halteFokus } from './halteFokus';
import type { useText } from './text';
import { SCHRIFT_TASTEN } from './textdom';

type Text = ReturnType<typeof useText>;

const FORM = 'size-knopf-klein aria-pressed:bg-flaeche-2 aria-pressed:text-tinte';

/**
 * Nur in Schmuckschrift und Form mit Text (105): Der Knopf klappt die Farben des Blatts auf, ein Klick färbt die
 * markierten Wörter (`<span style="color:…">`). Alles bleibt in der Leiste, damit der Cursor im Text bleibt; ein
 * Farbwähler des Systems würde die Sitzung beenden.
 */
const WortFarbe = ({ text }: { text: Text }) => {
	const [offen, setOffen] = useState(false);
	const waehle = (farbe: string | null) => {
		text.faerbe(farbe);
		setOffen(false);
	};
	return (
		<div className="flex items-center gap-0.5" data-wortfarbe-knoepfe>
			<Tooltip text="Farbe für markierte Wörter">
				<Knopf
					art="leise"
					groesse="klein"
					className={FORM}
					aria-label="Farbe für markierte Wörter"
					aria-expanded={offen}
					data-wortfarbe-knopf
					{...halteFokus}
					onClick={() => setOffen((o) => !o)}
				>
					<span
						aria-hidden
						className="size-4 rounded-full border border-black/20"
						style={{ background: 'conic-gradient(#e76f51, #ffbe0b, #43aa8b, #3a86ff, #6a4c93, #e76f51)' }}
					/>
				</Knopf>
			</Tooltip>
			{offen && (
				<div role="group" aria-label="Farbe für markierte Wörter" className="flex items-center gap-0.5">
					{[
						...BLATT_FARBEN.map((f) => ({
							wert: f.wert,
							name: f.name,
							zeige: sichtbar(text.doc, f.variable),
						})),
						{ wert: WEISS, name: 'Weiß', zeige: WEISS },
					].map((f) => (
						<Farbpunkt
							key={f.wert}
							name={f.name}
							farbe={f.zeige}
							data-farbe={f.wert}
							{...halteFokus}
							onClick={() => waehle(f.wert)}
						/>
					))}
					<Tooltip text="Farbe der Schrift wie der Rest">
						<Knopf
							art="leise"
							groesse="klein"
							data-farbe="ohne"
							{...halteFokus}
							onClick={() => waehle(null)}
						>
							Ohne
						</Knopf>
					</Tooltip>
				</div>
			)}
		</div>
	);
};

/**
 * Fett, Unterstrichen, Hervorheben stehen vor und während des Tippens an derselben Stelle. Ohne Sitzung wirken sie auf
 * den ganzen Text und starten die Sitzung, damit `halteFokus` und ein Schritt im Verlauf für beide Wege gelten.
 * Gesperrtes Fett bleibt zeigbar (`aria-disabled`), sonst stünde der Grund nicht im Tooltip.
 */
export const Textknoepfe = ({ sitzung, text }: { sitzung: boolean; text: Text }) => {
	const { formatiere, formatiereGanz, zustand } = text;
	const wirke = sitzung ? formatiere : formatiereGanz;
	const { bold, underline } = SCHRIFT_TASTEN;
	return (
		<div role="group" aria-label="Schrift" className="flex items-center gap-0.5" data-textknoepfe>
			{/* 204-07: Wo die Schrift schon fett ist, wirkt „B“ nie; dann fehlt der Knopf. */}
			{zustand.fettMoeglich && (
				<Tooltip text={bold.titel} kuerzel={kuerzelText(bold.kuerzel)}>
					<Knopf
						art="leise"
						groesse="klein"
						className={klassen(FORM, 'font-semibold')}
						aria-label={bold.titel}
						aria-pressed={zustand.fett}
						{...halteFokus}
						onClick={() => wirke('bold')}
					>
						B
					</Knopf>
				</Tooltip>
			)}
			<Tooltip text={underline.titel} kuerzel={kuerzelText(underline.kuerzel)}>
				<Knopf
					art="leise"
					groesse="klein"
					className={klassen(FORM, 'underline')}
					aria-label={underline.titel}
					aria-pressed={zustand.unterstrichen}
					{...halteFokus}
					onClick={() => wirke('underline')}
				>
					U
				</Knopf>
			</Tooltip>
			<Tooltip text="Markierten Text hervorheben; in s/w fett und unterstrichen">
				<Knopf
					art="leise"
					groesse="klein"
					className={FORM}
					aria-label="Hervorheben"
					{...halteFokus}
					onClick={() => wirke('mark')}
				>
					<Symbol name="markieren" />
				</Knopf>
			</Tooltip>
			{sitzung && zustand.farbe && <WortFarbe text={text} />}
		</div>
	);
};

/** In der Sitzung nur noch diese Schaltfläche neben den Schriftknöpfen (Entscheidung 11). */
export const TextFertig = ({ text }: { text: Text }) => (
	<Knopf art="leise" groesse="klein" {...halteFokus} onClick={text.beende}>
		<Symbol name="haken" />
		Fertig
	</Knopf>
);
