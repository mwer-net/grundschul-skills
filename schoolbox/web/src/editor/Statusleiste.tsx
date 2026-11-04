import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Kuerzel } from '../bausteine/Kuerzel';
import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import type { ChatLauf } from './chat-kontext';
import { halteFokus } from './halteFokus';
import type { Pruefpunkt, Pruefstand } from './pruefung';
import { Pruefstatus } from './Pruefliste';

const ZOOM_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEICHER_ZOOM = 'schoolbox-zoom';

export type ZoomWert = number | 'einpassen';

export const gemerkterZoom = (): ZoomWert => {
	const wert = localStorage.getItem(SPEICHER_ZOOM);
	if (wert === 'einpassen') {
		return wert;
	}
	return ZOOM_STUFEN.find((s) => String(s) === wert) ?? 1;
};

export const merkeZoom = (wert: ZoomWert) => localStorage.setItem(SPEICHER_ZOOM, String(wert));

/** Eingepasste Werte liegen zwischen den Stufen; darum zählt der Wert selbst, nicht sein Platz in der Liste. */
export const naechsteStufe = (wert: number, richtung: 1 | -1) =>
	richtung > 0 ? ZOOM_STUFEN.find((s) => s > wert + 0.001) : ZOOM_STUFEN.findLast((s) => s < wert - 0.001);

const KNOPF =
	'inline-flex h-knopf-status flex-none items-center gap-1 rounded-sm px-1 text-xs text-leise hover:bg-flaeche-2 hover:text-tinte disabled:opacity-40 disabled:hover:bg-transparent';

/** Die Seite, deren Fläche der Mitte des Sichtfelds am nächsten liegt. Folgt dem Rollen. */
export const useSichtbareSeite = (doc: Document | null, ansicht: RefObject<HTMLElement | null>, stand: unknown) => {
	const [seite, setSeite] = useState({ nr: 1, von: 1 });
	useEffect(() => {
		const element = ansicht.current;
		const rahmen = doc?.defaultView?.frameElement;
		if (!doc || !element || !(rahmen instanceof HTMLElement)) {
			return undefined;
		}
		const pruefe = () => {
			const r = rahmen.getBoundingClientRect();
			const skala = r.width / (rahmen.offsetWidth || 1);
			const sicht = element.getBoundingClientRect();
			const mitte = (sicht.top + sicht.bottom) / 2;
			const seiten = [...doc.querySelectorAll('.seite')];
			const abstaende = seiten.map((s) => {
				const b = s.getBoundingClientRect();
				return Math.max(0, r.top + b.top * skala - mitte, mitte - (r.top + b.bottom * skala));
			});
			const nr = abstaende.indexOf(Math.min(...abstaende)) + 1;
			const von = Math.max(1, seiten.length);
			setSeite((alt) => (alt.nr === nr && alt.von === von ? alt : { nr: Math.max(1, nr), von }));
		};
		pruefe();
		element.addEventListener('scroll', pruefe, { passive: true });
		return () => element.removeEventListener('scroll', pruefe);
	}, [doc, ansicht, stand]);
	return seite;
};

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
					className={klassen(KNOPF, 'min-w-10 justify-center tabular-nums')}
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

/** Bei geschlossenem Chat sagt die Leiste, was Claude tut. Ein Klick öffnet den Chat. */
const ClaudeStand = ({ lauf, oeffne }: { lauf: ChatLauf; oeffne: () => void }) => {
	const [jetzt, setJetzt] = useState(() => Date.now());
	useEffect(() => {
		if (lauf.art !== 'arbeitet') {
			return undefined;
		}
		const uhr = window.setInterval(() => setJetzt(Date.now()), 1000);
		return () => window.clearInterval(uhr);
	}, [lauf.art]);
	const sekunden = Math.max(0, Math.round((jetzt - lauf.seit) / 1000));
	const titel = {
		arbeitet: `Claude arbeitet … ${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`,
		bereit: 'Vorschlag bereit',
		antwort: 'Claude hat geantwortet',
	}[lauf.art];
	return (
		<button type="button" className={klassen(KNOPF, 'text-brand-700 tabular-nums')} data-claude-stand={lauf.art} onClick={oeffne}>
			<Symbol name={lauf.art === 'arbeitet' ? 'laden' : 'sprechblase'} className="size-3 flex-none" />
			{titel}
		</button>
	);
};

const NEU_GESEHEN = 'schoolbox-neu-gesehen';

/** Einmal nach dem Umbau: Wer die Werkzeuge rechts sucht, findet hier den Weg. Liegt im Fluss, verdeckt also nichts. */
const NeuHinweis = () => {
	const [offen, setOffen] = useState(() => !localStorage.getItem(NEU_GESEHEN));
	const fertig = () => {
		localStorage.setItem(NEU_GESEHEN, '1');
		setOffen(false);
	};
	if (!offen) {
		return null;
	}
	return (
		<span className="flex min-w-0 items-center gap-1 text-tinte" data-neu-hinweis>
			<span className="truncate">Neu: Die Werkzeuge sind jetzt direkt am Baustein.</span>
			<Link to="/hilfe#schneller" className="flex-none underline" onClick={fertig}>
				Zur Hilfe
			</Link>
			<button type="button" className={KNOPF} aria-label="Hinweis ausblenden" onClick={fertig}>
				<Symbol name="schliessen" className="size-3 flex-none" />
			</button>
		</span>
	);
};

interface Eigenschaften extends ZoomEigenschaften {
	/** Nur bei geschlossenem Chat gesetzt. */
	claude: ChatLauf | null;
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
			<NeuHinweis />
		</div>
		<Zoom zoom={zoom} stufe={stufe} skala={skala} fuehreAus={fuehreAus} />
		<div className="flex items-center justify-end gap-2">
			<button type="button" className={KNOPF} data-palette-knopf {...halteFokus} onClick={() => fuehreAus('ansicht.palette')}>
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
