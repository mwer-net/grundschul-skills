import type { ScryptOptions } from 'node:crypto';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

import { schreibeAtomar } from './atomar';
import { SchoolboxFehler } from './fehler';

export const MIN_PASSWORT = 10;
export const MAX_PASSWORT = 1024;
const STANDARD_LOG_N = 15;
const SCHLUESSEL_BYTES = 32;
const SALZ_BYTES = 16;
const HASH_MUSTER = /^scrypt:(\d{1,2}):(\d{1,2}):(\d{1,2}):([A-Za-z0-9_-]{22,}):([A-Za-z0-9_-]{43,})$/;

const leite = (passwort: string, salz: Buffer, laenge: number, optionen: ScryptOptions) =>
	new Promise<Buffer>((resolve, reject) => {
		scrypt(passwort.normalize('NFC'), salz, laenge, optionen, (fehler, schluessel) => {
			if (fehler) {
				reject(fehler);
			} else {
				resolve(schluessel);
			}
		});
	});

const optionenFuer = (logN: number, r: number, p: number): ScryptOptions => ({
	N: 2 ** logN,
	r,
	p,
	maxmem: 256 * 2 ** logN * r,
});

interface HashTeile {
	logN: number;
	r: number;
	p: number;
	salz: Buffer;
	schluessel: Buffer;
}

const zerlegeHash = (hash: string): HashTeile | null => {
	const [, logN, r, p, salz, schluessel] = HASH_MUSTER.exec(hash) ?? [];
	if (!logN || !r || !p || !salz || !schluessel) {
		return null;
	}
	const teile = {
		logN: Number(logN),
		r: Number(r),
		p: Number(p),
		salz: Buffer.from(salz, 'base64url'),
		schluessel: Buffer.from(schluessel, 'base64url'),
	};
	return teile.logN >= 10 && teile.logN <= 20 && teile.r >= 1 && teile.p >= 1 ? teile : null;
};

export const istPasswortHash = (hash: string) => zerlegeHash(hash) !== null;

/** `scrypt:<log2 N>:<r>:<p>:<Salz>:<Schlüssel>`, Base64url. Ohne `$`, damit weder .env noch Shell etwas ersetzen. */
export const erzeugePasswortHash = async (passwort: string, logN = STANDARD_LOG_N): Promise<string> => {
	const salz = randomBytes(SALZ_BYTES);
	const schluessel = await leite(passwort, salz, SCHLUESSEL_BYTES, optionenFuer(logN, 8, 1));
	return ['scrypt', logN, 8, 1, salz.toString('base64url'), schluessel.toString('base64url')].join(':');
};

export const pruefePasswort = async (passwort: string, hash: string): Promise<boolean> => {
	const teile = zerlegeHash(hash);
	if (!teile) {
		return false;
	}
	const { logN, p, r, salz, schluessel } = teile;
	const versuch = await leite(passwort, salz, schluessel.length, optionenFuer(logN, r, p));
	return timingSafeEqual(versuch, schluessel);
};

export const pruefeNeuesPasswort = (passwort: string) => {
	if ([...passwort].length < MIN_PASSWORT) {
		throw new SchoolboxFehler(
			`Das Passwort ist zu kurz (mindestens ${MIN_PASSWORT} Zeichen). Gut merkbar: drei Wörter mit Bindestrich.`,
		);
	}
	if (passwort.length > MAX_PASSWORT) {
		throw new SchoolboxFehler(`Das Passwort ist zu lang (höchstens ${MAX_PASSWORT} Zeichen).`);
	}
};

export const erzeugeGeheimnis = () => randomBytes(32).toString('hex');

const zeileVon = (schluessel: string) => new RegExp(`^\\s*(export\\s+)?${schluessel}\\s*=`);

/**
 * Setzt Werte in einer .env-Datei: ersetzt die erste Zeile des Schlüssels, entfernt weitere, hängt fehlende an.
 * Alles andere (Kommentare, Reihenfolge) bleibt. Die Dateirechte bleiben erhalten, eine neue Datei bekommt 0600.
 */
export const setzeEnvWerte = async (datei: string, werte: Record<string, string>) => {
	const bisher = await readFile(datei, 'utf8').catch(() => '');
	const modus = await stat(datei).then(
		(info) => info.mode & 0o777,
		() => 0o600,
	);
	let zeilen = bisher === '' ? [] : bisher.replace(/\n$/, '').split('\n');
	for (const [schluessel, wert] of Object.entries(werte)) {
		if (/[\s"'#\\]/.test(wert)) {
			throw new Error(`Wert für ${schluessel} enthält Zeichen, die in .env Anführungszeichen bräuchten.`);
		}
		const muster = zeileVon(schluessel);
		const erste = zeilen.findIndex((z) => muster.test(z));
		const neu = `${schluessel}=${wert}`;
		if (erste === -1) {
			zeilen.push(neu);
		} else {
			zeilen = zeilen.flatMap((z, i) => {
				if (i === erste) {
					return [neu];
				}
				return muster.test(z) ? [] : [z];
			});
		}
	}
	await schreibeAtomar(datei, `${zeilen.join('\n')}\n`, modus);
};
