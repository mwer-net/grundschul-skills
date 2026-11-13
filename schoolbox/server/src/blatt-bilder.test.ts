import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { erstelleBlattBilder } from './blatt-bilder';

const KOPF = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (n: number) => Buffer.from([...KOPF, n]);
const URL_A = 'https://export-download.canva.com/a/igel.png';
const URL_B = 'https://export-download.canva.com/b/igel.png';
const eintrag = (url: string) => JSON.stringify([{ datei: 'igel.png', url, motiv: 'Igel im Laub', mediaId: 'MA1' }]);
const BLATT = '<img src="../../bilder/igel.png" alt="Igel"><img src="../../bilder/alt.png" alt="">';

describe('Bilder aus Canva im einzelnen Blatt', () => {
	let dir: string;
	let arbeit: string;
	let mappe: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'blatt-bilder-'));
		arbeit = path.join(dir, 'arbeit');
		mappe = path.join(dir, 'mappe');
		await mkdir(arbeit);
		await mkdir(path.join(mappe, 'bilder'), { recursive: true });
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('legt ein neues Bild in die Mappe, weicht vergebenen Namen aus und ersetzt eine reparierte Fassung', async () => {
		// Ein anderes Material der Mappe nutzt schon ein Bild dieses Namens.
		await writeFile(path.join(mappe, 'bilder', 'igel.png'), png(1));
		const inhalt: Record<string, Buffer> = { [URL_A]: png(2), [URL_B]: png(3) };
		const bilder = erstelleBlattBilder(arbeit, mappe, (url) => Promise.resolve(new Response(inhalt[url])));
		try {
			assert.equal(await bilder.einsetzen(BLATT), BLATT, 'ohne Bildliste bleibt das Blatt, wie es ist');

			await writeFile(path.join(arbeit, 'bilder.json'), eintrag(URL_A));
			const erst = await bilder.einsetzen(BLATT);
			const name = /bilder\/(igel-[a-z0-9]+\.png)/.exec(erst)?.[1];
			assert.ok(name, erst);
			assert.ok(erst.includes('../../bilder/alt.png'), 'ein Bild der Sammlung bleibt unberührt');
			assert.deepEqual(await readFile(path.join(mappe, 'bilder', 'igel.png')), png(1));
			assert.deepEqual(await readFile(path.join(mappe, 'bilder', name)), png(2));
			assert.equal(await bilder.einsetzen(BLATT), erst, 'ein zweiter Bau legt nichts doppelt an');
			assert.match(
				await readFile(path.join(mappe, 'bilder', 'canva-ids.tsv'), 'utf8'),
				new RegExp(`${name}\tMA1\t`),
			);

			await writeFile(path.join(arbeit, 'bilder.json'), eintrag(URL_B));
			const zweit = await bilder.einsetzen(BLATT);
			const neu = /bilder\/(igel-[a-z0-9]+\.png)/.exec(zweit)?.[1];
			assert.ok(neu, zweit);
			assert.deepEqual(await readFile(path.join(mappe, 'bilder', neu)), png(3));
			const liegen = (await readdir(path.join(mappe, 'bilder'))).filter((d) => d.endsWith('.png'));
			assert.equal(liegen.length, 2, liegen.join(', '));
			assert.ok(existsSync(path.join(mappe, 'bilder', 'igel.png')));
		} finally {
			bilder.ende();
		}
	});
});
