import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
// >> 179
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { CanvaStand } from '@schoolbox/kern';
import { figurenDir, MAX_BILD_BYTES, WURZEL } from '@schoolbox/kern';
// << 179

import { DATEINAME_HEADER } from './bilder';
// >> 179
import { VERBRAUCH_DATEI } from './ki';
// << 179
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
// >> 179
import { KI_ATTRAPPE, legeDokumentAn, legeTestfigurenAn, schreibKoepfe, starteTestServer } from './testhilfe';
// << 179

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

// >> 179
const warte = async (bedingung: () => Promise<boolean> | boolean, ms = 20_000) => {
	const ende = Date.now() + ms;
	while (Date.now() < ende) {
		if (await bedingung()) {
			return;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	assert.fail('Zeit abgelaufen');
};
// << 179

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

	it('antwortet für unbekannte Dokumente mit 404', async () => {
		assert.equal((await s.holen(`${s.url}/api/dokumente/${mappe}/gibt-es-nicht/bilder`)).status, 404);
	});
});

// >> 179
describe('Bild beschreiben (179)', () => {
	let s: TestServer;
	let bin: string;
	let mappe: string;
	let dok: string;
	let dir: string;
	const altHome = process.env.HOME;
	const ereignisse: { id: string; art: string; status: string; datei?: string }[] = [];
	const WUNSCH = 'Willi und Wilma pflanzen eine Sonnenblume';
	const BILD = 'willi-und-wilma-im-garten.jpg';

	const fall = (name: string) => writeFile(path.join(path.dirname(bin), 'fall.txt'), name);
	const prompts = () => readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8').catch(() => '');
	const letzterPrompt = async () => (await prompts()).split('\n---\n').at(-2) ?? '';
	const beschreibe = (text: unknown, ort = `${mappe}/${dok}`) =>
		s.holen(`${s.url}/api/dokumente/${ort}/bilder/beschreiben`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ text }),
		});
	const starte = async (text: string) => {
		const antwort = await beschreibe(text);
		assert.equal(antwort.status, 201, await antwort.clone().text());
		const daten = (await antwort.json()) as { id: string };
		assert.deepEqual(Object.keys(daten), ['id']);
		return daten.id;
	};
	const fehler = async (antwort: Response) => ((await antwort.json()) as { fehler: string }).fehler;
	const liste = async () =>
		((await (await s.holen(`${s.url}/api/canva`)).json()) as { laeufe: CanvaStand[] }).laeufe;
	const letztes = (id: string) => ereignisse.filter((e) => e.id === id).at(-1);
	const ende = async (id: string) => {
		await warte(() => ['fertig', 'fehler', 'abgebrochen'].includes(letztes(id)?.status ?? ''));
		return letztes(id);
	};
	const mappenBilder = () => path.join(s.materialDir, mappe, 'bilder');
	const inhalt = async () => readdir(mappenBilder()).catch(() => [] as string[]);
	const hash = async (datei: string) => createHash('sha256').update(await readFile(datei)).digest('hex');

	/** Kiki (177) und drei Figuren, die ein Bild tragen: Bär und Max mit Steckbrief, Igel nur mit Media-ID. */
	const legeBildfigurenAn = async (materialDir: string) => {
		await legeTestfigurenAn(materialDir);
		const ordner = figurenDir(materialDir);
		for (const id of ['baer', 'igel', 'max']) {
			await copyFile(path.join(ordner, 'kiki.png'), path.join(ordner, `${id}.png`));
		}
		const figuren = [
			{ id: 'kiki', name: 'Kiki', posen: [{ datei: 'kiki.png' }, { datei: 'kiki-winkt.png' }] },
			{ id: 'baer', name: 'Bär', steckbrief: 'brauner Bär mit grüner Mütze', posen: [{ datei: 'baer.png' }] },
			{ id: 'igel', name: 'Igel', canva: 'MAigel00001', posen: [{ datei: 'igel.png' }] },
			{ id: 'max', name: 'Max', steckbrief: 'Junge mit roter Jacke', posen: [{ datei: 'max.png' }] },
		];
		await writeFile(path.join(ordner, 'figuren.json'), JSON.stringify({ version: 1, figuren }));
	};

	before(async () => {
		process.env.HOME = await mkdtemp(path.join(tmpdir(), 'bild-home-'));
		const ordner = await mkdtemp(path.join(tmpdir(), 'bild-bin-'));
		bin = path.join(ordner, 'claude');
		await writeFile(bin, KI_ATTRAPPE);
		await chmod(bin, 0o755);
		await fall('canva-bild');
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-bild-'));
		await legeBildfigurenAn(materialDir);
		s = await starteTestServer({ materialDir, env: { CLAUDE_BIN: bin } });
		({ dir, dok, mappe } = await legeDokumentAn(materialDir));
		const html = path.join(dir, 'material.html');
		await writeFile(html, (await readFile(html, 'utf8')).replace(/<body([^>]*?)class="/, '<body$1class="palette-wiese '));
		s.kontext.ereignisse.abonniere((e) => {
			if (e.typ === 'canva-stand') {
				ereignisse.push(e.daten);
			}
		});
	});

	after(async () => {
		process.env.HOME = altHome;
		await s.stop();
	});

	afterEach(async () => {
		for (const l of await liste()) {
			await s.holen(`${s.url}/api/canva/${l.id}/abbrechen`, { method: 'POST', headers: schreibKoepfe });
		}
		await warte(async () => (await liste()).length === 0);
		await fall('canva-bild');
	});

	it('lehnt leeren und zu langen Text ab; ein unbekanntes Dokument gibt 404', async () => {
		const leer = await beschreibe('   ');
		assert.equal(leer.status, 400);
		assert.equal(await fehler(leer), 'Beschreibe das Bild.');
		const lang = await beschreibe('a'.repeat(301));
		assert.equal(lang.status, 400);
		assert.equal(await fehler(lang), 'Höchstens 300 Zeichen.');
		assert.equal((await beschreibe(WUNSCH, `${mappe}/gibt-es-nicht`)).status, 404);
		assert.deepEqual(await liste(), []);
	});

	it('mehr als vier Figuren starten keinen Lauf', async () => {
		const vorher = await prompts();
		const antwort = await beschreibe('Willi, Wilma, Bär, Igel und Max spielen Fangen');
		assert.equal(antwort.status, 400);
		assert.equal(await fehler(antwort), 'Höchstens vier Figuren je Bild.');
		assert.deepEqual(await liste(), []);
		assert.equal((await prompts()).length, vorher.length);
	});

	it('legt das Bild in bilder/ der Mappe, notiert Media-ID und Verbrauch, ändert kein Blatt', async () => {
		const html = await readFile(path.join(dir, 'material.html'));
		const id = await starte(WUNSCH);
		await warte(async () => (await letzterPrompt()).includes(WUNSCH));
		const prompt = await letzterPrompt();
		const vorlage = await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'bild.md'), 'utf8');
		assert.ok(prompt.startsWith(vorlage.trimEnd()), prompt);
		assert.match(prompt, /^Palette: Wiese$/m);
		assert.match(prompt, /^Figur Willi: Aussehen „grauer Waschbär-Junge.*; Referenz MAHXV49zJZE$/m);
		assert.match(prompt, /^Figur Wilma: Aussehen „graues Waschbär-Mädchen.*; Referenz MAHXV_-A1xo$/m);

		assert.deepEqual(await ende(id), { id, art: 'bild', status: 'fertig', datei: BILD });
		assert.ok(existsSync(path.join(mappenBilder(), BILD)));
		const ids = await readFile(path.join(mappenBilder(), 'canva-ids.tsv'), 'utf8');
		assert.ok(ids.includes(`${BILD}\tMAattrappe2\tWilli und Wilma im Garten\n`), ids);
		const sammlung = (await (await s.holen(`${s.url}/api/dokumente/${mappe}/${dok}/bilder`)).json()) as Sammlung;
		assert.equal(sammlung.mappe[0]?.schluessel, `${mappe}/bilder/${BILD}`);
		assert.ok((await readFile(path.join(dir, 'material.html'))).equals(html), 'material.html byte-gleich');
		assert.ok(!existsSync(path.join(dir, 'bilder')), 'nichts in bilder/ des Dokuments');
		const zeilen = (await readFile(path.join(s.materialDir, VERBRAUCH_DATEI), 'utf8')).trim().split('\n');
		const zeile = JSON.parse(zeilen.at(-1) ?? '{}') as Record<string, unknown>;
		assert.equal(zeile.umfang, 'canva-bild');
		assert.equal(zeile.mappe, mappe);
		assert.equal(zeile.dok, dok);
		assert.deepEqual(await liste(), []);
	});

	it('derselbe Auftrag noch einmal gibt eine zweite Datei, die erste bleibt unverändert', async () => {
		const erste = path.join(mappenBilder(), BILD);
		const vorher = await hash(erste);
		const id = await starte(WUNSCH);
		assert.equal((await ende(id))?.datei, 'willi-und-wilma-im-garten-2.jpg');
		assert.equal(await hash(erste), vorher);
		assert.ok(existsSync(path.join(mappenBilder(), 'willi-und-wilma-im-garten-2.jpg')));
	});

	it('ein fremder Name ist keine Figur: keine Media-ID im Auftrag', async () => {
		const id = await starte('Paul pflanzt eine Blume');
		await warte(async () => (await letzterPrompt()).includes('Paul pflanzt'));
		const prompt = await letzterPrompt();
		assert.match(prompt, /^Keine Figur aus der Bibliothek\.$/m);
		assert.doesNotMatch(prompt, /\bMA[A-Za-z0-9_-]{9}\b/);
		assert.doesNotMatch(prompt, /^Figur /m);
		await ende(id);
	});

	it('kein Bild von Canva: Fehler an der Kachel, bilder/ der Mappe bleibt gleich', async () => {
		await fall('canva-kein-png');
		const vorher = await inhalt();
		const id = await starte(WUNSCH);
		assert.equal((await ende(id))?.status, 'fehler');
		assert.equal((await liste()).find((l) => l.id === id)?.fehler, 'Canva hat kein Bild geliefert.');
		assert.deepEqual(await inhalt(), vorher);
	});
});
// << 179
