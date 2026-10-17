import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { dokumentDir, mappenDir, neueMappe, neuesDokument } from './ablage';
import { bildStamm, findeBild, nimmBildAuf, sammleBilder, uebernimmBild, wandleInGraustufen } from './bilder';
import { SchoolboxFehler } from './fehler';
import { ASSETS, BLATT_PY } from './konfig';

const ausfuehren = promisify(execFile);
const JETZT = new Date(2026, 9, 16, 9, 0);
const KONFIG = { pythonBin: 'python3' };

/** Ein Foto wie vom iPad: hochkant über EXIF-Drehung, mit Kamera und GPS-Ort. */
const FOTO_PY = `
import sys
from PIL import Image
breite, hoehe, farbe = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
exif = Image.Exif()
exif[0x0112] = 6
exif[0x010F] = "Apple"
exif[0x8825] = {1: "N", 2: (48.0, 46.0, 0.0), 3: "E", 4: (9.0, 10.0, 0.0)}
Image.new("RGB", (breite, hoehe), farbe).save(sys.argv[1], exif=exif.tobytes(), quality=85)
`;

const PRUEFE_PY = `
import json, sys
from PIL import Image
b = Image.open(sys.argv[1])
print(json.dumps({"exif": len(b.getexif()), "gps": len(b.getexif().get_ifd(0x8825)), "info": sorted(b.info),
                  "mode": b.mode, "groesse": list(b.size)}))
`;

interface Befund {
	exif: number;
	gps: number;
	info: string[];
	mode: string;
	groesse: [number, number];
}

const foto = async (ordner: string, breite = 4000, hoehe = 3000, farbe = '#c83232') => {
	const datei = path.join(ordner, `foto-${breite}.jpg`);
	execFileSync('python3', ['-c', FOTO_PY, datei, String(breite), String(hoehe), farbe]);
	return readFile(datei);
};

const befund = (datei: string) =>
	JSON.parse(execFileSync('python3', ['-c', PRUEFE_PY, datei], { encoding: 'utf8' })) as Befund;

const ablage = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-bilder-'));
	const neu = async (titel: string) => {
		const { mappe } = await neueMappe(materialDir, { titel, fach: 'sachunterricht', klasse: 3 }, JETZT);
		const dok = await neuesDokument(
			materialDir,
			mappe.id,
			{ titel: 'Blatt', art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] },
			JETZT,
		);
		return { mappe: mappe.id, titel, dok: dok.id, dir: dokumentDir(materialDir, mappe.id, dok.id) };
	};
	return { materialDir, neu };
};

describe('bildStamm', () => {
	it('macht aus dem Dateinamen einen sprechenden Namen, aus Kameranamen „foto“', () => {
		assert.equal(bildStamm('Kartoffel Ernte.HEIC'), 'kartoffel-ernte');
		assert.equal(bildStamm('IMG_1234.JPG'), 'foto');
		assert.equal(bildStamm('image.jpeg'), 'foto');
		assert.equal(bildStamm('Größe.png'), 'groesse');
		assert.equal(bildStamm('!!!.png'), 'bild');
	});
});

describe('nimmBildAuf', () => {
	it('entfernt EXIF und GPS, übernimmt die Drehung und begrenzt die Kante', async () => {
		const { neu } = await ablage();
		const ziel = await neu('Fotos');
		const daten = await foto(ziel.dir);
		assert.ok(befund(path.join(ziel.dir, 'foto-4000.jpg')).gps > 0, 'Testfoto ohne GPS');
		const bild = await nimmBildAuf(KONFIG, ziel.dir, daten, 'IMG_1234.JPG');
		assert.deepEqual(bild, { src: 'bilder/foto.jpg', breite: 1800, hoehe: 2400 });
		const gespeichert = befund(path.join(ziel.dir, bild.src));
		assert.equal(gespeichert.exif, 0);
		assert.equal(gespeichert.gps, 0);
		assert.deepEqual(gespeichert.groesse, [1800, 2400]);
		assert.ok(!gespeichert.info.some((k) => /exif|xmp|comment/i.test(k)), gespeichert.info.join());
	});

	it('überschreibt nichts und verdeckt keine Bilder aus assets/', async () => {
		const { neu } = await ablage();
		const ziel = await neu('Namen');
		const daten = await foto(ziel.dir, 300, 200);
		assert.equal((await nimmBildAuf(KONFIG, ziel.dir, daten, 'IMG_1.jpg')).src, 'bilder/foto.jpg');
		assert.equal((await nimmBildAuf(KONFIG, ziel.dir, daten, 'IMG_2.jpg')).src, 'bilder/foto-2.jpg');
		assert.equal((await nimmBildAuf(KONFIG, ziel.dir, daten, 'willi.jpg')).src, 'bilder/willi-2.jpg');
	});

	it('behält Transparenz als PNG', async () => {
		const { neu } = await ablage();
		const ziel = await neu('Transparent');
		const bild = await nimmBildAuf(
			KONFIG,
			ziel.dir,
			await readFile(path.join(ASSETS, 'bilder', 'willi.png')),
			'w.png',
		);
		assert.equal(bild.src, 'bilder/w.png');
		assert.equal(befund(path.join(ziel.dir, bild.src)).mode, 'RGBA');
	});

	it('meldet Unlesbares verständlich', async () => {
		const { neu } = await ablage();
		const ziel = await neu('Kaputt');
		await assert.rejects(nimmBildAuf(KONFIG, ziel.dir, Buffer.from('kein Bild'), 'x.jpg'), (f: unknown) => {
			assert.ok(f instanceof SchoolboxFehler);
			assert.match(f.message, /nicht lesen.*JPEG oder PNG/);
			return true;
		});
		await assert.rejects(nimmBildAuf(KONFIG, ziel.dir, Buffer.alloc(0), 'x.jpg'), /leer/);
		assert.deepEqual(await readdir(path.join(ziel.dir, 'bilder')), []);
	});
});

describe('wandleInGraustufen', () => {
	it('legt eine graue Fassung an und lässt das Original', async () => {
		const { materialDir, neu } = await ablage();
		const ziel = await neu('Grau');
		const bild = await wandleInGraustufen({ ...KONFIG, materialDir }, ziel.mappe, ziel.dok, 'bilder/willi.png');
		assert.equal(bild.src, 'bilder/willi-grau.png');
		assert.equal(befund(path.join(ziel.dir, bild.src)).mode, 'LA');
		assert.equal(befund(path.join(ASSETS, 'bilder', 'willi.png')).mode, 'RGBA');
		await nimmBildAuf(KONFIG, ziel.dir, await foto(ziel.dir, 200, 100), 'rot.jpg');
		const grau = await wandleInGraustufen({ ...KONFIG, materialDir }, ziel.mappe, ziel.dok, 'bilder/rot.jpg');
		assert.equal(grau.src, 'bilder/rot-grau.jpg');
		assert.equal(befund(path.join(ziel.dir, grau.src)).mode, 'L');
	});
});

describe('findeBild', () => {
	it('findet nur Bilder in der Mappe oder in assets/', async () => {
		const { materialDir, neu } = await ablage();
		const ziel = await neu('Grenzen');
		await writeFile(path.join(materialDir, 'draussen.png'), 'x');
		assert.equal(
			findeBild(materialDir, ziel.mappe, ziel.dok, 'bilder/willi.png'),
			path.join(ASSETS, 'bilder', 'willi.png'),
		);
		for (const src of [
			'../../../draussen.png',
			'https://example.org/a.png',
			'/etc/passwd',
			'material.html',
			'x.png',
		]) {
			assert.throws(() => findeBild(materialDir, ziel.mappe, ziel.dok, src), SchoolboxFehler, src);
		}
	});
});

describe('uebernimmBild und sammleBilder', () => {
	it('verlinkt Erreichbares, kopiert Fremdes und findet Bilder über ihre Beschreibung', async () => {
		const { materialDir, neu } = await ablage();
		const hier = await neu('Kartoffeln');
		const dort = await neu('Igel');
		const daten = await foto(dort.dir, 300, 200);
		await nimmBildAuf(KONFIG, dort.dir, daten, 'igel.jpg');
		await writeFile(path.join(dort.dir, 'material.html'), '<p><img src="bilder/igel.jpg" alt="Igel im Laub"></p>');
		await nimmBildAuf(KONFIG, hier.dir, daten, 'eigen.jpg');
		await mkdir(path.join(mappenDir(materialDir, hier.mappe), 'bilder'), { recursive: true });
		await writeFile(path.join(mappenDir(materialDir, hier.mappe), 'bilder', 'geteilt.jpg'), daten);

		const s = await sammleBilder(materialDir, hier.mappe);
		const willi = s.sammlung.find((b) => b.name === 'willi.png');
		assert.equal(willi?.schluessel, '_assets/bilder/willi.png');
		assert.ok(willi?.alt.includes('Willi'));
		assert.deepEqual(s.mappe.map((b) => b.name).sort(), ['eigen.jpg', 'geteilt.jpg']);
		assert.deepEqual(s.meine, [
			{
				schluessel: `${dort.mappe}/dokumente/${dort.dok}/bilder/igel.jpg`,
				name: 'igel.jpg',
				alt: ['Igel im Laub'],
				mappe: 'Igel',
			},
		]);

		const nimm = (schluessel: string) => uebernimmBild(materialDir, hier.mappe, hier.dok, schluessel);
		assert.deepEqual(await nimm('_assets/bilder/willi.png'), { src: 'bilder/willi.png' });
		assert.deepEqual(await nimm(`${hier.mappe}/dokumente/${hier.dok}/bilder/eigen.jpg`), {
			src: 'bilder/eigen.jpg',
		});
		assert.deepEqual(await nimm(`${hier.mappe}/bilder/geteilt.jpg`), { src: '../../bilder/geteilt.jpg' });
		const fremd = `${dort.mappe}/dokumente/${dort.dok}/bilder/igel.jpg`;
		assert.deepEqual(await nimm(fremd), { src: 'bilder/igel.jpg' });
		assert.deepEqual(await nimm(fremd), { src: 'bilder/igel.jpg' }, 'gleiche Datei wird nicht noch einmal kopiert');
		assert.ok(existsSync(path.join(hier.dir, 'bilder', 'igel.jpg')));

		// Ein eigenes willi.png verdeckt das aus assets/: dann eine Kopie unter neuem Namen.
		await writeFile(path.join(hier.dir, 'bilder', 'willi.png'), daten);
		assert.deepEqual(await nimm('_assets/bilder/willi.png'), { src: 'bilder/willi-2.png' });

		for (const schluessel of [
			'_assets/../konfig.ts',
			'_assets/bilder/../blatt.css',
			`${hier.mappe}/mappe.json`,
			`${hier.mappe}/dokumente/${hier.dok}/material.html`,
			`${hier.mappe}/dokumente/../../x/bilder/a.png`,
			'../draussen/bilder/a.png',
			`${hier.mappe}/bilder/fehlt.png`,
		]) {
			await assert.rejects(nimm(schluessel), SchoolboxFehler, schluessel);
		}
	});
});

const chromiumFehlt = () => {
	try {
		const pruefen = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';
		execFileSync('python3', ['-c', pruefen, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		execFileSync('pdfimages', ['-v'], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

describe('blatt.py mit hochgeladenen Bildern', () => {
	it('bettet das Bild in voller Auflösung ein und meldet zu kleine Bilder', { timeout: 300_000 }, async (t) => {
		if (chromiumFehlt()) {
			t.skip('kein Chromium für blatt.py oder kein pdfimages');
			return;
		}
		const { neu } = await ablage();
		const ziel = await neu('Druck');
		const gross = await nimmBildAuf(KONFIG, ziel.dir, await foto(ziel.dir), 'gross.jpg');
		const klein = await nimmBildAuf(KONFIG, ziel.dir, await foto(ziel.dir, 60, 40, '#3264c8'), 'klein.jpg');
		const quelle = (await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8')).replace(
			'<img src="bilder/wachstum.png" alt="Samen, Keimling, Pflanze, Blume">',
			`<img src="${gross.src}" alt="Groß" style="width:180px"> <img src="${klein.src}" alt="Klein" style="width:240px">`,
		);
		assert.notEqual(quelle, await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8'));
		const datei = path.join(ziel.dir, 'probe.html');
		await writeFile(datei, quelle);
		const aus = path.join(ziel.dir, 'probe');
		const bericht = path.join(ziel.dir, 'probe.json');
		await ausfuehren('python3', [BLATT_PY, 'bauen', datei, '-o', aus, '--bericht', bericht]).catch(() => null);
		const { meldungen } = JSON.parse(await readFile(bericht, 'utf8')) as { meldungen: { text: string }[] };
		const texte = meldungen.map((m) => m.text);
		assert.ok(!texte.some((m) => m.startsWith('Bild fehlt')), texte.join('\n'));
		assert.ok(
			texte.some((m) => /Bild „Klein“ hat im Druck nur \d+ dpi/.test(m)),
			texte.join('\n'),
		);
		assert.ok(!texte.some((m) => m.includes('Bild „Groß“')), texte.join('\n'));
		const { stdout } = await ausfuehren('pdfimages', ['-list', path.join(aus, 'probe.pdf')]);
		assert.match(stdout, /\b1800\s+2400\b/, 'das große Bild in voller Auflösung');
	});
});
