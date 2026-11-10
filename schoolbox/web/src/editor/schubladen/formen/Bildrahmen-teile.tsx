import { formVon, vollstaendig } from '@schoolbox/kern/src/formen';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import type { Rahmen } from './Bildrahmen-daten';
import { gutVon, namenVon, RAHMEN } from './Bildrahmen-daten';
import type { FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** Vorschau: die Form grau mit gestricheltem Rand, wie der leere Rahmen im Blatt. */
const Vorschau = ({ r }: { r: Rahmen }) => {
	const form = formVon(r.art);
	if (!form) {
		return null;
	}
	const b = 40;
	const h = Math.round((40 * r.groesse.h) / r.groesse.b);
	const param: Record<string, number> = r.param ? { 'data-radius': (r.param['data-radius'] ?? 0) / 6 } : {};
	const { d, viewBox } = form.zeichne(
		vollstaendig(form, (a) => param[a]),
		b,
		h,
		0,
	);
	return (
		<svg aria-hidden viewBox={viewBox} className="h-8 w-10 overflow-visible">
			<path d={d} fill="#d4d4d4" />
			<g transform={`translate(${b / 2 - 6} ${h / 2 - 5})`} fill="none" stroke="#808080" strokeWidth="1.4">
				<rect x="0" y="0" width="12" height="10" rx="1.5" />
				<path d="M1 9 L5 5 L8 8 L10 6 L12 8" />
			</g>
		</svg>
	);
};

export const Kacheln = ({ suche, teile }: FormenTeile) => {
	const liste = RAHMEN.filter((r) => passtZurSuche(namenVon(r), suche));
	return (
		<div className="grid grid-cols-4 gap-1" data-bildrahmen-kacheln>
			{liste.map((r) => (
				<AblageKachel
					key={r.id}
					teile={teile}
					gut={gutVon(r)}
					daten={{ 'data-bildrahmen-kachel': r.id }}
					className="flex h-12 items-center justify-center rounded-lg bg-flaeche-2 hover:bg-brand-50"
				>
					<Vorschau r={r} />
				</AblageKachel>
			))}
		</div>
	);
};
