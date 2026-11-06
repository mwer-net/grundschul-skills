import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FORM, STREUUNG } from '../../web/e2e/gestaltung-daten';
import { setzeSw } from './gestaltung';
import {
	drehungImBereich,
	leseSw,
	leseUeberlagertOk,
	setzeUeberlagertOk,
	swStandard,
	swZumSchreiben,
} from './gestaltung-inspektor';
import { zerlege } from './quelltext';

const nrVon = (quelle: string, klasse: string) => {
	const k = zerlege(quelle).knoten.find((n) => n.attribute.some((a) => a.name === 'class' && a.wert === klasse));
	assert.ok(k, klasse);
	return k.nr;
};

describe('Inspektor bei Gestaltung (099)', () => {
	it('kennt den s/w-Standard je Art', () => {
		assert.equal(swStandard('seitenflaeche'), 'weg');
		assert.equal(swStandard('streuung'), 'weg');
		assert.equal(swStandard('form'), 'grau');
		assert.equal(swStandard('figurfrei'), 'grau');
	});

	it('schreibt data-sw nur, wenn es vom Standard abweicht', () => {
		const quelle = blattMit({ vorne: [FORM], hinten: [STREUUNG] });
		const form = nrVon(quelle, 'form');
		assert.equal(leseSw(quelle, form, 'form'), 'grau');
		const weg = setzeSw(quelle, form, swZumSchreiben('form', 'weg'));
		assert.match(weg, /data-sw="weg"/);
		assert.equal(leseSw(weg, form, 'form'), 'weg');
		assert.equal(setzeSw(weg, form, swZumSchreiben('form', 'grau')), quelle);
		assert.equal(leseSw(quelle, nrVon(quelle, 'streuung'), 'streuung'), 'weg');
	});

	it('setzt und entfernt data-ueberlagert-ok, ohne den Rest zu ändern', () => {
		const quelle = blattMit({ vorne: [FORM] });
		const nr = nrVon(quelle, 'form');
		const an = setzeUeberlagertOk(quelle, nr, true);
		assert.ok(leseUeberlagertOk(an, nr));
		assert.equal(setzeUeberlagertOk(an, nr, true), an);
		assert.equal(setzeUeberlagertOk(an, nr, false), quelle);
	});

	it('legt die Drehung in −180 bis 180 mit einer Nachkommastelle', () => {
		assert.equal(drehungImBereich(348), -12);
		assert.equal(drehungImBereich(-12), -12);
		assert.equal(drehungImBereich(450), 90);
		assert.equal(drehungImBereich(12.34), 12.3);
		assert.equal(drehungImBereich(0), 0);
		assert.equal(drehungImBereich(360), 0);
	});
});
