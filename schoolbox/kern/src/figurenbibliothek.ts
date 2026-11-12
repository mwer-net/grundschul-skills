/**
 * Besitzer: 177. Figurenbibliothek (156): `materialien/_figuren/`, Format siehe Ticket 177.
 *
 * Willi und Wilma sind eingebaut (`figuren.ts`); alle anderen Figuren und weitere Posen stehen hier, die Bilddateien
 * flach in `_figuren/`, dazu `figuren.json`. Fehlt `figuren.json`, übernimmt die Schoolbox beim ersten Lesen einmal die
 * Figuren aus dem Bestand. Sie kopiert nur: Keine Datei in den Mappen ändert sich (Entscheidung 26). Der Schalter ist
 * allein `figuren.json`. Dateien hier werden nie überschrieben und nie gelöscht; Felder, die dieses Modul nicht kennt,
 * bleiben beim Schreiben erhalten. Jede Figur führt nur ihre Farbfassung; eine Strichfassung liegt unsichtbar als
 * `<kennung>-strich.*` daneben, nach der Regel von `strich_fassung` in `blatt.py` (041).
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { mappenDir, sammleMappen } from './ablage';
import { kopiereAtomar, schreibeJson } from './atomar';
import { fuehreAus } from './bauen';
import { SchoolboxFehler } from './fehler';
import type { BibliotheksFigur, Pose } from './figuren';
import { eingebauteFigur, FIGUREN } from './figuren';
import type { Konfig } from './konfig';
import { ASSETS, BILD_PY, BLATT_PY } from './konfig';
import { slug } from './slug';

export const FIGUREN_ORDNER = '_figuren';
const FIGUREN_JSON = 'figuren.json';
/** Wie `RASTER` in `blatt.py`: In dieser Reihenfolge sucht `strich_fassung` die Strichfassung. */
const RASTER = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const STRICH = '-strich';
const FIGUR_ID = /^[a-z0-9]+$/;
/** Eine Bilddatei direkt in `_figuren/`. */
export const POSEN_DATEI = /^[^./\\][^/\\]*\.(png|jpe?g|gif|webp)$/i;
/** Ab diesem Anteil durchsichtiger Pixel gilt ein PNG als freigestellt (156: Figuren 32–74 %, Geschenke bis 22 %). */
const FREIGESTELLT = 0.25;

export const figurenDir = (materialDir: string) => path.join(materialDir, FIGUREN_ORDNER);
const jsonDatei = (materialDir: string) => path.join(figurenDir(materialDir), FIGUREN_JSON);

interface GespeichertePose {
	datei: string;
	herkunft?: string;
	canva?: string;
	[feld: string]: unknown;
}

interface GespeicherteFigur {
	id: string;
	name?: string;
	steckbrief?: string;
	canva?: string;
	suchwoerter?: string[];
	posen: GespeichertePose[];
	[feld: string]: unknown;
}

interface Gespeichert {
	version: 1;
	figuren: GespeicherteFigur[];
	[feld: string]: unknown;
}

type Gelesen = { stand: 'fehlt' } | { stand: 'kaputt' } | { stand: 'da'; bibliothek: Gespeichert };

const istObjekt = (x: unknown): x is Record<string, unknown> =>
	typeof x === 'object' && x !== null && !Array.isArray(x);

const stammVon = (datei: string) => path.basename(datei, path.extname(datei));

const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);

const gross = (id: string) => `${id.slice(0, 1).toUpperCase()}${id.slice(1)}`;

const eingebaut = (id: string) => FIGUREN.some((f) => f.id === id);

/** Eine fehlende Datei ist `fehlt`; was sich nicht lesen oder deuten lässt, ist `kaputt` und wird nie überschrieben. */
const leseDatei = async (materialDir: string): Promise<Gelesen> => {
	let roh: string;
	try {
		roh = await readFile(jsonDatei(materialDir), 'utf8');
	} catch (fehler) {
		return (fehler as NodeJS.ErrnoException).code === 'ENOENT' ? { stand: 'fehlt' } : { stand: 'kaputt' };
	}
	try {
		const daten = JSON.parse(roh) as unknown;
		if (istObjekt(daten) && daten.version === 1 && Array.isArray(daten.figuren)) {
			return { stand: 'da', bibliothek: daten as unknown as Gespeichert };
		}
	} catch {
		// unten: kaputt
	}
	return { stand: 'kaputt' };
};

const dateienIn = async (materialDir: string) => new Set(await readdir(figurenDir(materialDir)).catch(() => []));

/** Die Strichfassung einer Pose in `_figuren/`, wie `blatt.py` sie sucht: `<kennung>-strich.*`. */
const strichIn = (kennung: string, dateien: ReadonlySet<string>) =>
	RASTER.map((e) => `${kennung}${STRICH}${e}`).find((d) => dateien.has(d)) ?? null;

const nachKennung = (posen: Pose[]) => [...posen].sort((a, b) => a.id.localeCompare(b.id, 'de'));

/**
 * Die Figuren in fester Reihenfolge: Willi, Wilma, dann nach Namen; je Figur die Grundpose zuerst, dann nach Kennung.
 * Nur Posen, deren Datei da ist, jede Kennung einmal. Eine Figur ohne Pose fällt weg.
 */
const figurenAus = (gespeichert: Gespeichert | null, dateien: ReadonlySet<string>): BibliotheksFigur[] => {
	const vergeben = new Set(FIGUREN.map((f) => f.id));
	const posenVon = (eintrag: GespeicherteFigur | undefined): Pose[] =>
		(Array.isArray(eintrag?.posen) ? eintrag.posen : []).flatMap((p: unknown) => {
			if (!istObjekt(p) || typeof p.datei !== 'string' || !POSEN_DATEI.test(p.datei) || !dateien.has(p.datei)) {
				return [];
			}
			const id = stammVon(p.datei);
			if (vergeben.has(id)) {
				return [];
			}
			vergeben.add(id);
			const canva = text(p.canva);
			return [
				{
					id,
					schluessel: `${FIGUREN_ORDNER}/${p.datei}`,
					strich: strichIn(id, dateien) !== null,
					...(canva ? { canva } : {}),
				},
			];
		});
	const eintraege: GespeicherteFigur[] = [];
	for (const e of gespeichert?.figuren ?? []) {
		if (istObjekt(e) && typeof e.id === 'string' && FIGUR_ID.test(e.id) && !eintraege.some((x) => x.id === e.id)) {
			eintraege.push(e);
		}
	}
	const eingebaute = FIGUREN.map((f) =>
		eingebauteFigur(f, nachKennung(posenVon(eintraege.find((e) => e.id === f.id)))),
	);
	const andere = eintraege
		.filter((e) => !eingebaut(e.id))
		.flatMap((e): BibliotheksFigur[] => {
			const [grund, ...weitere] = posenVon(e);
			if (!grund) {
				return [];
			}
			const steckbrief = text(e.steckbrief);
			const canva = text(e.canva);
			return [
				{
					id: e.id,
					name: text(e.name) ?? gross(e.id),
					eingebaut: false,
					...(steckbrief ? { steckbrief } : {}),
					...(canva ? { canva } : {}),
					suchwoerter: Array.isArray(e.suchwoerter)
						? e.suchwoerter.filter((w): w is string => typeof w === 'string')
						: [],
					posen: [grund, ...nachKennung(weitere)],
				},
			];
		})
		.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	return [...eingebaute, ...andere];
};

const HASHES = new Map<string, { mtimeMs: number; size: number; hash: string }>();

/** SHA-256 einer Datei, je Pfad mit Änderungszeit und Größe gemerkt: „Bilder“ fragt bei jedem Öffnen. */
const hashVon = async (datei: string, info?: { mtimeMs: number; size: number }) => {
	const s = info ?? (await stat(datei));
	const da = HASHES.get(datei);
	if (da?.mtimeMs === s.mtimeMs && da.size === s.size) {
		return da.hash;
	}
	const hash = createHash('sha256')
		.update(await readFile(datei))
		.digest('hex');
	HASHES.set(datei, { mtimeMs: s.mtimeMs, size: s.size, hash });
	return hash;
};

/** Die Strichfassung neben einem Bild nach der Regel von `blatt.py fassung` (041), sonst `null`. Wirft nie. */
export const strichNeben = async (konfig: Pick<Konfig, 'pythonBin'>, datei: string): Promise<string | null> => {
	const lauf = await fuehreAus(konfig.pythonBin, [BLATT_PY, 'fassung', datei]).catch(() => null);
	if (lauf?.code !== 0) {
		return null;
	}
	try {
		const { strich } = JSON.parse(lauf.stdout) as { strich: string | null };
		return strich ? path.join(path.dirname(datei), strich) : null;
	} catch {
		return null;
	}
};

interface Messung {
	datei: string;
	breite: number;
	hoehe: number;
	durchsichtig: number;
}

/** Ein einziger Aufruf von `bild.py figuren` für alle Dateien. */
const miss = async (konfig: Pick<Konfig, 'pythonBin'>, dateien: string[]) => {
	if (dateien.length === 0) {
		return new Map<string, Messung>();
	}
	const lauf = await fuehreAus(konfig.pythonBin, [BILD_PY, 'figuren', ...dateien]);
	if (lauf.code !== 0) {
		throw new SchoolboxFehler(`Die Figuren ließen sich nicht messen: ${lauf.stderr || lauf.stdout}`, 3);
	}
	return new Map((JSON.parse(lauf.stdout) as Messung[]).map((m) => [m.datei, m]));
};

/** Gleiches Seitenverhältnis mit 1 % Spielraum, wie `strich_fassung` in `blatt.py`. */
const gleichesVerhaeltnis = (a: Messung | undefined, b: Messung | undefined) => {
	if (!a || !b || a.hoehe <= 0 || b.hoehe <= 0) {
		return false;
	}
	const v = a.breite / a.hoehe;
	return Math.abs(b.breite / b.hoehe - v) <= 0.01 * v;
};

interface Datei {
	datei: string;
	/** Nummer des Ordners in Suchreihenfolge. */
	ordner: number;
	name: string;
	stamm: string;
}

const gleicherInhalt = async (datei: string, inhalt: Buffer) =>
	(await readFile(datei).catch(() => null))?.equals(inhalt) ?? false;

/**
 * Die einmalige Übernahme (156): Alle Mappen außer dem Papierkorb, nach ID, je Mappe `bilder/` und jedes
 * `dokumente/<dok>/bilder/`. Kandidat ist ein PNG, das nicht auf `-strich` endet und zu mehr als 25 % durchsichtig ist.
 * Eine Figur ist es, wenn der Teil vor dem ersten `-` Willi oder Wilma ist oder `<name>.png` selbst Kandidat ist.
 * Gleicher Inhalt zählt einmal; was einer eingebauten Datei gleicht, gar nicht. Erst die Dateien, dann `figuren.json`.
 */
const uebernimmBestand = async (konfig: Pick<Konfig, 'pythonBin'>, materialDir: string) => {
	const { mappen } = await sammleMappen(materialDir);
	const ordner = [...mappen]
		.sort((a, b) => a.mappe.id.localeCompare(b.mappe.id))
		.flatMap(({ dokumente, mappe }) => {
			const dir = mappenDir(materialDir, mappe.id);
			const doks = dokumente.map((d) => d.id).sort((a, b) => a.localeCompare(b));
			return [path.join(dir, 'bilder'), ...doks.map((d) => path.join(dir, 'dokumente', d, 'bilder'))];
		});
	const pngs: Datei[] = [];
	const striche = new Map<string, Datei>();
	for (const [nr, dir] of ordner.entries()) {
		const namen = (await readdir(dir, { withFileTypes: true }).catch(() => []))
			.filter((e) => e.isFile() && !e.name.startsWith('.'))
			.map((e) => e.name)
			.sort((a, b) => a.localeCompare(b));
		for (const name of namen) {
			const d = { datei: path.join(dir, name), ordner: nr, name, stamm: stammVon(name) };
			if (d.stamm.endsWith(STRICH)) {
				if (RASTER.includes(path.extname(name))) {
					striche.set(`${nr}/${name}`, d);
				}
			} else if (path.extname(name).toLowerCase() === '.png') {
				pngs.push(d);
			}
		}
	}
	const messung = await miss(konfig, [...pngs, ...striche.values()].map((d) => d.datei));
	const kandidaten = pngs.filter((d) => (messung.get(d.datei)?.durchsichtig ?? 0) > FREIGESTELLT);
	const grundposen = new Set(kandidaten.map((d) => d.stamm).filter((s) => FIGUR_ID.test(s)));
	const figurVon = (stamm: string) => {
		const name = stamm.split('-')[0] ?? '';
		return FIGUR_ID.test(name) && (eingebaut(name) || grundposen.has(name)) ? name : null;
	};
	const strichZu = (d: Datei) => {
		const reihe = [d.ordner, ...ordner.keys()].filter((o, i, alle) => alle.indexOf(o) === i);
		for (const o of reihe) {
			for (const endung of RASTER) {
				const s = striche.get(`${o}/${d.stamm}${STRICH}${endung}`);
				if (s && gleichesVerhaeltnis(messung.get(d.datei), messung.get(s.datei))) {
					return s;
				}
			}
		}
		return null;
	};

	const ziel = figurenDir(materialDir);
	await mkdir(ziel, { recursive: true });
	const vorhanden = new Set(await readdir(ziel));
	/** Frei ist ein Name, der fehlt oder schon denselben Inhalt hat (ein abgebrochener Lauf). */
	const frei = async (name: string, inhalt: Buffer) =>
		!vorhanden.has(name) || (await gleicherInhalt(path.join(ziel, name), inhalt));
	const eingebauteInhalte = new Set(
		await Promise.all(FIGUREN.map((f) => hashVon(path.join(ASSETS, 'bilder', f.datei)))),
	);
	const gesehen = new Set<string>();
	const vergeben = new Set(FIGUREN.map((f) => f.id));
	const posen = new Map<string, { kennung: string; pose: GespeichertePose }[]>();

	for (const d of kandidaten) {
		const figur = figurVon(d.stamm);
		if (!figur) {
			continue;
		}
		const inhalt = await readFile(d.datei);
		const hash = createHash('sha256').update(inhalt).digest('hex');
		if (eingebauteInhalte.has(hash) || gesehen.has(hash)) {
			continue;
		}
		gesehen.add(hash);
		const strich = strichZu(d);
		const strichInhalt = strich ? await readFile(strich.datei) : null;
		const strichName = (k: string) => `${k}${STRICH}${strich ? path.extname(strich.name) : ''}`;
		const passt = async (k: string) =>
			!vergeben.has(k) &&
			(await frei(`${k}.png`, inhalt)) &&
			(strichInhalt
				? await frei(strichName(k), strichInhalt)
				: !RASTER.some((e) => vorhanden.has(`${k}${STRICH}${e}`)));
		let kennung = d.stamm;
		for (let n = 2; !(await passt(kennung)); n += 1) {
			kennung = `${d.stamm}-${n}`;
		}
		vergeben.add(kennung);
		for (const [quelle, name] of [
			[d.datei, `${kennung}.png`],
			...(strich ? [[strich.datei, strichName(kennung)]] : []),
		] as const) {
			if (!vorhanden.has(name)) {
				await kopiereAtomar(quelle, path.join(ziel, name));
				vorhanden.add(name);
			}
		}
		const herkunft = path.relative(materialDir, d.datei).split(path.sep).join('/');
		posen.set(figur, [...(posen.get(figur) ?? []), { kennung, pose: { datei: `${kennung}.png`, herkunft } }]);
	}

	const figuren: GespeicherteFigur[] = [...posen.entries()]
		.map(([id, liste]) => {
			// Die Grundpose `<id>.png` zuerst, wenn es sie gibt.
			const sortiert = [...liste.filter((p) => p.kennung === id), ...liste.filter((p) => p.kennung !== id)];
			const eintraege = sortiert.map((p) => p.pose);
			return eingebaut(id) ? { id, posen: eintraege } : { id, name: gross(id), posen: eintraege };
		})
		.sort((a, b) => {
			const ea = FIGUREN.findIndex((f) => f.id === a.id);
			const eb = FIGUREN.findIndex((f) => f.id === b.id);
			if (ea >= 0 || eb >= 0) {
				return (ea < 0 ? Infinity : ea) - (eb < 0 ? Infinity : eb);
			}
			return (a.name ?? a.id).localeCompare(b.name ?? b.id, 'de');
		});
	await schreibeJson(jsonDatei(materialDir), { version: 1, figuren } satisfies Gespeichert);
};

/** Je Materialordner höchstens eine Übernahme zugleich. */
const UEBERNAHMEN = new Map<string, Promise<void>>();

const sorgeFuerBibliothek = async (konfig: Pick<Konfig, 'pythonBin'>, materialDir: string) => {
	if (existsSync(jsonDatei(materialDir))) {
		return;
	}
	let lauf = UEBERNAHMEN.get(materialDir);
	if (!lauf) {
		lauf = uebernimmBestand(konfig, materialDir).finally(() => UEBERNAHMEN.delete(materialDir));
		UEBERNAHMEN.set(materialDir, lauf);
	}
	await lauf;
};

/**
 * Alle Figuren: Willi, Wilma, dann die der Bibliothek nach Namen. Fehlt `figuren.json`, läuft vorher einmal die
 * Übernahme; bricht sie ab, beginnt sie beim nächsten Lesen neu. Eine kaputte `figuren.json` gilt als leer.
 */
export const leseBibliothek = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
): Promise<BibliotheksFigur[]> => {
	try {
		await sorgeFuerBibliothek(konfig, materialDir);
	} catch (fehler) {
		console.warn(`Figurenbibliothek: Übernahme abgebrochen: ${fehler instanceof Error ? fehler.message : '?'}`);
	}
	const gelesen = await leseDatei(materialDir);
	return figurenAus(gelesen.stand === 'da' ? gelesen.bibliothek : null, await dateienIn(materialDir));
};

/** Inhalte aller Figuren-Dateien: erst die Größe, dann SHA-256 (`gleichtFigur`). */
export interface FigurenInhalte {
	groessen: ReadonlySet<number>;
	hashes: ReadonlySet<string>;
}

/**
 * Größen und SHA-256 der Posen aus `figuren.json` samt Strichfassung und der eingebauten Dateien (`datei`, `strich`).
 * „Bilder“ zeigt nichts, was einer davon gleicht. Löst keine Übernahme aus.
 */
export const figurenInhalte = async (materialDir: string): Promise<FigurenInhalte> => {
	const gelesen = await leseDatei(materialDir);
	const dateien = await dateienIn(materialDir);
	const eigene = figurenAus(gelesen.stand === 'da' ? gelesen.bibliothek : null, dateien)
		.flatMap((f) => f.posen)
		.filter((p) => p.schluessel.startsWith(`${FIGUREN_ORDNER}/`))
		.flatMap((p) => [path.basename(p.schluessel), strichIn(p.id, dateien) ?? []].flat());
	const pfade = [
		...FIGUREN.flatMap((f) => [f.datei, f.strich ?? []].flat()).map((d) => path.join(ASSETS, 'bilder', d)),
		...eigene.map((d) => path.join(figurenDir(materialDir), d)),
	];
	const groessen = new Set<number>();
	const hashes = new Set<string>();
	for (const pfad of pfade) {
		const info = await stat(pfad).catch(() => null);
		if (info?.isFile()) {
			groessen.add(info.size);
			hashes.add(await hashVon(pfad, info));
		}
	}
	return { groessen, hashes };
};

/** Gleicht die Datei inhaltlich einer Figur? Gehasht wird nur, wenn die Größe passt. */
export const gleichtFigur = async (inhalte: FigurenInhalte, datei: string, info: { mtimeMs: number; size: number }) =>
	inhalte.groessen.has(info.size) && inhalte.hashes.has(await hashVon(datei, info));

/** Schreibt `figuren.json` hintereinander, nie zwei zugleich. */
const REIHEN = new Map<string, Promise<unknown>>();

const inReihe = <T>(materialDir: string, aufgabe: () => Promise<T>): Promise<T> => {
	const lauf = (REIHEN.get(materialDir) ?? Promise.resolve()).then(aufgabe, aufgabe);
	REIHEN.set(materialDir, lauf.catch(() => undefined));
	return lauf;
};

/**
 * Ändert `figuren.json` in der Reihe des Materialordners: lesen, `aendere` (ändert das Gelesene an Ort und Stelle),
 * atomar schreiben. Wirft `aendere`, bleibt die Datei, wie sie war. Auch für `entfernePose` (176).
 */
const aendereBibliothek = async <T>(
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	aendere: (gespeichert: Gespeichert, dateien: ReadonlySet<string>) => Promise<T>,
): Promise<T> => {
	await sorgeFuerBibliothek(konfig, materialDir);
	return inReihe(materialDir, async () => {
		const gelesen = await leseDatei(materialDir);
		if (gelesen.stand !== 'da') {
			throw new SchoolboxFehler('Die Figurenbibliothek lässt sich nicht lesen (figuren.json).');
		}
		const ergebnis = await aendere(gelesen.bibliothek, await dateienIn(materialDir));
		await schreibeJson(jsonDatei(materialDir), gelesen.bibliothek);
		return ergebnis;
	});
};

export interface NeuePose {
	/** Absoluter Pfad einer Bilddatei; sie wird kopiert. */
	datei: string;
	/** Id der Figur; unbekannt legt sie eine neue Figur an (176 bildet sie mit `neueFigurId`). */
	figur: string;
	/** Pflicht für eine neue Figur. */
	name?: string;
	/** Für den Dateinamen `<figur>-<wort>` einer weiteren Pose. */
	wort?: string;
	/** Pfad relativ zu `materialien/` oder `canva`. */
	herkunft?: string;
	/** Media-ID genau dieser Pose; hat die Figur noch keine Referenz, wird sie es. */
	canva?: string;
	/** Aussehen; nur, wenn die Figur noch keinen hat. */
	steckbrief?: string;
}

/**
 * Nimmt ein Bild als Pose in die Bibliothek auf (für 176 und 179). Eine neue Figur bekommt die Grundpose
 * `<figur>.<ext>`, jede weitere Pose `<figur>-<wort>.<ext>`, bei Belegung `-2`, `-3`. Die Strichfassung neben `datei`
 * kommt mit.
 * Willi und Wilma bekommen in `figuren.json` weder `canva` noch `steckbrief`; beides steht in `FIGUREN`.
 */
export const nimmPoseAuf = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	neu: NeuePose,
): Promise<Pose> => {
	if (!FIGUR_ID.test(neu.figur)) {
		throw new SchoolboxFehler(`„${neu.figur}“ taugt nicht als Id einer Figur (nur a–z und 0–9).`);
	}
	const endung = path.extname(neu.datei).toLowerCase();
	const info = await stat(neu.datei).catch(() => null);
	if (!info?.isFile() || !POSEN_DATEI.test(`pose${endung}`)) {
		throw new SchoolboxFehler('Dieses Bild gibt es nicht.');
	}
	const strich = await strichNeben(konfig, neu.datei);
	return aendereBibliothek(konfig, materialDir, async (gespeichert, dateien) => {
		const fest = eingebaut(neu.figur);
		let eintrag = gespeichert.figuren.find((f) => istObjekt(f) && f.id === neu.figur);
		const name = text(neu.name);
		if (!eintrag && !fest && !name) {
			throw new SchoolboxFehler(`Die neue Figur „${neu.figur}“ braucht einen Namen.`);
		}
		const neueFigur = !eintrag;
		eintrag ??= fest ? { id: neu.figur, posen: [] } : { id: neu.figur, name, posen: [] };
		if (!Array.isArray(eintrag.posen)) {
			eintrag.posen = [];
		}
		const kennungen = new Set([
			...FIGUREN.map((f) => f.id),
			...gespeichert.figuren.flatMap((f) =>
				istObjekt(f) && Array.isArray(f.posen)
					? f.posen.flatMap((p) => (istObjekt(p) && typeof p.datei === 'string' ? [stammVon(p.datei)] : []))
					: [],
			),
		]);
		const staemme = new Set([...dateien].map(stammVon));
		const belegt = (k: string) => kennungen.has(k) || staemme.has(k) || staemme.has(`${k}${STRICH}`);
		const grund = !fest && eintrag.posen.length === 0;
		const basis = grund ? neu.figur : `${neu.figur}-${slug(neu.wort ?? '', 30) || 'pose'}`;
		let kennung = basis;
		for (let n = 2; belegt(kennung); n += 1) {
			kennung = `${basis}-${n}`;
		}
		const ziel = figurenDir(materialDir);
		await mkdir(ziel, { recursive: true });
		await kopiereAtomar(neu.datei, path.join(ziel, `${kennung}${endung}`));
		if (strich) {
			await kopiereAtomar(strich, path.join(ziel, `${kennung}${STRICH}${path.extname(strich).toLowerCase()}`));
		}
		const canva = text(neu.canva);
		const herkunft = text(neu.herkunft);
		eintrag.posen.push({
			datei: `${kennung}${endung}`,
			...(herkunft ? { herkunft } : {}),
			...(canva ? { canva } : {}),
		});
		const steckbrief = text(neu.steckbrief);
		if (!fest && canva && !text(eintrag.canva)) {
			eintrag.canva = canva;
		}
		if (!fest && steckbrief && !text(eintrag.steckbrief)) {
			eintrag.steckbrief = steckbrief;
		}
		if (neueFigur) {
			gespeichert.figuren.push(eintrag);
		}
		return {
			id: kennung,
			schluessel: `${FIGUREN_ORDNER}/${kennung}${endung}`,
			strich: strich !== null,
			...(canva ? { canva } : {}),
		};
	});
};
