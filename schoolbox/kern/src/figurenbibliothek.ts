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
import { neueFigurId } from './bild-auftrag';
import type { HerkunftZeile } from './einheit-bibliothek';
import {
	artAus,
	bibliotheksName,
	bildFigur,
	gegenstaendeInGrundpose,
	GRUNDPOSE,
	leseHerkunft,
	VERMERK_GEGENSTAND,
} from './einheit-bibliothek';
import { SchoolboxFehler } from './fehler';
import type { BibliotheksFigur, Pose } from './figuren';
import { eingebauteFigur, FIGUREN, figurNameVergeben, NAME_VERGEBEN } from './figuren';
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
	/** 253: Titel der Einheit, aus der die Figur kam. */
	aus?: string;
	/** 253: Vermerk für die Lehrkraft. */
	vermerk?: string;
	suchwoerter?: string[];
	posen: GespeichertePose[];
	[feld: string]: unknown;
}

interface Gespeichert {
	version: 1;
	figuren: GespeicherteFigur[];
	/** 253: Die Figuren aus den Einheiten sind einmal übernommen. */
	einheitenUebernommen?: boolean;
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
		return (fehler as { code?: unknown }).code === 'ENOENT' ? { stand: 'fehlt' } : { stand: 'kaputt' };
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

/**
 * Die Figuren in fester Reihenfolge: Willi, Wilma, dann nach Namen; je Figur die Grundpose zuerst, dann die Posen in
 * der Reihenfolge der Bibliothek, also nach Entstehung (199-22: Die fertige Pose steht, wo ihre Auftragskachel stand).
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
	const eingebaute = FIGUREN.map((f) => eingebauteFigur(f, posenVon(eintraege.find((e) => e.id === f.id))));
	const andere = eintraege
		.filter((e) => !eingebaut(e.id))
		.flatMap((e): BibliotheksFigur[] => {
			const [grund, ...weitere] = posenVon(e);
			if (!grund) {
				return [];
			}
			const steckbrief = text(e.steckbrief);
			const canva = text(e.canva);
			const aus = text(e.aus);
			const vermerk = text(e.vermerk);
			return [
				{
					id: e.id,
					name: text(e.name) ?? gross(e.id),
					eingebaut: false,
					...(steckbrief ? { steckbrief } : {}),
					...(canva ? { canva } : {}),
					...(aus ? { aus } : {}),
					...(vermerk ? { vermerk } : {}),
					suchwoerter: Array.isArray(e.suchwoerter)
						? e.suchwoerter.filter((w): w is string => typeof w === 'string')
						: [],
					posen: [grund, ...weitere],
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
	const messung = await miss(
		konfig,
		[...pngs, ...striche.values()].map((d) => d.datei),
	);
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

/** Ein Bild aus `bilder/` der Mappe, wie ein Material es nennt. */
const BILD_DER_MAPPE = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;

interface Nutzung {
	/** Wie oft die Materialien das Bild nennen. */
	zahl: number;
	/** Änderungszeit des jüngsten Materials, das es nennt. */
	zuletzt: number;
}

const nutzungIn = async (mappeDir: string, dokumente: readonly string[]) => {
	const je = new Map<string, Nutzung>();
	for (const dok of dokumente) {
		const datei = path.join(mappeDir, 'dokumente', dok, 'material.html');
		const html = await readFile(datei, 'utf8').catch(() => '');
		const zeit = (await stat(datei).catch(() => null))?.mtimeMs ?? 0;
		for (const t of html.matchAll(BILD_DER_MAPPE)) {
			const name = t[1] ?? '';
			const alt = je.get(name);
			je.set(name, { zahl: (alt?.zahl ?? 0) + 1, zuletzt: Math.max(alt?.zuletzt ?? 0, zeit) });
		}
	}
	return je;
};

const gleicherName = (a: string, b: string) => a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de');

/** Das Aussehen aus dem Motiv einer Grundpose: „Grundpose Ella: Eichhörnchen mit … (Referenz …)“ → „Eichhörnchen mit …“. */
const aussehenAus = (motiv: string) =>
	motiv
		.replace(/^grundpose\s+[^:]*:?\s*/i, '')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/[\s,;.]+$/, '')
		.trim()
		.slice(0, 300);

/** Der Steckbrief ohne die Teile, die einen Gegenstand der Handlung nennen: Er geht in jeden späteren Bild-Prompt. */
const ohneGegenstaende = (aussehen: string, gegenstaende: readonly string[]) =>
	aussehen
		.split(/,\s*|\s+und\s+/)
		.filter((teil) => !gegenstaende.some((g) => teil.includes(g)))
		.join(', ');

/**
 * 253, einmal: die Figuren aus `bilder-herkunft.tsv` aller Mappen (Motiv „Grundpose <Name>“ oder „Pose <Name>“), ohne
 * Bilder, deren letzte Zeile `offen` ist. Je Mappe und Figur die Grundpose, ohne sie die meistgenutzte Pose; je Pose
 * die Fassung, die das jüngste Material nennt, nie eine Variante, die kein Material nennt. Gleicher Inhalt wie eine
 * Datei der Bibliothek kommt nicht doppelt; eine Pose von Willi oder Wilma kommt zu ihnen. Eine Figur mit vergebenem
 * Namen heißt „Fridolin (Fuchs)“. Nur Kopien: Keine Datei in den Mappen ändert sich (Entscheidung 26).
 */
const uebernimmEinheiten = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	gespeichert: Gespeichert,
	dateien: Set<string>,
) => {
	const { mappen } = await sammleMappen(materialDir);
	const ziel = figurenDir(materialDir);
	const inhalte = new Map<string, string>();
	for (const d of dateien) {
		if (POSEN_DATEI.test(d) && !stammVon(d).endsWith(STRICH)) {
			inhalte.set(await hashVon(path.join(ziel, d)), d);
		}
	}
	for (const { dokumente, mappe } of [...mappen].sort((a, b) => a.mappe.id.localeCompare(b.mappe.id))) {
		const dir = mappenDir(materialDir, mappe.id);
		const bilderDir = path.join(dir, 'bilder');
		const tsv = await readFile(path.join(bilderDir, 'bilder-herkunft.tsv'), 'utf8').catch(() => '');
		const zeilen = [...leseHerkunft(tsv).values()].filter(
			(z) => POSEN_DATEI.test(z.datei) && existsSync(path.join(bilderDir, z.datei)),
		);
		const namen = [...new Set(zeilen.flatMap((z) => bildFigur(z)?.figur || []))];
		if (!namen.length) {
			continue;
		}
		const nutzung = await nutzungIn(
			dir,
			dokumente.map((d) => d.id),
		);
		const genutzt = (datei: string) => nutzung.get(datei) ?? { zahl: 0, zuletzt: 0 };
		const szenen = zeilen.filter((z) => !bildFigur(z, namen)).map((z) => z.motiv);
		const herkunft = (datei: string) => path.relative(materialDir, path.join(bilderDir, datei)).split(path.sep).join('/');
		for (const name of namen) {
			const bilder = zeilen.flatMap((z) => {
				const f = bildFigur(z, namen);
				return f && gleicherName(f.figur, name) && z.art !== 'offen' ? [{ z, pose: f.pose }] : [];
			});
			const nachZahl = (a: { z: HerkunftZeile }, b: { z: HerkunftZeile }) =>
				genutzt(b.z.datei).zahl - genutzt(a.z.datei).zahl || genutzt(b.z.datei).zuletzt - genutzt(a.z.datei).zuletzt;
			const nachZeit = (a: { z: HerkunftZeile }, b: { z: HerkunftZeile }) =>
				genutzt(b.z.datei).zuletzt - genutzt(a.z.datei).zuletzt || genutzt(b.z.datei).zahl - genutzt(a.z.datei).zahl;
			const posen = new Map<string, HerkunftZeile>();
			for (const wort of new Set(bilder.map((b) => b.pose).filter((p) => p !== GRUNDPOSE))) {
				const beste = bilder.filter((b) => b.pose === wort && genutzt(b.z.datei).zahl > 0).sort(nachZeit)[0];
				if (beste) {
					posen.set(wort, beste.z);
				}
			}
			const fest = FIGUREN.find((f) => gleicherName(f.name, name));
			let grund = fest ? null : (bilder.filter((b) => b.pose === GRUNDPOSE).sort(nachZahl)[0]?.z ?? null);
			const echt = grund !== null;
			if (!grund && !fest) {
				const meist = [...posen.entries()].sort(([, a], [, b]) => nachZahl({ z: a }, { z: b }))[0];
				if (!meist) {
					continue;
				}
				grund = meist[1];
				posen.delete(meist[0]);
			}
			let figurId = fest?.id ?? '';
			if (grund) {
				const datei = path.join(bilderDir, grund.datei);
				const hash = await hashVon(datei);
				const da = inhalte.get(hash);
				const vorhanden = da
					? gespeichert.figuren.find(
							(f) => istObjekt(f) && Array.isArray(f.posen) && f.posen.some((p) => istObjekt(p) && p.datei === da),
						)
					: undefined;
				if (vorhanden) {
					figurId = vorhanden.id;
				} else {
					const gegenstaende = echt ? gegenstaendeInGrundpose(grund.motiv, name, szenen, namen) : [];
					const aussehen = ohneGegenstaende(echt ? aussehenAus(grund.motiv) : '', gegenstaende);
					figurId = neueFigurId(name, [...gespeichert.figuren.map((f) => f.id), ...[...dateien].map(stammVon)]);
					const pose = await fuegePoseEin(
						materialDir,
						gespeichert,
						dateien,
						{
							datei,
							figur: figurId,
							name: bibliotheksName(name, artAus(aussehen, name), mappe.titel, figurenAus(gespeichert, dateien)),
							herkunft: herkunft(grund.datei),
							...(aussehen ? { steckbrief: aussehen } : {}),
							aus: mappe.titel,
							...(gegenstaende.length ? { vermerk: VERMERK_GEGENSTAND } : {}),
						},
						await strichNeben(konfig, datei),
					);
					inhalte.set(hash, path.basename(pose.schluessel));
				}
			}
			for (const [wort, z] of posen) {
				const datei = path.join(bilderDir, z.datei);
				const hash = await hashVon(datei);
				if (inhalte.has(hash)) {
					continue;
				}
				const pose = await fuegePoseEin(
					materialDir,
					gespeichert,
					dateien,
					{ datei, figur: figurId, wort, herkunft: herkunft(z.datei) },
					await strichNeben(konfig, datei),
				);
				inhalte.set(hash, path.basename(pose.schluessel));
			}
		}
	}
};

/** Schreibt `figuren.json` hintereinander, nie zwei zugleich. */
const REIHEN = new Map<string, Promise<unknown>>();

const inReihe = <T>(materialDir: string, aufgabe: () => Promise<T>): Promise<T> => {
	const lauf = (REIHEN.get(materialDir) ?? Promise.resolve()).then(aufgabe, aufgabe);
	REIHEN.set(
		materialDir,
		lauf.catch(() => undefined),
	);
	return lauf;
};

/** Je Materialordner höchstens eine Übernahme zugleich. */
const UEBERNAHMEN = new Map<string, Promise<void>>();
/** 253: Materialordner, deren Figuren aus Einheiten in diesem Prozess schon geprüft sind. */
const EINHEITEN_GEPRUEFT = new Set<string>();

const sorgeFuerBibliothek = async (konfig: Pick<Konfig, 'pythonBin'>, materialDir: string) => {
	if (!existsSync(jsonDatei(materialDir))) {
		let lauf = UEBERNAHMEN.get(materialDir);
		if (!lauf) {
			lauf = uebernimmBestand(konfig, materialDir).finally(() => UEBERNAHMEN.delete(materialDir));
			UEBERNAHMEN.set(materialDir, lauf);
		}
		await lauf;
	}
	if (EINHEITEN_GEPRUEFT.has(materialDir)) {
		return;
	}
	await inReihe(materialDir, async () => {
		const gelesen = await leseDatei(materialDir);
		if (gelesen.stand !== 'da' || EINHEITEN_GEPRUEFT.has(materialDir)) {
			return;
		}
		// Scheitert sie, bleibt der Merker aus: Der nächste Start versucht es wieder, Aufnehmen geht trotzdem.
		EINHEITEN_GEPRUEFT.add(materialDir);
		if (gelesen.bibliothek.einheitenUebernommen === true) {
			return;
		}
		try {
			await uebernimmEinheiten(konfig, materialDir, gelesen.bibliothek, new Set(await dateienIn(materialDir)));
			gelesen.bibliothek.einheitenUebernommen = true;
			await schreibeJson(jsonDatei(materialDir), gelesen.bibliothek);
		} catch (fehler) {
			console.warn(`Figurenbibliothek: Figuren aus Einheiten nicht übernommen: ${fehler instanceof Error ? fehler.message : '?'}`);
		}
	});
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

/**
 * Ändert `figuren.json` in der Reihe des Materialordners: lesen, `aendere` (ändert das Gelesene an Ort und Stelle),
 * atomar schreiben. Wirft `aendere`, bleibt die Datei, wie sie war. Auch für `entfernePose` (176).
 */
const aendereBibliothek = async <T>(
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	aendere: (gespeichert: Gespeichert, dateien: ReadonlySet<string>) => T | Promise<T>,
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
	/** Pfad relativ zu `materialien/`, `openai` (neue Posen seit 237) oder `canva` (alte). */
	herkunft?: string;
	/** Nur alte Posen aus Canva: Media-ID genau dieser Pose; hat die Figur noch keine Referenz, wird sie es. */
	canva?: string;
	/** Aussehen; nur, wenn die Figur noch keinen hat. */
	steckbrief?: string;
	/** 253: Titel der Einheit; nur für eine neue Figur. */
	aus?: string;
	/** 253: Vermerk für die Lehrkraft; nur für eine neue Figur. */
	vermerk?: string;
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
	return aendereBibliothek(konfig, materialDir, (gespeichert, dateien) =>
		fuegePoseEin(materialDir, gespeichert, new Set(dateien), neu, strich),
	);
};

/** Der Teil von `nimmPoseAuf`, der in der Reihe läuft: kopieren und eintragen. `dateien` wächst mit. */
const fuegePoseEin = async (
	materialDir: string,
	gespeichert: Gespeichert,
	dateien: Set<string>,
	neu: NeuePose,
	strich: string | null,
): Promise<Pose> => {
	const endung = path.extname(neu.datei).toLowerCase();
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
	dateien.add(`${kennung}${endung}`);
	if (strich) {
		const strichName = `${kennung}${STRICH}${path.extname(strich).toLowerCase()}`;
		await kopiereAtomar(strich, path.join(ziel, strichName));
		dateien.add(strichName);
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
	if (neueFigur && !fest) {
		const aus = text(neu.aus);
		const vermerk = text(neu.vermerk);
		Object.assign(eintrag, aus ? { aus } : {}, vermerk ? { vermerk } : {});
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
};

/**
 * 199-03: Was „Entfernen“ aus `figuren.json` genommen hat, damit Rückgängig es wieder einsetzt: die ganze Figur mit
 * ihrer Stelle in der Liste oder die Posen mit ihrer Stelle in der Figur, dazu die Referenz, die die Figur dabei verlor.
 */
export type FigurRueckweg = FigurZurueck | PosenZurueck;

/** Die ganze Figur mit ihrer Stelle in der Liste. */
interface FigurZurueck {
	art: 'figur';
	index: number;
	eintrag: GespeicherteFigur;
}

/** Die Posen mit ihrer Stelle in der Figur, dazu die Referenz, die die Figur dabei verlor. */
interface PosenZurueck {
	art: 'pose';
	figur: string;
	posen: { index: number; pose: GespeichertePose }[];
	canva?: string;
}

/**
 * Streicht eine Pose aus `figuren.json`; die Grundpose nimmt die ganze Figur mit. Trug die Pose die Referenz der Figur
 * (`canva`), verliert die Figur sie, damit das nächste Canva-Bild ihre Referenz wird. Dateien in `_figuren/` bleiben
 * liegen. Die Grundposen von Willi und Wilma werfen. `null`: Diese Pose gibt es nicht; sonst der Rückweg (199-03).
 */
export const entfernePose = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	poseId: string,
): Promise<FigurRueckweg | null> => {
	if (eingebaut(poseId)) {
		throw new SchoolboxFehler('Willi und Wilma lassen sich nicht entfernen.');
	}
	return aendereBibliothek(konfig, materialDir, (gespeichert, dateien): FigurRueckweg | null => {
		const figur = figurenAus(gespeichert, dateien).find((f) => f.posen.some((p) => p.id === poseId));
		const eintrag = figur && gespeichert.figuren.find((f) => istObjekt(f) && f.id === figur.id);
		if (!figur || !eintrag || !Array.isArray(eintrag.posen)) {
			return null;
		}
		if (!figur.eingebaut && figur.posen[0]?.id === poseId) {
			const index = gespeichert.figuren.indexOf(eintrag);
			gespeichert.figuren = gespeichert.figuren.filter((f) => f !== eintrag);
			return { art: 'figur', index, eintrag };
		}
		const weg = eintrag.posen.flatMap((p: unknown, index) =>
			istObjekt(p) && typeof p.datei === 'string' && stammVon(p.datei) === poseId
				? [{ index, pose: p as GespeichertePose }]
				: [],
		);
		eintrag.posen = eintrag.posen.filter((p) => !weg.some((w) => w.pose === p));
		const referenz = text(eintrag.canva);
		const verliert = referenz && weg.some((w) => text(w.pose.canva) === referenz);
		if (verliert) {
			delete eintrag.canva;
		}
		return { art: 'pose', figur: figur.id, posen: weg, ...(verliert ? { canva: referenz } : {}) };
	});
};

/** Eine gespeicherte Pose aus dem Rückweg: nur Dateien direkt in `_figuren/`. */
const istPose = (p: unknown): p is GespeichertePose =>
	istObjekt(p) && typeof p.datei === 'string' && POSEN_DATEI.test(p.datei);

/**
 * 199-03: Rückgängig zu `entfernePose`. Setzt die Figur bzw. die Posen an ihre alte Stelle, wenn es sie nicht schon
 * wieder gibt. Die Dateien liegen noch da, weil Entfernen sie nie löscht. `false`: Der Rückweg passt nicht.
 */
export const setzeEntferntesEin = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	rueckweg: unknown,
): Promise<boolean> => {
	if (!istObjekt(rueckweg)) {
		return false;
	}
	return aendereBibliothek(konfig, materialDir, (gespeichert) => {
		const stelle = (n: unknown, laenge: number) =>
			typeof n === 'number' && Number.isInteger(n) ? Math.min(Math.max(0, n), laenge) : laenge;
		if (rueckweg.art === 'figur') {
			const e = rueckweg.eintrag;
			if (
				!istObjekt(e) ||
				typeof e.id !== 'string' ||
				!FIGUR_ID.test(e.id) ||
				eingebaut(e.id) ||
				!Array.isArray(e.posen) ||
				!e.posen.every(istPose)
			) {
				return false;
			}
			if (gespeichert.figuren.some((f) => istObjekt(f) && f.id === e.id)) {
				return true;
			}
			gespeichert.figuren.splice(stelle(rueckweg.index, gespeichert.figuren.length), 0, e as GespeicherteFigur);
			return true;
		}
		if (rueckweg.art !== 'pose' || typeof rueckweg.figur !== 'string' || !Array.isArray(rueckweg.posen)) {
			return false;
		}
		const eintrag = gespeichert.figuren.find((f) => istObjekt(f) && f.id === rueckweg.figur);
		if (!eintrag || !Array.isArray(eintrag.posen)) {
			return false;
		}
		const posen = rueckweg.posen.filter(
			(w): w is { index: number; pose: GespeichertePose } => istObjekt(w) && istPose(w.pose),
		);
		for (const w of [...posen].sort((a, b) => a.index - b.index)) {
			if (!eintrag.posen.some((p) => istObjekt(p) && p.datei === w.pose.datei)) {
				eintrag.posen.splice(stelle(w.index, eintrag.posen.length), 0, w.pose);
			}
		}
		const canva = text(rueckweg.canva);
		if (canva && !text(eintrag.canva)) {
			eintrag.canva = canva;
		}
		return true;
	});
};

/**
 * 199: Eine Figur der Bibliothek bekommt einen neuen Namen (Doppelklick auf ihren Abschnittstitel). Willi und Wilma
 * behalten ihre Namen. `false`: Diese Figur gibt es nicht.
 */
export const benenneFigur = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	materialDir: string,
	figurId: string,
	name: string,
): Promise<boolean> => {
	const neu = name.trim().replace(/\s+/g, ' ');
	if (!neu) {
		throw new SchoolboxFehler('Die Figur braucht einen Namen.');
	}
	if (neu.length > 40) {
		throw new SchoolboxFehler('Höchstens 40 Zeichen.');
	}
	if (eingebaut(figurId)) {
		throw new SchoolboxFehler('Willi und Wilma behalten ihre Namen.');
	}
	return aendereBibliothek(konfig, materialDir, (gespeichert) => {
		const eintrag = gespeichert.figuren.find((f) => istObjekt(f) && f.id === figurId);
		if (!eintrag) {
			return false;
		}
		const andere = gespeichert.figuren.flatMap((f) =>
			istObjekt(f) && typeof f.id === 'string' ? [{ id: f.id, name: text(f.name) ?? gross(f.id) }] : [],
		);
		if (figurNameVergeben(neu, andere, figurId)) {
			throw new SchoolboxFehler(NAME_VERGEBEN);
		}
		eintrag.name = neu;
		return true;
	});
};
