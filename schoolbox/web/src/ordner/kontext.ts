import { createContext, useContext } from 'react';

import type { AblageStand, Aktion, AktionsAntwort, Knoten } from './typen';

export interface Merkzettel {
	modus: 'ausschneiden' | 'kopieren';
	knoten: Knoten[];
}

export interface AktionsWahl {
	/** Baut die Meldung, sobald die Antwort da ist. Ohne: keine Meldung. */
	text?: (antwort: AktionsAntwort) => string;
	/** Der Fehler bleibt beim Aufrufer (Namensfeld), statt als Meldung zu erscheinen. */
	stillerFehler?: boolean;
	/** Geht nicht auf den Stapel für ⌘Z. */
	ohneUmkehr?: boolean;
}

export interface Benennen {
	schluessel: string;
	/** Frisch angelegt: Esc behält den Vorschlag, das Objekt sortiert sich erst danach ein. */
	neu: boolean;
	wo: 'feld' | 'baum' | 'dialog';
}

export interface AblageWerte {
	stand: AblageStand | null;
	fehler: string | null;
	neuLaden: () => void;
	/** Führt eine Aktion aus, sofort sichtbar. `null`: nicht geklappt (die Meldung ist raus, außer `stillerFehler`). */
	tu: (aktion: Aktion, wahl?: AktionsWahl) => Promise<AktionsAntwort | null>;
	rueckgaengig: () => Promise<void>;
	wiederholen: () => Promise<void>;
	kannRueckgaengig: boolean;
	kannWiederholen: boolean;
	merkzettel: Merkzettel | null;
	merke: (zettel: Merkzettel | null) => void;
	benennen: Benennen | null;
	setBenennen: (b: Benennen | null) => void;
}

const leer: AblageWerte = {
	stand: null,
	fehler: null,
	neuLaden: () => undefined,
	tu: () => Promise.resolve(null),
	rueckgaengig: () => Promise.resolve(),
	wiederholen: () => Promise.resolve(),
	kannRueckgaengig: false,
	kannWiederholen: false,
	merkzettel: null,
	merke: () => undefined,
	benennen: null,
	setBenennen: () => undefined,
};

export const AblageKontext = createContext<AblageWerte>(leer);

export const useAblage = () => useContext(AblageKontext);

/** Ordner, in dem das Dokument liegt; `null`, wenn es nicht in der Ablage steht. */
export const ortDesDokuments = (stand: AblageStand, mappe: string | null, dok: string) => {
	const eintrag = stand.dokumente.find((d) => d.mappe === mappe && d.id === dok);
	if (!eintrag) {
		return null;
	}
	const ordner = stand.ordner.find((o) => o.id === eintrag.ordner);
	return ordner ? { adresse: `/o/${ordner.id}`, name: ordner.name } : { adresse: '/', name: 'Mein Material' };
};

/** Wohin „←“ im Dokument führt. `null`: Teilen-Link oder der Stand ist noch nicht da. */
export const useOrdnerDesDokuments = (mappe: string | null, dok: string) => {
	const { stand } = useAblage();
	return stand ? ortDesDokuments(stand, mappe, dok) : null;
};
