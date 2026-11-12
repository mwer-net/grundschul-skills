import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { FarbreiheEigenschaften } from './Farbfeld';
import { Farbreihe } from './Farbfeld';

const zeichne = (e: Partial<FarbreiheEigenschaften>) =>
	renderToStaticMarkup(
		createElement(Farbreihe, {
			beschriftung: 'Füllung',
			doc: null,
			wert: null,
			setze: () => undefined,
			...e,
		} as FarbreiheEigenschaften),
	);

/** `data-farbe` jedes Punkts in der Reihenfolge des Markups. */
const farben = (html: string) => [...html.matchAll(/data-farbe="([^"]+)"/g)].map((m) => m[1]);

/** Die Punkte mit `aria-pressed="true"`. */
const gewaehlt = (html: string) =>
	[...html.matchAll(/<button[^>]*>/g)]
		.map((m) => m[0])
		.filter((b) => b.includes('aria-pressed="true"'))
		.map((b) => /data-farbe="([^"]+)"/.exec(b)?.[1]);

const eigeneGewaehlt = (html: string) => /<label[^>]*data-gewaehlt="true"/.test(html);

describe('Farbreihe (182)', () => {
	it('feste Reihenfolge: Keine, Schwarz, fünf Farben des Blatts, Weiß, Eigene', () => {
		assert.deepEqual(farben(zeichne({ keine: 'Keine Füllung', schwarz: true, setze: () => undefined })), [
			'keine',
			'#000000',
			'var(--haupt)',
			'var(--akzent)',
			'var(--dunkel)',
			'var(--linie)',
			'var(--fuell)',
			'#ffffff',
			'eigen',
		]);
	});

	it('ohne „Keine“ und „Schwarz“ beginnt die Reihe mit den Farben des Blatts', () => {
		assert.deepEqual(farben(zeichne({})), [
			'var(--haupt)',
			'var(--akzent)',
			'var(--dunkel)',
			'var(--linie)',
			'var(--fuell)',
			'#ffffff',
			'eigen',
		]);
	});

	it('jeder Punkt hat title und aria-label mit seinem Namen', () => {
		const html = zeichne({ keine: 'Keine Füllung', schwarz: true, setze: () => undefined });
		for (const name of ['Keine Füllung', 'Schwarz', 'Hauptfarbe', 'Füllfarbe', 'Weiß']) {
			assert.match(html, new RegExp(`aria-label="${name}" title="${name}"`), name);
		}
		assert.match(html, /title="Eigene Farbe"/);
		assert.match(html, /aria-label="Eigene Farbe"/);
	});

	it('aria-pressed genau am passenden Punkt', () => {
		assert.deepEqual(gewaehlt(zeichne({ wert: 'var(--akzent)' })), ['var(--akzent)']);
		assert.deepEqual(gewaehlt(zeichne({ wert: '#FFF' })), ['#ffffff']);
		assert.deepEqual(gewaehlt(zeichne({ keine: 'Keine Füllung', wert: null, setze: () => undefined })), ['keine']);
		assert.deepEqual(gewaehlt(zeichne({ schwarz: true, wert: '#000' })), ['#000000']);
		assert.equal(eigeneGewaehlt(zeichne({ wert: 'var(--haupt)' })), false);
	});

	it('„Eigene“ ist gewählt, wenn der Wert keine bekannte Farbe ist', () => {
		const html = zeichne({ wert: '#12ab34' });
		assert.deepEqual(gewaehlt(html), []);
		assert.equal(eigeneGewaehlt(html), true);
		assert.match(html, /value="#12ab34"/);
		// Ohne „Schwarz“ in der Reihe ist Schwarz eine eigene Farbe.
		assert.equal(eigeneGewaehlt(zeichne({ wert: '#000000' })), true);
		assert.equal(eigeneGewaehlt(zeichne({ schwarz: true, wert: '#000000' })), false);
	});

	it('gemischt: kein Punkt trägt einen Ring, auch „Keine“ nicht', () => {
		const html = zeichne({ keine: 'Keine Füllung', schwarz: true, gemischt: true, wert: null, setze: () => undefined });
		assert.deepEqual(gewaehlt(html), []);
		assert.equal(eigeneGewaehlt(html), false);
		assert.doesNotMatch(html, /ring-tinte/);
	});

	it('der Punkt ist fest 18 px in einer festen Fläche von 24 px, nie `size-full`', () => {
		const html = zeichne({});
		assert.match(html, /size-\[18px\]/);
		assert.match(html, /size-6/);
		assert.doesNotMatch(html, /size-full min-h-4/);
	});
});
