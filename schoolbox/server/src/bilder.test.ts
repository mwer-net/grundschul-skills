import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ASSETS, MAX_BILD_BYTES } from '@schoolbox/kern';

import { DATEINAME_HEADER } from './bilder';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { legeDokumentAn, schreibKoepfe, starteTestServer } from './testhilfe';

const GPS_FOTO = `
import io, sys
from PIL import Image
exif = Image.Exif()
exif[0x8825] = {1: "N", 2: (48.0, 46.0, 0.0), 3: "E", 4: (9.0, 10.0, 0.0)}
puffer = io.BytesIO()
Image.new("RGB", (640, 480), "#3c8c3c").save(puffer, "JPEG", exif=exif.tobytes())
sys.stdout.buffer.write(puffer.getvalue())
`;
const EXIF_ZAHL = 'import sys; from PIL import Image; print(len(Image.open(sys.argv[1]).getexif()))';

interface Sammlung {
	sammlung: { schluessel: string }[];
	mappe: { schluessel: string }[];
	meine: unknown[];
}

describe('Bilder-API', () => {
	let s: TestServer;
	let mappe: string;
	let dok: string;
	let dir: string;
	const url = (rest = '') => `${s.url}/api/dokumente/${mappe}/${dok}/bilder${rest}`;
	const hochladen = (daten: Uint8Array, koepfe: Record<string, string> = {}) =>
		s.holen(url(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/octet-stream',
				[CSRF_HEADER]: '1',
				[DATEINAME_HEADER]: encodeURIComponent('Kürbis Ernte.jpg'),
				...koepfe,
			},
			body: daten,
		});

	before(async () => {
		s = await starteTestServer();
		({ dir, dok, mappe } = await legeDokumentAn(s.materialDir));
	});
	after(() => s.stop());

	it('nimmt ein Foto auf: ohne EXIF/GPS, mit sprechendem Namen, in bilder/ des Dokuments', async () => {
		const foto = execFileSync('python3', ['-c', GPS_FOTO]);
		const antwort = await hochladen(foto);
		assert.equal(antwort.status, 200, await antwort.clone().text());
		assert.deepEqual(await antwort.json(), { src: 'bilder/kuerbis-ernte.jpg', breite: 640, hoehe: 480 });
		const datei = path.join(dir, 'bilder', 'kuerbis-ernte.jpg');
		assert.equal(execFileSync('python3', ['-c', EXIF_ZAHL, datei], { encoding: 'utf8' }).trim(), '0');
	});

	it('lehnt Uploads ohne Schutzkopf, Unlesbares und zu Großes verständlich ab', async () => {
		const ohne = await hochladen(Buffer.from('x'), { [CSRF_HEADER]: '' });
		assert.equal(ohne.status, 403);
		const formular = await s.holen(url(), {
			method: 'POST',
			headers: { 'Content-Type': 'multipart/form-data; boundary=x', [CSRF_HEADER]: '1' },
			body: '--x--',
		});
		assert.equal(formular.status, 403);
		const kaputt = await hochladen(Buffer.from('kein Bild'));
		assert.equal(kaputt.status, 400);
		assert.match(((await kaputt.json()) as { fehler: string }).fehler, /JPEG oder PNG/);
		const gross = await hochladen(Buffer.alloc(MAX_BILD_BYTES + 1));
		assert.equal(gross.status, 413);
		assert.match(((await gross.json()) as { fehler: string }).fehler, /höchstens 25 MB/);
		assert.deepEqual(await readdir(path.join(dir, 'bilder')), ['kuerbis-ernte.jpg']);
	});

	it('zeigt die Sammlung und übernimmt Bilder daraus', async () => {
		const sammlung = (await (await s.holen(url())).json()) as Sammlung;
		assert.ok(sammlung.sammlung.some((b) => b.schluessel === '_assets/bilder/willi.png'));
		assert.deepEqual(
			sammlung.mappe.map((b) => b.schluessel),
			[`${mappe}/dokumente/${dok}/bilder/kuerbis-ernte.jpg`],
		);
		const bild = await s.holen(`${s.url}/ansicht/${sammlung.mappe[0]?.schluessel ?? ''}`);
		assert.equal(bild.headers.get('content-type'), 'image/jpeg');
		const nimm = (schluessel: string) =>
			s.holen(url('/uebernehmen'), {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ schluessel }),
			});
		assert.deepEqual(await (await nimm('_assets/bilder/willi.png')).json(), { src: 'bilder/willi.png' });
		assert.equal((await nimm('_assets/../../.env')).status, 400);
		assert.equal((await s.holen(url('/uebernehmen'), { method: 'POST', headers: schreibKoepfe })).status, 400);
	});

	it('legt eine Graustufen-Fassung an', async () => {
		const antwort = await s.holen(url('/graustufen'), {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ src: 'bilder/willi.png' }),
		});
		assert.deepEqual(await antwort.json(), { src: 'bilder/willi-grau.png', breite: 1264, hoehe: 1264 });
		assert.ok(existsSync(path.join(dir, 'bilder', 'willi-grau.png')));
		assert.ok((await readFile(path.join(ASSETS, 'bilder', 'willi.png'))).length > 0);
		const draussen = await s.holen(url('/graustufen'), {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ src: '../../../../.env' }),
		});
		assert.equal(draussen.status, 400);
	});

	it('antwortet für unbekannte Dokumente mit 404', async () => {
		assert.equal((await s.holen(`${s.url}/api/dokumente/${mappe}/gibt-es-nicht/bilder`)).status, 404);
	});
});
