import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlanPruefStand } from '@schoolbox/kern/src/einheit-plan-pruefung';

import { planPruefAnzeige, punktKopf } from './einheit-plan-pruefung-text';

const STAND: PlanPruefStand = {
	pruefung: 'fertig',
	grund: null,
	geaendert: false,
	punkte: [
		{ von: 'rechnung', text: 'Stunde 1 braucht 75 min von 45.', stand: 'behoben' },
		{
			von: 'pruefung',
			text: 'Die Leitfigur fehlt.',
			art: 'auftrag',
			wo: 'Figuren',
			stand: 'offen',
			antwort: 'Bleibt.',
		},
	],
};

describe('Geprüft im Plan (247)', () => {
	it('ohne Stand nichts', () => {
		assert.equal(planPruefAnzeige(undefined), null);
	});

	it('offen und behoben getrennt, mit Zahl im Titel', () => {
		const a = planPruefAnzeige(STAND);
		assert.equal(a?.titel, 'Geprüft: 1 Hinweis offen, 1 behoben');
		assert.deepEqual(
			a?.offen.map((p) => p.text),
			['Die Leitfigur fehlt.'],
		);
		assert.deepEqual(
			a?.behoben.map((p) => p.text),
			['Stunde 1 braucht 75 min von 45.'],
		);
		assert.equal(a?.hinweis, null);
		assert.deepEqual(a?.offen.map(punktKopf), ['Figuren · Gegen den Auftrag']);
		assert.deepEqual(a?.behoben.map(punktKopf), ['Nachgerechnet']);
	});

	it('gescheitert und geändert stehen als Satz da; ohne Punkte „nichts gefunden“', () => {
		const a = planPruefAnzeige({
			...STAND,
			pruefung: 'gescheitert',
			grund: 'Abgebrochen.',
			geaendert: true,
			punkte: [],
		});
		assert.equal(a?.titel, 'Geprüft: nichts gefunden');
		assert.equal(
			a?.hinweis,
			'Die Prüfung mit frischem Blick hat diesmal nicht geklappt (Abgebrochen); nachgerechnet hat die Schoolbox trotzdem. Nach deiner Änderung neu nachgerechnet; die Hinweise der Prüfung stammen vom Plan davor.',
		);
	});
});
