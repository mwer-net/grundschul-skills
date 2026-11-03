import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bausteinNach, kannImFormat } from './bausteine';

describe('kannImFormat', () => {
	const seite = bausteinNach('seite');
	const aufgabe = bausteinNach('aufgabe');
	assert.ok(seite && aufgabe);

	it('lässt die Seiten eines Mini-Books ordnen, aber nicht vermehren oder löschen', () => {
		assert.equal(kannImFormat(seite, 'ordnen', 'minibuch'), true);
		assert.equal(kannImFormat(seite, 'hinzufuegen', 'minibuch'), false);
		assert.equal(kannImFormat(seite, 'duplizieren', 'minibuch'), false);
		assert.equal(kannImFormat(seite, 'loeschen', 'minibuch'), false);
	});

	it('ändert nichts an anderen Formaten und anderen Bausteinen', () => {
		assert.equal(kannImFormat(seite, 'loeschen', 'a4-hoch'), true);
		assert.equal(kannImFormat(seite, 'hinzufuegen', 'folie'), true);
		assert.equal(kannImFormat(aufgabe, 'loeschen', 'minibuch'), true);
	});
});
