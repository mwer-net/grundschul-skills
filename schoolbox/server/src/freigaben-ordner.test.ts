import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { ASSETS, FREIGABEN_SCHEMA, neueMappe, pruefeSchema } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import {
	baueErsatzAusgabe,
	fuehreAus,
	legeDokumentAn,
	leseAblage,
	ordnerVon,
	schreibKoepfe,
	starteTestServer,
} from './testhilfe';

interface Inhalt {
	ordner: { id: string; name: string; eltern: string | null }[];
	dokumente: { mappe: string; id: string }[];
}

/** Sicherheitsprüfung „Teilen“ aus Ticket 079. Jede Prüfung im Wächter hat hier einen Fall, der ohne sie rot wird. */
describe('Teilen: Ordner-Links', () => {
	let s: TestServer | undefined;
	afterEach(async () => {
		await s?.stop();
	});
	const lauf = async () => {
		const server = await starteTestServer({ pdfBauer: baueErsatzAusgabe });
		s = server;
		const neu = async (name: string, eltern: string | null = null) => {
			const a = await fuehreAus(server, { art: 'neu', eltern, name });
			assert.equal(a.status, 200);
			return ((await a.json()) as { ergebnis: { neu: string } }).ergebnis.neu;
		};
		const teile = async (ziel: object) => {
			const a = await server.holen(`${server.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify(ziel),
			});
			assert.equal(a.status, 201);
			return `${server.url}/f/${((await a.json()) as { token: string }).token}`;
		};
		const inhalt = async (f: string) => (await (await fetch(`${f}/api/inhalt`)).json()) as Inhalt;
		const bewege = async (knoten: object[], ziel: string | null) =>
			assert.equal((await fuehreAus(server, { art: 'bewegen', knoten, ziel })).status, 200);
		return { server, neu, teile, inhalt, bewege };
	};

	it('zeigt Unterordner und ihr Material, nur was jetzt darin liegt', async () => {
		const { bewege, inhalt, neu, server, teile } = await lauf();
		const { dok, mappe } = await legeDokumentAn(server.materialDir);
		const oben = await neu('Geteilt');
		const unten = await neu('Darin', oben);
		const f = await teile({ ordner: oben });
		assert.deepEqual((await inhalt(f)).dokumente, []);
		const ansicht = `${f}/ansicht/${mappe}/dokumente/${dok}/`;
		assert.equal((await fetch(ansicht)).status, 404, 'noch nicht drin');

		await bewege([{ mappe, dok }], unten);
		const danach = await inhalt(f);
		assert.deepEqual(
			danach.ordner.map((o) => o.name),
			['Darin'],
		);
		assert.deepEqual(
			danach.dokumente.map((d) => [d.mappe, d.id]),
			[[mappe, dok]],
		);
		assert.equal((await fetch(ansicht)).status, 200, 'hineinbewegt sichtbar');
		assert.equal((await fetch(`${f}/api/pdf/${mappe}~${dok}/arbeitsblatt`)).status, 200);

		await bewege([{ mappe, dok }], null);
		assert.deepEqual((await inhalt(f)).dokumente, [], 'herausbewegt nicht mehr gelistet');
		assert.equal((await fetch(ansicht)).status, 404, 'herausbewegt: Ansicht 404');
		assert.equal((await fetch(`${f}/ansicht/${mappe}/bilder/x.png`)).status, 404, 'herausbewegt: Bilder 404');
		assert.equal((await fetch(`${f}/api/pdf/${mappe}~${dok}/arbeitsblatt`)).status, 404, 'herausbewegt: PDF 404');
		assert.equal((await fetch(`${f}/pdf/${mappe}~${dok}/arbeitsblatt/x.pdf`)).status, 404);
	});

	it('im Papierkorb ist der Link tot (410), auch wenn nur ein Vorfahr gelöscht ist', async () => {
		const { inhalt, neu, server, teile } = await lauf();
		const oben = await neu('Oben');
		const unten = await neu('Unten', oben);
		const f = await teile({ ordner: unten });
		assert.deepEqual((await inhalt(f)).dokumente, []);
		await fuehreAus(server, { art: 'papierkorb', knoten: [{ ordner: oben }] });
		assert.equal((await fetch(`${f}/api/inhalt`)).status, 410);
		assert.equal((await fetch(f)).status, 410);
	});

	it('Dokument-Link: im Papierkorb 410, zurückgelegt wieder gültig', async () => {
		const { server, teile } = await lauf();
		const { dok, mappe } = await legeDokumentAn(server.materialDir);
		const f = await teile({ mappe, dok });
		const a = await fuehreAus(server, { art: 'papierkorb', knoten: [{ mappe, dok }] });
		assert.equal((await fetch(`${f}/api/inhalt`)).status, 410);
		for (const schritt of ((await a.json()) as { umkehr: unknown[] }).umkehr) {
			await fuehreAus(server, schritt);
		}
		assert.equal((await fetch(`${f}/api/inhalt`)).status, 200);
	});

	it('alter Mappen-Link löst sich in den Ordner auf: zeigt nur, was noch dort liegt', async () => {
		const { bewege, inhalt, server, teile } = await lauf();
		const { dok, mappe } = await legeDokumentAn(server.materialDir);
		const f = await teile({ mappe });
		assert.equal((await inhalt(f)).dokumente.length, 1);
		assert.equal((await fetch(`${f}/api/pdf/${dok}/arbeitsblatt`)).status, 200, 'die alte Adresse gilt weiter');
		await bewege([{ mappe, dok }], null);
		assert.deepEqual((await inhalt(f)).dokumente, []);
		assert.equal((await fetch(`${f}/ansicht/${mappe}/dokumente/${dok}/`)).status, 404);
		assert.equal((await fetch(`${f}/api/pdf/${dok}/arbeitsblatt`)).status, 404);
		const ordner = await ordnerVon(server, mappe);
		await fuehreAus(server, { art: 'papierkorb', knoten: [{ ordner }] });
		assert.equal((await fetch(`${f}/api/inhalt`)).status, 410);
	});

	it('gleiche Dokument-ID in zwei Behältern: nur das Erlaubte, je mit Behälter in der Adresse', async () => {
		const { bewege, neu, server, teile } = await lauf();
		const a = await legeDokumentAn(server.materialDir);
		const b = await legeDokumentAn(server.materialDir);
		assert.equal(a.dok, b.dok, 'Voraussetzung: gleiche ID');
		const ordner = await neu('Geteilt');
		await bewege([{ mappe: a.mappe, dok: a.dok }], ordner);
		const f = await teile({ ordner });
		assert.equal((await fetch(`${f}/api/pdf/${a.mappe}~${a.dok}/arbeitsblatt`)).status, 200);
		assert.equal((await fetch(`${f}/api/pdf/${b.mappe}~${b.dok}/arbeitsblatt`)).status, 404);
		assert.equal((await fetch(`${f}/api/pdf/${a.dok}/arbeitsblatt`)).status, 404, 'ohne Behälter: 404');
		assert.equal((await fetch(`${f}/ansicht/${a.mappe}/dokumente/${a.dok}/`)).status, 200);
		assert.equal((await fetch(`${f}/ansicht/${b.mappe}/dokumente/${b.dok}/`)).status, 404);
	});

	it('Thema-CSS und Bilder nur aus dem Behälter eines erlaubten Dokuments; Internes bleibt 404', async () => {
		const { bewege, neu, server, teile } = await lauf();
		const a = await legeDokumentAn(server.materialDir);
		const b = await legeDokumentAn(server.materialDir);
		for (const { mappe } of [a, b]) {
			const dir = path.join(server.materialDir, mappe);
			await writeFile(path.join(dir, 'detektiv.css'), 'body{}');
			await mkdir(path.join(dir, 'bilder'), { recursive: true });
			await copyFile(path.join(ASSETS, 'blatt.css'), path.join(dir, 'bilder', 'x.css'));
		}
		const ordner = await neu('Geteilt');
		await bewege([{ mappe: a.mappe, dok: a.dok }], ordner);
		const f = await teile({ ordner });
		const ok = `${f}/ansicht/${a.mappe}`;
		const fremd = `${f}/ansicht/${b.mappe}`;
		assert.equal((await fetch(`${ok}/detektiv.css`)).status, 200);
		assert.equal((await fetch(`${ok}/bilder/x.css`)).status, 200);
		assert.equal((await fetch(`${fremd}/detektiv.css`)).status, 404);
		assert.equal((await fetch(`${fremd}/bilder/x.css`)).status, 404);
		for (const pfad of [
			`${ok}/mappe.json`,
			`${ok}/dokumente/${a.dok}/meta.json`,
			`${ok}/dokumente/${a.dok}/versionen/alt.html`,
			`${ok}/dokumente/${a.dok}/entwuerfe/A.html`,
			`${ok}/dokumente/${a.dok}/?entwurf=A`,
			`${ok}/dokumente/${a.dok}/?vorschlag=1`,
		]) {
			assert.equal((await fetch(pfad)).status, 404, pfad);
		}
	});

	it('„Alles als PDF“ folgt der Sortierung und zeigt nichts Fremdes; Dokument-Link hat keins', async () => {
		const { bewege, neu, server, teile } = await lauf();
		const a = await legeDokumentAn(server.materialDir, { beispiel: true });
		const ordner = await neu('Geteilt');
		await bewege([{ mappe: a.mappe, dok: a.dok }], ordner);
		const f = await teile({ ordner });
		const alles = await fetch(`${f}/api/alles/alles`);
		assert.equal(alles.status, 200);
		const { adresse, dateiname } = (await alles.json()) as { adresse: string; dateiname: string };
		assert.match(dateiname, /Geteilt/);
		assert.equal((await fetch(`${server.url}${adresse}`)).status, 200);
		const dokLink = await teile({ mappe: a.mappe, dok: a.dok });
		assert.equal((await fetch(`${dokLink}/api/alles/alles`)).status, 404);
	});

	it('schreiben über einen Ordner-Link: 403', async () => {
		const { neu, teile } = await lauf();
		const f = await teile({ ordner: await neu('Geteilt') });
		for (const pfad of ['/api/ordner/aktion', '/api/freigaben', '/api/ordner/material']) {
			const antwort = await fetch(`${f}${pfad}`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
			assert.equal(antwort.status, 403, pfad);
		}
	});

	it('mit Ordner-Link besteht _freigaben.json das alte Schema: Der Rückweg verliert keine Links', async () => {
		const { neu, server, teile } = await lauf();
		const { mappe } = await legeDokumentAn(server.materialDir);
		await teile({ mappe });
		await teile({ ordner: await neu('Geteilt') });
		const roh = JSON.parse(await readFile(path.join(server.materialDir, '_freigaben.json'), 'utf8')) as {
			freigaben: unknown[];
			ordnerFreigaben: unknown[];
		};
		assert.equal(roh.ordnerFreigaben.length, 1);
		assert.equal(roh.freigaben.length, 1);
		assert.deepEqual(pruefeSchema(FREIGABEN_SCHEMA, roh), []);
	});

	it('die Ablage nennt, was geteilt ist', async () => {
		const { neu, server, teile } = await lauf();
		const { dok, mappe } = await legeDokumentAn(server.materialDir);
		const ordner = await neu('Geteilt');
		await teile({ ordner });
		await teile({ mappe, dok });
		const { geteilt } = await leseAblage(server);
		assert.deepEqual(geteilt.ordner, [ordner]);
		assert.deepEqual(geteilt.dokumente, [`${mappe}/${dok}`]);
	});

	it('eine Mappe im Behälter ohne Ordner kann den Wächter nicht aushebeln', async () => {
		const { neu, server, teile } = await lauf();
		const f = await teile({ ordner: await neu('Leer') });
		const { mappe } = await neueMappe(server.materialDir, { titel: 'Heimlich', fach: 'deutsch', klasse: 1 });
		assert.equal((await fetch(`${f}/ansicht/${mappe}/mappe.json`)).status, 404);
	});
});
