import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { kennung } from './kontext';
import type { TestServer } from './testhilfe';
import { legeDokumentAn, schreibKoepfe, starteTestServer } from './testhilfe';

interface DokumentAntwort {
	quelle: string;
	version: string;
	ausgabeVeraltet: boolean;
	meta: { titel: string; hatLoesung: boolean };
}

describe('API', () => {
	let s: TestServer;
	let mappe: string;
	let dok: string;
	let dir: string;
	const dokUrl = () => `${s.url}/api/dokumente/${mappe}/${dok}`;
	const lies = async () => (await (await s.holen(dokUrl())).json()) as DokumentAntwort;
	const speichere = (body: unknown, koepfe: Record<string, string> = schreibKoepfe) =>
		s.holen(dokUrl(), { method: 'PUT', headers: koepfe, body: JSON.stringify(body) });

	before(async () => {
		s = await starteTestServer();
		({ dir, dok, mappe } = await legeDokumentAn(s.materialDir));
	});
	after(() => s.stop());

	it('/healthz antwortet ohne Anmeldung mit ok und Version', async () => {
		const antwort = await s.holen(`${s.url}/healthz`);
		assert.deepEqual(await antwort.json(), { status: 'ok', version: 'test' });
	});

	it('listet Mappen und filtert nach Fach, Klasse und Suche', async () => {
		const alle = (await (await s.holen(`${s.url}/api/mappen`)).json()) as { mappen: unknown[] };
		assert.equal(alle.mappen.length, 1);
		const filter = async (query: string) =>
			((await (await s.holen(`${s.url}/api/mappen?${query}`)).json()) as { mappen: unknown[] }).mappen.length;
		assert.equal(await filter('fach=mathematik&klasse=2&suche=zehner'), 1);
		assert.equal(await filter('fach=deutsch'), 0);
		assert.equal(await filter('suche=kartoffel'), 0);
		const falsch = await s.holen(`${s.url}/api/mappen?fach=mathe`);
		assert.equal(falsch.status, 400);
		assert.match(((await falsch.json()) as { fehler: string }).fehler, /Gültige Werte: deutsch/);
	});

	it('liefert Mappe und Dokument, unbekannte als 404, ungültige IDs als 400', async () => {
		const eintrag = (await (await s.holen(`${s.url}/api/mappen/${mappe}`)).json()) as { dokumente: unknown[] };
		assert.equal(eintrag.dokumente.length, 1);
		const dokument = await lies();
		assert.equal(dokument.meta.titel, 'Blatt');
		assert.equal(dokument.version, kennung(dokument.quelle));
		assert.equal(dokument.ausgabeVeraltet, true);
		assert.equal((await s.holen(`${s.url}/api/mappen/gibt-es-nicht`)).status, 404);
		assert.equal((await s.holen(`${s.url}/api/dokumente/${mappe}/gibt-es-nicht`)).status, 404);
		assert.equal((await s.holen(`${s.url}/api/mappen/Gross`)).status, 400);
		assert.equal((await s.holen(`${s.url}/api/dokumente/${mappe}/..%2f..`)).status, 400);
		assert.equal((await s.holen(`${s.url}/api/nichts`)).status, 404);
	});

	it('speichert mit passender basisVersion und legt eine Version der Lehrkraft an', async () => {
		const { quelle, version } = await lies();
		const neu = quelle.replace('</section>', '<p>Neu</p>\n</section>');
		const antwort = await speichere({ quelle: neu, basisVersion: version });
		assert.equal(antwort.status, 200);
		const ergebnis = (await antwort.json()) as { version: string };
		assert.equal(ergebnis.version, kennung(neu));
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), neu);
		const versionen = await readdir(path.join(dir, 'versionen'));
		assert.ok(versionen.some((v) => v.endsWith('_lehrkraft.html')));
	});

	it('setzt hatLoesung beim Speichern nach derselben Regel wie blatt.py', async () => {
		const { quelle, version } = await lies();
		const mit = quelle.replace('</section>', '<p><span class="antwort" data-l="7"></span></p>\n</section>');
		const erste = (await (await speichere({ quelle: mit, basisVersion: version })).json()) as { version: string };
		assert.equal((await lies()).meta.hatLoesung, true);
		const ohne = mit.replace(/ data-l="[^"]*"/g, '').replace(/nur-loesung|loesung=/g, 'x');
		await speichere({ quelle: ohne, basisVersion: erste.version });
		assert.equal((await lies()).meta.hatLoesung, false);
		await speichere({ quelle: mit, basisVersion: kennung(ohne) });
		assert.equal((await lies()).meta.hatLoesung, true);
	});

	it('lehnt eine veraltete basisVersion mit 409 ab und überschreibt nichts', async () => {
		const { quelle, version } = await lies();
		await writeFile(path.join(dir, 'material.html'), quelle.replace('Neu', 'Claude war schneller'));
		const antwort = await speichere({ quelle: 'Lehrkraft', basisVersion: version });
		assert.equal(antwort.status, 409);
		const daten = (await antwort.json()) as { version: string };
		const aufPlatte = await readFile(path.join(dir, 'material.html'), 'utf8');
		assert.match(aufPlatte, /Claude war schneller/);
		assert.equal(daten.version, kennung(aufPlatte));
	});

	it('verlangt JSON und den eigenen Header für schreibende Anfragen', async () => {
		const { quelle, version } = await lies();
		const body = { quelle, basisVersion: version };
		assert.equal((await speichere(body, { 'Content-Type': 'application/json' })).status, 403);
		assert.equal((await speichere(body, { 'Content-Type': 'text/plain', 'x-schoolbox': '1' })).status, 403);
		const formular = await s.holen(dokUrl(), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'quelle=x',
		});
		assert.equal(formular.status, 403);
	});

	it('lehnt fehlerhafte Inhalte, falsches Format und zu große Daten ab', async () => {
		const { quelle, version } = await lies();
		assert.equal((await speichere({ quelle: '', basisVersion: version })).status, 400);
		assert.equal((await speichere({ quelle, basisVersion: 'abc' })).status, 400);
		const quer = quelle.replace('<body class="', '<body class="a4-quer ');
		const format = await speichere({ quelle: quer, basisVersion: version });
		assert.equal(format.status, 400);
		assert.match(((await format.json()) as { fehler: string }).fehler, /Format passt nicht/);
		const riesig = await speichere({ quelle: 'x'.repeat(6 * 1024 * 1024), basisVersion: version });
		assert.equal(riesig.status, 413);
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), quelle);
	});

	it('listet Versionen und stellt eine wieder her', async () => {
		const liste = async () =>
			((await (await s.holen(`${dokUrl()}/versionen`)).json()) as { versionen: { id: string }[] }).versionen;
		const versionen = await liste();
		const erste = versionen[0];
		assert.ok(erste);
		const ziel = `${dokUrl()}/versionen/${erste.id}/wiederherstellen`;
		const antwort = await s.holen(ziel, { method: 'POST', headers: schreibKoepfe, body: '{}' });
		assert.equal(antwort.status, 200);
		const ersteQuelle = await readFile(path.join(dir, 'versionen', `${erste.id}.html`), 'utf8');
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), ersteQuelle);
		const nachher = await liste();
		assert.ok(
			nachher.some((v) => v.id.endsWith('_claude') && v.id !== erste.id),
			'Claudes Stand wurde gesichert',
		);
		const unbekannt = await s.holen(`${dokUrl()}/versionen/2020-01-01T00-00-00Z_claude/wiederherstellen`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: '{}',
		});
		assert.equal(unbekannt.status, 404);
	});

	it('zeigt eine Version und legt beim Wiederherstellen eine eigene an, statt die letzte zu überschreiben', async () => {
		const { quelle, version } = await lies();
		const bearbeitet = quelle.replace('</body>', '<p>von der Lehrkraft</p></body>');
		assert.equal((await speichere({ quelle: bearbeitet, basisVersion: version })).status, 200);
		const liste = async () =>
			((await (await s.holen(`${dokUrl()}/versionen`)).json()) as { versionen: { id: string }[] }).versionen;
		const vorher = await liste();
		const erste = vorher[0];
		assert.ok(erste);
		const ansicht = (await (await s.holen(`${dokUrl()}/versionen/${erste.id}`)).json()) as {
			quelle: string;
			version: { id: string; urheber: string };
		};
		assert.equal(ansicht.version.id, erste.id);
		assert.equal(ansicht.quelle, await readFile(path.join(dir, 'versionen', `${erste.id}.html`), 'utf8'));
		assert.equal((await s.holen(`${dokUrl()}/versionen/2020-01-01T00-00-00Z_claude`)).status, 404);

		const ziel = `${dokUrl()}/versionen/${erste.id}/wiederherstellen`;
		assert.equal((await s.holen(ziel, { method: 'POST', headers: schreibKoepfe, body: '{}' })).status, 200);
		const nachher = await liste();
		assert.equal(nachher.length, vorher.length + 1);
		const inhalte = await Promise.all(
			nachher.map((v) => readFile(path.join(dir, 'versionen', `${v.id}.html`), 'utf8')),
		);
		assert.ok(inhalte.includes(bearbeitet), 'die bearbeitete Fassung bleibt als Version');
	});

	it('sichert einen ungespeicherten Stand als Version, ohne material.html zu ändern', async () => {
		const { quelle } = await lies();
		await writeFile(path.join(dir, 'material.html'), quelle.replace('</body>', '<p>von Claude</p></body>'));
		const vonClaude = await readFile(path.join(dir, 'material.html'), 'utf8');
		const offen = quelle.replace('</body>', '<p>noch nicht gespeichert</p></body>');
		const antwort = await s.holen(`${dokUrl()}/versionen`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ quelle: offen }),
		});
		assert.equal(antwort.status, 200);
		const { gesichert } = (await antwort.json()) as { gesichert: { id: string; urheber: string } };
		assert.equal(gesichert.urheber, 'lehrkraft');
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), vonClaude);
		const { versionen } = (await (await s.holen(`${dokUrl()}/versionen`)).json()) as {
			versionen: { id: string }[];
		};
		const [vorletzte, letzte] = versionen.slice(-2);
		assert.equal(versionen.filter((v) => v.id === gesichert.id).length, 1);
		assert.equal(vorletzte?.id, gesichert.id);
		assert.ok(letzte?.id.endsWith('_claude'));
		assert.equal(await readFile(path.join(dir, 'versionen', `${letzte?.id ?? ''}.html`), 'utf8'), vonClaude);
		const leer = await s.holen(`${dokUrl()}/versionen`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
		assert.equal(leer.status, 400);
	});
});
