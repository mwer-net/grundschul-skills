import type { Baustein } from '@schoolbox/kern/src/bausteine';
import type { ComponentType } from 'react';

import type { GestaltungKontext } from './kontext-ersatz';

/** Was ein Teil des Inspektors bekommt. `aktiv`: Die Quelle darf gerade geändert werden. */
export interface InspektorTeile {
	k: GestaltungKontext;
	quelle: string;
	aktiv: boolean;
}

/** Die Abschnitte 2 bis 9 (Briefing 5.8, Entscheidung 31, 185); 1 ist der Pfad, den `Inspektor.tsx` schon zeigt. */
export type AbschnittNr = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Ein Teil des Gestaltungs-Inspektors. Jedes Arten-Ticket trägt seine Teile in seine eigene Datei ein. */
export interface InspektorTeil {
	/** Eindeutig, für React und Tests. */
	id: string;
	abschnitt: AbschnittNr;
	/** Reihenfolge innerhalb des Abschnitts, aufsteigend. */
	reihenfolge: number;
	fuer: (art: string, baustein: Baustein) => boolean;
	Inhalt: ComponentType<InspektorTeile>;
	/**
	 * 113: Kann der Teil eine Mehrfachauswahl (`k.nrn`)? Nur dann erscheint er dort, und nur, wenn `fuer` für jedes
	 * gewählte Element gilt. Ohne Angabe: nein, denn bisherige Teile ändern nur `k.nr`.
	 */
	mehrfach?: boolean;
}

/**
 * Titel und `data-abschnitt` je Abschnitt, in fester Reihenfolge (Entscheidung 31): erst was die Art ausmacht (Form,
 * Text, Bild, Streuung), dann Füllung und Kontur, Aussehen (Schatten, Deckkraft), Anordnen (Ebene, Lage, Größe, Anker)
 * und Sichtbarkeit wie bei den Bausteinen. Vorbild ist Canva, „Anordnen“ heißt es in Keynote (161).
 */
export const ABSCHNITTE: Record<AbschnittNr, { name: string; titel: string }> = {
	2: { name: 'form', titel: 'Form' },
	3: { name: 'text', titel: 'Text' },
	4: { name: 'bild', titel: 'Bild' },
	5: { name: 'streuung', titel: 'Streuung' },
	6: { name: 'fuellung', titel: 'Füllung und Kontur' },
	7: { name: 'aussehen', titel: 'Aussehen' },
	8: { name: 'anordnen', titel: 'Anordnen' },
	9: { name: 'sichtbarkeit', titel: 'Sichtbarkeit' },
};

export interface Gruppe {
	nr: AbschnittNr;
	name: string;
	titel: string;
	teile: InspektorTeil[];
}

/** Die Teile für diese Art, nach Abschnitt gruppiert und sortiert. Abschnitte ohne Teil fehlen. */
export const gruppiere = (teile: readonly InspektorTeil[], art: string, baustein: Baustein): Gruppe[] => {
	const passend = teile.filter((t) => t.fuer(art, baustein));
	return (Object.keys(ABSCHNITTE).map(Number) as AbschnittNr[])
		.sort((a, b) => a - b)
		.map((nr) => ({
			nr,
			...ABSCHNITTE[nr],
			teile: passend.filter((t) => t.abschnitt === nr).sort((a, b) => a.reihenfolge - b.reihenfolge),
		}))
		.filter((g) => g.teile.length > 0);
};

/** 113: Die Gruppen bei Mehrfachauswahl: nur Teile mit `mehrfach`, deren `fuer` für jede gewählte Art gilt. */
export const gruppiereMehrfach = (
	teile: readonly InspektorTeil[],
	arten: readonly { art: string; baustein: Baustein }[],
) =>
	(Object.keys(ABSCHNITTE).map(Number) as AbschnittNr[])
		.sort((a, b) => a - b)
		.map((nr) => ({
			nr,
			...ABSCHNITTE[nr],
			teile: teile
				.filter((t) => t.mehrfach && t.abschnitt === nr && arten.every((a) => t.fuer(a.art, a.baustein)))
				.sort((a, b) => a.reihenfolge - b.reihenfolge),
		}))
		.filter((g) => g.teile.length > 0);
