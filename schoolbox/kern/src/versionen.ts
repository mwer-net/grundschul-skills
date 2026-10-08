import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { schreibeAtomar } from './atomar';
import type { Urheber } from './werte';
import { URHEBER } from './werte';

export const ZUSAMMENFASSEN_MS = 5 * 60 * 1000;

export interface Version {
	id: string;
	zeit: Date;
	urheber: Urheber;
}

const VERSION_MUSTER = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z_([a-z]+)\.html$/;

export const versionsName = (zeit: Date, urheber: Urheber) =>
	`${zeit.toISOString().slice(0, 19).replace(/:/g, '-')}Z_${urheber}.html`;

export const leseVersionsName = (name: string): Version | null => {
	const treffer = VERSION_MUSTER.exec(name);
	const urheber = URHEBER.find((u) => u === treffer?.[5]);
	if (!treffer || !urheber) {
		return null;
	}
	const [, tag, std, min, sek] = treffer;
	return { id: name.slice(0, -'.html'.length), zeit: new Date(`${tag}T${std}:${min}:${sek}Z`), urheber };
};

export const listeVersionen = async (dokDir: string): Promise<Version[]> => {
	const namen = await readdir(path.join(dokDir, 'versionen')).catch(() => []);
	return namen
		.map(leseVersionsName)
		.filter((v): v is Version => v !== null)
		.sort((a, b) => a.zeit.getTime() - b.zeit.getTime() || a.id.localeCompare(b.id));
};

export const versionsPfad = (dokDir: string, version: Version) => path.join(dokDir, 'versionen', `${version.id}.html`);

/**
 * Schnappschuss von material.html. Folgt er innerhalb von 5 Minuten auf eine Version desselben Urhebers, ersetzt er
 * deren Inhalt. Das Fenster beginnt beim ersten Schnappschuss und wandert nicht mit, damit auch langes Bearbeiten
 * spätestens alle 5 Minuten einen Wiederherstellungspunkt hinterlässt. Unveränderter Inhalt ergibt keine Version.
 */
export const legeVersionAn = async (dokDir: string, urheber: Urheber, jetzt = new Date()): Promise<Version | null> => {
	const inhalt = await readFile(path.join(dokDir, 'material.html'));
	await mkdir(path.join(dokDir, 'versionen'), { recursive: true });
	const letzte = (await listeVersionen(dokDir)).at(-1);
	if (letzte && (await readFile(versionsPfad(dokDir, letzte))).equals(inhalt)) {
		return null;
	}
	const abstand = letzte ? jetzt.getTime() - letzte.zeit.getTime() : Infinity;
	if (letzte && letzte.urheber === urheber && abstand >= 0 && abstand < ZUSAMMENFASSEN_MS) {
		await schreibeAtomar(versionsPfad(dokDir, letzte), inhalt);
		return letzte;
	}
	const name = versionsName(jetzt, urheber);
	const neu = leseVersionsName(name);
	if (!neu) {
		throw new Error(`Ungültiger Versionsname ${name}`);
	}
	await schreibeAtomar(versionsPfad(dokDir, neu), inhalt);
	return neu;
};
