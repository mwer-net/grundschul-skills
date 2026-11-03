import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { browserSkip, pruefeStapel } from './browsertest';
import { ASSETS, BLATT_PY } from './konfig';

const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-stapeltest-'));
after(() => rmSync(ordner, { force: true, recursive: true }));

const einzeln = (quelle: string) => {
	const bericht = `${quelle}.json`;
	try {
		execFileSync('python3', ['-B', BLATT_PY, 'bauen', quelle, '--nur-pruefen', '--bericht', bericht], {
			stdio: 'ignore',
		});
	} catch {
		// Exit-Code 1 bei FEHLER; der Bericht steht trotzdem da.
	}
	return (JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: unknown }).meldungen;
};

describe('Prüfung im Stapel', { skip: browserSkip() }, () => {
	it('meldet dasselbe wie blatt.py, auch einen FEHLER', () => {
		const muster = (name: string) => readFileSync(path.join(ASSETS, 'muster', name), 'utf8');
		const seiten = {
			sw: muster('deutsch.html'),
			farbe: muster('bausteine.html').replace(/(<body class="[^"]*)\bsw\b/, '$1farbe palette-himmel'),
			kaputt: muster('deutsch.html').replace(
				'</section>',
				'<x-zahlenstrahl von="5" bis="5"></x-zahlenstrahl></section>',
			),
		};
		const quellen = Object.entries(seiten).map(([name, html]) => {
			const datei = path.join(ordner, `${name}.html`);
			writeFileSync(datei, html);
			return datei;
		});
		const stapel = pruefeStapel(quellen);
		assert.ok(
			stapel[2]?.some((m) => m.stufe === 'FEHLER'),
			'Gegenprobe: Der kaputte Bogen hat einen FEHLER',
		);
		quellen.forEach((q, i) => assert.deepEqual(stapel[i], einzeln(q), path.basename(q)));
	});
});
