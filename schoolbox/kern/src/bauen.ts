import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import type { Ziel } from './ablage';
import { aktualisiereMappe, dokumentDir, leseMeta, pruefeFormat, schreibeMeta } from './ablage';
import { SchoolboxFehler } from './fehler';
import { druckprofilAusHtml } from './html';
import type { Konfig } from './konfig';
import { BLATT_PY } from './konfig';
import type { DokumentMeta, Pruefung } from './schema';
import type { Version } from './versionen';
import { legeVersionAn } from './versionen';

const BAU_TIMEOUT_MS = 5 * 60 * 1000;

export interface Meldung {
	stufe: 'FEHLER' | 'WARNUNG' | 'HINWEIS';
	seite: number;
	text: string;
}

export interface Pruefbericht {
	seiten: unknown[];
	meldungen: Meldung[];
	fehler: number;
}

interface Lauf {
	code: number | null;
	stdout: string;
	stderr: string;
}

const fuehreAus = (befehl: string, argumente: string[]) =>
	new Promise<Lauf>((resolve, reject) => {
		const kind = spawn(befehl, argumente, { timeout: BAU_TIMEOUT_MS });
		let stdout = '';
		let stderr = '';
		kind.stdout.on('data', (teil: Buffer) => {
			stdout += teil.toString();
		});
		kind.stderr.on('data', (teil: Buffer) => {
			stderr += teil.toString();
		});
		kind.on('error', reject);
		kind.on('close', (code) => resolve({ code, stdout, stderr }));
	});

export const zaehle = (meldungen: Meldung[]): Pruefung => ({
	fehler: meldungen.filter((m) => m.stufe === 'FEHLER').length,
	warnungen: meldungen.filter((m) => m.stufe === 'WARNUNG').length,
	hinweise: meldungen.filter((m) => m.stufe === 'HINWEIS').length,
});

export interface Fertig {
	meta: DokumentMeta;
	bericht: Pruefbericht;
	version: Version | null;
	ausgabe: string;
	hinweiseBau: string[];
}

export const fertigstellen = async (
	konfig: Konfig,
	ziel: Ziel & { dok: string },
	jetzt = new Date(),
): Promise<Fertig> => {
	const { materialDir } = konfig;
	const meta = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	const dir = dokumentDir(materialDir, ziel.mappe, ziel.dok);
	const quelle = path.join(dir, 'material.html');
	const html = await readFile(quelle, 'utf8');
	pruefeFormat(meta, html, 'material.html');

	const ausgabe = path.join(dir, 'ausgabe');
	await rm(ausgabe, { recursive: true, force: true });
	await mkdir(ausgabe);
	const berichtDatei = path.join(ausgabe, 'pruefbericht.json');
	const lauf = await fuehreAus(konfig.pythonBin, [
		BLATT_PY,
		'bauen',
		quelle,
		'-o',
		ausgabe,
		'--bericht',
		berichtDatei,
	]).catch((fehler: Error) => {
		throw new SchoolboxFehler(`blatt.py ließ sich nicht starten (${konfig.pythonBin}): ${fehler.message}`, 3);
	});
	if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei)) {
		throw new SchoolboxFehler(
			`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
			3,
		);
	}
	const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;

	meta.status = 'fertig';
	meta.seiten = bericht.seiten.length;
	meta.pruefung = zaehle(bericht.meldungen);
	meta.hatLoesung = existsSync(path.join(ausgabe, 'material-loesung.pdf'));
	meta.druckprofil = druckprofilAusHtml(html) ?? meta.druckprofil;
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	const version = await legeVersionAn(dir, 'claude', jetzt);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);

	const hinweiseBau = [...new Set(lauf.stderr.split('\n').map((z) => z.trim()))].filter(Boolean);
	return { meta, bericht, version, ausgabe, hinweiseBau };
};
