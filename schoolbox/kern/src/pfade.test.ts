import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS, BLATT_PY } from './konfig';
import { sucheRessource } from './pfade';

const PYTHON = `
import json, sys
sys.path.insert(0, sys.argv[1])
import blatt
faelle = json.loads(sys.argv[2])
print(json.dumps([str(p) if (p := blatt.suche(n, blatt.Path(d))) else None for n, d in faelle]))
`;

const mitBlattPy = (faelle: [string, string][]): (string | null)[] =>
	JSON.parse(
		execFileSync('python3', ['-c', PYTHON, path.dirname(BLATT_PY), JSON.stringify(faelle)], { encoding: 'utf8' }),
	) as (string | null)[];

const baueMappe = async () => {
	const mappe = await mkdtemp(path.join(tmpdir(), 'schoolbox-pfade-'));
	const dok = path.join(mappe, 'dokumente', 'blatt');
	await mkdir(path.join(dok, 'bilder'), { recursive: true });
	await mkdir(path.join(mappe, 'bilder'));
	await writeFile(path.join(dok, 'bilder', 'eigen.png'), 'x');
	await writeFile(path.join(dok, 'bilder', 'willi.png'), 'eigener Willi');
	await writeFile(path.join(mappe, 'bilder', 'geteilt.png'), 'x');
	await symlink(path.join(mappe, 'bilder', 'geteilt.png'), path.join(dok, 'bilder', 'verweis.png'));
	await writeFile(path.join(dok, 'eigen.css'), 'body{}');
	return { dok, mappe };
};

describe('sucheRessource', () => {
	it('findet dieselben Dateien wie blatt.py', async () => {
		const { dok, mappe } = await baueMappe();
		const andererDok = path.join(mappe, 'dokumente', 'leer');
		await mkdir(andererDok, { recursive: true });
		const faelle: [string, string][] = [
			['blatt.css', dok],
			['abbildungen.js', dok],
			['eigen.css', dok],
			['bilder/eigen.png', dok],
			['bilder/willi.png', dok],
			['bilder/willi.png', andererDok],
			['bilder/willi-strich.png', dok],
			['../../bilder/geteilt.png', dok],
			['bilder/verweis.png', dok],
			['bilder/fehlt.png', dok],
			['fonts/Andika-Regular.woff2', ASSETS],
			['fonts/Andika-Regular.woff2', dok],
			[path.join(mappe, 'bilder', 'geteilt.png'), dok],
		];
		const erwartet = mitBlattPy(faelle);
		const tatsaechlich = faelle.map(([name, dir]) => sucheRessource(name, dir));
		assert.deepEqual(tatsaechlich, erwartet);
		assert.equal(tatsaechlich[0], path.join(ASSETS, 'blatt.css'));
		assert.equal(tatsaechlich[4], path.join(dok, 'bilder', 'willi.png'));
		assert.equal(tatsaechlich[5], path.join(ASSETS, 'bilder', 'willi.png'));
		assert.equal(tatsaechlich[8], path.join(mappe, 'bilder', 'geteilt.png'));
		assert.equal(tatsaechlich[9], null);
	});
});
