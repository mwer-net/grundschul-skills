import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { SchoolboxFehler } from './fehler';
import type { Mappe } from './schema';
import { ID_MUSTER, MAPPE_SCHEMA, pruefeSchema } from './schema';

export const PAPIERKORB = '_papierkorb';
export const PAPIERKORB_TAGE = 30;
const TAG_MS = 24 * 60 * 60 * 1000;
const ID_REGEX = new RegExp(ID_MUSTER);
const EINTRAG_REGEX = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})T(\\d{2})-(\\d{2})-(\\d{2})Z_(${ID_MUSTER.slice(1, -1)})$`);

export interface PapierkorbEintrag {
	/** Ordnername im Papierkorb: Löschzeitpunkt und Mappen-ID. */
	eintrag: string;
	id: string;
	geloescht: string;
	/** Ab diesem Zeitpunkt wird die Mappe endgültig gelöscht. */
	bis: string;
	/** `null`, wenn sich mappe.json nicht lesen lässt. */
	mappe: Mappe | null;
}

const papierkorbDir = (materialDir: string) => path.join(materialDir, PAPIERKORB);

const eintragsName = (zeit: Date, id: string) => `${zeit.toISOString().slice(0, 19).replace(/:/g, '-')}Z_${id}`;

export const lesePapierkorbName = (name: string): { id: string; geloescht: Date } | null => {
	const treffer = EINTRAG_REGEX.exec(name);
	if (!treffer) {
		return null;
	}
	const [, tag, std, min, sek, id = ''] = treffer;
	return { id, geloescht: new Date(`${tag}T${std}:${min}:${sek}Z`) };
};

export const istPapierkorbEintrag = (name: string) => lesePapierkorbName(name) !== null;

/**
 * IDs, die im Papierkorb liegen. Neue Mappen bekommen sie nicht: Sonst zeigte ein Teilen-Link der gelöschten Mappe
 * die neue, und beim Wiederherstellen wäre der Platz belegt.
 */
export const idsImPapierkorb = (materialDir: string): Set<string> => {
	const dir = papierkorbDir(materialDir);
	const namen = existsSync(dir) ? readdirSync(dir) : [];
	return new Set(namen.map((n) => lesePapierkorbName(n)?.id).filter((id): id is string => id !== undefined));
};

const leseMappeNachsichtig = async (datei: string): Promise<Mappe | null> => {
	try {
		const daten = JSON.parse(await readFile(datei, 'utf8')) as unknown;
		return pruefeSchema(MAPPE_SCHEMA, daten).length === 0 ? (daten as Mappe) : null;
	} catch {
		return null;
	}
};

const beschreibe = async (materialDir: string, eintrag: string): Promise<PapierkorbEintrag | null> => {
	const gelesen = lesePapierkorbName(eintrag);
	if (!gelesen) {
		return null;
	}
	const { geloescht, id } = gelesen;
	return {
		eintrag,
		id,
		geloescht: geloescht.toISOString(),
		bis: new Date(geloescht.getTime() + PAPIERKORB_TAGE * TAG_MS).toISOString(),
		mappe: await leseMappeNachsichtig(path.join(papierkorbDir(materialDir), eintrag, 'mappe.json')),
	};
};

/** Neueste zuerst. Was nicht nach einem Eintrag aussieht, bleibt unangetastet und unsichtbar. */
export const listePapierkorb = async (materialDir: string): Promise<PapierkorbEintrag[]> => {
	const namen = await readdir(papierkorbDir(materialDir)).catch(() => []);
	const eintraege = await Promise.all(namen.map((n) => beschreibe(materialDir, n)));
	return eintraege
		.filter((e): e is PapierkorbEintrag => e !== null)
		.sort((a, b) => b.geloescht.localeCompare(a.geloescht));
};

export const legeInPapierkorb = async (materialDir: string, id: string, jetzt = new Date()) => {
	const quelle = path.join(materialDir, id);
	if (!ID_REGEX.test(id) || !existsSync(path.join(quelle, 'mappe.json'))) {
		throw new SchoolboxFehler(`Die Mappe „${id}“ gibt es nicht.`);
	}
	const dir = papierkorbDir(materialDir);
	await mkdir(dir, { recursive: true });
	let zeit = jetzt;
	while (existsSync(path.join(dir, eintragsName(zeit, id)))) {
		zeit = new Date(zeit.getTime() + 1000);
	}
	const eintrag = eintragsName(zeit, id);
	await rename(quelle, path.join(dir, eintrag));
	const beschrieben = await beschreibe(materialDir, eintrag);
	if (!beschrieben) {
		throw new Error(`Ungültiger Papierkorb-Eintrag ${eintrag}`);
	}
	return beschrieben;
};

export const stelleWiederHer = async (materialDir: string, eintrag: string): Promise<PapierkorbEintrag> => {
	const beschrieben = await beschreibe(materialDir, eintrag);
	const quelle = path.join(papierkorbDir(materialDir), eintrag);
	if (!beschrieben || !existsSync(quelle)) {
		throw new SchoolboxFehler('Diese Mappe liegt nicht mehr im Papierkorb.');
	}
	const ziel = path.join(materialDir, beschrieben.id);
	if (existsSync(ziel)) {
		throw new SchoolboxFehler(`Es gibt schon eine Mappe „${beschrieben.id}“. Wiederherstellen geht deshalb nicht.`);
	}
	await rename(quelle, ziel);
	return beschrieben;
};

/** Löscht endgültig, was länger als 30 Tage im Papierkorb liegt, und gibt die IDs dieser Mappen zurück. */
export const leerePapierkorb = async (materialDir: string, jetzt = new Date()): Promise<string[]> => {
	const faellig = (await listePapierkorb(materialDir)).filter((e) => new Date(e.bis).getTime() <= jetzt.getTime());
	await Promise.all(
		faellig.map((e) => rm(path.join(papierkorbDir(materialDir), e.eintrag), { recursive: true, force: true })),
	);
	return faellig.map((e) => e.id);
};
