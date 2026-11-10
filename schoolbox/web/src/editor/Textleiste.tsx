import type { Zeilen } from '@schoolbox/kern/src/bausteine';
import { zeilenVon } from '@schoolbox/kern/src/bausteine';
import { BLATT_FARBEN, WEISS } from '@schoolbox/kern/src/blatt-farben';
import { useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';
import { halteFokus } from './halteFokus';
import type { useText } from './text';

type Text = ReturnType<typeof useText>;

const FERTIG: Record<Zeilen, string> = {
	eine: '⏎ schließt die Bearbeitung ab',
	umbruch: '⏎ macht eine neue Zeile. Fertig bist du auch, wenn du neben den Text tippst',
	absatz: '⏎ beginnt einen neuen Absatz. Fertig bist du auch, wenn du neben den Text tippst',
};

const FORM = 'size-knopf-klein px-0 aria-pressed:bg-flaeche-2 aria-pressed:text-tinte';

// Farbe für Wörter
const PUNKT =
	'flex size-knopf-klein flex-none items-center justify-center rounded-full border border-rand p-0.5 hover:border-tinte';

/** Wie die Variable im Material aussieht; ohne Material ein neutrales Grau. */
const farbeIm = (doc: Document | null, variable: string) => {
	const body = doc?.body;
	return (body && doc.defaultView?.getComputedStyle(body).getPropertyValue(variable).trim()) || '#999999';
};

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
			<Knopf
				art="leise"
				groesse="klein"
				className={FORM}
				aria-label="Farbe für markierte Wörter"
				title="Farbe für markierte Wörter"
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
			{offen && (
				<div role="group" aria-label="Farbe für markierte Wörter" className="flex items-center gap-0.5">
					{[
						...BLATT_FARBEN.map((f) => ({
							wert: f.wert,
							name: f.name,
							zeige: farbeIm(text.doc, f.variable),
						})),
						{ wert: WEISS, name: 'Weiß', zeige: WEISS },
					].map((f) => (
						<button
							key={f.wert}
							type="button"
							className={PUNKT}
							aria-label={f.name}
							title={f.name}
							data-farbe={f.wert}
							{...halteFokus}
							onClick={() => waehle(f.wert)}
						>
							<span
								aria-hidden
								className="block size-full min-h-4 rounded-full border border-black/10"
								style={{ background: f.zeige }}
							/>
						</button>
					))}
					<Knopf
						art="leise"
						groesse="klein"
						title="Farbe der Schrift wie der Rest"
						data-farbe="ohne"
						{...halteFokus}
						onClick={() => waehle(null)}
					>
						Ohne
					</Knopf>
				</div>
			)}
		</div>
	);
};

/**
 * Fett, Unterstrichen, Hervorheben stehen vor und während des Tippens an derselben Stelle. Ohne Sitzung wirken sie auf
 * den ganzen Text und starten die Sitzung, damit `halteFokus` und ein Schritt im Verlauf für beide Wege gelten.
 */
export const Textknoepfe = ({ sitzung, text }: { sitzung: boolean; text: Text }) => {
	const { formatiere, formatiereGanz, zustand } = text;
	const wirke = sitzung ? formatiere : formatiereGanz;
	return (
		<div role="group" aria-label="Schrift" className="flex items-center gap-0.5" data-textknoepfe>
			<Knopf
				art="leise"
				groesse="klein"
				className={klassen(FORM, 'font-semibold')}
				aria-label="Fett"
				title={zustand.fettMoeglich ? 'Fett (⌘B)' : 'Dieser Text ist schon fett'}
				aria-pressed={zustand.fett}
				disabled={!zustand.fettMoeglich}
				{...halteFokus}
				onClick={() => wirke('bold')}
			>
				B
			</Knopf>
			<Knopf
				art="leise"
				groesse="klein"
				className={klassen(FORM, 'underline')}
				aria-label="Unterstrichen"
				title="Unterstrichen (⌘U)"
				aria-pressed={zustand.unterstrichen}
				{...halteFokus}
				onClick={() => wirke('underline')}
			>
				U
			</Knopf>
			<Knopf
				art="leise"
				groesse="klein"
				className={FORM}
				aria-label="Hervorheben"
				title="Markierten Text hervorheben; in s/w fett und unterstrichen"
				{...halteFokus}
				onClick={() => wirke('mark')}
			>
				<Symbol name="markieren" />
			</Knopf>
			{sitzung && zustand.farbe && <WortFarbe text={text} />}
		</div>
	);
};

/** In der Sitzung nur noch diese Schaltfläche neben den Schriftknöpfen (Entscheidung 11). */
export const TextFertig = ({ pfad, text }: { pfad: PfadTeil[]; text: Text }) => {
	const baustein = pfad.at(-1)?.baustein;
	return (
		<Knopf
			art="leise"
			groesse="klein"
			title={baustein ? FERTIG[zeilenVon(baustein)] : undefined}
			{...halteFokus}
			onClick={text.beende}
		>
			<Symbol name="haken" />
			Fertig
		</Knopf>
	);
};
