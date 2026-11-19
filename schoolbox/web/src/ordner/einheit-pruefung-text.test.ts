import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fachlichOffenSatz } from './einheit-pruefung-text';

describe('Prüfung der Einheit: Texte', () => {
	it('Satz über offene fachliche Befunde mit Leerzeichen vor „fachlich prüfen“', () => {
		assert.equal(
			fachlichOffenSatz(1),
			'Ein fachlicher Befund nach den Korrekturrunden offen: bitte fachlich prüfen.',
		);
		assert.equal(
			fachlichOffenSatz(3),
			'3 fachliche Befunde nach den Korrekturrunden offen: bitte fachlich prüfen.',
		);
	});
});
