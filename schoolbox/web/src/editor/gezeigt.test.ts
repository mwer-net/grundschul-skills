import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from '@schoolbox/kern/src/quelltext';

import { blattMit, FIGUR_FREI, FORM } from '../../e2e/gestaltung-daten';
import type { Geladen } from './gezeigt';
import { gezeigtVon, gleicheNummern } from './gezeigt';

/** 171: Die Seitenleisten lesen das gezeigte Blatt, bis das nächste da ist; geschrieben wird nur bei `gleich`. */

const KREIS =
	'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:300px;--y:400px;--b:100px;--h:100px"><circle cx="50" cy="50" r="48" style="fill:var(--akzent)"/></svg>';
const RECHTECK = KREIS.replace('data-form="kreis"', 'data-form="rechteck"').replace('--x:300px', '--x:500px');

/** Ein Bild, wie `merken` es setzt; im Test braucht niemand das Dokument. */
const bild = (quelle: string): Geladen => ({ doc: {} as Document, html: `html:${quelle}`, zerlegung: zerlege(quelle) });

const gezeigt = (geladen: Geladen, neu: string, wartet = false) => {
	const g = gezeigtVon({ geladen, zerlegung: zerlege(neu), quelle: neu, html: `html:${neu}`, wartet });
	assert.ok(g);
	return g;
};

describe('gezeigt (171)', () => {
	const vorher = blattMit({ vorne: [FORM] });
	const mitFigur = blattMit({ vorne: [FORM, FIGUR_FREI] });

	it('nur ein Attribut geändert: gleich, Quelle und Zerlegung von jetzt', () => {
		const nachher = vorher.replace('--drehen:12deg', '--drehen:30deg');
		const g = gezeigt(bild(vorher), nachher);
		assert.equal(g.gleich, true);
		assert.equal(g.quelle, nachher);
		assert.equal(g.zerlegung.quelle, nachher);
		assert.equal(g.frisch, false);
	});

	it('Element eingefügt: nicht gleich, Quelle und Zerlegung des Bilds', () => {
		const g = gezeigt(bild(vorher), mitFigur);
		assert.equal(g.gleich, false);
		assert.equal(g.quelle, vorher);
		assert.equal(g.zerlegung.quelle, vorher);
	});

	it('Element gelöscht: nicht gleich, Quelle des Bilds', () => {
		const g = gezeigt(bild(mitFigur), vorher);
		assert.equal(g.gleich, false);
		assert.equal(g.quelle, mitFigur);
	});

	it('Element in eine andere Ebene gehängt: nicht gleich', () => {
		const vorn = blattMit({ vorne: [FORM, KREIS], hinten: [FIGUR_FREI] });
		const hinten = blattMit({ vorne: [FORM], hinten: [FIGUR_FREI, KREIS] });
		const g = gezeigt(bild(vorn), hinten);
		assert.equal(g.gleich, false);
		assert.equal(g.zerlegung.quelle, vorn);
		// Gleiche Tags, nur andere Eltern: auch dann nicht dieselben Nummern.
		const verschachtelt = zerlege('<div><div></div></div><div></div>');
		const daneben = zerlege('<div></div><div><div></div></div>');
		assert.equal(gleicheNummern(verschachtelt, daneben), false);
	});

	it('zwei gleich gebaute Elemente getauscht: gleiche Nummern, mit wartender Auswahl aber nicht gleich', () => {
		const ab = blattMit({ vorne: [KREIS, RECHTECK] });
		const ba = blattMit({ vorne: [RECHTECK, KREIS] });
		assert.equal(gleicheNummern(zerlege(ab), zerlege(ba)), true);
		assert.equal(gezeigt(bild(ab), ba).gleich, true);
		const g = gezeigt(bild(ab), ba, true);
		assert.equal(g.gleich, false);
		assert.equal(g.quelle, ab);
	});

	it('Bild der neuesten Quelle: frisch und gleich', () => {
		const g = gezeigt(bild(vorher), vorher);
		assert.equal(g.frisch, true);
		assert.equal(g.gleich, true);
	});

	it('noch kein Bild: nichts gezeigt', () => {
		const z = zerlege(vorher);
		assert.equal(gezeigtVon({ geladen: null, zerlegung: z, quelle: vorher, html: 'x', wartet: false }), null);
		assert.equal(gleicheNummern(z, z), true);
	});
});
