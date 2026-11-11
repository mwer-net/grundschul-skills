import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import type { PapierkorbEintrag } from '@schoolbox/kern';
import {
	ASSETS,
	legeInPapierkorb,
	leseFreigaben,
	PAPIERKORB_TAGE,
	VORSCHAU_DATEI,
	vorschaubilderDir,
} from '@schoolbox/kern';

import type { PapierkorbObjekt } from './papierkorb';
import { raeumePapierkorbAuf } from './papierkorb';
import type { TestServer } from './testhilfe';
import { fuehreAus, legeDokumentAn, leseAblage, ordnerVon, schreibKoepfe, starteTestServer } from './testhilfe';

const TAG_MS = 24 * 60 * 60 * 1000;

describe('Ablage: Übersicht, Vorschau, Papierkorb', () => {
	let s: TestServer | undefined;
	afterEach(async () => {
		await s?.stop();
	});

	const json = async <T>(antwort: Response) => (await antwort.json()) as T;
	const sende = (server: TestServer, pfad: string) =>
		server.holen(`${server.url}${pfad}`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
	const korb = async (server: TestServer) =>
		json<{ eintraege: PapierkorbEintrag[]; objekte: PapierkorbObjekt[]; tage: number }>(
			await server.holen(`${server.url}/api/papierkorb`),
		);

	it('die Übersicht überspringt kaputte Behälter und nennt sie, ohne Pfade des Servers', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const kaputt = path.join(s.materialDir, 'kaputte-mappe');
		await mkdir(kaputt);
		await writeFile(path.join(kaputt, 'mappe.json'), '{ "titel": ');
		const { defekt, ordner } = await leseAblage(s);
		assert.deepEqual(
			ordner.map((o) => o.behaelter),
			[mappe],
		);
		assert.equal(defekt.length, 1);
		assert.equal(defekt[0]?.id, 'kaputte-mappe');
		assert.ok(!defekt[0]?.fehler.includes(s.materialDir));
	});

	it('nennt die Kennung der Vorschau, sobald das Bild da ist; die Liste baut selbst keine', async () => {
		s = await starteTestServer();
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		assert.equal((await leseAblage(s)).dokumente[0]?.vorschau, null);
		await writeFile(path.join(dir, 'ausgabe', VORSCHAU_DATEI), 'PNG');
		const kennung = (await leseAblage(s)).dokumente[0]?.vorschau;
		assert.match(kennung ?? '', /^[0-9a-z]+$/);
		const eintrag = await json<{ dokumente: { id: string; vorschau: string | null }[] }>(
			await s.holen(`${s.url}/api/mappen/${mappe}`),
		);
		assert.deepEqual(
			eintrag.dokumente.map((d) => [d.id, d.vorschau]),
			[[dok, kennung]],
		);
		const bild = await s.holen(`${s.url}/ansicht/${mappe}/dokumente/${dok}/ausgabe/${VORSCHAU_DATEI}?v=${kennung}`);
		assert.equal(bild.status, 200);
		assert.equal(await bild.text(), 'PNG');
	});

	it('kopiert einen Ordner unabhängig; ohne CSRF-Kopf 403, ohne Anmeldung 401', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		const ordner = await ordnerVon(s, mappe);
		const antwort = await fuehreAus(s, { art: 'kopieren', knoten: [{ ordner }], ziel: null });
		assert.equal(antwort.status, 200);
		const ablage = await leseAblage(s);
		const kopie = ablage.ordner.find((o) => o.id !== ordner);
		assert.equal(kopie?.name, 'Zehner und Einer (Kopie)');
		assert.notEqual(kopie?.behaelter, mappe);
		assert.equal((await s.holen(`${s.url}/ansicht/${kopie?.behaelter}/dokumente/${dok}/`)).status, 200);

		const ohneKopf = await s.holen(`${s.url}/api/ordner/aktion`, { method: 'POST' });
		assert.equal(ohneKopf.status, 403);
		assert.equal((await fetch(`${s.url}/api/ordner/aktion`, { method: 'POST' })).status, 401);
	});

	it('Papierkorb: ein Zustand im Baum, Dateien bleiben; die Umkehr holt alles zurück, Teilen-Links folgen', async () => {
		s = await starteTestServer();
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		const { token } = await json<{ token: string }>(
			await s.holen(`${s.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ mappe, dok }),
			}),
		);
		const ordner = await ordnerVon(s, mappe);
		const { umkehr } = await json<{ umkehr: unknown[] }>(
			await fuehreAus(s, { art: 'papierkorb', knoten: [{ ordner }] }),
		);

		assert.equal(existsSync(dir), true);
		assert.deepEqual((await leseAblage(s)).ordner, []);
		assert.deepEqual((await leseAblage(s)).dokumente, []);
		assert.equal((await fetch(`${s.url}/f/${token}/api/inhalt`)).status, 410);
		const { objekte, tage } = await korb(s);
		assert.equal(tage, PAPIERKORB_TAGE);
		assert.deepEqual(
			objekte.map((o) => [o.name, o.objekte]),
			[['Zehner und Einer', 1]],
		);

		for (const schritt of umkehr) {
			assert.equal((await fuehreAus(s, schritt)).status, 200);
		}
		assert.equal((await leseAblage(s)).dokumente.length, 1);
		assert.equal((await fetch(`${s.url}/f/${token}/api/inhalt`)).status, 200);
		assert.deepEqual((await korb(s)).objekte, []);
	});

	it('alte Einträge im Papierkorb bleiben wiederherstellbar', async () => {
		s = await starteTestServer();
		const { dir, mappe } = await legeDokumentAn(s.materialDir);
		await legeInPapierkorb(s.materialDir, mappe);
		const alte = (await korb(s)).eintraege;
		assert.deepEqual(
			alte.map((e) => e.id),
			[mappe],
		);
		assert.equal((await sende(s, `/api/papierkorb/${alte[0]?.eintrag}/wiederherstellen`)).status, 200);
		assert.equal(existsSync(dir), true);
		assert.equal((await leseAblage(s)).dokumente.length, 1);
		assert.equal((await sende(s, `/api/papierkorb/${alte[0]?.eintrag}/wiederherstellen`)).status, 404);
		assert.equal((await sende(s, '/api/papierkorb/..%2f..%2fetc/wiederherstellen')).status, 404);
	});

	it('nach 30 Tagen ist der Ordner samt Behälter und Teilen-Links weg (simulierte Zeit)', async () => {
		s = await starteTestServer();
		const { dir, mappe } = await legeDokumentAn(s.materialDir);
		const andere = await legeDokumentAn(s.materialDir);
		for (const ziel of [mappe, andere.mappe]) {
			await s.holen(`${s.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ mappe: ziel }),
			});
		}
		// 178: Ein Vorschaubild, wie es eine Kachel in „Bilder“ anfragt.
		await copyFile(
			path.join(ASSETS, 'bilder', 'wilma.png'),
			path.join(s.materialDir, andere.mappe, 'bilder', 'v.png'),
		);
		const kachel = await s.holen(`${s.url}/ansicht/${andere.mappe}/bilder/v.png?vorschaubild=1`);
		assert.equal(kachel.headers.get('content-type'), 'image/webp');
		const vorschaubilderOrdner = vorschaubilderDir(s.materialDir);
		const vorschaubilder = () => readdir(vorschaubilderOrdner).catch(() => []);
		assert.equal((await vorschaubilder()).length, 1);
		const ordner = await ordnerVon(s, mappe);
		await fuehreAus(s, { art: 'papierkorb', knoten: [{ ordner }] });
		const geloescht = Date.now();

		assert.deepEqual(await raeumePapierkorbAuf(s.kontext, new Date(geloescht + 29 * TAG_MS)), []);
		assert.equal((await leseFreigaben(s.materialDir)).length, 2);
		assert.equal((await vorschaubilder()).length, 1);

		const entfernt = await raeumePapierkorbAuf(s.kontext, new Date(geloescht + (PAPIERKORB_TAGE + 1) * TAG_MS));
		assert.deepEqual(entfernt, [mappe]);
		assert.equal(existsSync(dir), false);
		assert.deepEqual(await vorschaubilder(), []);
		assert.deepEqual((await korb(s)).objekte, []);
		assert.deepEqual(
			(await leseFreigaben(s.materialDir)).map((f) => ('mappe' in f.ziel ? f.ziel.mappe : '')),
			[andere.mappe],
		);
	});
});
