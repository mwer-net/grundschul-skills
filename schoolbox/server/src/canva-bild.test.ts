import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { erstelleBildLader, ladeCanvaBild, leseBildWuensche, notiereCanvaId, pruefeCanvaUrl } from './canva-bild';
import { CANVA_WERKZEUGE, canvaEinstellungen, kiArgumente, NIE_KONNEKTOR_WERKZEUGE } from './ki';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const URL_OK = 'https://export-download.canva.com/abc/bild.png?x=1';

const antwort = (body: Buffer | string, status = 200, headers: Record<string, string> = {}) =>
	new Response(status >= 300 && status < 400 ? null : body, { status, headers });

describe('Bilder aus Canva (138)', () => {
	let dir: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'canva-bild-'));
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('nimmt nur HTTPS auf den Export-Host, ohne Port und Zugangsdaten', () => {
		assert.equal(pruefeCanvaUrl(URL_OK).host, 'export-download.canva.com');
		for (const url of [
			'http://export-download.canva.com/a.png',
			'https://export-download.canva.com:8443/a.png',
			'https://u:p@export-download.canva.com/a.png',
			'https://export-download.canva.com.boese.de/a.png',
			'https://127.0.0.1/a.png',
			'file:///etc/passwd',
		]) {
			assert.throws(() => pruefeCanvaUrl(url), url);
		}
	});

	it('lädt PNG und JPEG und prüft Endung, Inhalt und Dateiname', async () => {
		await ladeCanvaBild({ datei: 'fall-1.png', url: URL_OK }, dir, () => Promise.resolve(antwort(PNG)));
		assert.ok(existsSync(path.join(dir, 'fall-1.png')));
		await ladeCanvaBild({ datei: 'fall-2.jpg', url: URL_OK }, dir, () => Promise.resolve(antwort(JPG)));
		await assert.rejects(ladeCanvaBild({ datei: 'x.jpg', url: URL_OK }, dir, () => Promise.resolve(antwort(PNG))));
		await assert.rejects(
			ladeCanvaBild({ datei: 'x.png', url: URL_OK }, dir, () => Promise.resolve(antwort('<svg/>'))),
		);
		await assert.rejects(
			ladeCanvaBild({ datei: '../x.png', url: URL_OK }, dir, () => Promise.resolve(antwort(PNG))),
		);
		await assert.rejects(
			ladeCanvaBild({ datei: 'x.png', url: URL_OK }, dir, () => Promise.resolve(antwort(PNG, 500))),
		);
	});

	it('folgt Weiterleitungen nur auf denselben Host und höchstens zweimal', async () => {
		let n = 0;
		await ladeCanvaBild({ datei: 'weiter.png', url: URL_OK }, dir, () =>
			Promise.resolve(n++ === 0 ? antwort('', 302, { location: '/neu.png' }) : antwort(PNG)),
		);
		assert.ok(existsSync(path.join(dir, 'weiter.png')));
		await assert.rejects(
			ladeCanvaBild({ datei: 'fremd.png', url: URL_OK }, dir, () =>
				Promise.resolve(antwort('', 302, { location: 'https://example.org/a.png' })),
			),
		);
		await assert.rejects(
			ladeCanvaBild({ datei: 'kreis.png', url: URL_OK }, dir, () =>
				Promise.resolve(antwort('', 302, { location: '/a.png' })),
			),
		);
	});

	it('Bilderliste: Unpassendes fällt still heraus, jedes Bild wird einmal geladen', async () => {
		const arbeit = await mkdtemp(path.join(dir, 'arbeit-'));
		await writeFile(
			path.join(arbeit, 'bilder.json'),
			JSON.stringify([
				{ datei: 'a.png', url: URL_OK, motiv: 'Uhr', mediaId: 'MA1' },
				{ datei: 'b.png', url: URL_OK, motiv: 'ohne Media-ID' },
				{ datei: 'c.png', url: 'https://example.org/c.png', motiv: 'fremder Host', mediaId: 'MA3' },
				'kaputt',
			]),
		);
		assert.deepEqual(
			(await leseBildWuensche(arbeit)).map((w) => w.datei),
			['a.png', 'c.png'],
		);
		let aufrufe = 0;
		const lader = erstelleBildLader(arbeit, path.join(arbeit, 'bilder'), () => {
			aufrufe += 1;
			return Promise.resolve(antwort(PNG));
		});
		await lader.pruefe();
		await lader.pruefe();
		assert.equal(aufrufe, 1);
		assert.deepEqual(
			lader.stand().map((s) => [s.datei, s.ok]),
			[
				['a.png', true],
				['c.png', false],
			],
		);
		assert.equal(lader.wunsch('a.png')?.mediaId, 'MA1');
	});

	it('Media-IDs landen in canva-ids.tsv, ohne Tabulatoren im Motiv', async () => {
		await notiereCanvaId(dir, { datei: 'a.png', mediaId: 'MA1', motiv: 'Uhr\tmit Zeigern' });
		const tsv = await readFile(path.join(dir, 'canva-ids.tsv'), 'utf8');
		assert.match(tsv, /^datei\tmedia-id\tmotiv\n/);
		assert.equal(tsv.trim().split('\n').at(-1)?.split('\t').length, 3);
	});
});

describe('Konnektoren im Lauf (138)', () => {
	const basis = { ablage: '/tmp/a', auftragDatei: '/tmp/a.md', budgetUsd: 1, modell: 'opus', sitzung: null };

	it('Ohne Canva bleibt der Aufruf wie bisher: keine Konnektoren', () => {
		const args = kiArgumente(basis);
		assert.ok(args.includes('--strict-mcp-config'));
		assert.ok(!args.includes('--settings'));
		assert.ok(!args.join(' ').includes('Canva'));
	});

	it('Mit Canva: nur Canva geladen, Gmail, Drive und Docs verboten, nur die Bildwerkzeuge frei', () => {
		const args = kiArgumente({ ...basis, einheit: true, mitCanva: true });
		/** Die Werte einer Option bis zur nächsten: `--allowedTools` und `--disallowedTools` nehmen mehrere. */
		const werte = (option: string) => {
			const ab = args.slice(args.indexOf(option) + 1);
			const bis = ab.findIndex((x) => x.startsWith('--'));
			return ab.slice(0, bis === -1 ? undefined : bis).join(' ');
		};
		assert.ok(!args.includes('--strict-mcp-config'));
		const einstellungen = JSON.parse(args[args.indexOf('--settings') + 1] ?? '{}') as Record<string, unknown>;
		assert.deepEqual(einstellungen, JSON.parse(canvaEinstellungen()));
		const erlaubt = werte('--allowedTools');
		for (const w of CANVA_WERKZEUGE) {
			assert.ok(erlaubt.includes(w), w);
		}
		assert.ok(!/Gmail|Drive|Docs|delete|share|comment/i.test(erlaubt));
		const verboten = werte('--disallowedTools');
		for (const w of NIE_KONNEKTOR_WERKZEUGE) {
			assert.ok(verboten.includes(w), w);
		}
		assert.ok(!(args[args.indexOf('--tools') + 1] ?? '').includes('Bash'));
	});
});
