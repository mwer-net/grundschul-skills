import type { SymbolName } from '../../../bausteine/Symbol';
import { ablegenEintrag } from '../../gestaltung/ablegen/ablegen';
import type { Eintrag } from './Blasen-daten';
import { EINTRAEGE, gutVon, namenVon } from './Blasen-daten';
import { Kacheln } from './Blasen-teile';
import type { FormenAbschnitt } from './typ';
import { GRUPPE, passtZurSuche } from './typ';

export const symbolVon = (e: Eintrag): SymbolName => {
	if (e.art === 'linie') {
		return e.ende ? 'pfeil' : 'linie';
	}
	if (e.blase === 'gedanke') {
		return 'denkblase';
	}
	return e.art === 'band' ? 'band' : 'sprechblase';
};

/** 107, 198-18: Abschnitt „Sprechblasen“ der Schublade „Werkzeuge“. Klick legt in die Mitte, Ziehen legt frei ab. */
export const abschnitt: FormenAbschnitt | null = {
	id: 'blasen',
	titel: 'Sprechblasen',
	zeigt: ({ suche }) => EINTRAEGE.some((e) => passtZurSuche(namenVon(e), suche)),
	Inhalt: Kacheln,
	suche: (z) =>
		EINTRAEGE.map((e) => ({
			...ablegenEintrag(gutVon(e, undefined), z, GRUPPE),
			symbol: symbolVon(e),
			suchwoerter: namenVon(e).slice(1),
		})),
};
