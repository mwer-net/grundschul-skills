/**
 * Die Herkunft der Bilder einer Mappe (237): `bilder-herkunft.tsv` für Bilder der Bild-API, `canva-ids.tsv` für alte
 * Bilder aus Canva (138). Beide liegen in `bilder/` neben den Bildern und gehen mit, wenn ein Bild aus einem
 * Arbeitsordner in die Mappe kommt. Für dieselbe Datei gilt die letzte Zeile.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { BILD_HERKUNFT } from './bild-werkzeug';

export const CANVA_IDS = 'canva-ids.tsv';
export const HERKUNFT_DATEIEN = [BILD_HERKUNFT, CANVA_IDS];

const leseTsv = async (datei: string) => {
	try {
		const zeilen = (await readFile(datei, 'utf8')).split('\n').filter((z) => z.trim());
		return { kopf: zeilen[0] ?? null, zeilen: zeilen.slice(1) };
	} catch {
		return null;
	}
};

/** Die letzte Zeile je Datei, ohne Kopfzeile. */
const letzteJeDatei = (zeilen: string[]) => {
	const je = new Map<string, string>();
	for (const z of zeilen) {
		je.set(z.split('\t')[0] ?? '', z);
	}
	return je;
};

/**
 * Trägt die Herkunft der übernommenen Bilder aus `vonBilderDir` in `zuBilderDir` ein. `bilder` ordnet den Namen im
 * Arbeitsordner dem Namen in der Mappe zu (nur Dateinamen, wie `uebernimmBilder` sie vergibt). Steht dieselbe Zeile
 * dort schon als letzte, bleibt die Datei, wie sie ist.
 */
export const uebertrageHerkunft = async (vonBilderDir: string, zuBilderDir: string, bilder: Record<string, string>) => {
	if (Object.keys(bilder).length === 0) {
		return;
	}
	for (const name of HERKUNFT_DATEIEN) {
		const von = await leseTsv(path.join(vonBilderDir, name));
		if (!von?.kopf) {
			continue;
		}
		const quelle = letzteJeDatei(von.zeilen);
		const zielDatei = path.join(zuBilderDir, name);
		const ziel = await leseTsv(zielDatei);
		const dort = letzteJeDatei(ziel?.zeilen ?? []);
		const neu: string[] = [];
		for (const [alt, umbenannt] of Object.entries(bilder)) {
			const zeile = quelle.get(alt);
			if (!zeile) {
				continue;
			}
			const felder = zeile.split('\t');
			felder[0] = umbenannt;
			const fertig = felder.join('\t');
			if (dort.get(umbenannt) !== fertig) {
				neu.push(fertig);
				dort.set(umbenannt, fertig);
			}
		}
		if (neu.length === 0) {
			continue;
		}
		await mkdir(zuBilderDir, { recursive: true });
		const kopf = existsSync(zielDatei) && ziel?.kopf ? '' : `${von.kopf}\n`;
		await appendFile(zielDatei, `${kopf}${neu.join('\n')}\n`);
	}
};

const hash = (inhalt: string | Buffer) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

/**
 * Die Kennung, an der der Import ein Material als schon übernommen erkennt: der Text und der Inhalt der Bilder, die er
 * aus dem Arbeitsordner nennt. Eine Korrektur nur am Bild ändert das HTML nicht und muss trotzdem in die Mappe. Ohne
 * Bilder ist sie die Kennung des Textes allein, wie vor 248.
 */
export const materialKennung = async (html: string, arbeit: string, bilder: readonly string[]) => {
	if (bilder.length === 0) {
		return hash(html);
	}
	const inhalte = await Promise.all(bilder.map(async (b) => `${b} ${hash(await readFile(path.join(arbeit, b)))}`));
	return hash([html, ...inhalte].join('\n'));
};
