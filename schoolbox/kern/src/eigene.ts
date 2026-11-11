/**
 * Sammlung „Meine Bausteine“ (051): nur Dateien im Materialordner, kein neues Datenmodell. Der Ordner beginnt mit `_`;
 * als Mappe gilt er darum nicht (`ID_MUSTER`), und ins Repo kommt er mit `materialien/` nie. Eigene Vorlagen gibt es
 * seit 137 nicht mehr; ein alter Ordner `_vorlagen` bleibt liegen und wird nicht gelesen.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { dokumentDir, pruefeId } from './ablage';
import { schreibeAtomar, schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import type { KatalogEintrag } from './katalog';
import { eindeutigeId, slug } from './slug';

type Ort = KatalogEintrag['ort'];

const SAMMLUNG = '_sammlung';
const BAUSTEIN_META = 'baustein.json';
const BILD = /^bilder\/[^/\\]+$/;

export interface EigenerBaustein {
	id: string;
	name: string;
	ort: Ort;
	html: string;
	erstellt: string;
}

const sammlungDir = (materialDir: string, id?: string) =>
	id === undefined ? path.join(materialDir, SAMMLUNG) : path.join(materialDir, SAMMLUNG, pruefeId(id, 'Baustein'));

const leseAlle = async <T>(ordner: string, datei: string): Promise<T[]> => {
	const namen = await readdir(ordner).catch(() => []);
	const gelesen = await Promise.all(
		namen.map(async (n) => {
			try {
				return JSON.parse(await readFile(path.join(ordner, n, datei), 'utf8')) as T;
			} catch {
				// Ein halb geschriebener oder fremder Ordner ist kein Baustein.
				return null;
			}
		}),
	);
	return gelesen.filter((g): g is Awaited<T> & T => g !== null);
};

/** Bildpfade in einem Stück Quelltext, die neben dem Dokument liegen; `bilder/willi.png` aus den Assets zählt nicht. */
export const bilderIn = (html: string, dir: string) =>
	[...new Set(html.match(/bilder\/[^"'\s;:)<>&/\\]+/g) ?? [])].filter((b) => existsSync(path.join(dir, b)));

const gleicheDatei = async (a: string, b: string) => {
	const [x, y] = await Promise.all([stat(a), stat(b)]);
	return x.size === y.size && (await readFile(a)).equals(await readFile(b));
};

/**
 * Kopiert Bilder neben ein anderes Dokument. Gleicher Name mit anderem Inhalt bekommt einen neuen Namen: Das liefert die
 * Rückgabe alt → neu, damit der Verweis nicht bricht und das Bild im Ziel erhalten bleibt.
 */
export const uebernimmBilder = async (vonDir: string, zuDir: string, bilder: readonly string[]) => {
	const umbenannt: Record<string, string> = {};
	await mkdir(path.join(zuDir, 'bilder'), { recursive: true });
	for (const bild of bilder) {
		if (!BILD.test(bild)) {
			throw new SchoolboxFehler(`„${bild}“ ist kein Bild aus dem Ordner bilder.`);
		}
		const von = path.join(vonDir, bild);
		if (!existsSync(von)) {
			throw new SchoolboxFehler(`Das Bild „${bild}“ gibt es nicht mehr.`);
		}
		let neu = bild;
		if (existsSync(path.join(zuDir, bild)) && !(await gleicheDatei(von, path.join(zuDir, bild)))) {
			const { ext, name } = path.parse(bild);
			neu = `bilder/${eindeutigeId(slug(name) || 'bild', (k) => existsSync(path.join(zuDir, 'bilder', `${k}${ext}`)))}${ext}`;
			umbenannt[bild] = neu;
		}
		await copyFile(von, path.join(zuDir, neu));
	}
	return umbenannt;
};

export const wendeBilderAn = (html: string, umbenannt: Record<string, string>) =>
	Object.entries(umbenannt).reduce((text, [alt, neu]) => text.split(alt).join(neu), html);

// ── Sammlung ──

export const eigeneBausteine = async (materialDir: string) =>
	(await leseAlle<EigenerBaustein>(sammlungDir(materialDir), BAUSTEIN_META)).sort((a, b) =>
		a.name.localeCompare(b.name, 'de'),
	);

export const sammlungsOrdner = (materialDir: string, id: string) => sammlungDir(materialDir, id);

export const legeInSammlung = async (
	materialDir: string,
	angaben: { mappe: string; dok: string; html: string; name: string; ort: Ort },
	jetzt = new Date(),
) => {
	const ablage = sammlungDir(materialDir);
	await mkdir(ablage, { recursive: true });
	const id = eindeutigeId(slug(angaben.name) || 'baustein', (k) => existsSync(path.join(ablage, k)));
	const dir = path.join(ablage, id);
	const quelle = dokumentDir(materialDir, angaben.mappe, angaben.dok);
	await mkdir(dir);
	const umbenannt = await uebernimmBilder(quelle, dir, bilderIn(angaben.html, quelle));
	const baustein: EigenerBaustein = {
		id,
		name: angaben.name,
		ort: angaben.ort,
		html: wendeBilderAn(angaben.html, umbenannt),
		erstellt: jetzt.toISOString(),
	};
	await schreibeJson(path.join(dir, BAUSTEIN_META), baustein);
	return baustein;
};

export const benenneBausteinUm = async (materialDir: string, id: string, name: string) => {
	const datei = path.join(sammlungDir(materialDir, id), BAUSTEIN_META);
	if (!existsSync(datei)) {
		throw new SchoolboxFehler('Diesen Baustein gibt es nicht mehr.');
	}
	const alt = JSON.parse(await readFile(datei, 'utf8')) as EigenerBaustein;
	await schreibeAtomar(datei, `${JSON.stringify({ ...alt, name }, null, '\t')}\n`);
};

export const loescheEigenenBaustein = (materialDir: string, id: string) =>
	rm(sammlungDir(materialDir, id), { recursive: true, force: true });
