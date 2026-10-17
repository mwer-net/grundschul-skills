import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS, BLATT_PY } from './konfig';
import type { Meldung } from './meldungen';
import { MELDUNG_CODES } from './meldungen';

const TESTDATEN = path.join(__dirname, 'testdaten');
const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const chromiumFehlt = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

const pruefe = async (datei: string) => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-pruefung-'));
	const bericht = path.join(tmp, 'bericht.json');
	try {
		try {
			execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht], {
				stdio: 'ignore',
			});
		} catch {
			// Exit-Code 1 bei FEHLER; der Bericht steht trotzdem da.
		}
		return (JSON.parse(await readFile(bericht, 'utf8')) as { meldungen: Meldung[] }).meldungen;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

describe('pruefung.js (mit blatt.py)', () => {
	it('liefert dieselben Meldungstexte wie vor den Codes, jetzt mit Code und Zielen', async (t) => {
		if (chromiumFehlt()) {
			t.skip('kein Chromium für blatt.py gefunden');
			return;
		}
		const erwartet = JSON.parse(await readFile(path.join(TESTDATEN, 'pruefung-erwartet.json'), 'utf8')) as Record<
			string,
			Meldung[]
		>;
		const gesehen = new Set<string>();
		const berichte = new Map<string, Meldung[]>();
		for (const [name, meldungen] of Object.entries(erwartet)) {
			const datei = name.startsWith('pruefung-') ? path.join(TESTDATEN, name) : path.join(ASSETS, name);
			const bericht = await pruefe(datei);
			berichte.set(name, bericht);
			assert.deepEqual(
				bericht.map(({ seite, stufe, text }) => ({ stufe, seite, text })),
				meldungen,
				name,
			);
			for (const m of bericht) {
				assert.ok(m.code && MELDUNG_CODES.includes(m.code), `${name}: Code zu „${m.text}“`);
				assert.ok(Array.isArray(m.ziele), `${name}: Ziele zu „${m.text}“`);
				gesehen.add(m.code);
			}
		}
		const ueberlappung = berichte.get('pruefung-blatt.html')?.find((m) => m.code === 'ueberlappung');
		assert.deepEqual(
			ueberlappung?.ziele?.map((z) => z.name),
			['Erste Zeile', 'Zweite Zeile'],
		);
		assert.equal(ueberlappung?.ziele?.[0]?.sb, null, 'ohne Editor kein data-sb');
		assert.equal(ueberlappung?.ziele?.[0]?.rechteck.length, 4);
		const fehlt = MELDUNG_CODES.filter(
			(c) => !gesehen.has(c) && !['schrift-fehlt', 'pruefskript', 'loesung-fehlt', 'verweis'].includes(c),
		);
		assert.deepEqual(fehlt, [], 'jede Regel kommt in den Testdaten vor');
	});
});
