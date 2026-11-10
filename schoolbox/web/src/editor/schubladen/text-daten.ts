import {
	BOGEN_STANDARD_GROESSE,
	BOGEN_STANDARD_TEXT,
	bogenBreite,
	bogenHoehe,
	bogenHtml,
} from '@schoolbox/kern/src/bogen';
import type { SchmuckArt } from '@schoolbox/kern/src/schmuck';
import { SCHMUCK_ARTEN, schmuckHtml, SCHRIFT_KONTUR_STANDARD, standardGroesse } from '@schoolbox/kern/src/schmuck';

import type { GestaltungsGut } from '../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../gestaltung/ablegen/ziehgut';
import { wuenscheTextsitzung } from '../gestaltung/textsitzung';

export const ARTEN = Object.keys(SCHMUCK_ARTEN) as SchmuckArt[];

/** `--fs` des Blatts: Keine Standardgröße fällt darunter unter die Grenze von `schrift-klein`. */
export const fsVon = (doc: Document | null) => {
	const body = doc?.body;
	const wert = body ? parseFloat(doc.defaultView?.getComputedStyle(body).getPropertyValue('--fs') ?? '') : NaN;
	return Number.isFinite(wert) ? wert : undefined;
};

/**
 * Das Gut einer Schmuckschrift: ohne `--b`, so breit wie ihr Text. Die Breite zum Mitten ist geschätzt (der Text ist
 * kurz), danach öffnet sich die Textsitzung mit markiertem Platzhalter.
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

export const konturGut = (fs: number | undefined): GestaltungsGut => {
	const gr = standardGroesse('titel', fs);
	return gestaltungsgut({
		name: TITEL_KONTUR,
		html: schmuckHtml({ art: 'titel', fs, kontur: SCHRIFT_KONTUR_STANDARD }),
		groesse: { b: Math.round(SCHMUCK_ARTEN.titel.text.length * gr * 0.6) },
		ebene: 'vorne',
		breiteAusInhalt: true,
		vorDemAblegen: wuenscheTextsitzung,
	});
};

export const bogenGut = (): GestaltungsGut => {
	const b = bogenBreite(BOGEN_STANDARD_TEXT, BOGEN_STANDARD_GROESSE);
	const h = bogenHoehe(BOGEN_STANDARD_GROESSE);
	return gestaltungsgut({ name: TITEL_BOGEN, html: bogenHtml(), groesse: { b, h }, ebene: 'vorne' });
};

/**
 * 110: Zwei Titel mehr. „Titel mit Kontur“ ist ein Titel mit weißer Kontur (6 px), „Titel im Bogen“ ein SVG mit
 * Textpfad. Beide öffnen keine Textsitzung: Der Bogen bekommt seinen Text über das Feld an der Leiste.
 */
export const TITEL_KONTUR = 'Titel mit Kontur';

export const TITEL_BOGEN = 'Titel im Bogen';
