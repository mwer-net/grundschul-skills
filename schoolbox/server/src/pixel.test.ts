import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

import { BLATT_PY, fertigstellen, legeFreigabeAn, WURZEL } from '@schoolbox/kern';
import { BROWSER_HINWEIS, browserFehlt, imStapel } from '@schoolbox/kern/src/browsertest';
import { ASSETS } from '@schoolbox/kern/src/konfig';
import type { Kopfband, Seitenflaeche } from '@schoolbox/kern/src/seitengestaltung';
import {
	leseSeitengestaltung,
	seitenNummern,
	setzeKopfband,
	setzeSeitenflaeche,
	setzeSeitenrahmen,
} from '@schoolbox/kern/src/seitengestaltung';

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

	// Kopfband als Element (181). Punkte in CSS-px; die PNGs von blatt.py haben die doppelte Auflösung (skala 2).
	const PNG = 2;
	const FARBEN = `
import json, sys
from PIL import Image
a = Image.open(sys.argv[1]).convert("RGB")
print(json.dumps([a.getpixel((int(x), int(y))) for x, y in zip(sys.argv[2::2], sys.argv[3::2])]))
`;
	const GLEICH = `
import json, sys
from PIL import Image, ImageChops
a, b = Image.open(sys.argv[1]).convert("RGB"), Image.open(sys.argv[2]).convert("RGB")
print(json.dumps(ImageChops.difference(a, b).getbbox() if a.size == b.size else "andere Größe"))
`;
	/** Die Farben dieser Punkte (CSS-px) auf Seite 1. */
	const farbenAn = async (referenz: string, ...punkte: (readonly [number, number])[]) => {
		const zahlen = punkte.flatMap(([x, y]) => [String(Math.round(x * PNG)), String(Math.round(y * PNG))]);
		const { stdout } = await ausfuehren(python, ['-c', FARBEN, `${referenz}-s1.png`, ...zahlen]);
		return JSON.parse(stdout) as [number, number, number][];
	};
	/** Baut `quelle` in `dir` und gibt das Präfix der PNGs und die Zahl der Seiten zurück. */
	const baue = async (ziel: { dir: string; dok: string; mappe: string }, quelle: string) => {
		await writeFile(path.join(ziel.dir, 'material.html'), quelle);
		const fertig = await fertigstellen(s.kontext.konfig, { mappe: ziel.mappe, dok: ziel.dok });
		return { fertig, referenz: path.join(ziel.dir, 'ausgabe', 'material') };
	};
	/** Abweichung je Seite zwischen zwei Sätzen von PNGs (`null`: gleich). */
	const abweichungen = async (a: string, b: string, seiten: number) => {
		const ergebnis: unknown[] = [];
		for (let i = 1; i <= seiten; i++) {
			const { stdout } = await ausfuehren(python, ['-c', GLEICH, `${a}-s${i}.png`, `${b}-s${i}.png`]);
			ergebnis.push(JSON.parse(stdout));
		}
		return ergebnis;
	};
	const KOPFBAND_MELDUNGEN = new Set(['druckrand', 'aussen', 'verdeckt']);

	/** Misst im Chromium von blatt.py die Höhe des alten Bands, so wie `bestandHoehe` im Editor. */
	const MISS_BAND = `<script>addEventListener('load', async () => {
	await (window.blattBereit ?? 0);
	await document.fonts.ready;
	const seite = document.querySelector('.seite');
	const kopf = seite.querySelector('.kopf');
	const vor = getComputedStyle(kopf, '::before');
	const zahl = (w) => Number.parseFloat(w) || 0;
	const oben = seite.getBoundingClientRect().top + seite.clientTop;
	const kante = zahl(vor.getPropertyValue('--kopfband-kante'));
	const h = kopf.getBoundingClientRect().bottom - oben - zahl(vor.bottom) - kante;
	const pre = document.createElement('pre');
	pre.id = 'ergebnis';
	pre.textContent = String(Math.round(h * 100) / 100);
	document.body.appendChild(pre);
});</script>`;

	for (const profil of ['farbe', 'sw'] as const) {
		it(`wandelt das alte Band in ${profil} ohne abweichende Pixel um (181)`, { timeout: 300_000 }, async (t) => {
			if (chromiumFehlt) {
				t.skip(BROWSER_HINWEIS);
				return;
			}
			const ziel = await legeDokumentAn(s.materialDir);
			const probe = await readFile(BESTAND, 'utf8');
			const quelle =
				profil === 'farbe'
					? probe
					: probe.replace('<body class="kl2 farbe palette-himmel"', '<body class="kl2 sw"');
			assert.ok(profil === 'farbe' || quelle !== probe, 'Profilklasse umgestellt');
			// Gemessen wird in Farbe: In s/w ist das alte Band ausgeblendet, das Layout ist dasselbe.
			const messung = path.join(ziel.dir, 'messung.html');
			await writeFile(messung, probe.replace('</body>', `${MISS_BAND}\n</body>`));
			const [text] = imStapel([{ quelle: messung, element: 'ergebnis', pruefen: false }]);
			const hoehe = Number(text);
			assert.ok(hoehe > 100, `Höhe des alten Bands: ${text}`);

			const vorher = await baue(ziel, quelle);
			const seiten = vorher.fertig.meta.seiten;
			const ablage = await mkdtemp(path.join(tmpdir(), 'schoolbox-pixel-'));
			const probeBilder = path.join(ablage, 'probe');
			for (let i = 1; i <= seiten; i++) {
				await copyFile(`${vorher.referenz}-s${i}.png`, `${probeBilder}-s${i}.png`);
			}

			const band = leseSeitengestaltung(quelle, seitenNummern(quelle)[0] ?? 0).kopfband;
			assert.ok(band?.bestand, 'die Probe hat ein altes Band');
			const umgewandelt = (h: number) =>
				setzeKopfband(quelle, 'alle', {
					form: band.form,
					art: band.art,
					f1: band.f1,
					f2: band.f2,
					winkel: band.winkel,
					hoehe: h,
				});
			const neu = await baue(ziel, umgewandelt(hoehe));
			assert.equal(neu.fertig.meta.seiten, seiten);
			assert.deepEqual(await abweichungen(neu.referenz, probeBilder, seiten), Array(seiten).fill(null), 'PDF');
			assert.deepEqual(
				neu.fertig.bericht.meldungen.filter((m) => KOPFBAND_MELDUNGEN.has(m.code ?? '')),
				[],
				'Prüfung',
			);
			// Die Ansicht des umgewandelten Blatts gegen das PDF der Probe.
			const { token } = await legeFreigabeAn(s.materialDir, { mappe: ziel.mappe, dok: ziel.dok });
			const { stdout } = await ausfuehren(python, [
				'-c',
				VERGLEICH,
				skripte,
				`${s.url}/f/${token}/ansicht/${ziel.mappe}/dokumente/${ziel.dok}/`,
				await mkdtemp(path.join(tmpdir(), 'schoolbox-pixel-')),
				probeBilder,
			]);
			const { vergleich } = JSON.parse(stdout) as Vergleich;
			for (const { abweichung, groesse, seite } of vergleich) {
				assert.ok(groesse, `Ansicht Seite ${seite}: andere Bildgröße`);
				assert.equal(abweichung, null, `Ansicht Seite ${seite}: Abweichung in ${JSON.stringify(abweichung)}`);
			}
			// Gegenprobe: 10 px niedriger weicht ab. In s/w ist das Band weg, beide Höhen sehen gleich aus.
			if (profil === 'farbe') {
				const niedriger = await baue(ziel, umgewandelt(hoehe - 10));
				const [erste] = await abweichungen(niedriger.referenz, probeBilder, 1);
				assert.notEqual(erste, null);
			}
		});
	}

	it('blendet das alte Band aus, sobald ein Kopfband auf der Seite liegt (181)', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const ziel = await legeDokumentAn(s.materialDir);
		const gruen = setzeKopfband(await readFile(BESTAND, 'utf8'), 'alle', {
			form: 'welle',
			art: 'verlauf',
			f1: '#00ff00',
			f2: '#00ff00',
			hoehe: 224,
		});
		const mit = await baue(ziel, gruen);
		assert.deepEqual(await farbenAn(mit.referenz, [200, 2]), [[0, 255, 0]]);
		// Gegenprobe: ohne die Regel mit :has liegt das alte Band darüber. Eine blatt.css neben der Quelle geht vor.
		const css = await readFile(path.join(ASSETS, 'blatt.css'), 'utf8');
		const ohneHas = css
			.split('\n')
			.filter((z) => z !== '.seite:has(> .ebene > .kopfband) .kopf::before{display:none}')
			.join('\n');
		assert.notEqual(ohneHas, css);
		await writeFile(path.join(ziel.dir, 'blatt.css'), ohneHas);
		const ohne = await baue(ziel, gruen);
		assert.notDeepEqual(await farbenAn(ohne.referenz, [200, 2]), [[0, 255, 0]]);
	});

	it('druckt ein neues Kopfband, die Zacken unter der Höhe (181, 123)', { timeout: 300_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const ROT: Kopfband = { form: 'zacken', art: 'farbe', f1: '#ff0000', hoehe: 200 };
		// Kante bei A4 hoch 26 px, eine Zacke ist 1,4 Kanten breit; ihre Spitzen liegen bei 18,2 + n · 36,4 px.
		const KANTE = 26;
		const IM_BAND = [200, 195] as const;
		const AN_DER_SPITZE = [18.2 + 10 * 36.4, 200 + KANTE - 3] as const;
		const ziel = await legeDokumentAn(s.materialDir, { beispiel: true });
		const sw = await readFile(path.join(ziel.dir, 'material.html'), 'utf8');
		const farbe = sw.replace('<body class="kl2 sw"', '<body class="kl2 farbe"');
		assert.notEqual(farbe, sw);

		const inFarbe = await baue(ziel, setzeKopfband(farbe, 'alle', ROT));
		assert.deepEqual(await farbenAn(inFarbe.referenz, IM_BAND, AN_DER_SPITZE), [
			[255, 0, 0],
			[255, 0, 0],
		]);
		assert.deepEqual(
			inFarbe.fertig.bericht.meldungen.filter((m) => KOPFBAND_MELDUNGEN.has(m.code ?? '')),
			[],
			'Prüfung',
		);
		const inSw = await baue(ziel, setzeKopfband(sw, 'alle', ROT));
		assert.deepEqual(await farbenAn(inSw.referenz, IM_BAND), [[255, 255, 255]]);
		const grau = await baue(ziel, setzeKopfband(sw, 'alle', { ...ROT, sw: 'grau' }));
		const [[r, g, b] = []] = await farbenAn(grau.referenz, IM_BAND);
		assert.ok(r === g && g === b && (r ?? 255) < 200, `grau: ${JSON.stringify([r, g, b])}`);
		// Gegenprobe: Ohne calc endet das Band samt Zacken bei der Höhe, an der Spitze ist es weiß.
		const css = await readFile(path.join(ASSETS, 'blatt.css'), 'utf8');
		const ohneCalc = css.replace('height:calc(var(--h,160px) + var(--kopfband-kante))', 'height:var(--h,160px)');
		assert.notEqual(ohneCalc, css);
		await writeFile(path.join(ziel.dir, 'blatt.css'), ohneCalc);
		const kurz = await baue(ziel, setzeKopfband(farbe, 'alle', ROT));
		assert.deepEqual(await farbenAn(kurz.referenz, AN_DER_SPITZE), [[255, 255, 255]]);
	});
});
