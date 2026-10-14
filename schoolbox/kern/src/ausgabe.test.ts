import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { dokumentDir, dupliziereMappe, mappenDir, neueMappe, neuesDokument } from './ablage';
import {
	ausgabeSchluessel,
	fuegePdfsZusammen,
	istAusgabeAktuell,
	leseStand,
	PDF_DATEI,
	STAND_DATEI,
	uebernehmeAusgabe,
} from './ausgabe';
import { SchoolboxFehler } from './fehler';
import { A4, FOLIE, testPdf } from './testpdf';

const ausfuehren = promisify(execFile);

const BLATT = (bild: string) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Blatt</title><link rel="stylesheet" href="blatt.css"></head>
<body class="kl2 sw"><div class="seite"><img src="${bild}" alt="Willi"></div></body></html>
`;

const ablage = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-ausgabe-'));
	const { mappe } = await neueMappe(materialDir, { titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 });
	const angaben = {
		titel: 'Blatt',
		art: 'arbeitsblatt',
		format: 'a4-hoch',
		druckprofil: 'sw',
		druckhinweise: [],
	} as const;
	const { id } = await neuesDokument(materialDir, mappe.id, angaben);
	const dir = dokumentDir(materialDir, mappe.id, id);
	return { materialDir, mappe: mappe.id, dok: id, dir };
};

const seitenGroessen = async (datei: string) => {
	const { stdout } = await ausfuehren('pdfinfo', ['-f', '1', '-l', '99', datei]);
	return [...stdout.matchAll(/^Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/gm)].map((m) => [Number(m[1]), Number(m[2])]);
};

describe('ausgabeSchluessel', () => {
	it('hängt am Inhalt von material.html und allen eingebundenen Dateien, nicht an der Uhrzeit', async () => {
		const { dir, mappe, materialDir } = await ablage();
		const quelle = path.join(dir, 'material.html');
		await writeFile(quelle, BLATT('../../bilder/willi.png'));
		const ohneBild = await ausgabeSchluessel(dir);

		await mkdir(path.join(mappenDir(materialDir, mappe), 'bilder'), { recursive: true });
		const bild = path.join(mappenDir(materialDir, mappe), 'bilder', 'willi.png');
		await writeFile(bild, 'eins');
		const mitBild = await ausgabeSchluessel(dir);
		assert.notEqual(mitBild, ohneBild, 'ein Bild, das vorher fehlte');

		const spaeter = new Date(Date.now() + 60_000);
		await utimes(quelle, spaeter, spaeter);
		await utimes(bild, spaeter, spaeter);
		assert.equal(await ausgabeSchluessel(dir), mitBild, 'touch ändert nichts');

		await writeFile(bild, 'zwei');
		const neuesBild = await ausgabeSchluessel(dir);
		assert.notEqual(neuesBild, mitBild, 'geändertes Bild');

		await writeFile(quelle, BLATT('../../bilder/willi.png').replace('Willi', 'Wilma'));
		assert.notEqual(await ausgabeSchluessel(dir), neuesBild, 'geänderter Text');
	});

	it('bezieht eigene Stylesheets samt ihrer url()-Verweise ein', async () => {
		const { dir } = await ablage();
		await writeFile(path.join(dir, 'material.html'), BLATT('x.png').replace('blatt.css', 'eigen.css'));
		await writeFile(path.join(dir, 'eigen.css'), '.seite{background:url("muster.png")}');
		await writeFile(path.join(dir, 'muster.png'), 'a');
		const vorher = await ausgabeSchluessel(dir);
		await writeFile(path.join(dir, 'muster.png'), 'b');
		assert.notEqual(await ausgabeSchluessel(dir), vorher);
	});
});

describe('uebernehmeAusgabe', () => {
	it('ersetzt den alten Bau, räumt Reste weg und schreibt den Stand zuletzt', async () => {
		const { dir } = await ablage();
		await writeFile(path.join(dir, 'material.html'), BLATT('x.png'));
		const ausgabe = path.join(dir, 'ausgabe');
		await writeFile(path.join(ausgabe, 'material-s3.png'), 'alt');
		await writeFile(path.join(ausgabe, PDF_DATEI), 'alt');

		const bau = await mkdtemp(path.join(tmpdir(), 'schoolbox-bau-'));
		await writeFile(path.join(bau, PDF_DATEI), 'neu');
		await writeFile(path.join(bau, 'material-s1.png'), 'neu');
		const schluessel = await ausgabeSchluessel(dir);
		assert.equal(await istAusgabeAktuell(dir), false);
		await uebernehmeAusgabe(bau, dir, schluessel);

		assert.deepEqual((await readdir(ausgabe)).sort(), ['material-s1.png', PDF_DATEI, STAND_DATEI]);
		assert.equal(await readFile(path.join(ausgabe, PDF_DATEI), 'utf8'), 'neu');
		assert.equal(await leseStand(ausgabe), schluessel);
		assert.equal(await istAusgabeAktuell(dir), true);
		await writeFile(path.join(dir, 'material.html'), BLATT('y.png'));
		assert.equal(await istAusgabeAktuell(dir), false);
	});

	it('legt für ein gelöschtes Dokument keinen Ordner neu an', async () => {
		const { dir, mappe, materialDir } = await ablage();
		const bau = await mkdtemp(path.join(tmpdir(), 'schoolbox-bau-'));
		await writeFile(path.join(bau, PDF_DATEI), 'neu');
		await rm(mappenDir(materialDir, mappe), { recursive: true });
		await assert.rejects(uebernehmeAusgabe(bau, dir, 'x'), SchoolboxFehler);
		assert.equal(existsSync(mappenDir(materialDir, mappe)), false);
	});
});

describe('fuegePdfsZusammen', () => {
	it('hängt PDFs mit verschiedenen Seitenformaten in der Reihenfolge aneinander', async () => {
		const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-pdf-'));
		const teile: string[] = [];
		for (const [i, seiten] of [[A4, A4], [FOLIE], [A4]].entries()) {
			teile.push(path.join(ordner, `${i}.pdf`));
			await writeFile(path.join(ordner, `${i}.pdf`), testPdf(seiten));
		}
		const ziel = path.join(ordner, 'alles.pdf');
		await fuegePdfsZusammen(teile, ziel);
		assert.deepEqual(await seitenGroessen(ziel), [A4, A4, FOLIE, A4]);
		assert.deepEqual(
			(await readdir(ordner)).filter((n) => n.startsWith('.')),
			[],
			'keine temporären Dateien',
		);

		await fuegePdfsZusammen([teile[1] ?? ''], ziel);
		assert.deepEqual(await seitenGroessen(ziel), [FOLIE], 'ein einzelnes PDF wird nur kopiert');
	});
});

describe('dupliziereMappe', () => {
	it('lässt „Alles als PDF“ der Mappe weg', async () => {
		const { mappe, materialDir } = await ablage();
		await mkdir(path.join(mappenDir(materialDir, mappe), 'ausgabe'));
		await writeFile(path.join(mappenDir(materialDir, mappe), 'ausgabe', 'alles.pdf'), 'pdf');
		const kopie = await dupliziereMappe(materialDir, mappe);
		assert.equal(existsSync(path.join(mappenDir(materialDir, kopie.id), 'ausgabe')), false);
	});
});
