/**
 * Besitzer: 176. Ein eigener Lauf von `claude` für genau ein Bild (seit 237 über die Bild-API, Werkzeuge
 * `bild_erzeugen`/`bild_bearbeiten`): ein Lauf zur Zeit, bis zu fünf warten, alles nur im Speicher. Figuren (176,
 * `POST /api/bildlauf/figur`) und Bilder (179) gehen denselben Weg; was nur Figuren betrifft, steht in der Route und in
 * `uebernimm`, nicht im Lauf.
 *
 * Der Arbeitsordner liegt unter `tmpdir()` und hält nur Kopien: die Regeln aus `skills/`, die Grundposen als Referenz
 * unter `referenzen/` und, wo nötig, das Bild einer Figur. `materialien/` darf Claude nicht lesen (`NIE_LESEN`). Der
 * Socket der Werkzeuge liegt daneben in `<id>-w/`, außerhalb des Arbeitsordners. Jeder Start des Servers leert den
 * Wurzelordner.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, copyFile, lstat, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { BibliotheksFigur, BildlaufEreignisStatus, BildlaufFigur, BildlaufStand, BildlaufWunsch } from '@schoolbox/kern';
import {
	brauchtStil,
	BILDLAUF_TEXT_ZEICHEN,
	bildlaufAuftragText,
	figurenDir,
	figurenIn,
	leseBibliothek,
	MAX_BILD_BYTES,
	neueFigurId,
	nimmPoseAuf,
	SchoolboxFehler,
	STIL_FIGUR,
	WURZEL,
} from '@schoolbox/kern';
import { EINGEBAUTE } from '@schoolbox/kern/src/figuren';
import type { Router as RouterTyp } from 'express';

import { leseBildVertraege, pruefeDateiname, typAus } from './bild-datei';
import type { LaufBilder } from './bild-zugang';
import { BILDER_AUS, BILDER_GESPERRT, bilderStand, erstelleLaufBilder, grundposeReferenz, posenPfad } from './bild-zugang';
import { HttpFehler } from './fehler';
import type { KiLimit, LaufStand } from './ki';
import {
	beendeKind,
	FEHLER_TEXTE,
	FEHLER_UNBEKANNT,
	KI_GRENZEN,
	kiArgumente,
	kiPfad,
	kiUmgebung,
	limitErreichtText,
	VERBRAUCH_DATEI,
	werteAus,
} from './ki';
import type { KiLauf } from './ki-einstellung';
import { KI_EINSTELLUNG_STANDARD, kiLaufJetzt, waehleLauf } from './ki-einstellung';
import type { Werkzeug } from './ki-werkzeug';
import { starteWerkzeug } from './ki-werkzeug';
import type { Kontext } from './kontext';
import { schreibeMitschrift } from './mitschrift';

/** Was `uebernimm` bekommt: das geprüfte Bild im Arbeitsordner und die Angaben aus `bilder.json` und `ergebnis.json`. */
export interface BildlaufErgebnis {
	pfad: string;
	datei: string;
	motiv: string;
	wort: string;
	name: string | null;
	steckbrief: string | null;
}

export interface BildlaufOptionen {
	/** Legt das Bild ab und gibt den Namen der abgelegten Datei zurück. */
	uebernimm: (e: BildlaufErgebnis) => Promise<string>;
	/** Dateien, die vor dem Start in den Arbeitsordner kommen: Name dort → Quelle. */
	beilagen?: Record<string, string>;
	/** Grundposen als Referenz: Das Bildwerkzeug legt `datei` als `referenzen/<name>.<png|jpg>` ab (237). */
	figuren?: { name: string; datei: string }[];
	/** Modell und Gründlichkeit, von der Route beim Start gelesen (232); ohne gilt der Standard. */
	ki?: KiLauf;
}

const ID = /^[a-f0-9]{12}$/;
const ERGEBNIS = 'ergebnis.json';
const MAX_ERGEBNIS_BYTES = 4096;
const WORT = /^[a-z0-9]{1,20}$/;
// eslint-disable-next-line no-control-regex
const STEUERZEICHEN = /[\u0000-\u001f\u007f-\u009f]/;
/** Die Regeln als Kopie in `regeln/`: Im Lauf gibt es kein Skill-Werkzeug. */
const REGELN = [
	path.join('html-materialerstellung', 'references', 'bilder.md'),
	path.join('grundschul-didaktik', 'references', 'kindgerecht-gestalten.md'),
];
const KEIN_BILD = 'Es ist kein Bild entstanden.';

const kennung = (inhalt: string) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

export const bildlaufWurzel = (materialDir: string) => path.join(tmpdir(), `schoolbox-canva-${kennung(materialDir)}`);

export const pruefeBildlaufId = (wert: unknown) => {
	if (typeof wert !== 'string' || !ID.test(wert)) {
		throw new HttpFehler(404, 'Diesen Auftrag gibt es nicht.');
	}
	return wert;
};

const feld = (wert: unknown, max: number) =>
	typeof wert === 'string' && wert.trim() && wert.trim().length <= max && !STEUERZEICHEN.test(wert)
		? wert.trim()
		: null;

export interface BildlaufAntwort {
	fehler: 'bild-fehler' | null;
	wort: string;
	name: string | null;
	steckbrief: string | null;
}

/** `ergebnis.json`, höchstens 4 KB. Was fehlt oder nicht passt, gilt nicht: `wort` wird `neu`, Name und Steckbrief fehlen. */
export const leseErgebnis = async (arbeit: string): Promise<BildlaufAntwort> => {
	const datei = path.join(arbeit, ERGEBNIS);
	let roh: unknown = null;
	try {
		const info = await lstat(datei);
		if (info.isFile() && info.size <= MAX_ERGEBNIS_BYTES) {
			roh = JSON.parse(await readFile(datei, 'utf8')) as unknown;
		}
	} catch {
		// Keine oder kaputte Datei: wie leer.
	}
	const e = (typeof roh === 'object' && roh !== null && !Array.isArray(roh) ? roh : {}) as Record<string, unknown>;
	const ohneFehler = e.fehler === undefined || e.fehler === null || e.fehler === false;
	return {
		fehler: ohneFehler ? null : 'bild-fehler',
		wort: typeof e.wort === 'string' && WORT.test(e.wort) ? e.wort : 'neu',
		name: feld(e.name, 40),
		steckbrief: feld(e.steckbrief, 300),
	};
};

const fehlerText = (code: string, zurueck: string | null) => {
	if (code === 'rate_limit') {
		return limitErreichtText(zurueck);
	}
	if (code === 'authentication_failed') {
		return FEHLER_TEXTE.authentication_failed ?? FEHLER_UNBEKANNT;
	}
	if (code === 'error_max_turns' || code === 'error_max_budget_usd') {
		return 'Claude ist nicht fertig geworden.';
	}
	return FEHLER_UNBEKANNT;
};

interface Auftrag {
	stand: BildlaufStand;
	wunsch: BildlaufWunsch;
	o: BildlaufOptionen;
	ki: KiLauf;
	kind: ChildProcessWithoutNullStreams | null;
	abbruch: boolean;
}

interface LaufEnde {
	/** Frist, Ausgabe zu groß oder `claude` fehlt: ein Text für die Kachel. */
	grund: string | null;
	/** Fehlercode aus `stream-json`, etwa `rate_limit`. */
	code: string | null;
	verbrauch: Record<string, unknown>;
	zurueck: string | null;
}

export const erstelleBildlaufLaeufe = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const wurzel = bildlaufWurzel(materialDir);
	const bin = kiPfad(kontext.konfig);
	const auftragDatei = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'bild-einzeln.md');
	const projekte = () => path.join(homedir(), '.claude', 'projects');
	const projektName = (arbeit: string) => arbeit.replace(/[^a-zA-Z0-9]/g, '-');
	const arbeitDir = (id: string) => path.join(wurzel, id);

	let aktiv: Auftrag | null = null;
	const reihe: Auftrag[] = [];
	const fehler: Auftrag[] = [];
	let gestoppt = false;

	const melde = (a: Auftrag, status: BildlaufEreignisStatus, datei?: string) => {
		kontext.ereignisse.sende({
			typ: 'bildlauf-stand',
			daten: { id: a.stand.id, art: a.stand.art, status, ...(datei ? { datei } : {}) },
		});
	};

	/** Wie bei der Einheit: Über das Guthaben ist es echtes Geld (Entscheidung 35). */
	const budget = () => {
		const limit = kontext.ki.limit();
		const ueberGuthaben =
			(limit?.status === 'rejected' || limit?.laeuftUeberGuthaben === true) &&
			(!limit.zurueck || new Date(limit.zurueck).getTime() > Date.now());
		return ueberGuthaben ? KI_GRENZEN.bildlauf.budgetGuthabenUsd : KI_GRENZEN.bildlauf.budgetUsd;
	};

	const notiereVerbrauch = async (a: Auftrag, status: string, start: number, verbrauch: Record<string, unknown>) => {
		const zeile = {
			zeit: new Date().toISOString(),
			mappe: a.wunsch.ziel.mappe ?? '',
			dok: a.wunsch.ziel.dok ?? '',
			status,
			umfang: `canva-${a.stand.art}`,
			sekunden: Math.round((Date.now() - start) / 1000),
			...verbrauch,
			...a.ki,
		};
		await appendFile(path.join(materialDir, VERBRAUCH_DATEI), `${JSON.stringify(zeile)}\n`).catch(() => undefined);
	};

	/** Arbeitsordner und Sitzung: In beiden steht der Wunsch der Lehrkraft. */
	const loesche = async (arbeit: string) => {
		await rm(arbeit, { recursive: true, force: true });
		await rm(socketDir(arbeit), { recursive: true, force: true });
		await rm(path.join(projekte(), projektName(arbeit)), { recursive: true, force: true });
	};

	const bereite = async (a: Auftrag, arbeit: string) => {
		await mkdir(path.join(arbeit, 'bilder'), { recursive: true });
		await mkdir(path.join(arbeit, 'regeln'), { recursive: true });
		for (const regel of REGELN) {
			await copyFile(path.join(WURZEL, 'skills', regel), path.join(arbeit, 'regeln', path.basename(regel)));
		}
		for (const [name, quelle] of Object.entries(a.o.beilagen ?? {})) {
			const ziel = path.join(arbeit, name);
			if (path.relative(arbeit, ziel).startsWith('..')) {
				throw new Error('Beilage außerhalb des Arbeitsordners');
			}
			await mkdir(path.dirname(ziel), { recursive: true });
			await copyFile(quelle, ziel);
		}
	};

	const lauf = (a: Auftrag, arbeit: string, werkzeug: Werkzeug, bilder: LaufBilder) =>
		new Promise<LaufEnde>((resolve) => {
			if (a.abbruch) {
				resolve({ grund: null, code: null, verbrauch: {}, zurueck: null });
				return;
			}
			const stand: LaufStand = { sitzung: null, fehlerCode: null, ergebnis: {} };
			let limit: KiLimit | null = null;
			const argumente = kiArgumente({
				ablage: arbeit,
				auftragDatei,
				budgetUsd: budget(),
				modell: a.ki.modell,
				effort: a.ki.effort,
				bildlauf: true,
				mcpDatei: werkzeug.mcpDatei,
				mcpWerkzeuge: werkzeug.werkzeuge,
			});
			const kind = spawn(bin, argumente, { cwd: arbeit, env: kiUmgebung(bin) });
			schreibeMitschrift(
				{ materialDir, mappe: a.wunsch.ziel.mappe, dok: a.wunsch.ziel.dok, art: `bildlauf-${a.wunsch.art}` },
				kind,
				{ argumente, auftrag: a.wunsch.auftrag, cwd: arbeit, bilder: bilder.stand },
			);
			a.kind = kind;
			let grund: string | null = null;
			let bytes = 0;
			const frist = setTimeout(() => {
				grund = 'Das hat zu lange gedauert.';
				beendeKind(kind);
			}, KI_GRENZEN.bildlauf.zeitMs);
			kind.stdin.on('error', () => undefined);
			kind.stdin.end(a.wunsch.auftrag);
			kind.stderr.resume();
			createInterface({ input: kind.stdout }).on('line', (zeile) => {
				bytes += zeile.length;
				if (bytes > KI_GRENZEN.ausgabeBytes) {
					grund ??= FEHLER_UNBEKANNT;
					beendeKind(kind);
					return;
				}
				try {
					werteAus(JSON.parse(zeile) as Record<string, unknown>, stand, {
						schritt: () => undefined,
						limit: (neu) => {
							limit = neu;
						},
					});
				} catch {
					// Keine JSON-Zeile.
				}
			});
			kind.on('error', () => {
				grund = 'Claude ist auf dem Server nicht installiert.';
			});
			kind.on('close', (code) => {
				clearTimeout(frist);
				resolve({
					grund,
					code: stand.ergebnis.fehler ?? (code === 0 ? null : (stand.fehlerCode ?? 'unbekannt')),
					verbrauch: stand.ergebnis.verbrauch ?? {},
					zurueck: limit?.zurueck ?? kontext.ki.limit()?.zurueck ?? null,
				});
			});
		});

	/** Das Bild des letzten Eintrags in `bilder.json`: eine reguläre Datei in `bilder/`, PNG (Bilder auch JPEG). */
	const bildAus = async (a: Auftrag, arbeit: string) => {
		const eintrag = (await leseBildVertraege(arbeit)).at(-1);
		if (!eintrag) {
			return null;
		}
		let datei: string;
		try {
			datei = pruefeDateiname(eintrag.datei);
		} catch {
			return null;
		}
		const pfad = path.join(arbeit, 'bilder', datei);
		const info = await lstat(pfad).catch(() => null);
		if (!info?.isFile() || info.size > MAX_BILD_BYTES) {
			return null;
		}
		const typ = typAus((await readFile(pfad)).subarray(0, 8));
		const erlaubt = typ === 'png' || (typ === 'jpg' && a.stand.art === 'bild');
		if (!erlaubt || path.extname(datei).slice(1) !== typ) {
			return null;
		}
		return { pfad, datei, motiv: eintrag.motiv || a.stand.text };
	};

	/** Der Ordner des Sockets neben dem Arbeitsordner: Claude erreicht ihn nicht, ein Socket-Pfad bleibt kurz. */
	const socketDir = (arbeit: string) => `${arbeit}-w`;

	const fuehreAus = async (a: Auftrag) => {
		const arbeit = arbeitDir(a.stand.id);
		const start = Date.now();
		let grund: string | null = null;
		let datei: string | undefined;
		let verbrauch: Record<string, unknown> = {};
		let werkzeug: Werkzeug | null = null;
		try {
			await bereite(a, arbeit);
			const bilder = await erstelleLaufBilder({
				arbeit,
				art: 'schublade',
				konfig: kontext.konfig,
				api: kontext.bildApi,
				figuren: a.o.figuren,
			});
			if (!bilder) {
				throw new HttpFehler(409, BILDER_AUS);
			}
			await mkdir(socketDir(arbeit), { recursive: true, mode: 0o700 });
			werkzeug = await starteWerkzeug(socketDir(arbeit), null, 'bilder', { bilder });
			const ende = await lauf(a, arbeit, werkzeug, bilder);
			const bildStand = bilder.stand();
			verbrauch = { ...ende.verbrauch, bildAufrufe: bildStand.aufrufe, bildKostenUsd: bildStand.kostenUsd };
			const antwort = await leseErgebnis(arbeit);
			if (a.abbruch) {
				grund = null;
			} else if (ende.grund) {
				grund = ende.grund;
			} else if (bildStand.gesperrt) {
				grund = BILDER_GESPERRT;
			} else if (antwort.fehler === 'bild-fehler') {
				grund = bilder.letzterFehler() ?? KEIN_BILD;
			} else if (ende.code) {
				grund = fehlerText(ende.code, ende.zurueck);
			} else {
				const bild = await bildAus(a, arbeit);
				if (!bild) {
					grund = bilder.letzterFehler() ?? KEIN_BILD;
				} else {
					const { name, steckbrief, wort } = antwort;
					datei = await a.o.uebernimm({ ...bild, wort, name, steckbrief });
				}
			}
		} catch (f) {
			console.error('Bild-Lauf:', f instanceof Error ? f.message : f);
			grund = f instanceof HttpFehler || f instanceof SchoolboxFehler ? f.message : FEHLER_UNBEKANNT;
		} finally {
			await werkzeug?.ende().catch(() => undefined);
		}
		const ergebnis = datei && !grund ? 'fertig' : 'fehler';
		const status: BildlaufEreignisStatus = a.abbruch ? 'abgebrochen' : ergebnis;
		await notiereVerbrauch(a, status, start, verbrauch);
		await loesche(arbeit).catch(() => undefined);
		if (aktiv === a) {
			aktiv = null;
		}
		if (status === 'fehler') {
			a.stand.status = 'fehler';
			a.stand.fehler = grund ?? FEHLER_UNBEKANNT;
			fehler.push(a);
		}
		melde(a, status, status === 'fertig' ? datei : undefined);
		naechster();
	};

	const naechster = () => {
		if (aktiv || gestoppt) {
			return;
		}
		const a = reihe.shift();
		if (!a) {
			return;
		}
		aktiv = a;
		a.stand.status = 'laeuft';
		melde(a, 'laeuft');
		fuehreAus(a).catch((f: unknown) => {
			console.error('Bildlauf:', f);
			if (aktiv === a) {
				aktiv = null;
			}
			naechster();
		});
	};

	/**
	 * Wirft `HttpFehler` 409 ohne Schlüssel für die Bild-API (237), wenn die Reihe voll ist oder eine Einheit gerade
	 * Bilder erzeugt.
	 */
	const starte = (wunsch: BildlaufWunsch, o: BildlaufOptionen): BildlaufStand => {
		const zugang = bilderStand(kontext.konfig);
		if (!zugang.verfuegbar) {
			throw new HttpFehler(409, zugang.grund ?? BILDER_AUS);
		}
		if (kontext.einheiten.laeuft()?.bilder) {
			throw new HttpFehler(409, 'Die Unterrichtseinheit erzeugt gerade Bilder.');
		}
		if (reihe.length >= KI_GRENZEN.bildlauf.warten) {
			throw new HttpFehler(409, 'Es warten schon fünf Bilder.');
		}
		const a: Auftrag = {
			stand: {
				id: randomBytes(6).toString('hex'),
				art: wunsch.art,
				text: wunsch.text,
				status: 'wartet',
				ziel: wunsch.ziel,
				fehler: null,
				start: new Date().toISOString(),
			},
			wunsch,
			o,
			ki: o.ki ?? waehleLauf(KI_EINSTELLUNG_STANDARD, kontext.konfig, 'klein'),
			kind: null,
			abbruch: false,
		};
		reihe.push(a);
		naechster();
		if (a.stand.status === 'wartet') {
			melde(a, 'wartet');
		}
		return { ...a.stand };
	};

	const finde = (id: string) => [aktiv, ...reihe, ...fehler].find((a) => a?.stand.id === id) ?? null;

	/** Ein wartender Auftrag fällt aus der Reihe, ein laufender endet (der Verbrauch wird notiert), ein Fehler fällt weg. */
	const abbrechen = (id: string) => {
		const a = finde(id);
		if (!a) {
			throw new HttpFehler(404, 'Diesen Auftrag gibt es nicht.');
		}
		if (a === aktiv) {
			a.abbruch = true;
			if (a.kind) {
				beendeKind(a.kind);
			}
			return;
		}
		for (const liste of [reihe, fehler]) {
			const i = liste.indexOf(a);
			if (i >= 0) {
				liste.splice(i, 1);
			}
		}
		melde(a, 'abgebrochen');
	};

	const verwirf = (id: string) => {
		const a = finde(id);
		if (!a) {
			throw new HttpFehler(404, 'Diesen Auftrag gibt es nicht.');
		}
		if (a.stand.status !== 'fehler') {
			throw new HttpFehler(409, 'Der Auftrag läuft noch.');
		}
		fehler.splice(fehler.indexOf(a), 1);
		melde(a, 'abgebrochen');
	};

	/** Reste eines vorigen Servers: Arbeitsordner und ihre Sitzungen. Ein verwaister Prozess endet an seinen Grenzen. */
	const beendeReste = async () => {
		await rm(wurzel, { recursive: true, force: true });
		const vorne = `${projektName(wurzel)}-`;
		for (const name of await readdir(projekte()).catch(() => [] as string[])) {
			if (name.startsWith(vorne)) {
				await rm(path.join(projekte(), name), { recursive: true, force: true });
			}
		}
	};

	return {
		starte,
		/** Laufender, wartende und fehlgeschlagene Aufträge, nach Start. */
		liste: (): BildlaufStand[] =>
			[...(aktiv ? [aktiv] : []), ...reihe, ...fehler]
				.map((a) => ({ ...a.stand }))
				.sort((x, y) => x.start.localeCompare(y.start)),
		abbrechen,
		verwirf,
		beendeReste,
		/** Beim Beenden: Wartende sind weg, der laufende Prozess endet; den Ordner räumt der nächste Start. */
		stop: () => {
			gestoppt = true;
			reihe.length = 0;
			if (aktiv) {
				aktiv.abbruch = true;
				aktiv.kind?.kill('SIGTERM');
			}
		},
	};
};

export type BildlaufLaeufe = ReturnType<typeof erstelleBildlaufLaeufe>;

/** Wo eine Figur ohne Grundpose als PNG/JPEG ihr Bild zum Ansehen bekommt; die Bild-API nimmt es nicht als Referenz. */
const figurBild = (f: BibliotheksFigur) =>
	`figur/${f.id}${/\.[a-z]+$/i.exec(f.posen[0]?.schluessel ?? '')?.[0].toLowerCase() ?? '.png'}`;

/**
 * Die Angaben einer Figur für den Auftrag und was dafür in den Arbeitsordner kommt (237): ihre Grundpose als
 * Referenz, ohne taugliche Referenz Willi als Stil-Referenz und ihr Bild zum Ansehen.
 */
export const figurFuerLauf = async (materialDir: string, f: BibliotheksFigur | null) => {
	const referenz = f ? await grundposeReferenz(materialDir, f) : null;
	const angaben: BildlaufFigur | null = f
		? {
				id: f.id,
				name: f.name,
				steckbrief: f.steckbrief ?? null,
				referenz: referenz?.pfad ?? null,
				bild: referenz?.pfad ?? figurBild(f),
			}
		: null;
	const figuren = referenz ? [{ name: referenz.name, datei: referenz.datei }] : [];
	const willi = EINGEBAUTE.find((e) => e.id === STIL_FIGUR);
	const stil = brauchtStil(angaben) && willi ? await grundposeReferenz(materialDir, willi) : null;
	if (stil) {
		figuren.push({ name: stil.name, datei: stil.datei });
	}
	const beilagen: Record<string, string> =
		f && angaben && !referenz && !angaben.steckbrief
			? { [angaben.bild]: posenPfad(materialDir, f.posen[0]?.schluessel ?? '') }
			: {};
	return { angaben, figuren, beilagen };
};

/** Die Routen (176). Hängen am `apiRouter`: nur mit Sitzung, nie über Teilen-Links. */
export const bildlaufApi = (router: RouterTyp, kontext: Kontext) => {
	const { bildlauf, konfig } = kontext;
	const { materialDir } = konfig;

	/** Eine Pose der genannten Figur oder, ohne Figur, eine neue Figur mit ihrem ersten Bild als Grundpose. */
	const uebernimmFigur = (figur: BibliotheksFigur | null) => async (e: BildlaufErgebnis) => {
		const name = figur?.name ?? e.name ?? 'Neue Figur';
		let id = figur?.id;
		if (!id) {
			const bibliothek = await leseBibliothek(konfig, materialDir);
			const dateien = await readdir(figurenDir(materialDir)).catch(() => [] as string[]);
			id = neueFigurId(name, [
				...bibliothek.map((f) => f.id),
				...dateien.map((d) => path.basename(d, path.extname(d))),
			]);
		}
		const pose = await nimmPoseAuf(konfig, materialDir, {
			datei: e.pfad,
			figur: id,
			name,
			wort: e.wort,
			herkunft: 'openai',
			...(e.steckbrief ? { steckbrief: e.steckbrief } : {}),
		});
		return path.basename(pose.schluessel);
	};

	router.post('/bildlauf/figur', async (req, res) => {
		const { text } = (req.body ?? {}) as { text?: unknown };
		if (typeof text !== 'string' || !text.trim()) {
			throw new HttpFehler(400, 'Beschreibe die Figur.');
		}
		if (text.length > BILDLAUF_TEXT_ZEICHEN) {
			throw new HttpFehler(400, `Höchstens ${BILDLAUF_TEXT_ZEICHEN} Zeichen.`);
		}
		const genannt = figurenIn(text, await leseBibliothek(konfig, materialDir));
		if (genannt.length > 1) {
			throw new HttpFehler(400, 'Eine Figur je Bild.');
		}
		const figur = genannt[0] ?? null;
		const { angaben, beilagen, figuren } = await figurFuerLauf(materialDir, figur);
		const vorlage = await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'figur.md'), 'utf8');
		const ki = await kiLaufJetzt(konfig, 'klein');
		const stand = bildlauf.starte(
			{
				art: 'figur',
				text: text.trim(),
				auftrag: `${vorlage.trimEnd()}\n\n${bildlaufAuftragText(text, angaben)}`,
				ziel: { figur: figur?.id ?? null, name: figur?.name ?? null },
			},
			{
				uebernimm: uebernimmFigur(figur),
				ki,
				figuren,
				beilagen,
			},
		);
		res.status(201).json({ id: stand.id });
	});

	router.get('/bildlauf', (_req, res) => {
		res.json({ laeufe: bildlauf.liste() });
	});

	router.post('/bildlauf/:id/abbrechen', (req, res) => {
		bildlauf.abbrechen(pruefeBildlaufId(req.params.id));
		res.json({ ok: true });
	});

	router.post('/bildlauf/:id/verwerfen', (req, res) => {
		bildlauf.verwirf(pruefeBildlaufId(req.params.id));
		res.json({ ok: true });
	});
};
