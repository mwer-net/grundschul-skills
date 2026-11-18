import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { BILD_HERKUNFT } from './bild-werkzeug';
import { erstelleBlattBilder } from './blatt-bilder';

const KOPF = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (n: number) => Buffer.from([...KOPF, n]);
const HERKUNFT_KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\n';
const BLATT = '<img src="../../bilder/igel.png" alt="Igel"><img src="../../bilder/alt.png" alt="">';

describe('Neue KI-Bilder im einzelnen Blatt (237)', () => {
	let dir: string;
	let arbeit: string;
	let mappe: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'blatt-bilder-'));
		arbeit = path.join(dir, 'arbeit');
		mappe = path.join(dir, 'mappe');
		await mkdir(path.join(arbeit, 'bilder'), { recursive: true });
		await mkdir(path.join(mappe, 'bilder'), { recursive: true });
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	/** Wie das Werkzeug `bild_erzeugen`: das Bild in `bilder/` des Arbeitsordners und eine Zeile Herkunft. */
	const legeAb = async (inhalt: Buffer, datum: string) => {
		await writeFile(path.join(arbeit, 'bilder', 'igel.png'), inhalt);
		const herkunft = path.join(arbeit, 'bilder', BILD_HERKUNFT);
		const alt = existsSync(herkunft) ? await readFile(herkunft, 'utf8') : HERKUNFT_KOPF;
		await writeFile(herkunft, `${alt}igel.png\topenai\tbildmodell\t${datum}\tIgel im Laub\n`);
	};

	it('legt ein neues Bild mit Herkunft in die Mappe, weicht vergebenen Namen aus und ersetzt eine Reparatur', async () => {
		// Ein anderes Material der Mappe nutzt schon ein Bild dieses Namens.
		await writeFile(path.join(mappe, 'bilder', 'igel.png'), png(1));
		const bilder = erstelleBlattBilder(arbeit, mappe);
		assert.equal(await bilder.einsetzen(BLATT), BLATT, 'ohne Bild im Arbeitsordner bleibt das Blatt, wie es ist');

		await legeAb(png(2), '2026-11-17');
		const erst = await bilder.einsetzen(BLATT);
		const name = /bilder\/(igel-[a-z0-9]+\.png)/.exec(erst)?.[1];
		assert.ok(name, erst);
		assert.ok(erst.includes('../../bilder/alt.png'), 'ein Bild der Sammlung bleibt unberührt');
		assert.deepEqual(await readFile(path.join(mappe, 'bilder', 'igel.png')), png(1));
		assert.deepEqual(await readFile(path.join(mappe, 'bilder', name)), png(2));
		assert.equal(await bilder.einsetzen(BLATT), erst, 'ein zweiter Bau legt nichts doppelt an');
		const herkunft = () => readFile(path.join(mappe, 'bilder', BILD_HERKUNFT), 'utf8');
		assert.equal(await herkunft(), `${HERKUNFT_KOPF}${name}\topenai\tbildmodell\t2026-11-17\tIgel im Laub\n`);
		assert.equal(existsSync(path.join(mappe, 'bilder', 'canva-ids.tsv')), false);

		await legeAb(png(3), '2026-11-18');
		const zweit = await bilder.einsetzen(BLATT);
		const neu = /bilder\/(igel-[a-z0-9]+\.png)/.exec(zweit)?.[1];
		assert.ok(neu, zweit);
		assert.deepEqual(await readFile(path.join(mappe, 'bilder', neu)), png(3));
		const liegen = (await readdir(path.join(mappe, 'bilder'))).filter((d) => d.endsWith('.png'));
		assert.equal(liegen.length, 2, liegen.join(', '));
		assert.ok(existsSync(path.join(mappe, 'bilder', 'igel.png')));
		assert.match(await herkunft(), new RegExp(`${neu}\topenai\tbildmodell\t2026-11-18\tIgel im Laub\n$`));
	});
});
