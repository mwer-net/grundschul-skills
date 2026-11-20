import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { dokumentDir, leseMeta, neueMappe, neuesDokument, registriereEntwuerfe, waehleEntwurf } from './ablage';
import { baueAnsichtAus, baueEntwurfsVorschauen, KI_PRUEFDATEI, ohneDoppelKontrast, pruefeFassung } from './bauen';
import { BROWSER_HINWEIS, browserFehlt } from './browsertest';
import { ASSETS } from './konfig';
import type { Meldung } from './meldungen';

const entwurf = (vorlage: string, titel: string, aufgabenMal = 1) => {
	const start = vorlage.indexOf('<div class="aufgabe">');
	const ende = vorlage.indexOf('</section>');
	return (vorlage.slice(0, start) + vorlage.slice(start, ende).repeat(aufgabenMal) + vorlage.slice(ende))
		.replace(/<title>.*?<\/title>/s, `<title>${titel}</title>`)
		.replace(/<body class="[^"]*"/, '<body class="kl2 sw"')
		.replace('bilder/willi.png', 'bilder/eigen.png');
};

describe('baueEntwurfsVorschauen (mit blatt.py)', () => {
	it('baut Vorschauen relativ zum Dokumentordner und markiert, was nicht auf die Seite passt', async (t) => {
		if (browserFehlt()) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-entwurf-'));
		const { mappe } = await neueMappe(materialDir, { titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 });
		const { id } = await neuesDokument(materialDir, mappe.id, {
			titel: 'Uhrzeit ablesen',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		});
		const ziel = { mappe: mappe.id, dok: id };
		const dir = dokumentDir(materialDir, mappe.id, id);
		await copyFile(path.join(ASSETS, 'bilder', 'willi-strich.png'), path.join(dir, 'bilder', 'eigen.png'));
		const vorlage = await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
		const dateien = [path.join(dir, 'entwurf-a.html'), path.join(dir, 'entwurf-b.html')];
		await writeFile(dateien[0] ?? '', entwurf(vorlage, 'A · Uhren lesen – nur Aufgaben'));
		await writeFile(dateien[1] ?? '', entwurf(vorlage, 'B · Willis Tag – viel zu viel', 3));
		await registriereEntwuerfe(materialDir, ziel, dateien);

		const [a, b] = await baueEntwurfsVorschauen({ materialDir, pythonBin: 'python3' }, ziel);
		assert.equal(a?.fehler, null);
		assert.deepEqual(a?.entwurf.pruefung, { seiten: 1, passt: true, meldungen: [] }, 'eigenes Bild gefunden');
		assert.equal(b?.entwurf.pruefung?.passt, false);
		assert.ok(b?.entwurf.pruefung?.meldungen.every((m) => m.stufe === 'FEHLER' && m.text.includes('Seite')));
		assert.deepEqual((await leseMeta(materialDir, mappe.id, id)).entwuerfe, [a?.entwurf, b?.entwurf]);
		assert.deepEqual((await readdir(path.join(dir, 'entwuerfe'))).sort(), [
			'A-s1.png',
			'A.html',
			'B-s1.png',
			'B.html',
		]);
		assert.deepEqual(
			(await readdir(dir)).filter((n) => n.startsWith('.')),
			[],
			'keine Temp-Dateien',
		);

		await waehleEntwurf(materialDir, ziel, 'A');
		assert.ok(existsSync(path.join(dir, 'entwuerfe', 'B-s1.png')), 'Entwürfe bleiben zum Nachsehen');
		assert.ok(!existsSync(dateien[0] ?? ''));
	});
});

describe('pruefeFassung (mit blatt.py)', () => {
	it(
		'prüft eine Fassung, ohne etwas im Dokumentordner zu hinterlassen',
		{ skip: browserFehlt() && BROWSER_HINWEIS },
		async () => {
			const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-fassung-'));
			const { mappe } = await neueMappe(materialDir, { titel: 'Prüfen', fach: 'mathematik', klasse: 2 });
			const { id } = await neuesDokument(materialDir, mappe.id, {
				titel: 'Blatt',
				art: 'arbeitsblatt',
				format: 'a4-hoch',
				druckprofil: 'farbe',
				druckhinweise: [],
			});
			const dir = dokumentDir(materialDir, mappe.id, id);
			const html = await readFile(path.join(ASSETS, 'beispiel-zehner-einer-kl2.html'), 'utf8');
			const vorher = await readFile(path.join(dir, 'material.html'), 'utf8');
			const bericht = await pruefeFassung({ pythonBin: 'python3' }, dir, html);
			assert.equal(typeof bericht.fehler, 'number');
			assert.ok(bericht.seiten.length > 0);
			assert.equal(existsSync(path.join(dir, KI_PRUEFDATEI)), false);
			assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), vorher);
			// Gegenprobe: Eine Fassung, die blatt.py nicht lesen kann, meldet einen Fehler, und aufgeräumt wird trotzdem
			await assert.rejects(
				pruefeFassung({ pythonBin: 'python3' }, dir, '<link rel="stylesheet" href="fehlt.css">'),
				/blatt\.py/,
			);
			assert.equal(existsSync(path.join(dir, KI_PRUEFDATEI)), false);
		},
	);
});

describe('ohneDoppelKontrast (249)', () => {
	it('lässt den HINWEIS kontrast-sw nur auf Seiten mit kontrast-sw-schau weg', () => {
		const m = (stufe: Meldung['stufe'], seite: number, code: Meldung['code']): Meldung => ({
			stufe,
			seite,
			text: `${code ?? ''} S. ${seite}`,
			code,
		});
		const meldungen = [
			m('HINWEIS', 1, 'kontrast-sw'),
			m('WARNUNG', 1, 'kontrast-sw-schau'),
			m('HINWEIS', 1, 'farbwort-sw'),
			m('HINWEIS', 2, 'kontrast-sw'),
		];
		assert.deepEqual(
			ohneDoppelKontrast(meldungen).map((x) => x.text),
			['kontrast-sw-schau S. 1', 'farbwort-sw S. 1', 'kontrast-sw S. 2'],
		);
	});
});

const MITTE_PY =
	'import sys\nfrom PIL import Image\nim = Image.open(sys.argv[1]).convert("RGB")\nprint(*im.getpixel((im.width // 2, im.height // 2)))';

describe('baueAnsichtAus mit ausgeblendeter Seite (257)', () => {
	it(
		'baut, und jeder Ausschnitt zeigt die Aufgabe seiner Seite',
		{ skip: browserFehlt() && BROWSER_HINWEIS },
		async (t) => {
			// Wie Kap. 6 der Produktion (2026-11-19): eine ganze Seite nur-loesung zwischen zwei Seiten der Kinder
			const vorlage = await readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
			const seite = (klasse: string, farbe: string) =>
				`<section class="${klasse}" data-dicht-ok><div class="aufgabe"><span class="nr">1</span>` +
				'<div class="anw"><span class="text">Male.</span></div>' +
				`<div class="koerper"><div style="height:300px;background:${farbe}"></div></div></div></section>`;
			const html = [
				vorlage.slice(0, vorlage.indexOf('<section')),
				seite('seite', '#ff0000'),
				seite('seite nur-loesung', '#00ff00'),
				seite('seite', '#0000ff'),
				'</body></html>',
			].join('');
			const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-257-'));
			const quelle = path.join(dir, 'material.html');
			await writeFile(quelle, html);
			const ziel = path.join(dir, 'ansicht');
			t.after(() => rm(dir, { recursive: true, force: true }));

			const { bericht, bilder } = await baueAnsichtAus({ pythonBin: 'python3' }, quelle, ziel, { sw: false });
			assert.equal(bericht.seiten.length, 3);
			assert.deepEqual(
				bilder.filter((b) => !b.startsWith('loesung-')),
				['seite-1.png', 'seite-1-aufgabe-1.png', 'seite-3.png', 'seite-3-aufgabe-1.png'],
				'zwei Seiten im PDF der Kinder, Bilder und Ausschnitte unter der Nummer ihrer Seite im HTML (256)',
			);
			assert.deepEqual(
				bilder.filter((b) => b.startsWith('loesung-')),
				['loesung-seite-1.png', 'loesung-seite-2.png', 'loesung-seite-3.png'],
				'die Lösung zeigt alle drei Seiten, dieselben Nummern',
			);
			const mitte = async (datei: string) =>
				(await promisify(execFile)('python3', ['-c', MITTE_PY, path.join(ziel, datei)])).stdout.trim();
			assert.equal(await mitte('seite-1-aufgabe-1.png'), '255 0 0');
			assert.equal(await mitte('seite-3-aufgabe-1.png'), '0 0 255', 'Bild der dritten Seite, nicht der zweiten');
		},
	);
});
