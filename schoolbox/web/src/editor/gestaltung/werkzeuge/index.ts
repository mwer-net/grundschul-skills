import { werkzeug as auswahl } from './auswahl';
import { werkzeug as ellipse } from './ellipse';
import { werkzeug as linie } from './linie';
import { werkzeug as pfad } from './pfad';
import { werkzeug as rechteck } from './rechteck';
import { werkzeug as stern } from './stern';
import { werkzeug as stift } from './stift';
import { werkzeug as streuen } from './streuen';
import { werkzeug as test } from './test';
import { werkzeug as text } from './text';
import type { Werkzeug } from './typ';
import { werkzeug as vieleck } from './vieleck';

export type { Entwurf, Punkt, Strich, Tasten, Werkzeug } from './typ';

export const AUSWAHL = 'auswahl';

/** Alles außer V, in der Reihenfolge der Knöpfe (5.10). Ein Ticket füllt nur seine Datei und trägt hier nichts ein. */
const ZEICHNEN: readonly Werkzeug[] = [
	rechteck,
	ellipse,
	vieleck,
	linie,
	stern,
	text,
	stift,
	pfad,
	streuen,
	test,
].filter((w): w is Werkzeug => w !== null);

/**
 * Die Werkzeuge (098, Andockstelle): V und alle, die ein Ticket gefüllt hat. V ist bereit, sobald ein anderes
 * Werkzeug bereit ist; ohne Werkzeuge gibt es auch V nirgends.
 */
export const WERKZEUGE: readonly Werkzeug[] = [
	{ ...auswahl, bereit: (k) => ZEICHNEN.some((w) => w.bereit(k)) },
	...ZEICHNEN,
];

export const werkzeugVon = (id: string) => WERKZEUGE.find((w) => w.id === id);
