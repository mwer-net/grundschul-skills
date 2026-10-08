import assert from 'node:assert/strict';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { neueMappe, schreibeAtomar } from '@schoolbox/kern';

import { kennung } from './kontext';
import type { TestServer } from './testhilfe';
import { legeDokumentAn, sammleEreignisse, schreibKoepfe, starteTestServer, warte } from './testhilfe';
import { RUHE_MS } from './ueberwachung';

const VOR_10_MINUTEN = () => new Date(Date.now() - 10 * 60 * 1000);

const claudeVersionen = async (dir: string) =>
	(await readdir(path.join(dir, 'versionen'))).filter((v) => v.endsWith('_claude.html')).sort();

describe('Dateiüberwachung', () => {
	let s: TestServer | undefined;
	let strom: ReturnType<typeof sammleEreignisse> | undefined;
	afterEach(async () => {
		strom?.stop();
		await s?.stop();
	});

	it('meldet eine Änderung per Shell nach ~2 s und legt genau eine _claude-Version an', async () => {
		s = await starteTestServer({ ueberwachung: true });
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { jetzt: VOR_10_MINUTEN() });
		const vorher = await claudeVersionen(dir);
		strom = sammleEreignisse(s.url);
		await strom.bereit;
		const datei = path.join(dir, 'material.html');
		const start = Date.now();
		for (const n of [1, 2, 3]) {
			const html = await readFile(datei, 'utf8');
			await writeFile(datei, html.replace('</section>', `<p>Claude ${n}</p>\n</section>`));
			await warte(200);
		}
		await warte(RUHE_MS + 800);
		const ereignis = strom.ereignisse.find((e) => e.typ === 'dokument-geaendert');
		assert.ok(ereignis, 'kein Ereignis');
		const inhalt = await readFile(datei, 'utf8');
		assert.deepEqual(ereignis.daten, { mappe, dok, version: kennung(inhalt), urheber: 'claude' });
		assert.ok(ereignis.zeit - start < 3500, `Ereignis nach ${ereignis.zeit - start} ms`);
		assert.equal(strom.ereignisse.filter((e) => e.typ === 'dokument-geaendert').length, 1);
		const nachher = await claudeVersionen(dir);
		assert.equal(nachher.length, vorher.length + 1);
		assert.equal(await readFile(path.join(dir, 'versionen', nachher.at(-1) ?? ''), 'utf8'), inhalt);
	});

	it('erkennt atomares Schreiben (temporäre Datei + rename) und ignoriert die temporäre Datei', async () => {
		s = await starteTestServer({ ueberwachung: true, ruheMs: 300 });
		const { dir } = await legeDokumentAn(s.materialDir, { jetzt: VOR_10_MINUTEN() });
		strom = sammleEreignisse(s.url);
		await strom.bereit;
		const vorher = await claudeVersionen(dir);
		await schreibeAtomar(path.join(dir, 'material.html'), '<html><body class="kl2 sw"></body></html>');
		await writeFile(path.join(dir, '.material.html.99.abcd.tmp'), 'halb');
		await warte(900);
		assert.equal((await claudeVersionen(dir)).length, vorher.length + 1);
		assert.equal(strom.ereignisse.filter((e) => e.typ === 'dokument-geaendert').length, 1);
	});

	it('hält eigenes Speichern nicht für eine Änderung durch Claude', async () => {
		s = await starteTestServer({ ueberwachung: true, ruheMs: 300 });
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { jetzt: VOR_10_MINUTEN() });
		strom = sammleEreignisse(s.url);
		await strom.bereit;
		const url = `${s.url}/api/dokumente/${mappe}/${dok}`;
		const { quelle, version } = (await (await fetch(url)).json()) as { quelle: string; version: string };
		const neu = quelle.replace('</section>', '<p>Lehrkraft</p>\n</section>');
		const antwort = await fetch(url, {
			method: 'PUT',
			headers: schreibKoepfe,
			body: JSON.stringify({ quelle: neu, basisVersion: version }),
		});
		assert.equal(antwort.status, 200);
		const vorher = await claudeVersionen(dir);
		await warte(900);
		assert.deepEqual(await claudeVersionen(dir), vorher);
		const geaendert = strom.ereignisse.filter((e) => e.typ === 'dokument-geaendert');
		assert.deepEqual(
			geaendert.map((e) => e.daten),
			[{ mappe, dok, version: kennung(neu), urheber: 'lehrkraft' }],
		);
	});

	it('meldet neue Mappen mit mappe-neu, auch wenn sie per rename entstehen', async () => {
		s = await starteTestServer({ ueberwachung: true, ruheMs: 300 });
		strom = sammleEreignisse(s.url);
		await strom.bereit;
		const { mappe } = await neueMappe(s.materialDir, { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 });
		const andere = path.join(path.dirname(s.materialDir), `${path.basename(s.materialDir)}-x`);
		await neueMappe(andere, { titel: 'Igel', fach: 'sachunterricht', klasse: 3 }).then(async ({ mappe: m }) => {
			await rename(path.join(andere, m.id), path.join(s?.materialDir ?? '', 'igel'));
			await writeFile(path.join(s?.materialDir ?? '', 'notiz.txt'), 'kein Ereignis');
		});
		await warte(900);
		const neu = strom.ereignisse.filter((e) => e.typ === 'mappe-neu').map((e) => e.daten);
		assert.deepEqual(neu, [{ mappe: mappe.id }, { mappe: 'igel' }]);
	});
});
