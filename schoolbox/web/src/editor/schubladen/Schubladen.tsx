import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useRef } from 'react';

import { Schubladenleiste } from '../../bausteine/Schubladenleiste';
import { folgeZeiger } from '../../bausteine/zeigerzug';
import { kuerzelText } from '../befehle';
import { halteFokus } from '../halteFokus';
import type { Panels } from '../panels';
import type { SchubladenId, SchubladenLage, SchubladenTeile } from '.';
import { SCHUBLADEN, schubladeVon } from '.';

const SCHRITT = 0.05;

/** Ziehbarer Teiler zwischen offener Schublade (oben) und angehefteten Ebenen (unten); ↑↓ gehen auch. */
const Teiler = ({
	setTeilung,
	spalte,
	teilung,
}: {
	spalte: RefObject<HTMLDivElement | null>;
	teilung: number;
	setTeilung: (wert: number, merken: boolean) => void;
}) => {
	const start = (e: ReactPointerEvent<HTMLDivElement>) => {
		const rahmen = spalte.current?.getBoundingClientRect();
		if (!rahmen || rahmen.height <= 0) {
			return;
		}
		e.preventDefault();
		const vorher = teilung;
		let jetzt = vorher;
		const zurueck = () => {
			ende();
			setTeilung(vorher, false);
		};
		const ende = folgeZeiger({
			bewegen: (m) => {
				jetzt = (m.clientY - rahmen.top) / rahmen.height;
				setTeilung(jetzt, false);
			},
			los: () => {
				ende();
				setTeilung(jetzt, true);
			},
			abbruch: zurueck,
			taste: (k) => {
				if (k.key === 'Escape') {
					k.preventDefault();
					k.stopPropagation();
					zurueck();
				}
			},
			bild: () => undefined,
			sperrtRollen: () => true,
		});
	};
	const taste = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			setTeilung(teilung + (e.key === 'ArrowUp' ? -SCHRITT : SCHRITT), true);
		}
	};
	return (
		<div
			role="separator"
			aria-orientation="horizontal"
			aria-label="Teilung zwischen Schublade und Ebenen"
			aria-valuemin={20}
			aria-valuemax={80}
			aria-valuenow={Math.round(teilung * 100)}
			tabIndex={0}
			className="group flex h-3 flex-none cursor-row-resize touch-none items-center justify-center border-y border-rand bg-flaeche-2 hover:bg-brand-50 focus-visible:bg-brand-50 [@media(any-pointer:coarse)]:h-6"
			data-teiler
			onPointerDown={start}
			onKeyDown={taste}
		>
			<span className="h-0.5 w-8 rounded-full bg-dezent group-hover:bg-brand-500" />
		</div>
	);
};

interface Eigenschaften {
	panels: Panels;
	lage: SchubladenLage;
	/** Warum das Blatt gerade gesperrt ist (133); steht über der offenen Schublade. */
	grund?: string | null;
	teile: SchubladenTeile;
	/** Über das Befehlsregister, damit Klick und Taste dasselbe tun. */
	waehle: (id: SchubladenId) => void;
}

/**
 * Links im Editor: die Leiste mit allen bereiten Schubladen und daneben die offene in der Breite der früheren linken
 * Spalte. Angeheftete Ebenen stehen unter der offenen Schublade, getrennt durch einen ziehbaren Teiler.
 */
export const Schubladen = ({ grund = null, lage, panels, teile, waehle }: Eigenschaften) => {
	const spalte = useRef<HTMLDivElement>(null);
	const sichtbar = SCHUBLADEN.filter((s) => s.bereit(lage));
	// Was gerade nicht bereit ist (Bausteine ohne Bearbeiten), führt zu den Ebenen statt ins Leere.
	const offen = panels.linksOffen
		? (sichtbar.find((s) => s.id === panels.links) ?? schubladeVon('ebenen') ?? null)
		: null;
	const ebenen = panels.angeheftet && offen?.id !== 'ebenen' ? schubladeVon('ebenen') : undefined;
	const Offen = offen?.Inhalt;
	const Ebenen = ebenen?.Inhalt;
	const geteilt = Boolean(Offen && Ebenen);

	return (
		<>
			<Schubladenleiste
				eintraege={sichtbar.map((s) => ({
					id: s.id,
					titel: s.titel,
					symbol: s.symbol,
					kuerzel: kuerzelText({ code: s.taste, wahl: true }),
					trenner: s.id === 'ebenen',
				}))}
				offen={offen?.id ?? null}
				waehle={waehle}
				knopf={halteFokus}
			/>
			{(Offen || Ebenen) && (
				<div
					ref={spalte}
					className="flex min-h-0 w-60 flex-none flex-col border-r border-rand bg-flaeche"
					{...(offen ? { 'data-panel-links': offen.id } : {})}
					{...(Ebenen ? { 'data-ebenen-angeheftet': '' } : {})}
				>
					{grund && (
						<p className="flex-none border-b border-rand px-3 py-2 text-xs text-leise" data-sperre-grund>
							{grund}
						</p>
					)}
					{geteilt && Offen && Ebenen ? (
						<>
							<div
								className="flex min-h-0 flex-col"
								style={{ flex: `${panels.teilung} 1 0%` }}
								data-schublade-oben
							>
								<Offen {...teile} />
							</div>
							<Teiler spalte={spalte} teilung={panels.teilung} setTeilung={panels.setTeilung} />
							<div
								className="flex min-h-0 flex-col"
								style={{ flex: `${1 - panels.teilung} 1 0%` }}
								data-schublade-unten
							>
								<Ebenen {...teile} />
							</div>
						</>
					) : (
						(Offen && <Offen {...teile} />) || (Ebenen && <Ebenen {...teile} />)
					)}
				</div>
			)}
		</>
	);
};
