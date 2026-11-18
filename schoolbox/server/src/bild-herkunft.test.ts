import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { CANVA_IDS, uebertrageHerkunft } from './bild-herkunft';
import { BILD_HERKUNFT } from './bild-werkzeug';

const KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\n';

describe('uebertrageHerkunft (237)', () => {
	let dir: string;
	let von: string;
	let zu: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'bild-herkunft-'));
		von = path.join(dir, 'arbeit', 'bilder');
		zu = path.join(dir, 'mappe', 'bilder');
		await mkdir(von, { recursive: true });
		await writeFile(
			path.join(von, BILD_HERKUNFT),
			`${KOPF}igel.png\topenai\tm\t2026-11-17\tIgel alt\nigel.png\topenai\tm\t2026-11-18\tIgel\nbaum.png\topenai\tm\t2026-11-18\tBaum\n`,
		);
		await writeFile(path.join(von, CANVA_IDS), 'datei\tmedia-id\tmotiv\nalt.png\tMA1\tAltes Bild\n');
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('nimmt je Bild die letzte Zeile unter dem neuen Namen, mit Kopfzeile, und nur die übernommenen Bilder', async () => {
		await uebertrageHerkunft(von, zu, { 'igel.png': 'igel-2.png' });
		assert.equal(
			await readFile(path.join(zu, BILD_HERKUNFT), 'utf8'),
			`${KOPF}igel-2.png\topenai\tm\t2026-11-18\tIgel\n`,
		);
		assert.equal(existsSync(path.join(zu, CANVA_IDS)), false, 'ohne alte Bilder keine canva-ids.tsv');
		// Ein zweiter Bau mit demselben Bild schreibt nichts doppelt.
		await uebertrageHerkunft(von, zu, { 'igel.png': 'igel-2.png' });
		assert.equal((await readFile(path.join(zu, BILD_HERKUNFT), 'utf8')).split('\n').length, 3);
	});

	it('geht auch mit canva-ids.tsv alter Bilder mit und hängt an, ohne zweite Kopfzeile', async () => {
		await uebertrageHerkunft(von, zu, { 'baum.png': 'baum.png', 'alt.png': 'alt.png' });
		assert.equal(
			await readFile(path.join(zu, BILD_HERKUNFT), 'utf8'),
			`${KOPF}igel-2.png\topenai\tm\t2026-11-18\tIgel\nbaum.png\topenai\tm\t2026-11-18\tBaum\n`,
		);
		assert.equal(
			await readFile(path.join(zu, CANVA_IDS), 'utf8'),
			'datei\tmedia-id\tmotiv\nalt.png\tMA1\tAltes Bild\n',
		);
	});

	it('Gegenprobe: ohne Herkunftsdatei im Arbeitsordner und ohne Bilder geschieht nichts', async () => {
		const leer = path.join(dir, 'leer');
		await uebertrageHerkunft(path.join(dir, 'fehlt'), leer, { 'x.png': 'x.png' });
		await uebertrageHerkunft(von, leer, {});
		assert.equal(existsSync(leer), false);
	});
});
