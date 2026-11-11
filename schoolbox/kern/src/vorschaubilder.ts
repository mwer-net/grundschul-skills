/**
 * Vorschaubilder für die Kacheln (178, Recherche 157): ein kleines WebP je Bild, gebaut beim ersten Abruf. Sie liegen
 * abgeleitet in `materialien/_vorschaubilder/` (wie `_ausgabe/`), dürfen jederzeit fehlen und ändern nie ein Bild des
 * Bestands. Ein Vorschaubild gilt, solange seine Änderungszeit der des Originals gleicht; `bild.py` setzt sie so.
 */

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { fuehreAus } from './bauen';
import { BILD_FREI_BREITE } from './bilder-frei';
import type { Konfig } from './konfig';
import { BILD_PY } from './konfig';

export const VORSCHAUBILDER_ORDNER = '_vorschaubilder';
/** Die Kachel misst das Vorschaubild, und so breit legt das Gut ab (103): darum die Breite, nicht die längste Kante. */
export const VORSCHAUBILD_BREITE = BILD_FREI_BREITE;
export const VORSCHAUBILD_HOEHE = 4 * VORSCHAUBILD_BREITE;
/** Ändern sich Format oder Größe, zählt sie hoch: Alte Vorschaubilder heißen dann anders und gelten nicht mehr. */
const FASSUNG = 1;
const VERKLEINERBAR = /\.(png|jpe?g|gif|webp)$/i;
/** Eigene Grenze, nicht die der PDF-Bauten: Eine Kachel wartet nie hinter `blatt.py`. */
const LAEUFE_ZUGLEICH = 2;
const JE_LAUF = 8;

export const vorschaubilderDir = (materialDir: string) => path.join(materialDir, VORSCHAUBILDER_ORDNER);

interface Auftrag {
	datei: string;
	ziel: string;
	mtimeNs: bigint;
	pythonBin: string;
	fertig: (pfad: string | null) => void;
}

interface Schlange {
	wartend: Auftrag[];
	laeufe: number;
	/** Ziel → Ergebnis: Dieselbe Datei wird nie zweimal zugleich gebaut. */
	offen: Map<string, Promise<string | null>>;
	/** Datei → `mtimeNs`, an dem der Bau gescheitert ist: Erst ein neuer Stand bekommt einen neuen Versuch. */
	gescheitert: Map<string, bigint>;
}

interface Ergebnis {
	ok: boolean;
	fehler?: string;
}

const SCHLANGEN = new Map<string, Schlange>();

const schlangeVon = (materialDir: string) => {
	const vorhanden = SCHLANGEN.get(materialDir);
	if (vorhanden) {
		return vorhanden;
	}
	const neu: Schlange = { wartend: [], laeufe: 0, offen: new Map(), gescheitert: new Map() };
	SCHLANGEN.set(materialDir, neu);
	return neu;
};

const zielVon = (materialDir: string, datei: string) =>
	path.join(
		vorschaubilderDir(materialDir),
		`${createHash('sha256').update(`${FASSUNG}\0${datei}`).digest('hex').slice(0, 32)}.webp`,
	);

const liesErgebnisse = (stdout: string, anzahl: number): Ergebnis[] | null => {
	try {
		const liste = JSON.parse(stdout) as unknown;
		return Array.isArray(liste) && liste.length === anzahl ? (liste as Ergebnis[]) : null;
	} catch {
		return null;
	}
};

const letzteZeile = (text: string) =>
	text
		.split('\n')
		.map((z) => z.trim())
		.filter(Boolean)
		.at(-1);

/** Ein Aufruf von `bild.py` für bis zu `JE_LAUF` wartende Aufträge; danach nimmt der nächste Lauf, was wartet. */
const laufe = async (s: Schlange, materialDir: string) => {
	const pythonBin = s.wartend[0]?.pythonBin ?? '';
	const auftraege = s.wartend.filter((a) => a.pythonBin === pythonBin).slice(0, JE_LAUF);
	s.wartend = s.wartend.filter((a) => !auftraege.includes(a));
	s.laeufe += 1;
	// `leereVorschaubilder` ersetzt die Merkliste; was dieser Lauf noch meldet, gilt dann nicht mehr.
	const { gescheitert } = s;
	const dir = vorschaubilderDir(materialDir);
	const tmp = auftraege.map((a) => path.join(dir, `.${path.basename(a.ziel)}.${randomBytes(4).toString('hex')}.tmp`));
	let ergebnisse: Ergebnis[];
	try {
		await mkdir(dir, { recursive: true });
		const paare = auftraege.flatMap((a, i) => [a.datei, tmp[i] ?? '']);
		const lauf = await fuehreAus(pythonBin, [
			BILD_PY,
			'vorschaubilder',
			String(VORSCHAUBILD_BREITE),
			String(VORSCHAUBILD_HOEHE),
			...paare,
		]);
		const fehler = letzteZeile(lauf.stderr) ?? letzteZeile(lauf.stdout) ?? `Exit ${lauf.code ?? 'Timeout'}`;
		ergebnisse =
			(lauf.code === 0 ? liesErgebnisse(lauf.stdout, auftraege.length) : null) ??
			auftraege.map(() => ({ ok: false, fehler }));
	} catch (fehler) {
		ergebnisse = auftraege.map(() => ({ ok: false, fehler: fehler instanceof Error ? fehler.message : '?' }));
	}
	await Promise.all(
		auftraege.map(async (a, i) => {
			const t = tmp[i] ?? '';
			const e = ergebnisse[i];
			const umbenannt = e?.ok === true && (await rename(t, a.ziel).then(() => true).catch(() => false));
			if (umbenannt) {
				a.fertig(a.ziel);
				return;
			}
			await rm(t, { force: true }).catch(() => undefined);
			gescheitert.set(a.datei, a.mtimeNs);
			console.warn(`Vorschaubild: ${path.basename(a.datei)}: ${e?.fehler ?? 'nicht geschrieben'}`);
			a.fertig(null);
		}),
	);
	s.laeufe -= 1;
};

const starte = (s: Schlange, materialDir: string) => {
	while (s.laeufe < LAEUFE_ZUGLEICH && s.wartend.length > 0) {
		void laufe(s, materialDir).then(() => starte(s, materialDir));
	}
};

/**
 * Pfad des gültigen Vorschaubilds, sonst `null` (dann liefert der Aufrufer das Original). Wirft nie. `datei` ist der
 * echte, absolute Pfad des Originals, wie ihn die Prüfung der Grenzen liefert.
 */
export const vorschaubild = async (
	konfig: Pick<Konfig, 'materialDir' | 'pythonBin'>,
	datei: string,
): Promise<string | null> => {
	if (!VERKLEINERBAR.test(datei)) {
		return null;
	}
	try {
		const ziel = zielVon(konfig.materialDir, datei);
		const [original, vorhanden] = await Promise.all([
			stat(datei, { bigint: true }),
			stat(ziel, { bigint: true }).catch(() => null),
		]);
		if (vorhanden?.mtimeNs === original.mtimeNs) {
			return ziel;
		}
		const s = schlangeVon(konfig.materialDir);
		if (s.gescheitert.get(datei) === original.mtimeNs) {
			return null;
		}
		const laufend = s.offen.get(ziel);
		if (laufend) {
			return await laufend;
		}
		const ergebnis = new Promise<string | null>((aufloesen) => {
			s.wartend.push({
				datei,
				ziel,
				mtimeNs: original.mtimeNs,
				pythonBin: konfig.pythonBin,
				fertig: (pfad) => {
					s.offen.delete(ziel);
					aufloesen(pfad);
				},
			});
		});
		s.offen.set(ziel, ergebnis);
		starte(s, konfig.materialDir);
		return await ergebnis;
	} catch {
		return null;
	}
};

/** Leert `_vorschaubilder/` samt Merkliste der Fehlschläge; was man wieder ansieht, entsteht neu. */
export const leereVorschaubilder = async (materialDir: string): Promise<void> => {
	schlangeVon(materialDir).gescheitert = new Map();
	await rm(vorschaubilderDir(materialDir), { recursive: true, force: true });
};
