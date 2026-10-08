import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Version } from '@schoolbox/kern';
import {
	aktualisiereMappe,
	dokumentDir,
	legeVersionAn,
	leseMeta,
	pruefeFormat,
	schreibeAtomar,
	schreibeMeta,
} from '@schoolbox/kern';

import { HttpFehler } from './fehler';
import type { Bekannt, Kontext } from './kontext';
import { dokSchluessel, kennung, leseBekannt } from './kontext';

export const verlangeDokument = (kontext: Kontext, mappe: string, dok: string): string => {
	const dir = dokumentDir(kontext.konfig.materialDir, mappe, dok);
	if (!existsSync(path.join(dir, 'meta.json')) || !existsSync(path.join(dir, 'material.html'))) {
		throw new HttpFehler(404, `Das Dokument „${mappe}/${dok}“ gibt es nicht.`);
	}
	return dir;
};

/** `ausgabe/` ist veraltet, wenn material.html jünger ist als der letzte Prüfbericht von `blatt.py`. */
export const istAusgabeVeraltet = async (dir: string): Promise<boolean> => {
	const [quelle, bericht] = await Promise.all([
		stat(path.join(dir, 'material.html')),
		stat(path.join(dir, 'ausgabe', 'pruefbericht.json')).catch(() => null),
	]);
	return bericht === null || quelle.mtimeMs > bericht.mtimeMs;
};

export interface Aufnahme {
	vorher: Bekannt | undefined;
	jetzt: Bekannt;
	quelleNeu: boolean;
}

/**
 * Gleicht ein Dokument mit dem zuletzt bekannten Stand ab. Hat sich material.html geändert, ohne dass der Server
 * selbst geschrieben hat, war es Claude: Dafür entsteht eine Version mit Urheber `claude`. Nur innerhalb der Sperre
 * des Dokuments aufrufen.
 */
export const nimmFremdeAenderungAuf = async (kontext: Kontext, mappe: string, dok: string): Promise<Aufnahme> => {
	const schluessel = dokSchluessel(mappe, dok);
	const vorher = kontext.bekannt.get(schluessel);
	const jetzt = await leseBekannt(kontext, mappe, dok);
	const quelleNeu = vorher?.quelle !== jetzt.quelle;
	if (quelleNeu) {
		await legeVersionAn(dokumentDir(kontext.konfig.materialDir, mappe, dok), 'claude');
	}
	kontext.bekannt.set(schluessel, jetzt);
	return { vorher, jetzt, quelleNeu };
};

export interface Gespeichert {
	version: string;
	gesichert: Version | null;
}

/** Schreibt material.html im Auftrag der Lehrkraft. Nur innerhalb der Sperre des Dokuments aufrufen. */
export const schreibeQuelle = async (
	kontext: Kontext,
	mappe: string,
	dok: string,
	quelle: string,
	jetzt = new Date(),
): Promise<Gespeichert> => {
	const { materialDir } = kontext.konfig;
	const dir = dokumentDir(materialDir, mappe, dok);
	const meta = await leseMeta(materialDir, mappe, dok);
	pruefeFormat(meta, quelle, 'der neuen Fassung');
	await nimmFremdeAenderungAuf(kontext, mappe, dok);
	await schreibeAtomar(path.join(dir, 'material.html'), quelle);
	const gesichert = await legeVersionAn(dir, 'lehrkraft', jetzt);
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, mappe, dok, meta);
	await aktualisiereMappe(materialDir, mappe, jetzt);
	kontext.bekannt.set(dokSchluessel(mappe, dok), await leseBekannt(kontext, mappe, dok));
	const version = kennung(quelle);
	kontext.ereignisse.sende({ typ: 'dokument-geaendert', daten: { mappe, dok, version, urheber: 'lehrkraft' } });
	return { version, gesichert };
};

export const leseQuelle = async (dir: string) => readFile(path.join(dir, 'material.html'), 'utf8');
