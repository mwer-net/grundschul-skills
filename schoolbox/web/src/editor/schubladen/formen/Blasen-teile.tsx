import { formVon, STRICH, werteVon } from '@schoolbox/kern/src/formen';

import { klassen } from '../../../bausteine/klassen';
import { SCHUBLADENKACHEL } from '../../../bausteine/Schublade';
import { raster } from '../../../bausteine/schubladenhilfe';
import { AblageKachel } from '../../gestaltung/ablegen/Kachel';
import type { Eintrag } from './Blasen-daten';
import { EINTRAEGE, gutVon, namenVon } from './Blasen-daten';
import type { FormenTeile } from './typ';
import { passtZurSuche } from './typ';

/** `--fs` des Blatts: `--gr` der Blase ist mindestens das (und mindestens 22 px). */
const fsVon = (doc: Document | null) => {
	const body = doc?.body;
	const wert = body ? parseFloat(doc.defaultView?.getComputedStyle(body).getPropertyValue('--fs') ?? '') : NaN;
	return Number.isFinite(wert) ? wert : undefined;
};

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const farbe = (doc: Document | null, variable: string, ersatz: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(variable).trim()) || ersatz;
};

/** Vorschau aus derselben Funktion, die die Form im Blatt zeichnet, verkleinert. */
const Vorschau = ({ doc, e }: { e: Eintrag; doc: Document | null }) => {
	const html = gutVon(e, undefined).html;
	const form = formVon(e.art);
	const vorlage = document.createElement('template');
	vorlage.innerHTML = html;
	const element = vorlage.content.firstElementChild;
	if (!form || !element) {
		return null;
	}
	const { b, h } = form.standardGroesse;
	const strich = STRICH * (b / 56);
	const { d, spitzen } = form.zeichne(
		werteVon(form, (a) => element.getAttribute(a)),
		b,
		h,
		strich,
	);
	const dunkel = farbe(doc, '--dunkel', '#1f2937');
	// Der Zipfel ragt heraus: Platz rundherum, damit er in der Kachel bleibt.
	const rand = e.art === 'sprechblase' ? 40 : 6;
	return (
		<svg
			aria-hidden
			viewBox={`${-rand} ${-rand} ${b + 2 * rand} ${h + 2 * rand}`}
			className="h-8 w-12 overflow-visible"
		>
			<path
				d={d}
				fill={e.art === 'linie' ? 'none' : '#fff'}
				stroke={dunkel}
				strokeWidth={strich}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{spitzen && <path d={spitzen} fill={dunkel} />}
		</svg>
	);
};

export const Kacheln = ({ suche, teile }: FormenTeile) => {
	const fs = fsVon(teile.doc);
	const liste = EINTRAEGE.filter((e) => passtZurSuche(namenVon(e), suche));
	return (
		<div className={raster(3)} data-blasen>
			{liste.map((e) => (
				<AblageKachel
					key={e.id}
					teile={teile}
					gut={gutVon(e, fs)}
					daten={{ 'data-blase-kachel': e.id }}
					className={klassen(SCHUBLADENKACHEL, 'flex h-12 items-center justify-center')}
				>
					<Vorschau e={e} doc={teile.doc} />
				</AblageKachel>
			))}
		</div>
	);
};
