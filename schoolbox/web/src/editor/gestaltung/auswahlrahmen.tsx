import type { PointerEvent as ReactPointerEvent } from 'react';

import { klassen } from '../../bausteine/klassen';
import type { GriffName, Kasten } from './geste';
import { ECKEN, GRIFFE } from './geste';
import type { ZusatzGriff } from './griffe';

/** Abstand des Drehgriffs über der Oberkante, in Bildschirm-px (Briefing 5.4). */
export const DREH_ABSTAND = 24;

const ZEIGER: Record<GriffName, string> = {
	'oben-links': 'cursor-nwse-resize',
	'unten-rechts': 'cursor-nwse-resize',
	'oben-rechts': 'cursor-nesw-resize',
	'unten-links': 'cursor-nesw-resize',
	oben: 'cursor-ns-resize',
	unten: 'cursor-ns-resize',
	links: 'cursor-ew-resize',
	rechts: 'cursor-ew-resize',
};

const NAME: Record<GriffName, string> = {
	'oben-links': 'Ecke oben links',
	'oben-rechts': 'Ecke oben rechts',
	'unten-rechts': 'Ecke unten rechts',
	'unten-links': 'Ecke unten links',
	oben: 'Kante oben',
	unten: 'Kante unten',
	links: 'Kante links',
	rechts: 'Kante rechts',
};

/** Trefferfläche 8 px am Mac, 44 px unter `any-pointer: coarse` (Entscheidung 28); zu sehen ist immer das kleine Quadrat. */
const GRIFF =
	'pointer-events-auto absolute flex size-2 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center [@media(any-pointer:coarse)]:size-11';
const PUNKT = 'block size-2 flex-none rounded-[1px] border border-brand-500 bg-flaeche shadow';

const Schloss = () => (
	<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
		<rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
		<path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
	</svg>
);

interface Eigenschaften {
	element: Element;
	kasten: Kasten;
	ursprung: { x: number; y: number };
	links: number;
	skala: number;
	/** Gesperrt: Rahmen mit Schloss, ohne Griffe. */
	gesperrt: boolean;
	/** Nicht in einer Textsitzung, Vorschau oder bei einem Konflikt: sonst Rahmen ohne Griffe. */
	bedienbar: boolean;
	griffe: readonly GriffName[];
	zusatz: readonly ZusatzGriff[];
	/** Während einer Geste: keine Griffe unter dem Zeiger, die etwas anderes auslösen. */
	inGeste: boolean;
	/** 115: Rahmen sichtbar, aber ohne Drehgriff, Ecken und Kanten; nur die Zusatzgriffe (Höhe der Fläche). */
	nurZusatz?: boolean;
	starteGriff: (e: ReactPointerEvent<HTMLElement>, element: Element, griff: GriffName | 'drehen') => void;
	starteZusatz: (
		e: ReactPointerEvent<HTMLElement>,
		element: Element,
		griff: ZusatzGriff,
		wo: { x: number; y: number },
	) => void;
}

/**
 * Rahmen um das gewählte Gestaltungselement, gedreht wie das Element (097). Ecken, Kanten nach Art und der Drehgriff
 * 24 px über der Oberkante. Spiegeln dreht die Griffe nicht um: Die Kante rechts bleibt rechts.
 */
export const Auswahlrahmen = ({
	bedienbar,
	element,
	gesperrt,
	griffe,
	inGeste,
	kasten,
	links,
	nurZusatz = false,
	skala,
	starteGriff,
	starteZusatz,
	ursprung,
	zusatz,
}: Eigenschaften) => {
	// 107: Bei der Linie stehen nur ihre zwei Endpunkte da, ohne Rahmen, Ecken, Kanten und Drehgriff.
	const ohneRahmen = zusatz.some((z) => z.ersetztRahmen);
	return (
	<div
		className={klassen('pointer-events-none absolute z-ueberlagerung border-[1.5px] border-brand-500', ohneRahmen && 'border-transparent')}
		data-gestaltung-rahmen={gesperrt ? 'gesperrt' : ''}
		style={{
			left: links + (ursprung.x + kasten.x) * skala,
			top: (ursprung.y + kasten.y) * skala,
			width: kasten.b * skala,
			height: kasten.h * skala,
			transform: kasten.drehen ? `rotate(${kasten.drehen}deg)` : undefined,
		}}
	>
		{gesperrt ? (
			<span
				className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-brand-500 text-white shadow"
				title="Gesperrt: im Blatt nicht zu ziehen"
				data-gestaltung-schloss
			>
				<Schloss />
			</span>
		) : (
			bedienbar && (
			<>
				{!ohneRahmen && !nurZusatz && (<>
				<span
					className="absolute left-1/2 w-px bg-brand-500"
					style={{ top: -DREH_ABSTAND, height: DREH_ABSTAND }}
				/>
				<button
					type="button"
					aria-label="Drehen"
					title="Drehen (⇧: in 15°-Schritten)"
					className={klassen(GRIFF, 'left-1/2 cursor-grab', inGeste && 'cursor-grabbing')}
					style={{ top: -DREH_ABSTAND }}
					data-gestaltung-griff="drehen"
					onPointerDown={(e) => starteGriff(e, element, 'drehen')}
				>
					<span className="block size-2.5 flex-none rounded-full border border-brand-500 bg-flaeche shadow" />
				</button>
				{griffe.map((griff) => {
					const { x, y } = GRIFFE[griff];
					return (
						<button
							key={griff}
							type="button"
							aria-label={`Größe ändern, ${NAME[griff]}`}
							className={klassen(GRIFF, ZEIGER[griff])}
							style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%` }}
							data-gestaltung-griff={griff}
							onPointerDown={(e) => starteGriff(e, element, griff)}
						>
							<span className={PUNKT} />
						</button>
					);
				})}
				</>)}
				{zusatz.map((griff) => {
					const wo = griff.wo(element, kasten);
					return (
						wo && (
							<button
								key={griff.id}
								type="button"
								aria-label={griff.name}
								title={griff.name}
								className={klassen(GRIFF, griff.zeiger ?? 'cursor-pointer')}
								style={{ left: wo.x * skala, top: wo.y * skala }}
								data-gestaltung-griff={griff.id}
								onPointerDown={(e) => starteZusatz(e, element, griff, wo)}
							>
								{griff.zeichne?.() ?? (
									<span className="block size-2.5 flex-none rounded-full border border-brand-500 bg-flaeche shadow" />
								)}
							</button>
						)
					);
				})}
			</>
			)
		)}
	</div>
);
};

/**
 * 113: Rahmen um eine Mehrfachauswahl (5.9): um alle zusammen mit Ecken und Drehgriff, keine Kanten. Jedes gewählte
 * Element bekommt einen dünnen Umriss. Alles in Koordinaten des Materials.
 */
export const MehrfachRahmen = ({
	bedienbar,
	inGeste,
	kasten,
	links,
	skala,
	starteMehrfach,
	umrisse,
}: {
	kasten: Kasten;
	umrisse: readonly { links: number; oben: number; rechts: number; unten: number }[];
	links: number;
	skala: number;
	bedienbar: boolean;
	inGeste: boolean;
	starteMehrfach: (e: ReactPointerEvent<HTMLElement>, griff: GriffName | 'drehen') => void;
}) => (
	<>
		{!inGeste &&
			umrisse.map((r, i) => (
				<div
					// eslint-disable-next-line react/no-array-index-key -- die Reihenfolge ist die der Auswahl
					key={i}
					className="pointer-events-none absolute z-ueberlagerung border border-brand-500/70"
					data-mehrfach-umriss
					style={{
						left: links + r.links * skala,
						top: r.oben * skala,
						width: (r.rechts - r.links) * skala,
						height: (r.unten - r.oben) * skala,
					}}
				/>
			))}
		<div
			className="pointer-events-none absolute z-ueberlagerung border-[1.5px] border-brand-500"
			data-gestaltung-rahmen="mehrfach"
			data-mehrfach-anzahl={umrisse.length}
			style={{
				left: links + kasten.x * skala,
				top: kasten.y * skala,
				width: kasten.b * skala,
				height: kasten.h * skala,
				transform: kasten.drehen ? `rotate(${kasten.drehen}deg)` : undefined,
			}}
		>
			{bedienbar && (
				<>
					<span className="absolute left-1/2 w-px bg-brand-500" style={{ top: -DREH_ABSTAND, height: DREH_ABSTAND }} />
					<button
						type="button"
						aria-label="Auswahl drehen"
						title="Drehen (⇧: in 15°-Schritten)"
						className={klassen(GRIFF, 'left-1/2 cursor-grab', inGeste && 'cursor-grabbing')}
						style={{ top: -DREH_ABSTAND }}
						data-gestaltung-griff="drehen"
						onPointerDown={(e) => starteMehrfach(e, 'drehen')}
					>
						<span className="block size-2.5 flex-none rounded-full border border-brand-500 bg-flaeche shadow" />
					</button>
					{ECKEN.map((griff) => {
						const { x, y } = GRIFFE[griff];
						return (
							<button
								key={griff}
								type="button"
								aria-label={`Auswahl größer oder kleiner, ${NAME[griff]}`}
								className={klassen(GRIFF, ZEIGER[griff])}
								style={{ left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%` }}
								data-gestaltung-griff={griff}
								onPointerDown={(e) => starteMehrfach(e, griff)}
							>
								<span className={PUNKT} />
							</button>
						);
					})}
				</>
			)}
		</div>
	</>
);
