import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dokumentDir, dupliziereMappe, leseMappenEintrag, neueMappe, neuesDokument, sammleMappen } from './ablage';
import { baueVorschau, VORSCHAU_DATEI } from './bauen';
import { SchoolboxFehler } from './fehler';
import { entferneFreigabenVon, legeFreigabeAn, leseFreigaben } from './freigaben';
import {
	idsImPapierkorb,
	leerePapierkorb,
	legeInPapierkorb,
	lesePapierkorbName,
	listePapierkorb,
	PAPIERKORB,
	PAPIERKORB_TAGE,
	stelleWiederHer,
} from './papierkorb';
import { listeVersionen } from './versionen';

const JETZT = new Date('2026-10-08T08:15:03.250Z');
const TAG_MS = 24 * 60 * 60 * 1000;
const inTagen = (tage: number) => new Date(JETZT.getTime() + tage * TAG_MS);

const ablage = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-papierkorb-'));
	const { mappe } = await neueMappe(materialDir, { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 }, JETZT);
	const angaben = { titel: 'Blatt', art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'sw' } as const;
	const { id } = await neuesDokument(materialDir, mappe.id, { ...angaben, druckhinweise: ['Doppelseitig'] }, JETZT);
	return { materialDir, mappe: mappe.id, dok: id, dir: dokumentDir(materialDir, mappe.id, id) };
};

describe('Papierkorb', () => {
	it('löschen verschiebt die Mappe mit Löschdatum, wiederherstellen bringt sie unverändert zurück', async () => {
		const { dir, mappe, materialDir } = await ablage();
		const vorher = await readFile(path.join(dir, 'material.html'), 'utf8');
		const eintrag = await legeInPapierkorb(materialDir, mappe, JETZT);
		assert.equal(eintrag.eintrag, `2026-10-08T08-15-03Z_${mappe}`);
		assert.deepEqual(lesePapierkorbName(eintrag.eintrag), {
			id: mappe,
			geloescht: new Date('2026-10-08T08:15:03Z'),
		});
		assert.equal(eintrag.bis, '2026-11-07T08:15:03.000Z');
		assert.equal(eintrag.mappe?.titel, 'Kartoffeln');
		assert.equal(existsSync(path.join(materialDir, mappe)), false);
		assert.deepEqual((await sammleMappen(materialDir)).mappen, []);
		assert.deepEqual(
			(await listePapierkorb(materialDir)).map((e) => e.eintrag),
			[eintrag.eintrag],
		);

		assert.equal((await stelleWiederHer(materialDir, eintrag.eintrag)).id, mappe);
		assert.equal(await readFile(path.join(dir, 'material.html'), 'utf8'), vorher);
		assert.equal((await sammleMappen(materialDir)).mappen.length, 1);
		assert.deepEqual(await listePapierkorb(materialDir), []);
	});

	it('lehnt Unbekanntes ab und überschreibt beim Wiederherstellen nichts', async () => {
		const { mappe, materialDir } = await ablage();
		await assert.rejects(legeInPapierkorb(materialDir, 'gibt-es-nicht'), /gibt es nicht/);
		await assert.rejects(legeInPapierkorb(materialDir, '../etwas'), /gibt es nicht/);
		await assert.rejects(stelleWiederHer(materialDir, `2026-10-08T08-15-03Z_${mappe}`), /nicht mehr im Papierkorb/);
		await assert.rejects(stelleWiederHer(materialDir, '../../etc'), /nicht mehr im Papierkorb/);

		const { eintrag } = await legeInPapierkorb(materialDir, mappe, JETZT);
		await mkdir(path.join(materialDir, mappe));
		await assert.rejects(stelleWiederHer(materialDir, eintrag), /Es gibt schon eine Mappe/);
		assert.equal((await listePapierkorb(materialDir)).length, 1);
	});

	it('neue Mappen bekommen keine ID, die im Papierkorb liegt', async () => {
		const { mappe, materialDir } = await ablage();
		await legeInPapierkorb(materialDir, mappe, JETZT);
		assert.deepEqual([...idsImPapierkorb(materialDir)], [mappe]);
		const angaben = { titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 } as const;
		const { mappe: neu } = await neueMappe(materialDir, angaben, JETZT);
		assert.equal(neu.id, `${mappe}-2`);
	});

	it('löscht nach 30 Tagen endgültig, vorher nicht (simulierte Zeit)', async () => {
		const { mappe, materialDir } = await ablage();
		const { mappe: zweite } = await neueMappe(
			materialDir,
			{ titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 },
			JETZT,
		);
		await legeInPapierkorb(materialDir, mappe, JETZT);
		await legeInPapierkorb(materialDir, zweite.id, inTagen(10));
		await writeFile(path.join(materialDir, PAPIERKORB, 'notiz.txt'), 'gehört nicht dazu');

		assert.deepEqual(await leerePapierkorb(materialDir, inTagen(PAPIERKORB_TAGE - 1)), []);
		assert.equal((await listePapierkorb(materialDir)).length, 2);

		assert.deepEqual(await leerePapierkorb(materialDir, inTagen(PAPIERKORB_TAGE)), [mappe]);
		assert.deepEqual(
			(await listePapierkorb(materialDir)).map((e) => e.id),
			[zweite.id],
		);

		assert.deepEqual(await leerePapierkorb(materialDir, inTagen(PAPIERKORB_TAGE + 10)), [zweite.id]);
		assert.deepEqual(await readdir(path.join(materialDir, PAPIERKORB)), ['notiz.txt']);
	});

	it('eine Vorschau, die erst nach dem Löschen fertig wird, legt den Ordner der Mappe nicht wieder an', async () => {
		const { dir, mappe, materialDir } = await ablage();
		// Ersatz für blatt.py: „baut“ die Vorschau, währenddessen verschwindet die Mappe (wie beim Löschen)
		const bauer = path.join(await mkdtemp(path.join(tmpdir(), 'schoolbox-bauer-')), 'bauer.sh');
		const skript = `#!/bin/sh\nrm -rf "${path.join(materialDir, mappe)}"\n: > "$5/${VORSCHAU_DATEI}"\n`;
		await writeFile(bauer, skript, { mode: 0o755 });
		await assert.rejects(baueVorschau({ pythonBin: bauer }, dir), /gibt es nicht mehr/);
		assert.equal(existsSync(path.join(materialDir, mappe)), false);
	});

	it('entfernt die Teilen-Links endgültig gelöschter Mappen, die anderen bleiben', async () => {
		const { dok, mappe, materialDir } = await ablage();
		const { mappe: zweite } = await neueMappe(
			materialDir,
			{ titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 },
			JETZT,
		);
		await legeFreigabeAn(materialDir, { mappe, dok: null });
		await legeFreigabeAn(materialDir, { mappe, dok });
		const bleibt = await legeFreigabeAn(materialDir, { mappe: zweite.id, dok: null });
		assert.equal(await entferneFreigabenVon(materialDir, [mappe]), 2);
		assert.deepEqual(await leseFreigaben(materialDir), [bleibt]);
		assert.equal(await entferneFreigabenVon(materialDir, [mappe]), 0);
	});
});

describe('dupliziereMappe', () => {
	it('kopiert alles außer Versionen und Ausgaben, mit neuem Titel und neuer ID', async () => {
		const { dir, dok, mappe, materialDir } = await ablage();
		await writeFile(path.join(materialDir, mappe, 'bilder', 'knolle.png'), 'Bild der Mappe');
		await writeFile(path.join(dir, 'bilder', 'keim.png'), 'Bild des Dokuments');
		await writeFile(path.join(dir, 'ausgabe', 'material.pdf'), 'PDF');
		await writeFile(path.join(dir, 'material.html'), '<body class="kl3 sw"><p>Geändert</p></body>');
		await legeFreigabeAn(materialDir, { mappe, dok: null });

		const spaeter = inTagen(3);
		const kopie = await dupliziereMappe(materialDir, mappe, spaeter);
		assert.equal(kopie.titel, 'Kartoffeln (Kopie)');
		assert.equal(kopie.id, '2026-10-11-kartoffeln-kopie-su-kl3');
		assert.equal(kopie.erstellt, spaeter.toISOString());
		assert.deepEqual(kopie.dokumente, [dok]);

		const neu = dokumentDir(materialDir, kopie.id, dok);
		assert.equal(
			await readFile(path.join(neu, 'material.html'), 'utf8'),
			'<body class="kl3 sw"><p>Geändert</p></body>',
		);
		assert.equal(await readFile(path.join(neu, 'bilder', 'keim.png'), 'utf8'), 'Bild des Dokuments');
		assert.equal(
			await readFile(path.join(materialDir, kopie.id, 'bilder', 'knolle.png'), 'utf8'),
			'Bild der Mappe',
		);
		assert.deepEqual(await readdir(path.join(neu, 'ausgabe')), []);
		const versionen = await listeVersionen(neu);
		assert.deepEqual(
			versionen.map((v) => v.urheber),
			['lehrkraft'],
		);

		const { dokumente } = await leseMappenEintrag(materialDir, kopie.id);
		assert.deepEqual(dokumente[0]?.meta.druckhinweise, ['Doppelseitig']);
		assert.equal(dokumente[0]?.meta.erstellt, spaeter.toISOString());
		assert.equal((await leseFreigaben(materialDir)).length, 1);
		assert.equal((await readdir(materialDir)).filter((n) => n.endsWith('.tmp')).length, 0);

		const nochmal = await dupliziereMappe(materialDir, mappe, spaeter);
		assert.equal(nochmal.id, '2026-10-11-kartoffeln-kopie-su-kl3-2');
		await assert.rejects(dupliziereMappe(materialDir, 'gibt-es-nicht'), SchoolboxFehler);
	});
});

describe('sammleMappen', () => {
	it('überspringt kaputte Mappen und meldet sie, statt abzubrechen', async () => {
		const { dir, mappe, materialDir } = await ablage();
		const { mappe: kaputtesJson } = await neueMappe(
			materialDir,
			{ titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 },
			JETZT,
		);
		await writeFile(path.join(materialDir, kaputtesJson.id, 'mappe.json'), '{ "id": ');
		const { mappe: falscheId } = await neueMappe(
			materialDir,
			{ titel: 'Wald', fach: 'sachunterricht', klasse: 4 },
			JETZT,
		);
		await writeFile(
			path.join(materialDir, falscheId.id, 'mappe.json'),
			JSON.stringify({ ...falscheId, id: 'anders' }),
		);

		const { defekt, mappen } = await sammleMappen(materialDir);
		assert.deepEqual(
			mappen.map((e) => e.mappe.id),
			[mappe],
		);
		assert.deepEqual(defekt.map((d) => d.id).sort(), [kaputtesJson.id, falscheId.id].sort());
		assert.ok(defekt.every((d) => !d.fehler.includes(materialDir)));
		assert.match(defekt.find((d) => d.id === falscheId.id)?.fehler ?? '', /nennt die ID „anders“/);

		await writeFile(path.join(dir, 'meta.json'), '{}');
		const danach = await sammleMappen(materialDir);
		assert.deepEqual(danach.mappen, []);
		assert.match(danach.defekt.find((d) => d.id === mappe)?.fehler ?? '', /meta\.json ist ungültig/);
	});
});
