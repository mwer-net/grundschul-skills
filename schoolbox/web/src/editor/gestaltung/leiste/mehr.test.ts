import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Befehl } from '../../befehle';
import { BEFEHLE } from '../../befehle';
import { ordneMehr } from './mehr';

describe('⋯ der Leiste am Element (099)', () => {
	it('ordnet die vorhandenen Befehle wie Briefing 5.7, „Claude fragen“ zuletzt', () => {
		const vorhanden = ['auswahl.duplizieren', 'auswahl.kopieren', 'auswahl.loeschen', 'auswahl.claude'];
		const ids = ordneMehr(BEFEHLE.filter((b) => b.orte.includes('gestaltung'))).map((x) => x.befehl.id);
		assert.deepEqual(
			ids.filter((id) => vorhanden.includes(id)),
			vorhanden,
		);
		assert.equal(ids.at(-1), 'auswahl.claude');
	});

	it('stellt Unbekanntes vor „Claude fragen“, Bekanntes an seinen Platz', () => {
		const befehl = (id: string) => ({ id }) as Befehl;
		const liste = ['auswahl.claude', 'auswahl.neu', 'auswahl.sperren', 'auswahl.duplizieren'].map(befehl);
		assert.deepEqual(
			ordneMehr(liste).map((x) => x.befehl.id),
			['auswahl.duplizieren', 'auswahl.sperren', 'auswahl.neu', 'auswahl.claude'],
		);
	});
});
