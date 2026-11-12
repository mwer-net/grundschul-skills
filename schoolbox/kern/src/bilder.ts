/**
 * Bilder im Editor (017): Uploads aufnehmen, die Bildersammlung zusammenstellen und
 * Bilder aus ihr ins Dokument übernehmen. Pillow erledigt die Bildarbeit (`kern/bild.py`). Bilder werden nie
 * überschrieben und nie gelöscht: Ältere Versionen des Materials verweisen noch auf sie. Figuren zeigt die Sammlung
 * nicht; sie stehen in der Figurenbibliothek (177).
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
import {
	FIGUREN_ORDNER,
	figurenDir,
	figurenInhalte,
	gleichtFigur,
	leseBibliothek,
	strichNeben,
} from './figurenbibliothek';
import type { Konfig } from './konfig';
import { ASSETS, BILD_PY } from './konfig';
import { liegtIn, sucheRessource } from './pfade';
import { attribut, zerlege } from './quelltext';
import { eindeutigeId, slug } from './slug';

/** Schlüssel der Sammlung beginnen so, wenn das Bild in assets/ liegt; sonst mit der Mappen-ID. */
export const ASSETS_SCHLUESSEL = '_assets';
const BILDER = 'bilder';
const BILD_DATEI = /\.(png|jpe?g|gif|webp|svg)$/i;
const STRICH = '-strich';
/** Namen, die Kameras vergeben (IMG_1234, image, DSC0001), sagen nichts über das Bild. */
const GERAETENAME = /^(img|image|dscn?|pxl|photo)(-?\d.*)?$/;

export interface Bild {
	/** Für das `src` im Material, relativ zum Dokument. */
	src: string;
	breite: number;
	hoehe: number;
}

const ungueltig = () => new SchoolboxFehler('Dieses Bild gibt es nicht.');

/** Welche Datei im s/w-PDF für dieses Bild erscheint: entscheidet `blatt.py`, damit es nur eine Regel gibt (041). */
export const druckfassung = async (konfig: Pick<Konfig, 'pythonBin'>, dokDir: string, src: string) => {
	const datei = sucheRessource(src, dokDir);
	if (datei === null || ![realpathSync(dokDir), realpathSync(ASSETS)].some((ordner) => liegtIn(datei, ordner))) {
		return { strich: null };
	}
	const strich = await strichNeben(konfig, datei);
	return { strich: strich ? path.basename(strich) : null };
};

const stammVon = (datei: string) => path.basename(datei, path.extname(datei));

export const bildStamm = (datei: string) => {
	const stamm = slug(stammVon(datei), 40);
	if (!stamm) {
		return 'bild';
	}
	return GERAETENAME.test(stamm) ? 'foto' : stamm;
};

/**
 * Ein freier Name in `bilder/`, auch nicht wie eins aus assets/bilder: Das Dokument würde es sonst verdecken. Frei ist
 * er nur, wenn auch `<stamm>-strich` frei ist; sonst druckte `blatt.py` eine fremde Strichfassung (177).
 */
export const freierStamm = async (bilderDir: string, wunsch: string) => {
	const vorhanden = await Promise.all([bilderDir, path.join(ASSETS, BILDER)].map((d) => readdir(d).catch(() => [])));
	const belegt = new Set(vorhanden.flat().map(stammVon));
	return eindeutigeId(wunsch, (k) => belegt.has(k) || belegt.has(`${k}${STRICH}`));
};

const verarbeite = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	befehl: 'aufnehmen',
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

/**
 * Kopiert ein Bild in `bilder/` des Dokuments; liegt dort schon dasselbe unter demselben Namen, bleibt es dabei. Die
 * Strichfassung daneben (`blatt.py fassung`) kommt als `<stamm>-strich.*` mit, wenn sie dort noch fehlt.
 */
const kopiereHerein = async (konfig: Pick<Konfig, 'pythonBin'>, datei: string, bilderDir: string) => {
	await mkdir(bilderDir, { recursive: true });
	const inhalt = await readFile(datei);
	const strich = await strichNeben(konfig, datei);
	const gleich = path.join(bilderDir, path.basename(datei));
	let name = path.basename(datei);
	if (!existsSync(gleich) || !(await readFile(gleich)).equals(inhalt)) {
		name = `${await freierStamm(bilderDir, bildStamm(datei))}${path.extname(datei).toLowerCase()}`;
		await schreibeAtomar(path.join(bilderDir, name), inhalt);
	}
	if (strich) {
		const ziel = path.join(bilderDir, `${stammVon(name)}${STRICH}${path.extname(strich).toLowerCase()}`);
		if (!existsSync(ziel)) {
			await kopiereAtomar(strich, ziel);
		}
	}
	return name;
};

const echt = (datei: string) => (existsSync(datei) ? realpathSync(datei) : null);

/** Wo das Bild zu `teile` liegt und bis wohin es liegen darf; `src`, wenn das Dokument es ohne Kopie erreicht. */
const ortVon = (
	materialDir: string,
	mappe: string,
	dok: string,
	dokDir: string,
	teile: string[],
): { datei: string; grenze: string; src?: string } => {
	const [anfang = '', ...rest] = teile;
	if (anfang === ASSETS_SCHLUESSEL) {
		if (rest.length !== 2 || rest[0] !== BILDER) {
			throw ungueltig();
		}
		const datei = path.join(ASSETS, ...rest);
		const src = rest.join('/');
		if (echt(datei) !== null && sucheRessource(src, dokDir) === echt(datei)) {
			return { datei, grenze: ASSETS, src };
		}
		return { datei, grenze: ASSETS };
	}
	if (anfang === FIGUREN_ORDNER) {
		if (rest.length !== 1) {
			throw ungueltig();
		}
		return { datei: path.join(figurenDir(materialDir), ...rest), grenze: figurenDir(materialDir) };
	}
	pruefeId(anfang, 'Mappe');
	const inMappe = rest.length === 2 && rest[0] === BILDER;
	const imDokument = rest.length === 4 && rest[0] === 'dokumente' && rest[2] === BILDER;
	if (!inMappe && !imDokument) {
		throw ungueltig();
	}
	if (imDokument) {
		pruefeId(rest[1] ?? '', 'Dokument');
	}
	const datei = path.join(mappenDir(materialDir, anfang), ...rest);
	const grenze = mappenDir(materialDir, anfang);
	if (anfang === mappe && echt(datei) !== null && (inMappe || rest[1] === dok)) {
		const name = rest.at(-1) ?? '';
		return { datei, grenze, src: inMappe ? `../../${BILDER}/${name}` : `${BILDER}/${name}` };
	}
	return { datei, grenze };
};

/**
 * Ein Bild aus der Sammlung für dieses Dokument. Was das Dokument schon erreicht (assets/bilder, `bilder/` der Mappe,
 * eigene Bilder), wird nur verlinkt; Bilder aus anderen Dokumenten und Mappen werden hineinkopiert, damit Kopien,
 * Teilen-Links und der Papierkorb sie nicht auseinanderreißen.
 */
export const uebernimmBild = async (
	konfig: Pick<Konfig, 'pythonBin'>,
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
	const ort = ortVon(materialDir, mappe, dok, dokDir, teile);
	if (ort.src !== undefined) {
		return { src: ort.src };
	}
	const wirklich = echt(ort.datei);
	if (wirklich === null || !liegtIn(wirklich, realpathSync(ort.grenze))) {
		throw ungueltig();
	}
	return { src: `${BILDER}/${await kopiereHerein(konfig, wirklich, path.join(dokDir, BILDER))}` };
};

/** Die Bilder direkt im Ordner; eine Strichfassung nur, wenn ihre Farbfassung fehlt. */
const bildDateien = async (ordner: string) => {
	const namen = (await readdir(ordner, { withFileTypes: true }).catch(() => []))
		.filter((e) => e.isFile() && !e.name.startsWith('.') && BILD_DATEI.test(e.name))
		.map((e) => e.name);
	const staemme = new Set(namen.map(stammVon));
	const farbeDa = (stamm: string) => stamm.endsWith(STRICH) && staemme.has(stamm.slice(0, -STRICH.length));
	return namen.filter((n) => !farbeDa(stammVon(n))).map((n) => path.join(ordner, n));
};

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

/** Alles, was die Bildersammlung im Editor zeigt. Was einer Figur gleicht, steht nur unter `figuren` (177). */
export const sammleBilder = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	mappeId: string,
): Promise<Sammlung> => {
	const figuren = await leseBibliothek(konfig, materialDir);
	const inhalte = await figurenInhalte(materialDir);
	/** Je Datei die Änderungszeit („Meine Bilder“: neueste zuerst); was einer Figur gleicht, fällt weg. */
	const ohneFigurdateien = async (dateien: string[]) => {
		const gesehen = await Promise.all(
			dateien.map(async (d) => {
				const info = await stat(d);
				return (await gleichtFigur(inhalte, d, info)) ? [] : [{ d, zeit: info.mtimeMs }];
			}),
		);
		return gesehen.flat();
	};
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
			return { mappe, dateien: await ohneFigurdateien((await Promise.all(ordner.map(bildDateien))).flat()) };
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

	const sammlung = (await ohneFigurdateien(await bildDateien(path.join(ASSETS, BILDER))))
		.map(({ d }) => eintrag(d, `${ASSETS_SCHLUESSEL}/${BILDER}/${path.basename(d)}`))
		.sort(nachName);
	const eigene = fundorte.find((f) => f.mappe.id === mappeId);
	const mappe = [...(eigene?.dateien ?? [])]
		.sort((a, b) => b.zeit - a.zeit || path.basename(a.d).localeCompare(path.basename(b.d), 'de'))
		.map(({ d }) => eintrag(d, relativ(d)));
	const meine = fundorte
		.filter((f) => f.mappe.id !== mappeId)
		.flatMap((f) => f.dateien.map((x) => ({ ...x, titel: f.mappe.titel })))
		.sort((a, b) => b.zeit - a.zeit)
		.map(({ d, titel }) => eintrag(d, relativ(d), titel));
	const posen = figuren.flatMap((f) =>
		f.posen.map((p) => ({ schluessel: p.schluessel, name: path.basename(p.schluessel), alt: [f.name] })),
	);
	return { sammlung, mappe, meine, figuren: posen };
};
