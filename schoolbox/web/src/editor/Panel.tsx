import type { Zeilen } from '@schoolbox/kern/src/bausteine';
import { kann, zeilenVon } from '@schoolbox/kern/src/bausteine';
import { ABSTAND, SPALTEN } from '@schoolbox/kern/src/struktur';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';
import type { Spalten, Struktur } from './struktur';
import { TEXTWERKZEUG } from './text';
import type { Format, TextZustand } from './textdom';

interface Eigenschaften {
	pfad: PfadTeil[];
	waehle: (nr: number | null) => void;
	/** Was die folgenden Issues hier einhängen: Text, Bilder, Abbildungen … */
	children?: ReactNode;
	/** Ohne Auswahl: Einstellungen für das ganze Blatt. */
	leer?: ReactNode;
}

/** Rechts neben dem Blatt (iPad hoch: darunter): was gewählt ist und was sich damit tun lässt. */
export const AuswahlPanel = ({ children, leer, pfad, waehle }: Eigenschaften) => {
	const gewaehlt = pfad.at(-1);
	if (!gewaehlt) {
		return (
			<div>
				<h2 className="text-xl">Auswahl</h2>
				<p className="mt-2 text-leise">
					Tippe auf einen Teil des Blatts, zum Beispiel eine Aufgabe oder eine Überschrift, um ihn
					auszuwählen.
				</p>
				{leer}
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

interface StrukturEigenschaften {
	pfad: PfadTeil[];
	aktiv: boolean;
	struktur: Struktur;
}

const Spaltenwahl = ({ eigene, spalten, struktur }: { spalten: Spalten; eigene: boolean; struktur: Struktur }) => (
	<div>
		<h3 className="font-bold">{eigene ? 'Spalten' : `Spalten (${spalten.name})`}</h3>
		<div role="group" aria-label="Spalten" className="mt-2 flex items-center gap-2" data-spalten={spalten.wert}>
			<Knopf
				art="zweit"
				className="w-12 px-0"
				aria-label="Eine Spalte weniger"
				disabled={spalten.wert <= SPALTEN.min}
				onClick={() => struktur.spalten(spalten.nr, spalten.wert - 1)}
			>
				<Symbol name="minus" />
			</Knopf>
			<span className="min-w-8 text-center text-xl font-bold">{spalten.wert}</span>
			<Knopf
				art="zweit"
				className="w-12 px-0"
				aria-label="Eine Spalte mehr"
				disabled={spalten.wert >= SPALTEN.max}
				onClick={() => struktur.spalten(spalten.nr, spalten.wert + 1)}
			>
				<Symbol name="plus" />
			</Knopf>
		</div>
	</div>
);

/** Verschieben, Duplizieren, Löschen und Spalten für den gewählten Baustein. */
export const Strukturwerkzeug = ({ aktiv, pfad, struktur }: StrukturEigenschaften) => {
	const gewaehlt = pfad.at(-1);
	const w = struktur.werte;
	if (!aktiv || !gewaehlt || !w) {
		return null;
	}
	const { baustein, name, nr } = gewaehlt;
	const { nach } = w;
	const einzigeSeite = baustein.art === 'seite' && w.seiten <= 1;
	const loeschbar = kann(baustein, 'loeschen');
	return (
		<div className="mt-4 flex flex-col gap-5" data-struktur>
			{nach && (
				<div>
					<div role="group" aria-label="Verschieben" className="flex flex-wrap gap-2">
						<Knopf
							art="zweit"
							className="px-4"
							disabled={!nach.zurueck}
							onClick={() => nach.zurueck && struktur.verschiebe(nr, nach.zurueck, true)}
						>
							<Symbol name={nach.quer ? 'links' : 'hoch'} />
							{nach.quer ? 'Nach links' : 'Nach oben'}
						</Knopf>
						<Knopf
							art="zweit"
							className="px-4"
							disabled={!nach.vor}
							onClick={() => nach.vor && struktur.verschiebe(nr, nach.vor, true)}
						>
							<Symbol name={nach.quer ? 'rechts' : 'runter'} />
							{nach.quer ? 'Nach rechts' : 'Nach unten'}
						</Knopf>
					</div>
					<p className="mt-2 text-leise">
						{baustein.ordnenInLeiste
							? 'Oder links in der Seitenleiste gedrückt halten und ziehen.'
							: 'Oder im Blatt gedrückt halten und ziehen.'}
					</p>
				</div>
			)}
			{(kann(baustein, 'duplizieren') || loeschbar) && (
				<div className="flex flex-wrap gap-2">
					{kann(baustein, 'duplizieren') && (
						<Knopf art="zweit" onClick={() => struktur.dupliziere(nr)}>
							<Symbol name="kopieren" />
							Duplizieren
						</Knopf>
					)}
					{loeschbar && (
						<Knopf
							art="gefahr"
							disabled={einzigeSeite}
							title={einzigeSeite ? 'Die einzige Seite bleibt.' : undefined}
							onClick={() => struktur.loesche(nr, name)}
						>
							<Symbol name="papierkorb" />
							Löschen
						</Knopf>
					)}
				</div>
			)}
			{w.spalten && <Spaltenwahl spalten={w.spalten} eigene={w.spalten.nr === nr} struktur={struktur} />}
		</div>
	);
};

/**
 * Abstand zwischen den Aufgaben für das ganze Blatt. Beim Ziehen zeigt das Blatt den Abstand sofort, die Quelle
 * ändert sich erst beim Loslassen: ein Schritt zum Rückgängigmachen.
 */
export const Blattwerkzeug = ({ aktiv, struktur }: { aktiv: boolean; struktur: Struktur }) => {
	const wert = struktur.werte?.abstand ?? null;
	const [jetzt, setJetzt] = useState(wert ?? ABSTAND.min);
	const regler = useRef<HTMLInputElement>(null);
	const setze = useRef(struktur.abstand);

	useEffect(() => {
		setze.current = struktur.abstand;
	});

	useEffect(() => {
		if (wert !== null) {
			setJetzt(Math.max(ABSTAND.min, Math.min(ABSTAND.max, wert)));
		}
	}, [wert]);

	useEffect(() => {
		const element = regler.current;
		if (!element) {
			return undefined;
		}
		const fertig = () => setze.current(Number(element.value));
		element.addEventListener('change', fertig);
		return () => element.removeEventListener('change', fertig);
	}, [aktiv, wert]);

	if (!aktiv || wert === null) {
		return null;
	}
	return (
		<div className="mt-6 border-t border-rand pt-4" data-blatt>
			<h2 className="text-xl">Ganzes Blatt</h2>
			<label className="mt-3 block">
				<span className="flex justify-between font-bold">
					Abstand zwischen Aufgaben
					<span className="font-normal text-leise">{`${jetzt} px`}</span>
				</span>
				<input
					ref={regler}
					type="range"
					aria-label="Abstand zwischen Aufgaben"
					className="mt-2 h-11 w-full accent-brand-500"
					min={ABSTAND.min}
					max={ABSTAND.max}
					step={ABSTAND.schritt}
					value={jetzt}
					onChange={(e) => {
						const px = Number(e.target.value);
						setJetzt(px);
						struktur.zeigeAbstand(px);
					}}
				/>
			</label>
		</div>
	);
};
