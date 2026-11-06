import type { Befehl, Kontext, Kuerzel } from '../../befehle';
import { JEDE_LAGE } from '../../schubladen';
import type { Werkzeug } from './typ';
import { AUSWAHL, WERKZEUGE } from '.';
import { waehleWerkzeug, werkzeugStand } from './stand';

/** Buchstaben ohne Umschalttaste nie beim Tippen: keine Textsitzung, kein Feld mit eigenem Undo (5.10). */
const tippfrei = (k: Kontext) => !k.textsitzung && !k.feldBehaeltUndo();

const gleich = (a: Kuerzel, b: Kuerzel) =>
	a.code === b.code &&
	a.key === b.key &&
	Boolean(a.umschalt) === Boolean(b.umschalt) &&
	Boolean(a.wahl) === Boolean(b.wahl) &&
	Boolean(a.befehl) === Boolean(b.befehl);

/**
 * Die Tasten eines Werkzeugs: die eigene, dazu dieselbe mit ⇧ zum Halten, außer ⇧ gehört schon einem anderen
 * Werkzeug (⇧P ist der Pfad, P der Stift). `befehl: false` ausdrücklich: V darf ⌘V nicht stören.
 */
const tastenVon = (w: Werkzeug, alle: readonly Werkzeug[]): Kuerzel[] => {
	if (!w.taste) {
		return [];
	}
	const eigene: Kuerzel = { ...w.taste, befehl: false, wenn: tippfrei };
	const mitUmschalt: Kuerzel = { ...eigene, umschalt: true };
	const frei =
		w.id !== AUSWAHL && !w.taste.umschalt && !alle.some((a) => a !== w && a.taste && gleich(a.taste, mitUmschalt));
	return frei ? [eigene, mitUmschalt] : [eigene];
};

/** Für jedes Werkzeug genau ein Befehl `werkzeug.<id>`; mit einer Zeile in `BEFEHLE` eingehängt. */
export const befehleFuerWerkzeuge = (alle: readonly Werkzeug[]): Befehl[] =>
	alle.map((w): Befehl => {
		const verfuegbar = (k: Kontext) => k.aktiv && w.bereit(k);
		const kuerzel = tastenVon(w, alle);
		return {
			id: `werkzeug.${w.id}`,
			titel: w.titel,
			gruppe: 'blatt',
			symbol: w.symbol,
			...(kuerzel.length > 0 ? { kuerzel } : {}),
			// Ein Werkzeug, das es noch nicht gibt, lässt seine Taste dem Browser.
			tasteWenn: verfuegbar,
			suchwoerter: ['werkzeug', 'zeichnen'],
			orte: kuerzel.length > 0 ? ['taste', 'palette'] : ['palette'],
			sichtbarUnter: 'links',
			verfuegbar,
			aus: (_k, taste) => waehleWerkzeug(w.id, Boolean(taste?.shiftKey)),
			aktiv: () => werkzeugStand().id === w.id,
			inUebersicht: () => w.bereit(JEDE_LAGE),
		};
	});

export const WERKZEUG_BEFEHLE: Befehl[] = befehleFuerWerkzeuge(WERKZEUGE);
