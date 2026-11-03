import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { istTempDatei, kopiereAtomar, schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import { druckprofilAusHtml } from './html';
import { ASSETS, BLATT_PY } from './konfig';
import { sucheRessource } from './pfade';
import type { Druckprofil } from './werte';

/** Schlüssel des letzten Baus in `ausgabe/`; passt er zum Dokument, ist die Ausgabe aktuell. */
export const STAND_DATEI = 'stand.json';
/** Zwischenspeicher der s/w-Bilder (041): Überlebt jeden Bau, damit Mappen-PDFs nicht jedes Bild neu rechnen. */
const GRAU_CACHE = 'grau-cache';
/** Die jeweils andere Ansicht und der Zwischenspeicher überleben den Bau einer Ansicht (042). */
const BLEIBT = new Set([GRAU_CACHE, 'sw', 'farbe']);
export const PDF_DATEI = 'material.pdf';
export const LOESUNG_PDF_DATEI = 'material-loesung.pdf';
/** Eigenständige HTML-Datei aus blatt.py; bei Folien die Offline-Präsentation. */
export const HTML_DATEI = 'material.html';

/** Zusätze für Folien, die blatt.py nur auf Wunsch baut (`--schritte`, `--notizen`). */
export type FolienZusatz = 'schritte' | 'notizen';
export const zusatzPdfDatei = (art: FolienZusatz) => `material-${art}.pdf`;
export const zusatzBerichtDatei = (art: FolienZusatz) => `pruefbericht-${art}.json`;
export const zusatzStandDatei = (art: FolienZusatz) => `stand-${art}.json`;

/** Dieselben Verweise, die `einbetten()` in blatt.py auflöst. */
const VERWEISE = [
	/<link[^>]+href="([^"]+\.css)"[^>]*>/g,
	/<script[^>]+src="([^"]+\.js)"[^>]*>\s*<\/script>/g,
	/<img[^>]+src="([^"]+)"/g,
];
const CSS_URL = /url\((?!data:)([^)]+)\)/g;
const EXTERN = /^(data|https?):/;

const ohneAnfuehrung = (name: string) => name.trim().replace(/^["']|["']$/g, '');

/** Alle Dateien, die in den Bau eingehen, in fester Reihenfolge; `null`, wo blatt.py nichts findet. */
const ressourcen = async (html: string, dokDir: string): Promise<[string, string | null][]> => {
	const gefunden: [string, string | null][] = [];
	const namen = VERWEISE.flatMap((muster) => [...html.matchAll(muster)].map((m) => m[1] ?? ''));
	for (const name of namen.filter((n) => n && !EXTERN.test(n))) {
		const datei = sucheRessource(name, dokDir);
		gefunden.push([name, datei]);
		if (datei !== null && datei.endsWith('.css')) {
			const css = await readFile(datei, 'utf8');
			for (const [, roh = ''] of css.matchAll(CSS_URL)) {
				const unter = ohneAnfuehrung(roh);
				gefunden.push([unter, sucheRessource(unter, path.dirname(datei))]);
			}
		}
	}
	return gefunden;
};

/**
 * Hash über alles, was das PDF bestimmt: material.html, eingebundene Stylesheets (samt Schriften), Skripte und
 * Bilder, dazu blatt.py, pruefung.js, graustufen.js und praesentation.js (steckt in der Offline-Präsentation und den
 * Zusätzen für Folien). Ein bloßes `touch` ändert ihn nicht.
 */
const STRICH_ENDUNGEN = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

export const ausgabeSchluessel = async (dokDir: string, profil?: Druckprofil): Promise<string> => {
	const html = await readFile(path.join(dokDir, 'material.html'));
	const hash = createHash('sha256').update(html);
	const text = html.toString('utf8');
	const dateien = await ressourcen(text, dokDir);
	const quelleProfil = druckprofilAusHtml(text);
	if (profil !== undefined && profil !== (quelleProfil ?? 'farbe')) {
		hash.update(`\0profil\0${profil}`);
	}
	if ((profil ?? quelleProfil) === 'sw') {
		for (const [name, datei] of dateien) {
			if (datei !== null) {
				for (const endung of STRICH_ENDUNGEN) {
					const strich = datei.replace(/\.[^./]+$/, `-strich${endung}`);
					if (existsSync(strich)) {
						hash.update(`\0strich\0${name}\0`);
						hash.update(await readFile(strich));
					}
				}
			}
		}
	}
	for (const [name, datei] of [
		...dateien,
		['blatt.py', BLATT_PY],
		['pruefung.js', path.join(ASSETS, 'pruefung.js')],
		['praesentation.js', path.join(ASSETS, 'praesentation.js')],
		['graustufen.js', path.join(ASSETS, 'graustufen.js')],
	] as const) {
		hash.update(`\0${name}\0`);
		hash.update(datei === null ? 'fehlt' : await readFile(datei).catch(() => 'fehlt'));
	}
	return hash.digest('hex').slice(0, 32);
};

/**
 * Ordner einer Ansicht: Was die Quelle selbst vorgibt, liegt wie immer in `ausgabe/`, die andere Ansicht in
 * `ausgabe/sw/` bzw. `ausgabe/farbe/`. So überschreiben sich Zwischenspeicher und Dateien nicht (042).
 */
export const ausgabeOrdner = async (dokDir: string, profil?: Druckprofil): Promise<string> => {
	const ausgabe = path.join(dokDir, 'ausgabe');
	if (profil === undefined) {
		return ausgabe;
	}
	const quelle = druckprofilAusHtml(await readFile(path.join(dokDir, 'material.html'), 'utf8')) ?? 'farbe';
	return profil === quelle ? ausgabe : path.join(ausgabe, profil);
};

export const leseStand = async (ausgabe: string, datei = STAND_DATEI): Promise<string | null> => {
	try {
		const { schluessel } = JSON.parse(await readFile(path.join(ausgabe, datei), 'utf8')) as {
			schluessel?: unknown;
		};
		return typeof schluessel === 'string' ? schluessel : null;
	} catch {
		return null;
	}
};

export const schreibeStand = (ausgabe: string, schluessel: string, datei = STAND_DATEI) =>
	schreibeJson(path.join(ausgabe, datei), { schluessel });

/** Ist `ausgabe/` der Bau des jetzigen Dokuments (gleicher Schlüssel, PDF vorhanden)? */
export const istAusgabeAktuell = async (dokDir: string): Promise<boolean> => {
	const ausgabe = path.join(dokDir, 'ausgabe');
	const [stand, schluessel] = await Promise.all([leseStand(ausgabe), ausgabeSchluessel(dokDir)]);
	return stand === schluessel && existsSync(path.join(ausgabe, PDF_DATEI));
};

/**
 * Übernimmt einen Bau aus einem temporären Ordner nach `<dokDir>/ausgabe/`: jede Datei atomar, Reste des alten Baus
 * weg, `stand.json` zuletzt. Liegt das Dokument inzwischen im Papierkorb, entsteht hier kein Ordner neu (er stünde
 * dem Wiederherstellen im Weg); darum wird nie rekursiv angelegt.
 */
export const uebernehmeAusgabe = async (von: string, dokDir: string, schluessel: string, ziel?: string) => {
	if (!existsSync(path.join(dokDir, 'material.html'))) {
		throw new SchoolboxFehler('Das Dokument gibt es nicht mehr.', 3);
	}
	const haupt = path.join(dokDir, 'ausgabe');
	const ausgabe = ziel ?? haupt;
	for (const ordner of [haupt, ausgabe]) {
		if (!existsSync(ordner)) {
			await mkdir(ordner);
		}
	}
	await rm(path.join(ausgabe, STAND_DATEI), { force: true });
	const neu = await readdir(von);
	for (const name of neu) {
		await kopiereAtomar(path.join(von, name), path.join(ausgabe, name));
	}
	const reste = (await readdir(ausgabe)).filter((n) => !neu.includes(n) && !istTempDatei(n) && !BLEIBT.has(n));
	await Promise.all(reste.map((n) => rm(path.join(ausgabe, n), { recursive: true, force: true })));
	await schreibeStand(ausgabe, schluessel);
};

/**
 * Fügt PDFs in dieser Reihenfolge zu einer Datei zusammen (`pdfunite` aus poppler-utils; unterschiedliche
 * Seitenformate bleiben erhalten). Die Datei erscheint erst fertig unter `ziel`.
 */
export const fuegePdfsZusammen = async (teile: string[], ziel: string) => {
	const tmp = path.join(path.dirname(ziel), `.${path.basename(ziel)}.${process.pid}.${Date.now()}.tmp`);
	try {
		if (teile.length === 1 && teile[0] !== undefined) {
			await kopiereAtomar(teile[0], tmp);
		} else {
			await new Promise<void>((resolve, reject) => {
				const kind = spawn('pdfunite', [...teile, tmp]);
				let stderr = '';
				kind.stderr.on('data', (teil: Buffer) => {
					stderr += teil.toString();
				});
				kind.on('error', (fehler: Error & { code?: string }) =>
					reject(
						new SchoolboxFehler(
							fehler.code === 'ENOENT'
								? 'pdfunite fehlt (Paket poppler-utils).'
								: `pdfunite: ${fehler.message}`,
							3,
						),
					),
				);
				kind.on('close', (code) =>
					code === 0 ? resolve() : reject(new SchoolboxFehler(`pdfunite (Exit ${code}): ${stderr}`, 3)),
				);
			});
		}
		await rename(tmp, ziel);
	} catch (fehler) {
		await rm(tmp, { force: true });
		throw fehler;
	}
};
