import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Befehl } from '../../befehle';
import { BEFEHLE, ordneGestaltung } from '../../befehle';

describe('⋯ und Rechtsklick am Gestaltungselement (204-10)', () => {
	it('ordnet wie die Baustein-Liste: Bearbeiten, Ablage, Reihenfolge … Sammlung, Claude, Löschen zuletzt', () => {
		const vorhanden = [
			'auswahl.bearbeiten',
			'auswahl.duplizieren',
			'auswahl.ausschneiden',
			'auswahl.kopieren',
			'auswahl.nach-vorne',
			'auswahl.sperren',
			'auswahl.in-sammlung',
			'auswahl.claude',
			'auswahl.loeschen',
		];
		const ids = ordneGestaltung(BEFEHLE.filter((b) => b.orte.includes('gestaltung'))).map((x) => x.befehl.id);
		assert.deepEqual(
			ids.filter((id) => vorhanden.includes(id)),
			vorhanden,
		);
		assert.equal(ids.at(-1), 'auswahl.loeschen');
	});

	it('„Ganz nach vorne/hinten“ und Kombinieren stehen nicht im Menü, Gruppieren und Auflösen schon (198-08)', () => {
		const ids = ordneGestaltung(BEFEHLE.filter((b) => b.orte.includes('gestaltung'))).map((x) => x.befehl.id);
		for (const id of ['auswahl.ganz-vorne', 'auswahl.ganz-hinten', 'auswahl.vereinen', 'auswahl.abziehen']) {
			assert.equal(ids.includes(id), false, id);
		}
		for (const id of ['auswahl.gruppieren', 'auswahl.gruppe-aufloesen']) {
			assert.equal(ids.includes(id), true, id);
		}
	});

	it('stellt Unbekanntes vor „In Sammlung legen“, Bekanntes an seinen Platz', () => {
		const befehl = (id: string) => ({ id }) as Befehl;
		const liste = ['auswahl.loeschen', 'auswahl.claude', 'auswahl.neu', 'auswahl.sperren', 'auswahl.duplizieren'];
		assert.deepEqual(
			ordneGestaltung(liste.map(befehl)).map((x) => x.befehl.id),
			['auswahl.duplizieren', 'auswahl.sperren', 'auswahl.neu', 'auswahl.claude', 'auswahl.loeschen'],
		);
	});
});
