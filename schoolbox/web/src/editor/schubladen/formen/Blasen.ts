import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { Eintrag } from './Blasen-daten';
import { EINTRAEGE, gutVon, namenVon } from './Blasen-daten';
import { Kacheln } from './Blasen-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

const symbolVon = (e: Eintrag) => {
	if (e.art === 'linie') {
		return e.ende ? 'pfeil' : 'linie';
	}
	if (e.blase === 'gedanke') {
		return 'denkblase';
	}
	return e.art === 'band' ? 'band' : 'sprechblase';
};

/** 107: Abschnitt „Blasen und Linien“ der Schublade „Werkzeuge“. Klick legt in die Mitte, Ziehen legt frei ab. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'blasen',
	titel: 'Blasen und Linien',
	zeigt: ({ suche }) => EINTRAEGE.some((e) => passtZurSuche(namenVon(e), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		EINTRAEGE.map((e) => ({
			...ablegenEintrag(gutVon(e, undefined), z, GRUPPE),
			symbol: symbolVon(e),
			suchwoerter: namenVon(e).slice(1),
		})),
};
