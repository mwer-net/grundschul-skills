import { useEffect, useRef, useState } from 'react';

import { Symbol } from './Symbol';

interface Masse {
	breite: number;
	hoehe: number;
}

interface Rahmen {
	nr: number;
	adresse: string;
	masse: Masse | null;
}

interface Eigenschaften {
	adresse: string;
	/** Zählt hoch, wenn sich das Material geändert hat: Dann lädt die Ansicht neu. */
	stand: number;
	titel: string;
}

/** Links und rechts neben dem Blatt, damit sein Schatten zu sehen ist. */
const RAND = 16;
/** Größer als im Original wird nichts; kleiner, wenn das Fenster schmaler ist. */
const MAX_SKALA = 1;
/** Breit genug für jedes Format, solange eine neue Fassung unsichtbar lädt. */
const LADE_BREITE = 1600;

const miss = (frame: HTMLIFrameElement): Masse | null => {
	const doc = frame.contentDocument;
	if (!doc) {
		return null;
	}
	const seiten = [...doc.querySelectorAll<HTMLElement>('.seite')];
	const blatt = Math.max(0, ...seiten.map((s) => s.offsetWidth)) || doc.documentElement.scrollWidth;
	return { breite: blatt + 2 * RAND, hoehe: doc.documentElement.scrollHeight };
};

/**
 * Das Material, wie es gedruckt aussieht: alle Seiten untereinander, auf die verfügbare Breite verkleinert. Das
 * `iframe` nimmt keine Berührungen an, damit Wischen und Zoomen mit zwei Fingern auf dem iPad die Seite bewegen.
 * Eine neue Fassung lädt unsichtbar und ersetzt die alte erst, wenn sie fertig ist: kein Flackern, die
 * Scrollposition bleibt.
 */
export const Blattansicht = ({ adresse, stand, titel }: Eigenschaften) => {
	const behaelter = useRef<HTMLDivElement>(null);
	const naechste = useRef(0);
	const [breite, setBreite] = useState(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);

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
		// Nur die gezeigte Fassung bleibt stehen; was noch lädt, ist mit dieser Anfrage überholt.
		setRahmen((alt) => [...alt.filter((r) => r.masse).slice(-1), { nr, adresse, masse: null }]);
	}, [adresse, stand]);

	const geladen = (nr: number, frame: HTMLIFrameElement) => {
		const fertig = () => {
			const masse = miss(frame);
			if (masse) {
				setRahmen((alt) => alt.filter((r) => r.nr >= nr).map((r) => (r.nr === nr ? { ...r, masse } : r)));
			}
		};
		// Die Seiten haben feste Maße; auf die Schriften zu warten, schadet trotzdem nicht.
		void (frame.contentDocument?.fonts.ready ?? Promise.resolve()).then(fertig, fertig);
	};

	const sichtbar = rahmen.findLast((r) => r.masse !== null);
	const masse = sichtbar?.masse ?? null;
	const skala = masse && breite > 0 ? Math.min(MAX_SKALA, breite / masse.breite) : 1;

	return (
		<div
			ref={behaelter}
			className="relative w-full overflow-hidden rounded-2xl bg-[#e9e9e6]"
			style={{ height: masse ? Math.ceil(masse.hoehe * skala) : '60vh' }}
			data-blattansicht
			data-geladen={masse ? 'ja' : undefined}
		>
			{rahmen.map((r) => (
				<iframe
					key={r.nr}
					src={r.adresse}
					title={titel}
					tabIndex={-1}
					scrolling="no"
					className="pointer-events-none absolute top-0 left-1/2 origin-top border-0"
					style={
						r === sichtbar && masse
							? {
									width: masse.breite,
									height: masse.hoehe,
									transform: `translateX(-50%) scale(${skala})`,
								}
							: { width: LADE_BREITE, height: 800, transform: 'translateX(-50%)', visibility: 'hidden' }
					}
					onLoad={(e) => geladen(r.nr, e.currentTarget)}
				/>
			))}
			{!masse && (
				<div className="absolute inset-0 flex items-center justify-center text-leise">
					<Symbol name="laden" className="size-10 animate-spin" />
				</div>
			)}
		</div>
	);
};
