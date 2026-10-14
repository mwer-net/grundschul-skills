import { useOutletContext } from 'react-router-dom';

export interface SucheKontext {
	suche: string;
	setSuche: (suche: string) => void;
}

/** Der Suchtext aus der Kopfzeile. Er bleibt stehen, während man eine Mappe öffnet und zurückkommt. */
export const useSuche = () => useOutletContext<SucheKontext>();
