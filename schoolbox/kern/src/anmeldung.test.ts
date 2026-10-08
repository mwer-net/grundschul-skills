import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseEnv } from 'node:util';

import { erzeugePasswortHash, istPasswortHash, pruefeNeuesPasswort, pruefePasswort, setzeEnvWerte } from './anmeldung';

describe('Passwort-Hash', () => {
	it('prüft richtig und falsch, Salz macht jeden Hash anders', async () => {
		const hash = await erzeugePasswortHash('drei-kleine-woerter', 10);
		assert.ok(istPasswortHash(hash));
		assert.match(hash, /^scrypt:10:8:1:[\w-]+:[\w-]+$/);
		assert.equal(await pruefePasswort('drei-kleine-woerter', hash), true);
		assert.equal(await pruefePasswort('drei-kleine-Woerter', hash), false);
		assert.notEqual(await erzeugePasswortHash('drei-kleine-woerter', 10), hash);
	});

	it('behandelt Umlaute unabhängig von der Unicode-Form', async () => {
		const hash = await erzeugePasswortHash('Grüße-aus-der-Schule', 10);
		assert.equal(await pruefePasswort('Grüße-aus-der-Schule', hash), true);
	});

	it('lehnt ungültige Hashes ab, ohne zu werfen', async () => {
		for (const falsch of ['', 'klartext', 'scrypt:30:8:1:abc:def', '$scrypt$x']) {
			assert.equal(istPasswortHash(falsch), false, falsch);
			assert.equal(await pruefePasswort('egal', falsch), false);
		}
	});

	it('verlangt mindestens 10 Zeichen', () => {
		assert.throws(() => pruefeNeuesPasswort('kurz'), /zu kurz/);
		assert.doesNotThrow(() => pruefeNeuesPasswort('lang-genug!'));
	});
});

describe('setzeEnvWerte', () => {
	it('ersetzt vorhandene Zeilen, entfernt Doppelte, hängt Neue an und lässt den Rest stehen', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-env-'));
		const datei = path.join(dir, '.env');
		await writeFile(datei, '# Kommentar\nPORT=4009\nPASSWORT_HASH=alt\nPASSWORT_HASH=noch-aelter\n', {
			mode: 0o640,
		});
		await setzeEnvWerte(datei, { PASSWORT_HASH: 'scrypt:10:8:1:a:b', SITZUNG_GEHEIMNIS: 'abc' });
		const text = await readFile(datei, 'utf8');
		assert.equal(text, '# Kommentar\nPORT=4009\nPASSWORT_HASH=scrypt:10:8:1:a:b\nSITZUNG_GEHEIMNIS=abc\n');
		assert.equal(parseEnv(text).PASSWORT_HASH, 'scrypt:10:8:1:a:b');
		assert.equal((await stat(datei)).mode & 0o777, 0o640);
	});

	it('legt eine fehlende .env mit Rechten 0600 an', async () => {
		const datei = path.join(await mkdtemp(path.join(tmpdir(), 'schoolbox-env-')), '.env');
		await setzeEnvWerte(datei, { PASSWORT_HASH: 'x' });
		assert.equal(await readFile(datei, 'utf8'), 'PASSWORT_HASH=x\n');
		assert.equal((await stat(datei)).mode & 0o777, 0o600);
	});
});
