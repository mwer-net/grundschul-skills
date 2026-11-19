/**
 * Bilddateien im Arbeitsordner eines Laufs, unabhängig davon, woher sie kommen (237, aus `canva-bild.ts`): Dateinamen,
 * Bildtyp und Maße aus dem Kopf, die Bildverträge in `bilder.json` und die Prüfbilder (215).
 */
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { ANSICHT_ORDNER, BLATT_PY, fuehreAus } from '@schoolbox/kern';

export const BILDER_LISTE = 'bilder.json';
/** Wo Claude die Viertel und den Ausschnitt jedes Bilds findet, relativ zum Arbeitsordner (215). */
export const ANSICHT_BILDER = `${ANSICHT_ORDNER}/bilder`;
/** Kleinbuchstaben, Ziffern, Bindestrich, Endung passend zum Typ. Kein Pfad, kein Punkt davor. */
const DATEINAME = /^[a-z0-9][a-z0-9-]{0,59}\.(png|jpg)$/;
const MAX_LISTE_BYTES = 256 * 1024;
/** Mehr braucht keine Einheit; die Liste wächst sonst ungebremst, wenn Text aus dem Material Claude dazu anstiftet. */
const MAX_VERTRAEGE = 120;

export interface BildPlatz {
	/** Breite und Höhe des Platzes im Material, px. */
	platz?: { breite: number; hoehe: number };
	/** `object-position` des Platzes in Prozent. */
	blickpunkt?: { x: number; y: number };
}

/** Was der Server aus einem Eintrag in `bilder.json` braucht; den Bildvertrag selbst liest nur Claude. */
export interface BildVertrag extends BildPlatz {
	datei: string;
	motiv: string;
	/** Das Feld `vertrag` aus `bilder.json`, wie es dort steht (`pflicht`, `buehne`, `verboten`); 248 prüft es. */
	vertrag?: unknown;
	/** 248: Was nach zwei neuen Versuchen am Bild noch nicht stimmt, in einem Satz; die Lehrkraft sieht es. */
	offen?: string;
	/** 253: Name der Figur aus dem Plan, wenn das Bild eine Figur allein zeigt (Grundpose oder Pose). */
	figur?: string;
	/** 253: `grund` oder das Wort der Pose. */
	pose?: string;
	/** 253: Der letzte Eintrag in `pruefung` hakt etwas ab und nennt nichts, was fehlt oder verboten ist. */
	geprueft: boolean;
}

/**
 * Abgenommen (253): Der letzte Versuch in `pruefung` hat Punkte unter `ok` und keine anderen Listen mit Einträgen
 * (`fehlt`, Funde aus `verboten`).
 */
export const istAbgenommen = (pruefung: unknown) => {
	const letzte: unknown = Array.isArray(pruefung) ? pruefung.at(-1) : null;
	if (typeof letzte !== 'object' || letzte === null) {
		return false;
	}
	const felder = Object.entries(letzte as Record<string, unknown>).filter(([, w]) => Array.isArray(w));
	return (
		felder.some(([k, w]) => k === 'ok' && (w as unknown[]).length > 0) &&
		felder.every(([k, w]) => k === 'ok' || (w as unknown[]).length === 0)
	);
};

/** Läuft mit dem geprüften Inhalt, bevor die Datei in `bilder/` erscheint: Wer das Bild sieht, findet seine Viertel. */
export type Zuschnitt = (inhalt: Buffer, wunsch: BildPlatz & { datei: string }) => Promise<void>;

export const typAus = (kopf: Buffer): 'png' | 'jpg' | null => {
	if (kopf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return 'png';
	}
	if (kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff) {
		return 'jpg';
	}
	return null;
};

export const pruefeDateiname = (datei: string) => {
	if (!DATEINAME.test(datei)) {
		throw new Error('Dateiname ungültig');
	}
	return datei;
};

export const istDateiname = (datei: unknown): datei is string => typeof datei === 'string' && DATEINAME.test(datei);

/** Breite und Höhe aus dem Kopf von PNG (IHDR) oder JPEG (SOF); `null`, wenn sie sich nicht lesen lassen. */
export const bildMasse = (inhalt: Buffer): { breite: number; hoehe: number } | null => {
	const typ = typAus(inhalt);
	if (typ === 'png') {
		return inhalt.length >= 24 ? { breite: inhalt.readUInt32BE(16), hoehe: inhalt.readUInt32BE(20) } : null;
	}
	if (typ !== 'jpg') {
		return null;
	}
	let i = 2;
	while (i + 9 < inhalt.length) {
		if (inhalt[i] !== 0xff) {
			return null;
		}
		const marke = inhalt[i + 1] ?? 0;
		const laenge = inhalt.readUInt16BE(i + 2);
		const istSof = marke >= 0xc0 && marke <= 0xcf && marke !== 0xc4 && marke !== 0xc8 && marke !== 0xcc;
		if (istSof) {
			return { breite: inhalt.readUInt16BE(i + 7), hoehe: inhalt.readUInt16BE(i + 5) };
		}
		i += 2 + laenge;
	}
	return null;
};

/** Paeth-Prädiktor der PNG-Zeilenfilter. */
const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) {
		return a;
	}
	return pb <= pc ? b : c;
};

/** Die Vorhersage der Zeilenfilter 1 bis 4 (Sub, Up, Average, Paeth); Filter 0 sagt nichts vorher. */
const vorhersage = (filter: number, a: number, b: number, c: number) => {
	switch (filter) {
		case 1:
			return a;
		case 2:
			return b;
		case 3:
			return (a + b) >> 1;
		case 4:
			return paeth(a, b, c);
		default:
			return 0;
	}
};

/** Die IDAT-Blöcke eines PNG der Reihe nach; `null`, wenn es einen `tRNS`-Block hat. */
const pngDaten = (inhalt: Buffer): Buffer[] | null => {
	const daten: Buffer[] = [];
	for (let i = 8; i + 8 <= inhalt.length;) {
		const laenge = inhalt.readUInt32BE(i);
		const art = inhalt.toString('latin1', i + 4, i + 8);
		if (art === 'tRNS') {
			return null;
		}
		if (art === 'IDAT') {
			daten.push(inhalt.subarray(i + 8, i + 8 + laenge));
		}
		if (art === 'IEND') {
			break;
		}
		i += 12 + laenge;
	}
	return daten;
};

/** Die Zeile ab `start` (Filterbyte, dann `zeile` Bytes) entfiltert; `null` bei unbekanntem Filter. */
const entfilterteZeile = (roh: Buffer, start: number, zeile: number, bytesJePixel: number, vorige: Buffer) => {
	const filter = roh[start] ?? 0;
	if (filter > 4) {
		return null;
	}
	const jetzt = Buffer.from(roh.subarray(start + 1, start + 1 + zeile));
	for (let x = 0; x < zeile; x += 1) {
		const a = x >= bytesJePixel ? (jetzt[x - bytesJePixel] ?? 0) : 0;
		const b = vorige[x] ?? 0;
		const c = x >= bytesJePixel ? (vorige[x - bytesJePixel] ?? 0) : 0;
		jetzt[x] = ((jetzt[x] ?? 0) + vorhersage(filter, a, b, c)) & 0xff;
	}
	return jetzt;
};

/** Hat eine entfilterte Zeile ein Pixel mit Alpha unter dem Maximum? Alpha ist der letzte Kanal jedes Pixels. */
const zeileMitAlpha = (jetzt: Buffer, bits: number, bytesJePixel: number) => {
	const max = bits === 8 ? 0xff : 0xffff;
	for (let x = bytesJePixel - bits / 8; x < jetzt.length; x += bytesJePixel) {
		const alpha = bits === 8 ? (jetzt[x] ?? 0) : jetzt.readUInt16BE(x);
		if (alpha < max) {
			return true;
		}
	}
	return false;
};

/**
 * Hat ein PNG mindestens ein Pixel mit Alpha unter dem Maximum? Ein Alphakanal allein heißt nichts: Deckende Szenen
 * kommen oft als RGBA mit Alpha überall 255. Liest Farbtyp 4 und 6 mit 8 oder 16 Bit ohne Interlace selbst (IDAT
 * entpacken, Zeilenfilter zurückrechnen); `tRNS` zählt als transparent. Alles andere und Unlesbares ist `false`: Ein
 * falsches `true` nähme einer Szene beim Bearbeiten den Hintergrund, ein falsches `false` bringt nur einen zurück.
 */
export const hatTransparenz = (inhalt: Buffer) => {
	if (typAus(inhalt) !== 'png' || inhalt.length < 33) {
		return false;
	}
	const breite = inhalt.readUInt32BE(16);
	const hoehe = inhalt.readUInt32BE(20);
	const bits = inhalt[24] ?? 0;
	const farbtyp = inhalt[25] ?? 0;
	const interlace = inhalt[28] ?? 0;
	const daten = pngDaten(inhalt);
	if (daten === null) {
		return true;
	}
	if ((farbtyp !== 4 && farbtyp !== 6) || (bits !== 8 && bits !== 16) || interlace !== 0 || !daten.length) {
		return false;
	}
	const bytesJePixel = ((farbtyp === 6 ? 4 : 2) * bits) / 8;
	const zeile = breite * bytesJePixel;
	let roh: Buffer;
	try {
		roh = inflateSync(Buffer.concat(daten));
	} catch {
		return false;
	}
	if (roh.length < (zeile + 1) * hoehe) {
		return false;
	}
	let vorige = Buffer.alloc(zeile);
	for (let y = 0; y < hoehe; y += 1) {
		const jetzt = entfilterteZeile(roh, y * (zeile + 1), zeile, bytesJePixel, vorige);
		if (!jetzt) {
			return false;
		}
		if (zeileMitAlpha(jetzt, bits, bytesJePixel)) {
			return true;
		}
		vorige = jetzt;
	}
	return false;
};

export const istText = (w: unknown, max: number): w is string =>
	typeof w === 'string' && w.length > 0 && w.length <= max;
const istZahl = (w: unknown, min: number, max: number): w is number =>
	typeof w === 'number' && Number.isFinite(w) && w >= min && w <= max;

/** Ungültige Angaben zum Platz fallen weg; das Bild entsteht trotzdem, nur ohne Ausschnitt. */
export const platzAus = (roh: unknown): BildPlatz => {
	const { blickpunkt: b, platz: p } = roh as {
		platz?: { breite?: unknown; hoehe?: unknown };
		blickpunkt?: { x?: unknown; y?: unknown };
	};
	const platz =
		p && istZahl(p.breite, 1, 10_000) && istZahl(p.hoehe, 1, 10_000) ? { breite: p.breite, hoehe: p.hoehe } : null;
	if (!platz) {
		return {};
	}
	const blickpunkt = b && istZahl(b.x, 0, 100) && istZahl(b.y, 0, 100) ? { x: b.x, y: b.y } : null;
	return blickpunkt ? { platz, blickpunkt } : { platz };
};

/** Die Einträge von `bilder.json` als Liste oder unter `bilder`; eine kaputte oder zu große Datei ist leer. */
export const leseBildListe = async (arbeit: string): Promise<unknown[]> => {
	const listenDatei = path.join(arbeit, BILDER_LISTE);
	try {
		if ((await stat(listenDatei)).size > MAX_LISTE_BYTES) {
			return [];
		}
		const roh = JSON.parse(await readFile(listenDatei, 'utf8')) as unknown;
		const liste = Array.isArray(roh) ? roh : ((roh as { bilder?: unknown })?.bilder ?? []);
		return Array.isArray(liste) ? (liste as unknown[]) : [];
	} catch {
		return [];
	}
};

/** Die Verträge mit gültigem Dateinamen und Motiv; bei mehreren Einträgen für dieselbe Datei gilt der letzte. */
export const leseBildVertraege = async (arbeit: string): Promise<BildVertrag[]> => {
	const vertraege = new Map<string, BildVertrag>();
	for (const e of (await leseBildListe(arbeit)).slice(0, MAX_VERTRAEGE)) {
		if (typeof e !== 'object' || e === null) {
			continue;
		}
		const { datei, figur, motiv, offen, pose, pruefung, vertrag } = e as {
			datei?: unknown;
			figur?: unknown;
			motiv?: unknown;
			offen?: unknown;
			pose?: unknown;
			pruefung?: unknown;
			vertrag?: unknown;
		};
		if (istDateiname(datei) && istText(motiv, 300)) {
			vertraege.set(datei, {
				datei,
				motiv,
				...platzAus(e),
				...(vertrag === undefined ? {} : { vertrag }),
				...(istText(offen, 300) ? { offen: offen.trim() } : {}),
				...(istText(figur, 60) ? { figur: figur.trim() } : {}),
				...(istText(pose, 40) ? { pose: pose.trim() } : {}),
				geprueft: istAbgenommen(pruefung),
			});
		}
	}
	return [...vertraege.values()];
};

/**
 * Prüfansichten zu jedem Bild nach `ziel` (215): die vier Viertel in voller Auflösung und, mit `platz`, der Ausschnitt,
 * den das Material zeigt. Dieselbe Regel wie `blatt.py viertel` in der Claude-App.
 */
export const erstelleZuschnitt =
	(pythonBin: string, ziel: string): Zuschnitt =>
	async (inhalt, wunsch) => {
		const datei = pruefeDateiname(wunsch.datei);
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-zuschnitt-'));
		try {
			await writeFile(path.join(tmp, datei), inhalt);
			const platz = wunsch.platz ? ['--platz', `${wunsch.platz.breite}x${wunsch.platz.hoehe}`] : [];
			const blick = wunsch.blickpunkt ? ['--blick', `${wunsch.blickpunkt.x},${wunsch.blickpunkt.y}`] : [];
			const quelle = path.join(tmp, datei);
			const lauf = await fuehreAus(pythonBin, [BLATT_PY, 'viertel', quelle, '-o', ziel, ...platz, ...blick]);
			if (lauf.code !== 0) {
				throw new Error(`blatt.py viertel: Exit ${lauf.code ?? 'Timeout'} ${lauf.stderr.slice(0, 300)}`);
			}
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};

/** Die Prüfbilder, die `erstelleZuschnitt` zu `datei` anlegt, relativ zum Arbeitsordner. */
export const pruefBildPfade = (datei: string, mitPlatz: boolean) => {
	const stamm = path.basename(datei, path.extname(datei));
	return [
		...[1, 2, 3, 4].map((i) => `${ANSICHT_BILDER}/${stamm}-v${i}.png`),
		...(mitPlatz ? [`${ANSICHT_BILDER}/${stamm}-platz.png`] : []),
	];
};
