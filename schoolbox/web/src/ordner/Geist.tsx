import { createPortal } from 'react-dom';

import { Symbol } from '../bausteine/Symbol';
import { vorschauAdresse } from '../lib/zugang';
import type { Objekt } from './typen';

/** Was am Zeiger hängt, solange gezogen wird: bis zu drei Blätter und die Anzahl. */
export const Geist = ({ objekte, x, y }: { objekte: Objekt[]; x: number; y: number }) =>
	createPortal(
		<div
			className="pointer-events-none fixed top-0 left-0 z-meldung h-16 w-12"
			style={{ transform: `translate(${x + 8}px, ${y + 8}px)` }}
			data-geist
		>
			{objekte.slice(0, 3).map((o, i) => (
				<div
					key={o.schluessel}
					className="absolute flex h-16 w-12 items-center justify-center overflow-hidden rounded-sm border border-rand bg-flaeche shadow-2"
					style={{ left: i * 5, top: i * 5, zIndex: 3 - i }}
				>
					{!o.istOrdner && o.dok.vorschau ? (
						<img
							src={vorschauAdresse({ mappe: o.dok.mappe, token: null }, o.dok.id, o.dok.vorschau)}
							alt=""
							className="size-full object-cover object-top"
							draggable={false}
						/>
					) : (
						<Symbol name={o.istOrdner ? 'ordner' : 'blatt'} className="size-6 text-brand-500" />
					)}
				</div>
			))}
			{objekte.length > 1 && (
				<span className="absolute -top-2 left-9 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-medium text-white">
					{objekte.length}
				</span>
			)}
		</div>,
		document.body,
	);
