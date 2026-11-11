import type { KeyboardEvent, MouseEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import type { PalettenEintrag } from './palette-suche';
import { gruppiere, merkeBenutzt, startliste, suchePalette, zuletztBenutzt } from './palette-suche';
import { TEXTWERKZEUG } from './text';

interface Eigenschaften {
	eintraege: readonly PalettenEintrag[];
	platzhalter: string;
	/**
	 * Letzte Zeile, sobald etwas getippt ist: im Editor „An Claude schicken“ (füllt das Feld der Blase, abgeschickt wird
	 * von Hand), sonst „Material anlegen“ mit dem Text als Thema (136).
	 */
	freitext?: { titel: (text: string) => string; aus: (text: string) => void } | undefined;
	/** `true`: Es folgt gleich die Aktion der Zeile. */
	schliessen: (ausgefuehrt: boolean) => void;
}

const gibFokusZurueck = (ziel: Element | null) => {
	if (ziel instanceof HTMLIFrameElement) {
		ziel.contentWindow?.focus();
	} else if (ziel instanceof HTMLElement && ziel.isConnected) {
		ziel.focus();
	}
};

/** Das Sicherheitsnetz: Wer etwas nicht findet, tippt es. Die Zeilen zeigen nebenbei die Tasten. */
export const Palette = ({ eintraege, freitext, platzhalter, schliessen }: Eigenschaften) => {
	const dialog = useRef<HTMLDialogElement>(null);
	const feld = useRef<HTMLInputElement>(null);
	const ausloeser = useRef<Element | null>(null);
	const offen = useRef(true);
	const liste = useRef<HTMLDivElement>(null);
	const id = useId();
	const [anfrage, setAnfrage] = useState('');
	const [stelle, setStelle] = useState(0);
	const [zuletzt] = useState(zuletztBenutzt);

	const gruppen = useMemo(() => {
		const text = anfrage.trim();
		const treffer = gruppiere(text ? suchePalette(anfrage, eintraege, zuletzt) : startliste(eintraege, zuletzt));
		if (!text || !freitext) {
			return treffer;
		}
		const zeile: PalettenEintrag = {
			id: 'claude:schicken',
			titel: freitext.titel(text),
			gruppe: 'Claude',
			symbol: 'funken',
			suchwoerter: [],
			aus: () => freitext.aus(text),
		};
		return [...treffer, { titel: 'Claude', eintraege: [zeile] }];
	}, [anfrage, eintraege, freitext, zuletzt]);
	const zeilen = useMemo(() => gruppen.flatMap((g) => g.eintraege), [gruppen]);
	const aktiv = zeilen[Math.min(stelle, zeilen.length - 1)];

	useEffect(() => {
		const element = dialog.current;
		if (!element || element.open) {
			return;
		}
		ausloeser.current = document.activeElement;
		element.showModal();
		feld.current?.focus();
	}, []);

	const aktivId = aktiv?.id;
	useEffect(() => {
		liste.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
	}, [aktivId]);

	const zu = (ausgefuehrt: boolean) => {
		if (!offen.current) {
			return;
		}
		offen.current = false;
		dialog.current?.close();
		gibFokusZurueck(ausloeser.current);
		schliessen(ausgefuehrt);
	};

	const fuehreAus = (e: PalettenEintrag) => {
		merkeBenutzt(e.id);
		zu(true);
		// Erst wenn der Dialog weg ist: Die Aktion setzt den Fokus vielleicht selbst.
		window.setTimeout(e.aus);
	};

	const taste = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.nativeEvent.isComposing) {
			return;
		}
		const anzahl = zeilen.length;
		const jetzt = Math.min(stelle, anzahl - 1);
		if (e.key === 'ArrowDown' && anzahl > 0) {
			e.preventDefault();
			setStelle((jetzt + 1) % anzahl);
		} else if (e.key === 'ArrowUp' && anzahl > 0) {
			e.preventDefault();
			setStelle((jetzt - 1 + anzahl) % anzahl);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (aktiv) {
				fuehreAus(aktiv);
			}
		} else if (e.key === 'Tab') {
			e.preventDefault();
		} else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
			e.preventDefault();
			zu(false);
		}
	};

	const daneben = (e: MouseEvent<HTMLDialogElement>) => {
		if (e.target === dialog.current) {
			zu(false);
		}
	};

	const zeileId = (nr: number) => `${id}-z${nr}`;
	let nr = -1;
	return (
		<dialog
			ref={dialog}
			{...{ [TEXTWERKZEUG]: '' }}
			className="mx-auto mt-24 mb-auto w-[min(35rem,calc(100vw-2rem))] overflow-hidden rounded-[10px] bg-flaeche p-0 text-sm text-tinte shadow-2 backdrop:bg-tinte/20"
			aria-label="Befehle"
			data-befehlspalette
			onClose={() => zu(false)}
			onClick={daneben}
		>
			<div className="flex h-[38px] items-center gap-2 border-b border-rand px-3 [@media(any-pointer:coarse)]:h-11">
				<Symbol name="suche" className="size-4 flex-none text-leise" />
				<input
					ref={feld}
					type="text"
					role="combobox"
					aria-expanded
					aria-controls={`${id}-liste`}
					aria-activedescendant={aktiv ? zeileId(Math.min(stelle, zeilen.length - 1)) : undefined}
					aria-autocomplete="list"
					aria-label={platzhalter}
					className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-leise"
					placeholder={platzhalter}
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					value={anfrage}
					onChange={(e) => {
						setAnfrage(e.target.value);
						setStelle(0);
					}}
					onKeyDown={taste}
				/>
			</div>
			<div
				ref={liste}
				id={`${id}-liste`}
				role="listbox"
				aria-label="Treffer"
				className="max-h-[min(calc(10*var(--hoehe-zeile)),calc(100dvh-13rem))] overflow-y-auto py-1"
				onMouseDown={(e) => e.preventDefault()}
			>
				{zeilen.length === 0 && <p className="px-3 py-2 text-leise">Nichts gefunden.</p>}
				{gruppen.map((g) => (
					<div key={g.titel} role="group" aria-label={g.titel} data-palette-gruppe={g.titel}>
						<div className="px-3 pt-1.5 pb-0.5 text-xs text-dezent" aria-hidden>
							{g.titel}
						</div>
						{g.eintraege.map((e) => {
							nr += 1;
							const hier = nr;
							const gewaehlt = e.id === aktiv?.id;
							return (
								<div
									key={e.id}
									id={zeileId(hier)}
									role="option"
									aria-selected={gewaehlt}
									data-palette-zeile={e.id}
									className={klassen(
										'flex h-zeile cursor-default items-center gap-2 px-3',
										gewaehlt && 'bg-brand-50',
									)}
									onPointerMove={() => setStelle(hier)}
									onClick={() => fuehreAus(e)}
								>
									<span className="flex size-4 flex-none items-center justify-center text-leise">
										{e.symbol && <Symbol name={e.symbol} className="size-3.5" />}
									</span>
									<span className="min-w-0 truncate">{e.titel}</span>
									{e.notiz && (
										<span className="min-w-0 flex-none truncate text-xs text-dezent">
											{e.notiz}
										</span>
									)}
									{e.kuerzel && <Kuerzel text={e.kuerzel} className="ml-auto flex-none pl-3" />}
								</div>
							);
						})}
					</div>
				))}
			</div>
			<div className="flex h-6 items-center gap-3 border-t border-rand px-3 text-xs text-dezent" aria-hidden>
				<span>↑↓ wählen</span>
				<span>⏎ ausführen</span>
				<span>esc schließen</span>
			</div>
		</dialog>
	);
};
