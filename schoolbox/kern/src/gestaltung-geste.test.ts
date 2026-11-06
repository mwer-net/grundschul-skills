import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FIGUR_FREI, FORM, SCHMUCK_STEMPEL } from '../../web/e2e/gestaltung-daten';
import { kopiereGestaltungNach, leseLage, setzeStilWerte } from './gestaltung';
import { klassenVon, zerlege } from './quelltext';

const nrMit = (quelle: string, teil: string) => {
	const z = zerlege(quelle);
	const k = z.knoten.find((n) => quelle.slice(n.start, n.oeffnerEnde).includes(teil));
	assert.ok(k, teil);
	return k.nr;
};

/** Zwei Seiten, die Gestaltung auf der ersten. */
const zweiSeiten = (quelle: string) =>
	quelle.replace('</section>', '</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span></div>\n</section>');

describe('setzeStilWerte (097)', () => {
	it('ändert --gr an seiner Stelle und lässt die Lage stehen', () => {
		const q = blattMit({ vorne: [SCHMUCK_STEMPEL] });
		const nr = nrMit(q, 'data-schmuck="stempel"');
		const neu = setzeStilWerte(q, nr, { '--gr': '42px' });
		assert.ok(neu.includes('style="--x:560px;--y:960px;--gr:42px;--drehen:-8deg"'));
		assert.equal(setzeStilWerte(q, nr, { '--gr': '28px' }), q);
	});

	it('hängt Neues ans Ende und entfernt mit null', () => {
		const q = blattMit({ vorne: [SCHMUCK_STEMPEL] });
		const nr = nrMit(q, 'data-schmuck="stempel"');
		const neu = setzeStilWerte(q, nr, { '--farbe': 'red', '--gr': null });
		assert.ok(neu.includes('style="--x:560px;--y:960px;--drehen:-8deg;--farbe:red"'));
	});
});

describe('kopiereGestaltungNach (097)', () => {
	it('legt eine Kopie an der neuen Lage ab, das Original bleibt', () => {
		const q = blattMit({ vorne: [FIGUR_FREI, FORM] });
		const nr = nrMit(q, 'data-figur="wilma"');
		const { nr: kopie, quelle } = kopiereGestaltungNach(q, nr, { x: 300, y: 400 });
		assert.ok(kopie !== null);
		assert.deepEqual(leseLage(quelle, kopie), { x: 300, y: 400, b: 150, spiegeln: -1 });
		assert.equal(quelle.split('data-figur="wilma"').length, 3);
		assert.deepEqual(leseLage(quelle, nrMit(quelle, 'data-figur="wilma"')), { x: 610, y: 520, b: 150, spiegeln: -1 });
	});

	it('mit Seite: die Kopie liegt auf der anderen Seite in derselben Ebene', () => {
		const q = zweiSeiten(blattMit({ vorne: [FIGUR_FREI] }));
		const z = zerlege(q);
		const seiten = z.knoten.filter((k) => klassenVon(k).includes('seite'));
		const zweite = seiten[1];
		assert.ok(zweite);
		const nr = nrMit(q, 'data-figur="wilma"');
		const { nr: kopie, quelle } = kopiereGestaltungNach(q, nr, { x: 20, y: 30 }, zweite.nr);
		assert.ok(kopie !== null);
		const neu = zerlege(quelle);
		const k = neu.knoten[kopie];
		assert.ok(k);
		assert.ok(klassenVon(k.eltern ?? k).includes('vorne'));
		const seite = neu.knoten.filter((n) => klassenVon(n).includes('seite'))[1];
		assert.equal(k.eltern?.eltern, seite);
		assert.deepEqual(leseLage(quelle, kopie), { x: 20, y: 30, b: 150, spiegeln: -1 });
		// Das Original bleibt auf Seite 1.
		assert.equal(quelle.split('data-figur="wilma"').length, 3);
	});
});
