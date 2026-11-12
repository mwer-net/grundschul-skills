import type { Seiten } from '@schoolbox/kern/src/seitengestaltung';
import { alleSeitengestaltungen } from '@schoolbox/kern/src/seitengestaltung';
import { useState } from 'react';

import type { BlattTeile, SeitenTeil } from './teile';

export type Gilt = 'alle' | 'seite';

const FELD = { seitenflaeche: 'flaeche', seitenrahmen: 'rahmen', kopfband: 'kopfband' } as const;

/** Liest sich der Teil auf allen Seiten gleich (auch: auf keiner da)? */
const ueberallGleich = (teil: SeitenTeil, quelle: string) => {
	const werte = alleSeitengestaltungen(quelle).map((g) => JSON.stringify(g[FELD[teil]]));
	return werte.every((w) => w === werte[0]);
};

/**
 * „Gilt für“ je Abschnitt: am Anfang „Alle Seiten“, wenn der Teil auf allen Seiten gleich ist, sonst „Seite N“. Neu
 * gerechnet wird nur beim Wechsel der Seite, nicht nach einer eigenen Änderung: Sonst spränge die Wahl um.
 */
export const useGiltFuer = (teil: SeitenTeil, quelle: string, index: number) => {
	const anfang = (): Gilt => (ueberallGleich(teil, quelle) ? 'alle' : 'seite');
	const [stand, setStand] = useState(() => ({ index, gilt: anfang() }));
	let { gilt } = stand;
	if (stand.index !== index) {
		// Beim Rendern, nicht im Effekt: So zeigt schon das erste Bild der neuen Seite ihren Wert.
		gilt = anfang();
		setStand({ index, gilt });
	}
	return [gilt, (neu: Gilt) => setStand({ index, gilt: neu })] as const;
};

/** Das Ziel einer Änderung: alle Seiten oder nur die angezeigte. */
export const zielVon = (gilt: Gilt, t: BlattTeile): Seiten => (gilt === 'alle' ? 'alle' : [t.seite]);
