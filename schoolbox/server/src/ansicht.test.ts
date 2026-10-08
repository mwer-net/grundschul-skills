import assert from 'node:assert/strict';
import { copyFile, mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ASSETS } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, rohAnfrage, starteTestServer } from './testhilfe';

describe('/ansicht', () => {
	let s: TestServer;
	let mappe: string;
	let basis: string;

	before(async () => {
		s = await starteTestServer();
		const angelegt = await legeDokumentAn(s.materialDir, { beispiel: true });
		mappe = angelegt.mappe;
		basis = `${s.url}/ansicht/${mappe}/dokumente/${angelegt.dok}/`;
		const mappeDir = path.join(s.materialDir, mappe);
		await copyFile(path.join(ASSETS, 'bilder', 'wilma.png'), path.join(mappeDir, 'bilder', 'gemeinsam.png'));
		await writeFile(path.join(angelegt.dir, 'eigen.css'), 'body{background:url(bilder/eigen.png)}');
		await copyFile(path.join(ASSETS, 'bilder', 'willi.png'), path.join(angelegt.dir, 'bilder', 'eigen.png'));
		await mkdir(path.join(angelegt.dir, 'fonts'));
		await writeFile(path.join(angelegt.dir, 'fonts', 'Andika-Regular.woff2'), 'falsche Schrift');
		await writeFile(path.join(s.materialDir, 'geheim.txt'), 'GEHEIMER-INHALT');
		await symlink(path.join(s.materialDir, 'geheim.txt'), path.join(angelegt.dir, 'bilder', 'link.png'));
		await symlink('/etc/passwd', path.join(angelegt.dir, 'passwd.png'));
		await mkdir(path.join(s.materialDir, 'zweite'));
	});
	after(() => s.stop());

	it('leitet ohne Schrägstrich am Ende um, damit relative Pfade stimmen', async () => {
		const antwort = await fetch(`${basis.slice(0, -1)}?loesung=1`, { redirect: 'manual' });
		assert.equal(antwort.status, 301);
		assert.equal(antwort.headers.get('location'), `${new URL(basis).pathname}?loesung=1`);
	});

	it('liefert material.html unverändert, mit ?loesung=1 mit body.loesung', async () => {
		const html = await (await fetch(basis)).text();
		assert.match(html, /<body class="kl2 sw" style/);
		const loesung = await (await fetch(`${basis}?loesung=1`)).text();
		assert.match(loesung, /<body class="kl2 sw loesung" style/);
	});

	it('findet Ressourcen wie blatt.py: erst im Dokumentordner, dann in assets/', async () => {
		const css = await fetch(`${basis}blatt.css`);
		assert.equal(css.status, 200);
		assert.match(css.headers.get('content-type') ?? '', /text\/css/);
		const bild = await fetch(`${basis}bilder/willi-strich.png`);
		assert.equal(bild.status, 200);
		assert.equal(bild.headers.get('content-type'), 'image/png');
		assert.equal((await fetch(`${basis}bilder/eigen.png`)).status, 200);
		assert.equal((await fetch(`${basis}abbildungen.js`)).status, 200);
		assert.equal((await fetch(`${basis}gibt-es-nicht.png`)).status, 404);
	});

	it('trifft Mappenbilder über ../../bilder/', async () => {
		const antwort = await fetch(new URL('../../bilder/gemeinsam.png', basis));
		assert.equal(antwort.status, 200);
		assert.equal(antwort.headers.get('content-type'), 'image/png');
	});

	it('löst url() in CSS relativ zum Ordner der CSS-Datei auf', async () => {
		const css = await (await fetch(`${basis}blatt.css`)).text();
		const schrift = /url\("([^"]*Andika-Regular\.woff2)"\)/.exec(css)?.[1];
		assert.equal(schrift, '../../../_assets/fonts/Andika-Regular.woff2');
		const antwort = await fetch(new URL(schrift, `${basis}blatt.css`));
		assert.equal(antwort.status, 200);
		assert.equal(antwort.headers.get('content-type'), 'font/woff2');
		const eigen = await (await fetch(`${basis}eigen.css`)).text();
		assert.equal(eigen, 'body{background:url("bilder/eigen.png")}');
	});

	it('setzt @page für Formate außer A4 hoch wie blatt.py', async () => {
		const quer = await legeDokumentAn(s.materialDir, { format: 'a4-quer' });
		const html = await (await fetch(`${s.url}/ansicht/${quer.mappe}/dokumente/${quer.dok}/`)).text();
		assert.match(html, /<style>@page\{size:A4 landscape;margin:0\}<\/style>\n<\/head>/);
		assert.doesNotMatch(await (await fetch(basis)).text(), /@page/);
	});

	it('wehrt Traversal ab: ..%2f, %2e%2e, rohe .., absolute Pfade, Symlinks hinaus', async () => {
		const pfad = new URL(basis).pathname;
		const versuche = [
			`${pfad}..%2f..%2f..%2fgeheim.txt`,
			`${pfad}%2e%2e/%2e%2e/%2e%2e/geheim.txt`,
			`${pfad}../../../geheim.txt`,
			`/ansicht/${mappe}/../geheim.txt`,
			'/ansicht/..%2fgeheim.txt/x',
			`${pfad}%2fetc%2fpasswd`,
			`${pfad}/etc/passwd`,
			'/ansicht/_assets/..%2f..%2f..%2f..%2f..%2fetc%2fpasswd',
			'/ansicht/_assets/../../etc/passwd',
			`${pfad}bilder/link.png`,
			`${pfad}passwd.png`,
			'/ansicht/zweite/x',
			`${pfad}.material.html.1.a.tmp`,
		];
		for (const versuch of versuche) {
			const { status, text } = await rohAnfrage(s.url, versuch);
			assert.ok([400, 404].includes(status), `${versuch} → ${status}`);
			assert.doesNotMatch(text, /GEHEIMER-INHALT|root:/, versuch);
		}
	});
});
