import type { Ablage } from '@schoolbox/kern/src/struktur';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import type { Groesse } from './bild';
import { elementZu, nrVon, trefferAn, VERALTET } from './darstellung';
import type { Pruefstand } from './pruefung';
import type { ZiehenSteuerung, ZugAnzeige } from './ziehen';
import { ruesteZiehen } from './ziehen';

interface Masse {
	breite: number;
	hoehe: number;
}

interface Rahmen {
	nr: number;
	html: string;
	masse: Masse | null;
}

interface Eigenschaften {
	html: string;
	titel: string;
	/** `data-sb` des gewählten Bausteins. */
	auswahl: number | null;
	/** Name des gewählten Bausteins, steht am Rahmen. */
	auswahlName: string | null;
	waehle: (nr: number | null) => void;
	/** 1 = auf die Breite eingepasst. */
	zoom: number;
	/** Tasten aus dem Material, z. B. Cmd+Z, während der Fokus im `iframe` liegt. */
	taste: (e: KeyboardEvent) => void;
	/** Das sichtbare Dokument, sobald es fertig ist, mit dem HTML, aus dem es entstand. */
	geladen: (doc: Document, html: string) => void;
	/** Vorschau einer Version: nichts auswählbar. */
	nurAnsehen?: boolean;
	/** Bausteine dürfen gezogen werden (nicht beim Tippen, nicht bei einem Konflikt). */
	ziehbar: boolean;
	ablegen: (nr: number, ablage: Ablage) => void;
	/** Ändert sich die Zahl, rollt die Ansicht zum gewählten Baustein. */
	springe: number;
	/** Ein gewähltes Bild bekommt Ziehpunkte an den Ecken. */
	groesse: Groesse | null;
	/** Fehler rot, Warnungen orange umrandet, solange das geprüfte Dokument zu sehen ist (020). */
	pruefung: Pruefstand | null;
}

/** Ecken des Bildes: nach außen ziehen macht es größer. */
const ECKEN = [
	{ x: -1, y: -1, name: 'oben links', zeiger: 'cursor-nwse-resize' },
	{ x: 1, y: -1, name: 'oben rechts', zeiger: 'cursor-nesw-resize' },
	{ x: -1, y: 1, name: 'unten links', zeiger: 'cursor-nesw-resize' },
	{ x: 1, y: 1, name: 'unten rechts', zeiger: 'cursor-nwse-resize' },
] as const;
const GRIFF = 44;

const RAND = 16;
const LADE_BREITE = 1600;
/** Weiter bewegt oder länger gedrückt ist kein Antippen mehr, sondern Wischen bzw. Halten. */
const TIPP_WEG = 10;
const TIPP_MS = 800;
/** So nah am oberen bzw. unteren Rand rollt die Ansicht beim Ziehen mit. */
const ROLL_RAND = 64;
const ROLL_MAX = 18;

const rollbarUm = (element: HTMLElement | null) => {
	for (let e = element?.parentElement ?? null; e; e = e.parentElement) {
		if (/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight) {
			return e;
		}
	}
	return null;
};

const miss = (doc: Document): Masse => {
	const seiten = [...doc.querySelectorAll<HTMLElement>('.seite')];
	const blatt = Math.max(0, ...seiten.map((s) => s.offsetWidth)) || doc.documentElement.scrollWidth;
	return { breite: blatt + 2 * RAND, hoehe: doc.documentElement.scrollHeight };
};

interface GriffEigenschaften {
	gewaehlt: Element | null;
	groesse: Groesse | null;
	/** Lage des Blatts in der Leinwand. */
	links: number;
	skala: number;
	ziehBreite: number | null;
	setZiehBreite: (px: number | null) => void;
}

/** Ziehpunkte an den Ecken eines Bildes: Das Blatt zeigt die Größe sofort, die Quelle ändert erst das Loslassen. */
const Griffe = ({ gewaehlt, groesse, links, setZiehBreite, skala, ziehBreite }: GriffEigenschaften) => {
	if (!gewaehlt || !groesse) {
		return null;
	}
	const box = gewaehlt.getBoundingClientRect();
	const ziehGriff = (e: ReactPointerEvent<HTMLButtonElement>, ecke: (typeof ECKEN)[number]) => {
		if (!e.isPrimary) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		const griff = e.currentTarget;
		try {
			griff.setPointerCapture(e.pointerId);
		} catch {
			// Ohne Fang kommen die Bewegungen nur, solange der Zeiger über dem Griff bleibt.
		}
		const start = { x: e.clientX, y: e.clientY, breite: Math.round(box.width) };
		const verhaeltnis = box.width / Math.max(1, box.height);
		let jetzt = start.breite;
		const bewege = (m: PointerEvent) => {
			const dx = ((m.clientX - start.x) / skala) * ecke.x;
			const dy = ((m.clientY - start.y) / skala) * ecke.y * verhaeltnis;
			const wunsch = start.breite + (Math.abs(dx) > Math.abs(dy) ? dx : dy);
			jetzt = Math.round(Math.max(groesse.min, Math.min(groesse.max, wunsch)));
			groesse.zeige(jetzt);
			setZiehBreite(jetzt);
		};
		const ende = (m: PointerEvent) => {
			griff.removeEventListener('pointermove', bewege);
			griff.removeEventListener('pointerup', ende);
			griff.removeEventListener('pointercancel', ende);
			setZiehBreite(null);
			if (m.type === 'pointercancel') {
				groesse.zeige(start.breite);
			} else if (jetzt !== start.breite) {
				groesse.setze(jetzt);
			}
		};
		griff.addEventListener('pointermove', bewege);
		griff.addEventListener('pointerup', ende);
		griff.addEventListener('pointercancel', ende);
	};
	return (
		<>
			{ECKEN.map((ecke) => (
				<button
					key={ecke.name}
					type="button"
					aria-label={`Größe ändern, Ecke ${ecke.name}`}
					className={`absolute flex touch-none items-center justify-center ${ecke.zeiger}`}
					data-griff={`${ecke.y < 0 ? 'oben' : 'unten'}-${ecke.x < 0 ? 'links' : 'rechts'}`}
					style={{
						left: links + (ecke.x < 0 ? box.left : box.right) * skala - GRIFF / 2,
						top: (ecke.y < 0 ? box.top : box.bottom) * skala - GRIFF / 2,
						width: GRIFF,
						height: GRIFF,
					}}
					onPointerDown={(e) => ziehGriff(e, ecke)}
				>
					<span className="size-4 rounded-sm border-[3px] border-brand-500 bg-white shadow" />
				</button>
			))}
			{ziehBreite !== null && (
				<span
					className="pointer-events-none absolute rounded-lg bg-tinte px-3 py-1 font-bold whitespace-nowrap text-white"
					style={{ left: links + box.left * skala, top: box.bottom * skala + 12 }}
				>
					{`${ziehBreite} px`}
				</span>
			)}
		</>
	);
};

interface PruefrahmenEigenschaften {
	pruefung: Pruefstand | null;
	/** Das sichtbare Dokument: Rahmen nur, wenn die Prüfung zu ihm gehört. */
	doc: Document | null;
	/** Vorschau einer Version. */
	aus?: boolean;
	links: number;
	skala: number;
}

/** Fehler rot, Warnungen orange; Hinweise bekommen keinen Rahmen. */
const Pruefrahmen = ({ aus, doc, links, pruefung, skala }: PruefrahmenEigenschaften) =>
	aus || pruefung?.doc !== doc
		? null
		: pruefung.punkte
				.filter((p) => p.stufe !== 'HINWEIS')
				.flatMap((p, i) =>
					p.rahmen.map((r, j) => (
						<div
							key={`${i}-${j}`}
							className={klassen(
								'pointer-events-none absolute rounded-md border-[3px]',
								p.stufe === 'FEHLER' ? 'border-fehler bg-fehler/5' : 'border-warnung',
							)}
							data-pruefrahmen={p.stufe}
							data-code={p.code ?? undefined}
							style={{
								left: links + r.links * skala - 3,
								top: r.oben * skala - 3,
								width: r.breite * skala + 6,
								height: r.hoehe * skala + 6,
							}}
						/>
					)),
				);

/**
 * Das Material im Editor. Wie die Blattansicht lädt jede neue Fassung unsichtbar und ersetzt die alte erst, wenn sie
 * fertig ist; die Scrollposition bleibt. Anders als dort nimmt das `iframe` Berührungen an: Antippen wählt den
 * innersten Baustein. Das geht über Pointer-Ereignisse, weil Safari auf dem iPad `click` nicht zuverlässig an das
 * Material schickt. Der Auswahlrahmen liegt über dem `iframe`, nie im Material.
 */
export const Leinwand = ({
	ablegen,
	auswahl,
	auswahlName,
	geladen,
	groesse,
	html,
	nurAnsehen,
	pruefung,
	springe,
	taste,
	titel,
	waehle,
	ziehbar,
	zoom,
}: Eigenschaften) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const naechste = useRef(0);
	const [breite, setBreite] = useState(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);
	const [doc, setDoc] = useState<Document | null>(null);
	const [zug, setZug] = useState<ZugAnzeige | null>(null);
	const [ziehBreite, setZiehBreite] = useState<number | null>(null);
	const rueckrufe = useRef({ waehle, taste, geladen, nurAnsehen, ziehbar, ablegen, html, auswahl });
	const skalaJetzt = useRef(1);
	const ziehen = useRef<ZiehenSteuerung | null>(null);
	const auswahlRahmen = useRef<HTMLDivElement>(null);

	useEffect(() => {
		rueckrufe.current = { waehle, taste, geladen, nurAnsehen, ziehbar, ablegen, html, auswahl };
	}, [waehle, taste, geladen, nurAnsehen, ziehbar, ablegen, html, auswahl]);

	// Losgelassen außerhalb des Materials: Das `iframe` bekommt das nicht immer mit.
	useEffect(() => {
		const los = () => ziehen.current?.loslassen();
		window.addEventListener('pointerup', los);
		return () => window.removeEventListener('pointerup', los);
	}, []);

	useEffect(() => {
		const rahmenElement = auswahlRahmen.current;
		const ansicht = rollbarUm(behaelter.current);
		if (springe > 0 && rahmenElement) {
			const hoch = ansicht && rahmenElement.offsetHeight > ansicht.clientHeight;
			rahmenElement.scrollIntoView({ block: hoch ? 'start' : 'nearest', behavior: 'smooth' });
		}
	}, [springe]);

	useEffect(() => {
		const element = behaelter.current;
		if (!element) {
			return undefined;
		}
		const beobachter = new ResizeObserver(() => setBreite(element.clientWidth));
		beobachter.observe(element);
		return () => beobachter.disconnect();
	}, []);

	useEffect(() => {
		const nr = naechste.current;
		naechste.current += 1;
		setRahmen((alt) => [...alt.filter((r) => r.masse).slice(-1), { nr, html, masse: null }]);
	}, [html]);

	/** Rollt beim Ziehen, wenn der Zeiger am Rand der Ansicht steht; Rückgabe in Koordinaten des Materials. */
	const rolle = (frame: HTMLIFrameElement, y: number) => {
		const ansicht = rollbarUm(behaelter.current);
		if (!ansicht) {
			return 0;
		}
		const skala = skalaJetzt.current;
		const bildschirm = frame.getBoundingClientRect().top + y * skala;
		const { bottom, top } = ansicht.getBoundingClientRect();
		const schritt =
			bildschirm < top + ROLL_RAND
				? -ROLL_MAX * Math.min(1, (top + ROLL_RAND - bildschirm) / ROLL_RAND)
				: ROLL_MAX * Math.max(0, Math.min(1, (bildschirm - bottom + ROLL_RAND) / ROLL_RAND));
		const vorher = ansicht.scrollTop;
		ansicht.scrollTop += Math.round(schritt);
		return (ansicht.scrollTop - vorher) / skala;
	};

	const verbinde = (dokument: Document, inhalt: string, frame: HTMLIFrameElement) => {
		const steuerung = ruesteZiehen({
			doc: dokument,
			erlaubt: () =>
				rueckrufe.current.ziehbar &&
				!rueckrufe.current.nurAnsehen &&
				rueckrufe.current.html === inhalt &&
				!dokument.documentElement.hasAttribute(VERALTET),
			auswahl: () => rueckrufe.current.auswahl,
			beginnt: (nr) => rueckrufe.current.waehle(nr),
			zeige: setZug,
			ablegen: (nr, ablage) => rueckrufe.current.ablegen(nr, ablage),
			rolle: (_x, y) => rolle(frame, y),
		});
		ziehen.current = steuerung;
		let start: { x: number; y: number; zeit: number; id: number } | null = null;
		dokument.addEventListener('pointerdown', (e) => {
			start = e.isPrimary ? { x: e.clientX, y: e.clientY, zeit: e.timeStamp, id: e.pointerId } : null;
		});
		dokument.addEventListener('pointercancel', () => {
			start = null;
		});
		dokument.addEventListener('pointerup', (e) => {
			const s = start;
			start = null;
			const veraltet = dokument.documentElement.hasAttribute(VERALTET);
			if (!s || s.id !== e.pointerId || rueckrufe.current.nurAnsehen || steuerung.gezogen() || veraltet) {
				return;
			}
			const weg = Math.hypot(e.clientX - s.x, e.clientY - s.y);
			if (weg > TIPP_WEG || e.timeStamp - s.zeit > TIPP_MS) {
				return;
			}
			// `instanceof Element` gilt im `iframe` nicht: Es hat eigene Klassen.
			const ziel = (e.target as Node | null)?.nodeType === 1 ? (e.target as Element) : null;
			rueckrufe.current.waehle(trefferAn(ziel)?.nr ?? null);
		});
		dokument.addEventListener('keydown', (e) => {
			// Beim Tippen gehören Esc und ⌘Z dem Textfeld.
			if (!(e.target as HTMLElement | null)?.isContentEditable) {
				rueckrufe.current.taste(e);
			}
		});
	};

	const fertig = ({ html: inhalt, nr }: Rahmen, frame: HTMLIFrameElement) => {
		const dokument = frame.contentDocument;
		if (!dokument) {
			return;
		}
		const zeigen = () => {
			const masse = miss(dokument);
			verbinde(dokument, inhalt, frame);
			setZug(null);
			setRahmen((alt) => alt.filter((r) => r.nr >= nr).map((r) => (r.nr === nr ? { ...r, masse } : r)));
			setDoc(dokument);
			rueckrufe.current.geladen(dokument, inhalt);
		};
		void dokument.fonts.ready.then(zeigen, zeigen);
	};

	const sichtbar = rahmen.findLast((r) => r.masse !== null);
	const masse = sichtbar?.masse ?? null;
	const passend = masse && breite > 0 ? Math.min(1, breite / masse.breite) : 1;
	const skala = passend * zoom;
	skalaJetzt.current = skala;
	const innenBreite = masse ? Math.max(breite, masse.breite * skala) : breite;
	const links = masse ? Math.max(0, (innenBreite - masse.breite * skala) / 2) : 0;

	const gewaehlt = doc && auswahl !== null ? elementZu(doc, auswahl) : null;
	const box = gewaehlt?.getBoundingClientRect();

	return (
		<div
			ref={behaelter}
			className="relative w-full overflow-x-auto rounded-2xl bg-[#e9e9e6]"
			data-leinwand
			data-geladen={masse ? 'ja' : undefined}
			onClick={(e) => {
				// Tippen neben das Blatt hebt die Auswahl auf; Tippen ins Blatt kommt aus dem `iframe`.
				if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.innen !== undefined) {
					waehle(null);
				}
			}}
		>
			<div
				className="relative"
				data-innen
				style={{ width: innenBreite || '100%', height: masse ? Math.ceil(masse.hoehe * skala) : '60vh' }}
			>
				{rahmen.map((r) => (
					<iframe
						key={r.nr}
						srcDoc={r.html}
						title={titel}
						scrolling="no"
						className="absolute top-0 origin-top-left border-0"
						data-editor-rahmen={r === sichtbar ? 'sichtbar' : 'laedt'}
						style={
							r === sichtbar && masse
								? {
										left: links,
										width: masse.breite,
										height: masse.hoehe,
										transform: `scale(${skala})`,
									}
								: { left: 0, width: LADE_BREITE, height: 800, visibility: 'hidden' }
						}
						onLoad={(e) => fertig(r, e.currentTarget)}
					/>
				))}
				<Pruefrahmen pruefung={pruefung} doc={doc} aus={nurAnsehen} links={links} skala={skala} />
				{box && gewaehlt && nrVon(gewaehlt) !== null && (
					<div
						ref={auswahlRahmen}
						className="pointer-events-none absolute rounded-md border-[3px] border-brand-500 shadow-[0_0_0_3px_rgba(255,255,255,.8)]"
						data-auswahlrahmen
						style={{
							left: links + box.left * skala - 4,
							top: box.top * skala - 4,
							width: box.width * skala + 8,
							height: box.height * skala + 8,
						}}
					>
						{auswahlName && (
							<span className="absolute -top-8 left-[-3px] rounded-t-md bg-brand-500 px-2 py-1 text-sm font-bold whitespace-nowrap text-white">
								{auswahlName}
							</span>
						)}
					</div>
				)}
				{!nurAnsehen && (
					<Griffe
						gewaehlt={gewaehlt}
						groesse={groesse?.nr === auswahl ? groesse : null}
						links={links}
						skala={skala}
						ziehBreite={ziehBreite}
						setZiehBreite={setZiehBreite}
					/>
				)}
				{zug?.platz && (
					<div
						className="pointer-events-none absolute rounded-full bg-brand-500 shadow-[0_0_0_2px_#fff]"
						data-einfuegemarke
						style={
							zug.platz.marke.senkrecht
								? {
										left: links + zug.platz.marke.x * skala - 3,
										top: zug.platz.marke.y * skala,
										width: 6,
										height: zug.platz.marke.laenge * skala,
									}
								: {
										left: links + zug.platz.marke.x * skala,
										top: zug.platz.marke.y * skala - 3,
										width: zug.platz.marke.laenge * skala,
										height: 6,
									}
						}
					/>
				)}
				{zug && (
					<span
						className="pointer-events-none absolute rounded-lg bg-tinte px-3 py-2 font-bold whitespace-nowrap text-white shadow-karte"
						data-zug
						style={{ left: links + zug.x * skala + 18, top: zug.y * skala + 18 }}
					>
						{zug.name}
					</span>
				)}
			</div>
			{!masse && (
				<div className="absolute inset-0 flex items-center justify-center text-leise">
					<Symbol name="laden" className="size-10 animate-spin" />
				</div>
			)}
		</div>
	);
};
