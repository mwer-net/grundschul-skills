import { dupliziereGestaltung, fuerAlle, loescheGestaltung } from '@schoolbox/kern/src/gestaltung';

import type { Befehl } from '../../befehle';
import type { GestaltungKontext } from '../kontext';
import { leereMehrfach, setzeMehrfach } from '../mehrfach';

/**
 * Bewegen (097): nichts Neues. Duplizieren (⌘D) und Löschen (⌫) gelten für Gestaltung schon über `auswahl.duplizieren`
 * und `auswahl.loeschen` (Kern: `dupliziereBaustein` → `dupliziereGestaltung`, 092). Esc (`auswahl.eltern`) geht zur
 * Seite, weil `pfadZu` die Ebene überspringt. Ziehen, Größe und Drehen sind Gesten (`useGeste.ts`), keine Befehle.
 */
export const BEWEGEN_BEFEHLE: Befehl[] = [];

/** 113: Mehr als ein Gestaltungselement gewählt? Dann gehen Löschen und Duplizieren hierher statt an den Baustein. */
export const mehrereGewaehlt = (g: GestaltungKontext | null): g is GestaltungKontext => (g?.nrn.length ?? 0) > 1;

/** 113: Alle Gewählten löschen, ein Schritt; danach ist nichts gewählt. */
export const loescheAlle = (g: GestaltungKontext) => {
	const geklappt = g.fuehreAus(`${g.nrn.length} Elemente gelöscht`, (q) => ({
		quelle: fuerAlle(q, g.nrn, loescheGestaltung).quelle,
		nr: null,
	}));
	if (geklappt) {
		leereMehrfach();
	}
	return geklappt;
};

/** 113: Alle Gewählten duplizieren, ein Schritt; gewählt sind danach die Kopien (die Nummern kommen aus `fuerAlle`). */
export const dupliziereAlle = (g: GestaltungKontext) => {
	let kopien: (number | null)[] = [];
	const geklappt = g.fuehreAus('Kopiert', (q) => {
		const r = fuerAlle(q, g.nrn, dupliziereGestaltung);
		kopien = r.alle;
		return { quelle: r.quelle, nr: r.nr };
	});
	const [haupt, ...dazu] = kopien;
	if (geklappt && haupt !== null && haupt !== undefined) {
		setzeMehrfach(
			haupt,
			dazu.filter((n): n is number => n !== null),
		);
	}
	return geklappt;
};
