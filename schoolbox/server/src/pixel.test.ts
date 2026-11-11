import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

import { BLATT_PY, fertigstellen, legeFreigabeAn, WURZEL } from '@schoolbox/kern';
import { BROWSER_HINWEIS, browserFehlt } from '@schoolbox/kern/src/browsertest';
import type { Seitenflaeche } from '@schoolbox/kern/src/seitengestaltung';
import { setzeSeitenflaeche, setzeSeitenrahmen } from '@schoolbox/kern/src/seitengestaltung';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, starteTestServer } from './testhilfe';

const ausfuehren = promisify(execFile);

/** Druckt eine Adresse mit denselben Chromium-Schaltern wie blatt.py und vergleicht jede Seite mit dessen PNGs. */
const VERGLEICH = `
import json, sys
from pathlib import Path
from PIL import Image, ImageChops
sys.path.insert(0, sys.argv[1])
import blatt
url, ziel, referenz = sys.argv[2], Path(sys.argv[3]), sys.argv[4]
pdf = ziel / "ansicht.pdf"
blatt.chromium([f"--print-to-pdf={pdf}", "--no-pdf-header-footer", "--print-to-pdf-no-header"], url)
seiten = blatt.pngs(pdf, str(ziel / "ansicht"))
ergebnis = []
for i, seite in enumerate(seiten, 1):
    a = Image.open(seite).convert("RGB")
    b = Image.open(f"{referenz}-s{i}.png").convert("RGB")
    ergebnis.append({"seite": i, "groesse": a.size == b.size, "abweichung": ImageChops.difference(a, b).getbbox() if a.size == b.size else None})
print(json.dumps({"seiten": len(seiten), "vergleich": ergebnis}))
`;

interface Vergleich {
	seiten: number;
	vergleich: { seite: number; groesse: boolean; abweichung: number[] | null }[];
}

describe('/ansicht gegen blatt.py', () => {
	let s: TestServer;
	let python: string;
	let skripte: string;
	let chromiumFehlt = false;

	before(async () => {
		s = await starteTestServer();
		python = s.kontext.konfig.pythonBin;
		skripte = path.dirname(BLATT_PY);
		chromiumFehlt = browserFehlt();
	});
	after(() => s.stop());

	it('druckt das Beispielblatt pixelgleich, als Blatt und als Lösung', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		const fertig = await fertigstellen(s.kontext.konfig, { mappe, dok });
		assert.equal(fertig.bericht.fehler, 0);
		// Chromium hat keine Sitzung; der Teilen-Link prüft dabei auch die Darstellung unter /f/….
		const { token } = await legeFreigabeAn(s.materialDir, { mappe, dok });
		const basis = `${s.url}/f/${token}/ansicht/${mappe}/dokumente/${dok}/`;
		for (const [url, referenz] of [
			[basis, 'material'],
			[`${basis}?loesung=1`, 'material-loesung'],
		] as const) {
			const ziel = await mkdtemp(path.join(tmpdir(), 'schoolbox-pixel-'));
			const { stdout } = await ausfuehren(python, [
				'-c',
				VERGLEICH,
				skripte,
				url,
				ziel,
				path.join(dir, 'ausgabe', referenz),
			]);
			const { seiten, vergleich } = JSON.parse(stdout) as Vergleich;
			assert.equal(seiten, fertig.meta.seiten, referenz);
			for (const { abweichung, groesse, seite } of vergleich) {
				assert.ok(groesse, `${referenz} Seite ${seite}: andere Bildgröße`);
				assert.equal(
					abweichung,
					null,
					`${referenz} Seite ${seite}: Abweichung in ${JSON.stringify(abweichung)}`,
				);
			}
		}
	});
	// Seitenfläche bis an den Blattrand, in Vorschau und PDF gleich
	const ECKE = `
import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert("RGB")
print(a.getpixel((1, 1)))
`;

	for (const flaeche of [
		{ art: 'verlauf', f1: '#3a86ff', f2: '#2e7d63', winkel: 135, sw: 'grau' },
		{ art: 'muster', f1: '#3a86ff', f2: '#1d1d1b', muster: 'karo', musterGroesse: 20, sw: 'grau' },
	] as const satisfies readonly Seitenflaeche[]) {
		it(
			`druckt eine Seitenfläche „${flaeche.art}“ pixelgleich bis an den Blattrand`,
			{ timeout: 180_000 },
			async (t) => {
				if (chromiumFehlt) {
					t.skip(BROWSER_HINWEIS);
					return;
				}
				const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
				const datei = path.join(dir, 'material.html');
				const mitFlaeche = setzeSeitenflaeche(await readFile(datei, 'utf8'), 'alle', flaeche);
				await writeFile(datei, setzeSeitenrahmen(mitFlaeche, 'alle', { art: 'doppelt', farbe: '#1d1d1b' }));
				const fertig = await fertigstellen(s.kontext.konfig, { mappe, dok });
				const { token } = await legeFreigabeAn(s.materialDir, { mappe, dok });
				const ziel = await mkdtemp(path.join(tmpdir(), 'schoolbox-pixel-'));
				const referenz = path.join(dir, 'ausgabe', 'material');
				const { stdout } = await ausfuehren(python, [
					'-c',
					VERGLEICH,
					skripte,
					`${s.url}/f/${token}/ansicht/${mappe}/dokumente/${dok}/`,
					ziel,
					referenz,
				]);
				const { seiten, vergleich } = JSON.parse(stdout) as Vergleich;
				assert.equal(seiten, fertig.meta.seiten);
				for (const { abweichung, groesse, seite } of vergleich) {
					assert.ok(groesse, `Seite ${seite}: andere Bildgröße`);
					assert.equal(abweichung, null, `Seite ${seite}: Abweichung in ${JSON.stringify(abweichung)}`);
				}
				// Die Ecke des Blatts ist nicht weiß: Die Fläche reicht über das padding der Seite hinaus.
				const ecke = await ausfuehren(python, ['-c', ECKE, `${referenz}-s1.png`]);
				assert.notEqual(ecke.stdout.trim(), '(255, 255, 255)');
			},
		);
	}

	// Älteres Blatt mit Rezept (bis 180): Kopfband, Titelfarbe und Fläche kommen allein aus blatt.css und den Teilen.
	const BESTAND = path.join(WURZEL, 'schoolbox', 'kern', 'src', 'testdaten', 'bestand-aufmachung.html');
	const PUNKT = `
import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert("RGB")
print(a.getpixel((int(sys.argv[2]), int(sys.argv[3]))))
`;

	for (const profil of ['farbe', 'sw'] as const) {
		it(`druckt ein älteres Blatt mit Rezept in ${profil} pixelgleich`, { timeout: 180_000 }, async (t) => {
			if (chromiumFehlt) {
				t.skip(BROWSER_HINWEIS);
				return;
			}
			const { dir, dok, mappe } = await legeDokumentAn(s.materialDir);
			// Die Probe ist in Farbe; für s/w kommt die Profilklasse an die Stelle von Farbe und Palette.
			const probe = await readFile(BESTAND, 'utf8');
			const quelle =
				profil === 'farbe'
					? probe
					: probe.replace('<body class="kl2 farbe palette-himmel"', '<body class="kl2 sw"');
			assert.ok(profil === 'farbe' || quelle !== probe, 'Profilklasse umgestellt');
			await writeFile(path.join(dir, 'material.html'), quelle);
			const fertig = await fertigstellen(s.kontext.konfig, { mappe, dok });
			const { token } = await legeFreigabeAn(s.materialDir, { mappe, dok });
			const ziel = await mkdtemp(path.join(tmpdir(), 'schoolbox-pixel-'));
			const referenz = path.join(dir, 'ausgabe', 'material');
			const { stdout } = await ausfuehren(python, [
				'-c',
				VERGLEICH,
				skripte,
				`${s.url}/f/${token}/ansicht/${mappe}/dokumente/${dok}/`,
				ziel,
				referenz,
			]);
			const { seiten, vergleich } = JSON.parse(stdout) as Vergleich;
			assert.equal(seiten, fertig.meta.seiten);
			for (const { abweichung, groesse, seite } of vergleich) {
				assert.ok(groesse, `Seite ${seite}: andere Bildgröße`);
				assert.equal(abweichung, null, `Seite ${seite}: Abweichung in ${JSON.stringify(abweichung)}`);
			}
			// Oben am Blattrand liegt in Farbe das Kopfband über der Fläche, in s/w ist dort weiß. Das Band ist dunkler als
			// die helle Fläche (#eef5fc): Fehlt seine Regel in blatt.css, schlägt die Probe in Farbe fehl.
			const oben = await ausfuehren(python, ['-c', PUNKT, `${referenz}-s1.png`, '400', '4']);
			if (profil === 'farbe') {
				const summe = (oben.stdout.match(/\d+/g) ?? []).map(Number).reduce((a, b) => a + b, 0);
				assert.ok(summe < 600, `oben kein Kopfband: ${oben.stdout.trim()}`);
			} else {
				assert.equal(oben.stdout.trim(), '(255, 255, 255)');
			}
		});
	}
});
