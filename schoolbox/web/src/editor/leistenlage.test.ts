import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LEISTEN_ABSTAND, lageDerLeiste, schneiden } from './leistenlage';

const SICHT = { links: 0, rechts: 1000, oben: 0, unten: 800 };
const MASS = { breite: 300, hoehe: 30 };

describe('Lage der Leiste (204-15, 204-16)', () => {
	it('über dem Element, rechtsbündig', () => {
		const box = { links: 100, rechts: 700, oben: 200, unten: 300 };
		assert.deepEqual(lageDerLeiste(box, MASS, SICHT), { links: 400, top: 200 - 30 - LEISTEN_ABSTAND, wahl: 'oben:-300' });
	});

	it('ein schmales Element: Die Leiste beginnt an seiner linken Kante und bleibt im Sichtfeld', () => {
		const box = { links: 2, rechts: 60, oben: 200, unten: 230 };
		assert.equal(lageDerLeiste(box, MASS, SICHT).links, LEISTEN_ABSTAND);
		assert.equal(lageDerLeiste({ ...box, links: 500, rechts: 560 }, MASS, SICHT).links, 500);
	});

	it('kein Platz darüber: darunter; Gestaltung lässt Platz für den Drehgriff', () => {
		const box = { links: 100, rechts: 700, oben: 20, unten: 300 };
		assert.equal(lageDerLeiste(box, MASS, SICHT).top, 300 + LEISTEN_ABSTAND);
		const frei = { ...box, oben: 60 };
		assert.equal(lageDerLeiste(frei, MASS, SICHT).top, 60 - 30 - LEISTEN_ABSTAND);
		assert.equal(lageDerLeiste(frei, MASS, SICHT, 24).top, 300 + LEISTEN_ABSTAND);
	});
});

describe('Pille über der Leiste (200-03)', () => {
	const leiste = { left: 676, right: 900, top: 471, bottom: 501 };
	it('schneidet die Pille die Leiste, gilt sie als verdeckend; Berühren zählt nicht', () => {
		assert.equal(schneiden({ left: 676, right: 900, top: 466, bottom: 492 }, leiste), true);
		assert.equal(schneiden({ left: 676, right: 900, top: 445, bottom: 471 }, leiste), false);
		assert.equal(schneiden({ left: 100, right: 300, top: 466, bottom: 492 }, leiste), false);
	});
});

describe('Leiste verdeckt so wenig wie möglich (Schlussdurchsicht)', () => {
	const box = { links: 100, rechts: 700, oben: 200, unten: 300 };
	const seite = { links: 50, rechts: 750, oben: 0, unten: 1000 };
	it('Text über der rechten Hälfte: daneben über dem Element, nicht darauf', () => {
		const inhalt = [{ left: 400, right: 700, top: 160, bottom: 190 }];
		const lage = lageDerLeiste(box, MASS, SICHT, 0, { inhalt, seite });
		assert.equal(lage.top, 200 - 30 - LEISTEN_ABSTAND);
		assert.ok(lage.links + MASS.breite <= 400);
	});
	it('über dem ganzen Element Text: darunter', () => {
		const inhalt = [{ left: 50, right: 750, top: 160, bottom: 190 }];
		assert.equal(lageDerLeiste(box, MASS, SICHT, 0, { inhalt, seite }).top, 300 + LEISTEN_ABSTAND);
	});
	it('in der Textsitzung bleibt die Wahl, auch wenn jetzt anderes freier wäre', () => {
		const inhalt = [{ left: 50, right: 750, top: 160, bottom: 190 }];
		const lage = lageDerLeiste({ ...box, unten: 340 }, MASS, SICHT, 0, { inhalt, seite }, 'oben:-300');
		assert.deepEqual(lage, { links: 400, top: 200 - 30 - LEISTEN_ABSTAND, wahl: 'oben:-300' });
	});
});
