import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { erzeugePasswortHash, ladeKonfig } from '@schoolbox/kern';

import { pruefeServerKonfig } from './konfig';
import { DAUER, pruefeSitzung } from './sitzung';
import type { TestServer } from './testhilfe';
import { schreibKoepfe, sitzungsCookie, starteTestServer, TEST_PASSWORT } from './testhilfe';

const WEB_INDEX = '<!doctype html><title>Schoolbox</title><div id="root"></div>';

describe('Anmeldung', () => {
	let s: TestServer;
	const anmelden = (body: unknown, ip = '203.0.113.1') =>
		fetch(`${s.url}/api/anmelden`, {
			method: 'POST',
			headers: { ...schreibKoepfe, 'X-Forwarded-For': ip },
			body: JSON.stringify(body),
		});
	const cookieAus = (antwort: Response) => antwort.headers.get('set-cookie') ?? '';

	before(async () => {
		s = await starteTestServer({ webDist: true });
		await mkdir(path.join(s.webDist, 'assets'), { recursive: true });
		await writeFile(path.join(s.webDist, 'index.html'), WEB_INDEX);
		await writeFile(path.join(s.webDist, 'assets', 'app.js'), 'console.log(1)');
	});
	after(() => s.stop());

	it('ohne Anmeldung: API 401, Seiten und Darstellung leiten zur Anmeldung', async () => {
		for (const pfad of ['/api/mappen', '/api/ereignisse', '/api/freigaben', '/api/dokumente/a/b']) {
			const antwort = await fetch(`${s.url}${pfad}`);
			assert.equal(antwort.status, 401, pfad);
			assert.deepEqual(await antwort.json(), { fehler: 'Bitte melde dich an.' });
		}
		const put = await fetch(`${s.url}/api/dokumente/a/b`, { method: 'PUT', headers: schreibKoepfe, body: '{}' });
		assert.equal(put.status, 401);
		for (const pfad of ['/', '/m/mappe', '/ansicht/m/dokumente/d/', '/index.html.bak']) {
			const antwort = await fetch(`${s.url}${pfad}`, { redirect: 'manual' });
			assert.equal(antwort.status, 302, pfad);
			assert.equal(antwort.headers.get('location'), `/anmelden?weiter=${encodeURIComponent(pfad)}`);
		}
	});

	it('frei: Anmeldeseite, Oberflächen-Dateien, /healthz, /robots.txt, Sitzungsstatus', async () => {
		assert.equal(await (await fetch(`${s.url}/anmelden`)).text(), WEB_INDEX);
		assert.equal((await fetch(`${s.url}/assets/app.js`)).status, 200);
		assert.equal((await fetch(`${s.url}/healthz`)).status, 200);
		const robots = await fetch(`${s.url}/robots.txt`);
		assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');
		assert.equal(robots.headers.get('x-robots-tag'), 'noindex, nofollow');
		assert.deepEqual(await (await fetch(`${s.url}/api/sitzung`)).json(), { angemeldet: false });
		assert.deepEqual(await (await s.holen(`${s.url}/api/sitzung`)).json(), { angemeldet: true });
	});

	it('meldet an: angemeldet bleiben mit Max-Age 1 Jahr, sonst Sitzungs-Cookie', async () => {
		const dauerhaft = await anmelden({ passwort: TEST_PASSWORT, angemeldetBleiben: true });
		assert.equal(dauerhaft.status, 200);
		const cookie = cookieAus(dauerhaft);
		assert.match(cookie, /^schoolbox_sitzung=v1\.[0-9a-z]+\.d\./);
		assert.match(cookie, new RegExp(`Max-Age=${DAUER.dauerhaft.gueltig / 1000}`));
		assert.match(cookie, /HttpOnly/);
		assert.match(cookie, /SameSite=Lax/);
		assert.doesNotMatch(cookie, /Secure/, 'http ohne https-SCHOOLBOX_URL');
		const mitCookie = await fetch(`${s.url}/api/mappen`, { headers: { cookie: cookie.split(';')[0] ?? '' } });
		assert.equal(mitCookie.status, 200);

		const kurz = cookieAus(await anmelden({ passwort: TEST_PASSWORT, angemeldetBleiben: false }));
		assert.match(kurz, /^schoolbox_sitzung=v1\.[0-9a-z]+\.s\./);
		assert.doesNotMatch(kurz, /Max-Age|Expires/);
	});

	it('Secure hinter Apache (X-Forwarded-Proto: https)', async () => {
		const antwort = await fetch(`${s.url}/api/anmelden`, {
			method: 'POST',
			headers: { ...schreibKoepfe, 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '203.0.113.2' },
			body: JSON.stringify({ passwort: TEST_PASSWORT }),
		});
		assert.match(cookieAus(antwort), /Secure/);
	});

	it('falsches Passwort: 401 mit freundlicher Meldung; ohne CSRF-Kopf 403', async () => {
		const falsch = await anmelden({ passwort: 'falsch' }, '203.0.113.3');
		assert.equal(falsch.status, 401);
		assert.deepEqual(await falsch.json(), { fehler: 'Das Passwort stimmt noch nicht.' });
		assert.equal(falsch.headers.get('set-cookie'), null);
		const formular = await fetch(`${s.url}/api/anmelden`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: `passwort=${TEST_PASSWORT}`,
		});
		assert.equal(formular.status, 403);
		assert.equal((await anmelden({}, '203.0.113.3')).status, 400);
	});

	it('Bremse: nach 5 Fehlversuchen 429, auch mit richtigem Passwort; andere Adresse geht', async () => {
		const ip = '198.51.100.9';
		for (let i = 0; i < 5; i += 1) {
			assert.equal((await anmelden({ passwort: `falsch-${i}` }, ip)).status, 401);
		}
		const gebremst = await anmelden({ passwort: TEST_PASSWORT }, ip);
		assert.equal(gebremst.status, 429);
		assert.equal(gebremst.headers.get('retry-after'), '900');
		assert.match(((await gebremst.json()) as { fehler: string }).fehler, /in 15 Minuten noch einmal/);
		assert.equal((await anmelden({ passwort: TEST_PASSWORT }, '198.51.100.10')).status, 200);
	});

	it('Bremse: parallele Versuche überholen die Grenze nicht', async () => {
		const status = await Promise.all(
			Array.from({ length: 12 }, (_, i) => anmelden({ passwort: `falsch-${i}` }, '198.51.100.20')),
		).then((antworten) => antworten.map((a) => a.status));
		assert.equal(status.filter((x) => x === 401).length, 5);
		assert.equal(status.filter((x) => x === 429).length, 7);
	});

	it('abgelaufene, fremde und manipulierte Cookies gelten nicht; Abmelden löscht das Cookie', async () => {
		const { konfig } = s.kontext;
		const alt = sitzungsCookie(konfig, { ausgestellt: Date.now() - DAUER.sitzung.gueltig - 1, dauerhaft: false });
		const fremd = sitzungsCookie({ ...konfig, sitzungGeheimnis: 'x'.repeat(64) });
		for (const cookie of [alt, fremd, `${s.cookie}x`]) {
			assert.equal((await fetch(`${s.url}/api/mappen`, { headers: { cookie } })).status, 401);
		}
		const ab = await s.holen(`${s.url}/api/abmelden`, { method: 'POST', headers: schreibKoepfe, body: '{}' });
		assert.match(cookieAus(ab), /^schoolbox_sitzung=;.*Expires=Thu, 01 Jan 1970/);
	});

	it('stellt eine genutzte Sitzung nach einem Tag neu aus', async () => {
		const gestern = sitzungsCookie(s.kontext.konfig, { ausgestellt: Date.now() - DAUER.dauerhaft.erneuern - 1000 });
		const antwort = await fetch(`${s.url}/api/mappen`, { headers: { cookie: gestern } });
		assert.equal(antwort.status, 200);
		assert.match(cookieAus(antwort), /^schoolbox_sitzung=v1\..*Max-Age=31536000/);
		const frisch = await s.holen(`${s.url}/api/mappen`);
		assert.equal(frisch.headers.get('set-cookie'), null);
	});

	it('ein neues Passwort macht alte Sitzungen ungültig', async () => {
		const neu = pruefeServerKonfig(
			ladeKonfig(
				{
					MATERIAL_DIR: s.materialDir,
					PASSWORT_HASH: await erzeugePasswortHash('ganz-anderes-passwort', 10),
					SITZUNG_GEHEIMNIS: s.kontext.konfig.sitzungGeheimnis,
				},
				s.materialDir,
			),
		);
		const alterCookie = s.cookie.split('=')[1] ?? '';
		assert.ok(pruefeSitzung(s.kontext.konfig, alterCookie));
		assert.equal(pruefeSitzung(neu, alterCookie), null);
	});

	it('der Server startet nicht ohne Passwort-Hash und Geheimnis', () => {
		assert.throws(
			() => pruefeServerKonfig(ladeKonfig({ MATERIAL_DIR: s.materialDir }, s.materialDir)),
			/PASSWORT_HASH fehlt[\s\S]*SITZUNG_GEHEIMNIS fehlt/,
		);
	});
});
