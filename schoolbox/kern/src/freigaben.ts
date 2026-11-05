import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Ziel } from './ablage';
import { dokumentDir, mappenDir } from './ablage';
import { schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import { lebenderOrdner, leseBaumNachsichtig } from './ordner';
import type { JsonSchema } from './schema';
import { ID_MUSTER, verlangeSchema } from './schema';

export const FREIGABEN_DATEI = '_freigaben.json';
export const TOKEN_MUSTER = '^[A-Za-z0-9_-]{22}$';
const TOKEN_REGEX = new RegExp(TOKEN_MUSTER);

/**
 * Ein Ordner-Link. Steht in einer zweiten Liste `ordnerFreigaben`: `FREIGABEN_SCHEMA` verlangt in `freigaben` Mappe und
 * Dokument, und ein älterer Stand (Revert) soll die Datei weiter lesen können.
 */
export type FreigabeZiel = Ziel | { ordner: string };

export interface Freigabe {
	token: string;
	ziel: FreigabeZiel;
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

interface FreigabenDatei {
	freigaben: Freigabe[];
	ordnerFreigaben?: Freigabe[];
}

const leseDatei = async (materialDir: string): Promise<FreigabenDatei> => {
	const text = await readFile(datei(materialDir), 'utf8').catch((fehler: unknown) => {
		if ((fehler as { code?: unknown }).code === 'ENOENT') {
			return null;
		}
		throw fehler;
	});
	if (text === null) {
		return { freigaben: [] };
	}
	let daten: unknown;
	try {
		daten = JSON.parse(text);
	} catch {
		throw new SchoolboxFehler(`${FREIGABEN_DATEI} ist kein gültiges JSON.`);
	}
	return verlangeSchema<FreigabenDatei>(FREIGABEN_SCHEMA, daten, FREIGABEN_DATEI);
};

export const leseFreigaben = async (materialDir: string): Promise<Freigabe[]> => {
	const { freigaben, ordnerFreigaben = [] } = await leseDatei(materialDir);
	return [...freigaben, ...ordnerFreigaben];
};

const istOrdnerLink = (f: Freigabe) => 'ordner' in f.ziel;

const schreibeFreigaben = (materialDir: string, liste: Freigabe[]) => {
	const ordnerFreigaben = liste.filter(istOrdnerLink);
	return schreibeJson(datei(materialDir), {
		freigaben: liste.filter((f) => !istOrdnerLink(f)),
		...(ordnerFreigaben.length > 0 ? { ordnerFreigaben } : {}),
	});
};

export const findeFreigabe = async (materialDir: string, token: string): Promise<Freigabe | null> =>
	istToken(token) ? ((await leseFreigaben(materialDir)).find((f) => f.token === token) ?? null) : null;

export const zielGibtEs = (materialDir: string, ziel: FreigabeZiel) => {
	if ('ordner' in ziel) {
		const baum = leseBaumNachsichtig(materialDir);
		return baum !== null && lebenderOrdner(baum, ziel.ordner) !== null;
	}
	const { dok, mappe } = ziel;
	return dok === null
		? existsSync(path.join(mappenDir(materialDir, mappe), 'mappe.json'))
		: existsSync(path.join(dokumentDir(materialDir, mappe, dok), 'meta.json'));
};

const zielName = (ziel: FreigabeZiel) => {
	if ('ordner' in ziel) {
		return 'Diesen Ordner';
	}
	return ziel.dok === null ? `Die Mappe „${ziel.mappe}“` : `Das Dokument „${ziel.mappe}/${ziel.dok}“`;
};

/** Liest, ändert und schreibt die ganze Datei. Aufrufer, die parallel schreiben können, müssen das serialisieren. */
export const legeFreigabeAn = async (
	materialDir: string,
	ziel: FreigabeZiel,
	jetzt = new Date(),
): Promise<Freigabe> => {
	if (!zielGibtEs(materialDir, ziel)) {
		throw new SchoolboxFehler(`${zielName(ziel)} gibt es nicht.`);
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

export interface EndgueltigWeg {
	mappen?: readonly string[];
	dokumente?: readonly { mappe: string; dok: string }[];
	ordner?: readonly string[];
}

/** Entfernt alle Teilen-Links auf endgültig Gelöschtes. Gibt die Anzahl zurück. */
export const entferneFreigabenVon = async (
	materialDir: string,
	{ dokumente = [], mappen = [], ordner = [] }: EndgueltigWeg,
): Promise<number> => {
	const freigaben = await leseFreigaben(materialDir);
	const trifft = ({ ziel }: Freigabe) => {
		if ('ordner' in ziel) {
			return ordner.includes(ziel.ordner);
		}
		const { dok, mappe } = ziel;
		return mappen.includes(mappe) || (dok !== null && dokumente.some((d) => d.mappe === mappe && d.dok === dok));
	};
	const bleiben = freigaben.filter((f) => !trifft(f));
	if (bleiben.length < freigaben.length) {
		await schreibeFreigaben(materialDir, bleiben);
	}
	return freigaben.length - bleiben.length;
};
