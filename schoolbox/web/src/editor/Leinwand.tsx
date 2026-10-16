import { useEffect, useRef, useState } from 'react';

import { Symbol } from '../bausteine/Symbol';
import { elementZu, nrVon, trefferAn } from './darstellung';

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
}

const RAND = 16;
const LADE_BREITE = 1600;
/** Weiter bewegt oder länger gedrückt ist kein Antippen mehr, sondern Wischen bzw. Halten. */
const TIPP_WEG = 10;
const TIPP_MS = 800;

const miss = (doc: Document): Masse => {
	const seiten = [...doc.querySelectorAll<HTMLElement>('.seite')];
	const blatt = Math.max(0, ...seiten.map((s) => s.offsetWidth)) || doc.documentElement.scrollWidth;
	return { breite: blatt + 2 * RAND, hoehe: doc.documentElement.scrollHeight };
};

/**
 * Das Material im Editor. Wie die Blattansicht lädt jede neue Fassung unsichtbar und ersetzt die alte erst, wenn sie
 * fertig ist; die Scrollposition bleibt. Anders als dort nimmt das `iframe` Berührungen an: Antippen wählt den
 * innersten Baustein. Das geht über Pointer-Ereignisse, weil Safari auf dem iPad `click` nicht zuverlässig an das
 * Material schickt. Der Auswahlrahmen liegt über dem `iframe`, nie im Material.
 */
export const Leinwand = ({
	auswahl,
	auswahlName,
	geladen,
	html,
	nurAnsehen,
	taste,
	titel,
	waehle,
	zoom,
}: Eigenschaften) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const naechste = useRef(0);
	const [breite, setBreite] = useState(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);
	const [doc, setDoc] = useState<Document | null>(null);
	const rueckrufe = useRef({ waehle, taste, geladen, nurAnsehen });

	useEffect(() => {
		rueckrufe.current = { waehle, taste, geladen, nurAnsehen };
	}, [waehle, taste, geladen, nurAnsehen]);

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

	const verbinde = (dokument: Document) => {
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
			if (!s || s.id !== e.pointerId || rueckrufe.current.nurAnsehen) {
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
			verbinde(dokument);
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
				{box && gewaehlt && nrVon(gewaehlt) !== null && (
					<div
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
			</div>
			{!masse && (
				<div className="absolute inset-0 flex items-center justify-center text-leise">
					<Symbol name="laden" className="size-10 animate-spin" />
				</div>
			)}
		</div>
	);
};
