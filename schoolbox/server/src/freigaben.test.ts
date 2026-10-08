import assert from 'node:assert/strict';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ASSETS, neuesDokument } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, rohAnfrage, schreibKoepfe, starteTestServer } from './testhilfe';

interface FreigabeAntwort {
	token: string;
	pfad: string;
	url: string | null;
	ziel: { mappe: string; dok: string | null };
	widerrufen: string | null;
}

const WEB_INDEX = '<!doctype html><title>Schoolbox</title>';

describe('Teilen-Links', () => {
	let s: TestServer;
	let mappe: string;
	let dokA: string;
	let dokB: string;
	let andereMappe: string;

	const teile = async (ziel: { mappe: string; dok?: string }) => {
		const antwort = await s.holen(`${s.url}/api/freigaben`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify(ziel),
		});
		assert.equal(antwort.status, 201);
		return (await antwort.json()) as FreigabeAntwort;
	};

	before(async () => {
		s = await starteTestServer({ webDist: true });
		await writeFile(path.join(s.webDist, 'index.html'), WEB_INDEX);
		const a = await legeDokumentAn(s.materialDir, { beispiel: true });
		mappe = a.mappe;
		dokA = a.dok;
		const b = await neuesDokument(s.materialDir, mappe, {
			titel: 'Geheimes Blatt B',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		});
		dokB = b.id;
		await copyFile(path.join(ASSETS, 'bilder', 'wilma.png'), path.join(s.materialDir, mappe, 'bilder', 'm.png'));
		await mkdir(path.join(a.dir, 'versionen'), { recursive: true });
		await writeFile(path.join(a.dir, 'versionen', 'alt.html'), 'ALTER-STAND');
		await writeFile(path.join(a.dir, 'entwuerfe', 'A.html'), 'ENTWURF');
		andereMappe = (await legeDokumentAn(s.materialDir, { jetzt: new Date('2026-01-01T00:00:00Z') })).mappe;
	});
	after(() => s.stop());

	it('legt an und listet, gefiltert nach Mappe und Dokument', async () => {
		const freigabe = await teile({ mappe, dok: dokA });
		assert.match(freigabe.token, /^[\w-]{22}$/);
		assert.equal(freigabe.pfad, `/f/${freigabe.token}`);
		await teile({ mappe });
		const liste = async (query: string) =>
			((await (await s.holen(`${s.url}/api/freigaben?${query}`)).json()) as { freigaben: FreigabeAntwort[] })
				.freigaben;
		assert.equal((await liste(`mappe=${mappe}`)).length, 2);
		assert.equal((await liste(`mappe=${mappe}&dok=${dokA}`)).length, 1);
		assert.equal((await liste(`mappe=${andereMappe}`)).length, 0);
		const fehlt = await s.holen(`${s.url}/api/freigaben`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ mappe, dok: 'gibt-es-nicht' }),
		});
		assert.equal(fehlt.status, 400);
		const ungueltig = await s.holen(`${s.url}/api/freigaben`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ mappe: '../x' }),
		});
		assert.equal(ungueltig.status, 400);
	});

	it('Dokument-Link: Seite, Inhalt und Darstellung von A ohne Anmeldung', async () => {
		const { token } = await teile({ mappe, dok: dokA });
		const f = `${s.url}/f/${token}`;
		const seite = await fetch(f);
		assert.equal(seite.status, 200);
		assert.equal(await seite.text(), WEB_INDEX);
		assert.equal((await fetch(`${f}/praesentation`)).status, 200);
		const inhalt = (await (await fetch(`${f}/api/inhalt`)).json()) as {
			mappe: { dokumente: string[] };
			dokumente: { id: string }[];
		};
		assert.deepEqual(inhalt.mappe.dokumente, [dokA]);
		assert.deepEqual(
			inhalt.dokumente.map((d) => d.id),
			[dokA],
		);
		const basis = `${f}/ansicht/${mappe}/dokumente/${dokA}/`;
		assert.match(await (await fetch(basis)).text(), /Zehner/);
		assert.equal((await fetch(`${basis}blatt.css`)).status, 200);
		assert.equal((await fetch(new URL('../../bilder/m.png', basis))).status, 200);
		assert.equal((await fetch(`${f}/ansicht/_assets/blatt.css`)).status, 200);
		const umleitung = await fetch(basis.slice(0, -1), { redirect: 'manual' });
		assert.equal(umleitung.headers.get('location'), new URL(basis).pathname);
	});

	it('Dokument-Link für A gibt keinen Zugriff auf B, Versionen, Entwürfe oder andere Mappen', async () => {
		const { token } = await teile({ mappe, dok: dokA });
		const a = `/f/${token}/ansicht/${mappe}/dokumente/${dokA}/`;
		const versuche = [
			`/f/${token}/ansicht/${mappe}/dokumente/${dokB}/`,
			`/f/${token}/ansicht/${mappe}/dokumente/${dokB}/material.html`,
			`/f/${token}/ansicht/${mappe}/dokumente/${dokB}`,
			`${a}../${dokB}/`,
			`${a}..%2f${dokB}%2fmaterial.html`,
			`/f/${token}/ansicht/${mappe}/dokumente/${dokA}%2f..%2f${dokB}/`,
			`/f/${token}/ansicht/${mappe}/dokumente//${dokB}/`,
			`${a}versionen/alt.html`,
			`${a}entwuerfe/A.html`,
			`${a}meta.json`,
			`/f/${token}/ansicht/${mappe}/mappe.json`,
			`/f/${token}/ansicht/${andereMappe}/dokumente/blatt/`,
			`/f/${token}/ansicht/_assets/../${mappe}/mappe.json`,
			`/f/${token}/api/mappen`,
			`/f/${token}/api/dokumente/${mappe}/${dokB}`,
			`/f/${token}/api/ereignisse`,
			`/f/${token}/../../api/mappen`,
		];
		for (const versuch of versuche) {
			const { status, text } = await rohAnfrage(s.url, versuch);
			const nurOberflaeche = status === 200 && text === WEB_INDEX;
			assert.ok(nurOberflaeche || [400, 404].includes(status), `${versuch} → ${status}`);
			assert.doesNotMatch(text, /Geheimes Blatt B|ALTER-STAND|ENTWURF|"titel"|dokumente/, versuch);
		}
	});

	it('Mappen-Link zeigt alle Dokumente der Mappe, aber keine andere Mappe', async () => {
		const { token } = await teile({ mappe });
		const f = `${s.url}/f/${token}`;
		const inhalt = (await (await fetch(`${f}/api/inhalt`)).json()) as { dokumente: { id: string }[] };
		assert.deepEqual(
			inhalt.dokumente.map((d) => d.id),
			[dokA, dokB],
		);
		assert.equal((await fetch(`${f}/ansicht/${mappe}/dokumente/${dokB}/`)).status, 200);
		assert.equal((await fetch(`${f}/ansicht/${andereMappe}/dokumente/blatt/`)).status, 404);
	});

	it('schreiben geht über Teilen-Links nie', async () => {
		const { token } = await teile({ mappe });
		for (const [methode, pfad] of [
			['PUT', `/api/dokumente/${mappe}/${dokA}`],
			['POST', '/api/freigaben'],
			['POST', `/api/freigaben/${token}/widerrufen`],
			['DELETE', '/'],
		] as const) {
			const antwort = await fetch(`${s.url}/f/${token}${pfad}`, {
				method: methode,
				headers: schreibKoepfe,
				body: '{}',
			});
			assert.equal(antwort.status, 403, `${methode} ${pfad}`);
		}
	});

	it('widerrufen: Seite 410, API und Darstellung 410, unbekannte Links 404', async () => {
		const { token } = await teile({ mappe, dok: dokA });
		const widerruf = await s.holen(`${s.url}/api/freigaben/${token}/widerrufen`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: '{}',
		});
		assert.equal(((await widerruf.json()) as FreigabeAntwort).widerrufen !== null, true);
		const f = `${s.url}/f/${token}`;
		const seite = await fetch(f);
		assert.equal(seite.status, 410);
		assert.equal(await seite.text(), WEB_INDEX, 'die Oberfläche zeigt „Dieser Link gilt nicht mehr“');
		const api = await fetch(`${f}/api/inhalt`);
		assert.equal(api.status, 410);
		assert.deepEqual(await api.json(), { fehler: 'Dieser Link gilt nicht mehr.' });
		assert.equal((await fetch(`${f}/ansicht/${mappe}/dokumente/${dokA}/`)).status, 410);
		assert.equal((await fetch(`${s.url}/f/AAAAAAAAAAAAAAAAAAAAAA`)).status, 404);
		assert.equal((await fetch(`${s.url}/f/kurz/api/inhalt`)).status, 404);
		const unbekannt = await s.holen(`${s.url}/api/freigaben/AAAAAAAAAAAAAAAAAAAAAA/widerrufen`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: '{}',
		});
		assert.equal(unbekannt.status, 404);
	});

	it('Links auf gelöschte Dokumente gelten nicht mehr', async () => {
		const { token } = await teile({ mappe, dok: dokB });
		await rm(path.join(s.materialDir, mappe, 'dokumente', dokB), { recursive: true });
		assert.equal((await fetch(`${s.url}/f/${token}/api/inhalt`)).status, 410);
	});
});
