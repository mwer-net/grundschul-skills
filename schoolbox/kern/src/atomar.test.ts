import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { schreibeAtomar } from './atomar';

const tempOrdner = () => mkdtemp(path.join(tmpdir(), 'schoolbox-atomar-'));

describe('schreibeAtomar', () => {
	it('schreibt den Inhalt und hinterlässt keine temporäre Datei', async () => {
		const dir = await tempOrdner();
		const ziel = path.join(dir, 'material.html');
		await writeFile(ziel, 'alt');
		await schreibeAtomar(ziel, 'neu');
		assert.equal(await readFile(ziel, 'utf8'), 'neu');
		assert.deepEqual(await readdir(dir), ['material.html']);
	});

	it('räumt bei einem Fehler auf und lässt das Ziel unverändert', async () => {
		const dir = await tempOrdner();
		const ziel = path.join(dir, 'ordner');
		await mkdir(ziel);
		await writeFile(path.join(ziel, 'drin.txt'), 'bleibt');
		await assert.rejects(schreibeAtomar(ziel, 'kaputt'));
		assert.deepEqual(await readdir(dir), ['ordner']);
		assert.equal(await readFile(path.join(ziel, 'drin.txt'), 'utf8'), 'bleibt');
	});

	it('zeigt Lesern nie einen halben Stand', async () => {
		const dir = await tempOrdner();
		const ziel = path.join(dir, 'gross.html');
		const fassungen = ['a', 'b', 'c', 'd'].map((z) => z.repeat(4 * 1024 * 1024));
		await writeFile(ziel, fassungen[0] ?? '');
		let fertig = false;
		const gelesen = new Set<string>();
		const leser = (async () => {
			while (!fertig) {
				const inhalt = await readFile(ziel, 'utf8');
				gelesen.add(`${inhalt[0]}${inhalt.length}${inhalt.at(-1)}`);
				assert.ok(fassungen.includes(inhalt), 'Leser hat eine unvollständige Datei gesehen');
			}
		})();
		for (let runde = 0; runde < 5; runde += 1) {
			for (const fassung of fassungen) {
				await schreibeAtomar(ziel, fassung);
			}
		}
		fertig = true;
		await leser;
		assert.ok(gelesen.size >= 1);
	});
});
