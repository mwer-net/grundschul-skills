import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { ART_FORMATE, ARTEN } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { fuehreAus, legeDokumentAn, leseAblage, ordnerVon, schreibKoepfe, starteTestServer } from './testhilfe';

interface Neu {
	mappe: string;
	id: string;
}

describe('Anlegen ohne Claude (045, 079) und Katalog (044)', () => {
	let s: TestServer | undefined;
	afterEach(async () => {
		await s?.stop();
	});
	const lege = (server: TestServer, daten: unknown) =>
		server.holen(`${server.url}/api/ordner/material`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify(daten),
		});
	const gut = { titel: 'Neues Blatt', art: 'arbeitsblatt', format: 'a4-hoch' };
	const neuerOrdner = async (server: TestServer, name: string, eltern: string | null = null) => {
		const a = await fuehreAus(server, { art: 'neu', eltern, name });
		assert.equal(a.status, 200);
		return ((await a.json()) as { ergebnis: { neu: string } }).ergebnis.neu;
	};

	it('Ordner mit Behälter: Das Material kommt in diesen Behälter, Fach und Klasse daraus', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const ordner = await ordnerVon(s, mappe);
		const a = await lege(s, { ...gut, ordner });
		assert.equal(a.status, 201);
		const neu = (await a.json()) as Neu;
		assert.equal(neu.mappe, mappe);
		const eintrag = (await leseAblage(s)).dokumente.find((d) => d.id === neu.id);
		assert.equal(eintrag?.ordner, ordner);
	});

	it('Ordner ohne Behälter: eigener neuer Behälter, Fach und Klasse sind Pflicht', async () => {
		s = await starteTestServer();
		const ordner = await neuerOrdner(s, 'Klasse 3');
		const vorher = await readdir(s.materialDir);
		const ohne = await lege(s, { ...gut, ordner });
		assert.equal(ohne.status, 400);
		assert.match(((await ohne.json()) as { fehler: string }).fehler, /Fach und Klasse/);
		assert.deepEqual(
			(await readdir(s.materialDir)).filter((n) => !n.startsWith('_')),
			vorher.filter((n) => !n.startsWith('_')),
		);

		const a = await lege(s, { ...gut, ordner, fach: 'mathematik', klasse: 3 });
		assert.equal(a.status, 201);
		const neu = (await a.json()) as Neu;
		const { dokumente, ordner: alle } = await leseAblage(s);
		assert.equal(dokumente.find((d) => d.id === neu.id)?.ordner, ordner);
		assert.equal(alle.length, 1, 'der neue Behälter macht keinen sichtbaren Ordner');
	});

	it('Ohne Ordner: direkt in „Mein Material“', async () => {
		s = await starteTestServer();
		const a = await lege(s, { ...gut, ordner: null, fach: 'deutsch', klasse: 1 });
		assert.equal(a.status, 201);
		assert.equal((await leseAblage(s)).dokumente[0]?.ordner, null);
	});

	it('jede Art mit jedem Format; erste Version von der Lehrkraft', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const ordner = await ordnerVon(s, mappe);
		for (const art of ARTEN) {
			for (const format of ART_FORMATE[art]) {
				const a = await lege(s, { titel: `${art} ${format}`, art, format, ordner });
				assert.equal(a.status, 201, `${art} ${format}`);
				const dok = ((await a.json()) as Neu).id;
				const dir = path.join(s.materialDir, mappe, 'dokumente', dok);
				assert.ok((await readdir(path.join(dir, 'versionen'))).every((v) => v.includes('lehrkraft')));
				assert.match(await readFile(path.join(dir, 'material.html'), 'utf8'), /class="seite"/);
			}
		}
	});

	it('falsches Format, unbekannte Vorlage, leerer Titel und doppelter Titel je Ordner werden abgelehnt', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const ordner = await ordnerVon(s, mappe);
		const hier = { ...gut, ordner };
		assert.equal((await lege(s, hier)).status, 201);
		assert.equal((await lege(s, { ...hier, titel: ' NEUES BLATT ' })).status, 409);
		assert.equal((await lege(s, { ...hier, titel: ' ' })).status, 400);
		assert.equal((await lege(s, { ...hier, titel: 'B', format: 'folie' })).status, 400);
		assert.equal((await lege(s, { ...hier, titel: 'C', vorlage: '../x' })).status, 400);
		assert.equal((await lege(s, { ...hier, ordner: 'o-gibtesnicht' })).status, 404);
		assert.equal(existsSync(path.join(s.materialDir, mappe, 'dokumente', 'b')), false);
		const anderer = await neuerOrdner(s, 'Anderer');
		assert.equal(
			(await lege(s, { ...gut, ordner: anderer, fach: 'mathematik', klasse: 2 })).status,
			201,
			'gleicher Titel, anderer Ordner',
		);
	});

	it('Zusatzbausteine landen im Material', async () => {
		s = await starteTestServer();
		const { mappe } = await legeDokumentAn(s.materialDir);
		const a = await lege(s, {
			titel: 'Mit allem',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			ordner: await ordnerVon(s, mappe),
			zusatz: { selbsteinschaetzung: true, niveaus: true, sternchen: true },
		});
		const dok = ((await a.json()) as Neu).id;
		const html = await readFile(path.join(s.materialDir, mappe, 'dokumente', dok, 'material.html'), 'utf8');
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

	it('Vorschau in der Schublade: Aufgabenpaket mit Hülle, Nummer 1 und Anweisung; ein Maßstab (168)', async () => {
		s = await starteTestServer();
		const { eintraege } = (await (await s.holen(`${s.url}/api/katalog`)).json()) as {
			eintraege: { id: string; herkunft: string; anweisung?: string }[];
		};
		const paket = eintraege.find((e) => e.herkunft === 'paket');
		assert.ok(paket?.anweisung, 'kein Aufgabenpaket im Katalog');
		const mit = await (await s.holen(`${s.url}/ansicht/_katalog/${paket.id}?fit=1`)).text();
		assert.match(mit, /class="aufgabe"/);
		assert.ok(mit.includes('<span class="nr">1</span>'));
		assert.ok(mit.includes(`<span class="text">${paket.anweisung}</span>`));
		// Ein Maßstab wie ein Blatt von 200 px, die Streckung schmaler Einträge ist weg (147).
		assert.ok(mit.includes('min-width:200px'));
		assert.ok(!mit.includes('m.b < 120'));
		// Gegenprobe: Ohne `fit` zeigt die Vorschau das Paket ohne Hülle, wie bisher.
		const ohne = await (await s.holen(`${s.url}/ansicht/_katalog/${paket.id}`)).text();
		assert.doesNotMatch(ohne, /class="aufgabe"/);
	});
});
