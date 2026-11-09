import { loeschePfadPunkt, setzePfadPunkt } from '@schoolbox/kern/src/pfad-aendern';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import type { Anker, Punkt } from '@schoolbox/kern/src/vektor';
import { ankerVon, liesPfad, schreibePfad, setzeAnker } from '@schoolbox/kern/src/vektor';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useState } from 'react';

import { pfadDerForm } from './anzeige-folgen';
import type { Kasten } from './geste';
import { usePfadModus, waehlePfadPunkt } from './pfad-modus';

interface Eigenschaften {
	element: Element;
	nr: number;
	kasten: Kasten;
	ursprung: { x: number; y: number };
	links: number;
	skala: number;
	fuehreAus: (beschreibung: string, rechne: (q: string) => StrukturErgebnis) => void;
}

const GRIFF =
	'pointer-events-auto absolute flex size-3 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center [@media(any-pointer:coarse)]:size-11';

/** Was gerade gezogen wird: ein Punkt oder einer seiner Griffe. */
interface Zug {
	index: number;
	was: 'punkt' | 'ein' | 'aus';
	start: { x: number; y: number };
	von: Punkt;
	bewegt: boolean;
}

const drehe = (x: number, y: number, grad: number) => {
	const w = (grad * Math.PI) / 180;
	return { x: x * Math.cos(w) - y * Math.sin(w), y: x * Math.sin(w) + y * Math.cos(w) };
};

/**
 * Punkte bearbeiten (116): Punkte und die Griffe des gewählten Punkts über dem Pfad, gedreht wie das Element. Ziehen
 * zeigt die neue Form nur im `iframe`; beim Loslassen ein Schritt (`setzePfadPunkt`). ⌥-Klick löscht einen Punkt.
 * Am Blatt steht „Punkte bearbeiten · Esc beendet“.
 */
export const PfadPunkte = ({ element, fuehreAus, kasten, links, nr, skala, ursprung }: Eigenschaften) => {
	const modus = usePfadModus();
	const [zug, setZug] = useState<Zug | null>(null);
	const pfad = pfadDerForm(element);
	const d = pfad?.getAttribute('d') ?? '';
	const zuege = liesPfad(d);
	if (!pfad || !zuege) {
		return null;
	}
	const anker = ankerVon(zuege);
	// Elementkoordinaten (viewBox) zu px des Rahmens: Während einer Geste kann die Anzeige kurz abweichen.
	const [, , vb = kasten.b, vh = kasten.h] = (element.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
	const fx = vb > 0 ? kasten.b / vb : 1;
	const fy = vh > 0 ? kasten.h / vh : 1;
	const aufRahmen = (p: Punkt) => ({ left: p.x * fx * skala, top: p.y * fy * skala });
	const gewaehlt = modus.punkt !== null ? anker[modus.punkt] : undefined;

	/** Weg am Bildschirm in Koordinaten des Elements (vor dem Drehen). */
	const imElement = (dx: number, dy: number) => {
		const v = drehe(dx, dy, -(kasten.drehen || 0));
		return { x: v.x / (skala * fx), y: v.y / (skala * fy) };
	};

	const neueZuege = (z: Zug, nach: Punkt) => {
		const a = anker[z.index];
		if (!a) {
			return zuege;
		}
		if (z.was === 'punkt') {
			return setzeAnker(zuege, z.index, nach);
		}
		// Ein Griff: der andere liegt gespiegelt gegenüber (symmetrisch), wenn es ihn gibt.
		const spiegel = { x: 2 * a.p.x - nach.x, y: 2 * a.p.y - nach.y };
		return setzeAnker(
			zuege,
			z.index,
			a.p,
			z.was === 'aus' ? { aus: nach, ein: a.ein ? spiegel : null } : { ein: nach, aus: a.aus ? spiegel : null },
		);
	};

	const zielVon = (z: Zug, e: { clientX: number; clientY: number }) => {
		const w = imElement(e.clientX - z.start.x, e.clientY - z.start.y);
		return { x: z.von.x + w.x, y: z.von.y + w.y };
	};

	const druecke = (e: ReactPointerEvent<HTMLElement>, index: number, was: Zug['was'], von: Punkt) => {
		if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (was === 'punkt' && e.altKey) {
			waehlePfadPunkt(null);
			fuehreAus('Punkt gelöscht', (q) => ({ quelle: loeschePfadPunkt(q, nr, index), nr }));
			return;
		}
		if (was === 'punkt') {
			waehlePfadPunkt(index);
		}
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// Ohne Fang endet der Zug, wenn der Zeiger den Punkt verlässt.
		}
		setZug({ index, was, start: { x: e.clientX, y: e.clientY }, von, bewegt: false });
		(element as SVGElement).style.setProperty('overflow', 'visible');
	};

	const bewege = (e: ReactPointerEvent<HTMLElement>) => {
		if (!zug) {
			return;
		}
		if (!zug.bewegt && Math.hypot(e.clientX - zug.start.x, e.clientY - zug.start.y) < 2) {
			return;
		}
		if (!zug.bewegt) {
			setZug({ ...zug, bewegt: true });
		}
		pfad.setAttribute('d', schreibePfad(neueZuege(zug, zielVon(zug, e))));
	};

	const lasse = (e: ReactPointerEvent<HTMLElement>) => {
		if (!zug) {
			return;
		}
		const z = zug;
		setZug(null);
		(element as SVGElement).style.removeProperty('overflow');
		if (!z.bewegt && Math.hypot(e.clientX - z.start.x, e.clientY - z.start.y) < 2) {
			return;
		}
		const nach = zielVon(z, e);
		const a = anker[z.index];
		if (!a) {
			return;
		}
		const neu = neueZuege(z, nach);
		const neuerAnker = ankerVon(neu)[z.index];
		fuehreAus(z.was === 'punkt' ? 'Punkt verschoben' : 'Kurve geändert', (q) => ({
			quelle: setzePfadPunkt(q, nr, z.index, neuerAnker?.p ?? a.p, {
				ein: neuerAnker?.ein ?? null,
				aus: neuerAnker?.aus ?? null,
			}),
			nr,
		}));
	};

	const abbruch = () => {
		setZug(null);
		pfad.setAttribute('d', d);
		(element as SVGElement).style.removeProperty('overflow');
	};

	const zuegeHandlers = { onPointerMove: bewege, onPointerUp: lasse, onPointerCancel: abbruch };

	const griffLinie = (a: Anker, g: Punkt, schluessel: string) => {
		const p1 = aufRahmen(a.p);
		const p2 = aufRahmen(g);
		return <line key={schluessel} x1={p1.left} y1={p1.top} x2={p2.left} y2={p2.top} />;
	};

	return (
		<div
			className="pointer-events-none absolute z-ueberlagerung"
			data-pfad-punkte={nr}
			style={{
				left: links + (ursprung.x + kasten.x) * skala,
				top: (ursprung.y + kasten.y) * skala,
				width: kasten.b * skala,
				height: kasten.h * skala,
				transform: kasten.drehen ? `rotate(${kasten.drehen}deg)` : undefined,
			}}
		>
			<span
				className="absolute -top-8 left-0 rounded-md bg-tinte px-2 py-0.5 text-sm whitespace-nowrap text-white shadow-2"
				data-hinweis="pfad-punkte"
			>
				Punkte bearbeiten · Esc beendet
			</span>
			{gewaehlt && (
				<svg className="absolute inset-0 size-full overflow-visible stroke-brand-500" aria-hidden="true">
					{gewaehlt.ein && griffLinie(gewaehlt, gewaehlt.ein, 'ein')}
					{gewaehlt.aus && griffLinie(gewaehlt, gewaehlt.aus, 'aus')}
				</svg>
			)}
			{anker.map((a, i) => (
				<button
					key={i}
					type="button"
					aria-label={`Punkt ${i + 1}`}
					title="Ziehen verschiebt · ⌥-Klick löscht"
					className={`${GRIFF} cursor-move`}
					style={aufRahmen(a.p)}
					data-pfad-punkt={i}
					aria-pressed={modus.punkt === i}
					onPointerDown={(e) => druecke(e, i, 'punkt', a.p)}
					{...zuegeHandlers}
				>
					<span
						className={`block size-2 flex-none rounded-full border border-brand-500 shadow ${modus.punkt === i ? 'bg-brand-500' : 'bg-flaeche'}`}
					/>
				</button>
			))}
			{gewaehlt &&
				modus.punkt !== null &&
				(['ein', 'aus'] as const).map((was) => {
					const g = gewaehlt[was];
					return g ? (
						<button
							key={was}
							type="button"
							aria-label={was === 'ein' ? 'Griff davor' : 'Griff danach'}
							className={`${GRIFF} cursor-crosshair`}
							style={aufRahmen(g)}
							data-pfad-griff={was}
							onPointerDown={(e) => druecke(e, modus.punkt ?? 0, was, g)}
							{...zuegeHandlers}
						>
							<span className="block size-2 flex-none rotate-45 border border-brand-500 bg-flaeche shadow" />
						</button>
					) : null;
				})}
		</div>
	);
};
