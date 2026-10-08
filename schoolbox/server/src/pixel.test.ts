import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';

import { BLATT_PY, fertigstellen } from '@schoolbox/kern';

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

const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

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
		chromiumFehlt = await ausfuehren(python, ['-c', CHROMIUM_DA, skripte]).then(
			() => false,
			() => true,
		);
	});
	after(() => s.stop());

	it('druckt das Beispielblatt pixelgleich, als Blatt und als Lösung', { timeout: 180_000 }, async (t) => {
		if (chromiumFehlt) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const { dir, dok, mappe } = await legeDokumentAn(s.materialDir, { beispiel: true });
		const fertig = await fertigstellen(s.kontext.konfig, { mappe, dok });
		assert.equal(fertig.bericht.fehler, 0);
		const basis = `${s.url}/ansicht/${mappe}/dokumente/${dok}/`;
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
});
