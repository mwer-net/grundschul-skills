import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ASSETS, figurenDir, neuesDokument, VORSCHAU_DATEI } from '@schoolbox/kern';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, legeTestfigurenAn, rohAnfrage, schreibKoepfe, starteTestServer } from './testhilfe';

const BREITE_PY = 'import io, sys\nfrom PIL import Image\nprint(Image.open(io.BytesIO(sys.stdin.buffer.read())).width)';

/** Breite eines Bildes, mit Pillow gelesen. */
const breiteVon = (daten: Buffer) =>
	Number(execFileSync('python3', ['-c', BREITE_PY], { input: daten, encoding: 'utf8' }));

const bytesVon = async (antwort: Response) => Buffer.from(await antwort.arrayBuffer());

/** WebP, wie `bild.py vorschaubilder` es schreibt: `RIFF`, an 8 `WEBP`. */
const pruefeWebp = async (antwort: Response, adresse: string) => {
	assert.equal(antwort.status, 200, adresse);
	assert.equal(antwort.headers.get('content-type'), 'image/webp', adresse);
	assert.equal(antwort.headers.get('cache-control'), 'no-cache', adresse);
	const daten = await bytesVon(antwort);
	assert.equal(daten.subarray(0, 4).toString('latin1'), 'RIFF', adresse);
	assert.equal(daten.subarray(8, 12).toString('latin1'), 'WEBP', adresse);
	return breiteVon(daten);
};

describe('/ansicht', () => {
	let s: TestServer;
	let mappe: string;
	let basis: string;
	let dokId: string;

	before(async () => {
		s = await starteTestServer();
		const angelegt = await legeDokumentAn(s.materialDir, { beispiel: true });
		mappe = angelegt.mappe;
		dokId = angelegt.dok;
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
		await legeTestfigurenAn(s.materialDir);
		await symlink(path.join(s.materialDir, 'geheim.txt'), path.join(figurenDir(s.materialDir), 'link.png'));
	});
	after(() => s.stop());

	it('Ein Vorschlag kommt mit CSP, das Blatt selbst bleibt, wie es war', async () => {
		const dir = path.join(s.materialDir, mappe, 'dokumente', dokId, 'vorschlag');
		await mkdir(dir, { recursive: true });
		await writeFile(
			path.join(dir, 'material.html'),
			'<!doctype html><html><body class="kl2"><script>1</script></body></html>',
		);
		await writeFile(path.join(dir, 'vorschlag.json'), '{}');
		const vorschlag = await s.holen(`${basis}?vorschlag=1`);
		assert.equal(vorschlag.status, 200);
		const csp = vorschlag.headers.get('content-security-policy') ?? '';
		assert.match(csp, /default-src 'none'/);
		assert.match(csp, /script-src 'self'(;|$)/);
		assert.doesNotMatch(csp, /script-src[^;]*unsafe/);
		assert.equal((await s.holen(basis)).headers.get('content-security-policy'), null);
	});

	// 180: Die Vorschau der Rezepte-Schublade (`?aufmachung=`, `?seite=1`) gibt es nicht mehr.
	it('?aufmachung= und ?seite= ändern die Antwort nicht (180)', async () => {
		const ohne = await (await s.holen(basis)).text();
		assert.equal(await (await s.holen(`${basis}?aufmachung=zirkus&seite=1`)).text(), ohne);
		assert.doesNotMatch(ohne, /data-aufmachung/);
	});

	it('„Auf alle Blätter übernehmen“ gibt es nicht mehr: 404 (180)', async () => {
		const url = `${s.url}/api/dokumente/${mappe}/${dokId}/aufmachung-uebernehmen`;
		assert.equal((await s.holen(url)).status, 404);
		const post = await s.holen(url, { method: 'POST', headers: schreibKoepfe, body: JSON.stringify({}) });
		assert.equal(post.status, 404);
	});

	it('leitet ohne Schrägstrich am Ende um, damit relative Pfade stimmen', async () => {
		const antwort = await s.holen(`${basis.slice(0, -1)}?loesung=1`, { redirect: 'manual' });
		assert.equal(antwort.status, 301);
		assert.equal(antwort.headers.get('location'), `${new URL(basis).pathname}?loesung=1`);
	});

	it('liefert material.html unverändert, mit ?loesung=1 mit body.loesung', async () => {
		const html = await (await s.holen(basis)).text();
		assert.match(html, /<body class="kl2 sw" style/);
		const loesung = await (await s.holen(`${basis}?loesung=1`)).text();
		assert.match(loesung, /<body class="kl2 sw loesung" style/);
	});

	it('fügt die Präsentations-Laufzeit nur mit ?praesentation=1 ein, sonst bleibt die Quelle byte-gleich', async () => {
		const ohne = await (await s.holen(basis)).text();
		assert.doesNotMatch(ohne, /praesentation\.js/);
		const mit = await (await s.holen(`${basis}?praesentation=1`)).text();
		assert.equal(mit, ohne.replace('</body>', '<script src="praesentation.js"></script>\n</body>'));
		const skript = await s.holen(`${basis}praesentation.js`);
		assert.equal(skript.status, 200);
		assert.match(await skript.text(), /window\.praesentation/);
	});

	it('findet Ressourcen wie blatt.py: erst im Dokumentordner, dann in assets/', async () => {
		const css = await s.holen(`${basis}blatt.css`);
		assert.equal(css.status, 200);
		assert.match(css.headers.get('content-type') ?? '', /text\/css/);
		const bild = await s.holen(`${basis}bilder/willi-strich.png`);
		assert.equal(bild.status, 200);
		assert.equal(bild.headers.get('content-type'), 'image/png');
		assert.equal((await s.holen(`${basis}bilder/eigen.png`)).status, 200);
		assert.equal((await s.holen(`${basis}abbildungen.js`)).status, 200);
		assert.equal((await s.holen(`${basis}gibt-es-nicht.png`)).status, 404);
	});

	it('trifft Mappenbilder über ../../bilder/', async () => {
		const antwort = await s.holen(new URL('../../bilder/gemeinsam.png', basis));
		assert.equal(antwort.status, 200);
		assert.equal(antwort.headers.get('content-type'), 'image/png');
	});

	it('löst url() in CSS relativ zum Ordner der CSS-Datei auf', async () => {
		const css = await (await s.holen(`${basis}blatt.css`)).text();
		const schrift = /url\("([^"]*Andika-Regular\.woff2)"\)/.exec(css)?.[1];
		assert.equal(schrift, '../../../_assets/fonts/Andika-Regular.woff2');
		const antwort = await s.holen(new URL(schrift, `${basis}blatt.css`));
		assert.equal(antwort.status, 200);
		assert.equal(antwort.headers.get('content-type'), 'font/woff2');
		const eigen = await (await s.holen(`${basis}eigen.css`)).text();
		assert.equal(eigen, 'body{background:url("bilder/eigen.png")}');
	});

	it('zeigt mit ?entwurf=B den Entwurf unter der Adresse des Dokuments, damit relative Pfade stimmen', async () => {
		const dokDir = path.join(s.materialDir, mappe, 'dokumente', path.basename(basis));
		await writeFile(
			path.join(dokDir, 'entwuerfe', 'B.html'),
			'<html><head><title>B · Zwei</title></head><body class="kl2 sw"><img src="bilder/eigen.png"></body></html>',
		);
		const html = await (await s.holen(`${basis}?entwurf=B&loesung=1`)).text();
		assert.match(html, /<title>B · Zwei<\/title>/);
		assert.match(html, /<body class="kl2 sw loesung"/);
		assert.equal((await s.holen(new URL('bilder/eigen.png', `${basis}?entwurf=B`))).status, 200);
		assert.equal((await s.holen(`${basis}?entwurf=C`)).status, 404);
		assert.equal((await s.holen(`${basis}?entwurf=..%2fmaterial`)).status, 400);
		assert.equal((await s.holen(`${basis}?entwurf=b`)).status, 400);
	});

	it('setzt @page für Formate außer A4 hoch wie blatt.py', async () => {
		const quer = await legeDokumentAn(s.materialDir, { format: 'a4-quer' });
		const html = await (await s.holen(`${s.url}/ansicht/${quer.mappe}/dokumente/${quer.dok}/`)).text();
		assert.match(html, /<style>@page\{size:A4 landscape;margin:0\}<\/style>\n<\/head>/);
		assert.doesNotMatch(await (await s.holen(basis)).text(), /@page/);
	});

	describe('?vorschaubild=1 (178)', () => {
		const dokDir = () => path.join(s.materialDir, mappe, 'dokumente', dokId);

		it('Mappe, assets/ und Dokument: WebP mit 320 px; ohne Parameter das Original', async () => {
			const bilder = [
				[`${basis}../../bilder/gemeinsam.png`, path.join(s.materialDir, mappe, 'bilder', 'gemeinsam.png')],
				[`${s.url}/ansicht/_assets/bilder/wilma.png`, path.join(ASSETS, 'bilder', 'wilma.png')],
				[`${basis}bilder/eigen.png`, path.join(dokDir(), 'bilder', 'eigen.png')],
			] as const;
			for (const [adresse, original] of bilder) {
				const mit = `${adresse}?vorschaubild=1`;
				assert.equal(await pruefeWebp(await s.holen(mit), mit), 320);
				const ohne = await s.holen(adresse);
				assert.equal(ohne.headers.get('content-type'), 'image/png');
				assert.ok((await bytesVon(ohne)).equals(await readFile(original)), adresse);
			}
		});

		it('die Material-Vorschau der Ablage ebenso, mit ihrer Kennung', async () => {
			await copyFile(path.join(ASSETS, 'bilder', 'wachstum.png'), path.join(dokDir(), 'ausgabe', VORSCHAU_DATEI));
			const adresse = `${basis}ausgabe/${VORSCHAU_DATEI}?v=1&vorschaubild=1`;
			assert.equal(await pruefeWebp(await s.holen(adresse), adresse), 320);
		});

		it('gleiche Grenzen: Symlinks hinaus bleiben 404; CSS bleibt umgeschriebenes CSS', async () => {
			for (const pfad of [`${basis}bilder/link.png`, `${basis}passwd.png`]) {
				for (const adresse of [pfad, `${pfad}?vorschaubild=1`]) {
					const antwort = await s.holen(adresse);
					assert.equal(antwort.status, 404, adresse);
					assert.doesNotMatch(await antwort.text(), /GEHEIMER-INHALT|root:/, adresse);
				}
			}
			const css = await s.holen(`${basis}eigen.css?vorschaubild=1`);
			assert.match(css.headers.get('content-type') ?? '', /text\/css/);
			assert.equal(await css.text(), 'body{background:url("bilder/eigen.png")}');
		});

		it('ohne Python kommt das Original, ohne Fehler', async () => {
			const ohne = await starteTestServer({ env: { PYTHON_BIN: 'false' } });
			try {
				const antwort = await ohne.holen(`${ohne.url}/ansicht/_assets/bilder/wilma.png?vorschaubild=1`);
				assert.equal(antwort.status, 200);
				assert.equal(antwort.headers.get('content-type'), 'image/png');
				assert.ok((await bytesVon(antwort)).equals(await readFile(path.join(ASSETS, 'bilder', 'wilma.png'))));
			} finally {
				await ohne.stop();
			}
		});

		it('über einen Teilen-Link nur für das geteilte Dokument', async () => {
			const anderes = await neuesDokument(s.materialDir, mappe, {
				titel: 'Anderes Blatt',
				art: 'arbeitsblatt',
				format: 'a4-hoch',
				druckprofil: 'sw',
				druckhinweise: [],
			});
			for (const dok of [dokId, anderes.id]) {
				await copyFile(
					path.join(ASSETS, 'bilder', 'wachstum.png'),
					path.join(s.materialDir, mappe, 'dokumente', dok, 'ausgabe', VORSCHAU_DATEI),
				);
			}
			const freigabe = await s.holen(`${s.url}/api/freigaben`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ mappe, dok: dokId }),
			});
			assert.equal(freigabe.status, 201);
			const { token } = (await freigabe.json()) as { token: string };
			const f = `${s.url}/f/${token}/ansicht/${mappe}/dokumente`;
			const adresse = `${f}/${dokId}/ausgabe/${VORSCHAU_DATEI}?v=1&vorschaubild=1`;
			assert.equal(await pruefeWebp(await fetch(adresse), adresse), 320);
			// Gegenprobe: dieselbe Datei eines anderen Dokuments, mit und ohne Parameter.
			for (const suche of ['?v=1&vorschaubild=1', '?v=1']) {
				const fremd = `${f}/${anderes.id}/ausgabe/${VORSCHAU_DATEI}${suche}`;
				assert.equal((await fetch(fremd)).status, 404, fremd);
			}
		});
	});

	it('Figurenbibliothek (177): Bilder direkt in _figuren/, auch als Vorschaubild; figuren.json nicht', async () => {
		const adresse = `${s.url}/ansicht/_figuren/kiki.png`;
		const antwort = await s.holen(adresse);
		assert.equal(antwort.status, 200);
		assert.equal(antwort.headers.get('content-type'), 'image/png');
		const original = await readFile(path.join(figurenDir(s.materialDir), 'kiki.png'));
		assert.ok((await bytesVon(antwort)).equals(original));
		assert.equal(await pruefeWebp(await s.holen(`${adresse}?vorschaubild=1`), adresse), 48, 'nie größer');
		for (const name of ['figuren.json', 'fehlt.png', '.kiki.png']) {
			assert.equal((await s.holen(`${s.url}/ansicht/_figuren/${name}`)).status, 404, name);
		}
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
			'/ansicht/_figuren/..%2fgeheim.txt',
			'/ansicht/_figuren/..%2f..%2f..%2fetc%2fpasswd',
			'/ansicht/_figuren/../geheim.txt',
			'/ansicht/_figuren/link.png',
			`${pfad}bilder/link.png`,
			`${pfad}passwd.png`,
			'/ansicht/zweite/x',
			`${pfad}.material.html.1.a.tmp`,
		];
		for (const versuch of versuche) {
			const { status, text } = await rohAnfrage(s.url, versuch, s.cookie);
			assert.ok([400, 404].includes(status), `${versuch} → ${status}`);
			assert.doesNotMatch(text, /GEHEIMER-INHALT|root:/, versuch);
		}
	});
});
