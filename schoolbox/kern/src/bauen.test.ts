import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dokumentDir, leseMeta, neueMappe, neuesDokument, registriereEntwuerfe, waehleEntwurf } from './ablage';
import { baueEntwurfsVorschauen } from './bauen';
import { ASSETS, BLATT_PY } from './konfig';

const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const chromiumFehlt = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

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
		if (chromiumFehlt()) {
			t.skip('kein Chromium für blatt.py gefunden');
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
