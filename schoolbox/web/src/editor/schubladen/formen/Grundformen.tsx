import { formHtml, formVon, STRICH, vollstaendig } from '@schoolbox/kern/src/formen';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import type { FormenAbschnitt, FormenTeile } from './typ';
import { passtZurSuche } from './typ';

interface Grundform {
	name: string;
	art: string;
	param?: Readonly<Record<string, number>>;
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}

/** Reihenfolge der Kacheln. Raute ist ein Vieleck mit vier Ecken, Sechseck eines mit sechs. */
const GRUNDFORMEN: readonly Grundform[] = [
	{ name: 'Kreis', art: 'ellipse', auch: ['Ellipse', 'Punkt'] },
	{ name: 'Rechteck', art: 'rechteck', auch: ['Quadrat', 'Viereck'] },
	{ name: 'Abgerundetes Rechteck', art: 'rechteck', param: { 'data-radius': 20 }, auch: ['Quadrat', 'Ecken rund'] },
	{ name: 'Dreieck', art: 'dreieck' },
	{ name: 'Stern', art: 'stern' },
	{ name: 'Herz', art: 'herz' },
	{ name: 'Pfeil', art: 'pfeil' },
	{ name: 'Wolke', art: 'wolke' },
	{ name: 'Sechseck', art: 'vieleck', auch: ['Vieleck'] },
	{ name: 'Raute', art: 'vieleck', param: { 'data-ecken': 4 }, auch: ['Vieleck', 'Viereck'] },
];

const namenVon = (g: Grundform) => [g.name, formVon(g.art)?.name ?? '', ...(g.auch ?? [])];

/** Das Gut zum Ablegen: Standardgröße und -farben der Form (Füllung Akzent, Kontur Dunkel, 3 px). */
const gutVon = (g: Grundform): GestaltungsGut => {
	const groesse = formVon(g.art)?.standardGroesse ?? { b: 120, h: 120 };
	return gestaltungsgut({ name: g.name, html: formHtml({ art: g.art, ...groesse, ...(g.param ? { param: g.param } : {}) }), groesse });
};

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const farbe = (doc: Document | null, variable: string, ersatz: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(variable).trim()) || ersatz;
};

/** Vorschau aus derselben Funktion, die die Form im Blatt zeichnet, in den Farben des Materials. */
const Vorschau = ({ doc, g }: { g: Grundform; doc: Document | null }) => {
	const form = formVon(g.art);
	if (!form) {
		return null;
	}
	const strich = (STRICH * 2) / 3;
	const { d, viewBox } = form.zeichne(vollstaendig(form, (attr) => g.param?.[attr]), 40, 40, strich);
	return (
		<svg aria-hidden viewBox={viewBox} className="size-8 overflow-visible">
			<path
				d={d}
				fill={farbe(doc, '--akzent', '#f59e0b')}
				stroke={farbe(doc, '--dunkel', '#1f2937')}
				strokeWidth={strich}
				strokeLinejoin="round"
			/>
		</svg>
	);
};

const Kacheln = ({ suche, teile }: FormenTeile) => {
	const liste = GRUNDFORMEN.filter((g) => passtZurSuche(namenVon(g), suche));
	return (
		<div className="grid grid-cols-5 gap-1" data-grundformen>
			{liste.map((g) => (
				<AblageKachel
					key={g.name}
					teile={teile}
					gut={gutVon(g)}
					className="flex h-12 items-center justify-center rounded-lg bg-flaeche-2 hover:bg-brand-50"
				>
					<Vorschau g={g} doc={teile.doc} />
				</AblageKachel>
			))}
		</div>
	);
};

export const abschnitt: FormenAbschnitt | null = {
	id: 'grundformen',
	titel: 'Grundformen',
	hinweis: 'Klick oder ziehen',
	zeigt: ({ suche }) => GRUNDFORMEN.some((g) => passtZurSuche(namenVon(g), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		GRUNDFORMEN.map((g) => ({
			...ablegenEintrag(gutVon(g), z, 'Formen'),
			symbol: 'formen',
			suchwoerter: namenVon(g).slice(1).filter(Boolean),
		})),
};

