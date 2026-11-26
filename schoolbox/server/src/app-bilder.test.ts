import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';

import type { AppAntwort, AppBilderOptionen, AppFigur } from './app-bilder';
import { erstelleAppBilder } from './app-bilder';
import type { BildAnfrage } from './bild-api';
import { BILD_API_GESPERRT, BildApiFehler } from './bild-api';
import { BILD_GRENZEN } from './bild-grenzen';
import { BILD_HERKUNFT } from './bild-werkzeug';
import { laufWerkzeuge } from './werkzeug-schemas';

const block = (art: string, daten: Buffer) => {
	const laenge = Buffer.alloc(4);
	laenge.writeUInt32BE(daten.length);
	const kopf = Buffer.concat([Buffer.from(art, 'latin1'), daten]);
	const pruef = Buffer.alloc(4);
	pruef.writeUInt32BE(crc32(kopf));
	return Buffer.concat([laenge, kopf, pruef]);
};

/** Ein kleines echtes PNG (RGB, 8 Bit), je `farbe` mit anderem Inhalt. */
const png = (farbe = 0) => {
	const breite = 8;
	const hoehe = 8;
	const roh = Buffer.alloc((breite * 3 + 1) * hoehe, farbe);
	for (let y = 0; y < hoehe; y += 1) {
		roh[y * (breite * 3 + 1)] = 0;
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(breite, 0);
	ihdr.writeUInt32BE(hoehe, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		block('IHDR', ihdr),
		block('IDAT', deflateSync(roh)),
		block('IEND', Buffer.alloc(0)),
	]);
};

const SCHLUESSEL = 'sk-test-geheim-1234567890';
const MAPPE = '2026-11-26-igel-su-kl3';
const DOK = 'igel-im-herbst';
const ANDERES = 'igel-memory';

const text = (a: AppAntwort) =>
	a.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text)
		.join('\n');

describe('Bildwerkzeuge der Claude-App (280)', () => {
	let wurzel: string;
	let materialDir: string;
	let mappeDir: string;
	let draussen: string;
	let anfragen: BildAnfrage[];
	let antwortVonApi: (anfrage: BildAnfrage) => Promise<Buffer>;

	const app = (teil: Partial<AppBilderOptionen> = {}) =>
		erstelleAppBilder({
			konfig: {
				openaiSchluessel: SCHLUESSEL,
				bildModell: 'gpt-image-test',
				bildQualitaet: 'low',
				pythonBin: 'python3',
				materialDir,
				wurzel,
			},
			figuren: [],
			api: async (anfrage) => {
				anfragen.push(anfrage);
				return {
					inhalt: await antwortVonApi(anfrage),
					verbrauch: { bildToken: 0, textToken: 10, ausgabeToken: 100 },
					kostenUsd: 0.01,
					wiederholungen: 0,
				};
			},
			// Wie `blatt.py viertel`: die vier Viertel nach `ansicht/bilder/` der Mappe.
			zuschnitt: async (inhalt, wunsch) => {
				const stamm = path.basename(wunsch.datei, path.extname(wunsch.datei));
				const ziel = path.join(mappeDir, 'ansicht', 'bilder');
				await mkdir(ziel, { recursive: true });
				for (const i of [1, 2, 3, 4]) {
					await writeFile(path.join(ziel, `${stamm}-v${i}.png`), inhalt);
				}
			},
			jetzt: () => new Date('2026-11-26T10:00:00Z'),
			...teil,
		});

	const vertrag = (...dateien: string[]) =>
		writeFile(
			path.join(mappeDir, 'bilder.json'),
			JSON.stringify(dateien.map((datei) => ({ datei, motiv: `Ein Igel im Laub (${datei})` }))),
		);

	const erzeuge = (
		bilder: ReturnType<typeof app>,
		argumente: Record<string, unknown> = {},
		werkzeug = 'bild_erzeugen',
	) =>
		bilder.aufruf(werkzeug, {
			dokument: `${MAPPE}/${DOK}`,
			datei: 'igel.png',
			prompt: 'Kindgerechte Illustration: ein Igel im Herbstlaub.',
			format: 'SQUARE_1_1',
			...argumente,
		});

	beforeEach(async () => {
		wurzel = await mkdtemp(path.join(tmpdir(), 'app-bilder-'));
		materialDir = path.join(wurzel, 'materialien');
		mappeDir = path.join(materialDir, MAPPE);
		draussen = path.join(wurzel, 'draussen');
		for (const d of [DOK, ANDERES]) {
			await mkdir(path.join(mappeDir, 'dokumente', d), { recursive: true });
			await writeFile(path.join(mappeDir, 'dokumente', d, 'material.html'), '<section class="seite"></section>');
		}
		await mkdir(draussen, { recursive: true });
		await writeFile(path.join(wurzel, '.env'), `OPENAI_API_KEY=${SCHLUESSEL}\n`);
		await writeFile(path.join(draussen, 'geheim.png'), png(9));
		anfragen = [];
		antwortVonApi = () => Promise.resolve(png(1));
	});

	afterEach(async () => {
		await rm(wurzel, { recursive: true, force: true });
	});

	it('nennt die Werkzeuge mit dem Pflichtparameter dokument und die Ablage in der Mappe', async () => {
		const schemas = await app().schemas();
		assert.deepEqual(
			schemas.map((s) => s.name),
			['bild_erzeugen', 'bild_bearbeiten'],
		);
		assert.deepEqual(schemas[0]?.inputSchema.required, ['dokument', 'datei', 'prompt', 'format']);
		assert.deepEqual(schemas[1]?.inputSchema.required, ['dokument', 'datei', 'prompt', 'befund']);
		assert.match(schemas[0]?.description ?? '', /\.\.\/\.\.\/bilder\/<datei>/);
		assert.doesNotMatch(JSON.stringify(schemas), /keine Schrift|ohne Schrift/i);
		// Eine Quelle mit den Läufen (`werkzeug-schemas.ts`): dieselben Parameter, davor `dokument`.
		const lauf = laufWerkzeuge('bilder', true);
		for (const [i, s] of schemas.entries()) {
			assert.deepEqual(Object.keys(s.inputSchema.properties), [
				'dokument',
				...Object.keys(lauf[i]?.inputSchema.properties ?? {}),
			]);
		}
		assert.deepEqual(schemas[0]?.inputSchema.properties.format, lauf[0]?.inputSchema.properties.format);
	});

	it('erzeugt das Bild in bilder/ der Mappe mit Herkunft und zeigt die Prüfbilder', async () => {
		await vertrag('igel.png');
		const antwort = await erzeuge(app());
		assert.equal(antwort.isError, false, text(antwort));
		assert.deepEqual(await readFile(path.join(mappeDir, 'bilder', 'igel.png')), png(1));
		const herkunft = await readFile(path.join(mappeDir, 'bilder', BILD_HERKUNFT), 'utf8');
		assert.match(
			herkunft,
			/^igel\.png\topenai\tgpt-image-test\t2026-11-26\tEin Igel im Laub \(igel\.png\)\terzeugt\t/m,
		);
		assert.match(text(antwort), /Im Material: \.\.\/\.\.\/bilder\/igel\.png/);
		assert.match(text(antwort), /Gespeichert: bilder\/igel\.png/);
		const bilder = antwort.content.filter((c) => c.type === 'image');
		assert.equal(bilder.length, 4);
		assert.equal(bilder[0]?.type === 'image' && bilder[0].mimeType, 'image/png');
		assert.equal(anfragen.length, 1);
		assert.doesNotMatch(JSON.stringify(antwort), new RegExp(SCHLUESSEL));
	});

	it('ohne Vertrag in bilder.json der Mappe kein Bild', async () => {
		const antwort = await erzeuge(app());
		assert.equal(antwort.isError, true);
		assert.match(text(antwort), /bilder\.json/);
		assert.equal(anfragen.length, 0);
	});

	it('lehnt ein Dokument außerhalb des Materialordners, mit .. oder absolutem Pfad ab', async () => {
		await vertrag('igel.png');
		const bilder = app();
		for (const dokument of [
			`../${MAPPE}/${DOK}`,
			`${MAPPE}/../${DOK}`,
			'/etc/passwd',
			path.join(draussen, 'x'),
			MAPPE,
			`${MAPPE}/fehlt`,
			`${MAPPE}/${DOK}/mehr`,
			7,
			undefined,
		]) {
			const antwort = await erzeuge(bilder, { dokument });
			assert.equal(antwort.isError, true, String(dokument));
		}
		assert.equal(anfragen.length, 0);
		assert.equal(existsSync(path.join(materialDir, 'etc')), false);
	});

	it('lehnt ein Dokument hinter einem Link ab, auch wenn es dort eins gibt', async () => {
		const fremd = path.join(draussen, 'mappe');
		await mkdir(path.join(fremd, 'dokumente', DOK), { recursive: true });
		await writeFile(path.join(fremd, 'dokumente', DOK, 'material.html'), '<section></section>');
		await writeFile(path.join(fremd, 'bilder.json'), JSON.stringify([{ datei: 'igel.png', motiv: 'Igel' }]));
		await symlink(fremd, path.join(materialDir, 'link-mappe'));
		await symlink(path.join(fremd, 'dokumente', DOK), path.join(mappeDir, 'dokumente', 'link-dok'));
		const bilder = app();
		for (const dokument of [`link-mappe/${DOK}`, `${MAPPE}/link-dok`]) {
			const antwort = await erzeuge(bilder, { dokument });
			assert.equal(antwort.isError, true, dokument);
			assert.match(text(antwort), /gibt es nicht/);
		}
		assert.equal(existsSync(path.join(fremd, 'bilder')), false);
		assert.equal(anfragen.length, 0);
	});

	it('schreibt nicht durch einen Link in der Mappe nach draußen', async () => {
		await vertrag('igel.png');
		await symlink(draussen, path.join(mappeDir, 'bilder'));
		const antwort = await erzeuge(app());
		assert.equal(antwort.isError, true);
		assert.equal(existsSync(path.join(draussen, 'igel.png')), false);
		assert.equal(anfragen.length, 0);
	});

	it('nimmt Referenzen nur aus den Quellen der Mappe, nie .env oder Dateien draußen', async () => {
		await vertrag('igel.png');
		await mkdir(path.join(mappeDir, 'bilder'), { recursive: true });
		await mkdir(path.join(mappeDir, 'dokumente', DOK, 'bilder'), { recursive: true });
		await mkdir(path.join(mappeDir, 'dokumente', ANDERES, 'bilder'), { recursive: true });
		await writeFile(path.join(mappeDir, '.env'), `OPENAI_API_KEY=${SCHLUESSEL}\n`);
		await writeFile(path.join(mappeDir, 'bilder', '.env'), `OPENAI_API_KEY=${SCHLUESSEL}\n`);
		await writeFile(path.join(mappeDir, 'dokumente', ANDERES, 'bilder', 'fremd.png'), png(4));
		await symlink(path.join(draussen, 'geheim.png'), path.join(mappeDir, 'bilder', 'link.png'));
		await symlink(path.join(wurzel, '.env'), path.join(mappeDir, 'bilder', 'env.png'));
		const bilder = app();
		for (const referenz of [
			'.env',
			'../../.env',
			'bilder/../../../.env',
			'bilder/.env',
			path.join(wurzel, '.env'),
			`materialien/${MAPPE}/../../.env`,
			'bilder/link.png',
			'bilder/env.png',
			`dokumente/${ANDERES}/bilder/fremd.png`,
			'dokumente/../../../draussen/geheim.png',
		]) {
			const antwort = await erzeuge(bilder, { referenzen: [referenz] });
			assert.equal(antwort.isError, true, referenz);
		}
		assert.equal(anfragen.length, 0);
	});

	it('nimmt Canva-Bilder des Dokuments, Bilder der Mappe und Grundposen als Referenz, auch mit materialien/<mappe>/', async () => {
		await vertrag('igel.png');
		await mkdir(path.join(mappeDir, 'bilder'), { recursive: true });
		await mkdir(path.join(mappeDir, 'dokumente', DOK, 'bilder'), { recursive: true });
		await writeFile(path.join(mappeDir, 'dokumente', DOK, 'bilder', 'canva-igel.png'), png(2));
		await writeFile(path.join(mappeDir, 'bilder', 'laub.png'), png(3));
		const figur: AppFigur = {
			name: 'luna',
			datei: path.join(draussen, 'geheim.png'),
			pfad: 'referenzen/luna.png',
			anzeige: 'Luna',
		};
		const bilder = app({ figuren: [figur] });
		assert.match((await bilder.schemas())[0]?.description ?? '', /referenzen\/luna\.png \(Luna\)/);
		const antwort = await erzeuge(bilder, {
			referenzen: [
				`dokumente/${DOK}/bilder/canva-igel.png`,
				`materialien/${MAPPE}/bilder/laub.png`,
				'referenzen/luna.png',
			],
		});
		assert.equal(antwort.isError, false, text(antwort));
		assert.deepEqual(anfragen[0]?.referenzen, [png(2), png(3), png(9)]);
	});

	it('überschreibt kein Bild, das ein anderes Material der Mappe zeigt', async () => {
		await vertrag('igel.png');
		await mkdir(path.join(mappeDir, 'bilder'), { recursive: true });
		await writeFile(path.join(mappeDir, 'bilder', 'igel.png'), png(5));
		await writeFile(
			path.join(mappeDir, 'dokumente', ANDERES, 'material.html'),
			'<img src="../../bilder/igel.png" alt="Igel">',
		);
		const bilder = app();
		const neu = await erzeuge(bilder, { befund: 'Der Igel hat drei Beine.' });
		assert.equal(neu.isError, true);
		assert.match(text(neu), /anderes Material/);
		const bearbeitet = await erzeuge(bilder, { befund: 'Der Igel hat drei Beine.' }, 'bild_bearbeiten');
		assert.equal(bearbeitet.isError, true);
		assert.deepEqual(await readFile(path.join(mappeDir, 'bilder', 'igel.png')), png(5));
		assert.equal(anfragen.length, 0);
	});

	it('keine Obergrenze: mehr Bilder als ein Blatt-Lauf darf (281)', async () => {
		const anzahl = BILD_GRENZEN.aufrufe.blatt * 3 + 1;
		const dateien = Array.from({ length: anzahl }, (_, i) => `bild-${i + 1}.png`);
		await vertrag(...dateien);
		const bilder = app();
		for (const datei of dateien) {
			const a = await erzeuge(bilder, { datei });
			assert.equal(a.isError, false, text(a));
		}
		assert.equal(anfragen.length, anzahl);
	});

	it('bild-api-gesperrt gilt danach für die ganze Sitzung; ohne Schlüssel entsteht nichts', async () => {
		await vertrag('igel.png', 'laub.png');
		antwortVonApi = () => Promise.reject(new BildApiFehler('gesperrt', 'Guthaben aufgebraucht.'));
		const bilder = app();
		const erste = await erzeuge(bilder);
		assert.equal(erste.isError, true);
		assert.match(text(erste), new RegExp(BILD_API_GESPERRT));
		const zweite = await erzeuge(bilder, { dokument: `${MAPPE}/${ANDERES}`, datei: 'laub.png' });
		assert.match(text(zweite), new RegExp(BILD_API_GESPERRT));
		assert.equal(anfragen.length, 1);

		await rm(path.join(mappeDir, 'bilder.json'));
		const ohne = erstelleAppBilder({
			konfig: {
				openaiSchluessel: null,
				bildModell: 'x',
				bildQualitaet: 'low',
				pythonBin: 'python3',
				materialDir,
				wurzel,
			},
			figuren: [],
		});
		const antwort = await erzeuge(ohne);
		assert.match(text(antwort), new RegExp(BILD_API_GESPERRT));
		assert.equal(existsSync(path.join(mappeDir, 'bilder.json')), false);
	});

	it('der Schlüssel steht in keiner Antwort, auch nicht in einer Fehlermeldung der API', async () => {
		await vertrag('igel.png');
		antwortVonApi = () =>
			Promise.reject(new BildApiFehler('abgelehnt', `Bild-API: Incorrect API key provided: ${SCHLUESSEL}.`));
		const antwort = await erzeuge(app());
		assert.equal(antwort.isError, true);
		assert.match(text(antwort), /Incorrect API key/);
		assert.doesNotMatch(JSON.stringify(antwort), /geheim-1234567890/);
	});
});
