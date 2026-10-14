import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { istTempDatei, kopiereAtomar, schreibeAtomar, schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import { entwurfAusTitel, formatAusHtml, setzeBodyKlassen, setzeTitel, titelAusHtml } from './html';
import { ASSETS } from './konfig';
import { idsImPapierkorb } from './papierkorb';
import type { DokumentMeta, Entwurf, Mappe } from './schema';
import { ID_MUSTER, MAPPE_SCHEMA, META_SCHEMA, verlangeSchema } from './schema';
import { eindeutigeId, lokalesDatum, mappenSlug, slug } from './slug';
import type { Version } from './versionen';
import { legeVersionAn } from './versionen';
import type { Art, Druckprofil, Fach, Format, Klasse, Status } from './werte';

export const WUENSCHE_DATEI = '_wuensche.md';
const MAX_ENTWUERFE = 3;
/** Je Dokument: Was sich neu erzeugen lässt oder zur Geschichte des Originals gehört, wandert nicht in eine Kopie. */
const NICHT_KOPIEREN = ['versionen', 'ausgabe'];
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
}

const freieMappenId = (materialDir: string, basis: string) => {
	const imPapierkorb = idsImPapierkorb(materialDir);
	return eindeutigeId(basis, (k) => imPapierkorb.has(k) || existsSync(path.join(materialDir, k)));
};

export const neueMappe = async (materialDir: string, { fach, klasse, titel }: NeueMappe, jetzt = new Date()) => {
	await mkdir(materialDir, { recursive: true });
	const id = freieMappenId(materialDir, mappenSlug(titel, fach, klasse, jetzt));
	const dir = mappenDir(materialDir, id);
	await mkdir(dir);
	await mkdir(path.join(dir, 'bilder'));
	await mkdir(path.join(dir, 'dokumente'));
	const zeit = jetzt.toISOString();
	const mappe: Mappe = { id, titel, fach, klasse, erstellt: zeit, geaendert: zeit, status: 'entwurf', dokumente: [] };
	await schreibeMappe(materialDir, mappe);
	return { mappe, pfad: dir };
};

export const verfuegbareVorlagen = async (): Promise<string[]> =>
	(await readdir(ASSETS))
		.map((name) => /^vorlage-([a-z0-9-]+)\.html$/.exec(name)?.[1])
		.filter((name): name is string => name !== undefined)
		.sort();

const ladeVorlage = async (vorlage: string | undefined): Promise<string> => {
	if (vorlage === undefined) {
		return GERUEST;
	}
	const vorhanden = await verfuegbareVorlagen();
	if (!vorhanden.includes(vorlage)) {
		throw new SchoolboxFehler(`Vorlage „${vorlage}“ gibt es nicht. Vorhanden: ${vorhanden.join(', ') || 'keine'}.`);
	}
	return readFile(path.join(ASSETS, `vorlage-${vorlage}.html`), 'utf8');
};

export interface NeuesDokument {
	titel: string;
	art: Art;
	format: Format;
	druckprofil: Druckprofil;
	vorlage?: string;
	druckhinweise: readonly string[];
}

export const neuesDokument = async (
	materialDir: string,
	mappeId: string,
	angaben: NeuesDokument,
	jetzt = new Date(),
) => {
	const mappe = await leseMappe(materialDir, mappeId);
	const { art, druckhinweise, druckprofil, format, titel, vorlage } = angaben;
	const dokumente = path.join(mappenDir(materialDir, mappeId), 'dokumente');
	const id = eindeutigeId(slug(titel) || 'dokument', (k) => existsSync(path.join(dokumente, k)));
	const dir = path.join(dokumente, id);
	await mkdir(dir, { recursive: true });
	await Promise.all(['bilder', 'entwuerfe', 'versionen', 'ausgabe'].map((d) => mkdir(path.join(dir, d))));
	const roh = await ladeVorlage(vorlage);
	const html = setzeBodyKlassen(setzeTitel(roh, titel), { druckprofil, format, klasse: mappe.klasse });
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
	await legeVersionAn(dir, 'claude', jetzt);
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
	const alte = (await readdir(ordner)).filter((n) => /^[A-Z]\.html$/.test(n));
	await Promise.all(alte.map((n) => rm(path.join(ordner, n))));
	const entwuerfe: Entwurf[] = [];
	for (const [i, html] of inhalte.entries()) {
		const name = String.fromCharCode(65 + i);
		await schreibeAtomar(path.join(ordner, `${name}.html`), html);
		entwuerfe.push({ name, ...entwurfAusTitel(titelAusHtml(html) ?? `Entwurf ${name}`) });
	}
	meta.entwuerfe = entwuerfe;
	meta.status = 'entwurf';
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);
	return entwuerfe;
};

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
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);
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

/**
 * Kopie einer Mappe, z. B. für die Parallelklasse: alles außer Versionen und Ausgaben, Titel „… (Kopie)“. Teilen-Links
 * hängen an der ID und gelten für die Kopie nicht. Die Kopie entsteht unter einem Punkt-Namen und erscheint erst
 * vollständig in der Ablage.
 */
export const dupliziereMappe = async (materialDir: string, mappeId: string, jetzt = new Date()): Promise<Mappe> => {
	const { dokumente, mappe: vorlage } = await leseMappenEintrag(materialDir, mappeId);
	const titel = `${vorlage.titel} (Kopie)`;
	const id = freieMappenId(materialDir, mappenSlug(titel, vorlage.fach, vorlage.klasse, jetzt));
	const quelle = mappenDir(materialDir, mappeId);
	const bau = path.join(materialDir, `.${id}.${randomBytes(4).toString('hex')}.tmp`);
	const zeit = jetzt.toISOString();
	const kopieren = (von: string) => {
		const [ordner, , unterordner, ...rest] = path.relative(quelle, von).split(path.sep);
		const ausgelassen = ordner === 'dokumente' && rest.length === 0 && NICHT_KOPIEREN.includes(unterordner ?? '');
		return !ausgelassen && !istTempDatei(path.basename(von));
	};
	try {
		await cp(quelle, bau, { recursive: true, filter: kopieren });
		for (const { id: dok, meta } of dokumente) {
			const dir = path.join(bau, 'dokumente', dok);
			await Promise.all(NICHT_KOPIEREN.map((ordner) => mkdir(path.join(dir, ordner), { recursive: true })));
			await schreibeJson(path.join(dir, 'meta.json'), { ...meta, erstellt: zeit, geaendert: zeit });
			await legeVersionAn(dir, 'lehrkraft', jetzt);
		}
		const mappe: Mappe = { ...vorlage, id, titel, erstellt: zeit, geaendert: zeit };
		await schreibeJson(path.join(bau, 'mappe.json'), mappe);
		await rename(bau, mappenDir(materialDir, id));
		return mappe;
	} catch (fehler) {
		await rm(bau, { recursive: true, force: true });
		throw fehler;
	}
};

const faltung = (text: string) => slug(text, Infinity).replace(/-/g, ' ');

export interface MappenFilter {
	fach?: Fach;
	klasse?: Klasse;
	status?: Status;
	suche?: string;
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

/** Wie `listeMappen`, nur bricht eine einzelne kaputte Mappe nicht die ganze Liste ab: Sie steht unter `defekt`. */
export const sammleMappen = async (materialDir: string, filter: MappenFilter = {}): Promise<MappenListe> => {
	const namen = await readdir(materialDir).catch(() => []);
	const kandidaten = namen.filter((n) => ID_REGEX.test(n) && existsSync(path.join(materialDir, n, 'mappe.json')));
	const gelesen = await Promise.all(kandidaten.map((id) => leseEintragOderFehler(materialDir, id)));
	const eintraege = gelesen.filter((g): g is MappenEintrag => 'mappe' in g);
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
