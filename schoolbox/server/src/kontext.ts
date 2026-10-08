import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { dokumentDir } from '@schoolbox/kern';

import type { Bremse } from './bremse';
import { erstelleBremse } from './bremse';
import type { Ereignisse } from './ereignisse';
import { erstelleEreignisse } from './ereignisse';
import type { ServerKonfig } from './konfig';
import type { Sperre } from './sperre';
import { erstelleSperre } from './sperre';

/** Inhalts-Hashes, die der Server zuletzt gesehen oder selbst geschrieben hat. */
export interface Bekannt {
	quelle: string;
	meta: string;
}

export interface Kontext {
	konfig: ServerKonfig;
	ereignisse: Ereignisse;
	sperre: Sperre;
	bekannt: Map<string, Bekannt>;
	bremse: Bremse;
	version: string;
}

export const erstelleKontext = (konfig: ServerKonfig, version: string): Kontext => ({
	konfig,
	ereignisse: erstelleEreignisse(),
	sperre: erstelleSperre(),
	bekannt: new Map(),
	bremse: erstelleBremse(),
	version,
});

/** Schlüssel der Sperre für `_freigaben.json`; kann mit keiner Dokument-ID kollidieren. */
export const FREIGABEN_SPERRE = '_freigaben';

export const dokSchluessel = (mappe: string, dok: string) => `${mappe}/${dok}`;

/** Versionskennung für `basisVersion`: hängt nur vom Inhalt ab, ein bloßes `touch` ändert sie nicht. */
export const kennung = (inhalt: string | Buffer) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

const kennungDatei = async (datei: string) => kennung(await readFile(datei).catch(() => Buffer.alloc(0)));

export const leseBekannt = async (kontext: Kontext, mappe: string, dok: string): Promise<Bekannt> => {
	const dir = dokumentDir(kontext.konfig.materialDir, mappe, dok);
	const [quelle, meta] = await Promise.all([
		kennungDatei(path.join(dir, 'material.html')),
		kennungDatei(path.join(dir, 'meta.json')),
	]);
	return { quelle, meta };
};
