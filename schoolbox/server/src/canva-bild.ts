/**
 * Bilder aus Canva in die Ablage (138). Claude hat in der Schoolbox kein Bash und damit kein `curl`: Es schreibt je
 * exportiertem Bild eine Zeile in `bilder.json`, der Server lädt. Nur vom Export-Host von Canva, nur PNG oder JPEG.
 */
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { schreibeAtomar } from '@schoolbox/kern';

export const CANVA_HOST = 'export-download.canva.com';
export const BILDER_LISTE = 'bilder.json';
export const CANVA_IDS = 'canva-ids.tsv';
export const MAX_BILD_BYTES = 10 * 1024 * 1024;
/** Mehr braucht keine Einheit; die Liste wächst sonst ungebremst, wenn Text aus dem Material Claude dazu anstiftet. */
export const MAX_BILDER = 40;
const MAX_LISTE_BYTES = 256 * 1024;
/** Eine Weiterleitung innerhalb des Hosts kommt vor; eine Kette nicht. */
const MAX_WEITERLEITUNGEN = 2;
const FRIST_MS = 60_000;
/** Kleinbuchstaben, Ziffern, Bindestrich, Endung passend zum Typ. Kein Pfad, kein Punkt davor. */
const DATEINAME = /^[a-z0-9][a-z0-9-]{0,59}\.(png|jpg)$/;
const MEDIA_ID = /^[A-Za-z0-9_-]{1,40}$/;

export interface BildWunsch {
	datei: string;
	url: string;
	motiv: string;
	mediaId: string;
}

export type BildStand = { datei: string; ok: true } | { datei: string; ok: false; grund: string };

type Laden = (url: string, init: Parameters<typeof fetch>[1]) => Promise<Response>;

const typAus = (kopf: Buffer): 'png' | 'jpg' | null => {
	if (kopf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return 'png';
	}
	if (kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff) {
		return 'jpg';
	}
	return null;
};
// >> 176
export { typAus };
// << 176

/** Wirft mit einem Grund für das Protokoll; Text aus dem Material steht darin nie. */
export const pruefeCanvaUrl = (roh: string) => {
	let url: URL;
	try {
		url = new URL(roh);
	} catch {
		throw new Error('keine URL');
	}
	if (url.protocol !== 'https:') {
		throw new Error('nicht HTTPS');
	}
	if (url.hostname !== CANVA_HOST || url.port !== '' || url.username !== '' || url.password !== '') {
		throw new Error('fremder Host');
	}
	return url;
};

export const pruefeDateiname = (datei: string) => {
	if (!DATEINAME.test(datei)) {
		throw new Error('Dateiname ungültig');
	}
	return datei;
};

const liesGekappt = async (antwort: Response) => {
	const laenge = Number(antwort.headers.get('content-length') ?? '0');
	if (laenge > MAX_BILD_BYTES) {
		throw new Error('zu groß');
	}
	if (!antwort.body) {
		throw new Error('leer');
	}
	const teile: Buffer[] = [];
	let bytes = 0;
	for await (const teil of antwort.body as unknown as AsyncIterable<Uint8Array>) {
		bytes += teil.byteLength;
		if (bytes > MAX_BILD_BYTES) {
			throw new Error('zu groß');
		}
		teile.push(Buffer.from(teil));
	}
	return Buffer.concat(teile);
};

/** Lädt ein Bild nach `zielDir/datei`. Weiterleitungen folgt es nur auf denselben Host. */
export const ladeCanvaBild = async (
	wunsch: Pick<BildWunsch, 'datei' | 'url'>,
	zielDir: string,
	laden: Laden = fetch,
): Promise<void> => {
	const datei = pruefeDateiname(wunsch.datei);
	let url = pruefeCanvaUrl(wunsch.url);
	for (let schritt = 0; ; schritt += 1) {
		const antwort = await laden(url.href, { redirect: 'manual', signal: AbortSignal.timeout(FRIST_MS) });
		if (antwort.status >= 300 && antwort.status < 400) {
			const ziel = antwort.headers.get('location');
			if (!ziel || schritt >= MAX_WEITERLEITUNGEN) {
				throw new Error('Weiterleitung');
			}
			url = pruefeCanvaUrl(new URL(ziel, url).href);
			continue;
		}
		if (!antwort.ok) {
			throw new Error(`HTTP ${antwort.status}`);
		}
		const inhalt = await liesGekappt(antwort);
		const typ = typAus(inhalt);
		if (!typ) {
			throw new Error('kein PNG oder JPEG');
		}
		if (path.extname(datei).slice(1) !== typ) {
			throw new Error('Endung passt nicht zum Inhalt');
		}
		await mkdir(zielDir, { recursive: true });
		await schreibeAtomar(path.join(zielDir, datei), inhalt);
		return;
	}
};

const istText = (w: unknown, max: number): w is string => typeof w === 'string' && w.length > 0 && w.length <= max;

/** Liest `bilder.json`. Was nicht passt, fällt still heraus; geladen wird nur, was alle Prüfungen besteht. */
export const leseBildWuensche = async (arbeit: string): Promise<BildWunsch[]> => {
	const datei = path.join(arbeit, BILDER_LISTE);
	try {
		if ((await stat(datei)).size > MAX_LISTE_BYTES) {
			return [];
		}
		const roh = JSON.parse(await readFile(datei, 'utf8')) as unknown;
		const liste = Array.isArray(roh) ? roh : ((roh as { bilder?: unknown })?.bilder ?? []);
		if (!Array.isArray(liste)) {
			return [];
		}
		return liste
			.filter(
				(b): b is BildWunsch =>
					typeof b === 'object' &&
					b !== null &&
					istText((b as BildWunsch).datei, 64) &&
					istText((b as BildWunsch).url, 4096) &&
					istText((b as BildWunsch).motiv, 300) &&
					istText((b as BildWunsch).mediaId, 40) &&
					MEDIA_ID.test((b as BildWunsch).mediaId),
			)
			.slice(0, MAX_BILDER);
	} catch {
		return [];
	}
};

const tsvFeld = (text: string) => text.replace(/[\t\r\n]+/g, ' ').trim();

/** Bildliste neben den Bildern wie in `bilder.md` §7: Datei, Media-ID, Motiv. */
export const notiereCanvaId = async (bilderDir: string, w: Pick<BildWunsch, 'datei' | 'mediaId' | 'motiv'>) => {
	const datei = path.join(bilderDir, CANVA_IDS);
	const zeile = `${tsvFeld(w.datei)}\t${tsvFeld(w.mediaId)}\t${tsvFeld(w.motiv)}\n`;
	if (existsSync(datei) && (await readFile(datei, 'utf8')).includes(zeile)) {
		return;
	}
	await mkdir(bilderDir, { recursive: true });
	await appendFile(datei, existsSync(datei) ? zeile : `datei\tmedia-id\tmotiv\n${zeile}`);
};

/**
 * Beobachtet `bilder.json` während eines Laufs und lädt jedes neue Bild sofort: Export-URLs laufen ab. Ein Fehlschlag
 * ist kein Fehler des Laufs; im Material bleibt dann der Platzhalter.
 */
export const erstelleBildLader = (arbeit: string, zielDir: string, laden: Laden = fetch) => {
	const stand = new Map<string, BildStand>();
	const wuensche = new Map<string, BildWunsch>();
	let laeuft: Promise<void> = Promise.resolve();

	const runde = async () => {
		for (const w of await leseBildWuensche(arbeit)) {
			const schluessel = `${w.datei}\n${w.url}`;
			if (stand.has(schluessel) || stand.size >= MAX_BILDER) {
				continue;
			}
			try {
				await ladeCanvaBild(w, zielDir, laden);
				await notiereCanvaId(zielDir, w);
				stand.set(schluessel, { datei: w.datei, ok: true });
				wuensche.set(w.datei, w);
			} catch (fehler) {
				stand.set(schluessel, { datei: w.datei, ok: false, grund: (fehler as Error).message });
			}
		}
	};

	return {
		/** Nacheinander, nie doppelt: Ein Takt, der noch lädt, wartet auf den vorigen. */
		pruefe: () => {
			laeuft = laeuft.then(runde, runde);
			return laeuft;
		},
		stand: () => [...stand.values()],
		/** Die Angaben zu einem geladenen Bild, für `canva-ids.tsv` beim Dokument. */
		wunsch: (datei: string) => wuensche.get(datei) ?? null,
	};
};

export type BildLader = ReturnType<typeof erstelleBildLader>;
