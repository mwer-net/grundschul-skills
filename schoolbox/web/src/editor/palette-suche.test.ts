import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PalettenEintrag } from './palette-suche';
import { bewerte, gruppiere, startliste, suchePalette, ZULETZT_TITEL } from './palette-suche';

const eintrag = (titel: string, suchwoerter: string[] = [], mehr: Partial<PalettenEintrag> = {}): PalettenEintrag => ({
	id: titel,
	titel,
	gruppe: 'Test',
	suchwoerter,
	aus: () => undefined,
	...mehr,
});
const titel = (liste: PalettenEintrag[]) => liste.map((e) => e.titel);

describe('Suche der Palette', () => {
	it('versteht Umlaute und ß ohne sie zu verlangen', () => {
		assert.deepEqual(titel(suchePalette('loschen', [eintrag('Löschen')])), ['Löschen']);
		assert.deepEqual(titel(suchePalette('grosse', [eintrag('Größe')])), ['Größe']);
		assert.deepEqual(titel(suchePalette('LÖSCHEN', [eintrag('Loeschen weg', ['löschen'])])), ['Loeschen weg']);
	});

	it('wertet Anfang vor Wortanfang vor Teilwort vor Buchstabenfolge', () => {
		const liste = [
			eintrag('Schöne Lupe'),
			eintrag('Kaspar'),
			eintrag('Rand spalten'),
			eintrag('Sonnige Paare'),
			eintrag('Spalten'),
		];
		assert.deepEqual(titel(suchePalette('spa', liste)), ['Spalten', 'Rand spalten', 'Kaspar', 'Sonnige Paare']);
	});

	it('nimmt den Titel vor den Suchwörtern derselben Stufe', () => {
		const liste = [eintrag('Weg', []), eintrag('Löschen', ['weg'])];
		assert.deepEqual(titel(suchePalette('weg', [...liste].reverse())), ['Weg', 'Löschen']);
	});

	it('findet über Synonyme', () => {
		assert.deepEqual(titel(suchePalette('entfernen', [eintrag('Löschen', ['entfernen', 'weg'])])), ['Löschen']);
	});

	it('sucht Buchstabenfolgen nur im Ernstfall: ein Buchstabe reicht dafür nicht', () => {
		assert.equal(bewerte('x', eintrag('Text')), 5);
		assert.equal(bewerte('t', eintrag('Blatt')), 5);
		assert.equal(bewerte('q', eintrag('Blatt')), 0);
	});

	it('verlangt alle Wörter', () => {
		assert.deepEqual(titel(suchePalette('seite 3', [eintrag('Seite 3'), eintrag('Seite 2')])), ['Seite 3']);
	});

	it('zieht kürzlich Benutztes bei gleicher Stufe vor, aber nicht über eine bessere', () => {
		const liste = [eintrag('Spalte danach'), eintrag('Spalte davor'), eintrag('Rand spalten')];
		assert.deepEqual(titel(suchePalette('spal', liste, ['Spalte davor'])), [
			'Spalte davor',
			'Spalte danach',
			'Rand spalten',
		]);
		assert.deepEqual(titel(suchePalette('spal', liste, ['Rand spalten']))[2], 'Rand spalten');
	});

	it('leere Eingabe: zuletzt Benutztes, dann die Startliste, nichts doppelt', () => {
		const liste = [eintrag('A', [], { start: true }), eintrag('B', [], { start: true }), eintrag('C')];
		const start = startliste(liste, ['C', 'A', 'weg']);
		assert.deepEqual(titel(start), ['C', 'A', 'B']);
		assert.equal(start[0]?.gruppe, ZULETZT_TITEL);
		assert.equal(start[2]?.gruppe, 'Test');
	});

	it('gruppiert in der Reihenfolge des besten Treffers', () => {
		const gruppen = gruppiere([eintrag('A', [], { gruppe: 'Zwei' }), eintrag('B', [], { gruppe: 'Eins' }), eintrag('C', [], { gruppe: 'Zwei' })]);
		assert.deepEqual(gruppen.map((g) => g.titel), ['Zwei', 'Eins']);
		assert.deepEqual(titel(gruppen[0]?.eintraege ?? []), ['A', 'C']);
	});
});
