import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';

import type { BildAnfrage, BildErgebnis } from './bild-api';
import { BILD_API_GESPERRT, BildApiFehler } from './bild-api';
import type { BildPlatz } from './bild-datei';
import { hatTransparenz } from './bild-datei';
import { BILD_GRENZEN } from './bild-grenzen';
import type { BildWerkzeugOptionen } from './bild-werkzeug';
import { BILD_HERKUNFT, erstelleBildWerkzeug, gleicherBefund, inhaltHash, VERSUCHE } from './bild-werkzeug';
import { KI_GRENZEN } from './ki';

type Alpha = 'ohne' | 'deckend' | 'ecke';

const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
	if (pa <= pb && pa <= pc) {
		return a;
	}
	return pb <= pc ? b : c;
};

const block = (art: string, daten: Buffer) => {
	const laenge = Buffer.alloc(4);
	laenge.writeUInt32BE(daten.length);
	const kopf = Buffer.concat([Buffer.from(art, 'latin1'), daten]);
	const pruef = Buffer.alloc(4);
	pruef.writeUInt32BE(crc32(kopf));
	return Buffer.concat([laenge, kopf, pruef]);
};

/**
 * Ein echtes kleines PNG (8 Bit, ohne Interlace). `ohne`: RGB; `deckend`: RGBA mit Alpha überall 255; `ecke`: RGBA,
 * das Pixel unten rechts ganz transparent. `filter` gilt für jede Zeile (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth).
 */
const png = (breite: number, hoehe: number, alpha: Alpha = 'ohne', filter = 0) => {
	const bpp = alpha === 'ohne' ? 3 : 4;
	const zeile = breite * bpp;
	const pixel = Buffer.alloc(zeile * hoehe);
	for (let y = 0; y < hoehe; y += 1) {
		for (let x = 0; x < breite; x += 1) {
			const i = y * zeile + x * bpp;
			pixel[i] = (x * 37 + y * 11) & 0xff;
			pixel[i + 1] = (x * 5 + y * 71) & 0xff;
			pixel[i + 2] = (x * y + 90) & 0xff;
			if (bpp === 4) {
				pixel[i + 3] = alpha === 'ecke' && x === breite - 1 && y === hoehe - 1 ? 0 : 255;
			}
		}
	}
	const roh = Buffer.alloc((zeile + 1) * hoehe);
	for (let y = 0; y < hoehe; y += 1) {
		roh[y * (zeile + 1)] = filter;
		for (let x = 0; x < zeile; x += 1) {
			const wert = pixel[y * zeile + x] ?? 0;
			const a = x >= bpp ? (pixel[y * zeile + x - bpp] ?? 0) : 0;
			const b = y > 0 ? (pixel[(y - 1) * zeile + x] ?? 0) : 0;
			const c = x >= bpp && y > 0 ? (pixel[(y - 1) * zeile + x - bpp] ?? 0) : 0;
			const vorhersage = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter] ?? 0;
			roh[y * (zeile + 1) + 1 + x] = (wert - vorhersage) & 0xff;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(breite, 0);
	ihdr.writeUInt32BE(hoehe, 4);
	ihdr[8] = 8;
	ihdr[9] = alpha === 'ohne' ? 2 : 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		block('IHDR', ihdr),
		block('IDAT', deflateSync(roh)),
		block('IEND', Buffer.alloc(0)),
	]);
};

/** Ein JPEG-Kopf mit SOF0. */
const jpg = (breite: number, hoehe: number, merkmal = 0) => {
	const kopf = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 0, 0, 0, 3, merkmal, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	kopf.writeUInt16BE(hoehe, 7);
	kopf.writeUInt16BE(breite, 9);
	return kopf;
};

const ergebnis = (inhalt: Buffer): BildErgebnis => ({
	inhalt,
	verbrauch: { bildToken: 0, textToken: 100, ausgabeToken: 1000 },
	kostenUsd: 0.03,
	wiederholungen: 0,
});

const KONFIG = {
	openaiSchluessel: 'test-schluessel',
	bildModell: 'gpt-image-test',
	bildQualitaet: 'low' as const,
	pythonBin: 'python3',
};

describe('hatTransparenz: Alpha unter 255, nicht nur ein Alphakanal (237)', () => {
	it('RGBA deckend → false, RGBA mit transparenter Ecke → true, RGB → false; mit allen Zeilenfiltern', () => {
		for (const filter of [0, 1, 2, 3, 4]) {
			assert.equal(hatTransparenz(png(9, 7, 'deckend', filter)), false, `deckend, Filter ${filter}`);
			assert.equal(hatTransparenz(png(9, 7, 'ecke', filter)), true, `Ecke, Filter ${filter}`);
			assert.equal(hatTransparenz(png(9, 7, 'ohne', filter)), false, `RGB, Filter ${filter}`);
		}
	});

	it('tRNS zählt als transparent; JPEG und Unlesbares nie', () => {
		const rgb = png(4, 4);
		const mitTrns = Buffer.concat([rgb.subarray(0, 33), block('tRNS', Buffer.alloc(6)), rgb.subarray(33)]);
		assert.equal(hatTransparenz(mitTrns), true);
		assert.equal(hatTransparenz(jpg(10, 10)), false);
		const kaputt = png(9, 7, 'ecke');
		kaputt.fill(0, 50);
		assert.equal(hatTransparenz(kaputt), false);
	});
});

describe('Bildwerkzeuge (237)', () => {
	let arbeit: string;
	let anfragen: BildAnfrage[];
	let zuschnitte: (BildPlatz & { datei: string; bytes: number })[];

	const vertrag = async (...eintraege: Record<string, unknown>[]) =>
		writeFile(path.join(arbeit, 'bilder.json'), JSON.stringify({ bilder: eintraege }));

	const werkzeug = (teil: Partial<BildWerkzeugOptionen> = {}) =>
		erstelleBildWerkzeug({
			arbeit,
			art: 'einheit',
			konfig: KONFIG,
			api: (anfrage) => {
				anfragen.push(anfrage);
				return Promise.resolve(
					ergebnis(
						anfrage.typ === 'png'
							? png(64, 64, anfrage.transparent ? 'ecke' : 'ohne')
							: jpg(1440, 1152, anfragen.length),
					),
				);
			},
			zuschnitt: (inhalt, wunsch) => {
				zuschnitte.push({ ...wunsch, bytes: inhalt.length });
				return Promise.resolve();
			},
			jetzt: () => new Date('2026-11-18T10:00:00Z'),
			...teil,
		});

	beforeEach(async () => {
		arbeit = await mkdtemp(path.join(tmpdir(), 'bild-werkzeug-'));
		await mkdir(path.join(arbeit, 'bilder'));
		anfragen = [];
		zuschnitte = [];
	});
	afterEach(async () => {
		await rm(arbeit, { recursive: true, force: true });
	});

	it('lehnt ohne Vertrag in bilder.json ab und ruft die API nicht', async () => {
		const w = await werkzeug();
		const antwort = await w.aufruf('bild_erzeugen', {
			datei: 'fall-1.jpg',
			prompt: 'Szene',
			format: 'LANDSCAPE_5_4',
		});
		assert.equal(antwort.fehler, true);
		assert.match(antwort.text, /Vertrag, dann erzeugen/);
		assert.match(antwort.text, /fall-1\.jpg/);
		assert.equal(anfragen.length, 0);
		assert.equal(w.stand().aufrufe, 0);
	});

	it('prüft die Argumente je Werkzeug', async () => {
		await vertrag({ datei: 'luna.png', motiv: 'Eule' }, { datei: 'fall-1.jpg', motiv: 'Szene' });
		const w = await werkzeug();
		for (const [werkzeugName, argumente, fehler] of [
			['bild_erzeugen', { datei: '../luna.png', prompt: 'x', format: 'SQUARE_1_1' }, /datei/],
			['bild_erzeugen', { datei: 'luna.png', prompt: '', format: 'SQUARE_1_1' }, /prompt/],
			['bild_erzeugen', { datei: 'luna.png', prompt: 'x', format: 'A4' }, /format/],
			[
				'bild_erzeugen',
				{ datei: 'fall-1.jpg', prompt: 'x', format: 'SQUARE_1_1', transparent: true },
				/nur bei \.png/,
			],
			[
				'bild_erzeugen',
				{ datei: 'luna.png', prompt: 'x', format: 'SQUARE_1_1', referenzen: ['a', 'b', 'c', 'd', 'e'] },
				/höchstens 4/,
			],
			['bild_bearbeiten', { datei: 'luna.png', prompt: 'x', referenzen: ['a', 'b', 'c', 'd'] }, /höchstens 3/],
			['bild_malen', { datei: 'luna.png', prompt: 'x' }, /Unbekanntes Werkzeug/],
		] as const) {
			const antwort = await w.aufruf(werkzeugName, argumente);
			assert.equal(antwort.fehler, true, JSON.stringify(argumente));
			assert.match(antwort.text, fehler);
		}
		assert.equal(anfragen.length, 0);
	});

	it('nimmt Referenzen nur aus bilder/ und referenzen/, auch nicht über Links', async () => {
		await vertrag({ datei: 'fall-1.jpg', motiv: 'Szene' });
		await mkdir(path.join(arbeit, 'referenzen'));
		await mkdir(path.join(arbeit, VERSUCHE), { recursive: true });
		await writeFile(path.join(arbeit, VERSUCHE, 'fall-1-1.jpg'), jpg(1440, 1152));
		await writeFile(path.join(arbeit, 'ansicht', 'bilder', 'fall-1-v1.png'), png(10, 10));
		await writeFile(path.join(arbeit, 'referenzen', 'luna.png'), png(64, 64, 'ecke'));
		await writeFile(path.join(arbeit, 'ansicht', 'fremd.png'), png(10, 10));
		const draussen = await mkdtemp(path.join(tmpdir(), 'bild-draussen-'));
		try {
			await writeFile(path.join(draussen, 'geheim.png'), png(10, 10));
			await symlink(path.join(draussen, 'geheim.png'), path.join(arbeit, 'bilder', 'link.png'));
			const w = await werkzeug();
			for (const ref of [
				'../geheim.png',
				path.join(draussen, 'geheim.png'),
				'ansicht/fremd.png',
				'bilder/../ansicht/fremd.png',
				'bilder/link.png',
				'ansicht/bilder/fall-1-v1.png',
				'ansicht/bilder/versuche/../fall-1-v1.png',
				'referenzen/fehlt.png',
				'material.html',
			]) {
				const antwort = await w.aufruf('bild_erzeugen', {
					datei: 'fall-1.jpg',
					prompt: 'Szene',
					format: 'LANDSCAPE_5_4',
					referenzen: [ref],
				});
				assert.equal(antwort.fehler, true, ref);
			}
			assert.equal(anfragen.length, 0);
			const gut = await w.aufruf('bild_erzeugen', {
				datei: 'fall-1.jpg',
				prompt: 'Bild 1 zeigt die Eule.',
				format: 'LANDSCAPE_5_4',
				referenzen: ['referenzen/luna.png', 'ansicht/bilder/versuche/fall-1-1.jpg'],
			});
			assert.equal(gut.fehler, undefined, gut.text);
			assert.equal(anfragen[0]?.referenzen.length, 2);
			assert.equal(anfragen[0]?.format, 'LANDSCAPE_5_4');
			assert.equal(anfragen[0]?.typ, 'jpg');
		} finally {
			await rm(draussen, { recursive: true, force: true });
		}
	});

	it('kopiert die Figuren nach referenzen/ und nennt ihre Pfade', async () => {
		const quelle = path.join(arbeit, 'pose.png');
		await writeFile(quelle, png(64, 64, 'ecke'));
		const w = await werkzeug({ figuren: [{ name: 'luna', datei: quelle }] });
		assert.deepEqual(w.referenzen, ['referenzen/luna.png']);
		assert.ok(existsSync(path.join(arbeit, 'referenzen', 'luna.png')));
	});

	it('legt ab: Prüfbilder mit platz und blickpunkt, Vorversion unter versuche/, Zeile in der Herkunftsdatei', async () => {
		await vertrag({
			datei: 'fall-1.jpg',
			motiv: 'Eule\tam Tisch',
			platz: { breite: 794, hoehe: 660 },
			blickpunkt: { x: 50, y: 40 },
			url: 'alt',
		});
		const w = await werkzeug();
		const erste = await w.aufruf('bild_erzeugen', {
			datei: 'fall-1.jpg',
			prompt: 'Szene',
			format: 'LANDSCAPE_5_4',
		});
		assert.equal(erste.fehler, undefined, erste.text);
		const ersteDatei = await readFile(path.join(arbeit, 'bilder', 'fall-1.jpg'));
		assert.match(erste.text, /^Gespeichert: bilder\/fall-1\.jpg \(1440 × 1152 px\), Versuch 1\./);
		assert.match(
			erste.text,
			/Prüfbilder: ansicht\/bilder\/fall-1-v1\.png, ansicht\/bilder\/fall-1-v2\.png, ansicht\/bilder\/fall-1-v3\.png, ansicht\/bilder\/fall-1-v4\.png, ansicht\/bilder\/fall-1-platz\.png\./,
		);
		assert.match(erste.text, /Prüfe sie gegen den Vertrag und trage die Prüfung in `bilder\.json` ein\./);
		assert.doesNotMatch(erste.text, /Vorversion/);
		assert.deepEqual(zuschnitte[0], {
			datei: 'fall-1.jpg',
			platz: { breite: 794, hoehe: 660 },
			blickpunkt: { x: 50, y: 40 },
			bytes: ersteDatei.length,
		});

		const zweite = await w.aufruf('bild_erzeugen', {
			datei: 'fall-1.jpg',
			prompt: 'Szene',
			format: 'LANDSCAPE_5_4',
			befund: 'Die Eule hat drei Flügel.',
		});
		assert.match(zweite.text, /Versuch 2\./);
		assert.match(zweite.text, /Die Vorversion liegt unter ansicht\/bilder\/versuche\/fall-1-1\.jpg\./);
		assert.deepEqual(await readFile(path.join(arbeit, VERSUCHE, 'fall-1-1.jpg')), ersteDatei);

		const zweiteDatei = await readFile(path.join(arbeit, 'bilder', 'fall-1.jpg'));
		const dritte = await w.aufruf('bild_bearbeiten', {
			datei: 'fall-1.jpg',
			prompt: 'Ändere nur die Blätter.',
			befund: 'Die Blätter sind blau.',
		});
		assert.match(dritte.text, /Versuch 3\./);
		assert.match(dritte.text, /Eine Bearbeitung je Fehler\./);
		const dritteDatei = await readFile(path.join(arbeit, 'bilder', 'fall-1.jpg'));
		assert.ok(existsSync(path.join(arbeit, VERSUCHE, 'fall-1-2.jpg')));
		const bearbeiten = anfragen[2];
		assert.equal(bearbeiten?.bearbeiten, true);
		assert.equal(bearbeiten?.format, 'LANDSCAPE_5_4');
		assert.equal(bearbeiten?.transparent, false);
		assert.equal(bearbeiten?.referenzen.length, 1);

		const herkunft = (await readFile(path.join(arbeit, 'bilder', BILD_HERKUNFT), 'utf8')).trim().split('\n');
		const zeile = (art: string, befund: string, inhalt: Buffer) =>
			`fall-1.jpg\topenai\tgpt-image-test\t2026-11-18\tEule am Tisch\t${art}\t${befund}\t${inhaltHash(inhalt)}`;
		assert.deepEqual(herkunft, [
			'datei\tquelle\tmodell\tdatum\tmotiv\tart\tbefund\tinhalt',
			zeile('erzeugt', '', ersteDatei),
			zeile('erzeugt', 'Die Eule hat drei Flügel.', zweiteDatei),
			zeile('bearbeitet', 'Die Blätter sind blau.', dritteDatei),
		]);
		assert.deepEqual(w.stand(), {
			gesperrt: false,
			aufrufe: 3,
			obergrenze: BILD_GRENZEN.aufrufe.einheit,
			bilder: ['bilder/fall-1.jpg', 'bilder/fall-1.jpg', 'bilder/fall-1.jpg'],
			kostenUsd: 0.09,
			offen: [],
		});
	});

	it('bearbeiten behält Format und Transparenz des Bilds', async () => {
		await writeFile(path.join(arbeit, 'bilder', 'luna.png'), png(64, 64, 'ecke'));
		const w = await werkzeug();
		const antwort = await w.aufruf('bild_bearbeiten', {
			datei: 'luna.png',
			prompt: 'Ändere nur den Schal.',
			befund: 'Der Schal fehlt.',
		});
		assert.equal(antwort.fehler, undefined, antwort.text);
		assert.equal(anfragen[0]?.format, 'SQUARE_1_1');
		assert.equal(anfragen[0]?.transparent, true);
		assert.equal(anfragen[0]?.typ, 'png');
		assert.match(antwort.text, /Prüfbilder: ansicht\/bilder\/luna-v1\.png, .*luna-v4\.png\./);
		assert.doesNotMatch(antwort.text, /luna-platz/);
		const fehlt = await w.aufruf('bild_bearbeiten', { datei: 'fehlt.png', prompt: 'x', befund: 'x' });
		assert.match(fehlt.text, /gibt es nicht/);
	});

	it('höchstens 3 Bildaufrufe gleichzeitig', async () => {
		const namen = ['a', 'b', 'c', 'd', 'e'].map((n) => `bild-${n}.png`);
		await vertrag(...namen.map((datei) => ({ datei, motiv: 'Ding' })));
		let laufend = 0;
		let hoechstens = 0;
		const w = await werkzeug({
			api: async () => {
				laufend += 1;
				hoechstens = Math.max(hoechstens, laufend);
				await new Promise((resolve) => setTimeout(resolve, 50));
				laufend -= 1;
				return ergebnis(png(64, 64));
			},
		});
		const antworten = namen.map((datei) =>
			w.aufruf('bild_erzeugen', { datei, prompt: 'Ding', format: 'SQUARE_1_1' }),
		);
		const alle = await Promise.all(antworten);
		assert.equal(hoechstens, BILD_GRENZEN.gleichzeitig);
		assert.equal(hoechstens, 3);
		assert.deepEqual(
			alle.map((a) => a.fehler),
			namen.map(() => undefined),
		);
	});

	it('Obergrenze je Lauf: danach lehnt das Werkzeug ab, ohne die API zu fragen', async () => {
		const namen = ['a.png', 'b.png', 'c.png', 'd.png'];
		await vertrag(...namen.map((datei) => ({ datei, motiv: 'A' })));
		assert.deepEqual(BILD_GRENZEN.aufrufe, { einheit: 90, blatt: 8, schublade: 3 });
		assert.equal(KI_GRENZEN.bild, BILD_GRENZEN);
		const w = await werkzeug({ art: 'schublade' });
		for (const datei of namen.slice(0, 3)) {
			assert.equal(
				(await w.aufruf('bild_erzeugen', { datei, prompt: 'A', format: 'SQUARE_1_1' })).fehler,
				undefined,
			);
		}
		const vierte = await w.aufruf('bild_erzeugen', { datei: 'd.png', prompt: 'A', format: 'SQUARE_1_1' });
		assert.equal(vierte.fehler, true);
		assert.match(vierte.text, /Obergrenze von 3 Bildaufrufen/);
		assert.equal(anfragen.length, 3);
		assert.equal(w.stand().aufrufe, 3);
	});

	it('bild-api-gesperrt: Merker im Werkzeug, danach keine Anfrage mehr', async () => {
		await vertrag({ datei: 'a.png', motiv: 'A' });
		let fragen = 0;
		const w = await werkzeug({
			api: () => {
				fragen += 1;
				return Promise.reject(new BildApiFehler('gesperrt', 'gesperrt'));
			},
		});
		const erste = await w.aufruf('bild_erzeugen', { datei: 'a.png', prompt: 'A', format: 'SQUARE_1_1' });
		assert.equal(erste.fehler, true);
		assert.match(erste.text, new RegExp(BILD_API_GESPERRT));
		assert.match(erste.text, /Frage kein Bild mehr an/);
		assert.equal(w.stand().gesperrt, true);
		const zweite = await w.aufruf('bild_erzeugen', { datei: 'a.png', prompt: 'A', format: 'SQUARE_1_1' });
		assert.match(zweite.text, new RegExp(BILD_API_GESPERRT));
		assert.equal(fragen, 1);
		assert.equal(existsSync(path.join(arbeit, 'bilder', 'a.png')), false);
	});

	it('andere Fehler der API kommen als kurzer Text, das Werkzeug bleibt offen', async () => {
		await vertrag({ datei: 'a.png', motiv: 'A' });
		const w = await werkzeug({
			api: () =>
				Promise.reject(new BildApiFehler('sicherheit', 'Sicherheitsfilter: Motiv harmloser formulieren.')),
		});
		const antwort = await w.aufruf('bild_erzeugen', { datei: 'a.png', prompt: 'A', format: 'SQUARE_1_1' });
		assert.deepEqual(antwort, { text: 'Sicherheitsfilter: Motiv harmloser formulieren.', fehler: true });
		assert.equal(w.stand().gesperrt, false);
	});

	it('Vertrag aus dem Kanon: pruefeVertrag lehnt vor der API ab, mit seinem Satz (248)', async () => {
		await vertrag({ datei: 'fall-1.jpg', motiv: 'Szene', vertrag: { pflicht: ['Luna'] } });
		const gesehen: unknown[] = [];
		const w = await werkzeug({
			pruefeVertrag: (v) => {
				gesehen.push(v.vertrag);
				return 'Dem Bildvertrag fehlt: „Luna: graue Federn“.';
			},
		});
		const antwort = await w.aufruf('bild_erzeugen', { datei: 'fall-1.jpg', prompt: 'Szene', format: 'SQUARE_1_1' });
		assert.deepEqual(antwort, { text: 'Dem Bildvertrag fehlt: „Luna: graue Federn“.', fehler: true });
		assert.deepEqual(gesehen, [{ pflicht: ['Luna'] }]);
		assert.equal(anfragen.length, 0);
		assert.equal(w.stand().aufrufe, 0);
	});

	it('neu statt flicken: ein Befund je Bearbeitung, dann neu erzeugen, nach zwei neuen Bildern offen (248)', async () => {
		await vertrag({ datei: 'fall-1.jpg', motiv: 'Eule am Fenster' });
		const w = await werkzeug();
		const erzeugen = (befund?: string) =>
			w.aufruf('bild_erzeugen', { datei: 'fall-1.jpg', prompt: 'Szene', format: 'SQUARE_1_1', befund });
		const bearbeiten = (befund?: string) =>
			w.aufruf('bild_bearbeiten', { datei: 'fall-1.jpg', prompt: 'Ändere nur den Spiegel.', befund });
		assert.equal((await erzeugen()).fehler, undefined);

		assert.match((await bearbeiten()).text, /„befund“ fehlt/);
		assert.match((await erzeugen()).text, /gibt es schon\. Nenne in „befund“/);
		assert.equal((await bearbeiten('Der Spiegel ist eine Glasscheibe.')).fehler, undefined);
		const nochmal = await bearbeiten('Der Spiegel ist immer noch eine Glasscheibe');
		assert.equal(nochmal.fehler, true);
		assert.match(nochmal.text, /^Neu erzeugen: Eine Bearbeitung je Fehler\./);
		assert.equal(anfragen.length, 2);

		assert.equal((await erzeugen('Der Spiegel ist eine Glasscheibe.')).fehler, undefined);
		assert.equal((await erzeugen('Der Spiegel ist eine Glasscheibe.')).fehler, undefined);
		const dritte = await erzeugen('Der Spiegel ist eine Glasscheibe.');
		assert.equal(dritte.fehler, true);
		assert.match(dritte.text, /kein weiterer Versuch an bilder\/fall-1\.jpg/);
		assert.match(dritte.text, /"offen"/);
		assert.equal(anfragen.length, 4);
		assert.match((await bearbeiten('Der Spiegel ist eine Glasscheibe.')).text, /kein weiterer Versuch/);
		assert.deepEqual(w.stand().offen, [{ datei: 'fall-1.jpg', befund: 'Der Spiegel ist eine Glasscheibe.' }]);

		const zeilen = (await readFile(path.join(arbeit, 'bilder', BILD_HERKUNFT), 'utf8')).trim().split('\n');
		assert.deepEqual(
			zeilen.slice(1).map((z) => z.split('\t')[5]),
			['erzeugt', 'bearbeitet', 'erzeugt', 'erzeugt', 'offen'],
		);
		assert.equal(zeilen.at(-1)?.split('\t')[6], 'Der Spiegel ist eine Glasscheibe.');

		const anderer = await w.aufruf('bild_bearbeiten', {
			datei: 'fall-1.jpg',
			prompt: 'Ändere nur den Schal.',
			befund: 'Luna trägt keinen Schal.',
		});
		assert.equal(anderer.fehler, undefined, anderer.text);
	});

	it('zählt über Läufe; Zeilen der Herkunft von vor 248 zählen nicht', async () => {
		await vertrag({ datei: 'fall-1.jpg', motiv: 'Eule' });
		await writeFile(path.join(arbeit, 'bilder', 'fall-1.jpg'), jpg(1440, 1152));
		await writeFile(
			path.join(arbeit, 'bilder', BILD_HERKUNFT),
			'datei\tquelle\tmodell\tdatum\tmotiv\nfall-1.jpg\topenai\tm\t2026-11-01\tEule\n',
		);
		const erster = await werkzeug();
		assert.equal(
			(await erster.aufruf('bild_bearbeiten', { datei: 'fall-1.jpg', prompt: 'x', befund: 'Flügel fehlen.' }))
				.fehler,
			undefined,
		);
		const zweiter = await werkzeug();
		const antwort = await zweiter.aufruf('bild_bearbeiten', {
			datei: 'fall-1.jpg',
			prompt: 'x',
			befund: 'Die Flügel fehlen',
		});
		assert.match(antwort.text, /^Neu erzeugen/);
	});

	it('gleicherBefund: gleich nach Wortlaut oder Wortanfängen, sonst verschieden', () => {
		assert.equal(gleicherBefund('Der Spiegel ist eine Glasscheibe.', 'der spiegel  ist eine glasscheibe.'), true);
		assert.equal(gleicherBefund('Luna hat drei Flügel', 'Luna hat immer noch drei Flügeln.'), true);
		assert.equal(gleicherBefund('Luna hat drei Flügel', 'Das Glöckchen hängt am falschen Schwanz.'), false);
		assert.equal(gleicherBefund('', 'x'), false);
	});

	it('ohne Schlüssel gesperrt von Anfang an', async () => {
		await vertrag({ datei: 'a.png', motiv: 'A' });
		const w = await erstelleBildWerkzeug({ arbeit, art: 'blatt', konfig: { ...KONFIG, openaiSchluessel: null } });
		assert.equal(w.stand().gesperrt, true);
		const antwort = await w.aufruf('bild_erzeugen', { datei: 'a.png', prompt: 'A', format: 'SQUARE_1_1' });
		assert.match(antwort.text, new RegExp(BILD_API_GESPERRT));
	});
});
