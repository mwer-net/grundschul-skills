import { useEffect, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { seitenWort } from '../lib/text';
import { kuerzelVon } from './befehle';
import type { FadenStand } from './claude-faeden';
import { standText } from './claude-faeden';
import { halteFokus } from './halteFokus';
import type { PruefKnopf } from './Pruefliste';
import { Pruefstatus } from './Pruefliste';
import type { Pruefpunkt, Pruefstand } from './pruefung';
import type { ZoomWert } from './zoom';
import { naechsteStufe } from './zoom';

const KNOPF =
	'inline-flex h-knopf-status flex-none items-center gap-1 rounded-sm px-1 text-xs text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40 disabled:hover:bg-transparent';

interface ZoomEigenschaften {
	zoom: ZoomWert;
	/** Der echte Maßstab des Blatts, auch beim Einpassen. */
	skala: number;
	fuehreAus: (id: string) => unknown;
}

const Zoom = ({ fuehreAus, skala, zoom }: ZoomEigenschaften) => {
	const kleiner = naechsteStufe(skala, -1);
	const groesser = naechsteStufe(skala, 1);
	return (
		<div className="flex items-center gap-0.5" role="group" aria-label="Größe">
			<Tooltip text="Kleiner" kuerzel={kuerzelVon('ansicht.zoom-raus')}>
				<button
					type="button"
					className={KNOPF}
					aria-label="Kleiner"
					disabled={kleiner === undefined}
					onClick={() => fuehreAus('ansicht.zoom-raus')}
				>
					<Symbol name="minus" className="size-3 flex-none" />
				</button>
			</Tooltip>
			<Tooltip text="Auf 100 %" kuerzel={kuerzelVon('ansicht.zoom-100')}>
				<button
					type="button"
					className={klassen(
						KNOPF,
						'min-w-[max(40px,var(--hoehe-knopf-status))] justify-center tabular-nums',
					)}
					data-zoom-wert
					onClick={() => fuehreAus('ansicht.zoom-100')}
				>
					{`${Math.round(skala * 100)} %`}
				</button>
			</Tooltip>
			<Tooltip text="Größer" kuerzel={kuerzelVon('ansicht.zoom-rein')}>
				<button
					type="button"
					className={KNOPF}
					aria-label="Größer"
					disabled={groesser === undefined}
					onClick={() => fuehreAus('ansicht.zoom-rein')}
				>
					<Symbol name="plus" className="size-3 flex-none" />
				</button>
			</Tooltip>
			<Tooltip text="Einpassen" kuerzel={kuerzelVon('ansicht.einpassen')}>
				<button
					type="button"
					className={klassen(KNOPF, 'aria-pressed:text-tinte')}
					aria-pressed={zoom === 'einpassen'}
					onClick={() => fuehreAus('ansicht.einpassen')}
				>
					<Symbol name="vollbild" className="size-3 flex-none" />
					Einpassen
				</button>
			</Tooltip>
		</div>
	);
};

/** Was eingeklappte Gespräche gerade tun (135); `mehrere` zählt sie. */
export interface ClaudeLauf {
	art: Exclude<FadenStand, 'ruhig'> | 'mehrere';
	/** Der Name des Elements wie in der Pille (200-08). */
	bezug: string;
	/** Beginn in ms; zählt die Zeit in der Statusleiste. 0: unbekannt. */
	seit: number;
	anzahl: number;
}

const laufTitel = (lauf: ClaudeLauf, sekunden: number) =>
	lauf.art === 'mehrere'
		? `${lauf.anzahl} Aufträge`
		: standText(lauf.art, lauf.bezug, lauf.art === 'laeuft' && lauf.seit > 0 ? sekunden : null);

/** Für eingeklappte Gespräche, deren Element außer Sicht sein kann: Ein Klick rollt hin und klappt die Blase auf. */
const ClaudeStand = ({ lauf, oeffne }: { lauf: ClaudeLauf; oeffne: () => void }) => {
	const [jetzt, setJetzt] = useState(() => Date.now());
	useEffect(() => {
		if (lauf.art !== 'laeuft') {
			return undefined;
		}
		const uhr = window.setInterval(() => setJetzt(Date.now()), 1000);
		return () => window.clearInterval(uhr);
	}, [lauf.art]);
	const sekunden = Math.max(0, Math.round((jetzt - lauf.seit) / 1000));
	return (
		<button
			type="button"
			className={klassen(KNOPF, 'text-brand-700 tabular-nums')}
			data-claude-stand={lauf.art}
			onClick={oeffne}
		>
			<Symbol name={lauf.art === 'laeuft' || lauf.art === 'wartet' ? 'laden' : 'funken'} className="size-3 flex-none" />
			{laufTitel(lauf, sekunden)}
		</button>
	);
};

interface Eigenschaften extends ZoomEigenschaften {
	/** Nur bei geschlossenem Chat gesetzt. */
	claude: ClaudeLauf | null;
	zeigeClaude: () => void;
	seite: { nr: number; von: number };
	/** Bis das Blatt geladen ist, steht nur das Format da (193-21): Die Seitenzahl wäre noch falsch. */
	blattGeladen: boolean;
	/** Der angezeigte Name des Formats, z. B. „Folien 16:9“. */
	format: string;
	/** Folien zählen „Folie 3 von 6“ (192-12). */
	folien: boolean;
	pruefung: Pruefstand | null;
	zeigePunkt: (p: Pruefpunkt) => void;
	knopf?: ((p: Pruefpunkt) => PruefKnopf | null) | undefined;
	rechtsOffen: boolean;
	setRechtsOffen: (offen: boolean) => void;
}

/** Unterste Zeile des Editors: wo man ist, ob alles passt, wie groß das Blatt gezeigt wird. */
export const Statusleiste = ({
	blattGeladen,
	claude,
	folien,
	format,
	fuehreAus,
	pruefung,
	rechtsOffen,
	seite,
	setRechtsOffen,
	skala,
	knopf,
	zeigeClaude,
	zeigePunkt,
	zoom,
}: Eigenschaften) => (
	<footer
		className="z-leiste grid min-h-6 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-rand bg-flaeche px-1 text-xs text-leise"
		data-statusleiste
	>
		{/* 193-35: Zu- und Aufklappen liegt am Symbol der Schubladenleiste, nicht noch einmal hier. */}
		<div className="flex min-w-0 items-center gap-2 pl-1">
			<span className="truncate" data-seite-von>
				{blattGeladen ? `${seitenWort(folien)} ${seite.nr} von ${seite.von} · ${format}` : format}
			</span>
			<Pruefstatus stand={pruefung} zeige={zeigePunkt} knopf={knopf} />
			{claude && <ClaudeStand lauf={claude} oeffne={zeigeClaude} />}
		</div>
		<Zoom zoom={zoom} skala={skala} fuehreAus={fuehreAus} />
		<div className="flex items-center justify-end gap-2">
			<Tooltip text="Befehle" kuerzel={kuerzelVon('ansicht.palette')}>
				<button
					type="button"
					className={KNOPF}
					data-palette-knopf
					{...halteFokus}
					onClick={() => fuehreAus('ansicht.palette')}
				>
					<Symbol name="suche" className="size-3 flex-none" />
					Befehle
				</button>
			</Tooltip>
			<Tooltip text="Tasten" kuerzel={kuerzelVon('ansicht.tasten')}>
				<button type="button" className={KNOPF} data-tasten-knopf onClick={() => fuehreAus('ansicht.tasten')}>
					<Symbol name="hilfe" className="size-3 flex-none" />
					Tasten
				</button>
			</Tooltip>
			<Tooltip text="Rechte Leiste" kuerzel={kuerzelVon('ansicht.inspektor')}>
				<button
					type="button"
					className={klassen(KNOPF, 'aria-pressed:text-tinte')}
					aria-label="Rechte Leiste"
					aria-pressed={rechtsOffen}
					onClick={() => setRechtsOffen(!rechtsOffen)}
				>
					<Symbol name="leisteRechts" className="size-3.5 flex-none" />
				</button>
			</Tooltip>
		</div>
	</footer>
);
