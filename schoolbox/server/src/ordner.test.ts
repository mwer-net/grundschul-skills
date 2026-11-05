import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { ladeBaum, ORDNER_DATEI } from '@schoolbox/kern';

import { kennung } from './kontext';
import type { TestServer } from './testhilfe';
import {
	fuehreAus,
	legeDokumentAn,
	leseAblage,
	ordnerVon,
	sammleEreignisse,
	schreibKoepfe,
	starteTestServer,
	warte,
} from './testhilfe';

interface Antwort {
	rev: number;
	umkehr: unknown[];
	ergebnis: {
		neu?: string;
		knoten: unknown[];
		umbenannt: { von: string; nach: string }[];
		uebersprungen: number;
		geteilt: string | null;
	};
}

describe('Ablage: Aktionen über /api/ordner (079)', () => {
	let s: TestServer | undefined;
	let strom: ReturnType<typeof sammleEreignisse> | undefined;
	afterEach(async () => {
		strom?.stop();
		await s?.stop();
	});
	const tu = async (server: TestServer, aktion: unknown, status = 200) => {
		const a = await fuehreAus(server, aktion);
		assert.equal(a.status, status, JSON.stringify(aktion));
		return (await a.json()) as Antwort;
	};
	const neu = async (server: TestServer, name: string, eltern: string | null = null) =>
		(await tu(server, { art: 'neu', eltern, name })).ergebnis.neu ?? '';

	it('Erststart: je Mappe ein Ordner; ein zweiter Abgleich schreibt nichts', async () => {
		s = await starteTestServer();
		const a = await legeDokumentAn(s.materialDir);
		const b = await legeDokumentAn(s.materialDir);
		const erste = await leseAblage(s);
		assert.deepEqual(erste.ordner.map((o) => o.behaelter).sort(), [a.mappe, b.mappe].sort());
		assert.equal(erste.dokumente.length, 2);
		const roh = await readFile(path.join(s.materialDir, ORDNER_DATEI), 'utf8');
		const zweite = await leseAblage(s);
		assert.equal(zweite.rev, erste.rev);
		assert.equal(await readFile(path.join(s.materialDir, ORDNER_DATEI), 'utf8'), roh);
	});

	it('anlegen, tief verschachteln, bewegen und die Umkehr ergibt denselben Baum', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		let eltern: string | null = null;
		const kette: string[] = [];
		for (let i = 1; i <= 6; i += 1) {
			eltern = await neu(s, `Ebene ${i}`, eltern);
			kette.push(eltern);
		}
		const vorher = await leseAblage(s);
		const r = await tu(s, { art: 'bewegen', knoten: [{ mappe, dok }], ziel: kette.at(-1) });
		assert.equal((await leseAblage(s)).dokumente[0]?.ordner, kette.at(-1));
		for (const schritt of r.umkehr) {
			await tu(s, schritt);
		}
		const nachher = await leseAblage(s);
		assert.equal(nachher.dokumente[0]?.ordner, vorher.dokumente[0]?.ordner);
		assert.ok(nachher.rev > vorher.rev);
	});

	it('ein Ordner kann nicht in sich selbst; Fehlermeldung statt stiller Änderung', async () => {
		s = await starteTestServer();
		const a = await neu(s, 'A');
		const b = await neu(s, 'B', a);
		const rev = (await leseAblage(s)).rev;
		for (const ziel of [a, b]) {
			const antwort = await fuehreAus(s, { art: 'bewegen', knoten: [{ ordner: a }], ziel });
			assert.equal(antwort.status, 400);
			assert.match(((await antwort.json()) as { fehler: string }).fehler, /nicht in sich selbst/);
		}
		assert.equal((await leseAblage(s)).rev, rev);
	});

	it('bei gleichem Namen bleiben beide: Material heißt danach anders, mit Version', async () => {
		s = await starteTestServer();
		const eins = await legeDokumentAn(s.materialDir);
		const zwei = await legeDokumentAn(s.materialDir);
		const ziel = await ordnerVon(s, zwei.mappe);
		const r = await tu(s, { art: 'bewegen', knoten: [{ mappe: eins.mappe, dok: eins.dok }], ziel });
		assert.equal(r.ergebnis.umbenannt.length, 1);
		const titel = (await leseAblage(s)).dokumente.filter((d) => d.ordner === ziel).map((d) => d.meta.titel);
		assert.equal(new Set(titel).size, 2);
		const versionen = await readdir(path.join(eins.dir, 'versionen'));
		assert.ok(versionen.length >= 1);
	});

	it('Material umbenennen schreibt Titel und Version; ein alter Editor-Stand bekommt 409', async () => {
		s = await starteTestServer();
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
		const adresse = `${s.url}/api/dokumente/${mappe}/${dok}`;
		const offen = (await (await s.holen(adresse)).json()) as { quelle: string; version: string };
		await tu(s, { art: 'umbenennen', knoten: { mappe, dok }, name: 'Neuer Name' });
		const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as { titel: string };
		assert.equal(meta.titel, 'Neuer Name');
		assert.match(await readFile(path.join(dir, 'material.html'), 'utf8'), /<title>Neuer Name<\/title>/);
		const danach = (await (await s.holen(adresse)).json()) as { version: string; quelle: string };
		assert.equal(danach.version, kennung(danach.quelle));
		const alt = await s.holen(adresse, {
			method: 'PUT',
			headers: schreibKoepfe,
			body: JSON.stringify({ quelle: `${offen.quelle}\n`, basisVersion: offen.version }),
		});
		assert.equal(alt.status, 409);
	});

	it('Ordner aus einer Mappe umbenennen schreibt auch mappe.titel', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const ordner = await ordnerVon(s, mappe);
		await tu(s, { art: 'umbenennen', knoten: { ordner }, name: 'Neue Reihe' });
		const daten = JSON.parse(await readFile(path.join(s.materialDir, mappe, 'mappe.json'), 'utf8')) as {
			titel: string;
		};
		assert.equal(daten.titel, 'Neue Reihe');
	});

	it('parallele Aktionen gehen nicht verloren, rev zählt jede', async () => {
		s = await starteTestServer();
		const rev = (await leseAblage(s)).rev;
		const namen = Array.from({ length: 10 }, (_, i) => `Ordner ${i}`);
		await Promise.all(namen.map((n) => neu(s as TestServer, n)));
		const { ordner, rev: danach } = await leseAblage(s);
		assert.deepEqual(ordner.map((o) => o.name).sort(), [...namen].sort());
		assert.equal(danach, rev + 10);
	});

	it('die Variante liegt logisch neben dem Original, nicht im Ordner des Behälters', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		const ziel = await neu(s, 'Klasse 3');
		await tu(s, { art: 'bewegen', knoten: [{ mappe, dok }], ziel });
		const a = await s.holen(`${s.url}/api/mappen/${mappe}/dokumente/${dok}/variante`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: '{}',
		});
		assert.equal(a.status, 201);
		const { id } = (await a.json()) as { id: string };
		assert.equal((await leseAblage(s)).dokumente.find((d) => d.id === id)?.ordner, ziel);
	});

	it('Gelöschtes liefert in allen Routen 404, auch PUT; bewegen überspringt es', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		await tu(s, { art: 'papierkorb', knoten: [{ mappe, dok }] });
		const api = `${s.url}/api/dokumente/${mappe}/${dok}`;
		assert.equal((await s.holen(api)).status, 404);
		assert.equal(
			(
				await s.holen(api, {
					method: 'PUT',
					headers: schreibKoepfe,
					body: JSON.stringify({ quelle: 'x', basisVersion: 'y' }),
				})
			).status,
			404,
		);
		assert.equal(
			(
				await s.holen(`${api}/pdf`, {
					method: 'POST',
					headers: schreibKoepfe,
					body: '{"variante":"arbeitsblatt"}',
				})
			).status,
			404,
		);
		assert.equal((await s.holen(`${s.url}/ansicht/${mappe}/dokumente/${dok}/`)).status, 404);
		const eintrag = (await (await s.holen(`${s.url}/api/mappen/${mappe}`)).json()) as { dokumente: unknown[] };
		assert.deepEqual(eintrag.dokumente, []);
		assert.equal((await fuehreAus(s, { art: 'bewegen', knoten: [{ mappe, dok }], ziel: null })).status, 409);
	});

	it('kaputte Datei: umbenannt, Sicherung geladen, sichtbar gemeldet, Material unberührt', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		const gerettet = await neu(s, 'Bitte behalten');
		await tu(s, { art: 'bewegen', knoten: [{ mappe, dok }], ziel: gerettet });
		await tu(s, { art: 'papierkorb', knoten: [{ ordner: await neu(s, 'Müll') }] }); // löscht: sichert sicher
		await writeFile(path.join(s.materialDir, ORDNER_DATEI), '{ kaputt');
		await warte(20);
		const ablage = await leseAblage(s);
		assert.match(ablage.hinweis ?? '', /aus der Sicherung/);
		assert.ok(ablage.ordner.some((o) => o.name === 'Bitte behalten'));
		assert.equal(ablage.dokumente.length, 1);
		const namen = await readdir(s.materialDir);
		assert.ok(namen.some((n) => n.startsWith('_ordner.defekt-')));
		assert.notEqual(ladeBaum(s.materialDir).baum, null);
	});

	it('Änderungen melden sich mit rev', async () => {
		s = await starteTestServer();
		await leseAblage(s);
		strom = sammleEreignisse(s.url, s.cookie);
		await strom.bereit;
		const r = await tu(s, { art: 'neu', eltern: null, name: 'X' });
		await warte(50);
		assert.ok(
			strom.ereignisse.some((e) => e.typ === 'ordner-geaendert' && (e.daten as { rev: number }).rev === r.rev),
		);
	});

	it('Hineinbewegen in einen geteilten Ordner sagt das', async () => {
		s = await starteTestServer();
		const { dok, mappe } = await legeDokumentAn(s.materialDir);
		const oben = await neu(s, 'Geteilt');
		const unten = await neu(s, 'Darin', oben);
		await s.holen(`${s.url}/api/freigaben`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ ordner: oben }),
		});
		const r = await tu(s, { art: 'bewegen', knoten: [{ mappe, dok }], ziel: unten });
		assert.equal(r.ergebnis.geteilt, 'Geteilt');
	});
});
