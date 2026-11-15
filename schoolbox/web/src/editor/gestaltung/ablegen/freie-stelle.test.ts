import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freieStelle, MINDESTBREITE } from './freie-stelle';

const SEITE = { links: 0, rechts: 600, oben: 0, unten: 800 };

describe('Freie Stelle für ein eingefügtes Bild (S-10)', () => {
	it('liegt nicht auf dem Inhalt, sondern im großen freien Teil', () => {
		const inhalt = [{ links: 0, rechts: 600, oben: 0, unten: 400 }];
		const stelle = freieStelle(SEITE, inhalt, 200, 200, true);
		assert.ok(stelle);
		assert.equal(stelle.breite, 200);
		assert.ok(stelle.y - 100 >= 400, `oben ${stelle.y - 100}`);
	});

	it('ein Bild wird kleiner, wenn es sonst nirgends Platz hat; nie kleiner als die Mindestbreite', () => {
		const inhalt = [{ links: 0, rechts: 600, oben: 0, unten: 650 }];
		const stelle = freieStelle(SEITE, inhalt, 320, 320, true);
		assert.ok(stelle);
		assert.ok(stelle.breite < 320 && stelle.breite >= MINDESTBREITE);
		assert.equal(freieStelle(SEITE, [{ ...SEITE, unten: 760 }], 320, 320, true), null);
	});

	it('anderes als ein Bild schrumpft nicht', () => {
		const inhalt = [{ links: 0, rechts: 600, oben: 0, unten: 650 }];
		assert.equal(freieStelle(SEITE, inhalt, 320, 320, false), null);
	});
});
