/**
 * Die Werkzeuge `bild_erzeugen` und `bild_bearbeiten` eines Claude-Laufs (237). Claude ruft sie über den MCP-Server
 * `schoolbox` auf (`werkzeug/mcp.mjs`, `ki-werkzeug.ts`); der Server prüft die Argumente, ruft die Bild-API und legt das
 * Bild ab: atomar nach `bilder/<datei>`, die Vorversion nach `ansicht/bilder/versuche/`, dazu die Prüfbilder (215) und
 * eine Zeile in `bilder/bilder-herkunft.tsv`. Gesperrt die API (Guthaben, Ausgabenlimit, Schlüssel), merkt sich das
 * Werkzeug das für den Lauf: `stand().gesperrt`.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, copyFile, lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BildFormat } from '@schoolbox/kern';
import { BILD_FORMAT_NAMEN, formatFuerMasse, istBildFormat, schreibeAtomar } from '@schoolbox/kern';

import type { BildAnfrage, BildErgebnis } from './bild-api';
import { BILD_API_GESPERRT, BildApiFehler, erzeugeBild, MAX_REFERENZ_BYTES } from './bild-api';
import type { BildVertrag, Zuschnitt } from './bild-datei';
import {
	aendereBildEintrag,
	ANSICHT_BILDER,
	BILDER_LISTE,
	BildListeFehler,
	bildMasse,
	erstelleZuschnitt,
	hatTransparenz,
	istDateiname,
	leseBildListe,
	leseBildVertraege,
	pruefBildPfade,
	typAus,
	vertragAus,
} from './bild-datei';
import { BILD_GRENZEN } from './bild-grenzen';
import { BILD_BEARBEITEN, BILD_ERZEUGEN, BILD_PRUEFUNG, BILD_VERTRAG } from './ki-werkzeug';
import type { ServerKonfig } from './konfig';

export const BILD_HERKUNFT = 'bilder-herkunft.tsv';
export const REFERENZ_ORDNER = 'referenzen';
export const VERSUCHE = `${ANSICHT_BILDER}/versuche`;
/** Woher Referenzen kommen dürfen, relativ zum Arbeitsordner; die Vorversionen, damit Claude eine wiederherstellen kann. */
export const REFERENZ_QUELLEN = ['bilder', REFERENZ_ORDNER, VERSUCHE];
/**
 * Seit 248 mit `art` (`erzeugt`, `bearbeitet`, `offen`), dem Befund, den der Versuch behebt (oder der offen blieb), und
 * dem Hash des Inhalts. Zeilen mit fünf Spalten stammen von davor und zählen für die Versuche nicht.
 */
const HERKUNFT_KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\tart\tbefund\tinhalt\n';
/** Neu erzeugen wegen desselben Befunds: höchstens so oft je Datei (248, „neu statt flicken“). */
export const MAX_NEU_ERZEUGT = 2;
/** Bearbeitungen je Fassung eines Bildes, über alle Befunde (248). */
export const MAX_BEARBEITUNGEN_JE_FASSUNG = 2;
const MAX_BEFUND = 300;
export const MAX_REFERENZEN_ERZEUGEN = 4;
export const MAX_REFERENZEN_BEARBEITEN = 3;
const MAX_PROMPT = 8000;
const MAX_PFAD = 200;
const FIGUR_NAME = /^[a-z0-9][a-z0-9-]{0,59}$/;
const PRUEFEN_SATZ = 'Prüfe sie gegen den Vertrag und trage die Prüfung in `bilder.json` ein.';
/** 252: Im Einheit-Lauf schreiben die Werkzeuge `bilder.json`; Claude gibt Vertrag und Prüfung als Parameter. */
const PRUEFEN_SATZ_WERKZEUG = `Prüfe sie gegen den Vertrag und trage die Prüfung mit ${BILD_PRUEFUNG} ein.`;
/** Felder des Bildvertrags, die `bild_erzeugen` und `bild_bearbeiten` als Parameter nehmen (252). */
const VERTRAG_FELDER = ['motiv', 'platz', 'blickpunkt', 'vertrag', 'figur', 'pose'] as const;
const MAX_VERTRAG_ZEICHEN = 8000;
const MAX_PRUEF_PUNKTE = 20;
const MAX_PRUEF_PUNKT = 300;
const FLICKEN_SATZ =
	'Eine Bearbeitung je Fehler. Bleibt der Fehler, erzeuge das Bild neu mit bild_erzeugen und einem Prompt, der den Fehler ausdrücklich ausschließt (mit „befund“).';
const offenSatz = (datei: string, werkzeug: boolean) =>
	`Zwei neue Bilder haben den Fehler nicht behoben: kein weiterer Versuch an bilder/${datei}. Lass es, wie es ist, passe den Text an, wenn er nur nennen kann, was das Bild zeigt, und trage sonst ${werkzeug ? `mit ${BILD_PRUEFUNG} "offen": "<der Fehler in einem Satz>"` : `beim Eintrag in ${BILDER_LISTE} "offen": "<der Fehler in einem Satz>"`} ein. Die Lehrkraft sieht den Hinweis.`;
const gesperrtAnweisung = (werkzeug: boolean) =>
	`${BILD_API_GESPERRT}: OpenAI erzeugt keine Bilder mehr (Guthaben, Ausgabenlimit oder Schlüssel). Frage kein Bild mehr an, auch nicht ein zweites Mal. ${werkzeug ? 'Ein Vertrag ohne Bild bleibt stehen;' : `Lass fehlende Verträge in ${BILDER_LISTE} ohne Bild und`} mach weiter, wie dein Auftrag es für ${BILD_API_GESPERRT} sagt.`;

/** Wo der Lauf hingehört; danach richtet sich die Obergrenze (`BILD_GRENZEN.aufrufe`). */
export type BildWerkzeugArt = keyof typeof BILD_GRENZEN.aufrufe;

export interface WerkzeugAntwort {
	text: string;
	fehler?: boolean;
}

/** 248: Ein Bild, an dem der Server einen weiteren Versuch abgelehnt hat, mit dem Befund, der offen blieb. */
export interface BildOffen {
	datei: string;
	befund: string;
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
	/** 248: Bilder ohne weiteren Versuch, in der Reihenfolge der Ablehnung. */
	offen: BildOffen[];
}

export interface BildWerkzeugOptionen {
	/** Der Arbeitsordner des Laufs: `bilder/`, `referenzen/`, `bilder.json` und `ansicht/bilder/` liegen darin. */
	arbeit: string;
	art: BildWerkzeugArt;
	konfig: Pick<ServerKonfig, 'openaiSchluessel' | 'bildModell' | 'bildQualitaet' | 'pythonBin'>;
	/** Ohne Angabe die Obergrenze der Art. */
	obergrenze?: number;
	/** Grundposen als Referenz: Der Server kopiert `datei` nach `referenzen/<name>.<png|jpg>`. */
	figuren?: { name: string; datei: string }[];
	/**
	 * 248: Prüft den Vertrag aus `bilder.json` vor `bild_erzeugen`, etwa gegen den Kanon der Einheit; ein Satz lehnt ab.
	 * Ohne Angabe prüft nur der Eintrag selbst (Datei und Motiv).
	 */
	pruefeVertrag?: (vertrag: BildVertrag) => string | null;
	/**
	 * 252: Claude gibt den Vertrag als Parameter von `bild_erzeugen` und `bild_bearbeiten`, liest ihn mit `bild_vertrag`
	 * und trägt Prüfung und `offen` mit `bild_pruefung` ein; die Werkzeuge schreiben `bilder.json`. Ohne Angabe (Blatt,
	 * Schubladen) schreibt Claude die Liste selbst, die Parameter gehen trotzdem.
	 */
	vertragWerkzeuge?: boolean;
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

/** Der Hash eines Bildes in `bilder-herkunft.tsv` und in der Kennung der Prüfung (248). */
export const inhaltHash = (inhalt: Buffer) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

const istText = (w: unknown, max: number): w is string =>
	typeof w === 'string' && w.trim().length > 0 && w.length <= max;

interface Argumente {
	datei: string;
	prompt: string;
	referenzen: string[];
	format?: BildFormat;
	transparent: boolean;
	/** 248: welchen Fehler der Versuch behebt; Pflicht beim Bearbeiten und beim neuen Erzeugen eines vorhandenen Bildes. */
	befund: string | null;
	/** 252: Felder des Bildvertrags aus den Parametern; `null`, wenn der Aufruf keins nennt. */
	eintrag: Record<string, unknown> | null;
}

/** Ein Versuch aus `bilder-herkunft.tsv` (248). */
interface Versuch {
	art: string;
	befund: string;
}

/** Die Versuche je Datei, in der Reihenfolge der Datei; Zeilen von vor 248 (ohne `art`) fehlen. */
export const leseVersuche = async (herkunft: string) => {
	const je = new Map<string, Versuch[]>();
	const text = await readFile(herkunft, 'utf8').catch(() => '');
	for (const zeile of text.split('\n').slice(1)) {
		const [datei, , , , , art, befund] = zeile.split('\t');
		if (datei && art) {
			je.set(datei, [...(je.get(datei) ?? []), { art, befund: befund ?? '' }]);
		}
	}
	return je;
};

const befundWoerter = (text: string) =>
	new Set(
		text
			.toLowerCase()
			.split(/[^\p{L}\p{N}]+/u)
			.filter((w) => w.length >= 4)
			.map((w) => w.slice(0, 6)),
	);

/**
 * Derselbe Befund (248)? Gleich nach Groß- und Kleinschreibung und Leerraum, oder die Hälfte der Wörter des kürzeren
 * stimmt mit dem anderen überein (Wortanfänge, damit „Flügel“ und „Flügeln“ zählen).
 */
export const gleicherBefund = (a: string, b: string) => {
	const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
	if (norm(a) === norm(b)) {
		return true;
	}
	const x = befundWoerter(a);
	const y = befundWoerter(b);
	const kleiner = Math.min(x.size, y.size);
	return kleiner > 0 && [...x].filter((w) => y.has(w)).length / kleiner >= 0.5;
};

const istZahl = (w: unknown, min: number, max: number): w is number =>
	typeof w === 'number' && Number.isFinite(w) && w >= min && w <= max;

const istObjekt = (w: unknown): w is Record<string, unknown> =>
	typeof w === 'object' && w !== null && !Array.isArray(w);

/** Die Felder des Bildvertrags aus den Parametern (252); wirft `Abgelehnt` bei einem ungültigen Feld. */
const eintragAus = (roh: Record<string, unknown>): Record<string, unknown> | null => {
	if (!VERTRAG_FELDER.some((k) => roh[k] !== undefined)) {
		return null;
	}
	const { blickpunkt, figur, motiv, platz, pose, vertrag } = roh;
	const e: Record<string, unknown> = {};
	if (motiv !== undefined) {
		if (!istText(motiv, 300)) {
			throw new Abgelehnt('„motiv“ ist ein Satz, höchstens 300 Zeichen.');
		}
		e.motiv = motiv.trim();
	}
	if (platz !== undefined) {
		if (!istObjekt(platz) || !istZahl(platz.breite, 1, 10_000) || !istZahl(platz.hoehe, 1, 10_000)) {
			throw new Abgelehnt('„platz“ ist {"breite": …, "hoehe": …} in px, je 1 bis 10000.');
		}
		e.platz = { breite: platz.breite, hoehe: platz.hoehe };
	}
	if (blickpunkt !== undefined) {
		if (!istObjekt(blickpunkt) || !istZahl(blickpunkt.x, 0, 100) || !istZahl(blickpunkt.y, 0, 100)) {
			throw new Abgelehnt('„blickpunkt“ ist {"x": …, "y": …} in Prozent, je 0 bis 100.');
		}
		e.blickpunkt = { x: blickpunkt.x, y: blickpunkt.y };
	}
	if (vertrag !== undefined) {
		if (!istObjekt(vertrag) || JSON.stringify(vertrag).length > MAX_VERTRAG_ZEICHEN) {
			throw new Abgelehnt(
				`„vertrag“ ist ein Objekt mit „pflicht“, „buehne“ und „verboten“, höchstens ${MAX_VERTRAG_ZEICHEN} Zeichen.`,
			);
		}
		e.vertrag = vertrag;
	}
	if (figur !== undefined) {
		if (!istText(figur, 60)) {
			throw new Abgelehnt('„figur“ ist der Name der Figur aus dem Plan, höchstens 60 Zeichen.');
		}
		e.figur = figur.trim();
	}
	if (pose !== undefined) {
		if (!istText(pose, 40)) {
			throw new Abgelehnt('„pose“ ist „grund“ oder ein Wort, höchstens 40 Zeichen.');
		}
		e.pose = pose.trim();
	}
	return e;
};

/** Was `bild_pruefung` zu `offen` antwortet: eingetragen, gelöscht oder nichts. */
const offenAntwort = (offen: unknown) => {
	if (typeof offen !== 'string') {
		return null;
	}
	return offen.trim() ? 'Offen eingetragen.' : 'Offen gelöscht.';
};

/** Eine Liste von Prüfpunkten für `bild_pruefung` (252). */
const punkteAus = (wert: unknown, name: string): string[] => {
	if (wert === undefined) {
		return [];
	}
	if (!Array.isArray(wert) || wert.length > MAX_PRUEF_PUNKTE || !wert.every((w) => istText(w, MAX_PRUEF_PUNKT))) {
		throw new Abgelehnt(`„${name}“ ist eine Liste von höchstens ${MAX_PRUEF_PUNKTE} Sätzen.`);
	}
	return wert.map((w: string) => tsvFeld(w));
};

/** Prüft die Argumente je Werkzeug; wirft `Abgelehnt` mit einem Satz für Claude. */
export const pruefeBildArgumente = (werkzeug: string, roh: Record<string, unknown>): Argumente => {
	const erzeugen = werkzeug === BILD_ERZEUGEN;
	const { befund: befundRoh, datei, format, prompt, referenzen = [], transparent = false } = roh;
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
	if (befundRoh !== undefined && !istText(befundRoh, MAX_BEFUND)) {
		throw new Abgelehnt(`„befund“ ist ein Satz, höchstens ${MAX_BEFUND} Zeichen.`);
	}
	const befund = typeof befundRoh === 'string' ? tsvFeld(befundRoh) : null;
	const eintrag = eintragAus(roh);
	if (!erzeugen) {
		if (!befund) {
			throw new Abgelehnt('„befund“ fehlt: Nenne in einem Satz den Fehler, den diese Bearbeitung behebt.');
		}
		return { datei, prompt, referenzen, transparent: false, befund, eintrag };
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
	return { datei, prompt, format, referenzen, transparent, befund, eintrag };
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
	/** `bilder.json` ändert ein Aufruf zur Zeit: Bis zu drei Bilder laufen zugleich. */
	const listenSchranke = erstelleSchranke(1);
	const mitVertrag = o.vertragWerkzeuge === true;
	const inArbeit = new Set<string>();
	const stand: BildWerkzeugStand = {
		gesperrt: !schluessel && !o.api,
		aufrufe: 0,
		obergrenze,
		bilder: [],
		kostenUsd: 0,
		offen: [],
	};
	const herkunft = path.join(bilderDir, BILD_HERKUNFT);

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
		const quelle = REFERENZ_QUELLEN.find(
			(q) => norm.startsWith(`${q}/`) && !norm.slice(q.length + 1).includes('/'),
		);
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

	/** Schreibt eine Zeile in `bilder-herkunft.tsv`; die Kopfzeile legt nur an, wer die Datei neu erzeugt. */
	const notiere = async (felder: string[]) => {
		await mkdir(bilderDir, { recursive: true });
		await writeFile(herkunft, HERKUNFT_KOPF, { flag: 'wx' }).catch((fehler: unknown) => {
			if ((fehler as { code?: unknown }).code !== 'EEXIST') {
				throw fehler;
			}
		});
		await appendFile(herkunft, `${felder.map(tsvFeld).join('\t')}\n`);
	};

	const herkunftZeile = (
		datei: string,
		vertrag: BildVertrag | undefined,
		art: string,
		befund: string,
		hash: string,
	) => [
		datei,
		'openai',
		o.konfig.bildModell,
		jetzt().toISOString().slice(0, 10),
		vertrag?.motiv ?? '',
		art,
		befund,
		hash,
	];

	/** Lehnt einen weiteren Versuch ab (248) und merkt ihn als offen, mit einer Zeile `offen` in der Herkunft. */
	const keinVersuchMehr = async (datei: string, befund: string, vertrag: BildVertrag | undefined) => {
		if (!stand.offen.some((x) => x.datei === datei)) {
			stand.offen.push({ datei, befund });
			const inhalt = await readFile(path.join(bilderDir, datei)).catch(() => Buffer.alloc(0));
			await notiere(herkunftZeile(datei, vertrag, 'offen', befund, inhaltHash(inhalt)));
		}
		return new Abgelehnt(offenSatz(datei, mitVertrag));
	};

	/**
	 * Neu statt flicken (248): eine Bearbeitung je Befund und höchstens `MAX_BEARBEITUNGEN_JE_FASSUNG` je Fassung; wegen
	 * desselben Befunds höchstens `MAX_NEU_ERZEUGT` neue Bilder. Zählt über alle Läufe im Arbeitsordner, ein neuer Befund
	 * (etwa ein Wunsch der Lehrkraft) fängt neu an.
	 */
	const pruefeVersuch = async (werkzeug: string, a: Argumente, vertrag: BildVertrag | undefined) => {
		const versuche = (await leseVersuche(herkunft)).get(a.datei) ?? [];
		const da = existsSync(path.join(bilderDir, a.datei));
		const erzeugt = versuche.filter(
			(v) => v.art === 'erzeugt' && v.befund && gleicherBefund(v.befund, a.befund ?? ''),
		);
		if (werkzeug === BILD_ERZEUGEN) {
			if (!da) {
				return;
			}
			if (!a.befund) {
				throw new Abgelehnt(
					`bilder/${a.datei} gibt es schon. Nenne in „befund“ in einem Satz den Fehler, den das neue Bild nicht mehr hat.`,
				);
			}
			if (erzeugt.length >= MAX_NEU_ERZEUGT) {
				throw await keinVersuchMehr(a.datei, a.befund, vertrag);
			}
			return;
		}
		const befund = a.befund ?? '';
		const bearbeitet = versuche.filter((v) => v.art === 'bearbeitet');
		const seitFassung = versuche.slice(versuche.findLastIndex((v) => v.art === 'erzeugt') + 1);
		const zuOft =
			bearbeitet.some((v) => gleicherBefund(v.befund, befund)) ||
			seitFassung.filter((v) => v.art === 'bearbeitet').length >= MAX_BEARBEITUNGEN_JE_FASSUNG;
		if (!zuOft) {
			return;
		}
		if (erzeugt.length >= MAX_NEU_ERZEUGT) {
			throw await keinVersuchMehr(a.datei, befund, vertrag);
		}
		throw new Abgelehnt(`Neu erzeugen: ${FLICKEN_SATZ}`);
	};

	const speichere = async (
		datei: string,
		inhalt: Buffer,
		vertrag: BildVertrag | undefined,
		art: string,
		befund: string,
	) => {
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
		// Zwei Bilder können zugleich fertig werden: `notiere` legt die Kopfzeile nur an, wenn die Datei neu ist.
		await notiere(herkunftZeile(datei, vertrag, art, befund, inhaltHash(inhalt)));
		stand.bilder.push(`bilder/${datei}`);
		const masse = bildMasse(inhalt);
		return [
			`Gespeichert: bilder/${datei}${masse ? ` (${masse.breite} × ${masse.hoehe} px)` : ''}, Versuch ${versuch}.`,
			vorversion ? `Die Vorversion liegt unter ${vorversion}.` : null,
			pruefbilder.length
				? `Prüfbilder: ${pruefbilder.join(', ')}.`
				: `Keine Prüfbilder: Sieh dir bilder/${datei} ganz an.`,
			mitVertrag ? PRUEFEN_SATZ_WERKZEUG : PRUEFEN_SATZ,
			art === 'bearbeitet' ? FLICKEN_SATZ : null,
		]
			.filter(Boolean)
			.join('\n');
	};

	/** Ändert `bilder.json` über `aendereBildEintrag`, einer zur Zeit; ein Fehler der Liste geht als Satz an Claude. */
	const aendereListe = (datei: string, aendere: (alt: Record<string, unknown> | null) => Record<string, unknown>) =>
		listenSchranke(async () => {
			try {
				return await aendereBildEintrag(o.arbeit, datei, aendere);
			} catch (fehler) {
				throw fehler instanceof BildListeFehler ? new Abgelehnt(fehler.message) : fehler;
			}
		});

	/**
	 * Schreibt den Vertrag aus den Parametern in `bilder.json` (252), über den alten Eintrag derselben Datei; Prüfungen
	 * und `offen` bleiben. Vorher prüft `pruefeVertrag` (Kanon, 248): Lehnt es ab, bleibt die Liste, wie sie war.
	 */
	const schreibeVertrag = async (datei: string, e: Record<string, unknown>) => {
		let neu: BildVertrag | undefined;
		await aendereListe(datei, (alt) => {
			const eintrag = { ...(alt ?? {}), datei, ...e };
			const v = vertragAus(eintrag);
			if (!v) {
				throw new Abgelehnt(
					`„motiv“ fehlt: Der Vertrag von ${datei} braucht ein Motiv, höchstens 300 Zeichen.`,
				);
			}
			const grund = o.pruefeVertrag?.(v);
			if (grund) {
				throw new Abgelehnt(grund);
			}
			neu = v;
			return eintrag;
		});
		return neu;
	};

	const fuehreAus = async (werkzeug: string, roh: Record<string, unknown>): Promise<string> => {
		const beginn = Date.now();
		const a = pruefeBildArgumente(werkzeug, roh);
		// Vertrag, dann erzeugen (237): Der Vertrag steht in der Liste, auch wenn danach kein Bild entsteht.
		const vertrag = a.eintrag
			? await schreibeVertrag(a.datei, a.eintrag)
			: (await leseBildVertraege(o.arbeit)).find((v) => v.datei === a.datei);
		if (stand.gesperrt) {
			throw new Abgelehnt(gesperrtAnweisung(mitVertrag));
		}
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
					mitVertrag
						? `Für ${a.datei} gibt es keinen Bildvertrag. Vertrag, dann erzeugen: Gib ihn mit (motiv, platz, blickpunkt, vertrag, bei einer Figur allein figur und pose).`
						: `In ${BILDER_LISTE} fehlt ein Eintrag mit "datei": "${a.datei}" und einem "motiv". Vertrag, dann erzeugen: Trage zuerst den Bildvertrag ein.`,
				);
			}
			const grund = a.eintrag ? null : o.pruefeVertrag?.(vertrag);
			if (grund) {
				throw new Abgelehnt(grund);
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
		await pruefeVersuch(werkzeug, a, vertrag);
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
					throw new Abgelehnt(gesperrtAnweisung(mitVertrag));
				}
				return await api(anfrage, bis);
			});
			stand.kostenUsd = Math.round((stand.kostenUsd + ergebnis.kostenUsd) * 1e4) / 1e4;
			return await speichere(
				a.datei,
				ergebnis.inhalt,
				vertrag,
				werkzeug === BILD_ERZEUGEN ? 'erzeugt' : 'bearbeitet',
				a.befund ?? '',
			);
		} catch (fehler) {
			if (fehler instanceof BildApiFehler && fehler.art === 'gesperrt') {
				stand.gesperrt = true;
				throw new Abgelehnt(gesperrtAnweisung(mitVertrag));
			}
			throw fehler;
		} finally {
			inArbeit.delete(a.datei);
		}
	};

	/** `bild_vertrag` (252): der Eintrag eines Bildes aus `bilder.json`, etwa vor `bild_bearbeiten`. */
	const leseVertrag = async (roh: Record<string, unknown>) => {
		const { datei } = roh;
		if (!istDateiname(datei)) {
			throw new Abgelehnt('„datei“ ist ungültig: der Name eines Bildes in bilder/.');
		}
		const eintrag = (await leseBildListe(o.arbeit)).findLast(
			(e) => typeof e === 'object' && e !== null && (e as { datei?: unknown }).datei === datei,
		);
		if (!eintrag) {
			throw new Abgelehnt(`Für ${datei} gibt es keinen Bildvertrag.`);
		}
		return JSON.stringify(eintrag);
	};

	/** `bild_pruefung` (252): hängt die Prüfung eines Versuchs an und setzt oder löscht `offen`. */
	const tragePruefungEin = async (roh: Record<string, unknown>) => {
		const { datei, offen } = roh;
		if (!istDateiname(datei)) {
			throw new Abgelehnt('„datei“ ist ungültig: der Name eines Bildes in bilder/.');
		}
		const ok = punkteAus(roh.ok, 'ok');
		const fehlt = punkteAus(roh.fehlt, 'fehlt');
		const verboten = punkteAus(roh.verboten, 'verboten');
		const mitPruefung = roh.ok !== undefined || roh.fehlt !== undefined || roh.verboten !== undefined;
		if (offen !== undefined && typeof offen !== 'string') {
			throw new Abgelehnt('„offen“ ist ein Satz, höchstens 300 Zeichen; leer löscht ihn.');
		}
		if (typeof offen === 'string' && offen.length > 300) {
			throw new Abgelehnt('„offen“ ist ein Satz, höchstens 300 Zeichen; leer löscht ihn.');
		}
		if (!mitPruefung && offen === undefined) {
			throw new Abgelehnt('Nenne die Prüfung (ok, fehlt, verboten) oder „offen“.');
		}
		if (mitPruefung && !ok.length && !fehlt.length && !verboten.length) {
			throw new Abgelehnt('Die Prüfung ist leer: Hake jeden Punkt aus „pflicht“ unter ok oder fehlt ab.');
		}
		if (mitPruefung && !existsSync(path.join(bilderDir, datei))) {
			throw new Abgelehnt(`bilder/${datei} gibt es nicht: Prüfe nur ein Bild, das entstanden ist.`);
		}
		const versuch = Math.max(
			1,
			((await leseVersuche(herkunft)).get(datei) ?? []).filter(
				(v) => v.art === 'erzeugt' || v.art === 'bearbeitet',
			).length,
		);
		await aendereListe(datei, (alt) => {
			if (!alt) {
				throw new Abgelehnt(`Für ${datei} gibt es keinen Bildvertrag.`);
			}
			const neu: Record<string, unknown> = { ...alt };
			if (mitPruefung) {
				const bisher: unknown[] = Array.isArray(alt.pruefung) ? alt.pruefung : [];
				neu.pruefung = [...bisher, { versuch, ok, fehlt, verboten }];
			}
			if (typeof offen === 'string') {
				if (offen.trim()) {
					neu.offen = tsvFeld(offen);
				} else {
					delete neu.offen;
				}
			}
			return neu;
		});
		const nicht = [...fehlt, ...verboten];
		return [
			mitPruefung ? `Eingetragen: Prüfung von Versuch ${versuch} für bilder/${datei}.` : null,
			mitPruefung && !nicht.length ? 'Abgenommen.' : null,
			mitPruefung && nicht.length ? `Nicht abgenommen: ${nicht.join(' · ')}. ${FLICKEN_SATZ}` : null,
			offenAntwort(offen),
		]
			.filter(Boolean)
			.join('\n');
	};

	const namen = [BILD_ERZEUGEN, BILD_BEARBEITEN, ...(mitVertrag ? [BILD_VERTRAG, BILD_PRUEFUNG] : [])];

	return {
		/** Pfade der kopierten Figuren, relativ zum Arbeitsordner, für den Auftrag. */
		referenzen,
		/** Die Namen der Werkzeuge, die dieses Bildwerkzeug beantwortet. */
		namen,
		aufruf: async (werkzeug: string, argumente: Record<string, unknown>): Promise<WerkzeugAntwort> => {
			if (!namen.includes(werkzeug)) {
				return { text: `Unbekanntes Werkzeug „${werkzeug}“.`, fehler: true };
			}
			try {
				if (werkzeug === BILD_VERTRAG) {
					return { text: await leseVertrag(argumente) };
				}
				if (werkzeug === BILD_PRUEFUNG) {
					return { text: await tragePruefungEin(argumente) };
				}
				return { text: await fuehreAus(werkzeug, argumente) };
			} catch (fehler) {
				if (!(fehler instanceof Abgelehnt) && !(fehler instanceof BildApiFehler)) {
					console.error('Bild für Claude:', fehler);
					return { text: 'Das Bild ließ sich nicht ablegen. Versuche es noch einmal.', fehler: true };
				}
				return { text: fehlerText(fehler), fehler: true };
			}
		},
		stand: (): BildWerkzeugStand => ({ ...stand, bilder: [...stand.bilder], offen: [...stand.offen] }),
	};
};

export type BildWerkzeug = Awaited<ReturnType<typeof erstelleBildWerkzeug>>;
