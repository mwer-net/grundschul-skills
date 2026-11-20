/**
 * Bilder im Editor (017): Uploads aufnehmen, die Bildersammlung zusammenstellen und
 * Bilder aus ihr ins Dokument übernehmen. Pillow erledigt die Bildarbeit (`kern/bild.py`). Bilder werden nie
 * überschrieben und nie gelöscht: Ältere Versionen des Materials verweisen noch auf sie. Figuren zeigt die Sammlung
 * nicht; sie stehen in der Figurenbibliothek (177).
 */

import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { dokumentDir, mappenDir, pruefeId, sammleMappen } from './ablage';
import { kopiereAtomar, schreibeAtomar } from './atomar';
import { fuehreAus } from './bauen';
import type { Sammlung, SammlungsBild } from './bildbefehle';
import { beschreibungAus, MAX_BILD_BYTES } from './bildbefehle';
import type { BildQuelle } from './bildliste';
import type { Requisit } from './einheit-bibliothek';
import { bildFigur, istRequisit, leseHerkunft } from './einheit-bibliothek';
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
import { PAPIERKORB_TAGE } from './papierkorb';
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

/** 199-N05: In jedem `bilder/`: Datei → Name aus dem Hochladen. */
const NAMEN = '.namen.json';

const leseNamen = async (ordner: string): Promise<Map<string, string>> => {
	try {
		const daten = JSON.parse(await readFile(path.join(ordner, NAMEN), 'utf8')) as Record<string, unknown>;
		return new Map(Object.entries(daten).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v]] : [])));
	} catch {
		return new Map();
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
	const bild = await verarbeite(konfig, 'aufnehmen', daten, path.join(dokDir, BILDER), bildStamm(dateiname));
	// 199-N05: Die Kachel heißt wie das eingesetzte Bild („Kürbis ernte“), nicht wie die Datei („kuerbis-ernte-3“).
	const titel = beschreibungAus(dateiname);
	if (titel) {
		const ordner = path.join(dokDir, BILDER);
		const namen = await leseNamen(ordner);
		namen.set(path.basename(bild.src), titel);
		await schreibeAtomar(
			path.join(ordner, NAMEN),
			`${JSON.stringify(Object.fromEntries([...namen].sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`,
		);
	}
	return bild;
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

/**
 * In jedem `bilder/` einer Mappe: die Dateien, die „Entfernen“ aus der Bildauswahl genommen hat (199), je mit dem
 * Zeitpunkt (`seit`, 199-N02). Nach `PAPIERKORB_TAGE` löscht `raeumeAusgeblendeteBilderAuf` sie endgültig.
 */
const AUSGEBLENDET = '.ausgeblendet.json';

/** Datei → seit wann ausgeblendet (ISO); `null` bei Einträgen von vor 199-N02. */
type Ausgeblendet = Map<string, string | null>;

const leseAusgeblendet = async (ordner: string): Promise<Ausgeblendet> => {
	try {
		const daten = JSON.parse(await readFile(path.join(ordner, AUSGEBLENDET), 'utf8')) as {
			dateien?: unknown;
			seit?: unknown;
		};
		const seit = daten.seit && typeof daten.seit === 'object' ? (daten.seit as Record<string, unknown>) : {};
		const dateien = Array.isArray(daten.dateien) ? daten.dateien.filter((d) => typeof d === 'string') : [];
		return new Map(dateien.map((d) => [d, typeof seit[d] === 'string' ? seit[d] : null]));
	} catch {
		return new Map();
	}
};

const schreibeAusgeblendet = async (ordner: string, liste: Ausgeblendet) => {
	const datei = path.join(ordner, AUSGEBLENDET);
	if (liste.size === 0) {
		await rm(datei, { force: true });
		return;
	}
	const dateien = [...liste.keys()].sort();
	const seit = Object.fromEntries(dateien.flatMap((d) => (liste.get(d) ? [[d, liste.get(d)]] : [])));
	await schreibeAtomar(datei, `${JSON.stringify({ dateien, seit }, null, 2)}\n`);
};

/**
 * Die Bilder direkt im Ordner; eine Strichfassung nur, wenn ihre Farbfassung fehlt. Ausgeblendete (199: „Entfernen“
 * in der Bildauswahl) fehlen; die Dateien selbst bleiben liegen, ältere Versionen verweisen noch auf sie.
 */
const bildDateien = async (ordner: string) => {
	const aus = await leseAusgeblendet(ordner);
	const namen = (await readdir(ordner, { withFileTypes: true }).catch(() => []))
		.filter((e) => e.isFile() && !e.name.startsWith('.') && BILD_DATEI.test(e.name) && !aus.has(e.name))
		.map((e) => e.name);
	const staemme = new Set(namen.map(stammVon));
	const farbeDa = (stamm: string) => stamm.endsWith(STRICH) && staemme.has(stamm.slice(0, -STRICH.length));
	return namen.filter((n) => !farbeDa(stammVon(n))).map((n) => path.join(ordner, n));
};

/** Je Datei (echter Pfad): unter welchen Beschreibungen sie vorkommt und welche Materialien sie zeigen. */
interface Vorkommen {
	alt: Map<string, Set<string>>;
	genutzt: Map<string, Set<string>>;
}

/** Merkt sich, unter welchen Beschreibungen die Bilder eines Materials vorkommen und, mit `titel`, wer sie nutzt. */
const merkeAlt = (v: Vorkommen, html: string, dir: string, titel?: string) => {
	for (const k of zerlege(html).knoten) {
		const src = k.tag === 'img' ? attribut(k, 'src')?.wert : null;
		const datei = src ? sucheRessource(src, dir) : null;
		if (!datei) {
			continue;
		}
		const text = attribut(k, 'alt')?.wert?.trim();
		if (text) {
			v.alt.set(datei, new Set([...(v.alt.get(datei) ?? []), text]));
		}
		if (titel !== undefined) {
			v.genutzt.set(datei, new Set([...(v.genutzt.get(datei) ?? []), titel]));
		}
	}
};

const leseText = (datei: string) => readFile(datei, 'utf8').catch(() => '');

/** Jedes Material der Ablage (ohne Papierkorb) mit seinem Ordner und Titel. */
const materialien = async (materialDir: string) => {
	const { mappen } = await sammleMappen(materialDir);
	return mappen.flatMap(({ dokumente, mappe }) =>
		dokumente.map((d) => ({
			mappe,
			dokDir: path.join(mappenDir(materialDir, mappe.id), 'dokumente', d.id),
			titel: d.meta.titel || mappe.titel,
		})),
	);
};

const pruefsumme = async (datei: string) =>
	createHash('sha256')
		.update(await readFile(datei))
		.digest('hex');

/**
 * 199-06: Je Gruppe erscheint eine Datei gleichen Inhalts einmal (jedes Material hat seine Kopie). Gleiche Größe ist
 * die Vorprüfung, erst dann zählt die Prüfsumme. Die erste Datei bleibt (Reihenfolge der Gruppe), die anderen werden
 * ihre Kopien.
 */
const ohneDoppelte = async <T extends { d: string; groesse: number }>(liste: T[]) => {
	const zahl = new Map<number, number>();
	for (const x of liste) {
		zahl.set(x.groesse, (zahl.get(x.groesse) ?? 0) + 1);
	}
	const erste = new Map<string, { x: T; kopien: string[] }>();
	const ergebnis: { x: T; kopien: string[] }[] = [];
	for (const x of liste) {
		const schluessel = (zahl.get(x.groesse) ?? 0) > 1 ? `#${await pruefsumme(x.d)}` : `@${x.d}`;
		const da = erste.get(schluessel);
		if (da) {
			da.kopien.push(x.d);
			continue;
		}
		const neu = { x, kopien: [x.d] };
		erste.set(schluessel, neu);
		ergebnis.push(neu);
	}
	return ergebnis;
};

/** Ein Requisit samt seiner Datei und, für die Bildliste (271), der Quelle aus `bilder-herkunft.tsv` seiner Mappe. */
export type RequisitDatei = Requisit & { pfad: string; quelle: BildQuelle | null };

/**
 * 253: Freigestellte Bilder früherer Einheiten ohne Figur, aus `bilder-herkunft.tsv` jeder Mappe außer `ohneMappe`:
 * nicht `offen`, nicht ausgeblendet, kein Stamm einer Figur (der Bibliothek oder der Mappe), kein Inhalt einer Figur.
 */
export const sammleRequisiten = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	ohneMappe?: string,
): Promise<RequisitDatei[]> => {
	const bibliothek = (await leseBibliothek(konfig, materialDir)).map((f) => f.name);
	const inhalte = await figurenInhalte(materialDir);
	const { mappen } = await sammleMappen(materialDir);
	const liste: RequisitDatei[] = [];
	for (const { mappe } of mappen) {
		const dir = path.join(mappenDir(materialDir, mappe.id), BILDER);
		const tsv = mappe.id === ohneMappe ? '' : await leseText(path.join(dir, 'bilder-herkunft.tsv'));
		if (!tsv) {
			continue;
		}
		const zeilen = [...leseHerkunft(tsv).values()];
		const namen = [...new Set([...bibliothek, ...zeilen.flatMap((z) => bildFigur(z)?.figur || [])])];
		const staemme = namen.map((n) => slug(n, 60)).filter(Boolean);
		const aus = await leseAusgeblendet(dir);
		for (const z of zeilen) {
			const stamm = stammVon(z.datei);
			const vonFigur = staemme.some((f) => stamm === f || stamm.startsWith(`${f}-`)) || stamm.endsWith(STRICH);
			if (z.art === 'offen' || aus.has(z.datei) || vonFigur || !istRequisit(z) || bildFigur(z, namen)) {
				continue;
			}
			const pfad = path.join(dir, z.datei);
			const info = await stat(pfad).catch(() => null);
			if (info?.isFile() && !(await gleichtFigur(inhalte, pfad, info))) {
				const quelle = z.quelle.trim() ? { quelle: z.quelle.trim(), ...(z.modell ? { modell: z.modell } : {}) } : null;
				liste.push({ datei: z.datei, motiv: z.motiv, mappe: mappe.titel, pfad, quelle });
			}
		}
	}
	return liste;
};

/** Alles, was die Bildersammlung im Editor zeigt. Was einer Figur gleicht, steht nur unter `figuren` (177). */
export const sammleBilder = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	mappeId: string,
): Promise<Sammlung> => {
	const figuren = await leseBibliothek(konfig, materialDir);
	const inhalte = await figurenInhalte(materialDir);
	/** Je Datei die Änderungszeit („Andere Ordner“: neueste zuerst); was einer Figur gleicht, fällt weg. */
	const ohneFigurdateien = async (dateien: string[]) => {
		const gesehen = await Promise.all(
			dateien.map(async (d) => {
				const info = await stat(d);
				return (await gleichtFigur(inhalte, d, info)) ? [] : [{ d, zeit: info.mtimeMs, groesse: info.size }];
			}),
		);
		return gesehen.flat();
	};
	const { mappen } = await sammleMappen(materialDir);
	const v: Vorkommen = { alt: new Map(), genutzt: new Map() };
	for (const html of (await readdir(ASSETS)).filter((n) => n.endsWith('.html'))) {
		merkeAlt(v, await leseText(path.join(ASSETS, html)), ASSETS);
	}
	const fundorte = await Promise.all(
		mappen.map(async ({ dokumente, mappe }) => {
			const dir = mappenDir(materialDir, mappe.id);
			const dokDirs = dokumente.map((d) => ({ dir: path.join(dir, 'dokumente', d.id), titel: d.meta.titel }));
			for (const dok of dokDirs) {
				merkeAlt(v, await leseText(path.join(dok.dir, 'material.html')), dok.dir, dok.titel || mappe.titel);
			}
			const ordner = [path.join(dir, BILDER), ...dokDirs.map((d) => path.join(d.dir, BILDER))];
			return { mappe, dateien: await ohneFigurdateien((await Promise.all(ordner.map(bildDateien))).flat()) };
		}),
	);
	const relativ = (datei: string) => path.relative(materialDir, datei).split(path.sep).join('/');
	const namenJe = new Map<string, Map<string, string>>();
	for (const ordner of new Set(fundorte.flatMap((f) => f.dateien.map((x) => path.dirname(x.d))))) {
		namenJe.set(ordner, await leseNamen(ordner));
	}
	const titelVon = (kopien: string[]) =>
		kopien.map((k) => namenJe.get(path.dirname(k))?.get(path.basename(k))).find((t) => t !== undefined);
	const eintrag = (datei: string, schluessel: string, mappe?: string, kopien: string[] = [datei]): SammlungsBild => {
		const echte = kopien.map((k) => realpathSync(k));
		const titel = titelVon(kopien);
		const alt = new Set(echte.flatMap((k) => [...(v.alt.get(k) ?? [])]));
		const genutzt = new Set(echte.flatMap((k) => [...(v.genutzt.get(k) ?? [])]));
		return {
			schluessel,
			name: path.basename(datei),
			alt: [...alt],
			...(mappe === undefined ? {} : { mappe }),
			...(titel ? { titel } : {}),
			...(schluessel.startsWith(`${ASSETS_SCHLUESSEL}/`)
				? {}
				: { kopien: kopien.map(relativ), genutzt: [...genutzt].sort((a, b) => a.localeCompare(b, 'de')) }),
		};
	};
	const nachName = (a: SammlungsBild, b: SammlungsBild) => a.name.localeCompare(b.name, 'de');

	const sammlung = (await ohneFigurdateien(await bildDateien(path.join(ASSETS, BILDER))))
		.map(({ d }) => eintrag(d, `${ASSETS_SCHLUESSEL}/${BILDER}/${path.basename(d)}`))
		.sort(nachName);
	const eigene = fundorte.find((f) => f.mappe.id === mappeId);
	const mappe = (
		await ohneDoppelte(
			[...(eigene?.dateien ?? [])].sort(
				(a, b) => b.zeit - a.zeit || path.basename(a.d).localeCompare(path.basename(b.d), 'de'),
			),
		)
	).map(({ kopien, x }) => eintrag(x.d, relativ(x.d), undefined, kopien));
	const meine = (
		await ohneDoppelte(
			fundorte
				.filter((f) => f.mappe.id !== mappeId)
				.flatMap((f) => f.dateien.map((x) => ({ ...x, titel: f.mappe.titel })))
				.sort((a, b) => b.zeit - a.zeit),
		)
	).map(({ kopien, x }) => eintrag(x.d, relativ(x.d), x.titel, kopien));
	const requisit = new Set((await sammleRequisiten(konfig, materialDir, mappeId)).map((r) => relativ(r.pfad)));
	const istRequisitBild = (b: SammlungsBild) => (b.kopien ?? [b.schluessel]).some((k) => requisit.has(k));
	const posen = figuren.flatMap((f) =>
		f.posen.map((p) => ({ schluessel: p.schluessel, name: path.basename(p.schluessel), alt: [f.name] })),
	);
	return {
		sammlung,
		mappe,
		meine: meine.filter((b) => !istRequisitBild(b)),
		requisiten: meine.filter(istRequisitBild),
		figuren: posen,
	};
};

/** Die Datei zu einem Schlüssel aus „Dieser Ordner“ oder „Andere Ordner“; Mitgeliefertes und Figuren nicht. */
const eigeneBilddatei = (materialDir: string, schluessel: string) => {
	const teile = schluessel.split('/');
	const name = teile.at(-1) ?? '';
	const [anfang = ''] = teile;
	if (
		teile.some((t) => !t || t.startsWith('.') || t.includes('\\')) ||
		!BILD_DATEI.test(name) ||
		anfang === ASSETS_SCHLUESSEL ||
		anfang === FIGUREN_ORDNER
	) {
		throw ungueltig();
	}
	pruefeId(anfang, 'Mappe');
	const rest = teile.slice(1);
	const ok =
		(rest.length === 2 && rest[0] === BILDER) ||
		(rest.length === 4 && rest[0] === 'dokumente' && rest[2] === BILDER);
	if (!ok) {
		throw ungueltig();
	}
	const datei = path.join(mappenDir(materialDir, anfang), ...rest);
	const wirklich = echt(datei);
	if (wirklich === null || !liegtIn(wirklich, realpathSync(mappenDir(materialDir, anfang)))) {
		throw ungueltig();
	}
	return datei;
};

/** Wer welches Bild zeigt: echte Pfade der Dateien → Titel der Materialien. */
const genutzteBilder = async (materialDir: string) => {
	const v: Vorkommen = { alt: new Map(), genutzt: new Map() };
	for (const m of await materialien(materialDir)) {
		merkeAlt(v, await leseText(path.join(m.dokDir, 'material.html')), m.dokDir, m.titel);
	}
	return v.genutzt;
};

/**
 * 199: „Entfernen“ in der Bildauswahl. Nimmt die Dateien (ein Bild mit seinen Kopien, `kopien`) aus der Auswahl, wenn
 * kein Material sie zeigt; `aus: false` holt sie zurück (Rückgängig). 199-N02: Wie der Papierkorb löscht
 * `raeumeAusgeblendeteBilderAuf` sie nach `PAPIERKORB_TAGE` Tagen endgültig.
 */
export const blendeBildAus = async (
	materialDir: string,
	schluessel: readonly string[],
	aus = true,
	jetzt = new Date(),
) => {
	if (schluessel.length === 0) {
		throw ungueltig();
	}
	const dateien = schluessel.map((s) => eigeneBilddatei(materialDir, s));
	if (aus) {
		const wer = await genutzteBilder(materialDir);
		const genutzt = [...new Set(dateien.flatMap((d) => [...(wer.get(realpathSync(d)) ?? [])]))];
		if (genutzt.length > 0) {
			throw new SchoolboxFehler(`Das Bild steht noch in „${genutzt[0]}“ und bleibt deshalb.`);
		}
	}
	for (const datei of dateien) {
		const ordner = path.dirname(datei);
		const liste = await leseAusgeblendet(ordner);
		if (aus) {
			liste.set(path.basename(datei), jetzt.toISOString());
		} else {
			liste.delete(path.basename(datei));
		}
		await schreibeAusgeblendet(ordner, liste);
	}
};

const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * 199-N02: Löscht ausgeblendete Bilder (samt Strichfassung), die seit `PAPIERKORB_TAGE` Tagen ausgeblendet sind und
 * die kein Material der Ablage zeigt; ältere Versionen zeigen dann einen leeren Bildplatz. Ein Eintrag ohne Zeitpunkt
 * (vor 199-N02) bekommt jetzt einen. Läuft mit dem Papierkorb. Gibt die gelöschten Dateien zurück.
 */
export const raeumeAusgeblendeteBilderAuf = async (materialDir: string, jetzt = new Date()): Promise<string[]> => {
	const { mappen } = await sammleMappen(materialDir);
	const ordner = mappen.flatMap(({ dokumente, mappe }) => {
		const dir = mappenDir(materialDir, mappe.id);
		return [path.join(dir, BILDER), ...dokumente.map((d) => path.join(dir, 'dokumente', d.id, BILDER))];
	});
	const grenze = jetzt.getTime() - PAPIERKORB_TAGE * TAG_MS;
	let wer: Map<string, Set<string>> | null = null;
	const geloescht: string[] = [];
	for (const o of ordner) {
		const liste = await leseAusgeblendet(o);
		if (liste.size === 0) {
			continue;
		}
		let geaendert = false;
		for (const [name, seit] of liste) {
			const datei = path.join(o, name);
			if (!existsSync(datei)) {
				liste.delete(name);
				geaendert = true;
				continue;
			}
			if (seit === null) {
				liste.set(name, jetzt.toISOString());
				geaendert = true;
				continue;
			}
			if (new Date(seit).getTime() > grenze) {
				continue;
			}
			wer ??= await genutzteBilder(materialDir);
			if (wer.has(realpathSync(datei))) {
				continue; // Steht (wieder) in einem Material: bleibt ausgeblendet, aber da.
			}
			const stamm = stammVon(name);
			const strich = (await readdir(o).catch(() => [])).filter(
				(n) => stammVon(n) === `${stamm}${STRICH}` && BILD_DATEI.test(n),
			);
			for (const n of [name, ...strich]) {
				await rm(path.join(o, n), { force: true });
				geloescht.push(path.join(o, n));
			}
			liste.delete(name);
			geaendert = true;
		}
		if (geaendert) {
			await schreibeAusgeblendet(o, liste);
		}
	}
	return geloescht;
};
