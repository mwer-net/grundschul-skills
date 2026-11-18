/**
 * Die Werkzeuge `bild_erzeugen` und `bild_bearbeiten` eines Claude-Laufs (237). Claude ruft sie über den MCP-Server
 * `schoolbox` auf (`werkzeug/mcp.mjs`, `ki-werkzeug.ts`); der Server prüft die Argumente, ruft die Bild-API und legt das
 * Bild ab: atomar nach `bilder/<datei>`, die Vorversion nach `ansicht/bilder/versuche/`, dazu die Prüfbilder (215) und
 * eine Zeile in `bilder/bilder-herkunft.tsv`. Gesperrt die API (Guthaben, Ausgabenlimit, Schlüssel), merkt sich das
 * Werkzeug das für den Lauf: `stand().gesperrt`.
 */
import { existsSync } from 'node:fs';
import { appendFile, copyFile, lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BildFormat } from '@schoolbox/kern';
import { BILD_FORMAT_NAMEN, formatFuerMasse, istBildFormat, schreibeAtomar } from '@schoolbox/kern';

import type { BildAnfrage, BildErgebnis } from './bild-api';
import { BILD_API_GESPERRT, BildApiFehler, erzeugeBild, MAX_REFERENZ_BYTES } from './bild-api';
import type { BildVertrag, Zuschnitt } from './bild-datei';
import {
	ANSICHT_BILDER,
	BILDER_LISTE,
	bildMasse,
	erstelleZuschnitt,
	hatTransparenz,
	istDateiname,
	leseBildVertraege,
	pruefBildPfade,
	typAus,
} from './bild-datei';
import { BILD_GRENZEN } from './bild-grenzen';
import { BILD_BEARBEITEN, BILD_ERZEUGEN } from './ki-werkzeug';
import type { ServerKonfig } from './konfig';

export const BILD_HERKUNFT = 'bilder-herkunft.tsv';
export const REFERENZ_ORDNER = 'referenzen';
export const VERSUCHE = `${ANSICHT_BILDER}/versuche`;
/** Woher Referenzen kommen dürfen, relativ zum Arbeitsordner; die Vorversionen, damit Claude eine wiederherstellen kann. */
export const REFERENZ_QUELLEN = ['bilder', REFERENZ_ORDNER, VERSUCHE];
const HERKUNFT_KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\n';
export const MAX_REFERENZEN_ERZEUGEN = 4;
export const MAX_REFERENZEN_BEARBEITEN = 3;
const MAX_PROMPT = 8000;
const MAX_PFAD = 200;
const FIGUR_NAME = /^[a-z0-9][a-z0-9-]{0,59}$/;
const PRUEFEN_SATZ = 'Prüfe sie gegen den Vertrag und trage die Prüfung in `bilder.json` ein.';
const GESPERRT_ANWEISUNG = `${BILD_API_GESPERRT}: OpenAI erzeugt keine Bilder mehr (Guthaben, Ausgabenlimit oder Schlüssel). Frage kein Bild mehr an, auch nicht ein zweites Mal. Lass fehlende Verträge in ${BILDER_LISTE} ohne Bild und mach weiter, wie dein Auftrag es für ${BILD_API_GESPERRT} sagt.`;

/** Wo der Lauf hingehört; danach richtet sich die Obergrenze (`BILD_GRENZEN.aufrufe`). */
export type BildLaufArt = keyof typeof BILD_GRENZEN.aufrufe;

export interface WerkzeugAntwort {
	text: string;
	fehler?: boolean;
}

export interface BildWerkzeugStand {
	/** Die API hat Guthaben, Ausgabenlimit oder Schlüssel abgelehnt, oder es gibt keinen Schlüssel. */
	gesperrt: boolean;
	/** Angenommene Aufrufe, auch gescheiterte; sie zählen auf die Obergrenze. */
	aufrufe: number;
	obergrenze: number;
	/** Gespeicherte Bilder, relativ zum Arbeitsordner, in der Reihenfolge der Ablage. */
	bilder: string[];
	/** Geschätzt aus `usage`. */
	kostenUsd: number;
}

export interface BildWerkzeugOptionen {
	/** Der Arbeitsordner des Laufs: `bilder/`, `referenzen/`, `bilder.json` und `ansicht/bilder/` liegen darin. */
	arbeit: string;
	art: BildLaufArt;
	konfig: Pick<ServerKonfig, 'openaiSchluessel' | 'bildModell' | 'bildQualitaet' | 'pythonBin'>;
	/** Ohne Angabe die Obergrenze der Art. */
	obergrenze?: number;
	/** Grundposen als Referenz: Der Server kopiert `datei` nach `referenzen/<name>.<png|jpg>`. */
	figuren?: { name: string; datei: string }[];
	/** Für Tests: statt der echten Bild-API. */
	api?: (anfrage: BildAnfrage, bis: number) => Promise<BildErgebnis>;
	/** Für Tests: statt `blatt.py viertel`. */
	zuschnitt?: Zuschnitt;
	jetzt?: () => Date;
}

class Abgelehnt extends Error {}

/** Höchstens `n` gleichzeitig; wer wartet, kommt der Reihe nach dran. */
const erstelleSchranke = (n: number) => {
	let frei = n;
	const warten: (() => void)[] = [];
	return async <T>(arbeit: () => Promise<T>): Promise<T> => {
		if (frei > 0) {
			frei -= 1;
		} else {
			await new Promise<void>((resolve) => {
				warten.push(resolve);
			});
		}
		try {
			return await arbeit();
		} finally {
			const naechster = warten.shift();
			if (naechster) {
				naechster();
			} else {
				frei += 1;
			}
		}
	};
};

const tsvFeld = (text: string) => text.replace(/[\t\r\n]+/g, ' ').trim();

const istText = (w: unknown, max: number): w is string => typeof w === 'string' && w.trim().length > 0 && w.length <= max;

interface Argumente {
	datei: string;
	prompt: string;
	referenzen: string[];
	format?: BildFormat;
	transparent: boolean;
}

/** Prüft die Argumente je Werkzeug; wirft `Abgelehnt` mit einem Satz für Claude. */
export const pruefeBildArgumente = (werkzeug: string, roh: Record<string, unknown>): Argumente => {
	const erzeugen = werkzeug === BILD_ERZEUGEN;
	const { datei, format, prompt, referenzen = [], transparent = false } = roh;
	if (!istDateiname(datei)) {
		throw new Abgelehnt(
			'„datei“ ist ungültig: Kleinbuchstaben, Ziffern und Bindestrich, Endung .png oder .jpg, ohne Ordner.',
		);
	}
	if (!istText(prompt, MAX_PROMPT)) {
		throw new Abgelehnt(`„prompt“ fehlt oder ist länger als ${MAX_PROMPT} Zeichen.`);
	}
	const max = erzeugen ? MAX_REFERENZEN_ERZEUGEN : MAX_REFERENZEN_BEARBEITEN;
	if (!Array.isArray(referenzen) || referenzen.length > max || !referenzen.every((r) => istText(r, MAX_PFAD))) {
		throw new Abgelehnt(`„referenzen“ ist eine Liste von höchstens ${max} Pfaden.`);
	}
	if (!erzeugen) {
		return { datei, prompt, referenzen: referenzen as string[], transparent: false };
	}
	if (!istBildFormat(format)) {
		throw new Abgelehnt(`„format“ ist einer von: ${BILD_FORMAT_NAMEN.join(', ')}.`);
	}
	if (typeof transparent !== 'boolean') {
		throw new Abgelehnt('„transparent“ ist true oder false.');
	}
	if (transparent && !datei.endsWith('.png')) {
		throw new Abgelehnt('„transparent“ geht nur bei .png.');
	}
	return { datei, prompt, format, referenzen: referenzen as string[], transparent };
};

const fehlerText = (fehler: unknown) => (fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.');

/**
 * Die Bildwerkzeuge eines Laufs. Kopiert die Figuren nach `referenzen/`; `referenzen` nennt ihre Pfade für den Auftrag.
 * `aufruf` beantwortet einen Werkzeugaufruf von Claude, `stand` sagt dem Lauf danach, was geschah.
 */
export const erstelleBildWerkzeug = async (o: BildWerkzeugOptionen) => {
	const grenzen = BILD_GRENZEN;
	const obergrenze = o.obergrenze ?? grenzen.aufrufe[o.art];
	const jetzt = o.jetzt ?? (() => new Date());
	const bilderDir = path.join(o.arbeit, 'bilder');
	const zuschnitt = o.zuschnitt ?? erstelleZuschnitt(o.konfig.pythonBin, path.join(o.arbeit, ANSICHT_BILDER));
	const schluessel = o.konfig.openaiSchluessel;
	const api =
		o.api ??
		((anfrage: BildAnfrage, bis: number) =>
			erzeugeBild(
				anfrage,
				{ schluessel: schluessel ?? '', modell: o.konfig.bildModell, qualitaet: o.konfig.bildQualitaet },
				{ zeitMs: grenzen.zeitMs, bis },
			));
	const schranke = erstelleSchranke(grenzen.gleichzeitig);
	const inArbeit = new Set<string>();
	const stand: BildWerkzeugStand = {
		gesperrt: !schluessel && !o.api,
		aufrufe: 0,
		obergrenze,
		bilder: [],
		kostenUsd: 0,
	};

	const referenzen: string[] = [];
	for (const figur of o.figuren ?? []) {
		if (!FIGUR_NAME.test(figur.name)) {
			throw new Error(`Figur „${figur.name}“: Name ungültig`);
		}
		const typ = typAus(await readFile(figur.datei));
		if (!typ) {
			throw new Error(`Figur „${figur.name}“: kein PNG oder JPEG`);
		}
		const ziel = `${REFERENZ_ORDNER}/${figur.name}.${typ}`;
		await mkdir(path.join(o.arbeit, REFERENZ_ORDNER), { recursive: true });
		await copyFile(figur.datei, path.join(o.arbeit, ziel));
		referenzen.push(ziel);
	}

	/** Nur reguläre Dateien unter `REFERENZ_QUELLEN`, auch nach Auflösen von Links. */
	const ladeReferenz = async (rel: string): Promise<Buffer> => {
		const norm = path.posix.normalize(rel.replaceAll('\\', '/'));
		const quelle = REFERENZ_QUELLEN.find((q) => norm.startsWith(`${q}/`) && !norm.slice(q.length + 1).includes('/'));
		const ablehnen = new Abgelehnt(
			`Referenz „${rel}“: nur Bilder aus ${REFERENZ_QUELLEN.map((q) => `${q}/`).join(', ')} im Arbeitsordner.`,
		);
		if (rel.includes('\0') || path.posix.isAbsolute(norm) || !quelle) {
			throw ablehnen;
		}
		const voll = path.join(o.arbeit, norm);
		const info = await lstat(voll).catch(() => null);
		if (!info?.isFile()) {
			throw new Abgelehnt(`Referenz „${rel}“ gibt es nicht.`);
		}
		const echt = await realpath(voll);
		const basis = await realpath(path.join(o.arbeit, quelle));
		const wurzel = await realpath(o.arbeit);
		if (!echt.startsWith(`${basis}${path.sep}`) || !basis.startsWith(`${wurzel}${path.sep}`)) {
			throw ablehnen;
		}
		if (info.size > MAX_REFERENZ_BYTES) {
			throw new Abgelehnt(`Referenz „${rel}“ ist zu groß.`);
		}
		const inhalt = await readFile(echt);
		if (!typAus(inhalt)) {
			throw new Abgelehnt(`Referenz „${rel}“ ist kein PNG oder JPEG.`);
		}
		return inhalt;
	};

	/** Die nächste freie Nummer in `versuche/` für dieses Bild. */
	const naechsterVersuch = async (datei: string) => {
		const stamm = path.basename(datei, path.extname(datei));
		const muster = new RegExp(`^${stamm}-(\\d+)\\.(png|jpg)$`);
		const namen = await readdir(path.join(o.arbeit, VERSUCHE)).catch(() => [] as string[]);
		return Math.max(0, ...namen.map((n) => Number(muster.exec(n)?.[1] ?? 0))) + 1;
	};

	const speichere = async (datei: string, inhalt: Buffer, vertrag: BildVertrag | undefined) => {
		const ziel = path.join(bilderDir, datei);
		const ext = path.extname(datei);
		let vorversion: string | null = null;
		let versuch = await naechsterVersuch(datei);
		if (existsSync(ziel)) {
			vorversion = `${VERSUCHE}/${path.basename(datei, ext)}-${versuch}${ext}`;
			await mkdir(path.join(o.arbeit, VERSUCHE), { recursive: true });
			await copyFile(ziel, path.join(o.arbeit, vorversion));
			versuch += 1;
		}
		// Wie beim Canva-Download: Die Prüfbilder liegen bereit, bevor das Bild erscheint. Scheitert der Zuschnitt, sieht
		// Claude das Bild ganz an.
		let pruefbilder: string[] = [];
		try {
			await zuschnitt(inhalt, { datei, platz: vertrag?.platz, blickpunkt: vertrag?.blickpunkt });
			pruefbilder = pruefBildPfade(datei, vertrag?.platz !== undefined);
		} catch (fehler) {
			console.error('Bild zuschneiden:', fehler);
		}
		await mkdir(bilderDir, { recursive: true });
		await schreibeAtomar(ziel, inhalt);
		const herkunft = path.join(bilderDir, BILD_HERKUNFT);
		const zeile = [datei, 'openai', o.konfig.bildModell, jetzt().toISOString().slice(0, 10), vertrag?.motiv ?? '']
			.map(tsvFeld)
			.join('\t');
		// Zwei Bilder können zugleich fertig werden: Die Kopfzeile legt nur an, wer die Datei neu erzeugt.
		await writeFile(herkunft, HERKUNFT_KOPF, { flag: 'wx' }).catch((fehler: unknown) => {
			if ((fehler as { code?: unknown }).code !== 'EEXIST') {
				throw fehler;
			}
		});
		await appendFile(herkunft, `${zeile}\n`);
		stand.bilder.push(`bilder/${datei}`);
		const masse = bildMasse(inhalt);
		return [
			`Gespeichert: bilder/${datei}${masse ? ` (${masse.breite} × ${masse.hoehe} px)` : ''}, Versuch ${versuch}.`,
			vorversion ? `Die Vorversion liegt unter ${vorversion}.` : null,
			pruefbilder.length
				? `Prüfbilder: ${pruefbilder.join(', ')}.`
				: `Keine Prüfbilder: Sieh dir bilder/${datei} ganz an.`,
			PRUEFEN_SATZ,
		]
			.filter(Boolean)
			.join('\n');
	};

	const fuehreAus = async (werkzeug: string, roh: Record<string, unknown>): Promise<string> => {
		const beginn = Date.now();
		const a = pruefeBildArgumente(werkzeug, roh);
		if (stand.gesperrt) {
			throw new Abgelehnt(GESPERRT_ANWEISUNG);
		}
		const vertrag = (await leseBildVertraege(o.arbeit)).find((v) => v.datei === a.datei);
		const anfrage: BildAnfrage = {
			prompt: a.prompt,
			format: a.format ?? 'SQUARE_1_1',
			typ: a.datei.endsWith('.png') ? 'png' : 'jpg',
			transparent: a.transparent,
			referenzen: [],
		};
		if (werkzeug === BILD_ERZEUGEN) {
			if (!vertrag) {
				throw new Abgelehnt(
					`In ${BILDER_LISTE} fehlt ein Eintrag mit "datei": "${a.datei}" und einem "motiv". Vertrag, dann erzeugen: Trage zuerst den Bildvertrag ein.`,
				);
			}
		} else {
			const pfad = path.join(bilderDir, a.datei);
			const info = await lstat(pfad).catch(() => null);
			if (!info?.isFile()) {
				throw new Abgelehnt(`bilder/${a.datei} gibt es nicht. Neue Bilder entstehen mit ${BILD_ERZEUGEN}.`);
			}
			const inhalt = await readFile(pfad);
			const masse = bildMasse(inhalt);
			if (typAus(inhalt) !== anfrage.typ || !masse) {
				throw new Abgelehnt(`bilder/${a.datei} ist kein lesbares Bild mit passender Endung.`);
			}
			anfrage.format = formatFuerMasse(masse.breite, masse.hoehe);
			anfrage.transparent = hatTransparenz(inhalt);
			anfrage.bearbeiten = true;
			anfrage.referenzen.push(inhalt);
		}
		for (const rel of a.referenzen) {
			anfrage.referenzen.push(await ladeReferenz(rel));
		}
		if (inArbeit.has(a.datei)) {
			throw new Abgelehnt(`bilder/${a.datei} entsteht gerade schon. Warte auf diese Antwort.`);
		}
		if (stand.aufrufe >= obergrenze) {
			throw new Abgelehnt(
				`Die Obergrenze von ${obergrenze} Bildaufrufen für diesen Lauf ist erreicht. Frage kein Bild mehr an. Lass fehlende Verträge in ${BILDER_LISTE} ohne Bild und mach weiter, wie dein Auftrag es für fehlende Bilder sagt.`,
			);
		}
		stand.aufrufe += 1;
		inArbeit.add(a.datei);
		try {
			const bis = beginn + grenzen.gesamtMs;
			const ergebnis = await schranke(async () => {
				if (stand.gesperrt) {
					throw new Abgelehnt(GESPERRT_ANWEISUNG);
				}
				return await api(anfrage, bis);
			});
			stand.kostenUsd = Math.round((stand.kostenUsd + ergebnis.kostenUsd) * 1e4) / 1e4;
			return await speichere(a.datei, ergebnis.inhalt, vertrag);
		} catch (fehler) {
			if (fehler instanceof BildApiFehler && fehler.art === 'gesperrt') {
				stand.gesperrt = true;
				throw new Abgelehnt(GESPERRT_ANWEISUNG);
			}
			throw fehler;
		} finally {
			inArbeit.delete(a.datei);
		}
	};

	return {
		/** Pfade der kopierten Figuren, relativ zum Arbeitsordner, für den Auftrag. */
		referenzen,
		aufruf: async (werkzeug: string, argumente: Record<string, unknown>): Promise<WerkzeugAntwort> => {
			if (werkzeug !== BILD_ERZEUGEN && werkzeug !== BILD_BEARBEITEN) {
				return { text: `Unbekanntes Werkzeug „${werkzeug}“.`, fehler: true };
			}
			try {
				return { text: await fuehreAus(werkzeug, argumente) };
			} catch (fehler) {
				if (!(fehler instanceof Abgelehnt) && !(fehler instanceof BildApiFehler)) {
					console.error('Bild für Claude:', fehler);
					return { text: 'Das Bild ließ sich nicht ablegen. Versuche es noch einmal.', fehler: true };
				}
				return { text: fehlerText(fehler), fehler: true };
			}
		},
		stand: (): BildWerkzeugStand => ({ ...stand, bilder: [...stand.bilder] }),
	};
};

export type BildWerkzeug = Awaited<ReturnType<typeof erstelleBildWerkzeug>>;
