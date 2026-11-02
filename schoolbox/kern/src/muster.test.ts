/**
 * Musterblätter (023): Jedes Blatt in `assets/muster/` wird in s/w, Farbe und als Lösung gebaut und muss die Prüfung
 * ohne FEHLER bestehen. So fällt ein Element auf, das über den Rand läuft oder sich mit Standardwerten nicht zeichnet.
 * Ein gewollter Fehler steht als `data-erwarteter-fehler="Text"` am Element.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { ASSETS, BLATT_PY } from './konfig';
import type { Meldung } from './meldungen';

const MUSTER = path.join(ASSETS, 'muster');
const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const hatBrowser = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-muster-'));
after(() => rmSync(ordner, { force: true, recursive: true }));

const pruefe = (html: string, name: string): Meldung[] => {
	const datei = path.join(ordner, `${name}.html`);
	const bericht = path.join(ordner, `${name}.json`);
	writeFileSync(datei, html);
	try {
		execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht], { stdio: 'ignore' });
	} catch {
		// Exit-Code 1 bei FEHLER; der Bericht steht trotzdem da.
	}
	return (JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: Meldung[] }).meldungen;
};

const fassungen = (html: string): Record<string, string> => {
	const farbe = html.replace(/(<body class="[^"]*)\bsw\b/, '$1farbe palette-himmel');
	const mitLoesung = (quelle: string) => quelle.replace(/<body class="/, '<body class="loesung ');
	return { 'sw': html, farbe, 'sw-loesung': mitLoesung(html), 'farbe-loesung': mitLoesung(farbe) };
};

const erwarteteFehler = (html: string) =>
	[...html.matchAll(/data-erwarteter-fehler="([^"]+)"/g)].map((t) => t[1] ?? '').sort();

const dateien = readdirSync(MUSTER).filter((d) => d.endsWith('.html'));

describe('Musterblätter', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	it('gibt es', () => {
		assert.ok(dateien.length > 0);
	});

	for (const datei of dateien) {
		const html = readFileSync(path.join(MUSTER, datei), 'utf8');
		for (const [fassung, quelle] of Object.entries(fassungen(html))) {
			it(`${datei} (${fassung}) besteht die Prüfung`, () => {
				const fehler = pruefe(quelle, `${datei}-${fassung}`)
					.filter((m) => m.stufe === 'FEHLER')
					.map((m) => m.text)
					.sort();
				assert.deepEqual(fehler, erwarteteFehler(html));
			});
		}
	}

	it('schlägt bei einem FEHLER im Musterblatt an', () => {
		const html = readFileSync(path.join(MUSTER, dateien[0] ?? ''), 'utf8');
		const kaputt = html.replace('</section>', '<x-zahlenstrahl von="5" bis="5"></x-zahlenstrahl></section>');
		const fehler = pruefe(kaputt, 'kaputt').filter((m) => m.stufe === 'FEHLER');
		assert.ok(fehler.some((m) => m.text.includes('Zahlenstrahl')));
	});
});
