import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	dokumentDir,
	leseMappe,
	leseMeta,
	listeMappen,
	neueMappe,
	neuesDokument,
	notiereWunsch,
	registriereEntwuerfe,
	waehleEntwurf,
	zerlegeZiel,
} from './ablage';
import { SchoolboxFehler } from './fehler';
import { bodyKlassen, entwurfAusTitel, titelAusHtml } from './html';
import { listeVersionen } from './versionen';

const JETZT = new Date(2026, 9, 8, 10, 15);
const ablage = () => mkdtemp(path.join(tmpdir(), 'schoolbox-ablage-'));

const kartoffeln = async (materialDir: string) => {
	const { mappe } = await neueMappe(materialDir, { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 }, JETZT);
	return mappe.id;
};

describe('neueMappe', () => {
	it('legt die Ablage nach Schema an und vergibt eindeutige IDs', async () => {
		const materialDir = await ablage();
		const { mappe, pfad } = await neueMappe(
			materialDir,
			{ titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 },
			JETZT,
		);
		assert.equal(mappe.id, '2026-10-08-kartoffeln-su-kl3');
		assert.deepEqual((await readdir(pfad)).sort(), ['bilder', 'dokumente', 'mappe.json']);
		assert.deepEqual(await leseMappe(materialDir, mappe.id), mappe);
		const zweite = await neueMappe(materialDir, { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 }, JETZT);
		assert.equal(zweite.mappe.id, '2026-10-08-kartoffeln-su-kl3-2');
	});
});

describe('neuesDokument', () => {
	it('kopiert die Vorlage, setzt Titel und body-Klassen und legt eine Version an', async () => {
		const materialDir = await ablage();
		const mappe = await kartoffeln(materialDir);
		const angaben = { art: 'arbeitsblatt', druckhinweise: ['Doppelseitig drucken'], druckprofil: 'sw' } as const;
		const { id, pfad } = await neuesDokument(materialDir, mappe, {
			...angaben,
			titel: 'Teile der Kartoffel',
			format: 'a4-quer',
			vorlage: 'arbeitsblatt',
		});
		assert.equal(id, 'teile-der-kartoffel');
		const html = await readFile(pfad, 'utf8');
		assert.equal(titelAusHtml(html), 'Teile der Kartoffel');
		assert.deepEqual(bodyKlassen(html), ['kl3', 'sw', 'a4-quer']);
		assert.ok(html.includes('class="aufgabe"'));
		const dir = dokumentDir(materialDir, mappe, id);
		assert.deepEqual((await readdir(dir)).sort(), [
			'ausgabe',
			'bilder',
			'entwuerfe',
			'material.html',
			'meta.json',
			'versionen',
		]);
		const meta = await leseMeta(materialDir, mappe, id);
		assert.equal(meta.format, 'a4-quer');
		assert.deepEqual(meta.druckhinweise, ['Doppelseitig drucken']);
		assert.equal((await listeVersionen(dir)).length, 1);
		assert.deepEqual((await leseMappe(materialDir, mappe)).dokumente, [id]);

		const zweites = await neuesDokument(materialDir, mappe, {
			...angaben,
			titel: 'Teile der Kartoffel',
			format: 'folie',
			druckprofil: 'farbe',
		});
		assert.equal(zweites.id, 'teile-der-kartoffel-2');
		assert.deepEqual(bodyKlassen(await readFile(zweites.pfad, 'utf8')), [
			'kl3',
			'farbe',
			'palette-himmel',
			'folie',
		]);
	});

	it('lehnt eine unbekannte Vorlage und eine fehlende Mappe verständlich ab', async () => {
		const materialDir = await ablage();
		const mappe = await kartoffeln(materialDir);
		const angaben = {
			titel: 'X',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		} as const;
		await assert.rejects(
			neuesDokument(materialDir, mappe, { ...angaben, vorlage: 'quiz' }),
			/Vorhanden: arbeitsblatt/,
		);
		await assert.rejects(neuesDokument(materialDir, 'gibt-es-nicht', angaben), /gibt es nicht/);
	});
});

describe('Entwürfe', () => {
	it('registriert Entwürfe mit Name und Idee und übernimmt einen als material.html', async () => {
		const materialDir = await ablage();
		const mappe = await kartoffeln(materialDir);
		const { id } = await neuesDokument(materialDir, mappe, {
			titel: 'Uhrzeit',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		});
		const quelle = await ablage();
		const dateien = [
			'A · Uhren lesen – nur Aufgaben',
			'B · Willis Tag – Geschichte als Rahmen, Uhrzeiten zuordnen',
		].map((titel, i) => path.join(quelle, `entwurf-${i}.html`));
		await writeFile(
			dateien[0] ?? '',
			'<html><head><title>A · Uhren lesen – nur Aufgaben</title></head><body class="kl3 sw">A</body></html>',
		);
		await writeFile(
			dateien[1] ?? '',
			'<html><head><title>B · Willis Tag – Geschichte als Rahmen, Uhrzeiten zuordnen</title></head><body class="kl3 sw">B</body></html>',
		);
		const ziel = { mappe, dok: id };
		const entwuerfe = await registriereEntwuerfe(materialDir, ziel, dateien);
		assert.deepEqual(entwuerfe, [
			{ name: 'A', titel: 'Uhren lesen', idee: 'nur Aufgaben' },
			{ name: 'B', titel: 'Willis Tag', idee: 'Geschichte als Rahmen, Uhrzeiten zuordnen' },
		]);
		const dir = dokumentDir(materialDir, mappe, id);
		await waehleEntwurf(materialDir, ziel, 'b');
		assert.ok((await readFile(path.join(dir, 'material.html'), 'utf8')).includes('>B</body>'));
		assert.ok(existsSync(path.join(dir, 'entwuerfe', 'A.html')));
		assert.equal((await listeVersionen(dir)).length, 1);
		await assert.rejects(waehleEntwurf(materialDir, ziel, 'C'), /Registrierte Entwürfe: A, B/);
	});

	it('verweigert einen Entwurf mit anderem Format', async () => {
		const materialDir = await ablage();
		const mappe = await kartoffeln(materialDir);
		const { id } = await neuesDokument(materialDir, mappe, {
			titel: 'Uhrzeit',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		});
		const datei = path.join(await ablage(), 'quer.html');
		await writeFile(datei, '<html><head><title>Quer</title></head><body class="kl3 sw a4-quer"></body></html>');
		const ziel = { mappe, dok: id };
		await registriereEntwuerfe(materialDir, ziel, [datei]);
		await assert.rejects(waehleEntwurf(materialDir, ziel, 'A'), /Format passt nicht/);
	});

	it('liest Titel ohne Buchstaben und ohne Idee', () => {
		assert.deepEqual(entwurfAusTitel('Kl2_Mathe_Uhrzeit_AB1'), { titel: 'Kl2_Mathe_Uhrzeit_AB1', idee: '' });
		assert.deepEqual(entwurfAusTitel('C: Forscherblatt - mit Versuch'), {
			titel: 'Forscherblatt',
			idee: 'mit Versuch',
		});
	});
});

describe('listeMappen', () => {
	it('filtert nach Fach und sucht umlaut-unabhängig in Mappen- und Dokumenttiteln', async () => {
		const materialDir = await ablage();
		const mappe = await kartoffeln(materialDir);
		await neuesDokument(materialDir, mappe, {
			titel: 'Größen der Knolle',
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			druckhinweise: [],
		});
		await neueMappe(materialDir, { titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 }, JETZT);
		await notiereWunsch(materialDir, 'Größere Schrift', JETZT);
		const ids = async (filter: Parameters<typeof listeMappen>[1]) =>
			(await listeMappen(materialDir, filter)).map((e) => e.mappe.id);
		assert.equal((await ids({})).length, 2);
		assert.deepEqual(await ids({ fach: 'sachunterricht' }), [mappe]);
		assert.deepEqual(await ids({ suche: 'groessen' }), [mappe]);
		assert.deepEqual(await ids({ suche: 'Größen Kartoffel' }), [mappe]);
		assert.deepEqual(await ids({ suche: 'Brot' }), []);
		assert.deepEqual(await listeMappen(path.join(materialDir, 'fehlt')), []);
	});
});

describe('notiereWunsch', () => {
	it('hängt Wünsche mit Datum an _wuensche.md an', async () => {
		const materialDir = await ablage();
		await notiereWunsch(materialDir, 'Mehr Platz zum Schreiben', JETZT);
		const datei = await notiereWunsch(materialDir, 'Willi\nauch auf Folien', JETZT);
		assert.equal(
			await readFile(datei, 'utf8'),
			'# Wünsche der Lehrkraft\n\n- 2026-10-08: Mehr Platz zum Schreiben\n- 2026-10-08: Willi auch auf Folien\n',
		);
		await assert.rejects(notiereWunsch(materialDir, '   '), SchoolboxFehler);
	});
});

describe('zerlegeZiel', () => {
	it('prüft IDs streng', () => {
		assert.deepEqual(zerlegeZiel('mappe-1/dok', true), { mappe: 'mappe-1', dok: 'dok' });
		assert.deepEqual(zerlegeZiel('mappe-1/', false), { mappe: 'mappe-1', dok: null });
		assert.throws(() => zerlegeZiel('mappe-1', true), /Erwartet <mappe>\/<dokument>/);
		assert.throws(() => zerlegeZiel('../passwd', true), /keine gültige ID/);
		assert.throws(() => zerlegeZiel('a/b/c', false), /ungültig/);
		assert.throws(() => zerlegeZiel('Groß/x', true), /keine gültige ID/);
	});
});

describe('CLI', () => {
	it('lehnt ungültige Werte mit Exit-Code 2 und der Liste gültiger Werte ab', async () => {
		const materialDir = await ablage();
		const cli = path.resolve(__dirname, '..', '..', 'bin', 'schoolbox');
		const lauf = () =>
			execFileSync(cli, ['neu', '--titel', 'X', '--fach', 'mathe', '--klasse', '2'], {
				encoding: 'utf8',
				env: { ...process.env, MATERIAL_DIR: materialDir },
				stdio: 'pipe',
			});
		assert.throws(lauf, (fehler: { status: number; stderr: string }) => {
			assert.equal(fehler.status, 2);
			assert.match(
				fehler.stderr,
				/Fach „mathe“ ist ungültig\. Gültige Werte: deutsch, mathematik, sachunterricht/,
			);
			return true;
		});
	});
});
