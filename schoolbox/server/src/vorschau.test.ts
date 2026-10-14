import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { promisify } from 'node:util';

import { baueVorschau, BLATT_PY, neuesDokument, VORSCHAU_DATEI } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, sammleEreignisse, schreibKoepfe, starteTestServer, warte } from './testhilfe';

const ausfuehren = promisify(execFile);
const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('Vorschauen', () => {
	let s: TestServer | undefined;
	let strom: ReturnType<typeof sammleEreignisse> | undefined;
	afterEach(async () => {
		strom?.stop();
		await s?.stop();
	});

	const erstesDokument = async (server: TestServer, pfad = '/api/mappen') => {
		const daten = (await (await server.holen(`${server.url}${pfad}`)).json()) as {
			mappen?: { dokumente: { vorschau: string | null }[] }[];
			dokumente?: { vorschau: string | null }[];
		};
		return (daten.mappen?.[0]?.dokumente ?? daten.dokumente ?? [])[0]?.vorschau;
	};

	it('baut eine fehlende Vorschau einmal im Hintergrund und meldet sie', async () => {
		const gebaut: string[] = [];
		s = await starteTestServer({
			vorschauBauer: async (dokDir) => {
				gebaut.push(dokDir);
				await warte(150);
				await writeFile(path.join(dokDir, 'ausgabe', VORSCHAU_DATEI), 'PNG');
			},
		});
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		strom = sammleEreignisse(s.url, s.cookie);
		await strom.bereit;

		assert.equal(await erstesDokument(s), null);
		assert.equal(await erstesDokument(s), null);
		assert.equal(await erstesDokument(s, `/api/mappen/${mappe}`), null);
		await warte(400);
		assert.deepEqual(gebaut, [dir]);
		assert.deepEqual(
			strom.ereignisse.map((e) => [e.typ, e.daten]),
			[['vorschau-fertig', { mappe, dok }]],
		);
		const kennung = await erstesDokument(s);
		assert.match(kennung ?? '', /^[0-9a-z]+$/);
		await warte(100);
		assert.equal(gebaut.length, 1, 'eine aktuelle Vorschau wird nicht neu gebaut');

		const spaeter = new Date(Date.now() + 60_000);
		await utimes(path.join(dir, 'material.html'), spaeter, spaeter);
		assert.equal(await erstesDokument(s), kennung, 'bis die neue fertig ist, bleibt die alte sichtbar');
		await warte(400);
		assert.equal(gebaut.length, 2, 'eine veraltete Vorschau wird neu gebaut');
	});

	it('baut in der Übersicht nur das erste Dokument, in der Mappe alle', async () => {
		const gebaut: string[] = [];
		s = await starteTestServer({
			vorschauBauer: (dokDir) => {
				gebaut.push(path.basename(dokDir));
				return writeFile(path.join(dokDir, 'ausgabe', VORSCHAU_DATEI), 'PNG');
			},
		});
		const { mappe } = await legeDokumentAn(s.materialDir);
		const angaben = { art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'sw', druckhinweise: [] } as const;
		await neuesDokument(s.materialDir, mappe, { ...angaben, titel: 'Zweites' });
		await erstesDokument(s);
		await warte(200);
		assert.deepEqual(gebaut, ['blatt']);
		await erstesDokument(s, `/api/mappen/${mappe}`);
		await warte(200);
		assert.deepEqual(gebaut, ['blatt', 'zweites']);
	});

	it('legt nichts neu an, wenn die Mappe während des Baus gelöscht wird; nach dem Wiederherstellen baut sie neu', async () => {
		let versuche = 0;
		s = await starteTestServer({
			vorschauBauer: async (dokDir) => {
				versuche += 1;
				await warte(200);
				await writeFile(path.join(dokDir, 'ausgabe', VORSCHAU_DATEI), 'PNG');
			},
		});
		const { mappe } = await legeDokumentAn(s.materialDir);
		const sende = (pfad: string) =>
			s?.holen(`${s.url}${pfad}`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
		assert.equal(await erstesDokument(s), null);
		await warte(50);
		const geloescht = (await (await sende(`/api/mappen/${mappe}/loeschen`))?.json()) as {
			eintrag: { eintrag: string };
		};
		await warte(400);
		assert.equal(versuche, 1);
		assert.equal(existsSync(path.join(s.materialDir, mappe)), false, 'der Bau legt den Ordner nicht wieder an');

		const zurueck = await sende(`/api/papierkorb/${geloescht.eintrag.eintrag}/wiederherstellen`);
		assert.equal(zurueck?.status, 200);
		assert.equal(await erstesDokument(s), null);
		await warte(400);
		assert.equal(versuche, 2);
		assert.match((await erstesDokument(s)) ?? '', /^[0-9a-z]+$/);
	});

	it('versucht einen gescheiterten Bau erst wieder, wenn sich das Material geändert hat', async () => {
		let versuche = 0;
		const meldungen: unknown[][] = [];
		const original = console.error;
		console.error = (...teile: unknown[]) => meldungen.push(teile);
		try {
			s = await starteTestServer({
				vorschauBauer: () => {
					versuche += 1;
					return Promise.reject(new Error('Kein Chromium gefunden.'));
				},
			});
			const { dir } = await legeDokumentAn(s.materialDir);
			strom = sammleEreignisse(s.url, s.cookie);
			await strom.bereit;
			assert.equal(await erstesDokument(s), null);
			await warte(150);
			assert.equal(await erstesDokument(s), null);
			await warte(150);
			assert.equal(versuche, 1);
			assert.deepEqual(strom.ereignisse, []);
			assert.match(String(meldungen[0]?.[1]), /Kein Chromium/);

			const spaeter = new Date(Date.now() + 60_000);
			await utimes(path.join(dir, 'material.html'), spaeter, spaeter);
			await erstesDokument(s);
			await warte(150);
			assert.equal(versuche, 2);
		} finally {
			console.error = original;
		}
	});

	it('blatt.py baut die Vorschau nach ausgabe/ und lässt den Rest dort stehen', { timeout: 120_000 }, async (t) => {
		s = await starteTestServer();
		const python = s.kontext.konfig.pythonBin;
		const chromiumFehlt = await ausfuehren(python, ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)]).then(
			() => false,
			() => true,
		);
		if (chromiumFehlt) {
			t.skip('kein Chromium');
			return;
		}
		const { dir } = await legeDokumentAn(s.materialDir, { beispiel: true });
		await writeFile(path.join(dir, 'ausgabe', 'material.pdf'), 'altes PDF');
		const ziel = await baueVorschau(s.kontext.konfig, dir);
		assert.equal(ziel, path.join(dir, 'ausgabe', VORSCHAU_DATEI));
		assert.ok((await readFile(ziel)).subarray(0, 4).equals(PNG_KOPF));
		assert.ok((await stat(ziel)).mtimeMs >= (await stat(path.join(dir, 'material.html'))).mtimeMs);
		assert.equal(await readFile(path.join(dir, 'ausgabe', 'material.pdf'), 'utf8'), 'altes PDF');
		assert.equal(existsSync(path.join(dir, 'ausgabe', 'pruefbericht.json')), false);
	});
});
