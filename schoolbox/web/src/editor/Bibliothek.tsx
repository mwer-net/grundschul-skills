import { BEREICH_SYMBOL, KATALOG_BEREICHE, KATALOG_KATEGORIEN } from '@schoolbox/kern/src/abbildungen';
import { MEINE_BAUSTEINE, MEINE_BAUSTEINE_SYMBOL, sucheImKatalog } from '@schoolbox/kern/src/katalog';
import type { Art, Fach, Klasse } from '@schoolbox/kern/src/werte';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { meldung, sende } from '../api';
import { AmZeiger } from '../bausteine/AmZeiger';
import { Griff } from '../bausteine/Griff';
import { useHinweis } from '../bausteine/hinweis';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Segment } from '../bausteine/Segment';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { nrVon } from './darstellung';
import type { Einfuegen, Posten, SlashMenue } from './einfuegen';
import type { Einblendung } from './Leinwand';
import { LUECKE_UND_ORIGINAL } from './luecke';
import type { Luecke } from './navigation';
import { lueckeAn } from './navigation';
import { sichtfeldVon } from './sichtfeld';
import { EIGENE_GESCHICHTE } from './tasten';
import { TEXTWERKZEUG } from './text';
import { FINGER_WEG, HALTEN_MS, MAUS_WEG } from './ziehen';
import type { ZugAmZeiger } from './zug-von-aussen';
import { zieheVonAussen, ziehgutBaustein } from './zug-von-aussen';

const ZEILE = 'w-full rounded-md px-2 py-1 text-left hover:bg-flaeche-2';

const passtZu = (e: Posten, m: { fach: Fach; klasse: Klasse }, art: Art) =>
	(!e.faecher || e.faecher.includes(m.fach)) &&
	(!e.klassen || e.klassen.includes(m.klasse)) &&
	(!e.arten || e.arten.includes(art));

const Liste = ({ aktiv, posten, waehle }: { posten: Posten[]; aktiv?: number; waehle: (e: Posten) => void }) => (
	<ul className="flex flex-col">
		{posten.map((e, i) => (
			<li key={e.id}>
				<button
					type="button"
					className={klassen(ZEILE, i === aktiv && 'bg-brand-100')}
					data-katalog-eintrag={e.id}
					ref={(k) => {
						if (i === aktiv) {
							k?.scrollIntoView({ block: 'nearest' });
						}
					}}
					// Sonst verliert der Textträger den Fokus, bevor der Klick ankommt.
					onMouseDown={(ev) => ev.preventDefault()}
					onClick={() => waehle(e)}
				>
					{e.name}
				</button>
			</li>
		))}
	</ul>
);

const SCHNELL_BREITE = 320;
const SCHNELL_HOEHE = 340;

const schwebend = (top: number, hoehe: number) => (top + 320 > hoehe ? Math.max(0, top - 330) : top);

/** Linie in den Lücken, Aufforderung auf leeren Seiten, Schnellauswahl und Slash-Menü (044, 071). */
export const Einfuegemarken = ({
	aktiv,
	e,
	einfuegen,
	schnellWunsch,
	setAuswahl,
	slash,
}: {
	schnellWunsch: { n: number; nr: number | null };
	e: Einblendung;
	aktiv: boolean;
	setAuswahl: (nr: number | null) => void;
	einfuegen: Einfuegen;
	slash: SlashMenue | null;
}) => {
	const [schnell, setSchnell] = useState<{ nr: number | null; left: number; top: number } | null>(null);
	const [suche, setSuche] = useState('');
	const [luecke, setLuecke] = useState<Luecke | null>(null);
	const { box, doc, hoehe, links, skala } = e;
	const leer = [...doc.querySelectorAll('.seite:not([data-erzeugt])')].filter((s) => s.children.length === 0);
	const liste = suche.trim() ? (sucheImKatalog(suche, einfuegen.eintraege) as Posten[]) : einfuegen.eintraege;
	/** Immer ganz im Sichtfeld, auch am unteren Rand (B15) und wenn der Baustein aus dem Bild gerollt ist. */
	const oeffne = (nr: number | null, wunschLinks: number, wunschOben: number) => {
		const sicht = sichtfeldVon(doc);
		const oben = sicht?.oben ?? 0;
		const unten = Math.min(sicht?.unten ?? hoehe, hoehe);
		const rechts = sicht?.rechts ?? wunschLinks + SCHNELL_BREITE;
		const left = Math.max(8, Math.min(wunschLinks, rechts - SCHNELL_BREITE - 8));
		const top = Math.max(oben + 8, Math.min(wunschOben, unten - SCHNELL_HOEHE - 8));
		setSuche('');
		setLuecke(null);
		setSchnell({ nr, left, top });
	};
	const schliesse = () => {
		setSchnell(null);
		doc.defaultView?.focus();
	};
	const nimm = (p: Posten) => {
		const nr = schnell?.nr ?? null;
		schliesse();
		einfuegen.fuegeEin(p, nr);
	};

	// `/` und „+ Baustein“ aus Leiste, Menü und Palette: dort, wo gerade hingeschaut wird.
	const zuletzt = useRef(schnellWunsch.n);
	useEffect(() => {
		if (zuletzt.current === schnellWunsch.n) {
			return;
		}
		zuletzt.current = schnellWunsch.n;
		const sicht = sichtfeldVon(doc);
		oeffne(
			schnellWunsch.nr,
			links + (box ? box.left * skala : 40),
			box ? box.bottom * skala + 8 : (sicht?.oben ?? 0) + 80,
		);
	});

	// Mit der Maus über einer Lücke: Linie und Pille. Am iPad gibt es kein Überfahren, dort genügt die Leiste.
	useEffect(() => {
		if (!aktiv) {
			setLuecke(null);
			return undefined;
		}
		const bewege = (ereignis: PointerEvent) => {
			const neu =
				ereignis.pointerType === 'mouse' && ereignis.buttons === 0
					? lueckeAn(doc, ereignis.clientX, ereignis.clientY)
					: null;
			setLuecke((alt) => (alt?.nr === neu?.nr && alt?.y === neu?.y ? alt : neu));
		};
		doc.addEventListener('pointermove', bewege);
		return () => doc.removeEventListener('pointermove', bewege);
	}, [aktiv, doc]);

	return (
		<>
			{[...doc.querySelectorAll('.nicht-loesung, body.loesung .nur-loesung')]
				// Nicht in der Lücke und nicht am Original, das sie beim Ziehen ausblendet (094).
				.filter((m) => !m.closest(LUECKE_UND_ORIGINAL))
				.map((m) => {
				const r = m.getBoundingClientRect();
				return (
					<span
						key={nrVon(m)}
						className="pointer-events-none absolute rounded-md bg-amber-200 px-2 py-0.5 text-sm font-medium"
						data-sichtbarkeit-marke
						style={{ left: links + r.left * skala, top: r.top * skala - 12 }}
					>
						{m.classList.contains('nur-loesung') ? 'Nur Lösung' : 'Nur Arbeitsblatt'}
					</span>
				);
			})}
			{aktiv && luecke && !schnell && !e.zieht && (
				<div
					className="absolute z-ueberlagerung"
					data-einfuege-luecke
					style={{
						left: links + luecke.x * skala,
						top: luecke.y * skala - 1,
						width: luecke.laenge * skala,
					}}
				>
					<div className="pointer-events-none h-0.5 rounded-full bg-brand-500" />
					<button
						type="button"
						className="absolute top-1/2 left-1/2 inline-flex h-knopf-klein -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-brand-500 px-2 text-xs font-medium whitespace-nowrap text-white"
						data-einfuegen-luecke
						onClick={() => oeffne(luecke.nr, links + luecke.x * skala, luecke.y * skala + 12)}
					>
						<Symbol name="plus" />
						Baustein
					</button>
				</div>
			)}
			{aktiv &&
				leer.map((s) => {
					const r = s.getBoundingClientRect();
					const nr = nrVon(s);
					return (
						<div
							key={nr}
							className="absolute flex justify-center"
							style={{
								left: links + r.left * skala,
								width: r.width * skala,
								top: (r.top + r.height / 3) * skala,
							}}
						>
							<Knopf
								art="haupt"
								data-erster-baustein
								onClick={() => {
									setAuswahl(nr);
									oeffne(nr, links + r.left * skala + 20, (r.top + r.height / 3) * skala + 56);
								}}
							>
								<Symbol name="plus" />
								Ersten Baustein einfügen
							</Knopf>
						</div>
					);
				})}
			{schnell && (
				<div
					className="absolute z-20 w-80 rounded-xl border border-rand bg-flaeche p-2 shadow-lg"
					data-schnellauswahl
					style={{ left: schnell.left, top: schnell.top }}
				>
					<input
						{...EIGENE_GESCHICHTE}
						type="search"
						aria-label="Baustein suchen"
						placeholder="Suchen …"
						className="mb-2 h-knopf w-full rounded-lg border border-rand px-3"
						value={suche}
						autoFocus
						onChange={(ev) => setSuche(ev.target.value)}
						onKeyDown={(ev) => {
							if (ev.key === 'Escape') {
								schliesse();
							} else if (ev.key === 'Enter') {
								const erster = suche.trim() ? liste[0] : (einfuegen.zuletzt[0] ?? liste[0]);
								if (erster) {
									nimm(erster);
								}
							}
						}}
					/>
					<div className="max-h-64 overflow-y-auto">
						{!suche.trim() && einfuegen.zuletzt.length > 0 && (
							<>
								<h3 className="px-3 text-sm text-leise">Zuletzt genutzt</h3>
								<Liste posten={einfuegen.zuletzt} waehle={nimm} />
								<h3 className="px-3 text-sm text-leise">Alle</h3>
							</>
						)}
						<Liste posten={liste} waehle={nimm} />
					</div>
				</div>
			)}
			{slash && (
				<div
					className="absolute z-20 max-h-72 w-72 overflow-y-auto rounded-xl border border-rand bg-flaeche p-1 shadow-lg"
					data-slash-menue
					{...{ [TEXTWERKZEUG]: '' }}
					style={{ left: links + slash.x * skala, top: schwebend(slash.y * skala + 4, hoehe) }}
				>
					{slash.treffer.length === 0 ? (
						<p className="px-3 py-2 text-leise">Nichts gefunden</p>
					) : (
						<Liste posten={slash.treffer} aktiv={slash.index} waehle={slash.waehle} />
					)}
				</div>
			)}
		</>
	);
};

/** Eigene Bausteine umbenennen und löschen (051). */
const EigenVerwalten = ({ id, name, neuLaden }: { id: string; name: string; neuLaden: () => void }) => {
	const [neu, setNeu] = useState<string | null>(null);
	const zeige = useHinweis();
	const sende2 = (pfad: string, daten: object) =>
		sende(`/api/eigene/sammlung/${id}/${pfad}`, daten).then(neuLaden, (grund: unknown) =>
			zeige({ text: meldung(grund), art: 'fehler' }),
		);
	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-rand p-1" data-eigen-verwalten={id}>
			{neu === null ? (
				<Knopf art="zweit" onClick={() => setNeu(name)}>
					Umbenennen
				</Knopf>
			) : (
				<>
					<input
						{...EIGENE_GESCHICHTE}
						aria-label="Neuer Name"
						className={`${FELD_KLASSEN} min-w-0 flex-1`}
						value={neu}
						onChange={(e) => setNeu(e.target.value)}
					/>
					<Knopf
						disabled={neu.trim() === ''}
						onClick={() => {
							setNeu(null);
							void sende2('aendern', { name: neu });
						}}
					>
						Speichern
					</Knopf>
				</>
			)}
			<Knopf
				art="gefahr"
				aria-label={`${name} aus der Sammlung löschen`}
				onClick={() => void sende2('loeschen', {})}
			>
				<Symbol name="papierkorb" />
			</Knopf>
		</div>
	);
};

/**
 * Jede Vorschau rechnet `abbildungen.js` und `blatt.css` neu durch. `loading="lazy"` allein lädt im Bereich alle zugleich,
 * weil Browser weit vorausladen; darum wartet die Adresse, bis die Karte zu sehen ist (Messung im Ticket 081).
 */
const KartenVorschau = ({ id, name }: { id: string; name: string }) => {
	const rahmen = useRef<HTMLIFrameElement>(null);
	const [zuSehen, setZuSehen] = useState(false);
	useEffect(() => {
		const element = rahmen.current;
		if (!element) {
			return undefined;
		}
		const beobachter = new IntersectionObserver(([eintrag]) => {
			if (eintrag?.isIntersecting) {
				setZuSehen(true);
				beobachter.disconnect();
			}
		});
		beobachter.observe(element);
		return () => beobachter.disconnect();
	}, []);
	return (
		<iframe
			ref={rahmen}
			{...(zuSehen ? { src: `/ansicht/_katalog/${id}?fit=1` } : {})}
			title={`Vorschau: ${name}`}
			loading="lazy"
			tabIndex={-1}
			className="pointer-events-none block h-24 w-full border-0 bg-white"
			data-karten-vorschau
		/>
	);
};

/**
 * Einheitlich: Griff links, Name, ganze Vorschau. Die ganze Karte klickt und fügt ein (der Name streckt seine Klickfläche
 * über die Karte). Ziehen (094) geht mit der Maus von überall ab `MAUS_WEG`, mit dem Finger am Griff sofort und
 * sonst nach kurzem Halten (`HALTEN_MS`), damit Wischen die Liste rollt. Gezogen wird mit Lücke im Blatt
 * (`zug-von-aussen.ts`).
 */
const Karte = ({
	bereich,
	doc,
	einfuegen,
	eintrag,
}: {
	eintrag: Posten;
	/** Bei Suchtreffern: der Bereich neben dem Namen. */
	bereich?: string;
	doc: Document | null;
	einfuegen: Einfuegen;
}) => {
	const [amZeiger, setAmZeiger] = useState<ZugAmZeiger | null>(null);
	/** Gedrückt, aber noch kein Zug: Maus unter `MAUS_WEG`, Finger vor `HALTEN_MS`. */
	const druckAn = useRef<{ x: number; y: number; id: number; maus: boolean; timer: number } | null>(null);
	const gezogen = useRef(false);
	const abbrechen = useRef<(() => void) | null>(null);
	const karte = useRef<HTMLDivElement>(null);

	const loese = () => {
		if (druckAn.current) {
			window.clearTimeout(druckAn.current.timer);
		}
		druckAn.current = null;
	};
	useEffect(
		() => () => {
			loese();
			abbrechen.current?.();
		},
		[],
	);

	const beginne = (x: number, y: number, id: number, cmd: boolean) => {
		loese();
		const gut = ziehgutBaustein(eintrag, (ablage) => einfuegen.fuegeAn(eintrag, ablage));
		if (!doc || !gut || abbrechen.current) {
			return;
		}
		gezogen.current = true;
		// Fängt erst hier: Vorher ginge der Klick sonst nicht mehr an den Namen.
		try {
			karte.current?.setPointerCapture(id);
		} catch {
			// Ohne Fangen kommen die Bewegungen über dem Blatt nicht an; der Zug endet beim Loslassen trotzdem.
		}
		abbrechen.current = zieheVonAussen({
			doc,
			gut,
			jeSeite: einfuegen.jeSeite,
			x,
			y,
			id,
			cmd,
			zeige: (anzeige) => {
				setAmZeiger(anzeige);
				if (!anzeige) {
					abbrechen.current = null;
				}
			},
		});
	};
	const druck = (ev: ReactPointerEvent<HTMLElement>) => {
		const amGriff = ev.target instanceof Element && ev.target.closest('[data-ziehgriff]') !== null;
		gezogen.current = false;
		loese();
		if (!ev.isPrimary) {
			return;
		}
		const { clientX: x, clientY: y, pointerId: id } = ev;
		if (ev.pointerType !== 'mouse') {
			if (amGriff) {
				beginne(x, y, id, false);
				return;
			}
			druckAn.current = { x, y, id, maus: false, timer: window.setTimeout(() => beginne(x, y, id, false), HALTEN_MS) };
		} else if (ev.button === 0 && !ev.ctrlKey) {
			druckAn.current = { x, y, id, maus: true, timer: 0 };
		}
	};
	const bewege = (ev: ReactPointerEvent<HTMLElement>) => {
		const start = druckAn.current;
		if (!start || ev.pointerId !== start.id) {
			return;
		}
		const weg = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
		if (start.maus && weg > MAUS_WEG) {
			beginne(ev.clientX, ev.clientY, ev.pointerId, ev.metaKey);
		} else if (!start.maus && weg > FINGER_WEG) {
			loese();
		}
	};

	return (
		<li className="overflow-hidden rounded-lg border border-rand bg-flaeche" data-bibliothek-eintrag={eintrag.id}>
			<div
				ref={karte}
				className={klassen('group relative flex select-none', amZeiger && 'cursor-grabbing')}
				onPointerDown={druck}
				onPointerMove={bewege}
				// Wer schnell zieht, ist schon aus der Karte, bevor die Schwelle gemessen wurde.
				onPointerLeave={(ev) => {
					if (druckAn.current?.maus && ev.pointerId === druckAn.current.id) {
						beginne(ev.clientX, ev.clientY, ev.pointerId, ev.metaKey);
					}
				}}
				onPointerUp={loese}
				onPointerCancel={loese}
				// Langes Drücken am iPad startet das Ziehen, kein Menü.
				onContextMenu={(ev) => {
					if (druckAn.current || abbrechen.current) {
						ev.preventDefault();
					}
				}}
			>
				<Griff beschriftung="Ins Blatt ziehen" className="relative z-10" data-ziehgriff={eintrag.id} />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-x-1.5 py-1 pr-5 pl-1">
						<button
							type="button"
							aria-label={`${eintrag.name} einfügen`}
							title={`${eintrag.name} einfügen`}
							className="cursor-pointer text-left leading-tight font-medium after:absolute after:inset-0 after:content-['']"
							data-einfuegen={eintrag.id}
							onClick={(ev) => {
								// `detail` ist 0 bei Enter und Leertaste: Die Tastatur hat nichts gezogen.
								if (ev.detail === 0 || !gezogen.current) {
									einfuegen.fuegeEin(eintrag);
								}
							}}
						>
							{eintrag.name}
						</button>
						{bereich && (
							<span className="text-xs leading-tight text-dezent" data-treffer-bereich>
								{bereich}
							</span>
						)}
					</div>
					<Symbol
						name="plus"
						className="pointer-events-none absolute top-1 right-1 size-3.5 text-brand-500 opacity-0 group-hover:opacity-100 [@media(any-pointer:coarse)]:hidden"
					/>
					{/* Eigene haben keine Katalog-Adresse, ein Eintrag mit nur `klasse` hat keinen Inhalt zum Zeigen. */}
					{!eintrag.eigen && !eintrag.klasse && <KartenVorschau id={eintrag.id} name={eintrag.name} />}
				</div>
			</div>
			{eintrag.eigen && <EigenVerwalten id={eintrag.eigen} name={eintrag.name} neuLaden={einfuegen.neuLaden} />}
			{amZeiger && (
				<AmZeiger
					className="rounded-lg bg-tinte px-3 py-2 font-medium whitespace-nowrap text-white shadow-2"
					data-zug-anzeige
					x={amZeiger.x + 10}
					y={amZeiger.y + 10}
				>
					{amZeiger.name}
				</AmZeiger>
			)}
		</li>
	);
};

const ZULETZT_ANZAHL = 4;
const FILTER = 'schoolbox.bausteine-filter';
type Filter = 'blatt' | 'alle';
const FILTER_WERTE: { wert: Filter; titel: string }[] = [
	{ wert: 'blatt', titel: 'Für dieses Blatt' },
	{ wert: 'alle', titel: 'Alle' },
];

const BereichZeile = ({
	anzahl,
	name,
	symbol,
	waehle,
}: {
	name: string;
	symbol: SymbolName;
	anzahl: number;
	waehle: () => void;
}) => (
	<li>
		<button
			type="button"
			className="flex h-zeile w-full items-center gap-2 rounded-md px-2 text-left hover:bg-flaeche-2"
			data-bereich={name}
			onClick={waehle}
		>
			<Symbol name={symbol} className="size-3.5 flex-none text-leise" />
			<span className="min-w-0 flex-1 truncate">{name}</span>
			<span className="flex-none text-xs text-dezent tabular-nums" data-bereich-anzahl>
				{anzahl}
			</span>
		</button>
	</li>
);

/**
 * Links in der Leiste, in zwei Stufen: Suche, Umschalter, „Zuletzt benutzt“ und die Bereiche aus dem Katalog; ein Bereich
 * zeigt seine Einträge mit Vorschau. Der Umschalter gilt für die Bereiche. Die Suche geht immer über alles, damit das
 * Finden nie am Filter scheitert (081).
 */
export const Bibliothek = ({
	art,
	doc,
	einfuegen,
	mappe,
}: {
	einfuegen: Einfuegen;
	mappe: { fach: Fach; klasse: Klasse };
	art: Art;
	doc: Document | null;
}) => {
	const [suche, setSuche] = useState('');
	const [bereich, setBereich] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>(() => (localStorage.getItem(FILTER) === 'alle' ? 'alle' : 'blatt'));
	const waehleFilter = (neu: Filter) => {
		setFilter(neu);
		localStorage.setItem(FILTER, neu);
	};
	const { eintraege } = einfuegen;
	const passt = (e: Posten) => passtZu(e, mappe, art);
	const passend = eintraege.filter(passt);
	const gezeigt = filter === 'alle' ? eintraege : passend;
	const anzahl = (liste: readonly Posten[], k: string) => liste.filter((e) => e.kategorie === k).length;
	const gruppen = KATALOG_BEREICHE.map(({ bereiche, gruppe }) => ({
		gruppe,
		bereiche: bereiche.filter((k) => filter === 'alle' || anzahl(passend, k) > 0),
	})).filter((g) => g.bereiche.length > 0);
	const verborgen =
		filter === 'alle'
			? 0
			: KATALOG_KATEGORIEN.filter((k) => anzahl(passend, k) === 0 && anzahl(eintraege, k) > 0).length;
	const hatEigene = eintraege.some((e) => e.herkunft === 'eigen');
	const sucht = suche.trim() !== '';
	const treffer = sucht ? (sucheImKatalog(suche, eintraege) as Posten[]) : [];
	const trefferPassend = treffer.filter(passt);
	const trefferAnderswo = treffer.filter((e) => !passt(e));
	const imBereich = gezeigt.filter((e) => e.kategorie === bereich);
	const zuletzt = einfuegen.zuletzt.slice(0, ZULETZT_ANZAHL);
	const karten = (liste: Posten[], mitBereich: boolean) => (
		<ul className="flex flex-col gap-2">
			{liste.map((e) => (
				<Karte
					key={e.id}
					eintrag={e}
					{...(mitBereich ? { bereich: e.kategorie } : {})}
					doc={doc}
					einfuegen={einfuegen}
				/>
			))}
		</ul>
	);
	return (
		<section data-bibliothek className="flex flex-col gap-2">
			<div className="relative">
				<Symbol name="suche" className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dezent" />
				<input
					{...EIGENE_GESCHICHTE}
					type="search"
					aria-label="Baustein suchen"
					placeholder="Baustein suchen …"
					className={`${FELD_KLASSEN} w-full pl-7`}
					value={suche}
					onChange={(ev) => setSuche(ev.target.value)}
				/>
			</div>
			<Segment
				beschriftung="Welche Bausteine"
				className="w-full [&>button]:flex-1"
				werte={FILTER_WERTE}
				wert={filter}
				waehle={waehleFilter}
				aus={sucht}
			/>
			{!sucht && bereich === null && (
				<>
					{zuletzt.length > 0 && (
						<div data-zuletzt-benutzt>
							<h2 className="mb-1 text-xs font-semibold text-leise">Zuletzt benutzt</h2>
							<ul className="grid grid-cols-2 gap-1">
								{zuletzt.map((e) => (
									<li key={e.id}>
										<Tooltip text={e.name}>
											<button
												type="button"
												className="h-knopf w-full truncate rounded-md border border-rand px-2 text-left hover:bg-flaeche-2"
												data-zuletzt={e.id}
												onClick={() => einfuegen.fuegeEin(e)}
											>
												{e.name}
											</button>
										</Tooltip>
									</li>
								))}
							</ul>
						</div>
					)}
					{gruppen.map(({ bereiche, gruppe }) => (
						<div key={gruppe} data-bereich-gruppe={gruppe}>
							<h2 className="px-2 text-xs font-semibold text-leise">{gruppe}</h2>
							<ul className="flex flex-col">
								{bereiche.map((k) => (
									<BereichZeile
										key={k}
										name={k}
										symbol={BEREICH_SYMBOL[k]}
										anzahl={anzahl(gezeigt, k)}
										waehle={() => setBereich(k)}
									/>
								))}
							</ul>
						</div>
					))}
					{hatEigene && (
						<ul className="flex flex-col">
							<BereichZeile
								name={MEINE_BAUSTEINE}
								symbol={MEINE_BAUSTEINE_SYMBOL}
								anzahl={anzahl(gezeigt, MEINE_BAUSTEINE)}
								waehle={() => setBereich(MEINE_BAUSTEINE)}
							/>
						</ul>
					)}
					{verborgen > 0 && (
						<Knopf art="leise" className="self-start" data-weitere onClick={() => waehleFilter('alle')}>
							{`${verborgen === 1 ? '1 weiterer' : `${verborgen} weitere`} unter Alle`}
						</Knopf>
					)}
				</>
			)}
			{sucht &&
				(treffer.length === 0 ? (
					<p className="text-leise">{`Nichts zu „${suche.trim()}“. Suche prüfen.`}</p>
				) : (
					<>
						{trefferPassend.length > 0 && karten(trefferPassend, true)}
						{trefferAnderswo.length > 0 && (
							<div data-treffer-anderswo>
								<h2 className="mb-1 text-xs font-semibold text-leise">
									Aus anderen Fächern und Klassen
								</h2>
								{karten(trefferAnderswo, true)}
							</div>
						)}
					</>
				))}
			{!sucht && bereich !== null && (
				<>
					<Knopf art="leise" className="-ml-1 self-start px-1" onClick={() => setBereich(null)}>
						<Symbol name="zurueck" />
						{bereich}
					</Knopf>
					{imBereich.length === 0 ? (
						<>
							<p className="text-leise">Hier passt nichts zu diesem Blatt.</p>
							{filter === 'blatt' && (
								<Knopf art="zweit" className="self-start" onClick={() => waehleFilter('alle')}>
									Alle zeigen
								</Knopf>
							)}
						</>
					) : (
						karten(imBereich, false)
					)}
				</>
			)}
		</section>
	);
};
