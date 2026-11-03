import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { ART_FORMATE, ARTEN } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { schreibKoepfe, starteTestServer } from './testhilfe';

describe('Anlegen ohne Claude (045) und Katalog (044)', () => {
	let s: TestServer | undefined;
	afterEach(async () => {
		await s?.stop();
	});
	const sende = (server: TestServer, pfad: string, daten: unknown) =>
		server.holen(`${server.url}${pfad}`, { method: 'POST', headers: schreibKoepfe, body: JSON.stringify(daten) });
	const mappe = async (server: TestServer, titel = 'Uhrzeit') => {
		const a = await sende(server, '/api/mappen', { titel, fach: 'mathematik', klasse: 2 });
		assert.equal(a.status, 201);
		return ((await a.json()) as { mappe: { id: string } }).mappe.id;
	};

	it('Mappe: legt an; leerer Titel, falsches Fach und doppelter Titel ergeben eine klare Meldung, keine Dateien', async () => {
		s = await starteTestServer();
		await mappe(s);
		const vorher = await readdir(s.materialDir);
		for (const [daten, status, text] of [
			[{ titel: ' ', fach: 'mathematik', klasse: 2 }, 400, /Titel/],
			[{ titel: 'x', fach: 'latein', klasse: 2 }, 400, /Fach/],
			[{ titel: ' uhrzeit ', fach: 'mathematik', klasse: 2 }, 409, /gibt es schon/],
		] as const) {
			const a = await sende(s, '/api/mappen', daten);
			assert.equal(a.status, status);
			assert.match(((await a.json()) as { fehler: string }).fehler, text);
		}
		assert.deepEqual(await readdir(s.materialDir), vorher);
	});

	it('Dokument: jede Art mit jedem Format; erste Version von der Lehrkraft; keine Farbe im Spiel', async () => {
		s = await starteTestServer();
		const id = await mappe(s);
		for (const art of ARTEN) {
			for (const format of ART_FORMATE[art]) {
				const a = await sende(s, `/api/mappen/${id}/dokumente`, { titel: `${art} ${format}`, art, format });
				assert.equal(a.status, 201, `${art} ${format}`);
				const dok = ((await a.json()) as { id: string }).id;
				const dir = path.join(s.materialDir, id, 'dokumente', dok);
				assert.ok((await readdir(path.join(dir, 'versionen'))).every((v) => v.includes('lehrkraft')));
				assert.match(await readFile(path.join(dir, 'material.html'), 'utf8'), /class="seite"/);
			}
		}
	});

	it('Dokument: falsches Format, unbekannte Vorlage und doppelter Titel werden abgelehnt', async () => {
		s = await starteTestServer();
		const id = await mappe(s);
		const gut = { titel: 'Blatt', art: 'arbeitsblatt', format: 'a4-hoch' };
		assert.equal((await sende(s, `/api/mappen/${id}/dokumente`, gut)).status, 201);
		assert.equal((await sende(s, `/api/mappen/${id}/dokumente`, gut)).status, 409);
		assert.equal(
			(await sende(s, `/api/mappen/${id}/dokumente`, { ...gut, titel: 'B', format: 'folie' })).status,
			400,
		);
		assert.equal(
			(await sende(s, `/api/mappen/${id}/dokumente`, { ...gut, titel: 'C', vorlage: '../x' })).status,
			400,
		);
		assert.equal(existsSync(path.join(s.materialDir, id, 'dokumente', 'b')), false);
	});

	it('Zusatzbausteine landen im Material', async () => {
		s = await starteTestServer();
		const id = await mappe(s);
		const a = await sende(s, `/api/mappen/${id}/dokumente`, {
			titel: 'Mit allem',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			zusatz: { selbsteinschaetzung: true, niveaus: true, sternchen: true },
		});
		const dok = ((await a.json()) as { id: string }).id;
		const html = await readFile(path.join(s.materialDir, id, 'dokumente', dok, 'material.html'), 'utf8');
		for (const k of ['class="fuss"', 'class="wahlhilfe"', 'nr stern']) {
			assert.ok(html.includes(k), k);
		}
	});

	it('Katalog: alle Einträge mit Starter, Vorschau je Eintrag; Unbekanntes gibt 404', async () => {
		s = await starteTestServer();
		const a = await s.holen(`${s.url}/api/katalog`);
		const { eintraege } = (await a.json()) as {
			eintraege: { id: string; einfuegbar: { html?: string; teile?: string[]; klasse?: string } }[];
		};
		assert.ok(eintraege.length > 50);
		for (const e of eintraege) {
			assert.ok(e.einfuegbar.html || e.einfuegbar.teile || e.einfuegbar.klasse, e.id);
		}
		const v = await s.holen(`${s.url}/ansicht/_katalog/${eintraege[0]?.id}`);
		assert.equal(v.status, 200);
		assert.match(await v.text(), /blatt\.css/);
		assert.equal((await s.holen(`${s.url}/ansicht/_katalog/gibt-es-nicht`)).status, 404);
	});
});
