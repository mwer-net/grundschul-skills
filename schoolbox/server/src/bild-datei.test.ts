import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { erstelleZuschnitt, leseBildVertraege } from './bild-datei';

const miss = (datei: string) =>
	JSON.parse(
		execFileSync('python3', [
			'-c',
			'import json,sys\nfrom PIL import Image\nb=Image.open(sys.argv[1]).convert("RGB")\nprint(json.dumps([b.width,b.height,b.getcolors()]))',
			datei,
		]).toString(),
	) as [number, number, [number, [number, number, number]][]];

describe('Bildvertrag und Zuschnitt (215, seit 237 hier)', () => {
	let dir: string;
	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'zuschnitt-'));
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('schneidet vier Viertel in voller Auflösung und den Ausschnitt des Platzes nach dem Blickpunkt', async () => {
		// 200 × 100: links oben rot, rechts oben blau, links unten grün, rechts unten gelb.
		const bild = path.join(dir, 'quelle.png');
		execFileSync('python3', [
			'-c',
			'import sys\nfrom PIL import Image\nb=Image.new("RGB",(200,100))\nfor x,y,f in ((0,0,(255,0,0)),(100,0,(0,0,255)),(0,50,(0,255,0)),(100,50,(255,255,0))): b.paste(f,(x,y,x+100,y+50))\nb.save(sys.argv[1])',
			bild,
		]);
		const ziel = path.join(dir, 'ansicht', 'bilder');
		const schneide = erstelleZuschnitt('python3', ziel);
		await schneide(await readFile(bild), {
			datei: 'szene.png',
			platz: { breite: 300, hoehe: 300 },
			blickpunkt: { x: 0, y: 50 },
		});
		const farben = [
			[255, 0, 0],
			[0, 0, 255],
			[0, 255, 0],
			[255, 255, 0],
		];
		for (const [i, farbe] of farben.entries()) {
			const [breite, hoehe, anteile] = miss(path.join(ziel, `szene-v${i + 1}.png`));
			assert.deepEqual([breite, hoehe], [100, 50]);
			assert.deepEqual(
				anteile.map(([, f]) => f),
				[farbe],
			);
		}
		// Quadratischer Platz, Blickpunkt ganz links: sichtbar ist die linke Hälfte, rot über grün.
		const [breite, hoehe, anteile] = miss(path.join(ziel, 'szene-platz.png'));
		assert.deepEqual([breite, hoehe], [100, 100]);
		assert.deepEqual(anteile.map(([, f]) => f).sort(), [farben[2], farben[0]].sort());

		// Ohne Platz: nur die Viertel; ein alter Ausschnitt desselben Bilds verschwindet.
		await schneide(await readFile(bild), { datei: 'szene.png' });
		assert.ok(existsSync(path.join(ziel, 'szene-v4.png')));
		assert.ok(!existsSync(path.join(ziel, 'szene-platz.png')));
		await assert.rejects(schneide(await readFile(bild), { datei: '../boese.png' }));
	});

	it('bilder.json: Vertrag bleibt unangetastet, Platz wird verstanden, alte Felder von Canva stören nicht', async () => {
		const arbeit = await mkdtemp(path.join(dir, 'arbeit-'));
		const vertrag = {
			pflicht: [{ was: 'Glöckchen', zahl: 1, farbe: 'rot', lage: 'auf dem Fensterbrett, rechts der Mitte' }],
			verboten: ['Schrift', 'Leitfigur'],
		};
		const liste = [
			{ datei: 'fall-5.png', motiv: 'Erster Versuch', vertrag },
			{ datei: '../boese.png', motiv: 'Ausbruch' },
			{
				datei: 'fall-5.png',
				motiv: 'Werkstatt',
				url: 'https://export.invalid/alt.png',
				mediaId: 'MA5',
				platz: { breite: 794, hoehe: 660 },
				blickpunkt: { x: 40, y: 50 },
				vertrag: { ...vertrag, pruefung: [{ versuch: 1, ok: false, befund: 'Glöckchen abgeschnitten' }] },
			},
			{ datei: 'karte.png', motiv: 'Karte', platz: { breite: -1, hoehe: 'x' }, offen: '  Das Glöckchen fehlt. ' },
			{ datei: 'ohne-motiv.png' },
		];
		const roh = JSON.stringify(liste);
		await writeFile(path.join(arbeit, 'bilder.json'), roh);
		assert.deepEqual(await leseBildVertraege(arbeit), [
			{
				datei: 'fall-5.png',
				motiv: 'Werkstatt',
				platz: { breite: 794, hoehe: 660 },
				blickpunkt: { x: 40, y: 50 },
				vertrag: { ...vertrag, pruefung: [{ versuch: 1, ok: false, befund: 'Glöckchen abgeschnitten' }] },
			},
			{ datei: 'karte.png', motiv: 'Karte', offen: 'Das Glöckchen fehlt.' },
		]);
		assert.equal(
			await readFile(path.join(arbeit, 'bilder.json'), 'utf8'),
			roh,
			'der Server schreibt die Liste nie',
		);
	});
});
