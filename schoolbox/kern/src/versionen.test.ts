import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { legeVersionAn, leseVersionsName, listeVersionen, versionsName, versionsPfad } from './versionen';

const T0 = new Date('2026-10-08T10:15:03.456Z');
const minuten = (n: number) => new Date(T0.getTime() + n * 60 * 1000);

const dokument = async (inhalt = 'v1') => {
	const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-versionen-'));
	await writeFile(path.join(dir, 'material.html'), inhalt);
	return dir;
};

const aendere = (dir: string, inhalt: string) => writeFile(path.join(dir, 'material.html'), inhalt);

describe('Versionsnamen', () => {
	it('folgt dem Schema <ISO-Zeit>_<urheber>.html', () => {
		const name = versionsName(T0, 'claude');
		assert.equal(name, '2026-10-08T10-15-03Z_claude.html');
		assert.deepEqual(leseVersionsName(name), {
			id: '2026-10-08T10-15-03Z_claude',
			zeit: new Date('2026-10-08T10:15:03Z'),
			urheber: 'claude',
		});
		assert.equal(leseVersionsName('2026-10-08T10-15-03Z_fremd.html'), null);
		assert.equal(leseVersionsName('.2026-10-08T10-15-03Z_claude.html.123.tmp'), null);
	});
});

describe('legeVersionAn', () => {
	it('legt die erste Version an und überspringt unveränderten Inhalt', async () => {
		const dir = await dokument();
		const erste = await legeVersionAn(dir, 'claude', T0);
		assert.equal(erste?.id, '2026-10-08T10-15-03Z_claude');
		assert.equal(await legeVersionAn(dir, 'lehrkraft', minuten(10)), null);
		assert.equal((await listeVersionen(dir)).length, 1);
	});

	it('fasst Versionen desselben Urhebers innerhalb von 5 Minuten zusammen, der letzte Stand gewinnt', async () => {
		const dir = await dokument();
		await legeVersionAn(dir, 'lehrkraft', T0);
		await aendere(dir, 'v2');
		await legeVersionAn(dir, 'lehrkraft', minuten(2));
		await aendere(dir, 'v3');
		const version = await legeVersionAn(dir, 'lehrkraft', minuten(4.9));
		const alle = await listeVersionen(dir);
		assert.equal(alle.length, 1);
		assert.equal(version?.id, alle[0]?.id);
		assert.equal(await readFile(versionsPfad(dir, alle[0]!), 'utf8'), 'v3');
	});

	it('beginnt nach 5 Minuten eine neue Version, auch bei ununterbrochenem Bearbeiten', async () => {
		const dir = await dokument();
		for (const [i, t] of [0, 2, 4, 6, 8, 11.5].entries()) {
			await aendere(dir, `v${i}`);
			await legeVersionAn(dir, 'lehrkraft', minuten(t));
		}
		const alle = await listeVersionen(dir);
		assert.deepEqual(
			alle.map((v) => v.zeit.toISOString()),
			[T0, minuten(6), minuten(11.5)].map((t) => `${t.toISOString().slice(0, 19)}.000Z`),
		);
		assert.equal(await readFile(versionsPfad(dir, alle[1]!), 'utf8'), 'v4');
	});

	it('trennt Urheber', async () => {
		const dir = await dokument();
		await legeVersionAn(dir, 'claude', T0);
		await aendere(dir, 'v2');
		await legeVersionAn(dir, 'lehrkraft', minuten(1));
		await aendere(dir, 'v3');
		await legeVersionAn(dir, 'claude', minuten(2));
		const alle = await listeVersionen(dir);
		assert.deepEqual(
			alle.map((v) => v.urheber),
			['claude', 'lehrkraft', 'claude'],
		);
		assert.deepEqual((await readdir(path.join(dir, 'versionen'))).length, 3);
	});
});
