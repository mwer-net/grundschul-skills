import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Ziel } from './ablage';
import { aktualisiereMappe, dokumentDir, leseMeta, pruefeFormat, schreibeMeta } from './ablage';
import { kopiereAtomar } from './atomar';
import type { FolienZusatz } from './ausgabe';
import {
	ausgabeOrdner,
	ausgabeSchluessel,
	PDF_DATEI,
	schreibeStand,
	uebernehmeAusgabe,
	zusatzBerichtDatei,
	zusatzPdfDatei,
	zusatzStandDatei,
} from './ausgabe';
import { SchoolboxFehler } from './fehler';
import { druckprofilAusHtml } from './html';
import type { Konfig } from './konfig';
import { BLATT_PY } from './konfig';
import type { Meldung, MeldungCode } from './meldungen';
import { ohneZiele } from './meldungen';
import { entwurfVorschauDatei } from './namen';
import type { DokumentMeta, Entwurf, EntwurfPruefung, Pruefung } from './schema';
import type { Version } from './versionen';
import { legeVersionAn } from './versionen';
import type { Druckprofil } from './werte';

const BAU_TIMEOUT_MS = 5 * 60 * 1000;
/** Erste Seite des Arbeitsblatts in `ausgabe/`, so benannt wie von blatt.py. */
export const VORSCHAU_DATEI = 'material-s1.png';

/**
 * Maße aus dem Bau für den Prüflauf (249, `pruefung.js` Abschnitt 9c), in mm: leere Felder (Rahmen ohne Text und
 * Abbildung), Teile zum Ausschneiden mit dem größten und kleinsten Motiv (`null`: ohne Motiv) und Schreibplätze
 * für einen Satz oder eine Begründung (`linien`: `anzahl` Linien, `breite` der längsten, `hoehe` von oben bis unten). Gleich große einer
 * Aufgabe stehen zusammen; `aufgabe` ist „A3“, außerhalb einer Aufgabe `null`.
 */
export interface FeldMass {
	seite: number;
	aufgabe: string | null;
	art: 'leer' | 'teil' | 'linien';
	anzahl: number;
	breite: number;
	hoehe: number;
	motiv?: { klein: [number, number] | null; gross: [number, number] | null };
	/** Bei `linien`: `data-antwort` der Aufgabe; fehlt, wenn nur ihr Text nach einer Begründung fragt. */
	fuer?: 'satz' | 'begruendung';
}

export interface Pruefbericht {
	seiten: unknown[];
	meldungen: Meldung[];
	fehler: number;
	/** Fehlt bei Berichten von vor 249. */
	felder?: FeldMass[];
}

export interface Lauf {
	code: number | null;
	stdout: string;
	stderr: string;
}

export const fuehreAus = (befehl: string, argumente: string[]) =>
	new Promise<Lauf>((resolve, reject) => {
		const kind = spawn(befehl, argumente, { timeout: BAU_TIMEOUT_MS });
		let stdout = '';
		let stderr = '';
		kind.stdout.on('data', (teil: Buffer) => {
			stdout += teil.toString();
		});
		kind.stderr.on('data', (teil: Buffer) => {
			stderr += teil.toString();
		});
		kind.on('error', reject);
		kind.on('close', (code) => resolve({ code, stdout, stderr }));
	});

export const zaehle = (meldungen: Meldung[]): Pruefung => ({
	fehler: meldungen.filter((m) => m.stufe === 'FEHLER').length,
	warnungen: meldungen.filter((m) => m.stufe === 'WARNUNG').length,
	hinweise: meldungen.filter((m) => m.stufe === 'HINWEIS').length,
});

export interface Fertig {
	meta: DokumentMeta;
	bericht: Pruefbericht;
	version: Version | null;
	ausgabe: string;
	hinweiseBau: string[];
}

export const fertigstellen = async (
	konfig: Pick<Konfig, 'materialDir' | 'pythonBin'>,
	ziel: Ziel & { dok: string },
	jetzt = new Date(),
): Promise<Fertig> => {
	const { materialDir } = konfig;
	const meta = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	const dir = dokumentDir(materialDir, ziel.mappe, ziel.dok);
	const quelle = path.join(dir, 'material.html');
	const html = await readFile(quelle, 'utf8');
	pruefeFormat(meta, html, 'material.html');
	const schluessel = await ausgabeSchluessel(dir);

	const ausgabe = path.join(dir, 'ausgabe');
	await rm(ausgabe, { recursive: true, force: true });
	await mkdir(ausgabe);
	const berichtDatei = path.join(ausgabe, 'pruefbericht.json');
	const lauf = await fuehreAus(konfig.pythonBin, [
		BLATT_PY,
		'bauen',
		quelle,
		'-o',
		ausgabe,
		'--bericht',
		berichtDatei,
	]).catch((fehler: Error) => {
		throw new SchoolboxFehler(`blatt.py ließ sich nicht starten (${konfig.pythonBin}): ${fehler.message}`, 3);
	});
	if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei)) {
		throw new SchoolboxFehler(
			`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
			3,
		);
	}
	const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
	await schreibeStand(ausgabe, schluessel);

	meta.status = 'fertig';
	meta.seiten = bericht.seiten.length;
	meta.pruefung = zaehle(bericht.meldungen);
	meta.hatLoesung = existsSync(path.join(ausgabe, 'material-loesung.pdf'));
	meta.geaendert = jetzt.toISOString();
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	const version = await legeVersionAn(dir, 'claude', jetzt);
	await aktualisiereMappe(materialDir, ziel.mappe, jetzt);

	const hinweiseBau = [...new Set(lauf.stderr.split('\n').map((z) => z.trim()))].filter(Boolean);
	return { meta, bericht, version, ausgabe, hinweiseBau };
};

/**
 * Baut `ausgabe/` neu wie `fertigstellen`, aber ohne meta.json, Version und Mappe anzufassen: für PDFs, die die
 * Lehrkraft herunterlädt. Der Bau läuft in einem temporären Ordner und wird erst danach übernommen.
 * Mit `profil` entsteht die Ansicht in Farbe oder s/w; die Quelle bleibt unverändert (042).
 */
export const baueAusgabe = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	dokDir: string,
	profil?: Druckprofil,
): Promise<Pruefbericht> => {
	const schluessel = await ausgabeSchluessel(dokDir, profil);
	const ziel = await ausgabeOrdner(dokDir, profil);
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-pdf-'));
	try {
		const berichtDatei = path.join(tmp, 'pruefbericht.json');
		const quelle = path.join(dokDir, 'material.html');
		const lauf = await fuehreAus(konfig.pythonBin, [
			BLATT_PY,
			'bauen',
			quelle,
			'-o',
			tmp,
			'--bericht',
			berichtDatei,
			...(profil === undefined ? [] : ['--profil', profil]),
		]);
		if (
			(lauf.code !== 0 && lauf.code !== 1) ||
			!existsSync(berichtDatei) ||
			!existsSync(path.join(tmp, PDF_DATEI))
		) {
			throw new SchoolboxFehler(
				`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
				3,
			);
		}
		const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
		await uebernehmeAusgabe(tmp, dokDir, schluessel, ziel);
		return bericht;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/**
 * Baut einen Zusatz für Folien (PDF mit Schritten oder Folien mit Notizen) nach `ausgabe/`, samt Prüfbericht und
 * eigener Stand-Datei; der normale Bau bleibt, wie er ist. `ausgabe/` muss schon bestehen (erst der normale Bau).
 */
export const baueFolienZusatz = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	dokDir: string,
	art: FolienZusatz,
): Promise<Pruefbericht> => {
	const schluessel = await ausgabeSchluessel(dokDir);
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-folien-'));
	try {
		const berichtDatei = path.join(tmp, 'pruefbericht.json');
		const quelle = path.join(dokDir, 'material.html');
		const lauf = await fuehreAus(konfig.pythonBin, [
			BLATT_PY,
			'bauen',
			quelle,
			'-o',
			tmp,
			'--nur-zusatz',
			`--${art}`,
			'--bericht',
			berichtDatei,
		]);
		const pdf = path.join(tmp, zusatzPdfDatei(art));
		if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei) || !existsSync(pdf)) {
			throw new SchoolboxFehler(
				`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
				3,
			);
		}
		const ausgabe = path.join(dokDir, 'ausgabe');
		if (!existsSync(quelle) || !existsSync(ausgabe)) {
			throw new SchoolboxFehler('Das Dokument gibt es nicht mehr.', 3);
		}
		await kopiereAtomar(berichtDatei, path.join(ausgabe, zusatzBerichtDatei(art)));
		await kopiereAtomar(pdf, path.join(ausgabe, zusatzPdfDatei(art)));
		await schreibeStand(ausgabe, schluessel, zusatzStandDatei(art));
		return JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/**
 * Prüft eine Fassung, die noch nicht material.html ist (Vorschlag von Claude, 057). Sie liegt dafür kurz im
 * Dokumentordner, damit Bilder wie beim echten Bau gefunden werden.
 */
export const KI_PRUEFDATEI = '.ki-pruefung.html';
export const pruefeFassung = async (konfig: Pick<Konfig, 'pythonBin'>, dokDir: string, html: string) => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-pruefung-'));
	const quelle = path.join(dokDir, KI_PRUEFDATEI);
	const berichtDatei = path.join(tmp, 'pruefbericht.json');
	try {
		await writeFile(quelle, html);
		const lauf = await fuehreAus(konfig.pythonBin, [
			BLATT_PY,
			'bauen',
			quelle,
			'-o',
			tmp,
			'--nur-pruefen',
			'--bericht',
			berichtDatei,
		]);
		if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei)) {
			throw new SchoolboxFehler(
				`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
				3,
			);
		}
		return JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
	} finally {
		await rm(quelle, { force: true });
		await rm(tmp, { recursive: true, force: true });
	}
};

/** Der Ordner im Arbeitsordner von Claude, in dem die Seitenbilder des letzten Baus liegen. */
export const ANSICHT_ORDNER = 'ansicht';

/** Was blatt.py an den Namen der Quelle hängt: `-s1.png`, `-s1-a2.png`, `-loesung-s1.png`. */
const BILD_NAME = /^(-loesung)?-s(\d+)(?:-a(\d+))?\.png$/;
/** Die Bilder eines Baus in `ziel`. Nur sie räumt der nächste Bau ab: Daneben liegen die Prüfbilder der KI-Bilder (215). */
const ANSICHT_BILD = /^(loesung-)?seite-\d+(-aufgabe-\d+)?\.png$/;

export interface Ansicht {
	bericht: Pruefbericht;
	/** Dateinamen in `ziel`, in der Reihenfolge der Seiten: `seite-1.png`, `seite-1-aufgabe-1.png`, `loesung-seite-1.png`. */
	bilder: string[];
}

export interface AnsichtOptionen {
	/** Zweiter Prüfdurchgang in s/w; Standard ja. */
	sw?: boolean;
}

/** Was nur die s/w-Ansicht meldet (`pruefung.js` bei `body.sw`). */
const SW_CODES: readonly MeldungCode[] = ['kontrast-sw', 'farbwort-sw', 'bild-kontrast-sw'];

/**
 * Ohne den HINWEIS `kontrast-sw` einer Seite, die schon `kontrast-sw-schau` meldet: Beide nennen denselben Text, die
 * WARNUNG genügt (249).
 */
export const ohneDoppelKontrast = (meldungen: Meldung[]): Meldung[] => {
	const schau = new Set(meldungen.filter((m) => m.code === 'kontrast-sw-schau').map((m) => m.seite));
	return meldungen.filter((m) => m.code !== 'kontrast-sw' || !schau.has(m.seite));
};

const swPruefen = async (konfig: Pick<Konfig, 'pythonBin'>, quelle: string, ordner: string) => {
	const berichtDatei = path.join(ordner, 'pruefbericht.json');
	const lauf = await fuehreAus(konfig.pythonBin, [
		BLATT_PY,
		'bauen',
		quelle,
		'-o',
		ordner,
		'--nur-pruefen',
		'--profil',
		'sw',
		'--bericht',
		berichtDatei,
	]);
	if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei)) {
		return [];
	}
	const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
	return bericht.meldungen.filter((m) => m.code !== undefined && SW_CODES.includes(m.code));
};

/**
 * Die s/w-Meldungen einer Quelle in Farbe: ein zweiter Prüfdurchgang mit `--profil sw`, nur Bericht, keine Bilder
 * (225). Claude hat kein Bash für `blatt.py bauen --profil sw`. Eine Quelle in s/w meldet sie schon im ersten.
 */
const swMeldungen = async (konfig: Pick<Konfig, 'pythonBin'>, quelle: string): Promise<Meldung[]> => {
	if (druckprofilAusHtml(await readFile(quelle, 'utf8')) === 'sw') {
		return [];
	}
	const ordner = await mkdtemp(path.join(tmpdir(), 'schoolbox-sw-'));
	try {
		return await swPruefen(konfig, quelle, ordner);
	} finally {
		await rm(ordner, { recursive: true, force: true });
	}
};

/**
 * Baut eine Fassung so, wie `blatt.py bauen` es in der Claude-App tut, und legt Prüfbericht und Seitenbilder für die
 * visuelle Endkontrolle ab. `quelle` ist eine Datei, die neben den Bildern des Dokuments liegt; sie bleibt, wie sie ist.
 * Die Hinweise der s/w-Ansicht stehen mit im Bericht; `sw: false`, wo niemand den Bericht liest (Prüflauf).
 */
export const baueAnsichtAus = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	quelle: string,
	ziel: string,
	{ sw: mitSw = true }: AnsichtOptionen = {},
): Promise<Ansicht> => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-ansicht-'));
	const berichtDatei = path.join(tmp, 'pruefbericht.json');
	// Neben dem Bau: danach kostete der zweite Durchgang rund 7 s je Bau, daneben rund 4–5 s (225).
	const sw = mitSw ? swMeldungen(konfig, quelle).catch(() => []) : Promise.resolve([]);
	try {
		const lauf = await fuehreAus(konfig.pythonBin, [
			BLATT_PY,
			'bauen',
			quelle,
			'-o',
			tmp,
			'--bericht',
			berichtDatei,
		]);
		if ((lauf.code !== 0 && lauf.code !== 1) || !existsSync(berichtDatei)) {
			throw new SchoolboxFehler(
				`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
				3,
			);
		}
		const name = path.basename(quelle, path.extname(quelle));
		const gefunden = (await readdir(tmp))
			.filter((datei) => datei.startsWith(name))
			.map((datei) => ({ datei, t: BILD_NAME.exec(datei.slice(name.length)) }))
			.filter((e): e is { datei: string; t: RegExpExecArray } => e.t !== null)
			.map(({ datei, t }) => ({
				datei,
				loesung: Boolean(t[1]),
				seite: Number(t[2]),
				aufgabe: t[3] ? Number(t[3]) : 0,
			}))
			.sort((a, b) => Number(a.loesung) - Number(b.loesung) || a.seite - b.seite || a.aufgabe - b.aufgabe);
		await mkdir(ziel, { recursive: true });
		for (const alt of (await readdir(ziel)).filter((datei) => ANSICHT_BILD.test(datei))) {
			await rm(path.join(ziel, alt), { force: true });
		}
		const bilder: string[] = [];
		for (const b of gefunden) {
			const neu = `${b.loesung ? 'loesung-' : ''}seite-${b.seite}${b.aufgabe ? `-aufgabe-${b.aufgabe}` : ''}.png`;
			await copyFile(path.join(tmp, b.datei), path.join(ziel, neu));
			bilder.push(neu);
		}
		const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
		bericht.meldungen = ohneDoppelKontrast([...bericht.meldungen, ...(await sw)]);
		return { bericht, bilder };
	} finally {
		await sw;
		await rm(tmp, { recursive: true, force: true });
	}
};

/** Wie `pruefeFassung`, aber mit Seitenbildern: Die Fassung liegt dafür kurz im Dokumentordner. */
export const baueAnsicht = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	dokDir: string,
	html: string,
	ziel: string,
	optionen?: AnsichtOptionen,
) => {
	const quelle = path.join(dokDir, KI_PRUEFDATEI);
	try {
		await writeFile(quelle, html);
		return await baueAnsichtAus(konfig, quelle, ziel, optionen);
	} finally {
		await rm(quelle, { force: true });
	}
};

/**
 * Baut nur die Vorschau der ersten Seite nach `ausgabe/`, mit demselben blatt.py wie beim Fertigstellen. Der Bau
 * läuft in einem temporären Ordner, der Rest von `ausgabe/` (PDFs, Prüfbericht) bleibt, wie er ist.
 */
export const baueVorschau = async (konfig: Pick<Konfig, 'pythonBin'>, dokDir: string): Promise<string> => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-vorschau-'));
	try {
		const quelle = path.join(dokDir, 'material.html');
		const lauf = await fuehreAus(konfig.pythonBin, [BLATT_PY, 'bauen', quelle, '-o', tmp, '--ohne-loesung']);
		const bild = path.join(tmp, VORSCHAU_DATEI);
		if (!existsSync(bild)) {
			throw new SchoolboxFehler(
				`blatt.py hat keine Vorschau erzeugt (Exit ${lauf.code ?? 'Timeout'}):\n${lauf.stderr || lauf.stdout}`,
				3,
			);
		}
		// Der Bau dauert Sekunden. Liegt die Mappe inzwischen im Papierkorb, darf hier kein Ordner neu entstehen:
		// Er stünde dem Wiederherstellen im Weg. Deshalb nie rekursiv anlegen.
		if (!existsSync(quelle)) {
			throw new SchoolboxFehler('Das Dokument gibt es nicht mehr.', 3);
		}
		const ziel = path.join(dokDir, 'ausgabe', VORSCHAU_DATEI);
		if (!existsSync(path.dirname(ziel))) {
			await mkdir(path.dirname(ziel));
		}
		await kopiereAtomar(bild, ziel);
		return ziel;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/**
 * Baut die Vorschau eines registrierten Entwurfs nach `entwuerfe/B-s1.png` und prüft ihn, ohne Lösung. blatt.py löst
 * Pfade relativ zur Quelle auf; der Entwurf wird deshalb als Temp-Datei in den Dokumentordner kopiert und von dort
 * gebaut, damit `bilder/…` wie später in material.html stimmt.
 */
export const baueEntwurfVorschau = async (
	konfig: Pick<Konfig, 'pythonBin'>,
	dokDir: string,
	name: string,
): Promise<EntwurfPruefung> => {
	const entwurf = path.join(dokDir, 'entwuerfe', `${name}.html`);
	const stamm = `.entwurf-${name}.${process.pid}.${randomBytes(4).toString('hex')}`;
	const kopie = path.join(dokDir, `${stamm}.tmp`);
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-entwurf-'));
	try {
		await copyFile(entwurf, kopie);
		const berichtDatei = path.join(tmp, 'pruefbericht.json');
		const lauf = await fuehreAus(konfig.pythonBin, [
			BLATT_PY,
			'bauen',
			kopie,
			'-o',
			tmp,
			'--ohne-loesung',
			'--bericht',
			berichtDatei,
		]).catch((fehler: Error) => {
			throw new SchoolboxFehler(`blatt.py ließ sich nicht starten (${konfig.pythonBin}): ${fehler.message}`, 3);
		});
		const bild = path.join(tmp, `${stamm}-s1.png`);
		if (!existsSync(berichtDatei) || !existsSync(bild)) {
			throw new SchoolboxFehler(
				`blatt.py ist abgebrochen (Exit ${lauf.code ?? 'Timeout'}):\n${(lauf.stderr || lauf.stdout).trim()}`,
				3,
			);
		}
		// Eine neue Runde während des Baus hat diesen Entwurf ersetzt oder gelöscht: nichts ablegen.
		if (!existsSync(entwurf)) {
			throw new SchoolboxFehler(`Den Entwurf ${name} gibt es nicht mehr.`, 3);
		}
		await kopiereAtomar(bild, path.join(dokDir, 'entwuerfe', entwurfVorschauDatei(name)));
		const bericht = JSON.parse(await readFile(berichtDatei, 'utf8')) as Pruefbericht;
		const meldungen = bericht.meldungen.filter((m) => m.stufe === 'FEHLER').map(ohneZiele);
		return { seiten: bericht.seiten.length, passt: !meldungen.some((m) => m.text.includes('Seite')), meldungen };
	} finally {
		await Promise.all([rm(kopie, { force: true }), rm(tmp, { recursive: true, force: true })]);
	}
};

export interface EntwurfErgebnis {
	entwurf: Entwurf;
	/** Warum es keine Vorschau gibt; `null`, wenn der Bau geklappt hat. */
	fehler: string | null;
}

/**
 * Baut die Vorschauen aller registrierten Entwürfe nacheinander (Chromium braucht Speicher) und trägt das Ergebnis
 * der Prüfung in meta.json ein. Ein gescheiterter Entwurf hält die anderen nicht auf.
 */
export const baueEntwurfsVorschauen = async (
	konfig: Pick<Konfig, 'materialDir' | 'pythonBin'>,
	ziel: Ziel & { dok: string },
): Promise<EntwurfErgebnis[]> => {
	const { materialDir } = konfig;
	const dir = dokumentDir(materialDir, ziel.mappe, ziel.dok);
	const { entwuerfe } = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	const ergebnisse: EntwurfErgebnis[] = [];
	for (const entwurf of entwuerfe) {
		try {
			const pruefung = await baueEntwurfVorschau(konfig, dir, entwurf.name);
			ergebnisse.push({ entwurf: { ...entwurf, pruefung }, fehler: null });
		} catch (fehler) {
			if (!(fehler instanceof SchoolboxFehler)) {
				throw fehler;
			}
			const ohne: Entwurf = { ...entwurf };
			delete ohne.pruefung;
			ergebnisse.push({ entwurf: ohne, fehler: fehler.message });
		}
	}
	// Frisch lesen: Während der Bauten kann sich meta.json geändert haben (Titel, Druckhinweise).
	const meta = await leseMeta(materialDir, ziel.mappe, ziel.dok);
	meta.entwuerfe = meta.entwuerfe.map((alt) => ergebnisse.find((e) => e.entwurf.name === alt.name)?.entwurf ?? alt);
	await schreibeMeta(materialDir, ziel.mappe, ziel.dok, meta);
	return ergebnisse;
};
