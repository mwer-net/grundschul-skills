import type { SchmuckArt } from '@schoolbox/kern/src/schmuck';
import { SCHMUCK_ARTEN, schmuckHtml, standardGroesse } from '@schoolbox/kern/src/schmuck';

import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import { wuenscheTextsitzung } from '../../gestaltung/textsitzung';

export const ARTEN = Object.keys(SCHMUCK_ARTEN) as SchmuckArt[];

/** Weitere Wörter für Suchfeld und ⌘K: Wer „Text“ oder „Schrift“ sucht, findet alle drei. */
export const SUCHWOERTER = ['Text', 'Schrift', 'Schmuckschrift'];

export const namenVon = (art: SchmuckArt) => [...SUCHWOERTER, SCHMUCK_ARTEN[art].name];

/** `--fs` des Blatts: Keine Standardgröße fällt darunter unter die Grenze von `schrift-klein`. */
export const fsVon = (doc: Document | null) => {
	const body = doc?.body;
	const wert = body ? parseFloat(doc.defaultView?.getComputedStyle(body).getPropertyValue('--fs') ?? '') : NaN;
	return Number.isFinite(wert) ? wert : undefined;
};

/**
 * Das Gut einer Schmuckschrift: ohne `--b`, so breit wie ihr Text. Die Breite zum Mitten ist geschätzt (der Text ist
 * kurz), danach öffnet sich die Textsitzung mit markiertem Platzhalter. Der Name ist die Id in ⌘K (`ablegen:Titel`).
 */
export const gutVon = (art: SchmuckArt, fs: number | undefined): GestaltungsGut => {
	const { name, text } = SCHMUCK_ARTEN[art];
	const gr = standardGroesse(art, fs);
	return gestaltungsgut({
		name,
		html: schmuckHtml({ art, fs }),
		groesse: { b: Math.round(text.length * gr * 0.6 + (art === 'titel' ? 0 : gr)) },
		ebene: 'vorne',
		breiteAusInhalt: true,
		vorDemAblegen: wuenscheTextsitzung,
	});
};
