import type { SammlungsBild } from '@schoolbox/kern/src/bildbefehle';

import { beschreibungAus } from './bild';

/** „3 Bilder“ neben der Gruppe; ohne Bilder nichts. */
export const bilderZahl = (zahl: number) => (zahl === 0 ? undefined : `${zahl} ${zahl === 1 ? 'Bild' : 'Bilder'}`);

/** 199-21: Ohne Beschreibung der Name aus der Datei („marktplatz.jpg“ → „Marktplatz“), Kameranamen bleiben. */
/** 199-N05: Die Beschreibung des Bilds, sonst sein Name aus dem Hochladen, erst dann aus dem Dateinamen. */
export const bildBeschreibung = (eintrag: SammlungsBild) =>
	eintrag.alt[0] ?? eintrag.titel ?? beschreibungAus(eintrag.name);
