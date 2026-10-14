import { createContext, useContext } from 'react';

export interface Hinweis {
	text: string;
	art?: 'info' | 'fehler';
	/** Ein Knopf in der Leiste, z. B. „Rückgängig“. */
	aktion?: { titel: string; ausfuehren: () => void };
}

export type ZeigeHinweis = (hinweis: Hinweis) => void;

export const HinweisKontext = createContext<ZeigeHinweis>(() => undefined);

/** Zeigt unten auf der Seite kurz eine Meldung; sie bleibt auch beim Wechsel der Seite stehen. */
export const useHinweis = () => useContext(HinweisKontext);
