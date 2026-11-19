import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { BibliotheksFigur } from '@schoolbox/kern';
import { figurenDir } from '@schoolbox/kern';

import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { legeTestfigurenAn, starteTestServer } from './testhilfe';

describe('Figuren entfernen (176)', () => {
	let server: TestServer;
	const entferne = (pose: string) =>
		server.holen(`${server.url}/api/figuren/posen/${pose}/entfernen`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
			body: '{}',
		});
	const posen = async () => {
		const { figuren } = (await (await server.holen(`${server.url}/api/figuren`)).json()) as {
			figuren: BibliotheksFigur[];
		};
		return figuren.flatMap((f) => f.posen.map((p) => p.id));
	};

	before(async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-api-'));
		await legeTestfigurenAn(materialDir);
		server = await starteTestServer({ materialDir });
	});

	after(async () => {
		await server.stop();
	});

	it('200: Die Pose fehlt danach in der Bibliothek, ihre Datei bleibt liegen', async () => {
		assert.deepEqual(await posen(), ['willi', 'wilma', 'kiki', 'kiki-winkt']);
		const antwort = await entferne('kiki-winkt');
		assert.equal(antwort.status, 200, await antwort.clone().text());
		assert.deepEqual(await posen(), ['willi', 'wilma', 'kiki']);
		assert.ok(existsSync(path.join(figurenDir(server.materialDir), 'kiki-winkt.png')));
	});

	it('404 für eine Pose, die es nicht gibt', async () => {
		const antwort = await entferne('gibtsnicht');
		assert.equal(antwort.status, 404);
		assert.deepEqual(await antwort.json(), { fehler: 'Diese Pose gibt es nicht.' });
	});

	it('400 für die Grundpose von Wilma; die Bibliothek bleibt gleich', async () => {
		const davor = await posen();
		const antwort = await entferne('wilma');
		assert.equal(antwort.status, 400);
		assert.deepEqual(await posen(), davor);
	});
});

describe('Vermerk quittieren (253)', () => {
	let server: TestServer;
	const geprueft = (figur: string) =>
		server.holen(`${server.url}/api/figuren/${figur}/geprueft`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
			body: '{}',
		});

	before(async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-api-'));
		await legeTestfigurenAn(materialDir);
		const kiki = { id: 'kiki', name: 'Kiki', vermerk: 'Bitte prüfen', posen: [{ datei: 'kiki.png' }] };
		await writeFile(path.join(figurenDir(materialDir), 'figuren.json'), JSON.stringify({ version: 1, figuren: [kiki] }));
		server = await starteTestServer({ materialDir });
	});

	after(async () => {
		await server.stop();
	});

	it('„Geprüft“ entfernt den Vermerk; 404 für eine Figur, die es nicht gibt', async () => {
		const vermerk = async () =>
			(
				(await (await server.holen(`${server.url}/api/figuren`)).json()) as { figuren: BibliotheksFigur[] }
			).figuren.find((f) => f.id === 'kiki')?.vermerk;
		assert.equal(await vermerk(), 'Bitte prüfen');
		const antwort = await geprueft('kiki');
		assert.equal(antwort.status, 200, await antwort.clone().text());
		assert.equal(await vermerk(), undefined);
		assert.equal((await geprueft('gibtsnicht')).status, 404);
	});
});
