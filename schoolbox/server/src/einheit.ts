/**
 * Unterrichtseinheit im Server (139): ein großer Lauf von `claude`, der einen Ordner mit mehreren Dokumenten füllt.
 * Der Server übernimmt jedes Dokument, sobald Claude es in `einheit.json` als fertig meldet, und prüft es dabei.
 *
 * Der Arbeitsordner liegt außerhalb von `kiTempWurzel`: Den räumt jeder Neustart ab, eine Einheit soll aber
 * „Weiterbauen“ überstehen. Der eigene Prefix schützt die Sitzungen vor dem Aufräumen der Gespräche (087).
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { appendFile, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type {
	Aktion,
	Ansicht,
	BauVersuch,
	EinheitAngaben,
	EinheitBefund,
	EinheitPlan,
	EinheitStand,
	Fach,
	LaufArt,
	LaufEintrag,
	LaufProtokoll,
	PlanDokument,
	PruefBefund,
	Pruefbericht,
	PruefStand,
	SchlussStand,
} from '@schoolbox/kern';
import {
	ANSICHT_ORDNER,
	ART_NAME,
	aufgabenFuerBau,
	baueAnsichtAus,
	bauReihenfolge,
	bausteinVerstoesse,
	beendeLaufEintrag,
	befundZeile,
	BILDER_SCHRITT,
	blickLektuere,
	blickRegeln,
	dokKnotenSchluessel,
	dokumentDir,
	dopplungTexte,
	dopplungUebersicht,
	EINHEIT_PLAN,
	EINHEIT_THEMA,
	einheitAuftragAus,
	FACH_NAME,
	fertigText,
	figurenDopplungen,
	formatBefund,
	formateDesMaterials,
	freierName,
	klasseText,
	LAUF_DATEI,
	laufMeldungen,
	lebenderOrdner,
	lektuereFehltText,
	lektuereZeile,
	lesePlan,
	lesePruefung,
	leseSteckbrief,
	mappenDir,
	namenIn,
	neueFunde,
	neueMappe,
	neuerLaufEintrag,
	neuesDokument,
	notiereLektuere,
	pflichtAbschnitt,
	pflichtFuer,
	planBefunde,
	pruefeEinheitAngaben,
	pruefKorrektur,
	pruefText,
	pruefWeise,
	RECHERCHE_DATEI,
	rechercheAbschnitt,
	rolleVon,
	satzBefund,
	SCHLUSS_SCHRITT,
	schreibeAtomar,
	STECKBRIEF_DATEI,
	themaBefund,
	uebernimmBilder,
	wendeAktionAn,
	wendeBilderAn,
	WURZEL,
	zahlenBefunde,
	zahlenText,
} from '@schoolbox/kern';
import type { Router as RouterTyp } from 'express';

import type { BildLader } from './canva-bild';
import { ANSICHT_BILDER, erstelleBildLader, erstelleZuschnitt, notiereCanvaId } from './canva-bild';
import { schreibeQuelle } from './dokumente';
import { HttpFehler } from './fehler';
import type { Ergebnis, KiPruefer, LaufStand } from './ki';
import {
	beendeKind,
	EINHEIT_PLAN_RECHTE,
	einheitBauRechte,
	KI_GRENZEN,
	kiArgumente,
	kiPfad,
	kiUmgebung,
	legeAblageAn,
	pruefeLauf,
	rechercheStand,
	recherchiere,
	richtePruefOrdnerEin,
	VERBRAUCH_DATEI,
	werteAus,
} from './ki';
import type { Bauen } from './ki-werkzeug';
import { ansichtText, starteWerkzeug } from './ki-werkzeug';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';
import { umgebung, wendeEffekteAn } from './ordner';

const ID = /^[a-f0-9]{12}$/;
const STAND = 'stand.json';
const PID = 'pid';
const TAKT_MS = 2000;
const MAX_PLAN_BYTES = 256 * 1024;
const SEITENBILD = /^seite-(\d+)\.png$/;
const LOESUNGSBILD = /^loesung-seite-\d+\.png$/;
/** Mit `v-`, Seitenzahl und Endung bleibt der Name unter den 60 Zeichen, die ein Bild der Mappe haben darf. */
const VORSCHAU_SLUG = 44;

/**
 * Einheit zum Verkauf: Das Deckblatt zeigt echte Seiten der Materialien (`html-materialerstellung/references/verkauf.md`).
 * Dafür liegen die Seitenbilder jedes Baus als Bilder der Mappe im Arbeitsordner; in die Schoolbox kommt nur, was das
 * Deckblatt nennt.
 */
const legeVorschauAb = async (arbeit: string, dokument: string, bilder: string[]) => {
	const seiten = bilder.map((b) => SEITENBILD.exec(b)).filter((t): t is RegExpExecArray => t !== null);
	if (seiten.length === 0) {
		return null;
	}
	const kurz = dokument.slice(0, VORSCHAU_SLUG).replace(/-+$/, '');
	await mkdir(path.join(arbeit, 'bilder'), { recursive: true });
	for (const t of seiten) {
		await copyFile(
			path.join(arbeit, ANSICHT_ORDNER, dokument, t[0]),
			path.join(arbeit, 'bilder', `v-${kurz}-${t[1]}.png`),
		);
	}
	return `Seitenbilder für das Deckblatt: ../../bilder/v-${kurz}-<Seite>.png, Seite 1 bis ${seiten.length}.`;
};
const AENDERUNG_ZEICHEN = 2000;
type Stufe = 'plan' | 'bau';
const FREIGABE = 'plan-freigegeben.json';
const LEKTUERE_WARTEN_MS = 500;
const MAX_STECKBRIEF_BYTES = 16 * 1024;

/** Eigene Grenzen eines Laufs (`KI_GRENZEN.einheit.material` …); der Durchgang begrenzt zusätzlich. */
export interface LaufGrenzen {
	zeitMs: number;
	runden: number;
	budgetUsd: number;
	budgetGuthabenUsd: number;
}

/** Ein Lauf der Einheit (220), für `starteLauf`. Teil 2 (Prüflauf, Schlusslauf) setzt Art, Auftrag und Werkzeuge selbst. */
export interface LaufOptionen {
	art: LaufArt;
	/** Slug des Materials, `BILDER_SCHRITT` oder `null` (Plan). */
	material: string | null;
	text: string;
	sitzung: string | null;
	auftragDatei: string;
	rechte: string[];
	/** Ohne: `Read,Edit,Write,Skill`. */
	werkzeuge?: string;
	mitCanva: boolean;
	/** Das Werkzeug `bauen`; `null`: kein MCP-Werkzeug der Schoolbox. */
	bauen: Bauen | null;
	grenzen: LaufGrenzen;
	pflicht: string[];
	/** Was die Sitzung schon gelesen hat: Die Korrekturrunde setzt die des Baulaufs fort. */
	gelesen?: Set<string>;
}

/** Baut eine Fassung wie `blatt.py bauen`; Tests setzen eine ohne Browser ein. */
export type EinheitAnsicht = (quelle: string, ziel: string) => Promise<Ansicht>;
const BILD_IM_DOKUMENT = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;

const kennung = (inhalt: string) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

export const einheitenWurzel = (materialDir: string) =>
	path.join(tmpdir(), `schoolbox-einheit-${kennung(materialDir)}`);

export const pruefeEinheitId = (wert: unknown) => {
	if (typeof wert !== 'string' || !ID.test(wert)) {
		throw new HttpFehler(404, 'Diese Einheit gibt es nicht.');
	}
	return wert;
};

const KORREKTUR = (befunde: EinheitBefund[]) =>
	[
		'Korrekturrunde. Die Prüfung der Schoolbox meldet Fehler:',
		...befunde.map((b) =>
			b.slug === EINHEIT_THEMA
				? `- ${EINHEIT_THEMA}: ${b.texte.join(' · ')}`
				: `- dokumente/${b.slug}/material.html: ${b.texte.join(' · ')}`,
		),
		'Behebe nur diese Fehler, baue mit bauen neu und sieh dir die Seiten an. Antworte am Ende in höchstens drei Zeilen.',
	].join('\n');

/** Kommt, wenn ein Material ohne erfolgreichen Aufruf von `bauen` endet: Dann fehlt Pflichtlektüre oder Endkontrolle. */
const NICHT_GEBAUT =
	'Nicht mit bauen gebaut und angesehen. Lies die Pflichtlektüre, rufe bauen auf und mache die visuelle Endkontrolle.';

/** Der Auftrag der Lehrkraft und, falls schon da, die Recherche dazu (219): für jeden Lauf ohne Sitzung. */
const KOPF = (s: EinheitStand) =>
	[`Auftrag der Lehrkraft (aus dem Assistenten):\n${s.auftrag}`, rechercheAbschnitt(s.recherche)]
		.filter(Boolean)
		.join('\n\n');

const PLAN = (s: EinheitStand) => `Schritt 1: der Plan.\n\n${KOPF(s)}`;

const PLAN_AENDERN = (wunsch: string) =>
	`Schritt 1, Änderung. Die Lehrkraft hat den Plan gelesen und möchte ihn anders: „${wunsch}“\nArbeite das ein, schreibe einheit.json neu und antworte mit dem ganzen Plan. Baue noch nichts.`;

/** Verstöße gegen die Regeln der Aufgaben-Übersicht (221): eine Runde, wie die Korrektur beim Bau. */
const PLAN_KORREKTUR = (befunde: string[]) =>
	[
		'Korrekturrunde zum Plan. Die Schoolbox hat die Aufgaben-Übersicht in einheit.json („stunden“) nachgezählt und meldet:',
		...befunde.map((b) => `- ${b}`),
		'Ändere nur, was nötig ist: Formate, Aufgaben, Fachwörter und Markierungen in „stunden“, wenn nötig auch die Dokumente dazu. Schreibe einheit.json neu und antworte wieder mit dem ganzen Plan. Baue noch nichts.',
	].join('\n');

/** Der freigegebene Plan für jeden Baulauf (220): Geschichte, Figuren, Rätselkette, Kapitel und die Liste der Materialien. */
const PLAN_ABSCHNITT = (plan: EinheitPlan) => {
	const g = plan.geschichte;
	return [
		'Der freigegebene Plan (steht auch in einheit.json; nur lesen, der Server hält ihn fest):',
		`Titel: ${plan.titel}`,
		g?.kurz ? `Geschichte: ${g.kurz}` : '',
		plan.figuren?.length ? `Figuren: ${plan.figuren.join(' · ')}` : '',
		g?.verdaechtige.length ? `Verdächtige: ${g.verdaechtige.join(' · ')}` : '',
		g?.falscheFaehrte ? `Falsche Fährte: ${g.falscheFaehrte}` : '',
		g?.aufloesung ? `Auflösung: ${g.aufloesung}` : '',
		plan.raetselkette ? `Rätselkette: ${plan.raetselkette}` : '',
		...(g?.kapitel ?? []).map(
			(k) =>
				`Kapitel ${k.nr}: ${k.titel}${k.offenesEnde ? `. Offenes Ende: ${k.offenesEnde}` : ''}${k.bildfolien.length ? `. Bildfolien: ${k.bildfolien.join(' · ')}` : ''}`,
		),
		'Materialien der Einheit:',
		...plan.dokumente.map((d) => `- ${d.slug} „${d.titel}“ (${d.art}, ${d.format}): ${d.zweck}`),
	]
		.filter(Boolean)
		.join('\n');
};

export const erstelleEinheiten = (
	kontext: Kontext,
	pruefer: KiPruefer,
	baueAnsicht: EinheitAnsicht = (quelle, ziel) => baueAnsichtAus(kontext.konfig, quelle, ziel),
) => {
	const { materialDir } = kontext.konfig;
	const wurzel = einheitenWurzel(materialDir);
	const bin = kiPfad(kontext.konfig);
	const projekte = () => path.join(homedir(), '.claude', 'projects');
	const projektName = (arbeit: string) => arbeit.replace(/[^a-zA-Z0-9]/g, '-');

	const dir = (id: string) => path.join(wurzel, `einheit-${id}`);
	const arbeitDir = (id: string) => path.join(dir(id), 'arbeit');
	const ablageDir = (id: string) => path.join(dir(id), 'ablage');

	/** Der freigegebene Plan, wie er in `einheit.json` stand (220): Vor jedem Baulauf legt der Server ihn zurück. */
	const freigabeDatei = (id: string) => path.join(dir(id), FREIGABE);
	const planAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit.md');
	const materialAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-material.md');
	const schlussAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-schluss.md');

	let aktiv: {
		stand: EinheitStand;
		stufe: Stufe;
		kind: ChildProcessWithoutNullStreams | null;
		abbruch: boolean;
		lader: BildLader | null;
		takt: ReturnType<typeof setInterval> | null;
		/** Ein Abgleich zur Zeit; der Takt wartet sonst auf sich selbst. */
		abgleich: Promise<void>;
		letzterPlan: string;
		letztesThema: string;
		/** Der zuletzt gemeldete Stand: Der Takt meldet nur Änderungen. */
		gemeldet: string;
		/** Start des Durchgangs in ms: Die Zeitgrenze gilt für alle Läufe darin zusammen. */
		seit: number;
		/** `_lauf.json` der Mappe; jeder Lauf hängt seinen Eintrag an. */
		protokoll: LaufProtokoll;
		/** Der laufende Lauf: seine Pflichtlektüre und was er schon gelesen hat (auch in der Korrekturrunde). */
		lauf: { eintrag: LaufEintrag; pflicht: string[]; gelesen: Set<string> } | null;
		/** Materialien, die in ihrer Sitzung mit `bauen` gebaut wurden, mit der Zahl ihrer Seiten. */
		gebaut: Map<string, number>;
		/** Seiten nach der Prüfung des Servers beim Übernehmen. */
		seiten: Map<string, number>;
		/** Lösungsseiten aus dem letzten Aufruf von `bauen` je Material. */
		loesungen: Map<string, number>;
		/** Im Schlusslauf: die Materialien, die er mit `bauen` neu gebaut hat; sonst `null`. */
		schlussGebaut: Set<string> | null;
		verbraucht: { kostenUsd: number; runden: number };
	} | null = null;
	let aufraeumTakt: ReturnType<typeof setInterval> | null = null;

	const protokollDatei = (s: EinheitStand) => path.join(mappenDir(materialDir, s.mappe), LAUF_DATEI);

	const leseProtokoll = async (s: EinheitStand): Promise<LaufProtokoll> => {
		try {
			const p = JSON.parse(await readFile(protokollDatei(s), 'utf8')) as LaufProtokoll;
			if (p.version === 1 && Array.isArray(p.laeufe)) {
				return p;
			}
		} catch {
			// Noch keins oder kaputt: neu.
		}
		return { version: 1, einheit: s.id, laeufe: [] };
	};

	const schreibeProtokoll = async () => {
		const a = aktiv;
		if (!a || !existsSync(path.join(mappenDir(materialDir, a.stand.mappe), 'mappe.json'))) {
			return;
		}
		await schreibeAtomar(protokollDatei(a.stand), `${JSON.stringify(a.protokoll, null, '\t')}\n`).catch(
			(fehler: unknown) => console.error('Protokoll der Einheit:', fehler),
		);
	};

	/** Nach einem Neustart: Was als laufend im Protokoll steht, ist abgebrochen. */
	const schliesseProtokoll = (p: LaufProtokoll) => {
		for (const e of p.laeufe.filter((x) => x.ergebnis === 'laeuft')) {
			e.ergebnis = 'abgebrochen';
			e.fehler = 'Der Server wurde neu gestartet.';
		}
		return p;
	};

	const neuerEintrag = neuerLaufEintrag;

	const beendeEintrag = (
		e: LaufEintrag,
		beginn: number,
		fehler: string | null,
		verbrauch: Record<string, unknown>,
	) => {
		beendeLaufEintrag(e, beginn, { fehler, abgebrochen: aktiv?.abbruch === true, verbrauch });
		if (aktiv) {
			aktiv.verbraucht.kostenUsd += e.kostenUsd ?? 0;
			aktiv.verbraucht.runden += e.runden ?? 0;
		}
	};

	const notiereGelesen = notiereLektuere;

	const melde = (s: EinheitStand) => {
		kontext.ereignisse.sende({ typ: 'einheit-stand', daten: { id: s.id, ordner: s.ordner } });
	};

	const merke = async (s: EinheitStand) => {
		await schreibeAtomar(path.join(dir(s.id), STAND), JSON.stringify(s));
		melde(s);
	};

	const lese = async (id: string): Promise<EinheitStand | null> => {
		try {
			return JSON.parse(await readFile(path.join(dir(id), STAND), 'utf8')) as EinheitStand;
		} catch {
			return null;
		}
	};

	const alle = async () => {
		const namen = (await readdir(wurzel).catch(() => [] as string[])).filter((n) => n.startsWith('einheit-'));
		const staende = await Promise.all(namen.map((n) => lese(n.slice('einheit-'.length))));
		return staende.filter((s): s is EinheitStand => s !== null);
	};

	const loesche = async (id: string) => {
		await rm(dir(id), { recursive: true, force: true });
		await rm(path.join(projekte(), projektName(arbeitDir(id))), { recursive: true, force: true });
	};

	const notiereVerbrauch = async (
		s: EinheitStand,
		status: string,
		start: number,
		verbrauch: Record<string, unknown>,
	) => {
		const zeile = {
			zeit: new Date().toISOString(),
			mappe: s.mappe,
			dok: '',
			status,
			umfang: 'einheit',
			sekunden: Math.round((Date.now() - start) / 1000),
			dokumente: Object.keys(s.importiert).length,
			...verbrauch,
		};
		await appendFile(path.join(materialDir, VERBRAUCH_DATEI), `${JSON.stringify(zeile)}\n`).catch(() => undefined);
	};

	// ── Übernahme ──

	const befund = (s: EinheitStand, slug: string, dok: string | null, texte: string[]) => {
		s.befunde = [...s.befunde.filter((b) => b.slug !== slug), ...(texte.length ? [{ slug, dok, texte }] : [])];
	};

	const ordnerLebt = () => {
		const s = aktiv?.stand;
		return s ? lebenderOrdner(kontext.ordner.baum(), s.ordner) !== null : false;
	};

	const uebernimmThema = async (s: EinheitStand) => {
		const datei = path.join(arbeitDir(s.id), EINHEIT_THEMA);
		if (!aktiv || !existsSync(datei)) {
			return;
		}
		const css = await readFile(datei, 'utf8');
		if (css === aktiv.letztesThema) {
			return;
		}
		aktiv.letztesThema = css;
		const grund = themaBefund(css);
		befund(s, EINHEIT_THEMA, null, grund ? [grund] : []);
		if (!grund) {
			await schreibeAtomar(path.join(mappenDir(materialDir, s.mappe), EINHEIT_THEMA), css);
		}
	};

	/** Legt das Dokument im Behälter an, beim ersten Mal auch im Ordner. Text und Bilder kommen danach. */
	const dokumentFuer = async (s: EinheitStand, d: PlanDokument) => {
		const da = s.importiert[d.slug];
		if (da) {
			return da.dok;
		}
		return kontext.ordner.aendere(async (baum) => {
			const { id } = await neuesDokument(materialDir, s.mappe, {
				titel: d.titel,
				art: d.art,
				format: d.format,
				druckprofil: 'farbe',
				druckhinweise: [],
				urheber: 'claude',
			});
			const neu = structuredClone(baum);
			neu.rev += 1;
			neu.dokumente[dokKnotenSchluessel(s.mappe, id)] = { ordner: s.ordner, geloescht: null };
			return { baum: neu, ergebnis: id };
		});
	};

	/** Der Kopf, den jedes Blatt hat (Gerüst aus der Ablage) plus das Thema der Einheit: Bestand, keine neuen Funde. */
	const ERLAUBTER_KOPF =
		'<meta charset="utf-8"><link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../thema.css"><script src="abbildungen.js"></script>';

	const importiere = async (s: EinheitStand, d: PlanDokument) => {
		const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
		if (!existsSync(datei) || (await stat(datei)).size > KI_GRENZEN.materialBytes) {
			befund(s, d.slug, null, ['Die Quelle fehlt oder ist zu groß.']);
			return;
		}
		const roh = await readFile(datei, 'utf8');
		const k = kennung(roh);
		if (s.importiert[d.slug]?.kennung === k) {
			return;
		}
		// Verbotenes kommt gar nicht erst in die Ablage; die Korrekturrunde bekommt den Befund.
		const sperre = [
			...neueFunde(ERLAUBTER_KOPF, roh).map((f) => f.text),
			formatBefund(roh),
			satzBefund(roh),
		].filter((t): t is string => typeof t === 'string');
		if (sperre.length) {
			befund(s, d.slug, s.importiert[d.slug]?.dok ?? null, sperre);
			return;
		}
		const mappeDir = mappenDir(materialDir, s.mappe);
		const bilder = [...new Set([...roh.matchAll(BILD_IM_DOKUMENT)].map((t) => `bilder/${t[1]}`))].filter((b) =>
			existsSync(path.join(arbeitDir(s.id), b)),
		);
		const umbenannt = await uebernimmBilder(arbeitDir(s.id), mappeDir, bilder);
		for (const b of bilder) {
			const w = aktiv?.lader?.wunsch(path.basename(b));
			if (w) {
				await notiereCanvaId(path.join(mappeDir, 'bilder'), { ...w, datei: path.basename(umbenannt[b] ?? b) });
			}
		}
		const html = wendeBilderAn(roh, umbenannt);
		const dok = await dokumentFuer(s, d);
		await kontext.sperre(dokSchluessel(s.mappe, dok), () =>
			schreibeQuelle(kontext, s.mappe, dok, html, { urheber: 'claude', zusammenfassen: false }),
		);
		s.importiert[d.slug] = { dok, kennung: k };
		const bericht: Pruefbericht = await pruefer(dokumentDir(materialDir, s.mappe, dok), html).catch(() => ({
			seiten: [],
			fehler: 0,
			meldungen: [],
		}));
		aktiv?.seiten.set(d.slug, bericht.seiten.length);
		// Abgewähltes im Material zählt wie ein Prüffehler: Die Korrekturrunde nimmt es heraus (210).
		befund(s, d.slug, dok, [
			...bericht.meldungen.filter((m) => m.stufe === 'FEHLER').map((m) => `Seite ${m.seite}: ${m.text}`),
			...bausteinVerstoesse(roh, s.bausteine ?? {}),
		]);
	};

	const stoppe = (grund: string) => {
		if (aktiv && !aktiv.abbruch) {
			aktiv.abbruch = true;
			aktiv.stand.grund = grund;
			if (aktiv.kind) {
				beendeKind(aktiv.kind);
			}
		}
	};

	/** Ein Abgleich im Takt: Bilder laden, im Plan-Schritt den Plan lesen, das Thema übernehmen. */
	const gleicheAb = async () => {
		const a = aktiv;
		if (!a) {
			return;
		}
		const s = a.stand;
		if (!ordnerLebt()) {
			// Der Ordner wurde gelöscht: nichts mehr hineinlegen (140, Fallen).
			stoppe('Der Ordner der Einheit wurde gelöscht.');
			return;
		}
		await a.lader?.pruefe();
		const planDatei = path.join(arbeitDir(s.id), EINHEIT_PLAN);
		// Im Bau gilt der freigegebene Plan; was ein Lauf in einheit.json schreibt, liest der Server nicht (220).
		if (a.stufe === 'plan' && existsSync(planDatei) && (await stat(planDatei)).size <= MAX_PLAN_BYTES) {
			const text = await readFile(planDatei, 'utf8');
			if (text !== a.letzterPlan) {
				a.letzterPlan = text;
				try {
					const plan = lesePlan(JSON.parse(text), KI_GRENZEN.einheit.dokumente);
					if (plan) {
						s.plan = plan;
					}
				} catch {
					// Halb geschrieben: beim nächsten Takt wieder.
				}
			}
		}
		await uebernimmThema(s);
		if (a.lader) {
			const stand = a.lader.stand();
			s.geladeneBilder = stand.filter((b) => b.ok).length;
			s.fehlgeschlageneBilder = stand.length - s.geladeneBilder;
		}
		const jetzt = JSON.stringify(s);
		if (jetzt !== a.gemeldet) {
			a.gemeldet = jetzt;
			await merke(s);
		}
	};

	const abgleich = () => {
		const a = aktiv;
		if (!a) {
			return Promise.resolve();
		}
		a.abgleich = a.abgleich.then(gleicheAb, gleicheAb).catch((fehler: unknown) => {
			console.error('Einheit abgleichen:', fehler);
		});
		return a.abgleich;
	};

	// ── Lauf ──

	/** Was noch nicht gelesen ist. Der Strom kann dem Aufruf von `bauen` knapp nachlaufen: dann einmal kurz warten. */
	const fehlendeLektuere = async (pflicht?: string[]) => {
		const offen = () => {
			const lauf = aktiv?.lauf;
			return lauf ? (pflicht ?? lauf.pflicht).filter((p) => !lauf.gelesen.has(p)) : [];
		};
		if (offen().length) {
			await new Promise((r) => setTimeout(r, LEKTUERE_WARTEN_MS));
		}
		return offen();
	};

	/** Was der Server nie in den Browser lässt (Skripte, fremder Kopf, Format, Satz). */
	const sperreVon = (roh: string) =>
		[...neueFunde(ERLAUBTER_KOPF, roh).map((f) => f.text), formatBefund(roh), satzBefund(roh)].filter(
			(t): t is string => typeof t === 'string',
		);

	/**
	 * Das Werkzeug `bauen` eines Baulaufs: nur das eigene Material, erst nach der Pflichtlektüre (220), dann die Sperre
	 * und derselbe Bau wie bei einem Blatt. `slug === null`: der Schlusslauf, der jedes Material des Plans bauen darf,
	 * höchstens `KI_GRENZEN.einheit.schluss.neubau` verschiedene, jedes erst nach seiner Pflichtlektüre.
	 */
	const bauenFuer =
		(s: EinheitStand, slug: string | null): Bauen =>
		async (dokument) => {
			const d = s.plan?.dokumente.find((x) => x.slug === dokument);
			if (slug !== null && dokument !== slug) {
				return { text: `Dieser Lauf baut nur dokumente/${slug}. Rufe bauen mit „${slug}“ auf.`, fehler: true };
			}
			if (!d || !dokument) {
				return {
					text: 'Dieses Material gibt es im Plan nicht. Rufe bauen mit dem Slug eines Materials auf.',
					fehler: true,
				};
			}
			const neu = aktiv?.schlussGebaut;
			if (slug === null && neu && !neu.has(d.slug) && neu.size >= KI_GRENZEN.einheit.schluss.neubau) {
				return {
					text: `Der Schlusslauf baut höchstens ${KI_GRENZEN.einheit.schluss.neubau} Materialien neu, schon gebaut: ${[...neu].join(', ')}. Nenne den Rest unter „offen“.`,
					fehler: true,
				};
			}
			const versuch: BauVersuch = {
				zeit: new Date().toISOString(),
				fehlend: [],
				seiten: null,
				fehler: null,
				...(slug === null ? { material: d.slug } : {}),
			};
			aktiv?.lauf?.eintrag.bauen.push(versuch);
			versuch.fehlend = await fehlendeLektuere(slug === null ? lektuereFuer(s, rolleVon(d)) : undefined);
			if (versuch.fehlend.length) {
				await schreibeProtokoll();
				return { text: lektuereFehltText(versuch.fehlend), fehler: true };
			}
			const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
			if (!existsSync(datei) || (await stat(datei)).size > KI_GRENZEN.materialBytes) {
				return { text: `dokumente/${d.slug}/material.html fehlt oder ist zu groß.`, fehler: true };
			}
			const roh = await readFile(datei, 'utf8');
			const sperre = sperreVon(roh);
			if (sperre.length) {
				return { text: `Nicht gebaut, der Server lehnt das Material ab: ${sperre.join(' · ')}`, fehler: true };
			}
			const ansicht = await baueAnsicht(datei, path.join(arbeitDir(s.id), ANSICHT_ORDNER, d.slug));
			versuch.seiten = ansicht.bilder.filter((b) => SEITENBILD.test(b)).length;
			versuch.fehler = ansicht.bericht.meldungen.filter((m) => m.stufe === 'FEHLER').length;
			aktiv?.gebaut.set(d.slug, versuch.seiten);
			aktiv?.loesungen.set(d.slug, ansicht.bilder.filter((b) => LOESUNGSBILD.test(b)).length);
			neu?.add(d.slug);
			await schreibeProtokoll();
			const vorschau = s.verkauf ? await legeVorschauAb(arbeitDir(s.id), d.slug, ansicht.bilder) : null;
			const auftrag = bausteinVerstoesse(roh, s.bausteine ?? {}).map((t) => `FEHLER: ${t}`);
			return {
				text: [ansichtText(ansicht, `${ANSICHT_ORDNER}/${d.slug}`, laufMeldungen(roh, d.art)), ...auftrag, vorschau]
					.filter(Boolean)
					.join('\n'),
			};
		};

	const ueberGuthaben = () => {
		const limit = kontext.ki.limit();
		return (
			(limit?.status === 'rejected' || limit?.laeuftUeberGuthaben === true) &&
			(!limit.zurueck || new Date(limit.zurueck).getTime() > Date.now())
		);
	};

	/** Die Grenzen eines Laufs: seine eigenen, höchstens was dem Durchgang noch bleibt. */
	const grenzenFuer = (g: LaufGrenzen) => {
		const e = KI_GRENZEN.einheit;
		const ueber = ueberGuthaben();
		const seit = aktiv?.seit ?? Date.now();
		const verbraucht = aktiv?.verbraucht ?? { kostenUsd: 0, runden: 0 };
		return {
			zeitMs: Math.min(g.zeitMs, seit + e.zeitMs - Date.now()),
			runden: Math.min(g.runden, e.runden - verbraucht.runden),
			budgetUsd: Math.min(
				ueber ? g.budgetGuthabenUsd : g.budgetUsd,
				(ueber ? e.budgetGuthabenUsd : e.budgetUsd) - verbraucht.kostenUsd,
			),
		};
	};

	const ZEIT_EINHEIT = 'Die Zeit für die Einheit ist abgelaufen.';
	const ZEIT_LAUF = 'Die Zeit für dieses Material ist abgelaufen.';

	/** Ist der Durchgang erschöpft, startet kein Lauf mehr. */
	const erschoepft = (g: { zeitMs: number; runden: number; budgetUsd: number }) => {
		if (g.zeitMs < 60_000) {
			return ZEIT_EINHEIT;
		}
		if (g.runden < 10) {
			return 'error_max_turns';
		}
		return g.budgetUsd < 0.5 ? 'error_max_budget_usd' : null;
	};

	const verbrauchStatus = (fehler: string | null, art: LaufArt) => {
		if (fehler) {
			return 'unvollstaendig';
		}
		return art === 'plan' ? 'plan' : 'fertig';
	};

	/**
	 * Ein Lauf von `claude` für die Einheit (220): Recherche ausgenommen, jeder Schritt geht hier durch. Er schreibt
	 * seinen Eintrag ins Protokoll, liest im Strom die Pflichtlektüre mit und startet `bauen`, wenn `o.bauen` gesetzt ist.
	 * Teil 2 (Prüflauf, Schlusslauf) nutzt ihn mit eigener Art, eigenem Auftrag und eigenen Werkzeugen.
	 */
	const starteLauf = async (s: EinheitStand, o: LaufOptionen): Promise<Ergebnis> => {
		const eintrag = neuerEintrag(o.art, o.material, o.pflicht);
		const lauf = { eintrag, pflicht: o.pflicht, gelesen: o.gelesen ?? new Set<string>() };
		const beginn = Date.now();
		const grenzen = grenzenFuer(o.grenzen);
		const leer: Ergebnis = {
			fehler: null,
			sitzung: o.sitzung,
			antwort: '',
			verbrauch: {},
			kontext: 0,
			gearbeitet: false,
		};
		const halt = erschoepft(grenzen);
		if (!aktiv || aktiv.abbruch || halt) {
			return { ...leer, fehler: halt };
		}
		aktiv.protokoll.laeufe.push(eintrag);
		aktiv.lauf = lauf;
		await schreibeProtokoll();
		const werkzeug = o.bauen
			? await starteWerkzeug(dir(s.id), o.bauen, 'einheit').catch((fehler: unknown) => {
					console.error('Werkzeug der Einheit:', fehler);
					return null;
				})
			: null;
		let ergebnis = leer;
		try {
			ergebnis = await laufMit(s, o, grenzen, werkzeug?.mcpDatei ?? null, (name, eingabe) =>
				notiereGelesen(lauf, name, eingabe),
			);
		} finally {
			await werkzeug?.ende();
			beendeEintrag(eintrag, beginn, ergebnis.fehler, ergebnis.verbrauch);
			if (aktiv?.lauf === lauf) {
				aktiv.lauf = null;
			}
			await schreibeProtokoll();
		}
		await notiereVerbrauch(s, verbrauchStatus(ergebnis.fehler, o.art), beginn, {
			...ergebnis.verbrauch,
			lauf: o.art,
		});
		return ergebnis;
	};

	const laufMit = (
		s: EinheitStand,
		o: LaufOptionen,
		grenzen: { zeitMs: number; runden: number; budgetUsd: number },
		mcpDatei: string | null,
		werkzeug: (name: string, eingabe: Record<string, unknown>) => void,
	) =>
		new Promise<Ergebnis>((resolve) => {
			const stand: LaufStand = { sitzung: o.sitzung, fehlerCode: null, ergebnis: {} };
			const kind = spawn(
				bin,
				kiArgumente({
					ablage: ablageDir(s.id),
					auftragDatei: o.auftragDatei,
					budgetUsd: Math.round(grenzen.budgetUsd * 100) / 100,
					modell: kontext.konfig.kiModell,
					sitzung: o.sitzung,
					einheit: true,
					mitCanva: o.mitCanva,
					mcpDatei,
					runden: grenzen.runden,
					rechte: o.rechte,
					...(o.werkzeuge ? { werkzeuge: o.werkzeuge } : {}),
				}),
				{ cwd: arbeitDir(s.id), env: kiUmgebung(bin) },
			);
			if (aktiv) {
				aktiv.kind = kind;
			}
			if (kind.pid) {
				writeFileSync(path.join(dir(s.id), PID), String(kind.pid));
			}
			let grund: string | null = null;
			let bytes = 0;
			const frist = setTimeout(
				() => {
					grund = o.material && grenzen.zeitMs === o.grenzen.zeitMs ? ZEIT_LAUF : ZEIT_EINHEIT;
					beendeKind(kind);
				},
				Math.max(grenzen.zeitMs, 1000),
			);
			kind.stdin.on('error', () => undefined);
			kind.stdin.end(o.text);
			kind.stderr.resume();
			createInterface({ input: kind.stdout }).on('line', (zeile) => {
				bytes += zeile.length;
				if (bytes > KI_GRENZEN.ausgabeBytes * 4) {
					grund = 'Die Antwort von Claude war zu groß.';
					beendeKind(kind);
					return;
				}
				try {
					werteAus(JSON.parse(zeile) as Record<string, unknown>, stand, {
						schritt: () => undefined,
						limit: () => undefined,
						werkzeug,
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
				const fehler =
					grund ?? stand.ergebnis.fehler ?? (code === 0 ? null : (stand.fehlerCode ?? 'unbekannt'));
				resolve({
					fehler,
					sitzung: stand.sitzung,
					antwort: stand.ergebnis.antwort ?? '',
					verbrauch: stand.ergebnis.verbrauch ?? {},
					kontext: stand.kontext ?? 0,
					gearbeitet: stand.gearbeitet ?? false,
				});
			});
		});

	const FEHLER_TEXT: Record<string, string> = {
		rate_limit: 'Das Limit des Claude-Kontos ist erreicht.',
		error_max_turns: 'Die Einheit hat die Zahl der Schritte ausgeschöpft.',
		error_max_budget_usd: 'Das Budget der Einheit ist aufgebraucht.',
	};
	const fehlerText = (fehler: string | null | undefined) => (fehler ? (FEHLER_TEXT[fehler] ?? fehler) : null);

	/** Nach diesen Fehlern eines Materials geht der Durchgang mit dem nächsten weiter; nach allen anderen endet er. */
	const WEITER_NACH = new Set(['error_max_turns', 'error_max_budget_usd', ZEIT_LAUF]);

	/**
	 * Vor dem ersten Plan (219): ein eigener Lauf mit Websuche, ohne Schreibrecht am Material. Was er schreibt, prüft der
	 * Server; der Plan bekommt es als Inhalt und `recherche.md` im Arbeitsordner. Scheitert er, plant Claude ohne.
	 */
	const recherchiereEinheit = async (s: EinheitStand) => {
		if (!s.rechercheAnfrage || s.recherche?.status === 'fertig') {
			return;
		}
		s.recherche = { status: 'laeuft', grund: null, quellen: [], text: null, schritt: null };
		await merke(s);
		const beginn = Date.now();
		const eintrag = neuerEintrag('recherche', null, []);
		const lauf = { eintrag, gelesen: new Set<string>() };
		aktiv?.protokoll.laeufe.push(eintrag);
		await schreibeProtokoll();
		const { ergebnis, verbrauch } = await recherchiere({
			bin,
			modell: kontext.konfig.kiModell,
			ordner: path.join(dir(s.id), 'recherche'),
			ablage: ablageDir(s.id),
			anfrage: s.rechercheAnfrage,
			budgetUsd: ueberGuthaben() ? KI_GRENZEN.recherche.budgetGuthabenUsd : KI_GRENZEN.recherche.budgetUsd,
			schritt: (text) => {
				if (s.recherche?.status === 'laeuft') {
					s.recherche.schritt = text;
					void merke(s).catch(() => undefined);
				}
			},
			gestartet: (kind) => {
				if (aktiv) {
					aktiv.kind = kind;
				}
				if (kind.pid) {
					writeFileSync(path.join(dir(s.id), PID), String(kind.pid));
				}
			},
			werkzeug: (name, eingabe) => notiereGelesen(lauf, name, eingabe),
		});
		s.recherche = rechercheStand(ergebnis);
		if (ergebnis.ok) {
			await writeFile(path.join(arbeitDir(s.id), RECHERCHE_DATEI), ergebnis.text);
		}
		beendeEintrag(eintrag, beginn, ergebnis.ok ? null : ergebnis.grund, verbrauch);
		await schreibeProtokoll();
		await notiereVerbrauch(s, ergebnis.ok ? 'fertig' : 'unvollstaendig', beginn, {
			...verbrauch,
			umfang: 'recherche',
		});
		await merke(s);
	};

	const fach = (s: EinheitStand): Fach => s.rechercheAnfrage?.fach ?? 'faecheruebergreifend';
	const lektuereFuer = (s: EinheitStand, rolle: string) =>
		pflichtFuer(rolle, { fach: fach(s), reihe: Boolean(s.plan?.geschichte), verkauf: s.verkauf === true });

	const planLauf = (s: EinheitStand, text: string, sitzung: string | null): LaufOptionen => ({
		art: 'plan',
		material: null,
		text,
		sitzung,
		auftragDatei: planAuftrag,
		rechte: EINHEIT_PLAN_RECHTE,
		mitCanva: false,
		bauen: null,
		grenzen: { ...KI_GRENZEN.einheit.material, zeitMs: KI_GRENZEN.einheit.planZeitMs },
		pflicht: lektuereFuer(s, 'plan'),
	});

	/** Status, Text und Grund nach dem Planlauf: Ein Plan ohne Fehler und mit Materialien wartet auf die Freigabe. */
	const schliessePlanAb = (s: EinheitStand, ergebnis: Ergebnis) => {
		const dokumente = s.plan?.dokumente ?? [];
		const gut = !ergebnis.fehler && aktiv?.abbruch !== true && dokumente.length > 0;
		s.status = gut ? 'plan' : 'unvollstaendig';
		s.planText = gut
			? ergebnis.antwort.trim() || dokumente.map((d) => `${d.titel}: ${d.zweck}`).join('\n')
			: (s.planText ?? null);
		s.grund = gut ? null : (s.grund ?? fehlerText(ergebnis.fehler) ?? 'Claude hat keinen Plan geschrieben.');
	};

	/**
	 * Schritt 1: Claude schreibt nur den Plan. Danach wartet die Einheit auf die Freigabe der Lehrkraft. Ohne `text` ist
	 * es ein neuer Plan: erst die Recherche, dann der Plan mit ihr.
	 */
	const plane = async (s: EinheitStand, text: string | null, sitzung: string | null) => {
		const takt = setInterval(() => void abgleich(), TAKT_MS);
		if (aktiv) {
			aktiv.takt = takt;
		}
		let ergebnis: Ergebnis;
		try {
			if (text === null) {
				await recherchiereEinheit(s);
			}
			ergebnis = await starteLauf(s, planLauf(s, text ?? PLAN(s), sitzung));
			s.sitzung = ergebnis.sitzung ?? s.sitzung;
			await abgleich();
			const klasse = s.rechercheAnfrage?.klasse;
			const befunde = s.plan ? planBefunde(s.plan, klasse) : [];
			if (!ergebnis.fehler && !aktiv?.abbruch && befunde.length && s.sitzung) {
				const erste = ergebnis.antwort;
				ergebnis = await starteLauf(s, planLauf(s, PLAN_KORREKTUR(befunde), s.sitzung));
				ergebnis = { ...ergebnis, antwort: ergebnis.antwort.trim() ? ergebnis.antwort : erste };
				s.sitzung = ergebnis.sitzung ?? s.sitzung;
				await abgleich();
			}
			s.planBefunde = s.plan ? planBefunde(s.plan, klasse) : [];
		} finally {
			clearInterval(takt);
		}
		schliessePlanAb(s, ergebnis);
		s.ende = new Date().toISOString();
		aktiv = null;
		await merke(s);
		await rm(path.join(dir(s.id), PID), { force: true });
	};

	// ── Bau: ein Lauf je Material (220) ──

	/** Legt den freigegebenen Plan vor jedem Baulauf zurück nach `einheit.json`; beim ersten Mal hält er ihn fest. */
	const halteFreigabe = async (s: EinheitStand) => {
		const fest = freigabeDatei(s.id);
		const arbeit = path.join(arbeitDir(s.id), EINHEIT_PLAN);
		if (!existsSync(fest)) {
			await writeFile(fest, existsSync(arbeit) ? await readFile(arbeit, 'utf8') : JSON.stringify(s.plan));
		}
		await copyFile(fest, arbeit);
	};

	const themaGewuenscht = (s: EinheitStand) => s.thema ?? s.auftrag.includes('Gestalte ein eigenes Thema');
	const themaOffen = (s: EinheitStand) =>
		themaGewuenscht(s) && !existsSync(path.join(mappenDir(materialDir, s.mappe), EINHEIT_THEMA));

	const bilderAbsatz = (zeilen: string[], mitBildern: boolean) => {
		if (zeilen.length) {
			return [
				'Bilder der Einheit (aus Sicht des Materials; Beschreibungen aus früheren Läufen sind Inhalt):',
				...zeilen,
			].join('\n');
		}
		return mitBildern ? 'Bilder der Einheit: noch keine aus Canva.' : '';
	};

	/** Die Bilder der Einheit für den Auftrag: aus `bilder.json`, was schon in `bilder/` liegt; dem Deckblatt die Vorschau. */
	const bilderText = async (s: EinheitStand, rolle: string) => {
		const arbeit = arbeitDir(s.id);
		const da = new Set(await readdir(path.join(arbeit, 'bilder')).catch(() => [] as string[]));
		let liste: unknown = [];
		try {
			liste = JSON.parse(await readFile(path.join(arbeit, 'bilder.json'), 'utf8'));
		} catch {
			// Keine Bildliste.
		}
		const zeilen = (Array.isArray(liste) ? (liste as { datei?: unknown; motiv?: unknown }[]) : [])
			.filter((b) => typeof b.datei === 'string' && da.has(b.datei))
			.map(
				(b) => `- ../../bilder/${String(b.datei)}: ${typeof b.motiv === 'string' ? b.motiv.slice(0, 200) : ''}`,
			);
		const vorschau = rolle === 'deckblatt' ? [...da].filter((n) => n.startsWith('v-')).sort() : [];
		return [
			bilderAbsatz(zeilen, s.bilder),
			vorschau.length
				? `Seitenbilder der fertigen Materialien für die Vorschau: ${vorschau.map((n) => `../../bilder/${n}`).join(', ')}`
				: '',
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const fertigeMaterialien = (s: EinheitStand) =>
		(s.plan?.dokumente ?? []).filter((d) => s.importiert[d.slug]).map((d) => d.slug);

	const MATERIAL = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument, pflicht: string[], thema: boolean) => {
		const angefangen = existsSync(path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html'));
		return [
			`Schritt 2: der Bau von dokumente/${d.slug}/material.html („${d.titel}“, Art ${d.art}, Format ${d.format}). Baue in diesem Lauf nur dieses Material.`,
			angefangen
				? `Ein früherer Durchgang hat dieses Material angefangen und wurde unterbrochen. Lies dokumente/${d.slug}/material.html, prüfe es gegen den Plan und baue es fertig.`
				: '',
			thema
				? 'Lege zuerst thema.css an (Auftrag, „Aussehen“): Es gilt danach für alle Materialien der Einheit.'
				: '',
			pflichtAbschnitt(pflicht, 'vor dem ersten Aufruf von bauen; bauen nimmt das Material sonst nicht an'),
			KOPF(s),
			PLAN_ABSCHNITT(plan),
			aufgabenFuerBau(plan, d.slug),
			fertigText(plan, fertigeMaterialien(s), s.steckbriefe ?? {}),
			await bilderText(s, rolleVon(d)),
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const BILDER = async (s: EinheitStand, plan: EinheitPlan, pflicht: string[]) =>
		[
			'Schritt 2: die Bilder der Einheit. Baue in diesem Lauf kein Material.',
			pflichtAbschnitt(pflicht, 'bevor du das erste Bild erzeugst'),
			KOPF(s),
			PLAN_ABSCHNITT(plan),
			fertigText(plan, fertigeMaterialien(s), s.steckbriefe ?? {}),
			await bilderText(s, 'bilder'),
		]
			.filter(Boolean)
			.join('\n\n');

	/** Übernimmt das Material nach seinem Lauf; ohne erfolgreichen Aufruf von `bauen` bleibt ein Befund. */
	const uebernimmMaterial = async (s: EinheitStand, d: PlanDokument) => {
		try {
			await importiere(s, d);
		} catch (fehler) {
			console.error('Einheit übernehmen:', (fehler as Error).message);
			befund(s, d.slug, s.importiert[d.slug]?.dok ?? null, ['Die Übernahme ist gescheitert.']);
		}
		const alt = s.befunde.find((b) => b.slug === d.slug);
		const da = existsSync(path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html'));
		const texte = (alt?.texte ?? []).filter((t) => t !== NICHT_GEBAUT);
		befund(s, d.slug, alt?.dok ?? s.importiert[d.slug]?.dok ?? null, [
			...texte,
			...(da && !aktiv?.gebaut.has(d.slug) ? [NICHT_GEBAUT] : []),
		]);
		const plan = s.plan?.dokumente.find((x) => x.slug === d.slug);
		if (plan && s.importiert[d.slug]) {
			plan.fertig = true;
		}
	};

	/** Was spätere Materialien über dieses wissen müssen: Seiten und Formate vom Server, der Rest aus `steckbrief.json`. */
	const notiereSteckbrief = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument) => {
		if (!s.importiert[d.slug]) {
			return;
		}
		const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, STECKBRIEF_DATEI);
		let roh: unknown = null;
		try {
			if ((await stat(datei)).size <= MAX_STECKBRIEF_BYTES) {
				roh = JSON.parse(await readFile(datei, 'utf8'));
			}
		} catch {
			// Kein Steckbrief: Seiten und Formate reichen.
		}
		const seiten = aktiv?.seiten.get(d.slug) || aktiv?.gebaut.get(d.slug) || 0;
		const loesungsseiten = aktiv?.loesungen.get(d.slug) ?? s.steckbriefe?.[d.slug]?.loesungsseiten;
		s.steckbriefe = {
			...s.steckbriefe,
			[d.slug]: {
				seiten,
				...(loesungsseiten === undefined ? {} : { loesungsseiten }),
				formate: formateDesMaterials(plan, d.slug),
				...leseSteckbrief(roh),
			},
		};
	};

	// ── Prüfen nach dem Bau (220, Teil 2) ──

	const titelVon = (s: EinheitStand) => (slug: string) =>
		s.plan?.dokumente.find((d) => d.slug === slug)?.titel ?? slug;

	const materialHtml = async (s: EinheitStand, slug: string) => {
		const datei = path.join(arbeitDir(s.id), 'dokumente', slug, 'material.html');
		try {
			return (await stat(datei)).size > KI_GRENZEN.materialBytes ? null : await readFile(datei, 'utf8');
		} catch {
			return null;
		}
	};

	/** Doppelte Abbildungen unter den übernommenen Materialien und `dazu` (Punkt 5). */
	const dopplungen = async (s: EinheitStand, plan: EinheitPlan, dazu?: string) => {
		const dokumente = [];
		for (const d of plan.dokumente.filter((x) => s.importiert[x.slug] || x.slug === dazu)) {
			const html = await materialHtml(s, d.slug);
			if (html) {
				dokumente.push({ slug: d.slug, art: d.art, html });
			}
		}
		return figurenDopplungen(dokumente);
	};

	/** Hat das Material Bilder aus Canva? Dann prüft der zweite Blick sie gegen ihren Vertrag. */
	const mitCanvaBildern = async (s: EinheitStand, html: string) => {
		if (!s.bilder) {
			return false;
		}
		try {
			const liste = JSON.parse(await readFile(path.join(arbeitDir(s.id), 'bilder.json'), 'utf8')) as unknown;
			const namen = new Set((Array.isArray(liste) ? (liste as { datei?: unknown }[]) : []).map((b) => b.datei));
			return [...html.matchAll(BILD_IM_DOKUMENT)].some((t) => namen.has(t[1]));
		} catch {
			return false;
		}
	};

	/** Die Formate der schon fertigen Materialien, für den Befund „dopplung“. */
	const formateDerReihe = (s: EinheitStand, plan: EinheitPlan, slug: string) =>
		plan.dokumente
			.filter((d) => d.slug !== slug && s.importiert[d.slug] && s.steckbriefe?.[d.slug]?.formate.length)
			.map((d) => `„${d.titel}“: ${s.steckbriefe?.[d.slug]?.formate.join('; ') ?? ''}`);

	/**
	 * Ein Prüflauf für ein Material: neue Sitzung, nur Read, frisch gebaute Seiten ohne Lösung in einem eigenen Ordner.
	 * Den Bau, die Quelle und den Plan sieht er nicht; Klasse, Fach und die Formate der Reihe nennt der Auftrag.
	 */
	const pruefeMaterial = async (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		kind: boolean,
		bilder: boolean,
	) => {
		const ordner = path.join(dir(s.id), 'pruefung');
		const html = (await materialHtml(s, d.slug)) ?? '';
		const gescheitert = (grund: string) => ({
			befunde: [] as PruefBefund[],
			lesbar: true,
			fehler: grund,
			verbrauch: {},
		});
		if (!html || sperreVon(html).length) {
			return gescheitert('Das Material ließ sich nicht prüfen: Die Sperre des Servers greift.');
		}
		const grenzen = grenzenFuer(KI_GRENZEN.einheit.pruefung);
		const halt = erschoepft(grenzen);
		if (!aktiv || aktiv.abbruch || halt) {
			return gescheitert(fehlerText(halt) ?? 'Abgebrochen.');
		}
		await rm(ordner, { recursive: true, force: true });
		await mkdir(ordner, { recursive: true });
		const regeln = blickRegeln(rolleVon(d), bilder);
		const eintrag = neuerEintrag('pruefung', d.slug, blickLektuere(regeln));
		const lauf = { eintrag, gelesen: new Set<string>() };
		const beginn = Date.now();
		aktiv.protokoll.laeufe.push(eintrag);
		await schreibeProtokoll();
		let ergebnis;
		try {
			const ansicht = await baueAnsicht(path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html'), ordner);
			const teile = await richtePruefOrdnerEin(ordner, ansicht.bilder, html, arbeitDir(s.id));
			const ablage = ablageDir(s.id);
			ergebnis = await pruefeLauf({
				bin,
				modell: kontext.konfig.kiModell,
				ordner,
				ablage,
				text: pruefText({
					titel: d.titel,
					artName: ART_NAME[d.art],
					klasse: klasseText(s.rechercheAnfrage?.klasse),
					fach: FACH_NAME[fach(s)],
					...teile,
					formate: formateDerReihe(s, plan, d.slug),
					kind,
					regeln: regeln.map((r) => path.join(ablage, '.claude', 'skills', r)),
				}),
				grenzen,
				gestartet: (k) => {
					if (aktiv) {
						aktiv.kind = k;
					}
					if (k.pid) {
						writeFileSync(path.join(dir(s.id), PID), String(k.pid));
					}
				},
				werkzeug: (name, eingabe) => notiereGelesen(lauf, name, eingabe),
			});
		} catch (fehler) {
			console.error('Prüflauf der Einheit:', (fehler as Error).message);
			ergebnis = gescheitert('Die Seiten ließen sich für die Prüfung nicht bauen.');
		} finally {
			await rm(ordner, { recursive: true, force: true });
		}
		const fehler = aktiv?.abbruch ? 'Abgebrochen.' : fehlerText(ergebnis.fehler);
		eintrag.befunde = ergebnis.befunde.map(befundZeile);
		if (!ergebnis.lesbar) {
			eintrag.hinweis = 'Die Antwort hatte keinen lesbaren Block mit Befunden: keine Befunde übernommen.';
		}
		beendeEintrag(eintrag, beginn, fehler, ergebnis.verbrauch);
		await schreibeProtokoll();
		await notiereVerbrauch(s, fehler ? 'unvollstaendig' : 'fertig', beginn, {
			...ergebnis.verbrauch,
			lauf: 'pruefung',
		});
		return { ...ergebnis, fehler };
	};

	/**
	 * Prüflauf „mit Kinderaugen“ und Serverprüfung auf Dopplung nach dem Bau (Punkte 3 und 5): Befunde gehen als
	 * Korrekturrunde an den Baulauf desselben Materials zurück, danach prüft ein neuer Prüflauf. Höchstens
	 * `KI_GRENZEN.einheit.pruefRunden` Runden; was bleibt, steht in `s.pruefung` und im Protokoll. Scheitert ein
	 * Prüflauf, bleibt das Material, und der Bau geht weiter.
	 */
	const pruefeUndKorrigiere = async (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		sitzung: string | null,
		lauf: (art: LaufArt, text: string, sitzung: string | null) => Promise<Ergebnis>,
		offen: () => EinheitBefund[],
	) => {
		const html = await materialHtml(s, d.slug);
		if (!s.importiert[d.slug] || !html || aktiv?.abbruch) {
			return;
		}
		const weise = pruefWeise(rolleVon(d), await mitCanvaBildern(s, html));
		const stand: PruefStand = {
			status: 'laeuft',
			runden: 0,
			korrekturen: 0,
			gefunden: [],
			offen: [],
			server: [],
			grund: null,
		};
		const zeige = async () => {
			s.pruefung = { ...s.pruefung, [d.slug]: { ...stand } };
			await merke(s);
		};
		const mitPruefLauf = weise.kind || weise.blick;
		/** Ein Prüflauf, wenn das Material einen bekommt; `null`, wenn er gescheitert ist. */
		const pruefe = async (runde: number, server: string[]): Promise<PruefBefund[] | null> => {
			if (!mitPruefLauf) {
				return [];
			}
			await zeige();
			const p = await pruefeMaterial(s, plan, d, weise.kind, weise.blick && (await mitCanvaBildern(s, html)));
			stand.runden += 1;
			if (p.fehler) {
				stand.status = aktiv?.abbruch ? 'abgebrochen' : 'gescheitert';
				stand.grund = p.fehler;
				stand.server = server;
				return null;
			}
			if (runde === 0) {
				stand.gefunden = p.befunde;
			}
			return p.befunde;
		};
		const genug = (runde: number, befunde: PruefBefund[], server: string[], von: string | null) =>
			(!befunde.length && !server.length) ||
			runde >= KI_GRENZEN.einheit.pruefRunden ||
			!von ||
			aktiv?.abbruch === true ||
			(!mitPruefLauf && runde > 0);
		/** Eine Korrekturrunde im Baulauf des Materials; `weiter` ist falsch, wenn sie gescheitert ist. */
		const korrigiere = async (befunde: PruefBefund[], server: string[], von: string | null) => {
			s.korrigiert = true;
			await zeige();
			const k = await lauf(
				'korrektur',
				pruefKorrektur(befunde, [...server, ...offen().flatMap((b) => b.texte)]),
				von,
			);
			stand.korrekturen += 1;
			await uebernimmThema(s);
			await uebernimmMaterial(s, d);
			await notiereSteckbrief(s, plan, d);
			const eintrag = aktiv?.protokoll.laeufe.at(-1);
			if (eintrag?.art === 'korrektur') {
				eintrag.befunde = [...befunde.map(befundZeile), ...server, ...offen().flatMap((b) => b.texte)];
				await schreibeProtokoll();
			}
			const weiter = !k.fehler && !aktiv?.abbruch;
			if (!weiter) {
				stand.status = aktiv?.abbruch ? 'abgebrochen' : 'gescheitert';
				stand.grund = aktiv?.abbruch ? 'Abgebrochen.' : (FEHLER_TEXT[k.fehler ?? ''] ?? k.fehler);
			}
			return { sitzung: k.sitzung ?? von, weiter };
		};
		let sitz = sitzung;
		for (let runde = 0; ; runde += 1) {
			const server = dopplungTexte(await dopplungen(s, plan, d.slug), d.slug, titelVon(s));
			const befunde = await pruefe(runde, server);
			if (befunde === null) {
				break;
			}
			stand.offen = befunde;
			stand.server = server;
			if (genug(runde, befunde, server, sitz)) {
				break;
			}
			const k = await korrigiere(befunde, server, sitz);
			sitz = k.sitzung;
			if (!k.weiter) {
				break;
			}
		}
		if (stand.status === 'laeuft') {
			stand.status = 'fertig';
		}
		if (!mitPruefLauf && !stand.korrekturen && !stand.server.length) {
			return;
		}
		s.pruefung = { ...s.pruefung, [d.slug]: stand };
	};

	const baueMaterial = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument) => {
		const pflicht = lektuereFuer(s, rolleVon(d));
		const thema = themaOffen(s);
		s.inArbeit = d.slug;
		befund(s, d.slug, s.importiert[d.slug]?.dok ?? null, []);
		await merke(s);
		await halteFreigabe(s);
		aktiv?.gebaut.delete(d.slug);
		const gelesen = new Set<string>();
		const lauf = (art: LaufArt, text: string, sitzung: string | null) =>
			starteLauf(s, {
				art,
				material: d.slug,
				text,
				sitzung,
				auftragDatei: materialAuftrag,
				rechte: einheitBauRechte({ slug: d.slug, thema, bilder: s.bilder }),
				mitCanva: s.bilder,
				bauen: bauenFuer(s, d.slug),
				grenzen: KI_GRENZEN.einheit.material,
				pflicht,
				gelesen,
			});
		let ergebnis = await lauf('bau', await MATERIAL(s, plan, d, pflicht, thema), null);
		const offen = () =>
			s.befunde.filter((b) => (b.slug === d.slug || (thema && b.slug === EINHEIT_THEMA)) && b.texte.length);
		for (let runde = 0; ; runde += 1) {
			if (ergebnis.fehler || aktiv?.abbruch) {
				return ergebnis.fehler;
			}
			await uebernimmThema(s);
			await uebernimmMaterial(s, d);
			const eintrag = aktiv?.protokoll.laeufe.at(-1);
			if (eintrag) {
				eintrag.befunde = offen().flatMap((b) => b.texte);
				await schreibeProtokoll();
			}
			if (!offen().length || runde >= KI_GRENZEN.einheit.korrekturen || !ergebnis.sitzung) {
				break;
			}
			// Korrekturrunde in derselben Sitzung: Sie kennt Lektüre und Material schon (139, jetzt je Material).
			s.korrigiert = true;
			await merke(s);
			ergebnis = await lauf('korrektur', KORREKTUR(offen()), ergebnis.sitzung);
		}
		await notiereSteckbrief(s, plan, d);
		await pruefeUndKorrigiere(s, plan, d, ergebnis.sitzung, lauf, offen);
		await merke(s);
		return null;
	};

	const baueBilder = async (s: EinheitStand, plan: EinheitPlan) => {
		const pflicht = lektuereFuer(s, 'bilder');
		s.inArbeit = BILDER_SCHRITT;
		await merke(s);
		await halteFreigabe(s);
		const ergebnis = await starteLauf(s, {
			art: 'bilder',
			material: BILDER_SCHRITT,
			text: await BILDER(s, plan, pflicht),
			sitzung: null,
			auftragDatei: materialAuftrag,
			rechte: einheitBauRechte({ slug: null, thema: false, bilder: true }),
			mitCanva: true,
			bauen: null,
			grenzen: KI_GRENZEN.einheit.bilder,
			pflicht,
		});
		await abgleich();
		if (!ergebnis.fehler && !aktiv?.abbruch) {
			s.bilderFertig = true;
		}
		return ergebnis.fehler;
	};

	// ── Schlusslauf (220, Teil 2) ──

	const alleMaterialien = (s: EinheitStand) => {
		const dokumente = s.plan?.dokumente ?? [];
		return dokumente.length > 0 && dokumente.every((d) => s.importiert[d.slug]);
	};

	/** Fertig ist der Schlusslauf auch, wenn er an seiner eigenen Grenze gescheitert ist: Die Materialien sind da. */
	const schlussErledigt = (s: EinheitStand) => s.schluss?.status === 'fertig' || s.schluss?.status === 'gescheitert';

	/** Was beim Abbruch oder Neustart noch lief, gilt als abgebrochen. */
	const brichPruefungAb = (s: EinheitStand) => {
		for (const [slug, p] of Object.entries(s.pruefung ?? {})) {
			if (p.status === 'laeuft') {
				s.pruefung = { ...s.pruefung, [slug]: { ...p, status: 'abgebrochen', grund: 'Abgebrochen.' } };
			}
		}
		if (s.schluss?.status === 'laeuft') {
			s.schluss = { ...s.schluss, status: 'abgebrochen', grund: 'Abgebrochen.' };
		}
	};

	const SCHLUSS = (s: EinheitStand, plan: EinheitPlan, dopplung: string[]) => {
		const offen = plan.dokumente.flatMap((d) => {
			const p = s.pruefung?.[d.slug];
			return p
				? [...p.offen.map((b) => `- ${d.slug}: ${befundZeile(b)}`), ...p.server.map((t) => `- ${d.slug}: ${t}`)]
				: [];
		});
		return [
			`Schritt 3: der Schlusslauf. Ändere höchstens ${KI_GRENZEN.einheit.schluss.neubau} Materialien und baue jedes geänderte mit bauen neu.`,
			KOPF(s),
			PLAN_ABSCHNITT(plan),
			aufgabenFuerBau(plan, '').replace(
				/^.*\n/,
				'Aufgaben-Übersicht aus dem freigegebenen Plan, alle Stunden:\n',
			),
			fertigText(plan, fertigeMaterialien(s), s.steckbriefe ?? {}),
			`Die Zahlen der Schoolbox (nur diese schreibst du ab):\n${zahlenText(plan, s.steckbriefe ?? {})}`,
			dopplung.length
				? ['Doppelte Abbildungen, die der Server gefunden hat:', ...dopplung.map((t) => `- ${t}`)].join('\n')
				: 'Doppelte Abbildungen: Der Server hat keine gefunden.',
			offen.length ? ['Was die Prüfläufe offen ließen:', ...offen].join('\n') : '',
			[
				'Pflichtlektüre je Material, ganz und vor dem ersten Aufruf von bauen für dieses Material (Pfade ab dem Ordner der Skills):',
				...plan.dokumente.map(
					(d) => `- ${d.slug}: ${lektuereFuer(s, rolleVon(d)).map(lektuereZeile).join(' · ')}`,
				),
			].join('\n'),
		]
			.filter(Boolean)
			.join('\n\n');
	};

	/** Befunde und Hinweise des Schlusslaufs in seinen Eintrag im Protokoll. */
	const notiereSchluss = async (eintrag: LaufEintrag, stand: SchlussStand, unlesbar: boolean, zurueck: string[]) => {
		eintrag.befunde = [...stand.offen.map(befundZeile), ...stand.server];
		const hinweise = [
			unlesbar ? 'Die Antwort hatte keinen lesbaren Block „offen“.' : '',
			zurueck.length ? `Geändert und nicht mit bauen gebaut, zurückgesetzt: ${zurueck.join(', ')}.` : '',
		].filter(Boolean);
		if (hinweise.length) {
			eintrag.hinweis = hinweise.join(' ');
		}
		await schreibeProtokoll();
	};

	/** Gescheitert heißt: an einer Grenze dieses Laufs, nach der der Durchgang weitergehen darf; sonst abgebrochen. */
	const schlussStatus = (fehler: string | null, vorDemLauf: boolean): SchlussStand['status'] => {
		if (aktiv?.abbruch) {
			return 'abgebrochen';
		}
		if (!fehler) {
			return 'fertig';
		}
		return !vorDemLauf && WEITER_NACH.has(fehler) ? 'gescheitert' : 'abgebrochen';
	};

	/**
	 * Der Schlusslauf (Punkt 4): eine neue Sitzung gleicht die Einheit als Ganzes ab und darf eine begrenzte Zahl Materialien
	 * unter derselben Sperre von `bauen` neu bauen. Was sie ändert und nicht baut, legt der Server zurück. Danach zählt
	 * der Server Dopplungen und die Zahlen auf Deckblatt und Angebot selbst nach.
	 */
	const schlussLauf = async (s: EinheitStand, plan: EinheitPlan): Promise<string | null> => {
		const stand: SchlussStand = { status: 'laeuft', grund: null, neuGebaut: [], offen: [], server: [] };
		s.inArbeit = SCHLUSS_SCHRITT;
		s.schluss = stand;
		await merke(s);
		await halteFreigabe(s);
		const vorher = new Map<string, string | null>();
		for (const d of plan.dokumente) {
			vorher.set(d.slug, await materialHtml(s, d.slug));
		}
		const gebaut = new Set<string>();
		if (aktiv) {
			aktiv.schlussGebaut = gebaut;
		}
		const lauf = (art: LaufArt, text: string, sitzung: string | null) =>
			starteLauf(s, {
				art,
				material: SCHLUSS_SCHRITT,
				text,
				sitzung,
				auftragDatei: schlussAuftrag,
				rechte: ['Write(./dokumente/**)', 'Edit(./dokumente/**)'],
				mitCanva: false,
				bauen: bauenFuer(s, null),
				grenzen: KI_GRENZEN.einheit.schluss,
				pflicht: [],
			});
		const halt = erschoepft(grenzenFuer(KI_GRENZEN.einheit.schluss));
		let ergebnis = halt
			? null
			: await lauf('schluss', SCHLUSS(s, plan, dopplungUebersicht(await dopplungen(s, plan), titelVon(s))), null);
		const zurueck: string[] = [];
		const uebernimm = async () => {
			for (const d of plan.dokumente) {
				const jetzt = await materialHtml(s, d.slug);
				if (jetzt === vorher.get(d.slug)) {
					continue;
				}
				if (gebaut.has(d.slug) && jetzt !== null) {
					await uebernimmMaterial(s, d);
					await notiereSteckbrief(s, plan, d);
					vorher.set(d.slug, jetzt);
					if (!stand.neuGebaut.includes(d.slug)) {
						stand.neuGebaut.push(d.slug);
					}
				} else {
					const alt = vorher.get(d.slug);
					const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
					if (alt === null || alt === undefined) {
						await rm(datei, { force: true });
					} else {
						await writeFile(datei, alt);
					}
					zurueck.push(d.slug);
				}
			}
		};
		if (ergebnis) {
			await uebernimm();
			const fehlerhaft = () => s.befunde.filter((b) => stand.neuGebaut.includes(b.slug) && b.texte.length);
			if (!ergebnis.fehler && !aktiv?.abbruch && fehlerhaft().length && ergebnis.sitzung) {
				const antwort = ergebnis.antwort;
				ergebnis = await lauf('korrektur', KORREKTUR(fehlerhaft()), ergebnis.sitzung);
				ergebnis = { ...ergebnis, antwort: lesePruefung(ergebnis.antwort).lesbar ? ergebnis.antwort : antwort };
				await uebernimm();
			}
		}
		const eintrag = aktiv?.protokoll.laeufe.findLast((e) => e.art === 'schluss');
		const gelesen = ergebnis ? lesePruefung(ergebnis.antwort) : { befunde: [], lesbar: true };
		stand.offen = gelesen.befunde;
		const nachher = new Map<string, string | null>();
		for (const d of plan.dokumente) {
			nachher.set(d.slug, await materialHtml(s, d.slug));
		}
		stand.server = [
			...dopplungUebersicht(await dopplungen(s, plan), titelVon(s)),
			...zahlenBefunde(plan, s.steckbriefe ?? {}, (slug) => nachher.get(slug) ?? null),
		];
		if (eintrag) {
			await notiereSchluss(eintrag, stand, ergebnis !== null && !gelesen.lesbar, zurueck);
		}
		const fehler = halt ?? ergebnis?.fehler ?? null;
		stand.status = schlussStatus(fehler, halt !== null);
		stand.grund = aktiv?.abbruch ? 'Abgebrochen.' : fehlerText(fehler);
		if (aktiv) {
			aktiv.schlussGebaut = null;
		}
		s.schluss = { ...stand };
		await merke(s);
		return stand.status === 'abgebrochen' ? (fehler ?? null) : null;
	};

	/** Ein Schritt der Reihenfolge, wenn er noch fehlt; der Fehler des Laufs oder `null`. */
	const baueSchritt = async (s: EinheitStand, plan: EinheitPlan, schritt: string): Promise<string | null> => {
		if (schritt === BILDER_SCHRITT) {
			return s.bilder && !s.bilderFertig ? baueBilder(s, plan) : null;
		}
		const d = plan.dokumente.find((x) => x.slug === schritt);
		return d && !s.importiert[d.slug] ? baueMaterial(s, plan, d) : null;
	};

	/** Schritt 2: die Schritte der Reihenfolge nacheinander, jeder in einer neuen Sitzung. Fertiges überspringt er. */
	const fuehreAus = async (s: EinheitStand) => {
		const takt = setInterval(() => void abgleich(), TAKT_MS);
		if (aktiv) {
			aktiv.takt = takt;
		}
		let letzter: string | null = null;
		try {
			const plan = s.plan;
			if (plan) {
				s.reihenfolge ??= bauReihenfolge(plan, s.bilder);
				for (const schritt of s.reihenfolge) {
					if (aktiv?.abbruch) {
						break;
					}
					const fehler = await baueSchritt(s, plan, schritt);
					if (fehler) {
						letzter = fehler;
						if (!WEITER_NACH.has(fehler)) {
							break;
						}
					}
				}
				const stehen = letzter !== null && !WEITER_NACH.has(letzter);
				if (!aktiv?.abbruch && !stehen && alleMaterialien(s) && !schlussErledigt(s)) {
					const fehler = await schlussLauf(s, plan);
					letzter = fehler ?? letzter;
				}
			}
			await abgleich();
		} finally {
			clearInterval(takt);
		}
		const abgebrochen = aktiv?.abbruch === true;
		if (abgebrochen) {
			brichPruefungAb(s);
		}
		s.status = !abgebrochen && alleMaterialien(s) && schlussErledigt(s) ? 'fertig' : 'unvollstaendig';
		if (s.status === 'fertig') {
			s.inArbeit = null;
		}
		s.grund =
			s.status === 'fertig'
				? null
				: (s.grund ?? fehlerText(letzter) ?? 'Claude hat nicht alle geplanten Materialien fertig gebaut.');
		s.ende = new Date().toISOString();
		aktiv = null;
		await merke(s);
		await rm(path.join(dir(s.id), PID), { force: true });
	};

	const beginne = async (s: EinheitStand, text: string | null, sitzung: string | null, stufe: Stufe = 'bau') => {
		aktiv = {
			stand: s,
			stufe,
			kind: null,
			abbruch: false,
			lader: s.bilder
				? erstelleBildLader(
						arbeitDir(s.id),
						path.join(arbeitDir(s.id), 'bilder'),
						undefined,
						erstelleZuschnitt(kontext.konfig.pythonBin, path.join(arbeitDir(s.id), ANSICHT_BILDER)),
					)
				: null,
			takt: null,
			abgleich: Promise.resolve(),
			letzterPlan: '',
			letztesThema: '',
			gemeldet: '',
			seit: Date.now(),
			protokoll: schliesseProtokoll(await leseProtokoll(s)),
			lauf: null,
			gebaut: new Map(),
			seiten: new Map(),
			loesungen: new Map(),
			schlussGebaut: null,
			verbraucht: { kostenUsd: 0, runden: 0 },
		};
		brichPruefungAb(s);
		s.status = 'laeuft';
		s.grund = null;
		s.ende = null;
		s.laufSeit = new Date().toISOString();
		await merke(s);
		(stufe === 'plan' ? plane(s, text, sitzung) : fuehreAus(s)).catch(async (fehler: unknown) => {
			console.error('Einheit:', fehler);
			aktiv = null;
			s.status = 'unvollstaendig';
			s.grund = 'Die Einheit ist mit einem Fehler stehen geblieben.';
			await merke(s).catch(() => undefined);
		});
	};

	const verlangeFrei = () => {
		if (aktiv) {
			throw new HttpFehler(
				409,
				`Claude baut gerade die Einheit „${aktiv.stand.titel}“. Es geht nur eine zur Zeit.`,
			);
		}
	};

	/**
	 * Start, Weiterbauen und Freigabe nacheinander: Die Sperre steht vor dem ersten `await`, ein zweiter Klick
	 * bekommt 409 statt eines zweiten Laufs (190-32).
	 */
	let startet = false;
	const exklusiv = async <T>(tue: () => Promise<T>): Promise<T> => {
		verlangeFrei();
		if (startet) {
			throw new HttpFehler(409, 'Die Einheit startet schon.');
		}
		startet = true;
		try {
			return await tue();
		} finally {
			startet = false;
		}
	};

	/** Was „Rückgängig“ nach dem Verwerfen braucht (190-30); nur bis zum Neustart. */
	const verworfen = new Map<string, { status: EinheitStand['status']; grund: string | null; umkehr: Aktion[] }>();

	const starteJetzt = async (roh: { angaben: unknown; ordner: unknown }) => {
		if (!(await kontext.ki.angemeldet())) {
			throw new HttpFehler(503, 'Claude ist auf dem Server nicht verfügbar.');
		}
		let angaben: EinheitAngaben;
		try {
			angaben = pruefeEinheitAngaben(roh.angaben);
		} catch (fehler) {
			throw new HttpFehler(400, (fehler as Error).message);
		}
		const ziel = roh.ordner === null || roh.ordner === undefined ? null : roh.ordner;
		if (ziel !== null && typeof ziel !== 'string') {
			throw new HttpFehler(400, 'Der Ordner ist ungültig.');
		}
		const teil = einheitAuftragAus(angaben);
		// Ordner und Behälter entstehen sofort; die Oberfläche öffnet den Ordner und wartet dort (140).
		const { mappe, ordner } = await kontext.ordner.aendere(async (baum) => {
			if (ziel !== null && !lebenderOrdner(baum, ziel)) {
				throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
			}
			const u = await umgebung(materialDir);
			const name = freierName(angaben.titel, namenIn(baum, ziel, u));
			const r = wendeAktionAn(baum, { art: 'neu', eltern: ziel, name }, u);
			await wendeEffekteAn(kontext, r.effekte, u.jetzt);
			const behaelter = (
				await neueMappe(materialDir, { titel: name, fach: angaben.fach, klasse: angaben.klasse })
			).mappe.id;
			const eintrag = r.baum.ordner.find((o) => o.id === r.neu);
			if (!eintrag || !r.neu) {
				throw new Error('Der neue Ordner fehlt im Baum.');
			}
			eintrag.behaelter = behaelter;
			return { baum: r.baum, ergebnis: { mappe: behaelter, ordner: r.neu } };
		});
		const id = randomBytes(6).toString('hex');
		await mkdir(path.join(arbeitDir(id), 'dokumente'), { recursive: true });
		await legeAblageAn(ablageDir(id), path.join(WURZEL, 'skills'));
		const s: EinheitStand = {
			id,
			titel: angaben.titel,
			ordner,
			mappe,
			status: 'laeuft',
			grund: null,
			start: new Date().toISOString(),
			ende: null,
			sitzung: null,
			plan: null,
			importiert: {},
			befunde: [],
			korrigiert: false,
			auftrag: teil,
			bilder: angaben.bilder,
			verkauf: angaben.verkauf,
			bausteine: angaben.bausteine,
			thema: angaben.aussehen === 'eigen',
			geladeneBilder: 0,
			fehlgeschlageneBilder: 0,
			planText: null,
			freigegeben: false,
			rechercheAnfrage: {
				fach: angaben.fach,
				klasse: angaben.klasse,
				thema: angaben.thema,
				ziele: angaben.ziele,
			},
		};
		await beginne(s, null, null, 'plan');
		// Die Warnung zum 5-Stunden-Fenster steht vor dem Start im Assistenten (190-12).
		return { id, ordner, mappe };
	};

	const starte = (roh: { angaben: unknown; ordner: unknown }) => exklusiv(() => starteJetzt(roh));

	const verlange = async (id: string) => {
		const s = aktiv?.stand.id === id ? aktiv.stand : await lese(pruefeEinheitId(id));
		if (!s || s.status === 'verworfen') {
			throw new HttpFehler(404, 'Diese Einheit gibt es nicht mehr.');
		}
		return s;
	};

	/** Die Sitzung kennt Auftrag und Plan schon; ohne sie trägt der Prompt den Stand. */
	const sitzungVon = (s: EinheitStand) =>
		s.sitzung && existsSync(path.join(projekte(), projektName(arbeitDir(s.id)))) ? s.sitzung : null;

	const weiterJetzt = async (id: string) => {
		const s = await verlange(id);
		if (s.status !== 'unvollstaendig') {
			throw new HttpFehler(409, 'Diese Einheit ist nicht unterbrochen.');
		}
		if (!lebenderOrdner(kontext.ordner.baum(), s.ordner)) {
			throw new HttpFehler(409, 'Der Ordner der Einheit liegt im Papierkorb.');
		}
		s.korrigiert = false;
		// Ist der Plan noch nicht freigegeben, beginnt Schritt 1 neu. Stände von vor der Freigabe-Stufe bauen weiter.
		if (s.freigegeben === false) {
			await beginne(s, null, null, 'plan');
			return s;
		}
		// Jeder Schritt bekommt eine neue Sitzung; der erste offene beginnt (220).
		await beginne(s, null, null, 'bau');
		return s;
	};

	const weiter = (id: string) => exklusiv(() => weiterJetzt(id));

	const freigebenJetzt = async (id: string, aenderung: unknown) => {
		const s = await verlange(id);
		if (s.status !== 'plan') {
			throw new HttpFehler(409, 'Diese Einheit wartet nicht auf eine Freigabe.');
		}
		if (!lebenderOrdner(kontext.ordner.baum(), s.ordner)) {
			throw new HttpFehler(409, 'Der Ordner der Einheit liegt im Papierkorb.');
		}
		const wunsch = typeof aenderung === 'string' ? aenderung.trim() : '';
		if (wunsch.length > AENDERUNG_ZEICHEN) {
			throw new HttpFehler(400, 'Der Änderungswunsch ist zu lang.');
		}
		const sitzung = sitzungVon(s);
		const kopf = sitzung ? '' : `${KOPF(s)}\n\n`;
		if (wunsch) {
			await beginne(s, `${kopf}${PLAN_AENDERN(wunsch)}`, sitzung, 'plan');
			return s;
		}
		// Ab hier hält der Server den Plan (220): Claude schreibt einheit.json im Bau nicht mehr.
		s.freigegeben = true;
		await rm(freigabeDatei(s.id), { force: true });
		await halteFreigabe(s);
		if (s.plan) {
			s.plan.dokumente = s.plan.dokumente.map((d) => ({ ...d, fertig: false }));
			s.reihenfolge = bauReihenfolge(s.plan, s.bilder);
		}
		s.steckbriefe = {};
		s.bilderFertig = false;
		s.pruefung = {};
		delete s.schluss;
		await beginne(s, null, null, 'bau');
		return s;
	};

	/** Die Lehrkraft gibt den Plan frei, oder sie will ihn anders: dann zeigt Claude ihn neu. */
	const freigeben = (id: string, aenderung: unknown) => exklusiv(() => freigebenJetzt(id, aenderung));

	const abbrechen = async (id: string) => {
		const s = await verlange(id);
		if (aktiv?.stand.id !== s.id) {
			return s;
		}
		stoppe('Abgebrochen.');
		return s;
	};

	/**
	 * Ordner in den Papierkorb (F3), Lauf beenden. Der Stand bleibt bis zum Aufräumen, damit „Rückgängig“ Ordner und
	 * Stand zurückholt (190-30); die Antwort sagt, ob das geht.
	 */
	const verwirf = async (id: string) => {
		const s = await verlange(id);
		const vorher = { status: s.status, grund: s.grund };
		if (aktiv?.stand.id === s.id) {
			stoppe('Verworfen.');
			await new Promise<void>((resolve) => {
				const warte = setInterval(() => {
					if (aktiv?.stand.id !== s.id) {
						clearInterval(warte);
						resolve();
					}
				}, 200);
			});
		}
		const umkehr = await kontext.ordner.aendere(async (baum) => {
			if (!lebenderOrdner(baum, s.ordner)) {
				return { baum, ergebnis: [] as Aktion[] };
			}
			const u = await umgebung(materialDir);
			const r = wendeAktionAn(baum, { art: 'papierkorb', knoten: [{ ordner: s.ordner }] }, u);
			await wendeEffekteAn(kontext, r.effekte, u.jetzt);
			return { baum: r.baum, ergebnis: r.umkehr, loescht: r.loescht };
		});
		// Ein unterbrochener Lauf kommt als „unterbrochen“ zurück: Weiterbauen geht dann wie nach einem Abbruch.
		const zurueck =
			vorher.status === 'laeuft' ? { status: 'unvollstaendig' as const, grund: 'Verworfen.' } : vorher;
		verworfen.set(s.id, { ...zurueck, umkehr });
		s.status = 'verworfen';
		s.ende ??= new Date().toISOString();
		await merke(s);
		return { rueckgaengig: umkehr.length > 0 };
	};

	/** „Rückgängig“ nach dem Verwerfen: Ordner aus dem Papierkorb, Stand wie vorher (190-30). */
	const zurueckholen = async (id: string) => {
		const s = await lese(pruefeEinheitId(id));
		const alt = verworfen.get(id);
		if (!s || s.status !== 'verworfen' || !alt) {
			throw new HttpFehler(404, 'Diese Einheit lässt sich nicht mehr zurückholen.');
		}
		await kontext.ordner.aendere(async (baum) => {
			const u = await umgebung(materialDir);
			let neu = baum;
			for (const aktion of alt.umkehr) {
				const r = wendeAktionAn(neu, aktion, u);
				await wendeEffekteAn(kontext, r.effekte, u.jetzt);
				neu = r.baum;
			}
			return { baum: neu, ergebnis: null };
		});
		verworfen.delete(id);
		s.status = alt.status;
		s.grund = alt.grund;
		await merke(s);
		return s;
	};

	/** Das Band „… ist fertig“ schließen (190-42): Der Stand geht, der Ordner mit den Materialien bleibt. */
	const schliesse = async (id: string) => {
		const s = await verlange(id);
		if (s.status !== 'fertig') {
			throw new HttpFehler(409, 'Nur eine fertige Einheit lässt sich schließen.');
		}
		await loesche(s.id);
		melde(s);
	};

	/** Was ein Neustart hinterlässt: laufende werden unvollständig, alte Arbeitsordner gehen. */
	const raeumeAuf = async () => {
		for (const s of await alle()) {
			if (aktiv?.stand.id === s.id) {
				continue;
			}
			const alter = Date.now() - new Date(s.ende ?? s.start).getTime();
			if (s.status === 'fertig' || s.status === 'verworfen' || alter > KI_GRENZEN.einheit.aufhebenMs) {
				await loesche(s.id);
			} else if (s.status === 'laeuft') {
				s.status = 'unvollstaendig';
				s.grund = 'Der Server wurde neu gestartet.';
				s.ende = new Date().toISOString();
				if (s.recherche?.status === 'laeuft') {
					s.recherche = { status: 'gescheitert', grund: s.grund, quellen: [], text: null };
				}
				brichPruefungAb(s);
				await merke(s);
				if (existsSync(protokollDatei(s))) {
					await schreibeAtomar(
						protokollDatei(s),
						`${JSON.stringify(schliesseProtokoll(await leseProtokoll(s)), null, '\t')}\n`,
					).catch(() => undefined);
				}
			}
		}
	};

	/** Ein Prozess eines abgestürzten Servers läuft sonst weiter und verbraucht Limit. */
	const beendeReste = async () => {
		for (const name of await readdir(wurzel).catch(() => [] as string[])) {
			try {
				const pid = Number(readFileSync(path.join(wurzel, name, PID), 'utf8'));
				if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(wurzel)) {
					process.kill(pid, 'SIGTERM');
				}
			} catch {
				// Keine Datei oder kein Prozess.
			}
		}
		await raeumeAuf();
	};

	return {
		starte,
		weiter,
		freigeben,
		abbrechen,
		verwirf,
		zurueckholen,
		schliesse,
		beendeReste,
		/** Die Einheiten, die die Oberfläche zeigt: laufende und unterbrochene; fertige nur bis zum nächsten Aufräumen. */
		liste: async () => (await alle()).filter((s) => s.status !== 'verworfen'),
		stand: (id: string) => verlange(id),
		laeuft: () => aktiv?.stand ?? null,
		starteAufraeumen: () => {
			aufraeumTakt ??= setInterval(() => {
				raeumeAuf().catch((fehler: unknown) => console.error('Einheiten aufräumen:', fehler));
			}, 60 * 60_000);
			aufraeumTakt.unref();
		},
		/** Beim Beenden: Der Lauf endet, der Stand bleibt für „Weiterbauen“. */
		stop: () => {
			if (aufraeumTakt) {
				clearInterval(aufraeumTakt);
			}
			if (aktiv) {
				const s = aktiv.stand;
				aktiv.abbruch = true;
				aktiv.kind?.kill('SIGTERM');
				if (aktiv.takt) {
					clearInterval(aktiv.takt);
				}
				s.status = 'unvollstaendig';
				s.grund = 'Der Server wurde neu gestartet.';
				s.ende = new Date().toISOString();
				try {
					writeFileSync(path.join(dir(s.id), STAND), JSON.stringify(s));
					if (existsSync(protokollDatei(s))) {
						writeFileSync(
							protokollDatei(s),
							`${JSON.stringify(schliesseProtokoll(aktiv.protokoll), null, '\t')}\n`,
						);
					}
				} catch {
					// Beim Beenden zählt nur, dass der Prozess endet.
				}
				rmSync(path.join(dir(s.id), PID), { force: true });
			}
		},
	};
};

export type Einheiten = ReturnType<typeof erstelleEinheiten>;

/** Die Routen (139). Hängt am `apiRouter`: nur mit Sitzung, nie über Teilen-Links. */
export const einheitApi = (router: RouterTyp, kontext: Kontext) => {
	const { einheiten } = kontext;
	router.get('/einheiten', async (_req, res) => {
		res.json({ einheiten: await einheiten.liste(), laeuft: einheiten.laeuft()?.id ?? null });
	});
	router.post('/einheiten', async (req, res) => {
		const b = (req.body ?? {}) as { angaben?: unknown; ordner?: unknown };
		res.status(201).json(await einheiten.starte({ angaben: b.angaben, ordner: b.ordner }));
	});
	router.get('/einheiten/:id', async (req, res) => {
		res.json(await einheiten.stand(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/abbrechen', async (req, res) => {
		res.json(await einheiten.abbrechen(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/weiter', async (req, res) => {
		res.json(await einheiten.weiter(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/freigeben', async (req, res) => {
		const b = (req.body ?? {}) as { aenderung?: unknown };
		res.json(await einheiten.freigeben(pruefeEinheitId(req.params.id), b.aenderung));
	});
	router.post('/einheiten/:id/verwerfen', async (req, res) => {
		res.json({ ok: true, ...(await einheiten.verwirf(pruefeEinheitId(req.params.id))) });
	});
	router.post('/einheiten/:id/zurueckholen', async (req, res) => {
		res.json(await einheiten.zurueckholen(pruefeEinheitId(req.params.id)));
	});
	router.post('/einheiten/:id/schliessen', async (req, res) => {
		await einheiten.schliesse(pruefeEinheitId(req.params.id));
		res.json({ ok: true });
	});
};
