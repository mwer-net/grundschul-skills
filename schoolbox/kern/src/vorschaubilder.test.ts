import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { vorschaubildAdresse } from './bildbefehle';
import { BILD_FREI_BREITE } from './bilder-frei';
import { BILD_PY } from './konfig';
import {
	leereVorschaubilder,
	vorschaubild,
	VORSCHAUBILD_BREITE,
	VORSCHAUBILD_HOEHE,
	vorschaubilderDir,
} from './vorschaubilder';

/** Bilder mit Pillow, je vier Argumente: Datei, Breite, Höhe, Art (`rgb`, `rgba` mit leerer Ecke, `gedreht`). */
const ERZEUGE_PY = `
import sys
from PIL import Image
a = sys.argv[1:]
for datei, breite, hoehe, art in zip(a[::4], a[1::4], a[2::4], a[3::4]):
    breite, hoehe = int(breite), int(hoehe)
    if art == "rgba":
        b = Image.new("RGBA", (breite, hoehe), (200, 50, 50, 255))
        b.paste((0, 0, 0, 0), (0, 0, breite // 4, hoehe // 4))
        b.save(datei)
    elif art == "gedreht":
        exif = Image.Exif()
        exif[0x0112] = 6
        Image.new("RGB", (breite, hoehe), "#c83232").save(datei, exif=exif.tobytes(), quality=85)
    else:
        Image.new("RGB", (breite, hoehe), "#3264c8").save(datei, quality=85)
`;

const MASSE_PY = `
import json, sys
from PIL import Image
b = Image.open(sys.argv[1])
print(json.dumps({"format": b.format, "groesse": list(b.size), "alpha": b.convert("RGBA").getpixel((0, 0))[3]}))
`;

interface Masse {
	format: string;
	groesse: [number, number];
	alpha: number;
}

type Art = 'rgb' | 'rgba' | 'gedreht';

const erzeuge = (bilder: [datei: string, breite: number, hoehe: number, art?: Art][]) => {
	const argumente = bilder.flatMap(([d, b, h, a = 'rgb']) => [d, String(b), String(h), a]);
	execFileSync('python3', ['-c', ERZEUGE_PY, ...argumente]);
};

const masse = (datei: string) =>
	JSON.parse(execFileSync('python3', ['-c', MASSE_PY, datei], { encoding: 'utf8' })) as Masse;

const mtimeNs = async (datei: string) => (await stat(datei, { bigint: true })).mtimeNs;

const ablage = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-vorschaubilder-'));
	const bilder = path.join(materialDir, 'mappe', 'bilder');
	await mkdir(bilder, { recursive: true });
	const konfig = (pythonBin = 'python3') => ({ materialDir, pythonBin });
	return { materialDir, bilder, konfig, in: (name: string) => path.join(bilder, name) };
};

/** `pythonBin`, der Python startet und jeden Lauf mitschreibt: `+` beim Start, `-` am Ende. */
const zaehler = async () => {
	const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-zaehler-'));
	const log = path.join(dir, 'laeufe.log');
	const bin = path.join(dir, 'python');
	await writeFile(bin, `#!/bin/sh\necho + >> '${log}'\npython3 "$@"\ncode=$?\necho - >> '${log}'\nexit $code\n`, {
		mode: 0o755,
	});
	const zeichen = async () => (existsSync(log) ? (await readFile(log, 'utf8')).split('\n').filter(Boolean) : []);
	return {
		bin,
		laeufe: async () => (await zeichen()).filter((z) => z === '+').length,
		hoechstens: async () => {
			let jetzt = 0;
			let max = 0;
			for (const z of await zeichen()) {
				jetzt += z === '+' ? 1 : -1;
				max = Math.max(max, jetzt);
			}
			return max;
		},
	};
};

const reste = async (materialDir: string) =>
	(await readdir(vorschaubilderDir(materialDir)).catch(() => [])).filter((n) => n.endsWith('.tmp'));

const summe = async (datei: string) =>
	createHash('sha256')
		.update(await readFile(datei))
		.digest('hex');

/** Jede Datei unter `dir` mit ihrer Prüfsumme. */
const summen = async (dir: string) =>
	Promise.all(
		(await readdir(dir, { recursive: true })).sort().map(async (n) => {
			const datei = path.join(dir, n);
			return (await stat(datei)).isFile() ? `${n}:${await summe(datei)}` : n;
		}),
	);

describe('Vorschaubilder (178)', () => {
	it('die Adresse hängt den Parameter an, auch an eine Kennung', () => {
		const willi = '/ansicht/_assets/bilder/willi.png';
		assert.equal(vorschaubildAdresse(willi), `${willi}?vorschaubild=1`);
		assert.equal(
			vorschaubildAdresse('/f/t/ansicht/m/dokumente/d/ausgabe/material-s1.png?v=7'),
			'/f/t/ansicht/m/dokumente/d/ausgabe/material-s1.png?v=7&vorschaubild=1',
		);
	});

	it('höchstens 320 px breit und 1280 px hoch, WebP, im eigenen Ordner', async () => {
		const a = await ablage();
		erzeuge([
			[a.in('quer.jpg'), 1600, 1200],
			[a.in('hoch.jpg'), 1200, 1600],
			[a.in('breit.png'), 2000, 500],
		]);
		const erwartet = { 'quer.jpg': [320, 240], 'hoch.jpg': [320, 427], 'breit.png': [320, 80] };
		for (const [name, groesse] of Object.entries(erwartet)) {
			const pfad = await vorschaubild(a.konfig(), a.in(name));
			assert.ok(pfad, name);
			assert.equal(path.dirname(pfad), vorschaubilderDir(a.materialDir));
			assert.match(path.basename(pfad), /^[0-9a-f]{32}\.webp$/);
			assert.deepEqual(masse(pfad), { format: 'WEBP', groesse, alpha: 255 }, name);
		}
	});

	it('vergrößert nie; die Breite ist die Grenze, nicht die längste Kante', async () => {
		const a = await ablage();
		erzeuge([
			[a.in('klein.png'), 150, 100],
			[a.in('hoch.jpg'), 1200, 1600],
		]);
		const klein = await vorschaubild(a.konfig(), a.in('klein.png'));
		assert.deepEqual(masse(klein ?? '').groesse, [150, 100]);
		assert.equal(VORSCHAUBILD_BREITE, BILD_FREI_BREITE);
		assert.equal(VORSCHAUBILD_HOEHE, 4 * VORSCHAUBILD_BREITE);
		// Gegenprobe: Mit der längsten Kante (Höhe = Breite) käme das Hochformat schmaler aufs Blatt.
		const kante = path.join(a.materialDir, 'kante.webp');
		const b = String(VORSCHAUBILD_BREITE);
		execFileSync('python3', [BILD_PY, 'vorschaubilder', b, b, a.in('hoch.jpg'), kante]);
		assert.deepEqual(masse(kante).groesse, [240, 320]);
	});

	it('behält Transparenz und übernimmt die EXIF-Drehung', async () => {
		const a = await ablage();
		erzeuge([
			[a.in('figur.png'), 800, 600, 'rgba'],
			[a.in('ipad.jpg'), 4000, 3000, 'gedreht'],
		]);
		assert.equal(masse((await vorschaubild(a.konfig(), a.in('figur.png'))) ?? '').alpha, 0);
		assert.deepEqual(masse((await vorschaubild(a.konfig(), a.in('ipad.jpg'))) ?? '').groesse, [320, 427]);
	});

	it('gilt, solange die Änderungszeit der des Originals gleicht; danach entsteht es neu', async () => {
		const a = await ablage();
		const datei = a.in('foto.jpg');
		erzeuge([[datei, 1600, 1200]]);
		const pfad = await vorschaubild(a.konfig(), datei);
		assert.ok(pfad);
		assert.equal(await mtimeNs(pfad), await mtimeNs(datei));
		// Gültig: kein Prozess, auch ohne Python.
		assert.equal(await vorschaubild(a.konfig('false'), datei), pfad);
		const vorher = await stat(datei);
		erzeuge([[datei, 800, 1600]]);
		await utimes(datei, vorher.atime, new Date(vorher.mtimeMs + 1000));
		assert.equal(await vorschaubild(a.konfig(), datei), pfad);
		assert.deepEqual(masse(pfad).groesse, [320, 640]);
		assert.equal(await mtimeNs(pfad), await mtimeNs(datei));
		assert.deepEqual(await reste(a.materialDir), []);
	});

	it('ohne Python oder bei kaputtem Bild `null`, gemerkt je Stand, bis der Ordner geleert ist', async () => {
		const a = await ablage();
		await writeFile(a.in('x.png'), 'kein Bild');
		assert.equal(await vorschaubild(a.konfig(), a.in('x.png')), null);
		erzeuge([[a.in('neu.jpg'), 1600, 1200]]);
		assert.equal(await vorschaubild(a.konfig('false'), a.in('neu.jpg')), null);
		// Gegenprobe: Mit Python bleibt es beim gemerkten Fehlschlag, solange sich das Bild nicht ändert.
		const z = await zaehler();
		assert.equal(await vorschaubild(a.konfig(z.bin), a.in('neu.jpg')), null);
		assert.equal(await z.laeufe(), 0);
		await leereVorschaubilder(a.materialDir);
		const pfad = await vorschaubild(a.konfig(), a.in('neu.jpg'));
		assert.deepEqual(masse(pfad ?? '').groesse, [320, 240]);
		assert.equal(await vorschaubild(a.konfig(), a.in('x.png')), null);
		assert.deepEqual(await reste(a.materialDir), []);
	});

	it('SVG und andere Dateien ohne Prozess: `null`, nichts in `_vorschaubilder/`', async () => {
		const a = await ablage();
		await writeFile(a.in('x.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>');
		await writeFile(path.join(a.materialDir, 'mappe', 'thema.css'), 'body{}');
		assert.equal(await vorschaubild(a.konfig('false'), a.in('x.svg')), null);
		assert.equal(await vorschaubild(a.konfig('false'), path.join(a.materialDir, 'mappe', 'thema.css')), null);
		assert.equal(existsSync(vorschaubilderDir(a.materialDir)), false);
	});

	it('dieselbe Datei zugleich nur einmal; viele Bilder zugleich in höchstens zwei Läufen nebeneinander', async () => {
		const a = await ablage();
		const namen = Array.from({ length: 20 }, (_, i) => `bild-${i}.jpg`);
		erzeuge(namen.map((n, i) => [a.in(n), 400 + i * 10, 300]));

		const einer = await zaehler();
		const gleich = await Promise.all(
			Array.from({ length: 10 }, () => vorschaubild(a.konfig(einer.bin), a.in('bild-0.jpg'))),
		);
		assert.equal(new Set(gleich).size, 1);
		assert.ok(gleich[0]);
		assert.equal(await einer.laeufe(), 1);
		assert.deepEqual(await readdir(vorschaubilderDir(a.materialDir)), [path.basename(gleich[0])]);

		const viele = await zaehler();
		const pfade = await Promise.all(namen.slice(1).map((n) => vorschaubild(a.konfig(viele.bin), a.in(n))));
		assert.ok(pfade.every((p) => p !== null));
		assert.equal(new Set(pfade).size, 19);
		assert.ok((await viele.hoechstens()) <= 2, `${await viele.hoechstens()} Läufe zugleich`);
		// Ein Lauf nimmt bis zu acht: 19 Bilder brauchen also weniger als 19 Prozesse.
		assert.ok((await viele.laeufe()) < 19, `${await viele.laeufe()} Läufe`);
		assert.deepEqual(await reste(a.materialDir), []);
	});

	it('Bestand: Kein Byte unter der Mappe ändert sich', async () => {
		const a = await ablage();
		erzeuge([
			[a.in('foto.jpg'), 1600, 1200],
			[a.in('figur.png'), 800, 600, 'rgba'],
			[a.in('ipad.jpg'), 4000, 3000, 'gedreht'],
			[a.in('klein.png'), 150, 100],
		]);
		await writeFile(a.in('x.png'), 'kein Bild');
		await writeFile(a.in('x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
		const mappe = path.join(a.materialDir, 'mappe');
		const vorher = await summen(mappe);
		const namen = ['foto.jpg', 'figur.png', 'ipad.jpg', 'klein.png', 'x.png', 'x.svg'];
		await Promise.all(namen.map((n) => vorschaubild(a.konfig(), a.in(n))));
		await Promise.all(namen.map((n) => vorschaubild(a.konfig('false'), a.in(n))));
		await leereVorschaubilder(a.materialDir);
		await Promise.all(namen.map((n) => vorschaubild(a.konfig(), a.in(n))));
		assert.deepEqual(await summen(mappe), vorher);
		assert.equal((await readdir(vorschaubilderDir(a.materialDir))).length, 4);
	});
});
