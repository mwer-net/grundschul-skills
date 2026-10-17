/**
 * Bilder im Editor (017): Uploads aufnehmen, Graustufen-Fassungen anlegen, die Bildersammlung zusammenstellen und
 * Bilder aus ihr ins Dokument übernehmen. Pillow erledigt die Bildarbeit (`kern/bild.py`). Bilder werden nie
 * überschrieben und nie gelöscht: Ältere Versionen des Materials verweisen noch auf sie.
 */

import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { dokumentDir, mappenDir, pruefeId, sammleMappen } from './ablage';
import { kopiereAtomar, schreibeAtomar } from './atomar';
import { fuehreAus } from './bauen';
import type { Sammlung, SammlungsBild } from './bildbefehle';
import { MAX_BILD_BYTES } from './bildbefehle';
import { SchoolboxFehler } from './fehler';
import type { Konfig } from './konfig';
import { ASSETS, BILD_PY } from './konfig';
import { liegtIn, sucheRessource } from './pfade';
import { attribut, zerlege } from './quelltext';
import { eindeutigeId, slug } from './slug';

/** Schlüssel der Sammlung beginnen so, wenn das Bild in assets/ liegt; sonst mit der Mappen-ID. */
export const ASSETS_SCHLUESSEL = '_assets';
const BILDER = 'bilder';
const BILD_DATEI = /\.(png|jpe?g|gif|webp|svg)$/i;
/** Namen, die Kameras vergeben (IMG_1234, image, DSC0001), sagen nichts über das Bild. */
const GERAETENAME = /^(img|image|dscn?|pxl|photo)(-?\d.*)?$/;

export interface Bild {
	/** Für das `src` im Material, relativ zum Dokument. */
	src: string;
	breite: number;
	hoehe: number;
}

const ungueltig = () => new SchoolboxFehler('Dieses Bild gibt es nicht.');

const stammVon = (datei: string) => path.basename(datei, path.extname(datei));

export const bildStamm = (datei: string) => {
	const stamm = slug(stammVon(datei), 40);
	if (!stamm) {
		return 'bild';
	}
	return GERAETENAME.test(stamm) ? 'foto' : stamm;
};

/** Ein freier Name in `bilder/`, auch nicht wie eins aus assets/bilder: Das Dokument würde es sonst verdecken. */
const freierStamm = async (bilderDir: string, wunsch: string) => {
	const vorhanden = await Promise.all([bilderDir, path.join(ASSETS, BILDER)].map((d) => readdir(d).catch(() => [])));
	const belegt = new Set(vorhanden.flat().map(stammVon));
	return eindeutigeId(wunsch, (k) => belegt.has(k));
};

const verarbeite = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	befehl: 'aufnehmen' | 'graustufen',
	eingabe: string | Buffer,
	bilderDir: string,
	wunsch: string,
) => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-bild-'));
	try {
		let datei = eingabe;
		if (typeof datei !== 'string') {
			await writeFile(path.join(tmp, 'eingabe'), datei);
			datei = path.join(tmp, 'eingabe');
		}
		const lauf = await fuehreAus(konfig.pythonBin, [BILD_PY, befehl, datei, path.join(tmp, 'bild')]).catch(
			(fehler: Error) => {
				throw new SchoolboxFehler(`Pillow ließ sich nicht starten (${konfig.pythonBin}): ${fehler.message}`, 3);
			},
		);
		if (lauf.code === 2) {
			throw new SchoolboxFehler(
				'Dieses Bild kann die Schoolbox nicht lesen. Bitte als JPEG oder PNG speichern und noch einmal versuchen.',
			);
		}
		if (lauf.code !== 0) {
			throw new SchoolboxFehler(`Das Bild ließ sich nicht verarbeiten: ${lauf.stderr || lauf.stdout}`, 3);
		}
		const ergebnis = JSON.parse(lauf.stdout) as { datei: string; breite: number; hoehe: number };
		await mkdir(bilderDir, { recursive: true });
		const name = `${await freierStamm(bilderDir, wunsch)}${path.extname(ergebnis.datei)}`;
		await kopiereAtomar(ergebnis.datei, path.join(bilderDir, name));
		return { src: `${BILDER}/${name}`, breite: ergebnis.breite, hoehe: ergebnis.hoehe };
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/**
 * Ein hochgeladenes Bild nach `dokumente/<dok>/bilder/`: ohne Metadaten (vor allem ohne GPS-Ort), höchstens
 * 2400 px an der längsten Kante, PNG bei Transparenz, sonst JPEG. Der Name kommt aus dem Dateinamen.
 */
export const nimmBildAuf = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	dokDir: string,
	daten: Buffer,
	dateiname: string,
): Promise<Bild> => {
	if (daten.length === 0) {
		throw new SchoolboxFehler('Die Datei ist leer.');
	}
	if (daten.length > MAX_BILD_BYTES) {
		throw new SchoolboxFehler('Das Bild ist zu groß (höchstens 25 MB).');
	}
	return verarbeite(konfig, 'aufnehmen', daten, path.join(dokDir, BILDER), bildStamm(dateiname));
};

/** Die Datei hinter einem `src` des Dokuments; nur Bilder in seiner Mappe oder in assets/. */
export const findeBild = (materialDir: string, mappe: string, dok: string, src: string) => {
	if (/^([a-z][a-z0-9+.-]*:|\/)/i.test(src)) {
		throw new SchoolboxFehler('Dieses Bild liegt nicht in der Schoolbox.');
	}
	const datei = sucheRessource(src, dokumentDir(materialDir, mappe, dok));
	const grenzen = [mappenDir(materialDir, mappe), ASSETS].map((g) => realpathSync(g));
	if (datei === null || !BILD_DATEI.test(datei) || !grenzen.some((g) => liegtIn(datei, g))) {
		throw ungueltig();
	}
	return datei;
};

/** Legt eine Graustufen-Fassung neben die Bilder des Dokuments (`willi-grau.png`); das Original bleibt. */
export const wandleInGraustufen = async (
	konfig: Pick<Konfig, 'materialDir' | 'pythonBin'>,
	mappe: string,
	dok: string,
	src: string,
): Promise<Bild> => {
	const datei = findeBild(konfig.materialDir, mappe, dok, src);
	const bilderDir = path.join(dokumentDir(konfig.materialDir, mappe, dok), BILDER);
	return verarbeite(konfig, 'graustufen', datei, bilderDir, `${bildStamm(datei)}-grau`);
};

/** Kopiert ein Bild in `bilder/` des Dokuments; liegt dort schon dasselbe unter demselben Namen, bleibt es dabei. */
const kopiereHerein = async (datei: string, bilderDir: string) => {
	await mkdir(bilderDir, { recursive: true });
	const inhalt = await readFile(datei);
	const gleich = path.join(bilderDir, path.basename(datei));
	if (existsSync(gleich) && (await readFile(gleich)).equals(inhalt)) {
		return path.basename(datei);
	}
	const name = `${await freierStamm(bilderDir, bildStamm(datei))}${path.extname(datei).toLowerCase()}`;
	await schreibeAtomar(path.join(bilderDir, name), inhalt);
	return name;
};

const echt = (datei: string) => (existsSync(datei) ? realpathSync(datei) : null);

/**
 * Ein Bild aus der Sammlung für dieses Dokument. Was das Dokument schon erreicht (assets/bilder, `bilder/` der Mappe,
 * eigene Bilder), wird nur verlinkt; Bilder aus anderen Dokumenten und Mappen werden hineinkopiert, damit Kopien,
 * Teilen-Links und der Papierkorb sie nicht auseinanderreißen.
 */
export const uebernimmBild = async (
	materialDir: string,
	mappe: string,
	dok: string,
	schluessel: string,
): Promise<{ src: string }> => {
	const teile = schluessel.split('/');
	const name = teile.at(-1) ?? '';
	if (teile.some((t) => !t || t.startsWith('.') || t.includes('\\')) || !BILD_DATEI.test(name)) {
		throw ungueltig();
	}
	const dokDir = dokumentDir(materialDir, mappe, dok);
	const [anfang = '', ...rest] = teile;
	let datei: string;
	let grenze: string;
	if (anfang === ASSETS_SCHLUESSEL) {
		if (rest.length !== 2 || rest[0] !== BILDER) {
			throw ungueltig();
		}
		datei = path.join(ASSETS, ...rest);
		grenze = ASSETS;
		const src = rest.join('/');
		if (echt(datei) !== null && sucheRessource(src, dokDir) === echt(datei)) {
			return { src };
		}
	} else {
		pruefeId(anfang, 'Mappe');
		const inMappe = rest.length === 2 && rest[0] === BILDER;
		const imDokument = rest.length === 4 && rest[0] === 'dokumente' && rest[2] === BILDER;
		if (!inMappe && !imDokument) {
			throw ungueltig();
		}
		if (imDokument) {
			pruefeId(rest[1] ?? '', 'Dokument');
		}
		datei = path.join(mappenDir(materialDir, anfang), ...rest);
		grenze = mappenDir(materialDir, anfang);
		if (anfang === mappe && echt(datei) !== null && (inMappe || rest[1] === dok)) {
			return { src: inMappe ? `../../${BILDER}/${name}` : `${BILDER}/${name}` };
		}
	}
	const wirklich = echt(datei);
	if (wirklich === null || !liegtIn(wirklich, realpathSync(grenze))) {
		throw ungueltig();
	}
	return { src: `${BILDER}/${await kopiereHerein(wirklich, path.join(dokDir, BILDER))}` };
};

const bildDateien = async (ordner: string) =>
	(await readdir(ordner, { withFileTypes: true }).catch(() => []))
		.filter((e) => e.isFile() && !e.name.startsWith('.') && BILD_DATEI.test(e.name))
		.map((e) => path.join(ordner, e.name));

/** Merkt sich, unter welchen Beschreibungen die Bilder eines Materials vorkommen. */
const merkeAlt = (alt: Map<string, Set<string>>, html: string, dir: string) => {
	for (const k of zerlege(html).knoten) {
		const src = k.tag === 'img' ? attribut(k, 'src')?.wert : null;
		const text = attribut(k, 'alt')?.wert?.trim();
		const datei = src && text ? sucheRessource(src, dir) : null;
		if (datei && text) {
			alt.set(datei, new Set([...(alt.get(datei) ?? []), text]));
		}
	}
};

const leseText = (datei: string) => readFile(datei, 'utf8').catch(() => '');

/** Alles, was die Bildersammlung im Editor zeigt. */
export const sammleBilder = async (materialDir: string, mappeId: string): Promise<Sammlung> => {
	const { mappen } = await sammleMappen(materialDir);
	const alt = new Map<string, Set<string>>();
	for (const html of (await readdir(ASSETS)).filter((n) => n.endsWith('.html'))) {
		merkeAlt(alt, await leseText(path.join(ASSETS, html)), ASSETS);
	}
	const fundorte = await Promise.all(
		mappen.map(async ({ dokumente, mappe }) => {
			const dir = mappenDir(materialDir, mappe.id);
			const dokDirs = dokumente.map((d) => path.join(dir, 'dokumente', d.id));
			for (const dokDir of dokDirs) {
				merkeAlt(alt, await leseText(path.join(dokDir, 'material.html')), dokDir);
			}
			const ordner = [path.join(dir, BILDER), ...dokDirs.map((d) => path.join(d, BILDER))];
			return { mappe, dateien: (await Promise.all(ordner.map(bildDateien))).flat() };
		}),
	);
	const eintrag = (datei: string, schluessel: string, mappe?: string): SammlungsBild => ({
		schluessel,
		name: path.basename(datei),
		alt: [...(alt.get(realpathSync(datei)) ?? [])],
		...(mappe === undefined ? {} : { mappe }),
	});
	const nachName = (a: SammlungsBild, b: SammlungsBild) => a.name.localeCompare(b.name, 'de');
	const relativ = (datei: string) => path.relative(materialDir, datei).split(path.sep).join('/');

	const sammlung = (await bildDateien(path.join(ASSETS, BILDER)))
		.map((d) => eintrag(d, `${ASSETS_SCHLUESSEL}/${BILDER}/${path.basename(d)}`))
		.sort(nachName);
	const eigene = fundorte.find((f) => f.mappe.id === mappeId);
	const mappe = (eigene?.dateien ?? []).map((d) => eintrag(d, relativ(d))).sort(nachName);
	const fremde = fundorte
		.filter((f) => f.mappe.id !== mappeId)
		.flatMap((f) => f.dateien.map((d) => ({ d, titel: f.mappe.titel })));
	const zeiten = await Promise.all(fremde.map(({ d }) => stat(d).then((s) => s.mtimeMs)));
	const meine = fremde
		.map((f, i) => ({ ...f, zeit: zeiten[i] ?? 0 }))
		.sort((a, b) => b.zeit - a.zeit)
		.map(({ d, titel }) => eintrag(d, relativ(d), titel));
	return { sammlung, mappe, meine };
};
