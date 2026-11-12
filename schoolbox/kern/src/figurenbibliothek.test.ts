import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dokumentDir, mappenDir, neueMappe, neuesDokument } from './ablage';
import { SchoolboxFehler } from './fehler';
import type { BibliotheksFigur } from './figuren';
import { figurenDir, leseBibliothek, nimmPoseAuf } from './figurenbibliothek';
import { ASSETS } from './konfig';
import { legeInPapierkorb } from './papierkorb';

const KONFIG = { pythonBin: 'python3' };
const JETZT = new Date(2026, 10, 12, 9, 0);

/** Ein PNG, oben zum Anteil `anteil` durchsichtig; `anteil < 0` ohne Alphakanal. Die Farbe macht es eindeutig. */
const PNG_PY = `
import sys
from PIL import Image
datei, breite, hoehe, anteil, farbe = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
if anteil < 0:
    Image.new("RGB", (breite, hoehe), farbe).save(datei)
else:
    bild = Image.new("RGBA", (breite, hoehe), farbe)
    bild.paste((0, 0, 0, 0), (0, 0, breite, round(hoehe * anteil)))
    bild.save(datei)
`;

const png = async (ordner: string, name: string, breite: number, hoehe: number, anteil: number, farbe: string) => {
	await mkdir(ordner, { recursive: true });
	const args = [path.join(ordner, name), String(breite), String(hoehe), String(anteil), farbe];
	execFileSync('python3', ['-c', PNG_PY, ...args]);
	return path.join(ordner, name);
};

/** Pfad und SHA-256 jeder Datei unter `dir`, sortiert. */
const hashListe = async (dir: string) => {
	const eintraege = await readdir(dir, { recursive: true, withFileTypes: true });
	const dateien = eintraege.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
	const hash = async (d: string) => createHash('sha256').update(await readFile(d)).digest('hex');
	const liste = await Promise.all(dateien.map(async (d) => `${path.relative(dir, d)} ${await hash(d)}`));
	return liste.sort();
};

const kurz = (figuren: readonly BibliotheksFigur[]) =>
	figuren.map((f) => ({ id: f.id, posen: f.posen.map((p) => (p.strich ? `${p.id} mit Strich` : p.id)) }));

const json = (materialDir: string) => path.join(figurenDir(materialDir), 'figuren.json');

interface GespeicherteFigur {
	id: string;
	name?: string;
	canva?: string;
	steckbrief?: string;
	x?: number;
	posen: Record<string, unknown>[];
}

interface Gespeichert {
	version: number;
	figuren: GespeicherteFigur[];
}

const leseJson = async (materialDir: string) => JSON.parse(await readFile(json(materialDir), 'utf8')) as Gespeichert;

/**
 * Der Bestand aus Ticket 177, Test 1: Mappe A mit `bilder/`, Mappe B mit einem Dokument, eine Mappe im Papierkorb.
 * Alle Bilder entstehen hier; keine Figur aus dem Material kommt ins Repo.
 */
const bestand = async () => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
	const mappe = async (titel: string) => {
		const { mappe: m } = await neueMappe(materialDir, { titel, fach: 'sachunterricht', klasse: 3 }, JETZT);
		const dok = await neuesDokument(
			materialDir,
			m.id,
			{ titel: 'Blatt', art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] },
			JETZT,
		);
		return {
			id: m.id,
			dok: dok.id,
			dir: mappenDir(materialDir, m.id),
			bilder: path.join(mappenDir(materialDir, m.id), 'bilder'),
			dokBilder: path.join(dokumentDir(materialDir, m.id, dok.id), 'bilder'),
		};
	};
	const a = await mappe('Alpha');
	const b = await mappe('Beta');
	const papierkorb = await mappe('Gamma');

	const kobi = await png(a.bilder, 'kobi.png', 40, 40, 0.6, '#d08030');
	await png(a.bilder, 'kobi-strich.png', 80, 80, 0.5, '#202020');
	await png(a.bilder, 'kobi-winkt.png', 40, 50, 0.5, '#d08031');
	await png(a.bilder, 'willi-lupe.png', 40, 40, 0.5, '#f28c28');
	await copyFile(path.join(ASSETS, 'bilder', 'willi.png'), path.join(a.bilder, 'willi.png'));
	await png(a.bilder, 'geschenk-rot.png', 40, 40, 0.15, '#c00000');
	await png(a.bilder, 'tor.png', 40, 50, 0.22, '#008000');
	await png(a.bilder, 'ausmal.png', 40, 40, -1, '#ffffff');
	await png(a.bilder, 'apfel-strich.png', 40, 40, 0.5, '#101010');

	await mkdir(b.dokBilder, { recursive: true });
	await copyFile(kobi, path.join(b.dokBilder, 'kobi.png'));
	// Passt zu `kobi-winkt.png` aus A (40 × 50), nicht zum anderen `kobi-winkt.png` hier (50 × 40).
	await png(b.dokBilder, 'kobi-winkt-strich.png', 80, 100, 0.5, '#202021');
	await png(b.dokBilder, 'ebbi-fliegt.png', 40, 40, 0.5, '#000080');
	await png(b.dokBilder, 'kobi-winkt.png', 50, 40, 0.5, '#d08032');

	await png(papierkorb.bilder, 'igel.png', 40, 40, 0.5, '#806040');
	await legeInPapierkorb(materialDir, papierkorb.id, JETZT);
	return { materialDir, a, b };
};

describe('Figurenbibliothek: einmalige Übernahme (177)', () => {
	it('übernimmt Figuren mit Posen und Strichfassung, nur Kopien, und nur einmal', async () => {
		const { a, b, materialDir } = await bestand();
		const vorher = [await hashListe(a.dir), await hashListe(b.dir)];

		const figuren = await leseBibliothek(KONFIG, materialDir);
		assert.deepEqual(kurz(figuren), [
			{ id: 'willi', posen: ['willi mit Strich', 'willi-lupe'] },
			{ id: 'wilma', posen: ['wilma'] },
			{ id: 'kobi', posen: ['kobi mit Strich', 'kobi-winkt mit Strich', 'kobi-winkt-2'] },
		]);
		assert.equal(figuren[2]?.name, 'Kobi');
		assert.equal(figuren[2]?.posen[0]?.schluessel, '_figuren/kobi.png');
		assert.deepEqual((await readdir(figurenDir(materialDir))).sort(), [
			'figuren.json',
			'kobi-strich.png',
			'kobi-winkt-2.png',
			'kobi-winkt-strich.png',
			'kobi-winkt.png',
			'kobi.png',
			'willi-lupe.png',
		]);
		// Die Kopien sind die Dateien aus dem Bestand: der Strich von `kobi-winkt` aus B, `kobi-winkt-2` ist das aus B.
		const gleich = async (bibliothek: string, quelle: string) =>
			assert.ok((await readFile(path.join(figurenDir(materialDir), bibliothek))).equals(await readFile(quelle)));
		await gleich('kobi-winkt-strich.png', path.join(b.dokBilder, 'kobi-winkt-strich.png'));
		await gleich('kobi-winkt-2.png', path.join(b.dokBilder, 'kobi-winkt.png'));

		const gespeichert = await leseJson(materialDir);
		const herkunft = Object.fromEntries(
			gespeichert.figuren.flatMap((f) => f.posen.map((p) => [String(p.datei), String(p.herkunft)])),
		);
		assert.deepEqual(herkunft, {
			'willi-lupe.png': `${a.id}/bilder/willi-lupe.png`,
			'kobi.png': `${a.id}/bilder/kobi.png`,
			'kobi-winkt.png': `${a.id}/bilder/kobi-winkt.png`,
			'kobi-winkt-2.png': `${b.id}/dokumente/${b.dok}/bilder/kobi-winkt.png`,
		});
		const willi = gespeichert.figuren.find((f) => f.id === 'willi');
		assert.deepEqual(Object.keys(willi ?? {}).sort(), ['id', 'posen'], 'Willi nur mit Posen');

		// Gegenprobe: Geschenk (15 %), Tor (22 %), Ausmalbild, Strich ohne Farbe, Pose ohne Grundpose, Papierkorb.
		const kennungen = figuren.flatMap((f) => [f.id, ...f.posen.map((p) => p.id)]).join(' ');
		for (const nicht of ['geschenk', 'tor', 'ausmal', 'apfel', 'ebbi', 'igel']) {
			assert.ok(!kennungen.includes(nicht), nicht);
		}

		// Einmal: Ein neues freigestelltes Motiv mit Grundpose wird nicht mehr zur Figur.
		const info = await stat(json(materialDir));
		const inhalt = await readFile(json(materialDir));
		await png(a.bilder, 'rumo.png', 40, 40, 0.6, '#a05020');
		const nochmal = await leseBibliothek(KONFIG, materialDir);
		assert.deepEqual(kurz(nochmal), kurz(figuren));
		assert.ok((await readFile(json(materialDir))).equals(inhalt));
		assert.equal((await stat(json(materialDir))).mtimeMs, info.mtimeMs);

		// Bestand: In den Mappen ändert sich keine Datei (nur rumo.png ist neu).
		const nachher = [await hashListe(a.dir), await hashListe(b.dir)];
		assert.deepEqual(
			nachher.map((l) => l.filter((z) => !z.startsWith(path.join('bilder', 'rumo.png')))),
			vorher,
		);
	});

	it('gleichzeitig gelesen, übernimmt sie einmal', async () => {
		const { materialDir } = await bestand();
		const [eins, zwei] = await Promise.all([
			leseBibliothek(KONFIG, materialDir),
			leseBibliothek(KONFIG, materialDir),
		]);
		assert.deepEqual(eins, zwei);
		assert.equal((await readdir(figurenDir(materialDir))).length, 7);
		assert.equal((await leseJson(materialDir)).figuren.length, 2);
	});

	it('leer: schreibt eine leere Bibliothek und liefert Willi und Wilma', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		assert.deepEqual(
			(await leseBibliothek(KONFIG, materialDir)).map((f) => f.id),
			['willi', 'wilma'],
		);
		assert.deepEqual(await leseJson(materialDir), { version: 1, figuren: [] });
	});

	it('kaputt: liefert Willi und Wilma, die Datei bleibt byte-gleich, und Aufnehmen scheitert', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		await mkdir(figurenDir(materialDir));
		await writeFile(json(materialDir), '{"version":1,"figuren":[');
		assert.deepEqual(
			(await leseBibliothek(KONFIG, materialDir)).map((f) => f.id),
			['willi', 'wilma'],
		);
		const quelle = await png(path.join(materialDir, 'quelle'), 'eule.png', 40, 40, 0.5, '#705030');
		const neu = { datei: quelle, figur: 'eule', name: 'Eule' };
		await assert.rejects(nimmPoseAuf(KONFIG, materialDir, neu), SchoolboxFehler);
		assert.equal(await readFile(json(materialDir), 'utf8'), '{"version":1,"figuren":[');
	});
});

describe('nimmPoseAuf (177, für 176 und 179)', () => {
	it('legt Figur und Posen an, mit Strich, Canva-Referenz und Steckbrief nach den Regeln aus 176', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		const quelle = path.join(materialDir, 'quelle');
		const eule = await png(quelle, 'eule.png', 40, 40, 0.5, '#705030');
		await png(quelle, 'eule-strich.png', 80, 80, 0.5, '#202020');
		const flug = await png(quelle, 'flug.png', 40, 50, 0.5, '#705031');

		const grund = await nimmPoseAuf(KONFIG, materialDir, {
			datei: eule,
			figur: 'eule',
			name: 'Eule',
			herkunft: 'canva',
			canva: 'A',
			steckbrief: 'braune Eule mit Brille',
		});
		assert.deepEqual(grund, { id: 'eule', schluessel: '_figuren/eule.png', strich: true, canva: 'A' });
		assert.ok(existsSync(path.join(figurenDir(materialDir), 'eule-strich.png')), 'die Strichfassung kommt mit');

		// Ein fremdes Feld an Figur und Pose bleibt beim nächsten Schreiben erhalten.
		const mitFremdem = await leseJson(materialDir);
		const eintrag = mitFremdem.figuren.find((f) => f.id === 'eule');
		const erste = eintrag?.posen[0];
		assert.ok(eintrag && erste);
		eintrag.x = 1;
		erste.x = 1;
		await writeFile(json(materialDir), JSON.stringify(mitFremdem));

		const zweite = { datei: flug, figur: 'eule', wort: 'fliegt', canva: 'B', steckbrief: 'graue Eule' };
		assert.equal((await nimmPoseAuf(KONFIG, materialDir, zweite)).id, 'eule-fliegt');
		assert.equal((await nimmPoseAuf(KONFIG, materialDir, zweite)).id, 'eule-fliegt-2');
		const lupe = await nimmPoseAuf(KONFIG, materialDir, {
			datei: flug,
			figur: 'willi',
			wort: 'lupe',
			canva: 'C',
			steckbrief: 'anders',
		});
		assert.deepEqual(lupe, { id: 'willi-lupe', schluessel: '_figuren/willi-lupe.png', strich: false, canva: 'C' });

		const gespeichert = await leseJson(materialDir);
		const euleJetzt = gespeichert.figuren.find((f) => f.id === 'eule');
		assert.equal(euleJetzt?.name, 'Eule');
		assert.equal(euleJetzt?.canva, 'A', 'die erste Canva-Referenz bleibt');
		assert.equal(euleJetzt?.steckbrief, 'braune Eule mit Brille', 'der erste Steckbrief bleibt');
		assert.equal(euleJetzt?.x, 1);
		assert.deepEqual(euleJetzt?.posen, [
			{ datei: 'eule.png', herkunft: 'canva', canva: 'A', x: 1 },
			{ datei: 'eule-fliegt.png', canva: 'B' },
			{ datei: 'eule-fliegt-2.png', canva: 'B' },
		]);
		const willi = gespeichert.figuren.find((f) => f.id === 'willi');
		assert.deepEqual(willi, { id: 'willi', posen: [{ datei: 'willi-lupe.png', canva: 'C' }] });
		assert.deepEqual(kurz(await leseBibliothek(KONFIG, materialDir)), [
			{ id: 'willi', posen: ['willi mit Strich', 'willi-lupe'] },
			{ id: 'wilma', posen: ['wilma'] },
			{ id: 'eule', posen: ['eule mit Strich', 'eule-fliegt', 'eule-fliegt-2'] },
		]);

		// Gegenprobe: Eine neue Figur ohne Namen gibt es nicht, und figuren.json bleibt byte-gleich.
		const davor = await readFile(json(materialDir));
		await assert.rejects(nimmPoseAuf(KONFIG, materialDir, { datei: flug, figur: 'zebra' }), SchoolboxFehler);
		assert.ok((await readFile(json(materialDir))).equals(davor));
		assert.ok(!existsSync(path.join(figurenDir(materialDir), 'zebra.png')));
	});
});
