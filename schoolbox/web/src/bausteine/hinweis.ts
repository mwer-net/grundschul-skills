import { createContext, useContext } from 'react';

export interface Hinweis {
	text: string;
	art?: 'info' | 'fehler';
	/** Ein Knopf in der Leiste, z. B. „Rückgängig“. */
	aktion?: { titel: string; ausfuehren: () => void };
	/** Gehört zum jüngsten Schritt im Verlauf („Rückgängig“): Mit dem nächsten Schritt geht sie weg (194-06). */
	zumSchritt?: true;
}

export type ZeigeHinweis = (hinweis: Hinweis) => void;

export const HinweisKontext = createContext<ZeigeHinweis>(() => undefined);

/** Zeigt unten auf der Seite kurz eine Meldung; sie bleibt auch beim Wechsel der Seite stehen. */
export const useHinweis = () => useContext(HinweisKontext);

export const SchrittKontext = createContext<() => void>(() => undefined);

/** Ein neuer Schritt im Verlauf: Eine Meldung, deren „Rückgängig“ dem vorigen galt, geht weg (194-06). */
export const useNeuerSchritt = () => useContext(SchrittKontext);
