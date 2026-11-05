import type { Merkzettel } from './kontext';

/** Eigene Ablage, getrennt von der Baustein-Ablage des Editors (`schoolbox.zwischenablage`). */
const SCHLUESSEL = 'schoolbox.ordner-ablage';

export const leseMerkzettel = (speicher: Pick<Storage, 'getItem'> = localStorage): Merkzettel | null => {
	try {
		const roh = JSON.parse(speicher.getItem(SCHLUESSEL) ?? 'null') as Partial<Merkzettel> | null;
		if ((roh?.modus === 'ausschneiden' || roh?.modus === 'kopieren') && Array.isArray(roh.knoten)) {
			return { modus: roh.modus, knoten: roh.knoten };
		}
	} catch {
		// Kaputtes im Speicher ist eine leere Ablage.
	}
	return null;
};

export const schreibeMerkzettel = (
	zettel: Merkzettel | null,
	speicher: Pick<Storage, 'removeItem' | 'setItem'> = localStorage,
) => {
	try {
		if (zettel) {
			speicher.setItem(SCHLUESSEL, JSON.stringify(zettel));
		} else {
			speicher.removeItem(SCHLUESSEL);
		}
	} catch {
		// Voller Speicher: Der Zettel gilt dann nur auf dieser Seite.
	}
};
