import { GESTALTUNG_SELEKTOR } from '@schoolbox/kern/src/gestaltung-arten';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { meldeDaneben } from '../bausteine/ueberlagerung';
import type { Groesse } from './bild';
import { elementZu, nrVon, trefferAn, VERALTET } from './darstellung';
import { LUECKE_GEAENDERT } from './luecke';
import type { Pruefstand } from './pruefung';
import { useBlattZoom } from './useBlattZoom';
import type { ZiehenSteuerung, ZugAnzeige } from './ziehen';
import { rollbarUm, rolleAnsicht, ruesteZiehen } from './ziehen';
import type { ZoomWert } from './zoom';
import { massstabVon, rollenNachZoom } from './zoom';
import { ZUG_VON_AUSSEN } from './zug-von-aussen';

interface Masse {
	breite: number;
	hoehe: number;
	/** Höhe einer Seite samt Rand: das Maß fürs Einpassen. */
	seite: number;
}

interface Rahmen {
	nr: number;
	html: string;
	masse: Masse | null;
}

/** Was über dem Material liegen darf (044), in den Koordinaten der Leinwand. */
export interface Einblendung {
	doc: Document;
	links: number;
	skala: number;
	box: DOMRect | null;
	hoehe: number;
	/** Breite des Blatts in der Ansicht. */
	breite: number;
	zieht: boolean;
	ziehen: RefObject<ZiehenSteuerung | null>;
}

interface Eigenschaften {
	einblendung?: (e: Einblendung) => ReactNode;
	html: string;
	titel: string;
	/** `data-sb` des gewählten Bausteins. */
	auswahl: number | null;
	waehle: (nr: number | null) => void;
	zoom: ZoomWert;
	/** Meldet den echten Maßstab, nach jeder Geste einmal. */
	meldeSkala?: (skala: number) => void;
	/** Aufziehen und Strg+Rad über dem Blatt setzen am Ende den neuen Maßstab. */
	setzeZoom?: (wert: number) => void;
	/** Tasten aus dem Material, z. B. Cmd+Z, während der Fokus im `iframe` liegt. */
	taste: (e: KeyboardEvent) => void;
	/** Rechtsklick ins Blatt, Punkt in Koordinaten des Elternfensters. `treffer` ist leer neben dem Blatt. */
	kontextmenue?: (treffer: { nr: number; art: string } | null, punkt: { x: number; y: number }) => void;
	/** Beim Tippen bleibt das Browsermenü: Rechtschreibung und Einfügen brauchen es. */
	textsitzung?: boolean;
	/** Das sichtbare Dokument, sobald es fertig ist, mit dem HTML, aus dem es entstand. */
	geladen: (doc: Document, html: string) => void;
	/** Vorschau einer Version: nichts auswählbar. */
	nurAnsehen?: boolean;
	/** Bausteine dürfen gezogen werden (nicht beim Tippen, nicht bei einem Konflikt). */
	ziehbar: boolean;
	ablegen: (nr: number, ablage: Ablage) => void;
	/** Nummern je Seite (Folien): So zählt auch die Lücke beim Ziehen. */
	jeSeite: boolean;
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
/**
 * Der Browser rundet den Rollstand. Liegt er weniger als 1 px neben dem gemerkten, gilt der gemerkte; sonst wanderte
 * die Stelle unter dem Zeiger mit jedem Bild einer Geste ein Stück.
 */
const genau = (gemerkt: number, jetzt: number) => (Math.abs(jetzt - gemerkt) < 1 ? gemerkt : jetzt);
/** Weiter bewegt oder länger gedrückt ist kein Antippen mehr, sondern Wischen bzw. Halten. */
const TIPP_WEG = 10;
const TIPP_MS = 800;

const miss = (doc: Document): Masse => {
	const seiten = [...doc.querySelectorAll<HTMLElement>('.seite')];
	const blatt = Math.max(0, ...seiten.map((s) => s.offsetWidth)) || doc.documentElement.scrollWidth;
	const erste = seiten[0];
	const seite = erste ? erste.offsetHeight + 2 * erste.offsetTop : doc.documentElement.scrollHeight;
	return { breite: blatt + 2 * RAND, hoehe: doc.documentElement.scrollHeight, seite };
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
					<span className="size-4 rounded-sm border-[3px] border-brand-500 bg-flaeche shadow" />
				</button>
			))}
			{ziehBreite !== null && (
				<span
					className="pointer-events-none absolute rounded-lg bg-tinte px-3 py-1 font-medium whitespace-nowrap text-white"
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
const Ueberlagerung = ({
	aus,
	box,
	doc,
	einblendung,
	links,
	masse,
	skala,
	ziehen,
	zieht,
}: {
	zieht: boolean;
	ziehen: RefObject<ZiehenSteuerung | null>;
	aus: boolean | undefined;
	box: DOMRect | undefined;
	doc: Document | null;
	einblendung: Eigenschaften['einblendung'];
	links: number;
	masse: Masse | null;
	skala: number;
}) =>
	aus || !doc || !masse || !einblendung
		? null
		: einblendung({
				doc,
				links,
				skala,
				box: box ?? null,
				hoehe: masse.hoehe * skala,
				breite: masse.breite * skala,
				zieht,
				ziehen,
			});

/** Einfügemarke und Name am Zeiger, solange ein Baustein gezogen wird. */
const ZugMarken = ({ links, skala, zug }: { links: number; skala: number; zug: ZugAnzeige }) => {
	const marke = zug.platz && !zug.luecke ? zug.platz.marke : null;
	return (
		<>
			{marke && (
				<div
					className="pointer-events-none absolute rounded-full bg-brand-500 shadow-[0_0_0_2px_white]"
					data-einfuegemarke
					style={
						marke.senkrecht
							? {
									left: links + marke.x * skala - 3,
									top: marke.y * skala,
									width: 6,
									height: marke.laenge * skala,
								}
							: {
									left: links + marke.x * skala,
									top: marke.y * skala - 3,
									width: marke.laenge * skala,
									height: 6,
								}
					}
				/>
			)}
			<span
				className="pointer-events-none absolute rounded-lg bg-tinte px-3 py-2 font-medium whitespace-nowrap text-white shadow-2"
				data-zug
				style={{ left: links + zug.x * skala + 18, top: zug.y * skala + 18 }}
			>
				{zug.name}
			</span>
		</>
	);
};

export const Leinwand = ({
	ablegen,
	auswahl,
	einblendung,
	geladen,
	groesse,
	html,
	jeSeite,
	kontextmenue,
	meldeSkala,
	nurAnsehen,
	pruefung,
	setzeZoom,
	springe,
	taste,
	textsitzung,
	titel,
	waehle,
	ziehbar,
	zoom,
}: Eigenschaften) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const naechste = useRef(0);
	const [breite, setBreite] = useState(0);
	const [sichtHoehe, setSichtHoehe] = useState(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);
	const [doc, setDoc] = useState<Document | null>(null);
	const [zug, setZug] = useState<ZugAnzeige | null>(null);
	/** Ein Zug aus der Schublade (094): Er läuft im Elternfenster, die Leinwand blendet nur aus und misst neu. */
	const [vonAussen, setVonAussen] = useState(false);
	const [, setLueckenStand] = useState(0);
	const [ziehBreite, setZiehBreite] = useState<number | null>(null);
	const rueckrufe = useRef({
		waehle,
		taste,
		geladen,
		nurAnsehen,
		ziehbar,
		ablegen,
		html,
		auswahl,
		kontextmenue,
		textsitzung,
		jeSeite,
	});
	const skalaJetzt = useRef(1);
	const ziehen = useRef<ZiehenSteuerung | null>(null);
	const auswahlRahmen = useRef<HTMLDivElement>(null);
	const fokusFolgt = useRef<HTMLIFrameElement | null>(null);
	const blattZoom = useBlattZoom({ behaelter, skalaJetzt, setzeZoom });
	/** Rollstand vor einem Zoom. Schrumpft der Inhalt, kappt der Browser `scrollTop` schon beim Commit. */
	const rollstand = useRef({ x: 0, y: 0 });

	// Der alte Rahmen verschwindet mitsamt dem Fokus; sonst täte die Tastatur nach dem ersten Befehl nichts mehr.
	useLayoutEffect(() => {
		const frame = fokusFolgt.current;
		if (frame && frame.dataset.editorRahmen === 'sichtbar') {
			fokusFolgt.current = null;
			frame.contentWindow?.focus();
		}
	}, [rahmen]);

	useEffect(() => {
		rueckrufe.current = {
			waehle,
			taste,
			geladen,
			nurAnsehen,
			ziehbar,
			ablegen,
			html,
			auswahl,
			kontextmenue,
			textsitzung,
			jeSeite,
		};
	}, [waehle, taste, geladen, nurAnsehen, ziehbar, ablegen, html, auswahl, kontextmenue, textsitzung, jeSeite]);

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
		const ansicht = element.parentElement;
		const beobachter = new ResizeObserver(() => {
			setBreite(element.clientWidth);
			setSichtHoehe(ansicht?.clientHeight ?? 0);
		});
		beobachter.observe(element);
		if (ansicht) {
			beobachter.observe(ansicht);
		}
		const merke = () => {
			const alt = rollstand.current;
			rollstand.current = { x: genau(alt.x, element.scrollLeft), y: genau(alt.y, ansicht?.scrollTop ?? 0) };
		};
		merke();
		element.addEventListener('scroll', merke, { passive: true });
		ansicht?.addEventListener('scroll', merke, { passive: true });
		return () => {
			beobachter.disconnect();
			element.removeEventListener('scroll', merke);
			ansicht?.removeEventListener('scroll', merke);
		};
	}, []);

	useEffect(() => {
		const nr = naechste.current;
		naechste.current += 1;
		setRahmen((alt) => [...alt.filter((r) => r.masse).slice(-1), { nr, html, masse: null }]);
	}, [html]);

	/** Rollt beim Ziehen, wenn der Zeiger am Rand der Ansicht steht; Rückgabe in Koordinaten des Materials. */
	const rolle = (frame: HTMLIFrameElement, y: number) => {
		const skala = skalaJetzt.current;
		return rolleAnsicht(behaelter.current, frame.getBoundingClientRect().top + y * skala) / skala;
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
			jeSeite: () => rueckrufe.current.jeSeite,
			beginnt: (nr) => rueckrufe.current.waehle(nr),
			zeige: setZug,
			ablegen: (nr, ablage) => rueckrufe.current.ablegen(nr, ablage),
			rolle: (_x, y) => rolle(frame, y),
		});
		ziehen.current = steuerung;
		blattZoom.verbinde(dokument, frame);
		// Die Lücke verschiebt das Blatt: Auswahl, Leisten und Marken messen dann neu.
		dokument.addEventListener(LUECKE_GEAENDERT, () => setLueckenStand((n) => n + 1));
		dokument.addEventListener(ZUG_VON_AUSSEN, (e) => setVonAussen((e as CustomEvent<boolean>).detail));
		let start: { x: number; y: number; zeit: number; id: number } | null = null;
		let markiertBeimDruecken = false;
		dokument.addEventListener('pointerdown', (e) => {
			meldeDaneben();
			const markiert = dokument.getSelection();
			markiertBeimDruecken = Boolean(markiert && !markiert.isCollapsed);
			const haupttaste = e.pointerType !== 'mouse' || (e.button === 0 && !e.ctrlKey);
			start =
				e.isPrimary && haupttaste ? { x: e.clientX, y: e.clientY, zeit: e.timeStamp, id: e.pointerId } : null;
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
			frame.contentWindow?.focus();
		});
		dokument.addEventListener('keydown', (e) => rueckrufe.current.taste(e));
		dokument.addEventListener('contextmenu', (e) => {
			if (rueckrufe.current.textsitzung || markiertBeimDruecken) {
				return;
			}
			e.preventDefault();
			// Safari markiert beim Rechtsklick das Wort darunter; das hat niemand gewollt.
			dokument.getSelection()?.removeAllRanges();
			// Am iPad startet langes Drücken das Ziehen; dort ist ⋯ der Weg.
			const finger = (e as Partial<PointerEvent>).pointerType === 'touch';
			if (finger || rueckrufe.current.nurAnsehen || dokument.documentElement.hasAttribute(VERALTET)) {
				return;
			}
			const ziel = (e.target as Node | null)?.nodeType === 1 ? (e.target as Element) : null;
			const treffer = trefferAn(ziel);
			const r = frame.getBoundingClientRect();
			rueckrufe.current.kontextmenue?.(treffer && { nr: treffer.nr, art: treffer.baustein.art }, {
				x: r.left + e.clientX * skalaJetzt.current,
				y: r.top + e.clientY * skalaJetzt.current,
			});
			frame.contentWindow?.focus();
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
			const fokus = document.activeElement;
			if (fokus instanceof HTMLIFrameElement && fokus !== frame && behaelter.current?.contains(fokus)) {
				fokusFolgt.current = frame;
			}
			setZug(null);
			setVonAussen(false);
			setRahmen((alt) => alt.filter((r) => r.nr >= nr).map((r) => (r.nr === nr ? { ...r, masse } : r)));
			setDoc(dokument);
			rueckrufe.current.geladen(dokument, inhalt);
		};
		void dokument.fonts.ready.then(zeigen, zeigen);
	};

	const sichtbar = rahmen.findLast((r) => r.masse !== null);
	const masse = sichtbar?.masse ?? null;
	// Einblendungen messen beim Rendern; ein eben getauschtes `iframe` hat seine Breite aber erst nach dem Commit.
	const [, setNachgemessen] = useState(0);
	useLayoutEffect(() => {
		setNachgemessen((n) => n + 1);
	}, [sichtbar?.nr]);
	const { vorschau } = blattZoom;
	const { innenBreite, links, skala } = massstabVon({ breite, masse, sichtHoehe, zoom: vorschau ?? zoom });
	skalaJetzt.current = skala;
	useEffect(() => {
		if (vorschau === null) {
			meldeSkala?.(skala);
		}
	}, [meldeSkala, skala, vorschau]);

	// Ein Zoom hält die Stelle unter dem Zeiger fest, ohne Zeiger die Mitte der Fläche. Ändern Fenster oder Blatt den
	// Maßstab, bleibt der Rollstand.
	const lage = useRef({ skala, links, zoom, vorschau });
	const { anker } = blattZoom;
	useLayoutEffect(() => {
		const vorher = lage.current;
		lage.current = { skala, links, zoom, vorschau };
		const zeiger = anker.current;
		anker.current = null;
		const element = behaelter.current;
		const ansicht = element?.parentElement;
		const gezoomt = vorher.zoom !== zoom || vorher.vorschau !== vorschau;
		if (!gezoomt || vorher.skala === skala || !element || !ansicht) {
			return;
		}
		const kasten = element.getBoundingClientRect();
		const sicht = ansicht.getBoundingClientRect();
		const punkt = zeiger
			? { x: zeiger.x - kasten.left, y: zeiger.y - sicht.top }
			: { x: element.clientWidth / 2, y: ansicht.clientHeight / 2 };
		const neu = rollenNachZoom({
			vorher,
			nachher: { skala, links },
			rollen: rollstand.current,
			punkt,
			oben: kasten.top - sicht.top + ansicht.scrollTop,
		});
		element.scrollLeft = neu.x;
		ansicht.scrollTop = neu.y;
		rollstand.current = {
			x: genau(Math.max(0, neu.x), element.scrollLeft),
			y: genau(Math.max(0, neu.y), ansicht.scrollTop),
		};
	}, [anker, skala, links, zoom, vorschau]);

	const gewaehlt = doc && auswahl !== null ? elementZu(doc, auswahl) : null;
	const box = gewaehlt?.getBoundingClientRect();
	const zieht = zug !== null || vonAussen;
	// Gestaltung hat ihren eigenen, gedrehten Rahmen mit Griffen (097); dieser bleibt nur fürs Hinrollen.
	const gestaltung = gewaehlt?.matches(GESTALTUNG_SELEKTOR) === true;

	return (
		<div
			ref={behaelter}
			className="relative w-full overflow-x-auto bg-leinwand"
			data-leinwand
			data-geladen={masse ? 'ja' : undefined}
			data-zieht={zieht ? 'ja' : undefined}
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
				{box && gewaehlt && nrVon(gewaehlt) !== null && !zieht && (
					<div
						ref={auswahlRahmen}
						className="pointer-events-none absolute rounded-[2px] border-[1.5px] border-brand-500"
						data-auswahlrahmen
						style={{
							left: links + box.left * skala - 4.5,
							top: box.top * skala - 4.5,
							width: box.width * skala + 9,
							height: box.height * skala + 9,
							visibility: gestaltung ? 'hidden' : undefined,
						}}
					/>
				)}
				<Ueberlagerung
					aus={nurAnsehen}
					box={box}
					doc={doc}
					einblendung={einblendung}
					links={links}
					masse={masse}
					skala={skala}
					zieht={zieht}
					ziehen={ziehen}
				/>
				{!nurAnsehen && (
					<Griffe
						gewaehlt={gewaehlt}
						groesse={groesse?.nr === auswahl && !gestaltung ? groesse : null}
						links={links}
						skala={skala}
						ziehBreite={ziehBreite}
						setZiehBreite={setZiehBreite}
					/>
				)}
				{zug && <ZugMarken zug={zug} links={links} skala={skala} />}
			</div>
			{!masse && (
				<div className="absolute inset-0 flex items-center justify-center text-leise">
					<Symbol name="laden" className="size-6 animate-spin" />
				</div>
			)}
		</div>
	);
};
