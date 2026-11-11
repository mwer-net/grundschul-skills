import type { Werkzeug } from './typ';

/** V: das Standard-Werkzeug. Wählen und Bewegen sind die Gesten des Blatts (097); hier zieht nichts etwas auf. */
export const werkzeug: Werkzeug = {
	id: 'auswahl',
	titel: 'Auswahl',
	symbol: 'auswahl',
	taste: { code: 'KeyV' },
	zeiger: 'default',
	// Steht im Register (`index.ts`): bereit, sobald es ein anderes Werkzeug gibt.
	bereit: () => true,
	beginne: () => undefined,
	bewege: () => null,
	ende: () => null,
};
