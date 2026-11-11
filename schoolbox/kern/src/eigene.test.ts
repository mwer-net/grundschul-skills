import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { dokumentDir, leseMappe, neueMappe, neuesDokument, sammleMappen, verfuegbareVorlagen } from './ablage';
import {
	bilderIn,
	eigeneBausteine,
	legeInSammlung,
	loescheEigenenBaustein,
	sammlungsOrdner,
	uebernimmBilder,
	wendeBilderAn,
} from './eigene';

const PNG = Buffer.from('iVBORw0KGgo=', 'base64');
const ANDERES = Buffer.from('iVBORw0KGgoA', 'base64');

describe('Sammlung (051)', () => {
	let material = '';
	let mappe = '';
	let dok = '';
	let dir = '';
	const angaben = (titel: string) =>
		({ titel, art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] }) as const;

	before(async () => {
		material = await mkdtemp(path.join(tmpdir(), 'eigene-'));
		({
			mappe: { id: mappe },
		} = await neueMappe(material, { titel: 'Eigen', fach: 'deutsch', klasse: 2 }));
		({ id: dok } = await neuesDokument(material, mappe, angaben('Quelle')));
		dir = dokumentDir(material, mappe, dok);
		await mkdir(path.join(dir, 'bilder'), { recursive: true });
		await writeFile(path.join(dir, 'bilder', 'hund.png'), PNG);
		const datei = path.join(dir, 'material.html');
		await writeFile(
			datei,
			(await readFile(datei, 'utf8')).replace('</section>', '<img src="bilder/hund.png" alt="Hund"></section>'),
		);
	});
	after(() => rm(material, { recursive: true, force: true }));

	it('Ein alter Ordner _vorlagen bleibt liegen und wird nicht gelesen (137)', async () => {
		const alt = path.join(material, '_vorlagen', 'meine');
		await mkdir(alt, { recursive: true });
		await writeFile(path.join(alt, 'vorlage.json'), '{"id":"meine","name":"Meine","art":"arbeitsblatt"}\n');
		await writeFile(path.join(alt, 'material.html'), '<!doctype html><title>Alt</title>');
		assert.ok(!verfuegbareVorlagen().some((v) => v.startsWith('eigen-')));
		await assert.rejects(
			() => neuesDokument(material, mappe, { ...angaben('Neu'), vorlage: 'eigen-meine' }),
			/gibt es nicht/,
		);
		assert.ok(existsSync(path.join(alt, 'material.html')), 'Der Ordner bleibt unangetastet');
	});

	it('Die Ordner sind keine Mappen', async () => {
		const { mappen } = await sammleMappen(material);
		assert.deepEqual(
			mappen.map((m) => m.mappe.id),
			[mappe],
		);
		assert.ok(existsSync(path.join(material, '_vorlagen')), 'Gegenprobe: Der alte Ordner liegt in der Ablage');
	});

	it('Sammlung: Baustein mit Bild liegt bei sich, löschen entfernt ihn', async () => {
		const html =
			'<div class="aufgabe"><img src="bilder/hund.png" alt="Hund"><img src="bilder/willi.png" alt="W"></div>';
		const b = await legeInSammlung(material, { mappe, dok, html, name: 'Hund-Aufgabe', ort: 'seite' });
		assert.deepEqual(
			(await eigeneBausteine(material)).map((x) => x.name),
			['Hund-Aufgabe'],
		);
		assert.ok(existsSync(path.join(sammlungsOrdner(material, b.id), 'bilder', 'hund.png')));
		assert.ok(
			!existsSync(path.join(sammlungsOrdner(material, b.id), 'bilder', 'willi.png')),
			'Assets bleiben in den Assets',
		);
		await loescheEigenenBaustein(material, b.id);
		assert.deepEqual(await eigeneBausteine(material), []);
	});

	it('Kopieren: Bild kommt mit, gleicher Name mit anderem Inhalt bekommt einen neuen, der Verweis folgt', async () => {
		const { id: ziel } = await neuesDokument(material, mappe, angaben('Ziel'));
		const zielDir = dokumentDir(material, mappe, ziel);
		const html = '<img src="bilder/hund.png" alt="Hund">';
		assert.deepEqual(await uebernimmBilder(dir, zielDir, bilderIn(html, dir)), {});
		assert.deepEqual(await readFile(path.join(zielDir, 'bilder', 'hund.png')), PNG);
		assert.deepEqual(
			await uebernimmBilder(dir, zielDir, bilderIn(html, dir)),
			{},
			'Dasselbe Bild: keine Kopie mit neuem Namen',
		);
		await writeFile(path.join(zielDir, 'bilder', 'hund.png'), ANDERES);
		const umbenannt = await uebernimmBilder(dir, zielDir, bilderIn(html, dir));
		const neu = umbenannt['bilder/hund.png'] ?? '';
		assert.ok(neu && neu !== 'bilder/hund.png');
		assert.deepEqual(await readFile(path.join(zielDir, neu)), PNG);
		assert.deepEqual(await readFile(path.join(zielDir, 'bilder', 'hund.png')), ANDERES, 'Das Bild im Ziel bleibt');
		assert.equal(wendeBilderAn(html, umbenannt), `<img src="${neu}" alt="Hund">`);
		await assert.rejects(() => uebernimmBilder(dir, zielDir, ['bilder/../../geheim.png']), /kein Bild/);
		await assert.rejects(() => uebernimmBilder(dir, zielDir, ['bilder/fehlt.png']), /gibt es nicht/);
	});

	it('Nichts davon kommt in Git: Der Ordner materialien ist ausgeschlossen', () => {
		const wurzel = path.resolve(__dirname, '..', '..', '..');
		const pruefe = (datei: string) => {
			try {
				execFileSync('git', ['check-ignore', '-q', datei], { cwd: wurzel });
				return true;
			} catch {
				return false;
			}
		};
		assert.equal(pruefe('materialien/_vorlagen/x/material.html'), true);
		assert.equal(pruefe('materialien/_sammlung/x/baustein.json'), true);
		assert.equal(pruefe('schoolbox/kern/src/eigene.ts'), false, 'Gegenprobe');
	});

	it('Reihenfolge der Mappe bleibt: Die Sammlung legt nichts in die Mappe', async () => {
		const vorher = (await leseMappe(material, mappe)).dokumente.length;
		await legeInSammlung(material, { mappe, dok, html: '<p>x</p>', name: 'Noch einer', ort: 'zeile' });
		assert.equal((await leseMappe(material, mappe)).dokumente.length, vorher);
	});
});
