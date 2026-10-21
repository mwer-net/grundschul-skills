/**
 * Testmaterial für das Demo-Video, angelegt wie Claude es tut: Mappe, Dokument, Quelle schreiben, fertigstellen mit
 * blatt.py (echte Vorschauen und PDFs, damit im Bild nichts lädt). Jede Funktion prüft erst, ob es das Material schon
 * gibt; so lässt sich jedes Kapitel auch allein aufnehmen.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Art, Druckprofil, Fach, Format, Klasse } from '@schoolbox/kern';
import {
	ASSETS,
	baueEntwurfsVorschauen,
	baueFolienZusatz,
	dokumentDir,
	dupliziereMappe,
	fertigstellen,
	leseMappe,
	leseMeta,
	mappenDir,
	mappenSlug,
	neueMappe,
	neuesDokument,
	registriereEntwuerfe,
	richteKurzanleitungEin,
	waehleEntwurf,
} from '@schoolbox/kern';

export const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
const KONFIG = { materialDir: MATERIAL_DIR, pythonBin: 'python3' };
const QUELLEN = path.join(__dirname, 'material');

interface Dok {
	titel: string;
	art: Art;
	druckprofil: Druckprofil;
	format?: Format;
	/** Datei in `material/` oder absoluter Pfad; ohne bleibt die Vorlage stehen. */
	quelle?: string;
	vorlage?: string;
	druckhinweise?: string[];
}

interface MappenAngaben {
	titel: string;
	fach: Fach;
	klasse: Klasse;
}

const zeitAm = (datum: string, uhrzeit = '16:20') => new Date(`${datum}T${uhrzeit}:00+02:00`);

const quelle = (datei: string) => readFile(path.resolve(QUELLEN, datei), 'utf8');

const legeDokumentAn = async (mappe: string, dok: Dok, zeit: Date) => {
	const { art, druckhinweise = [], druckprofil, format = 'a4-hoch', titel, vorlage } = dok;
	const angaben = { titel, art, format, druckprofil, druckhinweise, vorlage };
	const { id, pfad } = await neuesDokument(MATERIAL_DIR, mappe, angaben, zeit);
	if (dok.quelle) {
		await writeFile(pfad, await quelle(dok.quelle));
	}
	await fertigstellen(KONFIG, { mappe, dok: id }, zeit);
	if (format === 'folie') {
		const dir = dokumentDir(MATERIAL_DIR, mappe, id);
		await baueFolienZusatz(KONFIG, dir, 'schritte');
		await baueFolienZusatz(KONFIG, dir, 'notizen');
	}
	return id;
};

const legeMappeAn = async (angaben: MappenAngaben, doks: Dok[], zeit: Date) => {
	const id = mappenSlug(angaben.titel, angaben.fach, angaben.klasse, zeit);
	if (existsSync(mappenDir(MATERIAL_DIR, id))) {
		return id;
	}
	await neueMappe(MATERIAL_DIR, { ...angaben, id }, zeit);
	for (const dok of doks) {
		await legeDokumentAn(id, dok, zeit);
	}
	return id;
};

/** Die Mappen, die schon da sind, bevor die Lehrkraft im Video etwas Neues bestellt. */
export const grundbestand = async () => {
	await legeMappeAn(
		{ titel: 'Zehner und Einer', fach: 'mathematik', klasse: 2 },
		[
			{
				titel: 'Zehner und Einer bündeln',
				art: 'arbeitsblatt',
				druckprofil: 'sw',
				quelle: path.join(ASSETS, 'beispiel-zehner-einer-kl2.html'),
			},
		],
		zeitAm('2026-10-09'),
	);
	await legeMappeAn(
		{ titel: 'Nomen', fach: 'deutsch', klasse: 2 },
		[{ titel: 'Nomen mit Artikel', art: 'arbeitsblatt', druckprofil: 'farbe', quelle: 'nomen.html' }],
		zeitAm('2026-10-12'),
	);
	await legeMappeAn(
		{ titel: 'Kartoffeln', fach: 'sachunterricht', klasse: 3 },
		[
			{
				titel: 'Kreisinput Kartoffel',
				art: 'praesentation',
				druckprofil: 'farbe',
				format: 'folie',
				quelle: 'kartoffel-praesentation.html',
			},
			{
				titel: 'Die Kartoffelpflanze',
				art: 'arbeitsblatt',
				druckprofil: 'farbe',
				quelle: 'kartoffel-pflanze.html',
			},
			{
				titel: 'Kartoffel-Wörter',
				art: 'karten',
				druckprofil: 'farbe',
				quelle: 'kartoffel-woerter.html',
				druckhinweise: ['Auf festes Papier drucken und laminieren.'],
			},
		],
		zeitAm('2026-10-14'),
	);
	await legeMappeAn(
		{ titel: 'Der Igel im Herbst', fach: 'deutsch', klasse: 3 },
		[{ titel: 'Der Igel im Herbst', art: 'lesetext', druckprofil: 'sw', quelle: 'igel.html' }],
		zeitAm('2026-10-16'),
	);
	await richteKurzanleitungEin(KONFIG, zeitAm('2026-10-08', '09:00'));
};

const sucheMappe = async (titel: string) => {
	for (const name of await readdir(MATERIAL_DIR)) {
		if (existsSync(path.join(MATERIAL_DIR, name, 'mappe.json'))) {
			const mappe = await leseMappe(MATERIAL_DIR, name).catch(() => null);
			if (mappe?.titel === titel) {
				return mappe;
			}
		}
	}
	return null;
};

export interface Ziel {
	mappe: string;
	dok: string;
}

const UHRZEIT_TITEL = 'Uhrzeit';

/** Die Mappe aus dem Wunsch im Video: drei Entwürfe, noch keiner gewählt. */
export const uhrzeitEntwuerfe = async (): Promise<Ziel> => {
	const da = await sucheMappe(UHRZEIT_TITEL);
	if (da) {
		return { mappe: da.id, dok: da.dokumente[0] ?? '' };
	}
	const { mappe } = await neueMappe(MATERIAL_DIR, { titel: UHRZEIT_TITEL, fach: 'mathematik', klasse: 2 });
	const { id: dok } = await neuesDokument(MATERIAL_DIR, mappe.id, {
		titel: 'Wie spät ist es?',
		art: 'arbeitsblatt',
		format: 'a4-hoch',
		druckprofil: 'sw',
		druckhinweise: ['Einseitig kopieren.'],
	});
	const dir = dokumentDir(MATERIAL_DIR, mappe.id, dok);
	const dateien: string[] = [];
	for (const name of ['a', 'b', 'c']) {
		const datei = path.join(dir, `entwurf-${name}.html`);
		await writeFile(datei, await quelle(`uhrzeit-${name}.html`));
		dateien.push(datei);
	}
	await registriereEntwuerfe(MATERIAL_DIR, { mappe: mappe.id, dok }, dateien);
	await baueEntwurfsVorschauen(KONFIG, { mappe: mappe.id, dok });
	return { mappe: mappe.id, dok };
};

/** „B, aber mit Willi“: Entwurf B wählen, Willi dazu, fertigstellen. Dauert mit blatt.py einige Sekunden. */
export const uhrzeitFertig = async (): Promise<Ziel> => {
	const ziel = await uhrzeitEntwuerfe();
	const meta = await leseMeta(MATERIAL_DIR, ziel.mappe, ziel.dok);
	if (meta.status === 'fertig') {
		return ziel;
	}
	await waehleEntwurf(MATERIAL_DIR, ziel, 'B');
	await writeFile(
		path.join(dokumentDir(MATERIAL_DIR, ziel.mappe, ziel.dok), 'material.html'),
		await quelle('uhrzeit-fertig.html'),
	);
	await fertigstellen(KONFIG, ziel);
	return ziel;
};

/** Holt das fertige Blatt zurück, falls eine frühere Aufnahme es im Editor verändert hat. */
const setzeZurueck = async (ziel: Ziel) => {
	const datei = path.join(dokumentDir(MATERIAL_DIR, ziel.mappe, ziel.dok), 'material.html');
	const fertig = await quelle('uhrzeit-fertig.html');
	if ((await readFile(datei, 'utf8')) !== fertig) {
		await writeFile(datei, fertig);
		await fertigstellen(KONFIG, ziel);
	}
	return ziel;
};

export const uhrzeitZuruecksetzen = async () => setzeZurueck(await uhrzeitFertig());

/**
 * Was Claude auf „Mach die Aufgabe schwerer“ an Aufgabe 2 ändert: gezielt diese Stelle, der Rest bleibt. In place
 * geschrieben wie Claudes Werkzeuge: Hat jemand die Datei einmal atomar ersetzt (Speichern im Editor), meldet die
 * rekursive Dateiüberwachung unter Linux keine Änderung mehr an ihr. Deshalb spielt das Video dies an der Kopie.
 */
export const machAufgabe2Schwerer = async (ziel: Ziel) => {
	const datei = path.join(dokumentDir(MATERIAL_DIR, ziel.mappe, ziel.dok), 'material.html');
	const alt = await readFile(datei, 'utf8');
	const neu = alt
		.replace('Zeichne die Zeiger ein.</span>', 'Zeichne die Zeiger ein. Jetzt mit Viertelstunden.</span>')
		.replace('<b>9 Uhr</b><x-uhr loesung="9:00"', '<b>Viertel nach 9</b><x-uhr loesung="9:15"')
		.replace('<b>halb 5</b><x-uhr loesung="4:30"', '<b>Viertel vor 5</b><x-uhr loesung="4:45"');
	if (neu === alt) {
		throw new Error('Aufgabe 2 nicht gefunden – hat sich die Vorlage geändert?');
	}
	await writeFile(datei, neu);
	await fertigstellen(KONFIG, ziel);
};

/** Die Kopie für die Parallelklasse aus Kapitel 5, falls ein späteres Kapitel allein läuft. */
export const uhrzeitKopie = async () => {
	const da = await sucheMappe(`${UHRZEIT_TITEL} (Kopie)`);
	if (da) {
		return da.id;
	}
	const ziel = await uhrzeitFertig();
	return (await dupliziereMappe(MATERIAL_DIR, ziel.mappe)).id;
};

export const kopieZuruecksetzen = async () => {
	const { dok } = await uhrzeitFertig();
	return setzeZurueck({ mappe: await uhrzeitKopie(), dok });
};

export const kartoffeln = async (): Promise<Ziel & { praesentation: string }> => {
	const mappe = await sucheMappe('Kartoffeln');
	if (!mappe) {
		throw new Error('Grundbestand fehlt');
	}
	const [praesentation = '', dok = ''] = mappe.dokumente;
	return { mappe: mappe.id, dok, praesentation };
};
