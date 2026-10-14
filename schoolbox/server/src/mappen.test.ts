import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import type { Mappe, PapierkorbEintrag } from '@schoolbox/kern';
import { leseFreigaben, PAPIERKORB_TAGE, VORSCHAU_DATEI } from '@schoolbox/kern';

import { raeumePapierkorbAuf } from './papierkorb';
import type { TestServer } from './testhilfe';
import { legeDokumentAn, sammleEreignisse, schreibKoepfe, starteTestServer, warte } from './testhilfe';

interface Liste {
	mappen: { mappe: Mappe; dokumente: { id: string; vorschau: string | null }[] }[];
	defekt: { id: string; fehler: string }[];
}

const TAG_MS = 24 * 60 * 60 * 1000;

describe('Mappen: Übersicht, Duplizieren, Papierkorb', () => {
	let s: TestServer | undefined;
	let strom: ReturnType<typeof sammleEreignisse> | undefined;
	afterEach(async () => {
		strom?.stop();
		await s?.stop();
	});

	const json = async <T>(antwort: Response) => (await antwort.json()) as T;
	const sende = (server: TestServer, pfad: string) =>
		server.holen(`${server.url}${pfad}`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
	const liste = async (server: TestServer) => json<Liste>(await server.holen(`${server.url}/api/mappen`));

	it('die Übersicht überspringt kaputte Mappen und nennt sie, ohne Pfade des Servers', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const kaputt = path.join(s.materialDir, 'kaputte-mappe');
		await mkdir(kaputt);
		await writeFile(path.join(kaputt, 'mappe.json'), '{ "titel": ');
		const { defekt, mappen } = await liste(s);
		assert.deepEqual(
			mappen.map((e) => e.mappe.id),
			[mappe],
		);
		assert.equal(defekt.length, 1);
		assert.equal(defekt[0]?.id, 'kaputte-mappe');
		assert.ok(!defekt[0]?.fehler.includes(s.materialDir));
	});

	it('nennt die Kennung der Vorschau, sobald das Bild da ist', async () => {
		s = await starteTestServer();
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		assert.equal((await liste(s)).mappen[0]?.dokumente[0]?.vorschau, null);
		await writeFile(path.join(dir, 'ausgabe', VORSCHAU_DATEI), 'PNG');
		const kennung = (await liste(s)).mappen[0]?.dokumente[0]?.vorschau;
		assert.match(kennung ?? '', /^[0-9a-z]+$/);
		const eintrag = await json<Liste['mappen'][number]>(await s.holen(`${s.url}/api/mappen/${mappe}`));
		assert.deepEqual(
			eintrag.dokumente.map((d) => [d.id, d.vorschau]),
			[[dok, kennung]],
		);
		const bild = await s.holen(`${s.url}/ansicht/${mappe}/dokumente/${dok}/ausgabe/${VORSCHAU_DATEI}?v=${kennung}`);
		assert.equal(bild.status, 200);
		assert.equal(await bild.text(), 'PNG');
	});

	it('dupliziert eine Mappe; unbekannte Mappen 404, ohne CSRF-Kopf 403', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		const antwort = await sende(s, `/api/mappen/${mappe}/duplizieren`);
		assert.equal(antwort.status, 201);
		const { mappe: kopie } = await json<{ mappe: Mappe }>(antwort);
		assert.equal(kopie.titel, 'Zehner und Einer (Kopie)');
		assert.notEqual(kopie.id, mappe);
		assert.deepEqual(kopie.dokumente, [dok]);
		assert.equal((await liste(s)).mappen.length, 2);
		assert.equal((await s.holen(`${s.url}/ansicht/${kopie.id}/dokumente/${dok}/`)).status, 200);

		assert.equal((await sende(s, '/api/mappen/gibt-es-nicht/duplizieren')).status, 404);
		assert.equal((await sende(s, '/api/mappen/gibt-es-nicht/loeschen')).status, 404);
		const ohneKopf = await s.holen(`${s.url}/api/mappen/${mappe}/loeschen`, { method: 'POST' });
		assert.equal(ohneKopf.status, 403);
		assert.equal((await fetch(`${s.url}/api/mappen/${mappe}/loeschen`, { method: 'POST' })).status, 401);
	});

	it('löschen legt in den Papierkorb, wiederherstellen holt zurück; Teilen-Links folgen', async () => {
		s = await starteTestServer({ ueberwachung: true, ruheMs: 200 });
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		const quelle = await readFile(path.join(dir, 'material.html'), 'utf8');
		const { token } = await json<{ token: string }>(
			await s.holen(`${s.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ mappe, dok }),
			}),
		);
		await warte(600);
		strom = sammleEreignisse(s.url, s.cookie);
		await strom.bereit;

		const geloescht = await sende(s, `/api/mappen/${mappe}/loeschen`);
		assert.equal(geloescht.status, 200);
		const { eintrag } = await json<{ eintrag: PapierkorbEintrag }>(geloescht);
		assert.equal(eintrag.id, mappe);
		assert.equal(existsSync(dir), false);
		assert.deepEqual((await liste(s)).mappen, []);
		assert.equal((await s.holen(`${s.url}/api/mappen/${mappe}`)).status, 404);
		assert.equal((await fetch(`${s.url}/f/${token}/api/inhalt`)).status, 410);

		const korb = await json<{ eintraege: PapierkorbEintrag[]; tage: number }>(
			await s.holen(`${s.url}/api/papierkorb`),
		);
		assert.equal(korb.tage, PAPIERKORB_TAGE);
		assert.deepEqual(
			korb.eintraege.map((e) => [e.eintrag, e.mappe?.titel]),
			[[eintrag.eintrag, 'Zehner und Einer']],
		);
		await warte(600);

		const zurueck = await sende(s, `/api/papierkorb/${eintrag.eintrag}/wiederherstellen`);
		assert.equal(zurueck.status, 200);
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), quelle);
		assert.equal((await liste(s)).mappen.length, 1);
		assert.equal((await fetch(`${s.url}/f/${token}/api/inhalt`)).status, 200);
		assert.equal((await sende(s, `/api/papierkorb/${eintrag.eintrag}/wiederherstellen`)).status, 404);
		assert.equal((await sende(s, '/api/papierkorb/..%2f..%2fetc/wiederherstellen')).status, 404);
		await warte(600);

		const typen = strom.ereignisse.filter((e) => e.typ.startsWith('mappe-')).map((e) => [e.typ, e.daten]);
		assert.deepEqual(typen, [
			['mappe-entfernt', { mappe }],
			['mappe-neu', { mappe }],
		]);
	});

	it('nach 30 Tagen ist die Mappe samt ihren Teilen-Links weg (simulierte Zeit)', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const andere = await legeDokumentAn(s.materialDir);
		for (const ziel of [mappe, andere.mappe]) {
			await s.holen(`${s.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ mappe: ziel }),
			});
		}
		const { eintrag } = await json<{ eintrag: PapierkorbEintrag }>(await sende(s, `/api/mappen/${mappe}/loeschen`));
		const geloescht = new Date(eintrag.geloescht).getTime();

		assert.deepEqual(await raeumePapierkorbAuf(s.kontext, new Date(geloescht + 29 * TAG_MS)), []);
		assert.equal((await leseFreigaben(s.materialDir)).length, 2);

		assert.deepEqual(await raeumePapierkorbAuf(s.kontext, new Date(geloescht + PAPIERKORB_TAGE * TAG_MS)), [mappe]);
		const korb = await json<{ eintraege: unknown[] }>(await s.holen(`${s.url}/api/papierkorb`));
		assert.deepEqual(korb.eintraege, []);
		assert.deepEqual(
			(await leseFreigaben(s.materialDir)).map((f) => f.ziel.mappe),
			[andere.mappe],
		);
		assert.equal((await sende(s, `/api/papierkorb/${eintrag.eintrag}/wiederherstellen`)).status, 404);
	});
});
