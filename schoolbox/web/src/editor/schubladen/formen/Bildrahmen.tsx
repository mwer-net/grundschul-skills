import { bildrahmenHtml } from '@schoolbox/kern/src/bildrahmen';
import { formVon, vollstaendig } from '@schoolbox/kern/src/formen';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import type { FormenAbschnitt, FormenTeile } from './typ';
import { passtZurSuche } from './typ';

interface Rahmen {
	id: string;
	name: string;
	art: string;
	param?: Readonly<Record<string, number>>;
	groesse: { b: number; h: number };
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}

/** Die leeren Bildrahmen zum Start (3-formen.md): Kreis, abgerundetes Rechteck, Stern, Wolke. */
const RAHMEN: readonly Rahmen[] = [
	{ id: 'kreis', name: 'Bildrahmen Kreis', art: 'ellipse', groesse: { b: 220, h: 220 }, auch: ['Foto rund', 'Kreis'] },
	{
		id: 'rechteck',
		name: 'Bildrahmen Rechteck',
		art: 'rechteck',
		param: { 'data-radius': 24 },
		groesse: { b: 260, h: 190 },
		auch: ['Foto', 'Ecken rund'],
	},
	{ id: 'stern', name: 'Bildrahmen Stern', art: 'stern', groesse: { b: 240, h: 240 }, auch: ['Foto', 'Stern'] },
	{ id: 'wolke', name: 'Bildrahmen Wolke', art: 'wolke', groesse: { b: 280, h: 190 }, auch: ['Foto', 'Wolke'] },
];

const namenVon = (r: Rahmen) => [r.name, 'Bildrahmen', ...(r.auch ?? [])];

/** Das Gut: ein leerer Bildrahmen, vorne, in seiner Größe; der `clip-path` passt zu dieser Größe. */
const gutVon = (r: Rahmen): GestaltungsGut =>
	gestaltungsgut({
		name: r.name,
		html: bildrahmenHtml({ form: r.art, ...r.groesse, ...(r.param ? { param: r.param } : {}) }),
		groesse: r.groesse,
	});

/** Vorschau: die Form grau mit gestricheltem Rand, wie der leere Rahmen im Blatt. */
const Vorschau = ({ r }: { r: Rahmen }) => {
	const form = formVon(r.art);
	if (!form) {
		return null;
	}
	const b = 40;
	const h = Math.round((40 * r.groesse.h) / r.groesse.b);
	const param: Record<string, number> = r.param ? { 'data-radius': (r.param['data-radius'] ?? 0) / 6 } : {};
	const { d, viewBox } = form.zeichne(vollstaendig(form, (a) => param[a]), b, h, 0);
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

const Kacheln = ({ suche, teile }: FormenTeile) => {
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

/** 111: Abschnitt „Bildrahmen“ der Schublade „Formen“: leere Rahmen, in die später ein Bild gezogen wird. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'bildrahmen',
	titel: 'Bildrahmen',
	hinweis: 'Bild hineinziehen',
	zeigt: ({ suche }) => RAHMEN.some((r) => passtZurSuche(namenVon(r), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		RAHMEN.map((r) => ({
			...ablegenEintrag(gutVon(r), z, 'Formen'),
			symbol: 'bild',
			suchwoerter: namenVon(r).slice(1),
		})),
};
