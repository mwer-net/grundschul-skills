import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BibliotheksFigur } from './figuren';
import { EINGEBAUTE } from './figuren';
import { figurenIn } from './figuren-namen';

/** Erfundene Figuren für die Tests; Kiki ohne Steckbrief und ohne Referenz. */
const figur = (id: string, name: string): BibliotheksFigur => ({
	id,
	name,
	eingebaut: false,
	suchwoerter: [],
	posen: [{ id, schluessel: `_figuren/${id}.png`, strich: false }],
});
const KIKI = figur('kiki', 'Kiki');
const IGEL = figur('igel', 'Igel');
const EULE = figur('eule', 'Eule');
const FRAU_EULE = figur('fraueule', 'Frau Eule');

const namen = (text: string, figuren: readonly BibliotheksFigur[] = EINGEBAUTE) =>
	figurenIn(text, figuren).map((f) => f.name);

describe('figurenIn (176, Regeln aus 179)', () => {
	it('findet Willi auch klein und im Genitiv', () => {
		assert.deepEqual(namen('Willi mit einer Lupe, der auf dem Boden genau etwas anschaut'), ['Willi']);
		assert.deepEqual(namen('willis Lupe'), ['Willi']);
		assert.deepEqual(namen('Willi’s Lupe'), ['Willi']);
	});

	it('Gegenprobe: „Williams Hut“ nennt keine Figur', () => {
		assert.deepEqual(namen('Williams Hut'), []);
		assert.deepEqual(namen('Wilmas'), ['Wilma']);
	});

	it('folgt dem ersten Vorkommen, ohne Doppel', () => {
		assert.deepEqual(namen('Willi zeigt Wilma die Lupe'), ['Willi', 'Wilma']);
		assert.deepEqual(namen('Wilma zeigt Willi die Lupe, und Willi lacht'), ['Wilma', 'Willi']);
	});

	it('kennt nur die Figuren der Liste', () => {
		assert.deepEqual(namen('ein Igel mit gelbem Halstuch'), []);
		assert.deepEqual(namen('ein Igel mit gelbem Halstuch', [...EINGEBAUTE, IGEL]), ['Igel']);
	});

	it('ein Name aus zwei Wörtern trifft nur als ganze Folge und vor dem kürzeren Namen darin', () => {
		const liste = [EULE, FRAU_EULE];
		assert.deepEqual(namen('Frau  Eule fliegt', liste), ['Frau Eule']);
		assert.deepEqual(namen('Frau Eule trifft Eule', liste), ['Frau Eule', 'Eule']);
		assert.deepEqual(namen('Die Frau trifft eine Eule', liste), ['Eule']);
	});

	it('findet eine Figur ohne Steckbrief und Referenz (Gegenprobe zum Filter in 179)', () => {
		assert.equal(KIKI.steckbrief, undefined);
		assert.equal(KIKI.canva, undefined);
		assert.deepEqual(namen('Kiki springt', [...EINGEBAUTE, KIKI]), ['Kiki']);
	});
});
