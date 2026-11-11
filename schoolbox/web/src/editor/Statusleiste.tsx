import { useEffect, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { halteFokus } from './halteFokus';
import { Pruefstatus } from './Pruefliste';
import type { Pruefpunkt, Pruefstand } from './pruefung';
import type { ZoomWert } from './zoom';
import { naechsteStufe } from './zoom';

const KNOPF =
	'inline-flex h-knopf-status flex-none items-center gap-1 rounded-sm px-1 text-xs text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40 disabled:hover:bg-transparent';

interface ZoomEigenschaften {
	zoom: ZoomWert;
	/** Der wirksame Faktor, auch beim Einpassen. */
	stufe: number;
	/** Der echte Maßstab des Blatts. */
	skala: number;
	fuehreAus: (id: string) => unknown;
}

const Zoom = ({ fuehreAus, skala, stufe, zoom }: ZoomEigenschaften) => {
	const kleiner = naechsteStufe(stufe, -1);
	const groesser = naechsteStufe(stufe, 1);
	return (
		<div className="flex items-center gap-0.5" role="group" aria-label="Größe">
			<Tooltip text="Kleiner">
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
			<Tooltip text="Auf 100 %">
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
			<Tooltip text="Größer">
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
			<button
				type="button"
				className={klassen(KNOPF, 'aria-pressed:text-tinte')}
				aria-pressed={zoom === 'einpassen'}
				onClick={() => fuehreAus('ansicht.einpassen')}
			>
				<Symbol name="vollbild" className="size-3 flex-none" />
				Einpassen
			</button>
		</div>
	);
};

/** Was eingeklappte Gespräche gerade tun (135); `mehrere` zählt sie. */
export interface ClaudeLauf {
	art: 'arbeitet' | 'bereit' | 'antwort' | 'mehrere';
	/** Beginn in ms; zählt die Zeit in der Statusleiste. 0: unbekannt. */
	seit: number;
	anzahl: number;
}

const laufTitel = (lauf: ClaudeLauf, sekunden: number) => {
	if (lauf.art === 'arbeitet') {
		return lauf.seit > 0
			? `Claude arbeitet … ${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`
			: 'Claude arbeitet …';
	}
	return { bereit: 'Vorschlag bereit', antwort: 'Claude hat geantwortet', mehrere: `${lauf.anzahl} Aufträge` }[
		lauf.art
	];
};

/** Für eingeklappte Gespräche, deren Element außer Sicht sein kann: Ein Klick rollt hin und klappt die Blase auf. */
const ClaudeStand = ({ lauf, oeffne }: { lauf: ClaudeLauf; oeffne: () => void }) => {
	const [jetzt, setJetzt] = useState(() => Date.now());
	useEffect(() => {
		if (lauf.art !== 'arbeitet') {
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
			<Symbol name={lauf.art === 'arbeitet' ? 'laden' : 'funken'} className="size-3 flex-none" />
			{laufTitel(lauf, sekunden)}
		</button>
	);
};

interface Eigenschaften extends ZoomEigenschaften {
	/** Nur bei geschlossenem Chat gesetzt. */
	claude: ClaudeLauf | null;
	zeigeClaude: () => void;
	seite: { nr: number; von: number };
	format: string;
	pruefung: Pruefstand | null;
	zeigePunkt: (p: Pruefpunkt) => void;
	verschiebe?: ((p: Pruefpunkt) => void) | undefined;
	linksOffen: boolean;
	rechtsOffen: boolean;
	setLinksOffen: (offen: boolean) => void;
	setRechtsOffen: (offen: boolean) => void;
}

/** Unterste Zeile des Editors: wo man ist, ob alles passt, wie groß das Blatt gezeigt wird. */
export const Statusleiste = ({
	claude,
	format,
	fuehreAus,
	linksOffen,
	pruefung,
	rechtsOffen,
	seite,
	setLinksOffen,
	setRechtsOffen,
	skala,
	stufe,
	verschiebe,
	zeigeClaude,
	zeigePunkt,
	zoom,
}: Eigenschaften) => (
	<footer
		className="z-leiste grid min-h-6 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-rand bg-flaeche px-1 text-xs text-leise"
		data-statusleiste
	>
		<div className="flex min-w-0 items-center gap-2">
			<Tooltip text="Linke Leiste">
				<button
					type="button"
					className={klassen(KNOPF, 'aria-pressed:text-tinte')}
					aria-label="Linke Leiste"
					aria-pressed={linksOffen}
					onClick={() => setLinksOffen(!linksOffen)}
				>
					<Symbol name="leisteLinks" className="flex-none" />
				</button>
			</Tooltip>
			<span className="truncate" data-seite-von>{`Seite ${seite.nr} von ${seite.von} · ${format}`}</span>
			<Pruefstatus stand={pruefung} zeige={zeigePunkt} verschiebe={verschiebe} />
			{claude && <ClaudeStand lauf={claude} oeffne={zeigeClaude} />}
		</div>
		<Zoom zoom={zoom} stufe={stufe} skala={skala} fuehreAus={fuehreAus} />
		<div className="flex items-center justify-end gap-2">
			<button
				type="button"
				className={KNOPF}
				data-palette-knopf
				{...halteFokus}
				onClick={() => fuehreAus('ansicht.palette')}
			>
				<Symbol name="suche" className="size-3 flex-none" />
				Befehle
				<Kuerzel text="⌘K" />
			</button>
			<button type="button" className={KNOPF} data-tasten-knopf onClick={() => fuehreAus('ansicht.tasten')}>
				<Symbol name="hilfe" className="size-3 flex-none" />
				Tasten
			</button>
			<Tooltip text="Rechte Leiste">
				<button
					type="button"
					className={klassen(KNOPF, 'aria-pressed:text-tinte')}
					aria-label="Rechte Leiste"
					aria-pressed={rechtsOffen}
					onClick={() => setRechtsOffen(!rechtsOffen)}
				>
					<Symbol name="leisteRechts" className="flex-none" />
				</button>
			</Tooltip>
		</div>
	</footer>
);
