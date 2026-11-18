import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	kuerze,
	leseMitschrift,
	MITSCHRIFT_ORDNER,
	MITSCHRIFT_TEXT_ZEICHEN,
	mitschriftDatei,
	raeumeMitschriftenAuf,
	schreibeMitschrift,
} from './mitschrift';

/** Wartet, bis `pruefe` wahr ist; die Mitschrift packt nach dem Ende des Prozesses. */
const warte = async (pruefe: () => Promise<boolean>, ms = 5000) => {
	const bis = Date.now() + ms;
	while (!(await pruefe())) {
		if (Date.now() > bis) {
			throw new Error('Zeit abgelaufen');
		}
		await new Promise((r) => setTimeout(r, 20));
	}
};

/** Die Zeilen, die ein Lauf von `claude` mit `stream-json` ausgibt: Werkzeuge, ein Fehler, ein Bild, kein JSON. */
const AUSGABE = [
	{ type: 'system', subtype: 'init', session_id: 's1' },
	{
		type: 'assistant',
		message: {
			content: [
				{ type: 'text', text: 'Ich lese die Regeln.' },
				{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.md' } },
				{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: 'b.md' } },
				{ type: 'tool_use', id: 't3', name: 'mcp__schoolbox__bauen', input: {} },
			],
		},
	},
	{
		type: 'user',
		message: {
			content: [
				{ type: 'tool_result', tool_use_id: 't1', content: 'Wort '.repeat(MITSCHRIFT_TEXT_ZEICHEN / 5 + 10) },
				{
					type: 'tool_result',
					tool_use_id: 't2',
					content: [{ type: 'image', source: { type: 'base64', data: 'QUJD'.repeat(2000) } }],
				},
				{
					type: 'tool_result',
					tool_use_id: 't3',
					is_error: true,
					content: [{ type: 'text', text: 'Seite 2 läuft über.' }],
				},
			],
		},
	},
	{ type: 'result', subtype: 'success', total_cost_usd: 0.5 },
];

const starteAttrappe = () =>
	spawn(
		process.execPath,
		[
			'-e',
			`let e='';process.stdin.on('data',d=>e+=d);process.stdin.on('end',()=>{for(const z of ${JSON.stringify(
				AUSGABE,
			)})console.log(JSON.stringify(z));console.log('kein json');console.error('Warnung auf stderr');});`,
		],
		{ stdio: 'pipe' },
	);

describe('Mitschrift jedes Laufs (233)', () => {
	it('Kopf mit Auftrag und Systemauftrag, jede Zeile, Ende mit Werkzeugen und Fehlern; gepackt', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'mitschrift-'));
		try {
			const system = path.join(materialDir, 'system.md');
			await writeFile(system, 'Du baust ein Arbeitsblatt.');
			const kind = starteAttrappe();
			const argumente = ['-p', '--append-system-prompt-file', system];
			schreibeMitschrift({ materialDir, mappe: '2026-11-18-test', dok: 'blatt', art: 'einheit-bau' }, kind, {
				argumente,
				auftrag: 'Achsensymmetrie, Klasse 2',
				cwd: '/tmp/arbeit',
			});
			kind.stdin.end('Achsensymmetrie, Klasse 2');
			const ordner = path.join(materialDir, MITSCHRIFT_ORDNER, '2026-11-18-test');
			await warte(async () => {
				const n = await readdir(ordner).catch(() => [] as string[]);
				return n.length === 1 && n.every((d) => d.endsWith('.jsonl.gz'));
			});
			const dateien = await readdir(ordner);
			assert.match(dateien[0] ?? '', /^\d{4}-\d\d-\d\dT[\d-]+Z-einheit-bau-blatt\.jsonl\.gz$/);
			const zeilen = await leseMitschrift(path.join(ordner, dateien[0] ?? ''));

			const kopf = zeilen[0] ?? {};
			assert.equal(kopf.typ, 'kopf');
			assert.equal(kopf.auftrag, 'Achsensymmetrie, Klasse 2');
			assert.deepEqual(kopf.systemAuftrag, { datei: system, text: 'Du baust ein Arbeitsblatt.' });
			assert.deepEqual(kopf.argumente, argumente);
			assert.equal(kopf.cwd, '/tmp/arbeit');

			assert.equal(zeilen.length, AUSGABE.length + 3);
			const text = JSON.stringify(zeilen);
			assert.equal(text.includes('QUJDQUJD'), false, 'keine Bilddaten');
			assert.match(text, /\[Binärdaten, 8000 Zeichen\]/);
			assert.match(text, new RegExp(`\\[gekürzt, ${MITSCHRIFT_TEXT_ZEICHEN + 50} Zeichen\\]`));
			assert.deepEqual(zeilen.at(-2), { typ: 'text', zeile: 'kein json' });

			const ende = zeilen.at(-1) ?? {};
			assert.equal(ende.typ, 'ende');
			assert.equal(ende.code, 0);
			assert.deepEqual(ende.werkzeuge, { Read: 2, mcp__schoolbox__bauen: 1 });
			assert.deepEqual(ende.fehlerhaft, [{ werkzeug: 'mcp__schoolbox__bauen', text: 'Seite 2 läuft über.' }]);
			assert.match(String(ende.stderr), /Warnung auf stderr/);
		} finally {
			await rm(materialDir, { recursive: true, force: true });
		}
	});

	it('Ohne Ziel wird nichts geschrieben', async () => {
		const kind = starteAttrappe();
		schreibeMitschrift(undefined, kind, { argumente: [], auftrag: '', cwd: '' });
		kind.stdin.end('');
		await new Promise((r) => kind.on('close', r));
	});

	it('Dateiname nur aus sicheren Teilen', () => {
		const zeit = new Date('2026-11-18T08:30:00.000Z');
		const datei = (mappe: string | null, dok: string | null, art: string) =>
			`${path.basename(
				path.dirname(mitschriftDatei({ materialDir: '/m', mappe, dok, art }, zeit)),
			)}/${path.basename(mitschriftDatei({ materialDir: '/m', mappe, dok, art }, zeit))}`;
		assert.equal(datei('mappe-1', 'dok-1', 'blatt-bau'), 'mappe-1/2026-11-18T08-30-00-000Z-blatt-bau-dok-1.jsonl');
		assert.equal(
			datei('../weg', '_bilder', 'einheit-bilder'),
			'ohne-mappe/2026-11-18T08-30-00-000Z-einheit-bilder.jsonl',
		);
		assert.equal(
			datei(null, null, 'Bildlauf Bild/../x'),
			'ohne-mappe/2026-11-18T08-30-00-000Z-bildlauf-bild-x.jsonl',
		);
	});

	it('Kürzen lässt Kurzes und Text mit Leerzeichen stehen', () => {
		const lang = 'Wort '.repeat(1000);
		assert.deepEqual(kuerze({ a: [1, 'kurz', null], b: lang }), { a: [1, 'kurz', null], b: lang });
		assert.equal(kuerze('A'.repeat(1001)), '[Binärdaten, 1001 Zeichen]');
	});

	it('Aufräumen nimmt nur Altes und leere Ordner', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'mitschrift-'));
		try {
			const alt = path.join(materialDir, MITSCHRIFT_ORDNER, 'alt');
			const neu = path.join(materialDir, MITSCHRIFT_ORDNER, 'neu');
			await mkdir(alt, { recursive: true });
			await mkdir(neu, { recursive: true });
			await writeFile(path.join(alt, 'a.jsonl.gz'), '');
			await writeFile(path.join(neu, 'b.jsonl'), '');
			await writeFile(path.join(neu, 'c.jsonl.gz'), '');
			const vor31Tagen = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
			await utimes(path.join(alt, 'a.jsonl.gz'), vor31Tagen, vor31Tagen);
			await utimes(path.join(neu, 'b.jsonl'), vor31Tagen, vor31Tagen);
			assert.equal(await raeumeMitschriftenAuf(materialDir), 2);
			assert.equal(existsSync(alt), false);
			assert.deepEqual(await readdir(neu), ['c.jsonl.gz']);
			assert.equal(await raeumeMitschriftenAuf(path.join(materialDir, 'gibt-es-nicht')), 0);
		} finally {
			await rm(materialDir, { recursive: true, force: true });
		}
	});
});
