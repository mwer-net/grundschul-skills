import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dokumentDir, leseMappe, leseMeta, mappenDir } from './ablage';
import { BLATT_PY } from './konfig';
import { HILFE_MAPPE, KURZANLEITUNG, KURZANLEITUNG_VORLAGE, richteKurzanleitungEin } from './kurzanleitung';
import { PAPIERKORB } from './papierkorb';
import { listeVersionen } from './versionen';

const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const chromiumFehlt = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

const T0 = new Date('2026-10-20T08:00:00Z');
const spaeter = (stunden: number) => new Date(T0.getTime() + stunden * 60 * 60 * 1000);

describe('richteKurzanleitungEin (mit blatt.py)', () => {
	it('legt die Hilfe-Mappe an, lässt sie in Ruhe und zieht eine geänderte Vorlage nach', async (t) => {
		if (chromiumFehlt()) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-kurzanleitung-'));
		const konfig = { materialDir, pythonBin: 'python3' };
		const vorlage = path.join(materialDir, '..', `${path.basename(materialDir)}-vorlage.html`);
		await writeFile(vorlage, await readFile(KURZANLEITUNG_VORLAGE, 'utf8'));

		const erst = await richteKurzanleitungEin(konfig, T0, vorlage);
		assert.equal(erst.stand, 'angelegt');
		assert.deepEqual(erst.fertig?.meta.pruefung, { fehler: 0, warnungen: 0, hinweise: 0 }, 'passt auf eine Seite');
		assert.equal(erst.fertig?.meta.seiten, 1);
		const mappe = await leseMappe(materialDir, HILFE_MAPPE);
		assert.deepEqual(
			[mappe.titel, mappe.fach, mappe.klasse, mappe.status],
			['Schoolbox-Hilfe', 'faecheruebergreifend', 'gemischt', 'fertig'],
		);
		assert.equal((await leseMeta(materialDir, HILFE_MAPPE, KURZANLEITUNG)).format, 'a4-hoch');

		const dir = dokumentDir(materialDir, HILFE_MAPPE, KURZANLEITUNG);
		const material = path.join(dir, 'material.html');
		const eigenes = (await readFile(material, 'utf8')).replace('so geht', 'so geht es bei mir');
		await writeFile(material, eigenes);
		assert.equal((await richteKurzanleitungEin(konfig, spaeter(1), vorlage)).stand, 'aktuell');
		assert.equal(
			await readFile(material, 'utf8'),
			eigenes,
			'eigene Änderung bleibt, solange die Vorlage gleich ist',
		);

		await writeFile(vorlage, (await readFile(vorlage, 'utf8')).replace('Leg mich', 'Leg mich bitte'));
		const danach = await richteKurzanleitungEin(konfig, spaeter(2), vorlage);
		assert.equal(danach.stand, 'aktualisiert');
		assert.match(await readFile(material, 'utf8'), /Leg mich bitte/);
		const versionen = await listeVersionen(dir);
		assert.deepEqual(
			versionen.slice(-2).map((v) => v.urheber),
			['lehrkraft', 'claude'],
		);

		await mkdir(path.join(materialDir, PAPIERKORB));
		await rename(
			mappenDir(materialDir, HILFE_MAPPE),
			path.join(materialDir, PAPIERKORB, `2026-10-20T11-00-00Z_${HILFE_MAPPE}`),
		);
		assert.equal((await richteKurzanleitungEin(konfig, spaeter(3), vorlage)).stand, 'im-papierkorb');
	});
});
