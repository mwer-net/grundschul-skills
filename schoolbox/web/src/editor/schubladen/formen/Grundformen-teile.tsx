import { formVon, STRICH, vollstaendig } from '@schoolbox/kern/src/formen';

import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import type { Grundform } from './Grundformen-daten';
import { GRUNDFORMEN, gutVon, namenVon } from './Grundformen-daten';
import type { FormenTeile } from './typ';
import { passtZurSuche } from './typ';

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
	const { d, viewBox } = form.zeichne(
		vollstaendig(form, (attr) => g.param?.[attr]),
		40,
		40,
		strich,
	);
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

export const Kacheln = ({ suche, teile }: FormenTeile) => {
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
