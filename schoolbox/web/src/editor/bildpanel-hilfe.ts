import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';

import { beschreibungAus } from './bild';

/** „3 Bilder“ neben der Gruppe; ohne Bilder nichts. */
export const bilderZahl = (zahl: number) => (zahl === 0 ? undefined : `${zahl} ${zahl === 1 ? 'Bild' : 'Bilder'}`);

/** 199-21: Ohne Beschreibung der Name aus der Datei („marktplatz.jpg“ → „Marktplatz“), Kameranamen bleiben. */
/** 199-N05: Die Beschreibung des Bilds, sonst sein Name aus dem Hochladen, erst dann aus dem Dateinamen. */
export const bildBeschreibung = (eintrag: SammlungsBild) =>
	eintrag.alt[0] ?? eintrag.titel ?? beschreibungAus(eintrag.name);

/**
 * Die Gruppen der Bildauswahl, in Schublade und Dialog gleich (199-12, 199-13): erst die Bilder dieses Ordners,
 * dann die der anderen Ordner, die freigestellten Requisiten früherer Einheiten (253), dann die mitgelieferten.
 * Figuren stehen nur in „Figuren“ (55).
 */
export const BILDGRUPPEN = [
	{ wert: 'mappe', titel: 'Dieser Ordner' },
	{ wert: 'meine', titel: 'Andere Ordner' },
	{ wert: 'requisiten', titel: 'Requisiten aus Einheiten', kurz: 'Requisiten' },
	{ wert: 'sammlung', titel: 'Mitgeliefert' },
] as const;

export type SammlungsGruppe = (typeof BILDGRUPPEN)[number]['wert'];

/** Die Knöpfe des Umschalters: Requisiten nur, wenn es welche gibt; dort der kurze Name, die Überschrift nennt ihn ganz. */
export const bildgruppenWerte = (daten: Sammlung | null | undefined) =>
	BILDGRUPPEN.filter((g) => g.wert !== 'requisiten' || (daten?.requisiten.length ?? 0) > 0).map((g) => ({
		wert: g.wert,
		titel: 'kurz' in g ? g.kurz : g.titel,
	}));
