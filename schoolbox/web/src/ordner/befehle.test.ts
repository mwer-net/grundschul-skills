import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BEFEHLE, MENUE, tastenAbschnitte } from './befehle';

describe('Befehle der Ablage', () => {
	it('jeder Befehl mit Taste steht in der Tastenliste (Entscheidung 30)', () => {
		const inListe = new Set(tastenAbschnitte().flatMap((a) => a.befehle.map((z) => z.id)));
		for (const b of BEFEHLE) {
			if (b.kuerzel?.length) {
				assert.ok(inListe.has(b.id), `${b.id} fehlt in der Tastenliste`);
			}
		}
	});

	it('Menüs nennen nur vorhandene Befehle, jede Art hat ihre Liste', () => {
		const ids = new Set(BEFEHLE.map((b) => b.id));
		for (const [art, gruppen] of Object.entries(MENUE)) {
			assert.ok(gruppen.length > 0, art);
			for (const id of gruppen.flat()) {
				assert.ok(ids.has(id), `${art}: ${id} gibt es nicht`);
			}
		}
	});

	it('jeder Befehl ohne Taste steht in mindestens einem Menü oder hat eine eigene Oberfläche', () => {
		const imMenue = new Set(Object.values(MENUE).flatMap((g) => g.flat()));
		for (const b of BEFEHLE) {
			if (!b.kuerzel?.length) {
				assert.ok(imMenue.has(b.id), `${b.id} ist nirgends zu erreichen`);
			}
		}
	});
});
