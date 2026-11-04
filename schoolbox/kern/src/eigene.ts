/**
 * Eigene Vorlagen und Sammlung (051): nur Dateien im Materialordner, kein neues Datenmodell. Die Ordner beginnen mit `_`;
 * als Mappe gelten sie darum nicht (`ID_MUSTER`), und ins Repo kommen sie mit `materialien/` nie.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { dokumentDir, leseMeta, pruefeId } from './ablage';
import { schreibeAtomar, schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import type { KatalogEintrag } from './katalog';
import { eindeutigeId, slug } from './slug';
import type { Art, Format } from './werte';

type Ort = KatalogEintrag['ort'];

const VORLAGEN = '_vorlagen';
const SAMMLUNG = '_sammlung';
const VORLAGE_META = 'vorlage.json';
const BAUSTEIN_META = 'baustein.json';
const BILD = /^bilder\/[^/\\]+$/;

export interface EigeneVorlage {
	id: string;
	name: string;
	art: Art;
	format: Format;
	standard: boolean;
	erstellt: string;
}

export interface EigenerBaustein {
	id: string;
	name: string;
	ort: Ort;
	html: string;
	erstellt: string;
}

const vorlagenDir = (materialDir: string, id?: string) =>
	id === undefined ? path.join(materialDir, VORLAGEN) : path.join(materialDir, VORLAGEN, pruefeId(id, 'Vorlage'));
const sammlungDir = (materialDir: string, id?: string) =>
	id === undefined ? path.join(materialDir, SAMMLUNG) : path.join(materialDir, SAMMLUNG, pruefeId(id, 'Baustein'));

const leseAlle = async <T>(ordner: string, datei: string): Promise<T[]> => {
	const namen = await readdir(ordner).catch(() => []);
	const gelesen = await Promise.all(
		namen.map(async (n) => {
			try {
				return JSON.parse(await readFile(path.join(ordner, n, datei), 'utf8')) as T;
			} catch {
				// Ein halb geschriebener oder fremder Ordner ist keine Vorlage.
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

// ── Vorlagen ──

export const eigeneVorlagen = async (materialDir: string) =>
	(await leseAlle<EigeneVorlage>(vorlagenDir(materialDir), VORLAGE_META)).sort((a, b) =>
		a.name.localeCompare(b.name, 'de'),
	);

/** Der Inhalt einer eigenen Vorlage; `null`, wenn es sie nicht gibt. */
export const leseEigeneVorlage = async (materialDir: string, id: string) => {
	const dir = vorlagenDir(materialDir, id);
	if (!existsSync(path.join(dir, VORLAGE_META))) {
		return null;
	}
	const meta = JSON.parse(await readFile(path.join(dir, VORLAGE_META), 'utf8')) as EigeneVorlage;
	return { dir, meta, html: await readFile(path.join(dir, 'material.html'), 'utf8') };
};

export const speichereVorlage = async (
	materialDir: string,
	mappe: string,
	dok: string,
	name: string,
	jetzt = new Date(),
) => {
	const quelle = dokumentDir(materialDir, mappe, dok);
	const { art, format } = await leseMeta(materialDir, mappe, dok);
	const ablage = vorlagenDir(materialDir);
	await mkdir(ablage, { recursive: true });
	const id = eindeutigeId(slug(name) || 'vorlage', (k) => existsSync(path.join(ablage, k)));
	const bau = path.join(ablage, `.${id}.${randomBytes(4).toString('hex')}.tmp`);
	const vorlage: EigeneVorlage = { id, name, art, format, standard: false, erstellt: jetzt.toISOString() };
	try {
		await mkdir(bau);
		await cp(path.join(quelle, 'material.html'), path.join(bau, 'material.html'));
		if (existsSync(path.join(quelle, 'bilder'))) {
			await cp(path.join(quelle, 'bilder'), path.join(bau, 'bilder'), { recursive: true });
		}
		await schreibeJson(path.join(bau, VORLAGE_META), vorlage);
		await rename(bau, path.join(ablage, id));
	} catch (fehler) {
		await rm(bau, { recursive: true, force: true });
		throw fehler;
	}
	return vorlage;
};

/** Umbenennen; eine Vorlage als Standard markieren nimmt anderen derselben Art die Marke. */
export const aendereVorlage = async (
	materialDir: string,
	id: string,
	aenderung: { name?: string; standard?: boolean },
) => {
	const eintrag = await leseEigeneVorlage(materialDir, id);
	if (!eintrag) {
		throw new SchoolboxFehler('Diese Vorlage gibt es nicht mehr.');
	}
	const neu = { ...eintrag.meta, ...aenderung };
	if (aenderung.standard) {
		for (const andere of await eigeneVorlagen(materialDir)) {
			if (andere.id !== id && andere.art === neu.art && andere.standard) {
				await schreibeJson(path.join(vorlagenDir(materialDir, andere.id), VORLAGE_META), {
					...andere,
					standard: false,
				});
			}
		}
	}
	await schreibeJson(path.join(eintrag.dir, VORLAGE_META), neu);
	return neu;
};

export const loescheVorlage = (materialDir: string, id: string) =>
	rm(vorlagenDir(materialDir, id), { recursive: true, force: true });

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
