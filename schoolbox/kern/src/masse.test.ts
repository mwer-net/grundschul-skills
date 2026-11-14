import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cmZuPx, grenzenInCm, inCm, liesZahl, pxZuCm, rasteEin, zahlMitKomma } from './masse';

describe('Maße im Inspektor (197-U3, 196-28, 196-29)', () => {
	it('rechnet px in cm mit einer Nachkommastelle und zurück', () => {
		assert.equal(pxZuCm(378), 10);
		assert.equal(pxZuCm(160), 4.2);
		assert.equal(cmZuPx(10), 378);
	});

	it('rastet auf den Schritt ein, ohne Rechenrest, und hält die Grenzen', () => {
		assert.equal(rasteEin(0.25, { min: 0, max: 50, schritt: 0.5 }), 0.5);
		assert.equal(rasteEin(0.1 + 0.2, { min: 0, max: 1, schritt: 0.1 }), 0.3);
		assert.equal(rasteEin(999, { min: 1, max: 6, schritt: 1 }), 6);
		assert.equal(rasteEin(0, { min: 1, max: 6, schritt: 1 }), 1);
	});

	it('liest Komma und Punkt, leer und Text sind keine Zahl', () => {
		assert.equal(liesZahl('6,5'), 6.5);
		assert.equal(liesZahl('6.5'), 6.5);
		assert.equal(liesZahl('−2'), -2);
		assert.ok(Number.isNaN(liesZahl('')));
		assert.ok(Number.isNaN(liesZahl('abc')));
		assert.equal(zahlMitKomma(6.5), '6,5');
	});

	it('Grenzen in cm liegen umgerechnet innerhalb der px-Grenzen', () => {
		const g = grenzenInCm({ min: 40, max: 600, schritt: 10 });
		assert.ok(cmZuPx(g.min) >= 40 && cmZuPx(g.max) <= 600);
		assert.ok(g.schritt >= 0.1);
	});

	it('Schriftgrößen bleiben px, alle anderen px-Maße erscheinen in cm', () => {
		assert.equal(inCm({ einheit: 'px', attribut: 'hoehe' }), true);
		assert.equal(inCm({ einheit: 'px', attribut: 'schrift' }), false);
		assert.equal(inCm({ einheit: '%', attribut: 'breite' }), false);
	});
});
