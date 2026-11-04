import type { Zeilen } from '@schoolbox/kern/src/bausteine';
import { zeilenVon } from '@schoolbox/kern/src/bausteine';

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
