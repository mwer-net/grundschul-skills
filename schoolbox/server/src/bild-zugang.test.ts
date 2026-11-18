import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { BibliotheksFigur } from '@schoolbox/kern';
import { EINGEBAUTE } from '@schoolbox/kern/src/figuren';

import { BildApiFehler } from './bild-api';
import type { BildKonfig } from './bild-zugang';
import { BILDER_AUS, BILDER_GESPERRT, bilderStand, erstelleLaufBilder, grundposeReferenz } from './bild-zugang';
import { erstelleBildApiAttrappe, TEST_PNG } from './testhilfe';

const KONFIG: BildKonfig = {
	openaiSchluessel: 'platzhalter',
	bildModell: 'bildmodell',
	bildQualitaet: 'low',
	pythonBin: 'python3',
};

describe('Zugang zu neuen KI-Bildern (237)', () => {
	let dir: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'bild-zugang-'));
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('ohne Schlüssel: nicht verfügbar mit dem Satz für die Lehrkraft, und kein Lauf bekommt Bildwerkzeuge', async () => {
		assert.deepEqual(bilderStand({ openaiSchluessel: null }), { verfuegbar: false, grund: BILDER_AUS });
		assert.deepEqual(bilderStand({ openaiSchluessel: 'x' }), { verfuegbar: true, grund: null });
		const { api, anfragen } = erstelleBildApiAttrappe();
		const arbeit = path.join(dir, 'ohne');
		await mkdir(arbeit);
		assert.equal(
			await erstelleLaufBilder({ arbeit, art: 'schublade', konfig: { ...KONFIG, openaiSchluessel: null }, api }),
			null,
		);
		assert.equal(anfragen.length, 0);
	});

	it('merkt sich den kurzen Text des letzten Fehlers; die Sperre heißt wie in der Fehlerkachel', async () => {
		const arbeit = path.join(dir, 'fehler');
		await mkdir(arbeit);
		await writeFile(path.join(arbeit, 'bilder.json'), JSON.stringify([{ datei: 'bild.png', motiv: 'Igel' }]));
		let art: 'sicherheit' | 'gesperrt' = 'sicherheit';
		const bilder = await erstelleLaufBilder({
			arbeit,
			art: 'schublade',
			konfig: KONFIG,
			api: () =>
				Promise.reject(
					new BildApiFehler(art, art === 'sicherheit' ? 'Sicherheitsfilter: Motiv harmloser formulieren.' : 'x'),
				),
		});
		assert.ok(bilder);
		assert.equal(bilder.letzterFehler(), null);
		const argumente = { datei: 'bild.png', prompt: 'Igel', format: 'SQUARE_1_1', transparent: true };
		assert.equal((await bilder.aufruf('bild_erzeugen', argumente)).fehler, true);
		assert.equal(bilder.letzterFehler(), 'Sicherheitsfilter: Motiv harmloser formulieren.');
		art = 'gesperrt';
		await bilder.aufruf('bild_erzeugen', argumente);
		assert.equal(bilder.letzterFehler(), BILDER_GESPERRT);
		assert.equal(bilder.stand().gesperrt, true);
	});

	it('Grundposen als Referenz nur als PNG oder JPEG, unter referenzen/<id>', async () => {
		const willi = EINGEBAUTE.find((f) => f.id === 'willi');
		assert.ok(willi);
		const r = await grundposeReferenz(dir, willi);
		assert.equal(r?.pfad, 'referenzen/willi.png');
		assert.equal(r?.name, 'willi');
		const figuren = path.join(dir, '_figuren');
		await mkdir(figuren, { recursive: true });
		await writeFile(path.join(figuren, 'igel.png'), TEST_PNG);
		await writeFile(path.join(figuren, 'eule.webp'), 'RIFF....WEBP');
		const figur = (id: string, datei: string): BibliotheksFigur => ({
			id,
			name: id,
			eingebaut: false,
			suchwoerter: [],
			posen: [{ id, schluessel: `_figuren/${datei}`, strich: false }],
		});
		const igel = await grundposeReferenz(dir, figur('igel', 'igel.png'));
		assert.deepEqual(igel, { name: 'igel', datei: path.join(figuren, 'igel.png'), pfad: 'referenzen/igel.png' });
		assert.equal(await grundposeReferenz(dir, figur('eule', 'eule.webp')), null);
		assert.equal(await grundposeReferenz(dir, figur('fehlt', 'fehlt.png')), null);
		// Das Werkzeug legt sie dort ab, wo der Auftrag sie nennt.
		const arbeit = path.join(dir, 'arbeit');
		await mkdir(arbeit);
		const bilder = await erstelleLaufBilder({
			arbeit,
			art: 'schublade',
			konfig: KONFIG,
			api: erstelleBildApiAttrappe().api,
			figuren: igel ? [{ name: igel.name, datei: igel.datei }] : [],
		});
		assert.deepEqual(bilder?.referenzen, ['referenzen/igel.png']);
		assert.deepEqual(await readFile(path.join(arbeit, 'referenzen', 'igel.png')), TEST_PNG);
	});
});
