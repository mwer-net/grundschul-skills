import type { Ablage } from '@schoolbox/kern/src/struktur';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { nrVon } from './darstellung';
import { LUECKE } from './leiste';
import { HALTEN_MS } from './ziehen';

interface SeitenMass {
	nr: number;
	top: number;
	hoehe: number;
}

interface Rahmen {
	nr: number;
	html: string;
	breite: number;
	seiten: SeitenMass[] | null;
}

interface Eigenschaften {
	/** Das Material wie im Editor, nur ohne Abstand um die Seiten (`leistenHtml`). */
	html: string;
	/** Die Seite, in der die Auswahl liegt. */
	gewaehlt: number | null;
	aktiv: boolean;
	waehle: (nr: number) => void;
	verschiebe: (nr: number, ablage: Ablage) => void;
	hinzufuegen: (mitNamenszeile: boolean) => void;
	kontextmenue?: (nr: number, punkt: { x: number; y: number }) => void;
	/** Die erste Seite hat eine Namenszeile, die eine neue Seite übernehmen kann. */
	namenszeile: boolean;
	/** Im Mini-Book steht die Zahl der Seiten fest. */
	festeSeiten: boolean;
}

const SPEICHER_SEITE = 'schoolbox-neue-seite';
const FINGER_WEG = 10;
const MAUS_WEG = 6;

const miss = (doc: Document): { breite: number; seiten: SeitenMass[] } => {
	const seiten = [...doc.querySelectorAll<HTMLElement>('.seite:not([data-erzeugt])')].flatMap((s) => {
		const nr = nrVon(s);
		return nr === null ? [] : [{ nr, top: s.offsetTop, hoehe: s.offsetHeight }];
	});
	const breite = Math.max(1, ...[...doc.querySelectorAll<HTMLElement>('.seite')].map((s) => s.offsetWidth));
	return { breite, seiten };
};

interface Druck {
	id: number;
	y: number;
	maus: boolean;
	index: number;
	timer: number;
}

/**
 * Links neben dem Blatt: alle Seiten als Miniaturen. Antippen wählt die Seite, Halten und Ziehen (Maus: einfach
 * ziehen) ordnet sie um. Darunter „Seite hinzufügen“.
 */
export const Seitenleiste = ({
	aktiv,
	festeSeiten,
	gewaehlt,
	hinzufuegen,
	html,
	kontextmenue,
	namenszeile,
	verschiebe,
	waehle,
}: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const naechste = useRef(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);
	const [platzBreite, setPlatzBreite] = useState(0);
	const [mitNamenszeile, setMitNamenszeile] = useState(() => localStorage.getItem(SPEICHER_SEITE) !== 'leer');
	const neueSeiteMit = (mit: boolean) => {
		setMitNamenszeile(mit);
		localStorage.setItem(SPEICHER_SEITE, mit ? 'namenszeile' : 'leer');
		hinzufuegen(mit);
	};
	const [zug, setZug] = useState<{ index: number; ziel: number | null } | null>(null);
	const druck = useRef<Druck | null>(null);
	const zieht = useRef(false);

	useEffect(() => {
		const nr = naechste.current;
		naechste.current += 1;
		setRahmen((alt) => [...alt.filter((r) => r.seiten).slice(-1), { nr, html, breite: 0, seiten: null }]);
	}, [html]);

	useEffect(() => {
		const element = leiste.current;
		if (!element) {
			return undefined;
		}
		const beobachter = new ResizeObserver(() => setPlatzBreite(element.clientWidth));
		beobachter.observe(element);
		const halte = (e: TouchEvent) => {
			if (zieht.current) {
				e.preventDefault();
			}
		};
		element.addEventListener('touchmove', halte, { passive: false });
		return () => {
			beobachter.disconnect();
			element.removeEventListener('touchmove', halte);
		};
	}, []);

	const fertig = ({ nr }: Rahmen, frame: HTMLIFrameElement) => {
		const doc = frame.contentDocument;
		if (!doc) {
			return;
		}
		const zeigen = () => {
			const masse = miss(doc);
			setRahmen((alt) => alt.filter((r) => r.nr >= nr).map((r) => (r.nr === nr ? { ...r, ...masse } : r)));
		};
		void doc.fonts.ready.then(zeigen, zeigen);
	};

	const sichtbar = rahmen.findLast((r) => r.seiten !== null);
	const seiten = sichtbar?.seiten ?? [];
	const skala = sichtbar && platzBreite ? platzBreite / sichtbar.breite : 0;
	const aktuell = aktiv && sichtbar?.html === html;
	const letzte = seiten.at(-1);
	const hoehe = letzte ? (letzte.top + letzte.hoehe) * skala : 0;

	/** Vor welche Seite das Gezogene käme (Länge = ans Ende); `null`, wenn es bliebe, wo es ist. */
	const zielAn = (index: number, y: number) => {
		const ziel = seiten.filter((s) => (s.top + s.hoehe / 2) * skala < y).length;
		return ziel === index || ziel === index + 1 ? null : ziel;
	};

	const yIn = (e: ReactPointerEvent) => e.clientY - (leiste.current?.getBoundingClientRect().top ?? 0);

	const loese = () => {
		if (druck.current) {
			clearTimeout(druck.current.timer);
		}
		druck.current = null;
	};

	const beginne = (index: number, y: number) => {
		loese();
		zieht.current = true;
		setZug({ index, ziel: zielAn(index, y) });
	};

	const druecke = (e: ReactPointerEvent, index: number) => {
		const maus = e.pointerType === 'mouse';
		if (!e.isPrimary || !aktuell || (maus && (e.button !== 0 || e.ctrlKey))) {
			return;
		}
		const y = yIn(e);
		const flaeche = e.currentTarget as HTMLElement;
		const id = e.pointerId;
		const timer = maus
			? 0
			: window.setTimeout(() => {
					beginne(index, y);
					try {
						flaeche.setPointerCapture(id);
					} catch {
						// Ohne Fangen endet Ziehen am Rand der Leiste.
					}
				}, HALTEN_MS);
		druck.current = { id, y, maus, index, timer };
	};

	const bewege = (e: ReactPointerEvent) => {
		const y = yIn(e);
		if (zug) {
			setZug({ ...zug, ziel: zielAn(zug.index, y) });
			return;
		}
		const d = druck.current;
		if (!d || d.id !== e.pointerId) {
			return;
		}
		const weg = Math.abs(y - d.y);
		if (d.maus && weg > MAUS_WEG) {
			beginne(d.index, y);
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} else if (!d.maus && weg > FINGER_WEG) {
			loese();
		}
	};

	const lasseLos = (e: ReactPointerEvent, abbrechen = false) => {
		const d = druck.current;
		loese();
		zieht.current = false;
		if (zug) {
			setZug(null);
			const seite = seiten[zug.index];
			const ziel = zug.ziel;
			if (!abbrechen && seite && ziel !== null && aktuell) {
				const vor = seiten[ziel];
				const letzteSeite = seiten.at(-1);
				if (vor) {
					verschiebe(seite.nr, { nr: vor.nr, wo: 'vor' });
				} else if (letzteSeite) {
					verschiebe(seite.nr, { nr: letzteSeite.nr, wo: 'nach' });
				}
			}
			return;
		}
		const seite = d && !abbrechen && d.id === e.pointerId ? seiten[d.index] : undefined;
		if (seite) {
			waehle(seite.nr);
		}
	};

	const markeOben = (ziel: number) => {
		const s = seiten[ziel];
		const vorher = seiten[ziel - 1];
		if (s) {
			return s.top * skala - (vorher ? (LUECKE * skala) / 2 : 6);
		}
		return vorher ? (vorher.top + vorher.hoehe) * skala + 6 : 0;
	};

	return (
		<nav
			aria-label="Seiten"
			className="flex min-h-0 flex-1 flex-col"
			data-seitenleiste
		>
			<div className="min-h-0 flex-1 overflow-y-auto px-9 pt-3 pb-7 max-lg:px-3">
			<div ref={leiste} className="relative" style={{ height: hoehe || 160 }}>
				{rahmen.map((r) => (
					<iframe
						key={r.nr}
						srcDoc={r.html}
						title="Seiten"
						tabIndex={-1}
						aria-hidden
						scrolling="no"
						className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
						style={
							r === sichtbar && r.seiten
								? { width: r.breite, height: hoehe / (skala || 1), transform: `scale(${skala})` }
								: { width: 1600, height: 800, visibility: 'hidden' }
						}
						onLoad={(e) => fertig(r, e.currentTarget)}
					/>
				))}
				{seiten.map((s, i) => (
					<button
						key={s.nr}
						type="button"
						className={klassen(
							'absolute inset-x-0 rounded-sm border shadow-1 select-none',
							s.nr === gewaehlt ? 'border-brand-500 ring-2 ring-brand-500' : 'border-rand',
							zug?.index === i && 'opacity-40',
						)}
						style={{ top: s.top * skala, height: s.hoehe * skala, WebkitTouchCallout: 'none' }}
						aria-label={`Seite ${i + 1}`}
						aria-current={s.nr === gewaehlt}
						data-seite-miniatur={i + 1}
						onPointerDown={(e) => druecke(e, i)}
						onPointerMove={bewege}
						onPointerUp={(e) => lasseLos(e)}
						onPointerCancel={(e) => lasseLos(e, true)}
						onContextMenu={(e) => {
							e.preventDefault();
							// Beim Finger läuft hier schon das Halten zum Ziehen.
							if (aktuell && !druck.current && !zug) {
								kontextmenue?.(s.nr, { x: e.clientX, y: e.clientY });
							}
						}}
						onClick={(e) => {
							// Tastatur: Enter bzw. Leertaste wählt die Seite (Zeiger erledigt `pointerup`).
							if (e.detail === 0 && aktuell) {
								waehle(s.nr);
							}
						}}
					>
						<span className="absolute inset-x-0 top-full mt-0.5 text-center text-xs text-leise">{i + 1}</span>
					</button>
				))}
				{zug && zug.ziel !== null && (
					<div
						className="pointer-events-none absolute inset-x-0 h-1.5 -translate-y-1/2 rounded-full bg-brand-500"
						data-einfuegemarke
						style={{ top: markeOben(zug.ziel) }}
					/>
				)}
			</div>
			</div>
			<div className="flex-none border-t border-rand p-2">
				{festeSeiten ? (
					<p className="text-xs text-leise" data-feste-seiten>
						Ein Mini-Book hat immer acht Seiten.
					</p>
				) : (
					<div className="flex">
						<Knopf
							art="zweit"
							className={klassen('flex-1 px-2', namenszeile && 'rounded-r-none')}
							aria-label="Seite hinzufügen"
							disabled={!aktiv}
							onClick={() => hinzufuegen(namenszeile && mitNamenszeile)}
						>
							<Symbol name="plus" />
							Seite
						</Knopf>
						{namenszeile && (
							<Menue
								name="Art der neuen Seite"
								disabled={!aktiv}
								ausloeser={
									<Knopf art="zweit" className="size-knopf rounded-l-none border-l-0 px-0">
										<Symbol name="runter" className="size-3 flex-none" />
									</Knopf>
								}
								eintraege={[
									{
										titel: 'Leere Seite',
										aktiv: !mitNamenszeile,
										waehle: () => neueSeiteMit(false),
									},
									{
										titel: 'Seite mit Namenszeile',
										aktiv: mitNamenszeile,
										waehle: () => neueSeiteMit(true),
									},
								]}
							/>
						)}
					</div>
				)}
			</div>
		</nav>
	);
};
