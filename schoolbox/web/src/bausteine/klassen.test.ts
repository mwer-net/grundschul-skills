import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { klassen, knopfKlassen } from './klassen';

/** Die spätere Klasse gilt, nicht die Reihenfolge im CSS (Ursache von 195-03). */
describe('klassen', () => {
	it('hängt an und lässt Leeres weg', () => {
		assert.equal(klassen('flex', false, null, undefined, '', 'gap-1'), 'flex gap-1');
	});

	it('Farbe: die spätere gewinnt, auch mit derselben Variante', () => {
		assert.equal(
			klassen('text-leise hover:bg-flaeche-2 hover:text-tinte', 'bg-brand-50 text-brand-700 hover:bg-brand-50'),
			'hover:text-tinte bg-brand-50 text-brand-700 hover:bg-brand-50',
		);
	});

	it('Varianten trennen: hover:… nimmt die Ruhe nicht weg', () => {
		assert.equal(klassen('bg-flaeche', 'hover:bg-flaeche-2'), 'bg-flaeche hover:bg-flaeche-2');
	});

	it('Schriftgröße und Schriftfarbe sind verschiedene Gruppen', () => {
		assert.equal(klassen('text-sm text-tinte', 'text-leise'), 'text-sm text-leise');
		assert.equal(klassen('text-sm text-tinte', 'text-base'), 'text-tinte text-base');
	});

	it('Rand: Breite, Farbe und Seiten', () => {
		assert.equal(klassen('border border-rand', 'border-brand-500'), 'border border-brand-500');
		assert.equal(klassen('border-2', 'border-l-0'), 'border-2 border-l-0');
		assert.equal(klassen('border-l', 'border-2'), 'border-2');
		assert.equal(klassen('border-transparent', 'border-rand-feld'), 'border-rand-feld');
	});

	it('Abstände: p umfasst px, px umfasst nicht p', () => {
		assert.equal(klassen('px-2 py-1', 'p-1'), 'p-1');
		assert.equal(klassen('p-2', 'px-0'), 'p-2 px-0');
	});

	it('Größe: size ersetzt size, eigene Maße stehen für sich', () => {
		assert.equal(klassen('size-3.5 flex-none', 'size-4'), 'flex-none size-4');
		assert.equal(klassen('size-3.5 flex-none', 'md:hidden'), 'size-3.5 flex-none md:hidden');
		assert.equal(klassen('h-knopf', 'h-8'), 'h-knopf h-8');
	});

	it('flex: Anzeige und Wachsen sind verschieden', () => {
		assert.equal(klassen('flex flex-none', 'flex-1'), 'flex flex-1');
		assert.equal(klassen('hidden', 'flex'), 'flex');
	});

	it('Doppelpunkte in eckigen Klammern sind keine Varianten', () => {
		assert.equal(
			klassen('[@media(any-pointer:coarse)]:min-h-11', '[@media(any-pointer:coarse)]:min-h-12'),
			'[@media(any-pointer:coarse)]:min-h-12',
		);
	});

	it('Unbekanntes bleibt stehen, Doppeltes einmal', () => {
		assert.equal(klassen('ablage-objekt chat-glas', 'ablage-objekt'), 'chat-glas ablage-objekt');
	});

	it('Knopf: Zusatz überschreibt Art und Größe, offen bleibt gedrückt (187-13)', () => {
		const leise = knopfKlassen('leise', 'text-leise');
		assert.match(leise, /\btext-leise\b/);
		assert.doesNotMatch(leise, /\btext-tinte\b/);
		assert.match(leise, /data-\[popup-open\]:bg-flaeche-2/);
		assert.match(knopfKlassen('haupt'), /data-\[popup-open\]:bg-brand-600/);
	});
});
