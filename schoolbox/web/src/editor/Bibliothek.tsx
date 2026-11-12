import { BEREICH_SYMBOL, KATALOG_BEREICHE, KATALOG_KATEGORIEN } from '@schoolbox/kern/src/abbildungen';
import { MEINE_BAUSTEINE, MEINE_BAUSTEINE_SYMBOL, sucheImKatalog } from '@schoolbox/kern/src/katalog';
import type { Art, Fach, Klasse } from '@schoolbox/kern/src/werte';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { meldung, sende } from '../api';
import { AmZeiger } from '../bausteine/AmZeiger';
import { useHinweis } from '../bausteine/hinweis';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import {
	ABSCHNITT_TITEL,
	KACHELNAME,
	KACHELNAME_ZWEIZEILIG,
	NOTIZ,
	Schublade,
	Schubladenabschnitt,
	SCHUBLADENKACHEL,
	Schubladenleer,
	Schubladensuche,
	SCHUBLADENZEILE,
	STEUER_SEGMENT,
	ZEILENLISTE,
} from '../bausteine/Schublade';
import { nichtsPasst, raster } from '../bausteine/schubladenhilfe';
import { Segment } from '../bausteine/Segment';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Tooltip } from '../bausteine/Tooltip';
import { nrVon } from './darstellung';
import type { Einfuegen, Posten, SlashMenue } from './einfuegen';
import type { Einblendung } from './Leinwand';
import { LUECKE_UND_ORIGINAL } from './luecke';
import type { Luecke } from './navigation';
import { lueckeAn } from './navigation';
import { kopf } from './schubladen/reihe';
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

/** Eigene Bausteine umbenennen und löschen (051), unter der Kachel und nicht darin: kein Knopf im Knopf. */
const EigenVerwalten = ({ id, name, neuLaden }: { id: string; name: string; neuLaden: () => void }) => {
	const [neu, setNeu] = useState<string | null>(null);
	const zeige = useHinweis();
	const sende2 = (pfad: string, daten: object) =>
		sende(`/api/eigene/sammlung/${id}/${pfad}`, daten).then(neuLaden, (grund: unknown) =>
			zeige({ text: meldung(grund), art: 'fehler' }),
		);
	if (neu === null) {
		return (
			<div className="flex justify-center gap-1" data-eigen-verwalten={id}>
				<SymbolKnopf
					symbol="stift"
					beschriftung={`${name} umbenennen`}
					groesse="klein"
					onClick={() => setNeu(name)}
				/>
				<SymbolKnopf
					symbol="papierkorb"
					beschriftung={`${name} aus der Sammlung löschen`}
					art="gefahr"
					groesse="klein"
					onClick={() => void sende2('loeschen', {})}
				/>
			</div>
		);
	}
	return (
		<form
			className="flex items-center gap-1"
			data-eigen-verwalten={id}
			onSubmit={(ev) => {
				ev.preventDefault();
				if (neu.trim() !== '') {
					setNeu(null);
					void sende2('aendern', { name: neu });
				}
			}}
		>
			<input
				{...EIGENE_GESCHICHTE}
				aria-label="Neuer Name"
				className={`${FELD_KLASSEN} min-w-0 flex-1`}
				value={neu}
				autoFocus
				onFocus={(ev) => ev.currentTarget.select()}
				onChange={(ev) => setNeu(ev.target.value)}
				// Wie in Finder und den Ebenen: Esc lässt den Namen, wie er war.
				onKeyDown={(ev) => {
					if (ev.key === 'Escape') {
						ev.stopPropagation();
						setNeu(null);
					}
				}}
			/>
			<SymbolKnopf
				type="submit"
				symbol="haken"
				beschriftung="Speichern"
				groesse="klein"
				disabled={neu.trim() === ''}
			/>
		</form>
	);
};

/**
 * Jede Vorschau rechnet `abbildungen.js` und `blatt.css` neu durch. `loading="lazy"` allein lädt im Bereich alle
 * zugleich, weil Browser weit vorausladen; darum wartet die Adresse, bis die Kachel zu sehen ist (Messung in 081, mit
 * zwei Spalten in 147). Den Maßstab rechnet `?fit=1` im Rahmen.
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
			// Fängt keine Zeiger: Druck und Klick gehören dem Knopf darum herum.
			className="pointer-events-none block h-20 w-full rounded-sm border-0 bg-white"
			data-karten-vorschau
		/>
	);
};

/**
 * Ein Eintrag als Kachel (147): Vorschau, darunter der Name in bis zu zwei Zeilen. Ein Knopf, der Klick fügt ein.
 * Gezogen wird von der ganzen Kachel, mit der Maus ab `MAUS_WEG`, mit dem Finger nach `HALTEN_MS`, damit Wischen die
 * Liste rollt. Aussehen wie `AblageKachel`, abgelegt wird aber mit Lücke im Blatt (094, `zug-von-aussen.ts`).
 */
const BausteinKachel = ({
	bereich,
	doc,
	einfuegen,
	eintrag,
}: {
	eintrag: Posten;
	/** Bei Suchtreffern: die Kategorie unter dem Namen. */
	bereich?: string;
	doc: Document | null;
	einfuegen: Einfuegen;
}) => {
	const [amZeiger, setAmZeiger] = useState<ZugAmZeiger | null>(null);
	/** Gedrückt, aber noch kein Zug: Maus unter `MAUS_WEG`, Finger vor `HALTEN_MS`. */
	const druckAn = useRef<{ x: number; y: number; id: number; maus: boolean; timer: number } | null>(null);
	const gezogen = useRef(false);
	const abbrechen = useRef<(() => void) | null>(null);
	const knopf = useRef<HTMLButtonElement>(null);

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
		try {
			knopf.current?.setPointerCapture(id);
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
			zeige: (sichtbar) => {
				setAmZeiger(sichtbar);
				if (!sichtbar) {
					abbrechen.current = null;
				}
			},
		});
	};
	const druck = (ev: ReactPointerEvent<HTMLElement>) => {
		gezogen.current = false;
		loese();
		if (!ev.isPrimary) {
			return;
		}
		const { clientX: x, clientY: y, pointerId: id } = ev;
		if (ev.pointerType !== 'mouse') {
			druckAn.current = {
				x,
				y,
				id,
				maus: false,
				timer: window.setTimeout(() => beginne(x, y, id, false), HALTEN_MS),
			};
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
		<li className="flex flex-col gap-1" data-bibliothek-eintrag={eintrag.id}>
			<Tooltip text={eintrag.name} aus={amZeiger !== null}>
				<button
					ref={knopf}
					type="button"
					aria-label={`${eintrag.name} einfügen`}
					className={klassen(
						SCHUBLADENKACHEL,
						'flex w-full flex-1 flex-col items-center gap-1 p-2 select-none',
						amZeiger ? 'cursor-grabbing' : 'cursor-grab',
					)}
					data-einfuegen={eintrag.id}
					onPointerDown={druck}
					onPointerMove={bewege}
					// Wer schnell zieht, ist schon aus der Kachel, bevor die Schwelle gemessen wurde.
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
					onClick={(ev) => {
						// `detail` ist 0 bei Enter und Leertaste: Die Tastatur hat nichts gezogen.
						if (ev.detail === 0 || !gezogen.current) {
							einfuegen.fuegeEin(eintrag);
						}
					}}
				>
					{/* Eigene haben keine Katalog-Adresse, ein Eintrag mit nur `klasse` hat nichts zu zeigen. */}
					{eintrag.eigen || eintrag.klasse ? (
						<span className="flex h-20 w-full items-center justify-center" data-kachel-symbol>
							<Symbol
								name={eintrag.eigen ? MEINE_BAUSTEINE_SYMBOL : BEREICH_SYMBOL[eintrag.kategorie]}
								className="size-7 text-dezent"
							/>
						</span>
					) : (
						<KartenVorschau id={eintrag.id} name={eintrag.name} />
					)}
					<span className={KACHELNAME_ZWEIZEILIG} data-kachel-name>
						{eintrag.name}
					</span>
					{bereich && (
						<span className={KACHELNAME} data-treffer-bereich>
							{bereich}
						</span>
					)}
				</button>
			</Tooltip>
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
		<button type="button" className={SCHUBLADENZEILE} data-bereich={name} onClick={waehle}>
			<Symbol name={symbol} className="size-3.5 flex-none text-leise" />
			<span className="min-w-0 flex-1 truncate">{name}</span>
			<span className={NOTIZ} data-bereich-anzahl>
				{anzahl}
			</span>
		</button>
	</li>
);

/** Die letzte Gruppe am Start („Mehr“) endet mit „Meine Bausteine“. */
const LETZTE_GRUPPE = KATALOG_BEREICHE.length - 1;

/**
 * Links in der Leiste, in zwei Stufen: Suche, Umschalter, „Zuletzt benutzt“ und die Bereiche aus dem Katalog; ein
 * Bereich zeigt seine Einträge als Kacheln in zwei Spalten, die Aufgabenpakete zuletzt unter „Fertige Aufgaben“ (147).
 * Der Umschalter gilt für die Bereiche. Die Suche geht immer über alles, damit das Finden nie am Filter scheitert (081).
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
	const inhalt = useRef<HTMLDivElement>(null);
	const waehleFilter = (neu: Filter) => {
		setFilter(neu);
		localStorage.setItem(FILTER, neu);
	};
	const { eintraege } = einfuegen;
	const passt = (e: Posten) => passtZu(e, mappe, art);
	const passend = eintraege.filter(passt);
	const gezeigt = filter === 'alle' ? eintraege : passend;
	const anzahl = (liste: readonly Posten[], k: string) => liste.filter((e) => e.kategorie === k).length;
	const hatEigene = eintraege.some((e) => e.herkunft === 'eigen');
	const gruppen = KATALOG_BEREICHE.map(({ bereiche, gruppe }, i) => ({
		gruppe,
		bereiche: bereiche.filter((k) => filter === 'alle' || anzahl(passend, k) > 0),
		eigene: i === LETZTE_GRUPPE && hatEigene,
	})).filter((g) => g.bereiche.length > 0 || g.eigene);
	const verborgen =
		filter === 'alle'
			? 0
			: KATALOG_KATEGORIEN.filter((k) => anzahl(passend, k) === 0 && anzahl(eintraege, k) > 0).length;
	const sucht = suche.trim() !== '';
	const treffer = sucht ? (sucheImKatalog(suche, eintraege) as Posten[]) : [];
	const trefferPassend = treffer.filter(passt);
	const trefferAnderswo = treffer.filter((e) => !passt(e));
	const imBereich = gezeigt.filter((e) => e.kategorie === bereich);
	const elemente = imBereich.filter((e) => e.herkunft !== 'paket');
	const pakete = imBereich.filter((e) => e.herkunft === 'paket');
	const zuletzt = einfuegen.zuletzt.slice(0, ZULETZT_ANZAHL);
	// Start und Kategorie teilen sich den Rollbereich; ein `key` an `Schublade` nähme der Suche den Fokus.
	useLayoutEffect(() => {
		if (inhalt.current) {
			inhalt.current.scrollTop = 0;
		}
	}, [bereich, sucht]);
	const kacheln = (liste: Posten[], mitBereich: boolean) => (
		<ul className={raster(2)}>
			{liste.map((e) => (
				<BausteinKachel
					key={e.id}
					eintrag={e}
					{...(mitBereich ? { bereich: e.kategorie } : {})}
					doc={doc}
					einfuegen={einfuegen}
				/>
			))}
		</ul>
	);
	const steuerung = (
		<>
			<Schubladensuche beschriftung="Baustein suchen" wert={suche} setWert={setSuche} />
			<Segment
				beschriftung="Welche Bausteine"
				className={STEUER_SEGMENT}
				werte={FILTER_WERTE}
				wert={filter}
				waehle={waehleFilter}
				aus={sucht}
			/>
			{!sucht && bereich !== null && (
				<div className={klassen(ABSCHNITT_TITEL, 'flex items-center gap-2')}>
					<button
						type="button"
						className="-ml-1 flex h-zeile min-w-0 items-center gap-1 rounded-md px-1 text-left hover:bg-flaeche-2"
						data-bereich-zurueck
						onClick={() => setBereich(null)}
					>
						<Symbol name="zurueck" className="size-3.5 flex-none" />
						<span className="truncate">{bereich}</span>
					</button>
					<span className={klassen(NOTIZ, 'ml-auto')}>{imBereich.length}</span>
				</div>
			)}
		</>
	);

	return (
		<Schublade
			titel={kopf('bausteine').titel}
			daten={{ 'data-bibliothek': '' }}
			inhaltRef={inhalt}
			steuerung={steuerung}
		>
			{!sucht && bereich === null && (
				<>
					{zuletzt.length > 0 && (
						<Schubladenabschnitt titel="Zuletzt benutzt" daten={{ 'data-zuletzt-benutzt': '' }}>
							<ul className={raster(2)}>
								{zuletzt.map((e) => (
									<li key={e.id}>
										<Tooltip text={e.name}>
											<button
												type="button"
												className={klassen(
													SCHUBLADENKACHEL,
													'flex h-zeile w-full items-center px-2 text-left',
												)}
												data-zuletzt={e.id}
												onClick={() => einfuegen.fuegeEin(e)}
											>
												<span className="truncate">{e.name}</span>
											</button>
										</Tooltip>
									</li>
								))}
							</ul>
						</Schubladenabschnitt>
					)}
					{gruppen.map(({ bereiche, eigene, gruppe }) => (
						<Schubladenabschnitt key={gruppe} titel={gruppe} daten={{ 'data-bereich-gruppe': gruppe }}>
							<ul className={ZEILENLISTE}>
								{bereiche.map((k) => (
									<BereichZeile
										key={k}
										name={k}
										symbol={BEREICH_SYMBOL[k]}
										anzahl={anzahl(gezeigt, k)}
										waehle={() => setBereich(k)}
									/>
								))}
								{eigene && (
									<BereichZeile
										name={MEINE_BAUSTEINE}
										symbol={MEINE_BAUSTEINE_SYMBOL}
										anzahl={anzahl(gezeigt, MEINE_BAUSTEINE)}
										waehle={() => setBereich(MEINE_BAUSTEINE)}
									/>
								)}
							</ul>
						</Schubladenabschnitt>
					))}
					{verborgen > 0 && (
						<Knopf
							art="leise"
							className="-ml-2.5 self-start"
							data-weitere
							onClick={() => waehleFilter('alle')}
						>
							{`${verborgen === 1 ? '1 weiterer' : `${verborgen} weitere`} unter Alle`}
						</Knopf>
					)}
				</>
			)}
			{sucht &&
				(treffer.length === 0 ? (
					<Schubladenleer>{nichtsPasst(suche)}</Schubladenleer>
				) : (
					<>
						{trefferPassend.length > 0 && kacheln(trefferPassend, true)}
						{trefferAnderswo.length > 0 && (
							<Schubladenabschnitt
								titel="Aus anderen Fächern und Klassen"
								daten={{ 'data-treffer-anderswo': '' }}
							>
								{kacheln(trefferAnderswo, true)}
							</Schubladenabschnitt>
						)}
					</>
				))}
			{!sucht &&
				bereich !== null &&
				(imBereich.length === 0 ? (
					<Schubladenleer
						aktion={
							filter === 'blatt' && (
								<Knopf art="zweit" onClick={() => waehleFilter('alle')}>
									Alle zeigen
								</Knopf>
							)
						}
					>
						Hier passt nichts zu diesem Blatt.
					</Schubladenleer>
				) : (
					<>
						{elemente.length > 0 && kacheln(elemente, false)}
						{pakete.length > 0 && (
							<Schubladenabschnitt titel="Fertige Aufgaben" daten={{ 'data-fertige-aufgaben': '' }}>
								{kacheln(pakete, false)}
							</Schubladenabschnitt>
						)}
					</>
				))}
		</Schublade>
	);
};
