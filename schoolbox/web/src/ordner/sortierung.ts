import type { SortierFeld, Sortierung } from '@schoolbox/kern/src/ordner-sortierung';
import { standardSortierung } from '@schoolbox/kern/src/ordner-sortierung';

import type { AblageOrdner, Darstellung } from './typen';

export const SORTIER_NAME: Record<SortierFeld, string> = {
	name: 'Name',
	geaendert: 'Geändert',
	erstellt: 'Erstellt',
	art: 'Art',
};

const FELDER = Object.keys(SORTIER_NAME) as SortierFeld[];
const WURZEL = 'wurzel';
const SORTIERUNG = 'schoolbox.ordner-sortierung:';
const DARSTELLUNG = 'schoolbox.ordner-darstellung';

type Speicher = Pick<Storage, 'getItem' | 'setItem'>;

export const leseSortierung = (ordner: AblageOrdner | null, speicher: Speicher = localStorage): Sortierung => {
	try {
		const roh = JSON.parse(
			speicher.getItem(`${SORTIERUNG}${ordner?.id ?? WURZEL}`) ?? 'null',
		) as Partial<Sortierung> | null;
		if (roh && FELDER.includes(roh.feld as SortierFeld) && typeof roh.auf === 'boolean') {
			return { feld: roh.feld as SortierFeld, auf: roh.auf };
		}
	} catch {
		// Kaputtes im Speicher ist die Standardsortierung.
	}
	return standardSortierung(ordner);
};

export const schreibeSortierung = (id: string | null, sortierung: Sortierung, speicher: Speicher = localStorage) => {
	try {
		speicher.setItem(`${SORTIERUNG}${id ?? WURZEL}`, JSON.stringify(sortierung));
	} catch {
		// Voller Speicher: Die Sortierung ist Bequemlichkeit.
	}
};

/** Zweiter Klick auf dieselbe Spalte dreht die Richtung. Geändert beginnt mit dem Neuesten. */
export const naechsteSortierung = (jetzt: Sortierung, feld: SortierFeld): Sortierung =>
	jetzt.feld === feld ? { feld, auf: !jetzt.auf } : { feld, auf: feld !== 'geaendert' };

export const leseDarstellung = (speicher: Speicher = localStorage): Darstellung => {
	try {
		return speicher.getItem(DARSTELLUNG) === 'liste' ? 'liste' : 'kacheln';
	} catch {
		return 'kacheln';
	}
};

export const schreibeDarstellung = (wert: Darstellung, speicher: Speicher = localStorage) => {
	try {
		speicher.setItem(DARSTELLUNG, wert);
	} catch {
		// Siehe oben.
	}
};

export const leseMenge = (name: string, speicher: Speicher = localStorage) => {
	try {
		const roh = JSON.parse(speicher.getItem(`schoolbox.${name}`) ?? '[]') as unknown;
		return new Set(Array.isArray(roh) ? roh.filter((s): s is string => typeof s === 'string') : []);
	} catch {
		return new Set<string>();
	}
};

export const schreibeMenge = (name: string, menge: ReadonlySet<string>, speicher: Speicher = localStorage) => {
	try {
		speicher.setItem(`schoolbox.${name}`, JSON.stringify([...menge]));
	} catch {
		// Siehe oben.
	}
};
