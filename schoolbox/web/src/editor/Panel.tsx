import type { Zeilen } from '@schoolbox/kern/src/bausteine';
import { kann, zeilenVon } from '@schoolbox/kern/src/bausteine';
import type { MouseEvent, ReactNode } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';
import { TEXTWERKZEUG } from './text';
import type { Format, TextZustand } from './textdom';

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	/** Was die folgenden Issues hier einhängen: Text, Bilder, Abbildungen … */
	children?: ReactNode;
}

/** Rechts neben dem Blatt (iPad hoch: darunter): was gewählt ist und was sich damit tun lässt. */
export const AuswahlPanel = ({ children, pfad, waehle }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return (
			<div>
				<h2 className="text-xl">Auswahl</h2>
				<p className="mt-2 text-leise">
					Tippe auf einen Teil des Blatts, zum Beispiel eine Aufgabe oder eine Überschrift, um ihn
					auszuwählen.
				</p>
			</div>
		);
	}
	return (
		<div data-auswahl={gewaehlt.baustein.art}>
			<nav aria-label="Wo im Blatt" className="-ml-2 flex flex-wrap items-center" data-breadcrumb>
				{pfad.map((teil, i) => (
					<span key={teil.nr} className="flex items-center">
						{i > 0 && <span className="px-0.5 text-leise">›</span>}
						<button
							type="button"
							className="min-h-11 rounded-lg px-2 font-bold text-brand-600 hover:bg-brand-50 aria-[current=true]:text-tinte"
							aria-current={teil === gewaehlt}
							onClick={() => waehle(teil.nr)}
						>
							{teil.name}
						</button>
					</span>
				))}
			</nav>
			<h2 className="mt-2 text-xl">{gewaehlt.name}</h2>
			{children}
			<Knopf art="leise" className="mt-4 -ml-5" onClick={() => waehle(null)}>
				<Symbol name="schliessen" />
				Auswahl aufheben
			</Knopf>
		</div>
	);
};

const FERTIG: Record<Zeilen, string> = {
	eine: 'Fertig bist du mit ⏎ oder wenn du neben den Text tippst.',
	umbruch: '⏎ macht eine neue Zeile. Fertig bist du, wenn du neben den Text tippst.',
	absatz: '⏎ beginnt einen neuen Absatz. Fertig bist du, wenn du neben den Text tippst.',
};

/** Knöpfe, die beim Drücken den Cursor im Text lassen. */
const halteFokus = { [TEXTWERKZEUG]: '', onMouseDown: (e: MouseEvent) => e.preventDefault() };

interface TextEigenschaften {
	pfad: PfadTeil[];
	/** Nicht in der Vorschau einer Version und nicht bei einem Konflikt. */
	aktiv: boolean;
	bearbeitet: boolean;
	zustand: TextZustand;
	formatiere: (format: Format) => void;
	beende: () => void;
	fokussiere: () => void;
}

/** Für Textträger: Text ändern, dabei nur fett und unterstrichen; Schrift und Größe bestimmt das Blatt. */
export const Textwerkzeug = ({
	aktiv,
	bearbeitet,
	beende,
	fokussiere,
	formatiere,
	pfad,
	zustand,
}: TextEigenschaften) => {
	const baustein = pfad.at(-1)?.baustein;
	if (!aktiv || !baustein || !kann(baustein, 'text')) {
		return null;
	}
	if (!bearbeitet) {
		return (
			<div className="mt-3">
				<Knopf art="zweit" onClick={fokussiere}>
					<Symbol name="stift" />
					Text ändern
				</Knopf>
				<p className="mt-2 text-leise">Oder tippe noch einmal in den Text.</p>
			</div>
		);
	}
	return (
		<div className="mt-3" data-textbearbeitung>
			<div className="flex flex-wrap gap-2">
				<div role="group" aria-label="Schrift" className="flex gap-2">
					<Knopf
						art={zustand.fett ? 'haupt' : 'zweit'}
						className="w-12 px-0 text-lg font-black"
						aria-label="Fett"
						title={zustand.fettMoeglich ? 'Fett (⌘B)' : 'Dieser Text ist schon fett'}
						aria-pressed={zustand.fett}
						disabled={!zustand.fettMoeglich}
						{...halteFokus}
						onClick={() => formatiere('bold')}
					>
						B
					</Knopf>
					<Knopf
						art={zustand.unterstrichen ? 'haupt' : 'zweit'}
						className="w-12 px-0 text-lg underline"
						aria-label="Unterstrichen"
						title="Unterstrichen (⌘U)"
						aria-pressed={zustand.unterstrichen}
						{...halteFokus}
						onClick={() => formatiere('underline')}
					>
						U
					</Knopf>
				</div>
				<Knopf {...halteFokus} onClick={beende}>
					<Symbol name="haken" />
					Fertig
				</Knopf>
			</div>
			<p className="mt-2 text-leise">{FERTIG[zeilenVon(baustein)]}</p>
		</div>
	);
};
