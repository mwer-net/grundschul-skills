import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { istTempDatei, kopiereAtomar, schreibeAtomar, schreibeJson } from './atomar';
import type { Zusatz } from './einfuegen';
import { fuegeZusatzEin } from './einfuegen';
import { SchoolboxFehler } from './fehler';
import { entwurfAusTitel, formatAusHtml, setzeBodyKlassen, setzeTitel, titelAusHtml } from './html';
import { leseStarter } from './katalog-starter';
import { ASSETS } from './konfig';
import type { Baum } from './ordner';
import { dokumentGeloescht, leseBaumNachsichtig, ordnerGeloescht } from './ordner';
import { idsImPapierkorb } from './papierkorb';
import type { DokumentMeta, Entwurf, Mappe } from './schema';
import { ID_MUSTER, MAPPE_SCHEMA, META_SCHEMA, verlangeSchema } from './schema';
import { eindeutigeId, lokalesDatum, mappenSlug, slug } from './slug';
import { wuerfleNeu } from './variante';
import type { Version } from './versionen';
import { legeVersionAn } from './versionen';
import type { Art, Druckprofil, Fach, Format, Klasse, Status, Urheber } from './werte';

export const WUENSCHE_DATEI = '_wuensche.md';
const MAX_ENTWUERFE = 3;
/** Eine Runde in `entwuerfe/`: `B.html` und seine Vorschau `B-s1.png`. */
const ENTWURF_DATEI = /^[A-Z](\.html|-s\d+\.png)$/;
/** So schreibt Claude die Entwürfe in den Dokumentordner (Lehrkraft-Anweisungen, Skill `html-materialerstellung`). */
export const ENTWURF_QUELLE = /^entwurf-[a-z]\.html$/;
/** Je Dokument: Was sich neu erzeugen lässt oder zur Geschichte des Originals gehört, wandert nicht in eine Kopie. */
const NICHT_KOPIEREN = ['versionen', 'ausgabe'];
/** Gehören zum laufenden Auftrag an Claude (057) und entstehen in der Kopie auch nicht leer neu. */
const NUR_IM_ORIGINAL = ['vorschlag', '.ki-pruefung.html'];
const ID_REGEX = new RegExp(ID_MUSTER);

const GERUEST = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title></title>
<link rel="stylesheet" href="blatt.css">
<script src="abbildungen.js"></script>
</head>
<body class="">
<section class="seite">
</section>
</body>
</html>
`;

export interface Ziel {
	mappe: string;
	dok: string | null;
}

export const pruefeId = (id: string, was: string): string => {
	if (!ID_REGEX.test(id)) {
		throw new SchoolboxFehler(`${was} „${id}“ ist keine gültige ID (nur a–z, 0–9 und Bindestriche).`);
	}
	return id;
};

export const zerlegeZiel = (ziel: string | undefined, dokumentNoetig: boolean): Ziel => {
	const teile = (ziel ?? '').replace(/^\/+|\/+$/g, '').split('/');
	const [mappe = '', dok] = teile;
	if (!mappe || teile.length > 2 || (dokumentNoetig && !dok)) {
		const form = dokumentNoetig ? '<mappe>/<dokument>' : '<mappe>[/<dokument>]';
		throw new SchoolboxFehler(`Ziel fehlt oder ist ungültig: „${ziel ?? ''}“. Erwartet ${form}.`);
	}
	return { mappe: pruefeId(mappe, 'Mappe'), dok: dok ? pruefeId(dok, 'Dokument') : null };
};

export const mappenDir = (materialDir: string, mappe: string) => path.join(materialDir, pruefeId(mappe, 'Mappe'));

export const dokumentDir = (materialDir: string, mappe: string, dok: string) =>
	path.join(mappenDir(materialDir, mappe), 'dokumente', pruefeId(dok, 'Dokument'));

const leseJson = async (datei: string, fehlt: string): Promise<unknown> => {
	const text = await readFile(datei, 'utf8').catch(() => {
		throw new SchoolboxFehler(fehlt);
	});
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new SchoolboxFehler(`${datei} ist kein gültiges JSON.`);
	}
};

export const leseMappe = async (materialDir: string, mappe: string): Promise<Mappe> => {
	const datei = path.join(mappenDir(materialDir, mappe), 'mappe.json');
	const fehlt = `Die Mappe „${mappe}“ gibt es nicht. „schoolbox liste“ zeigt alle Mappen.`;
	return verlangeSchema<Mappe>(MAPPE_SCHEMA, await leseJson(datei, fehlt), datei);
};

export const schreibeMappe = (materialDir: string, mappe: Mappe) =>
	schreibeJson(path.join(mappenDir(materialDir, mappe.id), 'mappe.json'), mappe);

export const leseMeta = async (materialDir: string, mappe: string, dok: string): Promise<DokumentMeta> => {
	const datei = path.join(dokumentDir(materialDir, mappe, dok), 'meta.json');
	const fehlt = `Das Dokument „${mappe}/${dok}“ gibt es nicht.`;
	return verlangeSchema<DokumentMeta>(META_SCHEMA, await leseJson(datei, fehlt), datei);
};

export const schreibeMeta = (materialDir: string, mappe: string, dok: string, meta: DokumentMeta) =>
	schreibeJson(path.join(dokumentDir(materialDir, mappe, dok), 'meta.json'), meta);

export const aktualisiereMappe = async (
	materialDir: string,
	mappeId: string,
	jetzt: Date,
	aenderung?: (m: Mappe) => void,
) => {
	const mappe = await leseMappe(materialDir, mappeId);
	aenderung?.(mappe);
	const metas = await Promise.all(mappe.dokumente.map((d) => leseMeta(materialDir, mappeId, d)));
	mappe.status = metas.length > 0 && metas.every((m) => m.status === 'fertig') ? 'fertig' : 'entwurf';
	mappe.geaendert = jetzt.toISOString();
	await schreibeMappe(materialDir, mappe);
	return mappe;
};

export interface NeueMappe {
	titel: string;
	fach: Fach;
	klasse: Klasse;
	/** Feste ID statt einer aus Datum und Titel, z. B. für die Mappe „Schoolbox-Hilfe“. Gibt es sie schon: Fehler. */
	id?: string;
	/** Ordnerpfad wie `Klasse 3/Mathe` für die erste Einordnung; `_ordner.json` schreibt nur der Server. */
	ablage?: string;
}

const freieMappenId = (materialDir: string, basis: string) => {
	const imPapierkorb = idsImPapierkorb(materialDir);
	return eindeutigeId(basis, (k) => imPapierkorb.has(k) || existsSync(path.join(materialDir, k)));
};

export const neueMappe = async (
	materialDir: string,
	{ ablage, fach, id: festeId, klasse, titel }: NeueMappe,
	jetzt = new Date(),
) => {
	await mkdir(materialDir, { recursive: true });
	const id =
		festeId === undefined
			? freieMappenId(materialDir, mappenSlug(titel, fach, klasse, jetzt))
			: pruefeId(festeId, 'Mappe');
	const dir = mappenDir(materialDir, id);
	await mkdir(dir);
	await mkdir(path.join(dir, 'bilder'));
	await mkdir(path.join(dir, 'dokumente'));
	const zeit = jetzt.toISOString();
	const mappe: Mappe = {
		id,
		titel,
		fach,
		klasse,
		erstellt: zeit,
		geaendert: zeit,
		status: 'entwurf',
		dokumente: [],
		...(ablage ? { ablage } : {}),
	};
	await schreibeMappe(materialDir, mappe);
	return { mappe, pfad: dir };
};

/** Mitgelieferte Vorlagen; mit `materialDir` auch die eigenen als `eigen-<id>` (051). */
export const verfuegbareVorlagen = (materialDir?: string): string[] => {
	const ablage = materialDir ? path.join(materialDir, '_vorlagen') : null;
	const eigene = ablage && existsSync(ablage) ? readdirSync(ablage) : [];
	return [
		...readdirSync(ASSETS)
			.map((name) => /^vorlage-([a-z0-9-]+)\.html$/.exec(name)?.[1])
			.filter((name): name is string => name !== undefined)
			.sort(),
		...eigene.filter((n) => ID_REGEX.test(n)).map((n) => `eigen-${n}`),
	];
};

const EIGEN = 'eigen-';

const ladeVorlage = async (materialDir: string, vorlage: string | undefined): Promise<string> => {
	if (vorlage === undefined) {
		return GERUEST;
	}
	const vorhanden = verfuegbareVorlagen(materialDir);
	if (!vorhanden.includes(vorlage)) {
		throw new SchoolboxFehler(`Vorlage „${vorlage}“ gibt es nicht. Vorhanden: ${vorhanden.join(', ') || 'keine'}.`);
	}
	return vorlage.startsWith(EIGEN)
		? readFile(path.join(materialDir, '_vorlagen', vorlage.slice(EIGEN.length), 'material.html'), 'utf8')
		: readFile(path.join(ASSETS, `vorlage-${vorlage}.html`), 'utf8');
};

export interface NeuesDokument {
	titel: string;
	art: Art;
	format: Format;
	druckprofil: Druckprofil;
	vorlage?: string;
	druckhinweise: readonly string[];
	/** Wer das Dokument anlegt; ohne Angabe Claude über die CLI. */
	urheber?: Urheber;
	/** Zusatzbausteine aus dem Assistenten (045). */
	zusatz?: Zusatz;
}

export const neuesDokument = async (
	materialDir: string,
	mappeId: string,
	angaben: NeuesDokument,
	jetzt = new Date(),
) => {
	const mappe = await leseMappe(materialDir, mappeId);
	const { art, druckhinweise, druckprofil, titel, urheber = 'claude', vorlage, zusatz } = angaben;
	// Eine eigene Vorlage bringt ihr Format mit: Das Layout hängt daran.
	const eigeneVorlage = vorlage?.startsWith(EIGEN)
		? path.join(materialDir, '_vorlagen', vorlage.slice(EIGEN.length))
		: null;
	const format: Format =
		eigeneVorlage && existsSync(path.join(eigeneVorlage, 'vorlage.json'))
			? (JSON.parse(await readFile(path.join(eigeneVorlage, 'vorlage.json'), 'utf8')) as { format: Format })
					.format
			: angaben.format;
	const dokumente = path.join(mappenDir(materialDir, mappeId), 'dokumente');
	const id = eindeutigeId(slug(titel) || 'dokument', (k) => existsSync(path.join(dokumente, k)));
	const dir = path.join(dokumente, id);
	await mkdir(dir, { recursive: true });
	await Promise.all(['bilder', 'entwuerfe', 'versionen', 'ausgabe'].map((d) => mkdir(path.join(dir, d))));
	const roh = await ladeVorlage(materialDir, vorlage);
	if (eigeneVorlage && existsSync(path.join(eigeneVorlage, 'bilder'))) {
		await cp(path.join(eigeneVorlage, 'bilder'), path.join(dir, 'bilder'), { recursive: true });
	}
	const klassen = setzeBodyKlassen(setzeTitel(roh, titel), { druckprofil, format, klasse: mappe.klasse });
	const html = zusatz ? fuegeZusatzEin(klassen, zusatz, leseStarter(), { jeSeite: format === 'folie' }) : klassen;
	await schreibeAtomar(path.join(dir, 'material.html'), html);
	const zeit = jetzt.toISOString();
	const meta: DokumentMeta = {
		titel,
		art,
		format,
		druckprofil,
		hatLoesung: false,
		druckhinweise: [...druckhinweise],
		status: 'entwurf',
		seiten: 0,
		pruefung: null,
		entwuerfe: [],
		erstellt: zeit,
		geaendert: zeit,
	};
	await schreibeMeta(materialDir, mappeId, id, meta);
	await legeVersionAn(dir, urheber, jetzt);
	await aktualisiereMappe(materialDir, mappeId, jetzt, (m) => {
		m.dokumente.push(id);
	});
	return { id, meta, pfad: path.join(dir, 'material.html') };
};

export const pruefeFormat = (meta: DokumentMeta, html: string, datei: string) => {
	const imHtml = formatAusHtml(html);
	if (imHtml !== meta.format) {
		const befund = `meta.json sagt „${meta.format}“, die <body>-Klasse in ${datei} ergibt „${imHtml}“`;
		throw new SchoolboxFehler(
			`Format passt nicht: ${befund}. Bitte die <body>-Klasse anpassen (a4-hoch = keine Formatklasse).`,
		);
	}
};

export const registriereEntwuerfe = async (
	materialDir: string,
	ziel: Ziel & { dok: string },
	dateien: string[],
	jetzt = new Date(),
) => {
	if (dateien.length < 1 || dateien.length > MAX_ENTWUERFE) {
		throw new SchoolboxFehler(`Bitte 1 bis ${MAX_ENTWUERFE} Entwürfe angeben (HTML-Dateien).`);
	}
	const meta = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	const fehlend = dateien.filter((d) => !existsSync(d));
	if (fehlend.length > 0) {
		throw new SchoolboxFehler(`Datei nicht gefunden: ${fehlend.join(', ')}`);
	}
	const ordner = path.join(dokumentDir(materialDir, ziel.mappe, ziel.dok), 'entwuerfe');
	await mkdir(ordner, { recursive: true });
	// Erst lesen, dann die alte Runde löschen: Eine Quelle kann selbst ein registrierter Entwurf sein (zweite Runde)
	const inhalte = await Promise.all(dateien.map((datei) => readFile(datei, 'utf8')));
	const alte = (await readdir(ordner)).filter((n) => ENTWURF_DATEI.test(n));
	await Promise.all(alte.map((n) => rm(path.join(ordner, n))));
	const entwuerfe: Entwurf[] = [];
	for (const [i, html] of inhalte.entries()) {
		const name = String.fromCharCode(65 + i);
		await schreibeAtomar(path.join(ordner, `${name}.html`), html);
		entwuerfe.push({ name, ...entwurfAusTitel(titelAusHtml(html) ?? `Entwurf ${name}`) });
	}
	meta.entwuerfe = entwuerfe;
	meta.gewaehlt = null;
	meta.status = 'entwurf';
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);
	return entwuerfe;
};

/**
 * Übernimmt einen registrierten Entwurf als material.html. Die Runde in `entwuerfe/` bleibt zum Nachsehen; die
 * Arbeitsdateien `entwurf-a.html` … im Dokumentordner haben ausgedient und würden sonst über Teilen-Links und Kopien
 * der Mappe mitwandern.
 */
export const waehleEntwurf = async (
	materialDir: string,
	ziel: Ziel & { dok: string },
	name: string,
	jetzt = new Date(),
): Promise<{ entwurf: Entwurf; version: Version | null }> => {
	const meta = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	const entwurf = meta.entwuerfe.find((e) => e.name === name.trim().toUpperCase());
	if (!entwurf) {
		const vorhanden = meta.entwuerfe.map((e) => e.name).join(', ') || 'keine';
		throw new SchoolboxFehler(`Entwurf „${name}“ gibt es nicht. Registrierte Entwürfe: ${vorhanden}.`);
	}
	const dir = dokumentDir(materialDir, ziel.mappe, ziel.dok);
	const quelle = path.join(dir, 'entwuerfe', `${entwurf.name}.html`);
	pruefeFormat(meta, await readFile(quelle, 'utf8'), `Entwurf ${entwurf.name}`);
	await kopiereAtomar(quelle, path.join(dir, 'material.html'));
	const version = await legeVersionAn(dir, 'claude', jetzt);
	meta.gewaehlt = entwurf.name;
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);
	const arbeitsdateien = (await readdir(dir)).filter((n) => ENTWURF_QUELLE.test(n));
	await Promise.all(arbeitsdateien.map((n) => rm(path.join(dir, n), { force: true })));
	return { entwurf, version };
};

export interface MappenEintrag {
	mappe: Mappe;
	dokumente: { id: string; meta: DokumentMeta }[];
}

export const leseMappenEintrag = async (materialDir: string, id: string): Promise<MappenEintrag> => {
	const mappe = await leseMappe(materialDir, id);
	const dokumente = await Promise.all(
		mappe.dokumente.map(async (d) => ({ id: d, meta: await leseMeta(materialDir, id, d) })),
	);
	return { mappe, dokumente };
};

export interface KopieWahl {
	/** Nur diese Dokumente kommen mit (079); die Reihenfolge der Mappe bleibt auch in `erstellt` erhalten. */
	nurDokumente?: readonly string[];
	/** Titel der Kopie; ohne Angabe „… (Kopie)“. */
	titel?: string;
}

/**
 * Kopie einer Mappe, z. B. für die Parallelklasse: alles außer Versionen und Ausgaben (auch „Alles als PDF“), Titel
 * „… (Kopie)“. Teilen-Links hängen an der ID und gelten für die Kopie nicht. Die Kopie entsteht unter einem
 * Punkt-Namen und erscheint erst vollständig in der Ablage.
 */
export const dupliziereMappe = async (
	materialDir: string,
	mappeId: string,
	jetzt = new Date(),
	wahl: KopieWahl = {},
): Promise<Mappe> => {
	const { dokumente: alle, mappe: vorlage } = await leseMappenEintrag(materialDir, mappeId);
	const { nurDokumente } = wahl;
	const dokumente = nurDokumente ? alle.filter((d) => nurDokumente.includes(d.id)) : alle;
	const mitnehmen = new Set(dokumente.map((d) => d.id));
	const titel = wahl.titel ?? `${vorlage.titel} (Kopie)`;
	const id = freieMappenId(materialDir, mappenSlug(titel, vorlage.fach, vorlage.klasse, jetzt));
	const quelle = mappenDir(materialDir, mappeId);
	const bau = path.join(materialDir, `.${id}.${randomBytes(4).toString('hex')}.tmp`);
	const zeit = jetzt.toISOString();
	const kopieren = (von: string) => {
		const [ordner, dok, unterordner, ...rest] = path.relative(quelle, von).split(path.sep);
		if (ordner === 'dokumente' && dok !== undefined && !mitnehmen.has(dok)) {
			return false;
		}
		const imDokument =
			ordner === 'dokumente' &&
			rest.length === 0 &&
			[...NICHT_KOPIEREN, ...NUR_IM_ORIGINAL].includes(unterordner ?? '');
		const mappenAusgabe = path.relative(quelle, von) === 'ausgabe';
		return !imDokument && !mappenAusgabe && !istTempDatei(path.basename(von));
	};
	try {
		await cp(quelle, bau, { recursive: true, filter: kopieren });
		for (const [i, { id: dok, meta }] of dokumente.entries()) {
			const dir = path.join(bau, 'dokumente', dok);
			await Promise.all(NICHT_KOPIEREN.map((ordner) => mkdir(path.join(dir, ordner), { recursive: true })));
			const erstellt = nurDokumente ? new Date(jetzt.getTime() + i).toISOString() : zeit;
			await schreibeJson(path.join(dir, 'meta.json'), { ...meta, erstellt, geaendert: zeit });
			await legeVersionAn(dir, 'lehrkraft', jetzt);
		}
		const { ablage: _ablage, ...rest } = vorlage;
		const mappe: Mappe = {
			...rest,
			id,
			titel,
			erstellt: zeit,
			geaendert: zeit,
			dokumente: dokumente.map((d) => d.id),
		};
		await schreibeJson(path.join(bau, 'mappe.json'), mappe);
		await rename(bau, mappenDir(materialDir, id));
		return mappe;
	} catch (fehler) {
		await rm(bau, { recursive: true, force: true });
		throw fehler;
	}
};

/** Nächster freier Buchstabe: „Diktat“ wird „Diktat (B)“, aus „Diktat (B)“ wird „Diktat (C)“. */
const variantenTitel = (titel: string, vergeben: string[]) => {
	const grund = titel.replace(/\s\([B-Z]\)$/, '');
	for (let c = 66; c <= 90; c++) {
		const kandidat = `${grund} (${String.fromCharCode(c)})`;
		if (!vergeben.includes(kandidat)) {
			return kandidat;
		}
	}
	throw new SchoolboxFehler('In diesem Ordner gibt es schon alle Varianten bis Z.');
};

/**
 * Zweites Dokument gleichen Layouts mit anderen Zahlen (050), direkt hinter dem Original. Ohne Generierbares entsteht
 * nichts, sonst läge eine bloße Kopie unter dem Namen einer Variante in der Mappe.
 */
export const legeVarianteAn = async (materialDir: string, mappeId: string, dok: string, jetzt = new Date()) => {
	const { dokumente, mappe } = await leseMappenEintrag(materialDir, mappeId);
	const eintrag = dokumente.find((d) => d.id === dok);
	if (!eintrag) {
		throw new SchoolboxFehler('Dieses Dokument gibt es nicht.');
	}
	const quelle = dokumentDir(materialDir, mappeId, dok);
	const html = await readFile(path.join(quelle, 'material.html'), 'utf8');
	const { geaendert, quelle: gewuerfelt } = wuerfleNeu(html, `${dok}-${jetzt.getTime()}`);
	if (geaendert === 0) {
		throw new SchoolboxFehler('In diesem Dokument gibt es keine Zahlen, die sich neu würfeln lassen.');
	}
	const titel = variantenTitel(
		eintrag.meta.titel,
		dokumente.map((d) => d.meta.titel),
	);
	const ablage = path.join(mappenDir(materialDir, mappeId), 'dokumente');
	const id = eindeutigeId(slug(titel) || 'dokument', (k) => existsSync(path.join(ablage, k)));
	const dir = path.join(ablage, id);
	const bau = path.join(ablage, `.${id}.${randomBytes(4).toString('hex')}.tmp`);
	const zeit = jetzt.toISOString();
	try {
		await cp(quelle, bau, {
			recursive: true,
			filter: (von) => {
				const name = path.relative(quelle, von);
				return ![...NICHT_KOPIEREN, ...NUR_IM_ORIGINAL].includes(name) && !istTempDatei(path.basename(von));
			},
		});
		await Promise.all(NICHT_KOPIEREN.map((ordner) => mkdir(path.join(bau, ordner), { recursive: true })));
		await schreibeAtomar(path.join(bau, 'material.html'), setzeTitel(gewuerfelt, titel));
		const meta: DokumentMeta = {
			...eintrag.meta,
			titel,
			pruefung: null,
			status: 'entwurf',
			erstellt: zeit,
			geaendert: zeit,
		};
		await schreibeJson(path.join(bau, 'meta.json'), meta);
		await legeVersionAn(bau, 'lehrkraft', jetzt);
		await rename(bau, dir);
	} catch (fehler) {
		await rm(bau, { recursive: true, force: true });
		throw fehler;
	}
	await aktualisiereMappe(materialDir, mappe.id, jetzt, (m) => {
		m.dokumente.splice(m.dokumente.indexOf(dok) + 1, 0, id);
	});
	return { id, titel };
};

const faltung = (text: string) => slug(text, Infinity).replace(/-/g, ' ');

export interface MappenFilter {
	fach?: Fach;
	klasse?: Klasse;
	status?: Status;
	suche?: string;
	/** Auch, was im Ordnerbaum im Papierkorb liegt (nur für den Abgleich und das Aufräumen). */
	mitGeloeschten?: boolean;
}

export interface DefekteMappe {
	id: string;
	fehler: string;
}

export interface MappenListe {
	mappen: MappenEintrag[];
	/** Mappen, deren mappe.json oder meta.json sich nicht lesen lässt (Claude schreibt sie von Hand). */
	defekt: DefekteMappe[];
}

const leseEintragOderFehler = async (materialDir: string, id: string): Promise<MappenEintrag | DefekteMappe> => {
	try {
		const eintrag = await leseMappenEintrag(materialDir, id);
		if (eintrag.mappe.id !== id) {
			throw new SchoolboxFehler(`mappe.json nennt die ID „${eintrag.mappe.id}“, der Ordner heißt „${id}“.`);
		}
		return eintrag;
	} catch (fehler) {
		if (!(fehler instanceof SchoolboxFehler)) {
			throw fehler;
		}
		return { id, fehler: fehler.message.replaceAll(`${materialDir}${path.sep}`, '') };
	}
};

/** Der Papierkorb ist ein Zustand im Baum (079): Die Dateien bleiben liegen, zu sehen sind sie nicht mehr. */
const ohneGeloeschte = (eintrag: MappenEintrag, baum: Baum): MappenEintrag | null => {
	const { id } = eintrag.mappe;
	const dokumente = eintrag.dokumente.filter((d) => !dokumentGeloescht(baum, id, d.id));
	const ordnerWeg = baum.ordner.some((o) => o.behaelter === id && ordnerGeloescht(baum, o.id));
	if (dokumente.length === 0 && (eintrag.dokumente.length > 0 || ordnerWeg)) {
		return null;
	}
	return { dokumente, mappe: { ...eintrag.mappe, dokumente: dokumente.map((d) => d.id) } };
};

/** Wie `listeMappen`, nur bricht eine einzelne kaputte Mappe nicht die ganze Liste ab: Sie steht unter `defekt`. */
export const sammleMappen = async (materialDir: string, filter: MappenFilter = {}): Promise<MappenListe> => {
	const namen = await readdir(materialDir).catch(() => []);
	const kandidaten = namen.filter((n) => ID_REGEX.test(n) && existsSync(path.join(materialDir, n, 'mappe.json')));
	const gelesen = await Promise.all(kandidaten.map((id) => leseEintragOderFehler(materialDir, id)));
	const baum = filter.mitGeloeschten ? null : leseBaumNachsichtig(materialDir);
	const eintraege = gelesen
		.filter((g): g is MappenEintrag => 'mappe' in g)
		.map((e) => (baum ? ohneGeloeschte(e, baum) : e))
		.filter((e): e is MappenEintrag => e !== null);
	const defekt = gelesen.filter((g): g is DefekteMappe => 'fehler' in g);
	const suche = filter.suche ? faltung(filter.suche) : '';
	const mappen = eintraege
		.filter(({ mappe }) => !filter.fach || mappe.fach === filter.fach)
		.filter(({ mappe }) => filter.klasse === undefined || mappe.klasse === filter.klasse)
		.filter(({ mappe }) => !filter.status || mappe.status === filter.status)
		.filter(({ dokumente, mappe }) => {
			const text = faltung([mappe.id, mappe.titel, ...dokumente.map((d) => d.meta.titel)].join(' '));
			return suche.split(' ').every((wort) => text.includes(wort));
		})
		.sort((a, b) => b.mappe.geaendert.localeCompare(a.mappe.geaendert));
	return { mappen, defekt };
};

export const listeMappen = async (materialDir: string, filter: MappenFilter = {}) =>
	(await sammleMappen(materialDir, filter)).mappen;

export const notiereWunsch = async (materialDir: string, text: string, jetzt = new Date()) => {
	const wunsch = text.trim().replace(/\s*\n\s*/g, ' ');
	if (!wunsch) {
		throw new SchoolboxFehler('Der Wunsch ist leer.');
	}
	await mkdir(materialDir, { recursive: true });
	const datei = path.join(materialDir, WUENSCHE_DATEI);
	const bisher = await readFile(datei, 'utf8').catch(() => '# Wünsche der Lehrkraft\n\n');
	const trenner = bisher.endsWith('\n') ? '' : '\n';
	const uhrzeit = [jetzt.getHours(), jetzt.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
	await schreibeAtomar(datei, `${bisher}${trenner}- ${lokalesDatum(jetzt)} ${uhrzeit}: ${wunsch}\n`);
	return datei;
};
