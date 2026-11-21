import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { dokumentDir, mappenDir, neueMappe, neuesDokument } from './ablage';
import { SchoolboxFehler } from './fehler';
import type { BibliotheksFigur } from './figuren';
import { NAME_VERGEBEN } from './figuren';
import {
	benenneFigur,
	entfernePose,
	figurenDir,
	leseBibliothek,
	nimmPoseAuf,
	posenQuellen,
	quittiereVermerk,
	setzeEntferntesEin,
} from './figurenbibliothek';
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
	const hash = async (d: string) =>
		createHash('sha256')
			.update(await readFile(d))
			.digest('hex');
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
		assert.deepEqual(await leseJson(materialDir), { version: 1, figuren: [], einheitenUebernommen: true });
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

describe('Figurenbibliothek: Figuren aus Einheiten, einmal (253)', () => {
	const KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\tart\tbefund\tinhalt';
	const zeile = (datei: string, motiv: string, art = 'freigestellt') =>
		[datei, 'openai', 'gpt-image', '2026-11-18', motiv, art, '', ''].join('\t');

	/** Eine Einheit wie die zur Achsensymmetrie: Luna ohne Grundpose, Varianten von „faltet“, Ella mit Glöckchen. */
	const einheit = async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		await mkdir(figurenDir(materialDir));
		await png(figurenDir(materialDir), 'fridolin.png', 40, 40, 0.5, '#904010');
		const alt = { id: 'fridolin', name: 'Fridolin', posen: [{ datei: 'fridolin.png', herkunft: 'canva' }] };
		await writeFile(json(materialDir), JSON.stringify({ version: 1, figuren: [alt] }));
		const { mappe: m } = await neueMappe(
			materialDir,
			{ titel: 'Spiegelwerkstatt', fach: 'mathematik', klasse: 2 },
			JETZT,
		);
		const bilder = path.join(mappenDir(materialDir, m.id), 'bilder');
		const farben: Record<string, string> = {
			'luna-zeigt.png': '#305080',
			'luna-jubelt.png': '#305081',
			'luna-faltet.png': '#305082',
			'luna-faltet-2.png': '#305083',
			'luna-faltet-3.png': '#305084',
			'ella.png': '#a06020',
			'fridolin.png': '#c05010',
			'hanne.png': '#e0e0f0',
		};
		for (const [datei, farbe] of Object.entries(farben)) {
			await png(bilder, datei, 40, 40, 0.5, farbe);
		}
		await png(bilder, 'folie-1.jpg', 40, 30, -1, '#ffffff');
		const tsv = [
			KOPF,
			zeile('luna-zeigt.png', 'Pose Luna zeigt zur Seite'),
			zeile('luna-jubelt.png', 'Pose Luna jubelt'),
			zeile('luna-faltet.png', 'Pose Luna faltet ein Papier'),
			zeile('luna-faltet-2.png', 'Pose Luna faltet ein Papier'),
			zeile('luna-faltet-3.png', 'Pose Luna faltet ein Papier'),
			zeile('ella.png', 'Grundpose Ella: Eichhörnchen mit buschigem Schwanz und goldenem Glöckchen (Referenz)'),
			zeile('fridolin.png', 'Grundpose Fridolin: Fuchs mit blauer Postmütze'),
			zeile('hanne.png', 'Grundpose Hanne: Schneehase mit Pudelmütze'),
			zeile('hanne.png', 'Grundpose Hanne: Schneehase mit Pudelmütze', 'offen'),
			zeile('folie-1.jpg', 'Bildfolie 1: Hanne hält das goldene Glöckchen, Luna staunt'),
		];
		await writeFile(path.join(bilder, 'bilder-herkunft.tsv'), `${tsv.join('\n')}\n`);
		const blatt = async (titel: string, namen: string[], zeit: number) => {
			const dok = await neuesDokument(
				materialDir,
				m.id,
				{ titel, art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] },
				JETZT,
			);
			const datei = path.join(dokumentDir(materialDir, m.id, dok.id), 'material.html');
			await writeFile(datei, namen.map((n) => `<img src="../../bilder/${n}">`).join('\n'));
			await utimes(datei, zeit, zeit);
		};
		await blatt('Eins', ['luna-zeigt.png', 'luna-faltet-2.png', 'folie-1.jpg'], 1_000_000);
		await blatt('Zwei', ['luna-zeigt.png', 'luna-jubelt.png', 'luna-faltet-3.png', 'ella.png'], 2_000_000);
		return { materialDir, bilder };
	};

	it('übernimmt Grundposen und eingebundene Posen, mit Name, Herkunft, Steckbrief und Vermerk', async () => {
		const { bilder, materialDir } = await einheit();
		const vorher = await hashListe(bilder);
		const figuren = await leseBibliothek(KONFIG, materialDir);
		assert.deepEqual(kurz(figuren).slice(2), [
			{ id: 'ella', posen: ['ella'] },
			{ id: 'fridolin', posen: ['fridolin'] },
			{ id: 'fridolin2', posen: ['fridolin2'] },
			{ id: 'luna', posen: ['luna', 'luna-jubelt', 'luna-faltet'] },
		]);
		const je = Object.fromEntries(figuren.map((f) => [f.id, f]));
		assert.equal(je.fridolin2?.name, 'Fridolin (Fuchs)');
		assert.equal(je.fridolin?.name, 'Fridolin');
		assert.equal(je.luna?.aus, 'Spiegelwerkstatt');
		assert.equal(je.ella?.vermerk, 'Grundpose trägt einen Gegenstand der Handlung, prüfen.');
		assert.equal(je.ella?.steckbrief, 'Eichhörnchen mit buschigem Schwanz');
		assert.equal(je.fridolin2?.vermerk, undefined);
		assert.ok(!je.hanne, 'Hanne ist offen');

		const gleich = async (bibliothek: string, quelle: string) =>
			assert.ok((await readFile(path.join(figurenDir(materialDir), bibliothek))).equals(await readFile(quelle)));
		await gleich('luna.png', path.join(bilder, 'luna-zeigt.png'));
		await gleich('luna-faltet.png', path.join(bilder, 'luna-faltet-3.png'));
		const gespeichert = await leseJson(materialDir);
		assert.equal((gespeichert as Gespeichert & { einheitenUebernommen?: boolean }).einheitenUebernommen, true);
		const luna = gespeichert.figuren.find((f) => f.id === 'luna');
		assert.match(String(luna?.posen[0]?.herkunft), /\/bilder\/luna-zeigt\.png$/);
		assert.deepEqual(await hashListe(bilder), vorher, 'nur Kopien');
	});

	it('271: schreibt die Quelle der Pose mit; posenQuellen liest sie, ältere Posen über ihre Herkunft', async () => {
		const { bilder, materialDir } = await einheit();
		await leseBibliothek(KONFIG, materialDir);
		const gespeichert = await leseJson(materialDir);
		const luna = gespeichert.figuren.find((f) => f.id === 'luna');
		assert.equal(luna?.posen[0]?.quelle, 'openai');
		assert.equal(luna?.posen[0]?.modell, 'gpt-image');
		// Eine Pose von vor 271: nur die Herkunft, keine Quelle.
		const alt = {
			datei: luna?.posen[1]?.datei,
			herkunft: path.relative(materialDir, path.join(bilder, 'luna-jubelt.png')),
		};
		const ohne = { datei: 'ella.png', herkunft: 'mappe-fehlt/bilder/ella.png' };
		const figuren = gespeichert.figuren.map((f) => {
			if (f.id === 'luna') {
				return { ...f, posen: [f.posen[0], alt, ...f.posen.slice(2)] };
			}
			return f.id === 'ella' ? { ...f, posen: [ohne] } : f;
		});
		await writeFile(json(materialDir), JSON.stringify({ ...gespeichert, figuren }));
		const q = await posenQuellen(materialDir);
		assert.deepEqual(q.get('luna'), { quelle: 'openai', modell: 'gpt-image' });
		assert.deepEqual(q.get('luna-jubelt'), { quelle: 'openai', modell: 'gpt-image' });
		assert.deepEqual(q.get('fridolin'), { quelle: 'canva' });
		assert.deepEqual(q.get('willi'), { quelle: 'canva' });
		assert.equal(q.get('ella'), null);
	});

	it('ein zweiter Start übernimmt nichts doppelt', async () => {
		const { materialDir } = await einheit();
		await leseBibliothek(KONFIG, materialDir);
		const inhalt = await readFile(json(materialDir));
		const dateien = await readdir(figurenDir(materialDir));
		// Ein neuer Prozess sieht nur den Merker: hier ein neuer Pfad für denselben Ordner.
		const kopie = `${materialDir}-neu`;
		await cp(materialDir, kopie, { recursive: true });
		await leseBibliothek(KONFIG, kopie);
		assert.ok((await readFile(json(kopie))).equals(inhalt));
		assert.deepEqual((await readdir(figurenDir(kopie))).sort(), dateien.sort());
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

describe('nimmPoseAuf mit Bildern der Bild-API (237)', () => {
	it('legt eine neue Figur mit Herkunft openai und ohne canva an; eine weitere Pose ebenso', async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		const quelle = path.join(materialDir, 'quelle');
		const bild = await png(quelle, 'bild.png', 40, 40, 0.5, '#4060a0');
		const grund = await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'igel',
			name: 'Igel',
			herkunft: 'openai',
			steckbrief: 'kleiner brauner Igel mit gelbem Halstuch',
		});
		assert.deepEqual(grund, { id: 'igel', schluessel: '_figuren/igel.png', strich: false });
		const weitere = await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'igel',
			wort: 'lupe',
			herkunft: 'openai',
		});
		assert.equal(weitere.id, 'igel-lupe');
		assert.equal(weitere.canva, undefined);
		const igel = (await leseJson(materialDir)).figuren.find((f) => f.id === 'igel');
		assert.equal(igel?.canva, undefined, 'keine Canva-Referenz');
		assert.equal(igel?.steckbrief, 'kleiner brauner Igel mit gelbem Halstuch');
		assert.deepEqual(igel?.posen, [
			{ datei: 'igel.png', herkunft: 'openai' },
			{ datei: 'igel-lupe.png', herkunft: 'openai' },
		]);
		const gelesen = (await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'igel');
		assert.equal(gelesen?.canva, undefined);
		assert.deepEqual(
			gelesen?.posen.map((p) => p.id),
			['igel', 'igel-lupe'],
		);
	});
});

describe('Canva-Referenz, Steckbrief und entfernePose (176)', () => {
	/** Eine Bibliothek unter `/tmp` mit Kiki (Grundpose und „winkt“), ohne Steckbrief und ohne Referenz. */
	const mitKiki = async () => {
		const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-figuren-'));
		const quelle = path.join(materialDir, 'quelle');
		const bild = await png(quelle, 'bild.png', 40, 40, 0.5, '#e08020');
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', name: 'Kiki' });
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'winkt' });
		return { materialDir, bild };
	};
	const kiki = async (materialDir: string) => (await leseJson(materialDir)).figuren.find((f) => f.id === 'kiki');

	it('die erste Canva-Pose gibt einer Figur ohne Referenz ihre Media-ID, die zweite nur sich selbst', async () => {
		const { bild, materialDir } = await mitKiki();
		assert.equal((await kiki(materialDir))?.canva, undefined);

		await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'kiki',
			wort: 'lupe',
			herkunft: 'canva',
			canva: 'MAeins',
			steckbrief: 'orange Kugel mit zwei Augen',
		});
		await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'kiki',
			wort: 'buch',
			herkunft: 'canva',
			canva: 'MAzwei',
			steckbrief: 'ganz anders',
		});
		const jetzt = await kiki(materialDir);
		assert.equal(jetzt?.canva, 'MAeins');
		assert.equal(jetzt?.steckbrief, 'orange Kugel mit zwei Augen');
		assert.deepEqual(jetzt?.posen.slice(2), [
			{ datei: 'kiki-lupe.png', herkunft: 'canva', canva: 'MAeins' },
			{ datei: 'kiki-buch.png', herkunft: 'canva', canva: 'MAzwei' },
		]);
		const figur = (await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'kiki');
		assert.equal(figur?.canva, 'MAeins');
		assert.equal(figur?.posen.find((p) => p.id === 'kiki-buch')?.canva, 'MAzwei');

		// Gegenprobe zu `eingebaut`: Willi bekommt in figuren.json weder Referenz noch Steckbrief.
		await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'willi',
			wort: 'lupe',
			herkunft: 'canva',
			canva: 'MAdrei',
			steckbrief: 'ein anderer Waschbär',
		});
		const willi = (await leseJson(materialDir)).figuren.find((f) => f.id === 'willi');
		assert.deepEqual(willi, {
			id: 'willi',
			posen: [{ datei: 'willi-lupe.png', herkunft: 'canva', canva: 'MAdrei' }],
		});
	});

	it('entfernt eine Pose aus figuren.json, die Datei bleibt; die Grundpose nimmt die Figur mit', async () => {
		const { materialDir } = await mitKiki();
		assert.ok(await entfernePose(KONFIG, materialDir, 'kiki-winkt'));
		assert.deepEqual(kurz(await leseBibliothek(KONFIG, materialDir)), [
			{ id: 'willi', posen: ['willi mit Strich'] },
			{ id: 'wilma', posen: ['wilma'] },
			{ id: 'kiki', posen: ['kiki'] },
		]);
		assert.ok(existsSync(path.join(figurenDir(materialDir), 'kiki-winkt.png')), 'die Datei bleibt liegen');

		assert.ok(await entfernePose(KONFIG, materialDir, 'kiki'));
		assert.deepEqual(
			(await leseBibliothek(KONFIG, materialDir)).map((f) => f.id),
			['willi', 'wilma'],
		);
		assert.ok(existsSync(path.join(figurenDir(materialDir), 'kiki.png')));
		assert.equal(await entfernePose(KONFIG, materialDir, 'kiki'), null, 'nicht mehr da');
		assert.equal(await entfernePose(KONFIG, materialDir, 'gibtsnicht'), null);
	});

	it('199-03: Rückgängig setzt eine entfernte Pose und eine entfernte Figur samt Posen wieder ein', async () => {
		const { bild, materialDir } = await mitKiki();
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'lupe', canva: 'MAeins' });
		const davor = kurz(await leseBibliothek(KONFIG, materialDir));
		const pose = await entfernePose(KONFIG, materialDir, 'kiki-lupe');
		assert.equal((await kiki(materialDir))?.canva, undefined);
		assert.equal(await setzeEntferntesEin(KONFIG, materialDir, pose), true);
		assert.deepEqual(kurz(await leseBibliothek(KONFIG, materialDir)), davor);
		assert.equal((await kiki(materialDir))?.canva, 'MAeins', 'die Referenz kommt mit');

		const figur = await entfernePose(KONFIG, materialDir, 'kiki');
		assert.deepEqual(
			(await leseBibliothek(KONFIG, materialDir)).map((f) => f.id),
			['willi', 'wilma'],
		);
		assert.equal(await setzeEntferntesEin(KONFIG, materialDir, figur), true);
		assert.deepEqual(kurz(await leseBibliothek(KONFIG, materialDir)), davor, 'mit allen Posen');
		assert.equal(await setzeEntferntesEin(KONFIG, materialDir, figur), true, 'zweimal schadet nicht');
		assert.deepEqual(kurz(await leseBibliothek(KONFIG, materialDir)), davor);
		assert.equal(await setzeEntferntesEin(KONFIG, materialDir, { art: 'figur', eintrag: { id: 'willi' } }), false);
	});

	it('199: benennt eine Figur um; Willi und Wilma behalten ihre Namen', async () => {
		const { materialDir } = await mitKiki();
		assert.equal(await benenneFigur(KONFIG, materialDir, 'kiki', '  Kiki   die Katze '), true);
		assert.equal((await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'kiki')?.name, 'Kiki die Katze');
		assert.equal(await benenneFigur(KONFIG, materialDir, 'gibtsnicht', 'X'), false);
		await assert.rejects(benenneFigur(KONFIG, materialDir, 'willi', 'Bert'), SchoolboxFehler);
		await assert.rejects(benenneFigur(KONFIG, materialDir, 'kiki', '   '), SchoolboxFehler);
	});

	it('253: „Geprüft“ entfernt den Vermerk, sonst bleibt die Figur gleich', async () => {
		const { bild, materialDir } = await mitKiki();
		await nimmPoseAuf(KONFIG, materialDir, {
			datei: bild,
			figur: 'momo',
			name: 'Momo',
			aus: 'Herbst',
			vermerk: 'Prüfen',
		});
		const momo = async () => (await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'momo');
		assert.equal((await momo())?.vermerk, 'Prüfen');
		assert.equal(await quittiereVermerk(KONFIG, materialDir, 'momo'), true);
		assert.equal((await momo())?.vermerk, undefined);
		assert.equal((await momo())?.aus, 'Herbst');
		assert.equal(await quittiereVermerk(KONFIG, materialDir, 'gibtsnicht'), false);
	});

	it('199-N01: lehnt einen Namen ab, den schon eine Figur trägt, ohne Groß/klein und Leerzeichen', async () => {
		const { bild, materialDir } = await mitKiki();
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'momo', name: 'Momo Maus' });
		for (const name of ['Willi', 'wilma', ' WILLI ', 'momomaus', 'Momo  Maus']) {
			await assert.rejects(benenneFigur(KONFIG, materialDir, 'kiki', name), { message: NAME_VERGEBEN }, name);
		}
		assert.equal((await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'kiki')?.name, 'Kiki');
		assert.equal(await benenneFigur(KONFIG, materialDir, 'kiki', 'KIKI'), true, 'der eigene Name zählt nicht');
	});

	it('199-22: Posen stehen nach Entstehung, nicht nach Kennung', async () => {
		const { bild, materialDir } = await mitKiki();
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'lupe' });
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'buch' });
		const posen = (await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'kiki')?.posen.map((p) => p.id);
		assert.deepEqual(posen, ['kiki', 'kiki-winkt', 'kiki-lupe', 'kiki-buch']);
	});

	it('trug die Pose die Referenz der Figur, ist sie weg; sonst bleibt sie', async () => {
		const { bild, materialDir } = await mitKiki();
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'lupe', canva: 'MAeins' });
		await nimmPoseAuf(KONFIG, materialDir, { datei: bild, figur: 'kiki', wort: 'buch', canva: 'MAzwei' });

		await entfernePose(KONFIG, materialDir, 'kiki-buch');
		assert.equal((await kiki(materialDir))?.canva, 'MAeins', 'Gegenprobe: eine andere Pose nimmt sie nicht mit');
		await entfernePose(KONFIG, materialDir, 'kiki-lupe');
		assert.equal((await kiki(materialDir))?.canva, undefined);
		assert.equal((await leseBibliothek(KONFIG, materialDir)).find((f) => f.id === 'kiki')?.canva, undefined);
	});

	it('die Grundposen von Willi und Wilma werfen, und die Bibliothek bleibt gleich', async () => {
		const { materialDir } = await mitKiki();
		const davor = await readFile(json(materialDir));
		await assert.rejects(entfernePose(KONFIG, materialDir, 'willi'), SchoolboxFehler);
		await assert.rejects(entfernePose(KONFIG, materialDir, 'wilma'), SchoolboxFehler);
		assert.ok((await readFile(json(materialDir))).equals(davor));
		assert.deepEqual(
			(await leseBibliothek(KONFIG, materialDir)).map((f) => f.id),
			['willi', 'wilma', 'kiki'],
		);
	});
});
