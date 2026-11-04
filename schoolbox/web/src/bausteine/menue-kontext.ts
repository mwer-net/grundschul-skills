import { createContext, useContext } from 'react';

import type { MenueEintrag } from './Menue';

export interface Punkt {
	x: number;
	y: number;
}

export type ZeigeMenue = (punkt: Punkt, eintraege: MenueEintrag[], fokusZurueck?: () => void) => void;

export const MenueKontext = createContext<ZeigeMenue>(() => undefined);

/** Öffnet ein Menü an Koordinaten im Elternfenster, zum Beispiel beim Rechtsklick. */
export const useZeigeMenue = () => useContext(MenueKontext);
