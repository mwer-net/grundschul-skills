import type { Bereich } from '@schoolbox/kern/src/kombinieren';
import { bereiche, liegtIn, schereGrund, wendeScherenzugAn } from '@schoolbox/kern/src/kombinieren';
import type { StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { schluckeKlick } from '../../bausteine/zeigerzug';
import { elementZu } from '../darstellung';
import { leseMehrfach, nrnFuer, setzeMehrfach, useMehrfach } from './mehrfach';

/**
 * Überlagerung der Formen-Schere ⇧M (121): Die gewählten Formen zerfallen in Bereiche (gestrichelt). Ziehen markiert
 * Bereiche; Loslassen vereint sie zu einer Form, die übrigen werden einzelne Formen, mit ⌥ fallen die markierten weg.
 * Jeder Zug ist ein Schritt, danach sind alle neuen Formen gewählt und die Schere bleibt aktiv (bis Esc oder V).
 */

type FuehreAus = (beschreibung: string, rechne: (q: string) => StrukturErgebnis) => unknown;

/** Liest die Quelle ohne Schritt: `fuehreAus` legt keinen an, wenn die Quelle gleich bleibt. */
const leseQuelle = (fuehreAus: FuehreAus) => {
	let quelle = '';
	fuehreAus('', (q) => {
		quelle = q;
		return { quelle: q, nr: null };
	});
	return quelle;
};

interface Lage {
	nrn: number[];
	liste: Bereich[];
	grund: string | null;
	/** Ecke des Elternteils der Formen im Material (Bezug von `--x`, `--y`). */
	ursprung: { x: number; y: number };
}

const lageVon = (doc: Document, fuehreAus: FuehreAus): Lage => {
	const { haupt } = leseMehrfach();
	const nrn = haupt === null ? [] : nrnFuer(doc, haupt);
	const leer = { nrn, liste: [], ursprung: { x: 0, y: 0 } };
	if (nrn.length < 2) {
		return { ...leer, grund: 'Wähle zwei oder mehr Formen, die sich überlappen.' };
	}
	const quelle = leseQuelle(fuehreAus);
	try {
		const grund = schereGrund(quelle, nrn);
		const element = elementZu(doc, nrn[0] ?? -1) as HTMLElement | undefined;
		const eltern = element?.offsetParent ?? element?.parentElement;
		const r = eltern?.getBoundingClientRect();
		const ursprung = r ? { x: r.left + (eltern?.clientLeft ?? 0), y: r.top + (eltern?.clientTop ?? 0) } : leer.ursprung;
		return { nrn, ursprung, grund, liste: grund ? [] : bereiche(quelle, nrn) };
	} catch {
		return { ...leer, grund: 'Nur Formen ohne Text lassen sich kombinieren.' };
	}
};

const pfadVon = (b: Bereich) =>
	b.flaeche
		.map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L')} Z`)
		.join(' ');

export const SchereAnzeige = ({
	breite,
	doc,
	fuehreAus,
	hoehe,
	skala,
}: {
	doc: Document;
	skala: number;
	breite: number;
	hoehe: number;
	fuehreAus: FuehreAus;
}) => {
	const mehrfach = useMehrfach();
	// Neu rechnen, wenn sich Auswahl oder Blatt ändern: Nach einem Zug sind die neuen Formen gewählt, das Blatt zeichnet
	// sich aber erst danach neu.
	const [stand, setStand] = useState(0);
	useEffect(() => {
		let bild = 0;
		const beobachter = new MutationObserver(() => {
			cancelAnimationFrame(bild);
			bild = requestAnimationFrame(() => setStand((n) => n + 1));
		});
		beobachter.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'd'] });
		return () => {
			cancelAnimationFrame(bild);
			beobachter.disconnect();
		};
	}, [doc]);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- `mehrfach` und `stand` lösen nur das neue Rechnen aus
	const lage = useMemo(() => lageVon(doc, fuehreAus), [doc, fuehreAus, mehrfach, stand]);
	const [markiert, setMarkiert] = useState<number[]>([]);
	const zug = useRef<{ id: number; ids: Set<number> } | null>(null);

	const treffer = (ev: ReactPointerEvent<SVGSVGElement>) => {
		const r = ev.currentTarget.getBoundingClientRect();
		const p = { x: (ev.clientX - r.left) / skala - lage.ursprung.x, y: (ev.clientY - r.top) / skala - lage.ursprung.y };
		return lage.liste.find((b) => liegtIn(b.flaeche, p))?.id ?? null;
	};

	const nimm = (ev: ReactPointerEvent<SVGSVGElement>) => {
		const z = zug.current;
		const id = treffer(ev);
		if (z && id !== null && !z.ids.has(id)) {
			z.ids.add(id);
			setMarkiert([...z.ids]);
		}
	};

	const hoch = (ev: ReactPointerEvent<SVGSVGElement>) => {
		const z = zug.current;
		if (!z || z.id !== ev.pointerId) {
			return;
		}
		zug.current = null;
		schluckeKlick();
		setMarkiert([]);
		const ids = [...z.ids];
		if (ids.length === 0) {
			return;
		}
		let neu: number[] = [];
		fuehreAus(ev.altKey ? 'Bereiche entfernt' : 'Formen-Schere', (q) => {
			const r = wendeScherenzugAn(q, lage.nrn, ids, ev.altKey);
			neu = r?.nrn ?? [];
			return r ?? { quelle: q, nr: null };
		});
		const [haupt, ...dazu] = neu;
		if (haupt !== undefined) {
			setzeMehrfach(haupt, dazu);
		}
	};

	return (
		<>
			<svg
				className="absolute inset-0 touch-none"
				width={breite}
				height={hoehe}
				viewBox={`0 0 ${breite / skala} ${hoehe / skala}`}
				data-schere-anzeige={lage.liste.length}
				onPointerDown={(ev) => {
					if (!ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0) || lage.grund) {
						return;
					}
					ev.preventDefault();
					ev.stopPropagation();
					try {
						ev.currentTarget.setPointerCapture(ev.pointerId);
					} catch {
						// Ohne Fang endet der Zug, wenn der Zeiger die Überlagerung verlässt.
					}
					zug.current = { id: ev.pointerId, ids: new Set() };
					nimm(ev);
				}}
				onPointerMove={(ev) => {
					if (zug.current?.id === ev.pointerId) {
						nimm(ev);
					}
				}}
				onPointerUp={hoch}
				onPointerCancel={() => {
					zug.current = null;
					setMarkiert([]);
				}}
			>
				<g transform={`translate(${lage.ursprung.x} ${lage.ursprung.y})`}>
					{lage.liste.map((b) => (
						<path
							key={b.id}
							d={pfadVon(b)}
							fillRule="evenodd"
							vectorEffect="non-scaling-stroke"
							className={
								markiert.includes(b.id)
									? 'fill-brand-500/35 stroke-brand-600'
									: 'fill-transparent stroke-brand-500 hover:fill-brand-500/10'
							}
							strokeWidth={1.5}
							strokeDasharray={markiert.includes(b.id) ? undefined : '5 4'}
							data-schere-bereich={b.id}
							{...(markiert.includes(b.id) ? { 'data-markiert': true } : {})}
						/>
					))}
				</g>
			</svg>
			{lage.grund && (
				<p
					className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-tinte px-3 py-1.5 text-sm text-white shadow"
					role="status"
					data-schere-grund
				>
					{`Formen-Schere: ${lage.grund} Esc beendet.`}
				</p>
			)}
		</>
	);
};
