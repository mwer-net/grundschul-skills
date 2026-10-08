import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eindeutigeId, mappenSlug, slug } from './slug';

describe('slug', () => {
	it('schreibt Umlaute und ß aus', () => {
		assert.equal(slug('Größen'), 'groessen');
		assert.equal(slug('Äpfel, Öl & Übungen – Straße'), 'aepfel-oel-uebungen-strasse');
		assert.equal(slug('GRÖSSEN UND MAẞE'), 'groessen-und-masse');
	});

	it('entfernt andere Akzente und Satzzeichen', () => {
		assert.equal(slug('Crème brûlée!'), 'creme-brulee');
		assert.equal(slug('  „Willis Tag“ (Kl. 2)  '), 'willis-tag-kl-2');
		assert.equal(slug('Zehner/Einer: 10 + 5'), 'zehner-einer-10-5');
	});

	it('liefert für Text ohne Buchstaben einen leeren Slug', () => {
		assert.equal(slug('?!…'), '');
	});

	it('kürzt an einer Wortgrenze', () => {
		const lang = slug('Die kleine Raupe Nimmersatt frisst sich durch die ganze Woche', 30);
		assert.equal(lang, 'die-kleine-raupe-nimmersatt');
		assert.ok(lang.length <= 30);
		assert.equal(slug('a'.repeat(60), 10), 'a'.repeat(10));
	});
});

describe('eindeutigeId', () => {
	it('hängt bei Kollision eine Nummer an', () => {
		const belegt = new Set(['kartoffeln', 'kartoffeln-2']);
		assert.equal(
			eindeutigeId('kartoffeln', (id) => belegt.has(id)),
			'kartoffeln-3',
		);
		assert.equal(
			eindeutigeId('uhrzeit', (id) => belegt.has(id)),
			'uhrzeit',
		);
	});
});

describe('mappenSlug', () => {
	it('setzt Datum, Titel, Fachkürzel und Klasse zusammen', () => {
		const zeit = new Date(2026, 9, 8, 10, 15);
		assert.equal(mappenSlug('Kartoffeln', 'sachunterricht', 3, zeit), '2026-10-08-kartoffeln-su-kl3');
		assert.equal(mappenSlug('Größen', 'mathematik', 'gemischt', zeit), '2026-10-08-groessen-ma-gemischt');
		assert.equal(mappenSlug('!!!', 'deutsch', 1, zeit), '2026-10-08-mappe-de-kl1');
	});
});
