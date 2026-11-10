import { formMitTextHtml, linieHtml } from '@schoolbox/kern/src/formen-aendern';
import type { Ende } from '@schoolbox/kern/src/formen-linie';
import { LINIEN_GROESSE } from '@schoolbox/kern/src/formen-linie';
import type { BlasenArt } from '@schoolbox/kern/src/formen-text';
import { BLASEN_GROESSE } from '@schoolbox/kern/src/formen-text';

import type { GestaltungsGut } from '../../gestaltung/ablegen/ziehgut';
import { gestaltungsgut } from '../../gestaltung/ablegen/ziehgut';
import { wuenscheTextsitzung } from '../../gestaltung/textsitzung';

/** Reihenfolge der Kacheln (107): drei Blasen, Band, Linie, Pfeil. */
export const EINTRAEGE: readonly Eintrag[] = [
	{ id: 'sprechblase-rund', name: 'Sprechblase', art: 'sprechblase', blase: 'rund', auch: ['Blase', 'rund'] },
	{ id: 'sprechblase-eckig', name: 'Sprechblase eckig', art: 'sprechblase', blase: 'eckig', auch: ['Blase'] },
	{ id: 'denkblase', name: 'Denkblase', art: 'sprechblase', blase: 'gedanke', auch: ['Gedanke', 'Gedankenblase'] },
	{ id: 'band', name: 'Band', art: 'band', auch: ['Banner', 'Schleife'] },
	{ id: 'linie', name: 'Linie', art: 'linie', auch: ['Strich'] },
	{ id: 'pfeil', name: 'Pfeil', art: 'linie', ende: 'pfeil', auch: ['Linie'] },
];

export const namenVon = (e: Eintrag) => [e.name, ...(e.auch ?? [])];

/**
 * Das Gut zum Ablegen. Formen mit Text öffnen danach die Textsitzung mit markiertem „Text“ (105); Anlegen und erste
 * Sitzung sind ein Schritt.
 */
export const gutVon = (e: Eintrag, fs: number | undefined): GestaltungsGut =>
	e.art === 'linie'
		? gestaltungsgut({ name: e.name, html: linieHtml(e.ende ? { ende: e.ende } : {}), groesse: LINIEN_GROESSE })
		: gestaltungsgut({
				name: e.name,
				html: formMitTextHtml({ art: e.art, ...(e.blase ? { blase: e.blase } : {}), ...(fs ? { fs } : {}) }),
				groesse: BLASEN_GROESSE,
				ebene: 'vorne',
				vorDemAblegen: wuenscheTextsitzung,
			});

export interface Eintrag {
	id: string;
	name: string;
	art: 'sprechblase' | 'band' | 'linie';
	blase?: BlasenArt;
	ende?: Ende;
	/** Weitere Wörter für Suchfeld und ⌘K. */
	auch?: readonly string[];
}
