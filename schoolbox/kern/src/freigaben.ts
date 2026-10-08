import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Ziel } from './ablage';
import { dokumentDir, mappenDir } from './ablage';
import { schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import type { JsonSchema } from './schema';
import { ID_MUSTER, verlangeSchema } from './schema';

export const FREIGABEN_DATEI = '_freigaben.json';
export const TOKEN_MUSTER = '^[A-Za-z0-9_-]{22}$';
const TOKEN_REGEX = new RegExp(TOKEN_MUSTER);

export interface Freigabe {
	token: string;
	ziel: Ziel;
	erstellt: string;
	widerrufen: string | null;
}

const ZEIT: JsonSchema = { type: 'string', format: 'date-time' };

export const FREIGABEN_SCHEMA: JsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'schoolbox/_freigaben.json',
	type: 'object',
	required: ['freigaben'],
	properties: {
		freigaben: {
			type: 'array',
			items: {
				type: 'object',
				required: ['token', 'ziel', 'erstellt', 'widerrufen'],
				properties: {
					token: { type: 'string', pattern: TOKEN_MUSTER },
					ziel: {
						type: 'object',
						required: ['mappe', 'dok'],
						properties: {
							mappe: { type: 'string', pattern: ID_MUSTER },
							dok: { type: ['string', 'null'], pattern: ID_MUSTER },
						},
					},
					erstellt: ZEIT,
					widerrufen: { type: ['string', 'null'], format: 'date-time' },
				},
			},
		},
	},
};

const datei = (materialDir: string) => path.join(materialDir, FREIGABEN_DATEI);

export const istToken = (token: string) => TOKEN_REGEX.test(token);

/** 128 Bit aus dem Zufallsgenerator, URL-sicher (22 Zeichen Base64url). */
export const neuesToken = () => randomBytes(16).toString('base64url');

export const leseFreigaben = async (materialDir: string): Promise<Freigabe[]> => {
	const text = await readFile(datei(materialDir), 'utf8').catch((fehler: unknown) => {
		if ((fehler as { code?: unknown }).code === 'ENOENT') {
			return null;
		}
		throw fehler;
	});
	if (text === null) {
		return [];
	}
	let daten: unknown;
	try {
		daten = JSON.parse(text);
	} catch {
		throw new SchoolboxFehler(`${FREIGABEN_DATEI} ist kein gültiges JSON.`);
	}
	return verlangeSchema<{ freigaben: Freigabe[] }>(FREIGABEN_SCHEMA, daten, FREIGABEN_DATEI).freigaben;
};

const schreibeFreigaben = (materialDir: string, freigaben: Freigabe[]) =>
	schreibeJson(datei(materialDir), { freigaben });

export const findeFreigabe = async (materialDir: string, token: string): Promise<Freigabe | null> =>
	istToken(token) ? ((await leseFreigaben(materialDir)).find((f) => f.token === token) ?? null) : null;

export const zielGibtEs = (materialDir: string, { dok, mappe }: Ziel) =>
	dok === null
		? existsSync(path.join(mappenDir(materialDir, mappe), 'mappe.json'))
		: existsSync(path.join(dokumentDir(materialDir, mappe, dok), 'meta.json'));

/** Liest, ändert und schreibt die ganze Datei. Aufrufer, die parallel schreiben können, müssen das serialisieren. */
export const legeFreigabeAn = async (materialDir: string, ziel: Ziel, jetzt = new Date()): Promise<Freigabe> => {
	if (!zielGibtEs(materialDir, ziel)) {
		const was = ziel.dok === null ? `Die Mappe „${ziel.mappe}“` : `Das Dokument „${ziel.mappe}/${ziel.dok}“`;
		throw new SchoolboxFehler(`${was} gibt es nicht.`);
	}
	const freigaben = await leseFreigaben(materialDir);
	const freigabe: Freigabe = { token: neuesToken(), ziel, erstellt: jetzt.toISOString(), widerrufen: null };
	await schreibeFreigaben(materialDir, [...freigaben, freigabe]);
	return freigabe;
};

export const widerrufeFreigabe = async (
	materialDir: string,
	token: string,
	jetzt = new Date(),
): Promise<Freigabe | null> => {
	const freigaben = await leseFreigaben(materialDir);
	const freigabe = freigaben.find((f) => f.token === token);
	if (!freigabe) {
		return null;
	}
	if (freigabe.widerrufen === null) {
		freigabe.widerrufen = jetzt.toISOString();
		await schreibeFreigaben(materialDir, freigaben);
	}
	return freigabe;
};
