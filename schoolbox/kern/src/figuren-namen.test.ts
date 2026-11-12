import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BibliotheksFigur } from './figuren';
import { EINGEBAUTE } from './figuren';
import { figurenFuerBild, figurenIn, MAX_FIGUREN_JE_BILD } from './figuren-namen';

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

describe('figurenFuerBild (179)', () => {
	const BAER: BibliotheksFigur = { ...figur('baer', 'Bär'), steckbrief: 'brauner Bär mit grüner Mütze' };
	const IGEL_MIT_ID: BibliotheksFigur = { ...IGEL, canva: 'MAigel00001' };
	const MAX: BibliotheksFigur = { ...figur('max', 'Max'), steckbrief: 'Junge mit roter Jacke' };
	const BIBLIOTHEK = [...EINGEBAUTE, BAER, IGEL_MIT_ID, MAX, KIKI];
	const fuerBild = (text: string) => figurenFuerBild(text, BIBLIOTHEK).map((f) => f.name);

	it('findet Willi und Wilma in der Reihenfolge des Textes, auch klein und groß', () => {
		assert.deepEqual(fuerBild('Willi und Wilma pflanzen im Garten eine Sonnenblume'), ['Willi', 'Wilma']);
		assert.deepEqual(fuerBild('wilma hilft WILLI'), ['Wilma', 'Willi']);
	});

	it('trifft „Bär“ an der Wortgrenze nach dem Umlaut, aber nicht in „Bärbel“', () => {
		assert.deepEqual(fuerBild('Der Bär winkt'), ['Bär']);
		assert.deepEqual(fuerBild('Bärbel winkt'), []);
	});

	it('lässt eine Figur ohne Steckbrief und ohne Media-ID weg (Gegenprobe: figurenIn findet sie)', () => {
		assert.deepEqual(fuerBild('Kiki winkt'), []);
		assert.deepEqual(namen('Kiki winkt', BIBLIOTHEK), ['Kiki']);
	});

	it('nimmt eine Figur nur mit Media-ID und kürzt fünf Figuren nicht', () => {
		assert.deepEqual(fuerBild('ein Igel im Laub'), ['Igel']);
		assert.deepEqual(fuerBild('Willi, Wilma, Bär, Igel und Max'), ['Willi', 'Wilma', 'Bär', 'Igel', 'Max']);
		assert.ok(fuerBild('Willi, Wilma, Bär, Igel und Max').length > MAX_FIGUREN_JE_BILD);
	});
});
