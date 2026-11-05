import { createContext, useContext } from 'react';

import type { Knoten, Aktion, AktionsAntwort, AblageStand } from './typen';

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
	wo: 'feld' | 'baum';
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
