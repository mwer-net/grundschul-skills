import { formVon, STRICH, vollstaendig } from '@schoolbox/kern/src/formen';

import { klassen } from '../../../bausteine/klassen';
import { SCHUBLADENKACHEL } from '../../../bausteine/Schublade';
import { raster } from '../../../bausteine/schubladenhilfe';
import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import type { Grundform } from './Grundformen-daten';
import { gutVon as linieGut, LINIEN, namenVon as linieNamen } from './Blasen-daten';
import { Vorschau as LinieVorschau } from './Blasen-teile';
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
		vollstaendig(form, (attr) => (g.vorschau ?? g.param)?.[attr]),
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
	// 198-18: Linie und Pfeil gehören zu den Formen, nicht zu den Blasen.
	const linien = LINIEN.filter((e) => passtZurSuche(linieNamen(e), suche));
	return (
		<div className={raster(5)} data-grundformen>
			{liste.map((g) => (
				<AblageKachel
					key={g.name}
					teile={teile}
					gut={gutVon(g)}
					{...(g.werkzeug ? { werkzeug: g.werkzeug } : {})}
					className={klassen(SCHUBLADENKACHEL, 'flex h-12 items-center justify-center')}
				>
					<Vorschau g={g} doc={teile.doc} />
				</AblageKachel>
			))}
			{linien.map((e) => (
				<AblageKachel
					key={e.id}
					teile={teile}
					gut={linieGut(e, undefined)}
					daten={{ 'data-blase-kachel': e.id }}
					{...(e.id === 'linie' ? { werkzeug: 'linie' } : {})}
					className={klassen(SCHUBLADENKACHEL, 'flex h-12 items-center justify-center')}
				>
					<LinieVorschau e={e} doc={teile.doc} />
				</AblageKachel>
			))}
		</div>
	);
};
