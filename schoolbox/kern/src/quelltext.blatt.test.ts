import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { ASSETS, BLATT_PY } from './konfig';
import type { Knoten } from './quelltext';
import { klassenVon, schuetzeText, verschiebe, wendeAn, zerlege } from './quelltext';

const ausfuehren = promisify(execFile);
const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const chromiumFehlt = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

interface Bericht {
	seiten: unknown[];
	meldungen: { stufe: string; text: string }[];
}

const baue = async (ordner: string, name: string, html: string): Promise<Bericht> => {
	const datei = path.join(ordner, `${name}.html`);
	await writeFile(datei, html);
	const bericht = path.join(ordner, `${name}.json`);
	await ausfuehren('python3', [BLATT_PY, 'bauen', datei, '-o', path.join(ordner, name), '--bericht', bericht]);
	return JSON.parse(await readFile(bericht, 'utf8')) as Bericht;
};

/** Wie der Editor: Text ändern und eine Aufgabe nach vorn ziehen, nur über Text-Patches. */
const bearbeite = (quelle: string) => {
	let z = zerlege(quelle);
	const h1 = z.knoten.find((k) => k.tag === 'h1') as Knoten;
	let html = wendeAn(quelle, [{ von: h1.oeffnerEnde, bis: h1.schliesserStart, text: schuetzeText('Uhr & „ß“') }]);
	z = zerlege(html);
	const aufgaben = z.knoten.filter((k) => klassenVon(k).includes('aufgabe'));
	const [erste, , dritte] = aufgaben;
	if (erste && dritte) {
		html = wendeAn(html, verschiebe(z, dritte, erste, 'vor'));
	}
	return html;
};

describe('blatt.py auf im Editor bearbeiteten Dateien', () => {
	it('baut wie vorher, ohne Fehler und mit derselben Seitenzahl', { timeout: 300_000 }, async (t) => {
		if (chromiumFehlt()) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-editor-blatt-'));
		for (const name of ['vorlage-arbeitsblatt', 'beispiel-zehner-einer-kl2']) {
			const quelle = await readFile(path.join(ASSETS, `${name}.html`), 'utf8');
			const vorher = await baue(ordner, `${name}-vorher`, quelle);
			const nachher = await baue(ordner, `${name}-nachher`, bearbeite(quelle));
			assert.equal(nachher.seiten.length, vorher.seiten.length, name);
			assert.deepEqual(
				nachher.meldungen.filter((m) => m.stufe === 'FEHLER'),
				vorher.meldungen.filter((m) => m.stufe === 'FEHLER'),
				name,
			);
			const html = await readFile(path.join(ordner, `${name}-nachher`, `${name}-nachher.html`), 'utf8');
			assert.match(html, /<h1>Uhr &amp; „ß“<\/h1>/);
		}
	});
});
