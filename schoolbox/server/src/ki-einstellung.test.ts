import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
	KI_EINSTELLUNG_DATEI,
	KI_EINSTELLUNG_STANDARD,
	leseKiEinstellung,
	schreibeKiEinstellung,
	waehleLauf,
} from './ki-einstellung';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { starteTestServer } from './testhilfe';

describe('Einstellung für Claude (232)', () => {
	it('Ohne Datei und mit kaputter Datei gilt der Standard', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'ki-einstellung-'));
		try {
			assert.deepEqual(await leseKiEinstellung(dir), { modell: null, effort: 'auto' });
			await writeFile(path.join(dir, KI_EINSTELLUNG_DATEI), '{kaputt');
			assert.deepEqual(await leseKiEinstellung(dir), { modell: null, effort: 'auto' });
			await writeFile(path.join(dir, KI_EINSTELLUNG_DATEI), JSON.stringify({ modell: 'gpt', effort: 'high' }));
			assert.deepEqual(await leseKiEinstellung(dir), { modell: null, effort: 'high' });
			await writeFile(path.join(dir, KI_EINSTELLUNG_DATEI), '[1]');
			assert.deepEqual(await leseKiEinstellung(dir), { modell: null, effort: 'auto' });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('Schreiben und Lesen', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'ki-einstellung-'));
		try {
			await schreibeKiEinstellung(dir, { modell: 'sonnet', effort: 'max' });
			assert.deepEqual(await leseKiEinstellung(dir), { modell: 'sonnet', effort: 'max' });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('waehleLauf: „auto“ je nach Art, feste Werte immer', () => {
		const konfig = { kiModell: 'opus' };
		assert.deepEqual(waehleLauf(KI_EINSTELLUNG_STANDARD, konfig, 'klein'), { modell: 'opus', effort: 'medium' });
		assert.deepEqual(waehleLauf(KI_EINSTELLUNG_STANDARD, konfig, 'gross'), { modell: 'opus', effort: 'high' });
		const fest = { modell: 'haiku', effort: 'low' } as const;
		assert.deepEqual(waehleLauf(fest, konfig, 'klein'), { modell: 'haiku', effort: 'low' });
		assert.deepEqual(waehleLauf(fest, konfig, 'gross'), { modell: 'haiku', effort: 'low' });
		assert.deepEqual(waehleLauf({ modell: null, effort: 'xhigh' }, konfig, 'klein'), {
			modell: 'opus',
			effort: 'xhigh',
		});
	});

	describe('Route', () => {
		let server: TestServer;
		const api = (init: { method?: string; body?: string } = {}) =>
			server.holen(`${server.url}/api/ki/einstellung`, {
				...init,
				headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
			});
		const setze = (teil: unknown) => api({ method: 'PUT', body: JSON.stringify(teil) });

		before(async () => {
			server = await starteTestServer();
		});

		after(async () => {
			await server.stop();
		});

		it('GET liefert Standard, Standardmodell und die Liste der Modelle', async () => {
			const res = await api();
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), {
				modell: null,
				effort: 'auto',
				standardModell: 'opus',
				modelle: [
					{ id: 'opus', name: 'Opus' },
					{ id: 'sonnet', name: 'Sonnet' },
					{ id: 'haiku', name: 'Haiku' },
				],
			});
		});

		it('PUT ändert nur, was kommt, und schreibt die Datei', async () => {
			assert.equal((await setze({ effort: 'high' })).status, 200);
			const res = await setze({ modell: 'haiku' });
			assert.equal(res.status, 200);
			assert.deepEqual(
				((await res.json()) as { modell: string; effort: string }).effort,
				'high',
				'Die Gründlichkeit bleibt',
			);
			const datei = JSON.parse(
				await readFile(path.join(server.materialDir, KI_EINSTELLUNG_DATEI), 'utf8'),
			) as unknown;
			assert.deepEqual(datei, { modell: 'haiku', effort: 'high' });
			assert.equal((await setze({ modell: null })).status, 200);
			assert.deepEqual(await leseKiEinstellung(server.materialDir), { modell: null, effort: 'high' });
		});

		it('Unsinn ergibt 400 und ändert nichts', async () => {
			await setze({ modell: 'sonnet', effort: 'low' });
			for (const falsch of [
				{ modell: 'gpt-4' },
				{ modell: 3 },
				{ effort: 'turbo' },
				{ effort: null },
				[],
				'opus',
			]) {
				assert.equal((await setze(falsch)).status, 400, JSON.stringify(falsch));
			}
			assert.deepEqual(await leseKiEinstellung(server.materialDir), { modell: 'sonnet', effort: 'low' });
		});

		it('Ohne CSRF-Kopf keine Änderung', async () => {
			const res = await server.holen(`${server.url}/api/ki/einstellung`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ effort: 'max' }),
			});
			assert.equal(res.status, 403);
			assert.notEqual((await leseKiEinstellung(server.materialDir)).effort, 'max');
		});
	});
});
