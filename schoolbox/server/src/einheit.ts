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
	AnsichtOptionen,
	BauVersuch,
	EinheitAngaben,
	EinheitBefund,
	EinheitPlan,
	EinheitStand,
	Fach,
	FachblickAuftrag,
	Format,
	FormateDerEinheit,
	LaufArt,
	LaufEintrag,
	LaufProtokoll,
	PlanDokument,
	PlanPunkt,
	PlanRechnung,
	PruefAuftrag,
	PruefBefund,
	Pruefbericht,
	PruefBild,
	PruefRolle,
	PruefStand,
	PruefTeil,
	SchlussStand,
} from '@schoolbox/kern';
import {
	abbildungenFehlen,
	ANSICHT_ORDNER,
	ART_NAME,
	aufgabenFuerBau,
	AUSZUG_DATEI,
	auszugAus,
	baueAnsichtAus,
	bauReihenfolge,
	bausteinVerstoesse,
	beendeLaufEintrag,
	befundZeile,
	berechneteElemente,
	bestandteileText,
	BILDER_SCHRITT,
	bilderMitBefund,
	bilderSatzIn,
	blickLektuere,
	blickRegeln,
	dokKnotenSchluessel,
	dokumentDir,
	dopplungTexte,
	dopplungUebersicht,
	druckprofilAusHtml,
	EINHEIT_PLAN,
	EINHEIT_THEMA,
	einheitAuftragAus,
	FACH_NAME,
	fachblickStunden,
	fachblickText,
	fachSkillDatei,
	fachSkillVon,
	fertigText,
	figurenDir,
	figurenDopplungen,
	folgeBefund,
	FOLGEN_FELD,
	folienNotizen,
	formatBefund,
	formateDesMaterials,
	freierName,
	istFolgekorrektur,
	klasseText,
	LAUF_DATEI,
	laufMeldungen,
	lebenderOrdner,
	lektuereFehltText,
	lektuereZeile,
	leseBibliothek,
	leseFolgen,
	leseMeta,
	lesePlan,
	lesePlanAntwort,
	lesePruefung,
	leseSteckbrief,
	mappenDir,
	nachAenderung,
	namenIn,
	neueFigurId,
	neueFunde,
	neueMappe,
	neuerLaufEintrag,
	neuesDokument,
	nimmPoseAuf,
	niveausImAuftrag,
	notiereLektuere,
	pflichtAbschnitt,
	pflichtFuer,
	PLAN_VORGABE_ART,
	planFuerBau,
	planPruefStand,
	planPruefText,
	planRueckrunde,
	posenQuellen,
	pruefeEinheitAngaben,
	pruefKorrektur,
	pruefpunkteText,
	pruefTeile,
	pruefText,
	pruefWeise,
	RECHERCHE_DATEI,
	rechercheAbschnitt,
	rechnePlan,
	rollenErgebnis,
	rolleVon,
	sammleRequisiten,
	satzBefund,
	SCHLUSS_SCHRITT,
	schreibeAtomar,
	STECKBRIEF_DATEI,
	themaBefund,
	uebernimmBilder,
	vorschauSeiten,
	wendeAktionAn,
	wendeBilderAn,
	WURZEL,
	zahlenBefunde,
	zahlenText,
} from '@schoolbox/kern';
import type { BildlistenEintrag } from '@schoolbox/kern/src/bildliste';
import {
	BILDLISTE_DATEI,
	bildlisteBefunde,
	bildlisteText,
	erstelleBildliste,
	leseBildQuellen,
} from '@schoolbox/kern/src/bildliste';
import {
	artAus,
	bibliotheksGrund,
	bibliotheksName,
	bildFigur,
	gegenstaendeInGrundpose,
	GRUNDPOSE,
	kopieGrund,
	leseHerkunft,
	ohneGegenstaende,
	posenDatei,
	posenFuerLauf,
	posenText,
	requisitDatei,
	requisitenFuer,
	requisitenText,
	steckbriefAus,
	textWerte,
	VERMERK_GEGENSTAND,
} from '@schoolbox/kern/src/einheit-bibliothek';
import {
	bibliothekFuerPlan,
	bibliotheksId,
	leitfigurIds,
	lesePlanFiguren,
	referenzFiguren,
} from '@schoolbox/kern/src/einheit-figuren';
import {
	bilderKanonText,
	fuehreKanonNach,
	kanonKapitel,
	kanonRueckrunde,
	kanonText,
	planKanonMeldungen,
	pruefeBildVertrag,
	pruefKanon,
	widerspruchBefunde,
	widerspruchText,
} from '@schoolbox/kern/src/einheit-kanon';
import type { BibliotheksFigur } from '@schoolbox/kern/src/figuren';
import { EINGEBAUTE } from '@schoolbox/kern/src/figuren';
import type { Router as RouterTyp } from 'express';

import type { BildVertrag } from './bild-datei';
import { leseBildVertraege } from './bild-datei';
import { materialKennung, uebertrageHerkunft } from './bild-herkunft';
import type { BildWerkzeugStand } from './bild-werkzeug';
import { BILD_HERKUNFT, REFERENZ_ORDNER } from './bild-werkzeug';
import type { LaufBilder } from './bild-zugang';
import {
	BILDER_AUS,
	BILDER_GESPERRT,
	bilderStand,
	erstelleLaufBilder,
	grundposeReferenz,
	posenPfad,
} from './bild-zugang';
import { schreibeQuelle } from './dokumente';
import { HttpFehler } from './fehler';
import type { Ergebnis, KiCacheTtl, KiPruefer, LaufStand, PruefErgebnis } from './ki';
import {
	beendeKind,
	EINHEIT_PLAN_RECHTE,
	einheitBauRechte,
	FACHBLICK_AUFTRAG,
	KI_GRENZEN,
	kiArgumente,
	kiPfad,
	kiUmgebung,
	legeAblageAn,
	legeFremdeLoesungenAb,
	lesePids,
	merkeKind,
	PLAN_PRUEF_AUFTRAG,
	PRUEF_AUFTRAG,
	pruefeLauf,
	rechercheStand,
	recherchiere,
	richtePruefOrdnerEin,
	trennePruefOrdner,
	VERBRAUCH_DATEI,
	werteAus,
} from './ki';
import type { KiLauf } from './ki-einstellung';
import { KI_EINSTELLUNG_STANDARD, kiLaufJetzt, waehleLauf } from './ki-einstellung';
import type { Bauen, Werkzeug } from './ki-werkzeug';
import { ansichtText, starteWerkzeug } from './ki-werkzeug';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';
import type { MitschriftZiel } from './mitschrift';
import { schreibeMitschrift } from './mitschrift';
import { umgebung, wendeEffekteAn } from './ordner';

const ID = /^[a-f0-9]{12}$/;
const STAND = 'stand.json';
const PID = 'pid';
const TAKT_MS = 2000;
/** So viele Grundposen kommen höchstens als Referenz in einen Lauf; mehr Figuren nennt kein Plan. */
const MAX_REFERENZ_FIGUREN = 8;
/** So viele Kennungen geprüfter Bilder behält der Stand (248); die ältesten fallen heraus. */
const MAX_GEPRUEFTE_BILDER = 400;
/** So viele Hinweise zu Bildern, die nicht gelungen sind (248), behält der Stand. */
const MAX_BILD_HINWEISE = 40;

/** Geladen ist eine Datei einmal, auch wenn der Lauf sie mehrmals erzeugt oder bearbeitet hat (237). */
const verschiedeneBilder = (bilder: LaufBilder) => new Set(bilder.stand().bilder).size;

const MAX_PLAN_BYTES = 256 * 1024;
const SEITENBILD = /^seite-(\d+)\.png$/;
const LOESUNGSBILD = /^loesung-seite-\d+\.png$/;
/** Mit `v-`, Seitenzahl und Endung bleibt der Name unter den 60 Zeichen, die ein Bild der Mappe haben darf. */
const VORSCHAU_SLUG = 44;

/**
 * Einheit zum Verkauf: Das Deckblatt zeigt echte Seiten der Materialien (`html-materialerstellung/references/verkauf.md`).
 * Dafür liegen die Seitenbilder jedes Baus als Bilder der Mappe im Arbeitsordner; in die Schoolbox kommt nur, was das
 * Deckblatt nennt. Welche Seiten, wählt der Server (`vorschauSeiten`, 250): nur Kinderseiten ohne eingetragene Lösung.
 * Bilder eines früheren Baus bleiben liegen, weil ein schon gebautes Deckblatt sie nennen kann.
 */
const legeVorschauAb = async (
	arbeit: string,
	d: Pick<PlanDokument, 'slug' | 'art'>,
	html: string,
	bilder: string[],
) => {
	const seiten = bilder.map((b) => SEITENBILD.exec(b)).filter((t): t is RegExpExecArray => t !== null);
	const kurz = d.slug.slice(0, VORSCHAU_SLUG).replace(/-+$/, '');
	const ablage = path.join(arbeit, 'bilder');
	const nummern = seiten.map((t) => Number(t[1]));
	const erlaubt = new Set(vorschauSeiten(d, html, nummern));
	const gewaehlt = seiten.filter((t) => erlaubt.has(Number(t[1])));
	if (gewaehlt.length === 0) {
		return null;
	}
	await mkdir(ablage, { recursive: true });
	for (const t of gewaehlt) {
		await copyFile(path.join(arbeit, ANSICHT_ORDNER, d.slug, t[0]), path.join(ablage, `v-${kurz}-${t[1]}.png`));
	}
	return `Seitenbilder für das Deckblatt (nur Kinderseiten ohne Lösung): ${gewaehlt.map((t) => `../../bilder/v-${kurz}-${t[1]}.png`).join(', ')}.`;
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
	/** Ohne: Die CLI wählt die Dauer des Prompt-Caches (265). */
	cacheTtl?: KiCacheTtl;
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
	/** Mit Bildwerkzeugen (237: `bild_erzeugen`/`bild_bearbeiten`), sofern ein Schlüssel da ist. */
	mitBildern: boolean;
	/** Das Werkzeug `bauen`; `null`: kein MCP-Werkzeug der Schoolbox. */
	bauen: Bauen | null;
	grenzen: LaufGrenzen;
	pflicht: string[];
	/** Was die Sitzung schon gelesen hat: Die Korrekturrunde setzt die des Baulaufs fort. */
	gelesen?: Set<string>;
}

/** Baut eine Fassung wie `blatt.py bauen`; Tests setzen eine ohne Browser ein. */
export type EinheitAnsicht = (quelle: string, ziel: string, optionen?: AnsichtOptionen) => Promise<Ansicht>;

/** Inhalt einer Datei als Hash; eine fehlende Datei zählt als leer. */
const dateiHash = async (datei: string) =>
	createHash('sha256')
		.update(await readFile(datei).catch(() => Buffer.alloc(0)))
		.digest('hex');

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

const PLAN = (s: EinheitStand, bibliothek: string) =>
	['Schritt 1: der Plan.', KOPF(s), bibliothek].filter(Boolean).join('\n\n');

const PLAN_AENDERN = (wunsch: string) =>
	`Schritt 1, Änderung. Die Lehrkraft hat den Plan gelesen und möchte ihn anders: „${wunsch}“\nArbeite das ein, schreibe einheit.json neu und antworte mit dem ganzen Plan. Baue noch nichts.`;

export const erstelleEinheiten = (
	kontext: Kontext,
	pruefer: KiPruefer,
	baueAnsicht: EinheitAnsicht = (quelle, ziel, optionen) => baueAnsichtAus(kontext.konfig, quelle, ziel, optionen),
) => {
	const { materialDir } = kontext.konfig;
	const wurzel = einheitenWurzel(materialDir);
	const bin = kiPfad(kontext.konfig);
	const projekte = () => path.join(homedir(), '.claude', 'projects');
	const projektName = (arbeit: string) => arbeit.replace(/[^a-zA-Z0-9]/g, '-');

	const dir = (id: string) => path.join(wurzel, `einheit-${id}`);
	const arbeitDir = (id: string) => path.join(dir(id), 'arbeit');
	const auszugDatei = (s: EinheitStand, slug: string) => path.join(arbeitDir(s.id), 'dokumente', slug, AUSZUG_DATEI);
	const ablageDir = (id: string) => path.join(dir(id), 'ablage');
	/** Jeder Lauf der Einheit wird mitgeschrieben (233). */
	const mitschrift = (s: EinheitStand, art: string, dok: string | null): MitschriftZiel => ({
		materialDir,
		mappe: s.mappe,
		dok,
		art: `einheit-${art}`,
	});

	/** Der freigegebene Plan, wie er in `einheit.json` stand (220): Vor jedem Baulauf legt der Server ihn zurück. */
	const freigabeDatei = (id: string) => path.join(dir(id), FREIGABE);
	const planAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit.md');
	const materialAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-material.md');
	const schlussAuftrag = path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-schluss.md');

	let aktiv: {
		stand: EinheitStand;
		stufe: Stufe;
		/** Die laufenden Claude-Prozesse; im Prüfen zwei zugleich, Kinderaugen und Fachblick (244). */
		kinder: Set<ChildProcessWithoutNullStreams>;
		abbruch: boolean;
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
		/**
		 * Was laufende Prüfläufe höchstens noch verbrauchen dürfen (244): Laufen zwei gleichzeitig, zählt der zweite das
		 * Budget des ersten schon mit, damit beide zusammen nie über die Grenze des Durchgangs gehen.
		 */
		reserviert: { kostenUsd: number; runden: number };
		/** Modell und Gründlichkeit, beim Start der Handlung gelesen (232): Alle Läufe des Durchgangs nehmen sie. */
		ki: KiLauf;
		/** Die Bildwerkzeuge des laufenden Laufs (237) und die Zahl der Bilder vor ihm, für den Stand der Einheit. */
		bilder: { werkzeug: LaufBilder; vorher: number } | null;
		/** Die Bild-API hat in diesem Durchgang gesperrt: Kein Lauf bekommt mehr Bildwerkzeuge, die Einheit hält an. */
		bilderGesperrt: boolean;
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

	const kiJetzt = () => aktiv?.ki ?? waehleLauf(KI_EINSTELLUNG_STANDARD, kontext.konfig, 'gross');

	const melde = (s: EinheitStand) => {
		kontext.ereignisse.sende({ typ: 'einheit-stand', daten: { id: s.id, ordner: s.ordner } });
	};

	const merke = async (s: EinheitStand) => {
		await schreibeAtomar(path.join(dir(s.id), STAND), JSON.stringify(s));
		melde(s);
	};

	const lese = async (id: string): Promise<EinheitStand | null> => {
		try {
			const stand = JSON.parse(await readFile(path.join(dir(id), STAND), 'utf8')) as EinheitStand & {
				canvaPause?: unknown;
			};
			// `canvaPause` (235) steht noch in alten Ständen; seit 237 gibt es keine Pause mehr.
			delete stand.canvaPause;
			// Vor 242 war jede Figur im Plan ein Text; sie gilt als `neu`.
			if (stand.plan?.figuren) {
				stand.plan.figuren = lesePlanFiguren(stand.plan.figuren);
			}
			return stand;
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
			...aktiv?.ki,
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

	/**
	 * Der Auszug eines übernommenen Materials (252): Spätere Läufe lesen ihn statt des HTML. Aus der Fassung im
	 * Arbeitsordner, mit den Bildnamen dort. Ein Fehler kostet nur den Auszug, nicht die Übernahme.
	 */
	const schreibeAuszug = async (s: EinheitStand, d: PlanDokument, roh: string) => {
		try {
			await schreibeAtomar(auszugDatei(s, d.slug), auszugAus(roh, d.titel));
		} catch (fehler) {
			console.error('Auszug:', (fehler as Error).message);
		}
	};

	const importiere = async (s: EinheitStand, d: PlanDokument) => {
		const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
		if (!existsSync(datei) || (await stat(datei)).size > KI_GRENZEN.materialBytes) {
			befund(s, d.slug, null, ['Die Quelle fehlt oder ist zu groß.']);
			return;
		}
		const roh = await readFile(datei, 'utf8');
		const bilder = [...new Set([...roh.matchAll(BILD_IM_DOKUMENT)].map((t) => `bilder/${t[1]}`))].filter((b) =>
			existsSync(path.join(arbeitDir(s.id), b)),
		);
		const k = await materialKennung(roh, arbeitDir(s.id), bilder);
		if (s.importiert[d.slug]?.kennung === k) {
			if (!existsSync(auszugDatei(s, d.slug))) {
				await schreibeAuszug(s, d, roh);
			}
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
		const umbenannt = await uebernimmBilder(arbeitDir(s.id), mappeDir, bilder);
		await uebertrageHerkunft(
			path.join(arbeitDir(s.id), 'bilder'),
			path.join(mappeDir, 'bilder'),
			Object.fromEntries(bilder.map((b) => [path.basename(b), path.basename(umbenannt[b] ?? b)])),
		);
		const html = wendeBilderAn(roh, umbenannt);
		const dok = await dokumentFuer(s, d);
		await kontext.sperre(dokSchluessel(s.mappe, dok), () =>
			schreibeQuelle(kontext, s.mappe, dok, html, { urheber: 'claude', zusammenfassen: false }),
		);
		s.importiert[d.slug] = { dok, kennung: k };
		await schreibeAuszug(s, d, roh);
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
			for (const kind of aktiv.kinder) {
				beendeKind(kind);
			}
		}
	};

	/** Ein Abgleich im Takt: Bilder zählen, im Plan-Schritt den Plan lesen, das Thema übernehmen. */
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
		if (a.bilder) {
			s.geladeneBilder = a.bilder.vorher + verschiedeneBilder(a.bilder.werkzeug);
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

	/**
	 * Was noch nicht gelesen ist: Pflichtlektüre und die Dateien des Katalogs zu den Elementen in `html` (226). Der Strom
	 * kann dem Aufruf von `bauen` knapp nachlaufen: dann einmal kurz warten.
	 */
	const fehlendeLektuere = async (html: string, pflicht?: string[]) => {
		const offen = () => {
			const lauf = aktiv?.lauf;
			return lauf
				? {
						pflicht: (pflicht ?? lauf.pflicht).filter((p) => !lauf.gelesen.has(p)),
						teile: abbildungenFehlen(html, lauf.gelesen),
					}
				: { pflicht: [], teile: [] };
		};
		const jetzt = offen();
		if (!jetzt.pflicht.length && !jetzt.teile.length) {
			return jetzt;
		}
		await new Promise((r) => setTimeout(r, LEKTUERE_WARTEN_MS));
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
			const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
			const lesbar = existsSync(datei) && (await stat(datei)).size <= KI_GRENZEN.materialBytes;
			const html = lesbar ? await readFile(datei, 'utf8') : '';
			const offen = await fehlendeLektuere(html, slug === null ? lektuereFuer(s, rolleVon(d)) : undefined);
			versuch.fehlend = [...new Set([...offen.pflicht, ...offen.teile.map((t) => t.datei)])];
			if (versuch.fehlend.length) {
				await schreibeProtokoll();
				return { text: lektuereFehltText(offen.pflicht, offen.teile), fehler: true };
			}
			if (!lesbar) {
				return { text: `dokumente/${d.slug}/material.html fehlt oder ist zu groß.`, fehler: true };
			}
			const roh = html;
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
			const vorschau = s.verkauf ? await legeVorschauAb(arbeitDir(s.id), d, roh, ansicht.bilder) : null;
			const auftrag = bausteinVerstoesse(roh, s.bausteine ?? {}).map((t) => `FEHLER: ${t}`);
			return {
				text: [
					ansichtText(ansicht, `${ANSICHT_ORDNER}/${d.slug}`, laufMeldungen(roh, d.art)),
					...auftrag,
					vorschau,
				]
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

	/** Fertig ist der Schlusslauf auch, wenn er an seiner eigenen Grenze gescheitert ist: Die Materialien sind da. */
	const schlussErledigt = (s: EinheitStand) => s.schluss?.status === 'fertig' || s.schluss?.status === 'gescheitert';

	const schlussReserve = (ueber: boolean) =>
		ueber ? KI_GRENZEN.einheit.schluss.reserveGuthabenUsd : KI_GRENZEN.einheit.schluss.reserveUsd;

	/**
	 * Was dem Durchgang an Budget bleibt. Steht im Bau der Schlusslauf noch aus, hält jeder andere Lauf dessen Reserve
	 * zurück (262): Ohne Schluss blieben die Befunde der letzten Prüfrunde offen.
	 */
	const restUsd = (fuerSchluss: boolean, ueber = ueberGuthaben()) => {
		const e = KI_GRENZEN.einheit;
		const verbraucht = (aktiv?.verbraucht.kostenUsd ?? 0) + (aktiv?.reserviert.kostenUsd ?? 0);
		const reserve =
			!fuerSchluss && aktiv?.stufe === 'bau' && !schlussErledigt(aktiv.stand) ? schlussReserve(ueber) : 0;
		return (ueber ? e.budgetGuthabenUsd : e.budgetUsd) - verbraucht - reserve;
	};

	/** Die Grenzen eines Laufs: seine eigenen, höchstens was dem Durchgang noch bleibt. */
	const grenzenFuer = (g: LaufGrenzen) => {
		const e = KI_GRENZEN.einheit;
		const ueber = ueberGuthaben();
		const seit = aktiv?.seit ?? Date.now();
		const verbraucht = aktiv?.verbraucht ?? { kostenUsd: 0, runden: 0 };
		const reserviert = aktiv?.reserviert ?? { kostenUsd: 0, runden: 0 };
		return {
			zeitMs: Math.min(g.zeitMs, seit + e.zeitMs - Date.now()),
			runden: Math.min(g.runden, e.runden - verbraucht.runden - reserviert.runden),
			budgetUsd: Math.min(ueber ? g.budgetGuthabenUsd : g.budgetUsd, restUsd(g === e.schluss, ueber)),
			...(g.cacheTtl ? { cacheTtl: g.cacheTtl } : {}),
		};
	};

	const ZEIT_EINHEIT = 'Die Zeit für die Einheit ist abgelaufen.';
	const ZEIT_LAUF = 'Die Zeit für dieses Material ist abgelaufen.';

	const FEHLER_TEXT: Record<string, string> = {
		rate_limit: 'Das Limit des Claude-Kontos ist erreicht.',
		error_max_turns: 'Die Einheit hat die Zahl der Schritte ausgeschöpft.',
		error_max_budget_usd: 'Das Budget der Einheit ist aufgebraucht.',
	};
	const fehlerText = (fehler: string | null | undefined) => (fehler ? (FEHLER_TEXT[fehler] ?? fehler) : null);

	/** Nach diesen Fehlern eines Materials geht der Durchgang mit dem nächsten weiter; nach allen anderen endet er. */
	const WEITER_NACH = new Set(['error_max_turns', 'error_max_budget_usd', ZEIT_LAUF]);

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
	/**
	 * Mit Bildwerkzeugen nennt der Text die Grundposen. Ohne verspricht der Auftrag keine neuen Bilder: im Lauf, der sie
	 * bräuchte, und in jedem Lauf, wenn der Schlüssel fehlt (die Einheit begann mit ihm, der Server läuft nach einem
	 * Neustart ohne).
	 */
	const laufText = (o: LaufOptionen, bilder: LaufBilder | null) => {
		if (bilder) {
			const text = bilderSatzIn(o.text, true);
			return bilder.referenzen.length ? `${text}\n\n${referenzZeile(bilder)}` : text;
		}
		const keineBilder = o.mitBildern || !bilderStand(kontext.konfig).verfuegbar;
		return bilderSatzIn(o.text, !keineBilder);
	};

	/**
	 * Ehrlich, wenn ein Bild nicht gelingt (248): Lehnt das Bildwerkzeug nach zwei neuen Bildern einen weiteren Versuch
	 * ab, oder trägt Claude `offen` mit `bild_pruefung` ein (252), steht ein Hinweis im Stand. Ein Bild, das der Lauf
	 * danach doch gespeichert hat und das kein `offen` mehr trägt, verliert ihn.
	 */
	const merkeBildHinweise = async (s: EinheitStand, st: BildWerkzeugStand, von: string) => {
		const vertraege = await leseBildVertraege(arbeitDir(s.id));
		const offen = new Map(vertraege.flatMap((v) => (v.offen ? [[v.datei, v.offen] as const] : [])));
		for (const o of st.offen) {
			offen.set(o.datei, offen.get(o.datei) ?? o.befund);
		}
		const neu = new Set(st.bilder.map((b) => path.basename(b)));
		const bleibt = (s.bildHinweise ?? []).filter((h) => !offen.has(h.datei) && !neu.has(h.datei));
		const hinweise = [
			...bleibt,
			...[...offen].map(([datei, text]) => ({ datei, text: `${text.replace(/[.\s]+$/, '')}.`, von })),
		].slice(-MAX_BILD_HINWEISE);
		if (hinweise.length || s.bildHinweise) {
			s.bildHinweise = hinweise;
		}
	};

	const einLauf = async (s: EinheitStand, o: LaufOptionen): Promise<Ergebnis> => {
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
		const bilder = o.mitBildern && !aktiv.bilderGesperrt ? await bilderFuerLauf(s) : null;
		const werkzeug =
			o.bauen || bilder
				? await starteWerkzeug(dir(s.id), o.bauen, o.bauen ? 'einheit' : 'bilder', { bilder }).catch(
						(fehler: unknown) => {
							console.error('Werkzeug der Einheit:', fehler);
							return null;
						},
					)
				: null;
		const bildWerkzeugBereit = bilder !== null && werkzeug !== null;
		const bilderVorher = s.geladeneBilder;
		if (bildWerkzeugBereit && aktiv) {
			aktiv.bilder = { werkzeug: bilder, vorher: bilderVorher };
		}
		const text = laufText(o, bildWerkzeugBereit ? bilder : null);
		let ergebnis = leer;
		try {
			ergebnis = await laufMit(
				s,
				{ ...o, text },
				grenzen,
				werkzeug,
				bildWerkzeugBereit ? bilder : null,
				(name, eingabe) => notiereGelesen(lauf, name, eingabe),
			);
		} finally {
			await werkzeug?.ende();
			if (bildWerkzeugBereit) {
				const st = bilder.stand();
				// Gesetzt, nicht addiert: Der Takt (`gleicheAb`) hat den Stand womöglich schon geschrieben.
				s.geladeneBilder = bilderVorher + verschiedeneBilder(bilder);
				s.fehlgeschlageneBilder += Math.max(0, st.aufrufe - st.bilder.length);
				ergebnis = {
					...ergebnis,
					bilder: { gesperrt: st.gesperrt, aufrufe: st.aufrufe, kostenUsd: st.kostenUsd },
				};
				if (aktiv) {
					aktiv.bilder = null;
					aktiv.bilderGesperrt ||= st.gesperrt;
				}
				await merkeBildHinweise(s, st, o.material ?? BILDER_SCHRITT).catch((fehler: unknown) => {
					console.error('Hinweise zu Bildern:', fehler);
				});
			}
			beendeEintrag(eintrag, beginn, ergebnis.fehler, ergebnis.verbrauch);
			if (aktiv?.lauf === lauf) {
				aktiv.lauf = null;
			}
			await schreibeProtokoll();
		}
		await notiereVerbrauch(s, verbrauchStatus(ergebnis.fehler, o.art), beginn, {
			...ergebnis.verbrauch,
			lauf: o.art,
			...(ergebnis.bilder
				? { bildAufrufe: ergebnis.bilder.aufrufe, bildKostenUsd: ergebnis.bilder.kostenUsd }
				: {}),
		});
		return ergebnis;
	};

	const bibliothek = () => leseBibliothek(kontext.konfig, materialDir).catch(() => [...EINGEBAUTE]);

	/**
	 * 253: Die Figuren der Bibliothek in dieser Einheit: die Leitfigur, die Figuren des Plans mit `bibliothek:<id>` und
	 * die, die der Bilderlauf dieser Einheit in die Bibliothek gebracht hat.
	 */
	const figurenDerEinheit = async (s: EinheitStand) => {
		const eigene = (s.bibliothekNeu ?? []).filter((n) => n.figur).map((n) => n.id);
		return referenzFiguren(s.plan?.figuren ?? [], [...(s.leitfigur ?? []), ...eigene], await bibliothek());
	};

	/**
	 * Die Figuren einer Einheit, deren Grundpose als Referenz in den Arbeitsordner kommt (237): die Leitfigur aus der
	 * Bibliothek und die Figuren des Plans mit `bibliothek:<id>` (242), mit PNG- oder JPEG-Grundpose. Kein Name aus
	 * dem Auftrag zählt.
	 */
	const bildFiguren = async (s: EinheitStand) => {
		const genannt = (await figurenDerEinheit(s)).slice(0, MAX_REFERENZ_FIGUREN);
		const referenzen = await Promise.all(genannt.map((f) => grundposeReferenz(materialDir, f)));
		return referenzen.flatMap((r, i) => (r ? [{ ...r, figur: genannt[i]?.name ?? r.name }] : []));
	};

	/** Die Namen, unter denen der Plan oder ein Bildvertrag eine Figur der Bibliothek nennt. */
	const namenDer = (s: EinheitStand, f: BibliotheksFigur) => [
		f.name,
		...(s.plan?.figuren ?? []).filter((p) => bibliotheksId(p) === f.id).map((p) => p.name),
		...(s.bibliothekNeu ?? []).filter((n) => n.id === f.id).map((n) => n.plan),
	];

	const bibliotheksGrundIn = (s: EinheitStand, figuren: readonly BibliotheksFigur[], v: BildVertrag) =>
		bibliotheksGrund(
			figuren.map((figur) => ({ figur, namen: namenDer(s, figur) })),
			v,
			REFERENZ_ORDNER,
			(s.plan?.figuren ?? []).map((p) => p.name),
		);

	/**
	 * 253: Legt die Posen der Figuren aus der Bibliothek in `bilder/` des Arbeitsordners (was dort liegt, bleibt) und
	 * liefert die Zeilen, mit denen ein Lauf sie einbindet.
	 */
	const legePosenBereit = async (s: EinheitStand) => {
		const ziel = path.join(arbeitDir(s.id), 'bilder');
		const figuren: BibliotheksFigur[] = [];
		for (const f of await figurenDerEinheit(s)) {
			const posen = [];
			for (const p of posenFuerLauf(f)) {
				const datei = path.join(ziel, posenDatei(p));
				const da =
					existsSync(datei) ||
					(await mkdir(ziel, { recursive: true })
						.then(() => copyFile(posenPfad(materialDir, p.schluessel), datei))
						.then(
							() => true,
							() => false,
						));
				if (da) {
					posen.push(p);
				}
			}
			if (posen.length) {
				figuren.push({ ...f, posen });
			}
		}
		return posenText(figuren, '../../bilder/');
	};

	/** 253: Passende Requisiten früherer Einheiten für den Bilderlauf, als Kopie in `bilder/`. */
	const legeRequisitenBereit = async (s: EinheitStand, plan: EinheitPlan) => {
		const ziel = path.join(arbeitDir(s.id), 'bilder');
		// Nur Textwerte: Titel, die Geschichte und die Gegenstände des Kanons, keine Feldnamen aus dem Plan.
		const auftrag = [
			s.titel,
			...(plan.dokumente ?? []).map((d) => d.titel),
			...textWerte(plan.geschichte),
			...(plan.kanon?.dinge ?? []).map((d) => d.name),
		].join(' ');
		const kandidaten = await sammleRequisiten(kontext.konfig, materialDir, s.mappe).catch(() => []);
		const liste = [];
		for (const r of requisitenFuer(kandidaten, auftrag)) {
			const datei = path.join(ziel, requisitDatei(r));
			if (existsSync(datei)) {
				continue;
			}
			await mkdir(ziel, { recursive: true });
			if (
				await copyFile(r.pfad, datei).then(
					() => true,
					() => false,
				)
			) {
				liste.push(r);
			}
		}
		return requisitenText(liste, '../../bilder/');
	};

	/**
	 * 253: Nach dem Bilderlauf kommt jede abgenommene Grundpose einer neuen Figur des Plans in die Mappe und in die
	 * Bibliothek, auch wenn noch kein Material sie zeigt. Abgenommen: der letzte Versuch hakt ab, nichts ist `offen`.
	 */
	const uebernimmGrundposen = async (s: EinheitStand, plan: EinheitPlan) => {
		const arbeit = arbeitDir(s.id);
		const bilderDir = path.join(arbeit, 'bilder');
		const herkunft = leseHerkunft(await readFile(path.join(bilderDir, BILD_HERKUNFT), 'utf8').catch(() => ''));
		const namen = (plan.figuren ?? []).map((f) => f.name).filter(Boolean);
		const mappeDir = mappenDir(materialDir, s.mappe);
		const vertraege = await leseBildVertraege(arbeit);
		const szenen = vertraege.filter((v) => !bildFigur(v, namen)).map((v) => v.motiv);
		for (const v of vertraege) {
			const bf = bildFigur(v, namen);
			const figur = plan.figuren?.find(
				(f) => f.name && bf?.figur.toLocaleLowerCase('de') === f.name.toLocaleLowerCase('de'),
			);
			const schon = (s.bibliothekNeu ?? []).some((n) => n.figur && n.plan === figur?.name);
			if (
				bf?.pose !== GRUNDPOSE ||
				!figur ||
				bibliotheksId(figur) ||
				schon ||
				!v.geprueft ||
				v.offen ||
				herkunft.get(v.datei)?.art === 'offen' ||
				!existsSync(path.join(bilderDir, v.datei))
			) {
				continue;
			}
			try {
				const bild = `bilder/${v.datei}`;
				const umbenannt = await uebernimmBilder(arbeit, mappeDir, [bild]);
				const inMappe = path.basename(umbenannt[bild] ?? bild);
				await uebertrageHerkunft(bilderDir, path.join(mappeDir, 'bilder'), { [v.datei]: inMappe });
				const bestand = await bibliothek();
				const dateien = await readdir(figurenDir(materialDir)).catch(() => [] as string[]);
				const id = neueFigurId(figur.name, [
					...bestand.map((f) => f.id),
					...dateien.map((d) => path.parse(d).name),
				]);
				const kanon = plan.kanon?.figuren.find(
					(k) => k.name.toLocaleLowerCase('de') === figur.name.toLocaleLowerCase('de'),
				);
				// Ohne Kanon prüft niemand, ob die Grundpose einen Gegenstand der Handlung trägt (248): wie die einmalige Übernahme.
				const gegenstaende = kanon ? [] : gegenstaendeInGrundpose(v.motiv, figur.name, szenen, namen);
				const steckbrief = ohneGegenstaende(steckbriefAus(kanon, figur.aussehen), gegenstaende);
				const name = bibliotheksName(figur.name, artAus(figur.aussehen, figur.name), s.titel, bestand);
				await nimmPoseAuf(kontext.konfig, materialDir, {
					datei: path.join(mappeDir, 'bilder', inMappe),
					figur: id,
					name,
					herkunft: path
						.relative(materialDir, path.join(mappeDir, 'bilder', inMappe))
						.split(path.sep)
						.join('/'),
					...(steckbrief ? { steckbrief } : {}),
					aus: s.titel,
					...(gegenstaende.length ? { vermerk: VERMERK_GEGENSTAND } : {}),
				});
				s.bibliothekNeu = [...(s.bibliothekNeu ?? []), { id, name, plan: figur.name, figur: true, posen: [] }];
			} catch (fehler) {
				console.error('Grundpose in die Bibliothek:', (fehler as Error).message);
			}
		}
	};

	/** 253: Die Bilder, die die fertigen Materialien der Einheit in der Mappe einbinden, das jüngste Material zuerst. */
	const eingebundeneBilder = async (s: EinheitStand) => {
		const mappeDir = mappenDir(materialDir, s.mappe);
		const genannt: { datei: string; zeit: number }[] = [];
		for (const { dok } of Object.values(s.importiert)) {
			const html = path.join(dokumentDir(materialDir, s.mappe, dok), 'material.html');
			const zeit = (await stat(html).catch(() => null))?.mtimeMs ?? 0;
			for (const t of (await readFile(html, 'utf8').catch(() => '')).matchAll(BILD_IM_DOKUMENT)) {
				genannt.push({ datei: path.join(mappeDir, 'bilder', t[1] ?? ''), zeit });
			}
		}
		return genannt.sort((a, b) => b.zeit - a.zeit);
	};

	/**
	 * 253: Je Figur der Bibliothek und Wort einer Pose, die sie noch nicht hat, die Inhalte der Fassungen, die der Lauf
	 * abgenommen hat (Schlüssel `<id>\t<wort>`).
	 */
	const abgenommenePosen = async (
		s: EinheitStand,
		figuren: readonly BibliotheksFigur[],
		namen: readonly string[],
	) => {
		const arbeit = arbeitDir(s.id);
		const bilderDir = path.join(arbeit, 'bilder');
		const herkunft = leseHerkunft(await readFile(path.join(bilderDir, BILD_HERKUNFT), 'utf8').catch(() => ''));
		const je = new Map<string, Set<string>>();
		for (const v of await leseBildVertraege(arbeit)) {
			const bf = bildFigur(v, namen);
			const gleich = (n: string) => n.toLocaleLowerCase('de') === bf?.figur.toLocaleLowerCase('de');
			const f = bf ? figuren.find((x) => namenDer(s, x).some(gleich)) : undefined;
			const datei = path.join(bilderDir, v.datei);
			const abgenommen = v.geprueft && !v.offen && herkunft.get(v.datei)?.art !== 'offen' && existsSync(datei);
			if (
				!bf ||
				!f ||
				bf.pose === GRUNDPOSE ||
				!abgenommen ||
				f.posen.some((p) => p.id === `${f.id}-${bf.pose}`)
			) {
				continue;
			}
			const schluessel = `${f.id}\t${bf.pose}`;
			je.set(schluessel, new Set([...(je.get(schluessel) ?? []), await dateiHash(datei)]));
		}
		return je;
	};

	/** 253: Merkt im Stand, welche Pose die Einheit einer Figur der Bibliothek gegeben hat, für den Satz im Band. */
	const merkePose = (s: EinheitStand, f: BibliotheksFigur | undefined, id: string, wort: string) => {
		const liste = s.bibliothekNeu ?? [];
		const eintrag = liste.find((n) => n.id === id);
		s.bibliothekNeu = eintrag
			? liste.map((n) => (n === eintrag ? { ...n, posen: [...n.posen, wort] } : n))
			: [...liste, { id, name: f?.name ?? id, plan: f?.name ?? id, figur: false, posen: [wort] }];
	};

	/**
	 * 253: Am Ende der Einheit kommen die neuen Posen der Figuren aus der Bibliothek dazu: je Figur und Pose genau die
	 * Fassung, die das jüngste Material der Mappe einbindet und die der Lauf abgenommen hat. Varianten, die kein
	 * Material nennt, und Posen, die die Figur schon hat, kommen nicht.
	 */
	const uebernimmPosen = async (s: EinheitStand) => {
		const plan = s.plan;
		if (!plan) {
			return;
		}
		const figuren = await figurenDerEinheit(s);
		const namen = [...(plan.figuren ?? []).map((f) => f.name), ...figuren.flatMap((f) => namenDer(s, f))];
		const genannt = await eingebundeneBilder(s);
		for (const [schluessel, inhalte] of await abgenommenePosen(s, figuren, namen.filter(Boolean))) {
			const [id = '', wort = ''] = schluessel.split('\t');
			let fassung: string | null = null;
			for (const g of genannt) {
				if (existsSync(g.datei) && inhalte.has(await dateiHash(g.datei))) {
					fassung = g.datei;
					break;
				}
			}
			if (!fassung) {
				continue;
			}
			try {
				await nimmPoseAuf(kontext.konfig, materialDir, {
					datei: fassung,
					figur: id,
					wort,
					herkunft: path.relative(materialDir, fassung).split(path.sep).join('/'),
				});
				merkePose(
					s,
					figuren.find((x) => x.id === id),
					id,
					wort,
				);
			} catch (fehler) {
				console.error('Pose in die Bibliothek:', (fehler as Error).message);
			}
		}
	};

	/** Je Bildwerkzeug: welche Datei in `referenzen/` zu welcher Figur gehört. */
	const referenzNamen = new WeakMap<LaufBilder, Map<string, string>>();

	/** Die Bildwerkzeuge eines Laufs; `null` ohne Schlüssel. Ein Fehler beim Anlegen lässt den Lauf ohne Bilder. */
	const bilderFuerLauf = async (s: EinheitStand): Promise<LaufBilder | null> => {
		try {
			const figuren = await bildFiguren(s);
			const imLauf = await figurenDerEinheit(s);
			const bilder = await erstelleLaufBilder({
				arbeit: arbeitDir(s.id),
				art: 'einheit',
				konfig: kontext.konfig,
				api: kontext.bildApi,
				figuren: figuren.map(({ datei, name }) => ({ name, datei })),
				pruefeVertrag: (v: BildVertrag) =>
					kopieGrund(v) ??
					bibliotheksGrundIn(s, imLauf, v) ??
					(s.plan?.kanon ? pruefeBildVertrag(s.plan, v) : null),
				vertragWerkzeuge: true,
			});
			if (bilder) {
				referenzNamen.set(bilder, new Map(figuren.map((f) => [f.pfad, f.figur])));
			}
			return bilder;
		} catch (fehler) {
			console.error('Bildwerkzeug der Einheit:', fehler);
			return null;
		}
	};
	/** Die Zeile für den Auftrag: welche Grundpose unter welchem Namen in `referenzen/` liegt. */
	const referenzZeile = (bilder: LaufBilder) => {
		const namen = referenzNamen.get(bilder);
		return `Grundposen der Figuren als Referenz: ${bilder.referenzen
			.map((r) => `${r}${namen?.get(r) ? ` (${namen.get(r)})` : ''}`)
			.join(', ')}.`;
	};

	const laufMit = (
		s: EinheitStand,
		o: LaufOptionen,
		grenzen: { zeitMs: number; runden: number; budgetUsd: number },
		mcp: Werkzeug | null,
		bilder: LaufBilder | null,
		werkzeug: (name: string, eingabe: Record<string, unknown>) => void,
	) =>
		new Promise<Ergebnis>((resolve) => {
			const stand: LaufStand = { sitzung: o.sitzung, fehlerCode: null, ergebnis: {} };
			const argumente = kiArgumente({
				ablage: ablageDir(s.id),
				auftragDatei: o.auftragDatei,
				budgetUsd: Math.round(grenzen.budgetUsd * 100) / 100,
				...kiJetzt(),
				sitzung: o.sitzung,
				einheit: true,
				mcpDatei: mcp?.mcpDatei ?? null,
				mcpWerkzeuge: mcp?.werkzeuge,
				runden: grenzen.runden,
				rechte: o.rechte,
				...(o.werkzeuge ? { werkzeuge: o.werkzeuge } : {}),
			});
			const kind = spawn(bin, argumente, { cwd: arbeitDir(s.id), env: kiUmgebung(bin, o.grenzen.cacheTtl) });
			schreibeMitschrift(mitschrift(s, o.art, o.material), kind, {
				argumente,
				auftrag: o.text,
				cwd: arbeitDir(s.id),
				bilder: bilder?.stand,
				cacheTtl: o.grenzen.cacheTtl,
			});
			if (aktiv) {
				merkeKind(aktiv.kinder, kind, path.join(dir(s.id), PID), aktiv.abbruch);
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
					const e = JSON.parse(zeile) as Record<string, unknown>;
					werteAus(e, stand, { schritt: () => undefined, limit: () => undefined, werkzeug });
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

	/** Ein Lauf der Einheit (seit 237 ohne die Pausen aus 235: Die Bild-API hat kein Kontingent, auf das man wartet). */
	const starteLauf = (s: EinheitStand, o: LaufOptionen): Promise<Ergebnis> => einLauf(s, o);

	/** Sperrte die Bild-API (237): ein eigener Fehler, nicht in `WEITER_NACH`; die Einheit hält an. */
	const bilderGesperrtText = (s: EinheitStand, schritt: string) => {
		const titel = s.plan?.dokumente.find((d) => d.slug === schritt)?.titel;
		return schritt === BILDER_SCHRITT || !titel
			? `${BILDER_GESPERRT} ‚Weiterbauen‘ macht bei den Bildern weiter.`
			: `${BILDER_GESPERRT} „${titel}“ ist mit Platzhaltern gebaut; ‚Weiterbauen‘ macht danach weiter.`;
	};

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
			...kiJetzt(),
			ordner: path.join(dir(s.id), 'recherche'),
			ablage: ablageDir(s.id),
			anfrage: s.rechercheAnfrage,
			guthaben: ueberGuthaben(),
			schritt: (text) => {
				if (s.recherche?.status === 'laeuft') {
					s.recherche.schritt = text;
					void merke(s).catch(() => undefined);
				}
			},
			gestartet: (kind) => {
				if (aktiv) {
					merkeKind(aktiv.kinder, kind, path.join(dir(s.id), PID), aktiv.abbruch);
				}
			},
			abgebrochen: () => aktiv?.abbruch === true,
			werkzeug: (name, eingabe) => notiereGelesen(lauf, name, eingabe),
			mitschrift: mitschrift(s, 'recherche', null),
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
		mitBildern: false,
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
	 * Der Prüflauf des Plans (247): frischer Kontext, nur Read, im eigenen Ordner mit Kopien von Plan und Recherche.
	 * Er meldet Befunde im Format der Materialprüfung; scheitert er, steht der Grund in `fehler`, und der Plan geht
	 * trotzdem an die Lehrkraft.
	 */
	const pruefePlan = async (
		s: EinheitStand,
		rechnung: PlanRechnung,
	): Promise<{ befunde: PruefBefund[]; fehler: string | null }> => {
		const halt = erschoepft(grenzenFuer(KI_GRENZEN.einheit.planPruefung));
		if (!aktiv || aktiv.abbruch || halt) {
			return { befunde: [], fehler: aktiv?.abbruch ? 'Abgebrochen.' : (fehlerText(halt) ?? 'Abgebrochen.') };
		}
		const ordner = path.join(dir(s.id), 'pruefung-plan');
		const ablage = ablageDir(s.id);
		const skill = (name: string) => path.join(ablage, '.claude', 'skills', name, 'SKILL.md');
		const fachSkill = fachSkillVon(fach(s));
		const lektuere = [...(fachSkill ? [`${fachSkill}/SKILL.md`] : []), 'unterrichtsplanung/SKILL.md'];
		const eintrag: LaufEintrag = {
			...neuerEintrag('pruefung', null, blickLektuere(lektuere)),
			hinweis: 'Plan-Prüfung.',
		};
		const lauf = { eintrag, gelesen: new Set<string>() };
		const beginn = Date.now();
		aktiv.protokoll.laeufe.push(eintrag);
		await schreibeProtokoll();
		try {
			await rm(ordner, { recursive: true, force: true });
			await mkdir(ordner, { recursive: true });
			await copyFile(path.join(arbeitDir(s.id), EINHEIT_PLAN), path.join(ordner, EINHEIT_PLAN));
			const recherche = path.join(arbeitDir(s.id), RECHERCHE_DATEI);
			const mitRecherche = s.recherche?.status === 'fertig' && existsSync(recherche);
			if (mitRecherche) {
				await copyFile(recherche, path.join(ordner, RECHERCHE_DATEI));
			}
			const text = planPruefText({
				titel: s.plan?.titel ?? s.titel,
				klasse: klasseText(s.rechercheAnfrage?.klasse),
				fach: FACH_NAME[fach(s)],
				auftrag: s.auftrag,
				plan: EINHEIT_PLAN,
				recherche: mitRecherche ? RECHERCHE_DATEI : null,
				skills: lektuere.map((r) => skill(r.slice(0, -'/SKILL.md'.length))),
				rechnung: rechnung.befunde,
				ausgelassen: rechnung.ausgelassen,
			});
			const ergebnis = await pruefeLauf({
				bin,
				...kiJetzt(),
				ordner,
				ablage,
				text,
				grenzen: grenzenFuer(KI_GRENZEN.einheit.planPruefung),
				auftragDatei: PLAN_PRUEF_AUFTRAG,
				rolle: 'fach',
				vorgabe: PLAN_VORGABE_ART,
				gestartet: (k) => {
					if (aktiv) {
						merkeKind(aktiv.kinder, k, path.join(dir(s.id), PID), aktiv.abbruch);
					}
				},
				werkzeug: (name, eingabe) => notiereGelesen(lauf, name, eingabe),
				mitschrift: mitschrift(s, 'plan-pruefung', null),
			});
			const unlesbar = ergebnis.lesbar
				? null
				: 'Die Antwort der Plan-Prüfung hatte keinen lesbaren Block mit Befunden.';
			const fehler = aktiv?.abbruch ? 'Abgebrochen.' : (fehlerText(ergebnis.fehler) ?? unlesbar);
			eintrag.befunde = ergebnis.befunde.map(befundZeile);
			if (unlesbar && !ergebnis.fehler) {
				eintrag.hinweis = `Plan-Prüfung. ${unlesbar}`;
			}
			beendeEintrag(eintrag, beginn, fehler, ergebnis.verbrauch);
			await schreibeProtokoll();
			await notiereVerbrauch(s, fehler ? 'unvollstaendig' : 'fertig', beginn, {
				...ergebnis.verbrauch,
				lauf: 'plan-pruefung',
			});
			return { befunde: fehler ? [] : ergebnis.befunde, fehler };
		} catch (fehler) {
			console.error('Plan-Prüfung der Einheit:', (fehler as Error).message);
			const grund = 'Die Plan-Prüfung ließ sich nicht starten.';
			if (eintrag.ergebnis === 'laeuft') {
				beendeEintrag(eintrag, beginn, grund, {});
				await schreibeProtokoll();
			}
			return { befunde: [], fehler: grund };
		} finally {
			await rm(ordner, { recursive: true, force: true });
		}
	};

	/**
	 * Die eine Rückrunde an den Planlauf (247, davor 221): Rechnung und Befunde der Plan-Prüfung zusammen, `--resume` in
	 * derselben Sitzung. Scheitert sie, bleibt die Antwort des ersten Laufs der Plan.
	 */
	const rueckrunde = async (s: EinheitStand, ergebnis: Ergebnis, punkte: readonly PlanPunkt[]) => {
		const erste = ergebnis.antwort;
		s.planSchritt = 'rueckrunde';
		await merke(s);
		const zweite = await starteLauf(s, planLauf(s, planRueckrunde(punkte), s.sitzung));
		s.sitzung = zweite.sitzung ?? s.sitzung;
		await abgleich();
		const gelesen = lesePlanAntwort(zweite.antwort);
		const lief = !zweite.fehler && aktiv?.abbruch !== true;
		return {
			ergebnis: aktiv?.abbruch
				? zweite
				: { ...zweite, fehler: null, antwort: lief && gelesen.text.trim() ? gelesen.text : erste },
			geprueft: lief ? gelesen.geprueft : new Map<number, { behoben: boolean; wie: string }>(),
			lief,
		};
	};

	/** Was am Kanon in `einheit.json` zu lang ist (263); `lesePlan` hat es für `s.plan` schon gekürzt. */
	const kanonZuLang = () => {
		try {
			return planKanonMeldungen(JSON.parse(aktiv?.letzterPlan || 'null'));
		} catch {
			return [];
		}
	};

	/**
	 * Die kurze zweite Runde (263), wenn nach der Rückrunde noch Einträge des Kanons zu lang sind: nur die Meldungen, die
	 * Antwort ist kein Plan. Bleibt danach etwas zu lang, gilt der gekürzte Plan, und die Meldung steht in `planBefunde`.
	 */
	const kanonRunde = async (s: EinheitStand, meldungen: readonly string[]) => {
		s.planSchritt = 'rueckrunde';
		await merke(s);
		const lauf = await starteLauf(s, planLauf(s, kanonRueckrunde(meldungen), s.sitzung));
		s.sitzung = lauf.sitzung ?? s.sitzung;
		await abgleich();
	};

	/**
	 * Schritt 1: Claude schreibt nur den Plan. Danach wartet die Einheit auf die Freigabe der Lehrkraft. Ohne `text` ist
	 * es ein neuer Plan: erst die Recherche, dann der Plan mit ihr, dann die Plan-Prüfung (247) und eine Rückrunde mit
	 * allem, was Rechnung und Prüfung fanden. Mit `text` („Ändern …“) läuft nur die Rechnung neu, nicht die Prüfung:
	 * Ihre Befunde von davor bleiben stehen (`nachAenderung`).
	 */
	const plane = async (s: EinheitStand, text: string | null, sitzung: string | null) => {
		const takt = setInterval(() => void abgleich(), TAKT_MS);
		if (aktiv) {
			aktiv.takt = takt;
		}
		let ergebnis: Ergebnis;
		try {
			if (text === null) {
				delete s.planPruefung;
				await recherchiereEinheit(s);
			}
			ergebnis = await starteLauf(
				s,
				planLauf(s, text ?? PLAN(s, bibliothekFuerPlan(await bibliothek())), sitzung),
			);
			s.sitzung = ergebnis.sitzung ?? s.sitzung;
			await abgleich();
			const rechne = (): PlanRechnung => {
				const r = s.plan
					? rechnePlan(s.plan, { klasse: s.rechercheAnfrage?.klasse, niveaus: niveausImAuftrag(s.auftrag) })
					: { befunde: [], ausgelassen: [] };
				return { ...r, befunde: [...r.befunde, ...kanonZuLang()] };
			};
			const erste = rechne();
			const vorher = erste.befunde;
			const weiter = () => !ergebnis.fehler && !aktiv?.abbruch && Boolean(s.plan?.dokumente.length);
			let pruefung: { befunde: PruefBefund[]; fehler: string | null } | null = null;
			if (text === null && weiter()) {
				s.planSchritt = 'pruefung';
				await merke(s);
				pruefung = await pruefePlan(s, erste);
			}
			const punkte: PlanPunkt[] = [
				...vorher.map((t): PlanPunkt => ({ von: 'rechnung', text: t })),
				...(pruefung?.befunde ?? []).map((b): PlanPunkt => ({ von: 'pruefung', befund: b })),
			];
			let runde: Awaited<ReturnType<typeof rueckrunde>> | null = null;
			if (weiter() && punkte.length && s.sitzung) {
				runde = await rueckrunde(s, ergebnis, punkte);
				ergebnis = runde.ergebnis;
				const kanon = kanonZuLang();
				if (runde.lief && kanon.length && weiter()) {
					await kanonRunde(s, kanon);
				}
			}
			const nachher = rechne().befunde;
			s.planBefunde = nachher;
			if (pruefung && !aktiv?.abbruch) {
				s.planPruefung = planPruefStand({
					vorher: punkte,
					nachher,
					geprueft: runde?.geprueft ?? new Map(),
					pruefung,
					rueckrunde: runde?.lief === true,
				});
			} else if (text !== null) {
				s.planPruefung = nachAenderung(s.planPruefung, {
					vorher,
					nachher,
					rueckrunde: runde?.lief === true,
					geprueft: runde?.geprueft,
				});
			}
		} finally {
			clearInterval(takt);
			delete s.planSchritt;
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
		return mitBildern ? 'Bilder der Einheit: noch keine.' : '';
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
		const posen = await legePosenBereit(s);
		const requisiten = rolle === 'bilder' && s.plan ? await legeRequisitenBereit(s, s.plan) : '';
		return [
			bilderAbsatz(zeilen, s.bilder),
			posen,
			requisiten,
			rolle === 'bilder'
				? bilderKanonText(
						s.plan?.kanon,
						(s.plan?.geschichte?.kapitel ?? []).map((k) => k.nr),
					)
				: '',
			vorschau.length
				? `Seitenbilder der fertigen Materialien für die Vorschau: ${vorschau.map((n) => `../../bilder/${n}`).join(', ')}`
				: '',
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const fertigeMaterialien = (s: EinheitStand) =>
		(s.plan?.dokumente ?? []).filter((d) => s.importiert[d.slug]).map((d) => d.slug);

	/** Ein fertiges Material von vor 252 hat noch keinen Auszug: Der Server legt ihn vor dem nächsten Lauf an. */
	const sichereAuszuege = async (s: EinheitStand) => {
		for (const d of s.plan?.dokumente ?? []) {
			const datei = path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html');
			if (s.importiert[d.slug] && !existsSync(auszugDatei(s, d.slug)) && existsSync(datei)) {
				await schreibeAuszug(s, d, await readFile(datei, 'utf8'));
			}
		}
	};

	const materialHtml = async (s: EinheitStand, slug: string) => {
		const datei = path.join(arbeitDir(s.id), 'dokumente', slug, 'material.html');
		try {
			return (await stat(datei)).size > KI_GRENZEN.materialBytes ? null : await readFile(datei, 'utf8');
		} catch {
			return null;
		}
	};

	/** 271: Quellen und Angebot schreiben die Herkunft der Bilder aus der Bildliste; nur sie gleicht der Server ab. */
	const VERKAUF_ROLLEN = new Set(['quellen', 'angebot']);

	/** 271: Jedes Bild, das die übrigen Materialien verwenden, mit Art und Quelle. */
	const bildliste = async (s: EinheitStand, plan: EinheitPlan): Promise<BildlistenEintrag[]> => {
		const bilderDir = path.join(arbeitDir(s.id), 'bilder');
		const dateien = new Set(await readdir(bilderDir).catch(() => [] as string[]));
		const dokumente = [];
		for (const d of plan.dokumente.filter((x) => !VERKAUF_ROLLEN.has(rolleVon(x)))) {
			const html = await materialHtml(s, d.slug);
			if (html) {
				dokumente.push({ slug: d.slug, html });
			}
		}
		const requisiten = [...dateien].some((n) => n.startsWith('req-'))
			? new Map(
					(await sammleRequisiten(kontext.konfig, materialDir, s.mappe).catch(() => [])).map((r) => [
						requisitDatei(r),
						{ mappe: r.mappe, quelle: r.quelle },
					]),
				)
			: undefined;
		return erstelleBildliste(dokumente, {
			herkunft: await leseBildQuellen(bilderDir),
			posen: await posenQuellen(materialDir).catch(() => new Map()),
			...(requisiten ? { requisiten } : {}),
			dateien,
		});
	};

	const bildlisteMarker = (s: EinheitStand) => path.join(arbeitDir(s.id), BILDLISTE_DATEI);

	/** Die Slugs, deren Bau die Bildliste bekommen hat. Ein älteres Quellenblatt kennt sie nicht und bleibt ohne Abgleich. */
	const mitBildliste = async (s: EinheitStand): Promise<string[]> => {
		try {
			const daten = JSON.parse(await readFile(bildlisteMarker(s), 'utf8')) as { slugs?: unknown };
			return Array.isArray(daten.slugs) ? daten.slugs.filter((x): x is string => typeof x === 'string') : [];
		} catch {
			return [];
		}
	};

	/** Der Absatz für den Bau von Quellen und Angebot; merkt den Slug für den Abgleich. */
	const bildlisteFuerBau = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument) => {
		if (!VERKAUF_ROLLEN.has(rolleVon(d))) {
			return '';
		}
		const slugs = await mitBildliste(s);
		if (!slugs.includes(d.slug)) {
			await writeFile(bildlisteMarker(s), `${JSON.stringify({ slugs: [...slugs, d.slug] })}\n`);
		}
		return bildlisteText(await bildliste(s, plan));
	};

	/** 271: Der Abgleich von Quellen oder Angebot mit der Bildliste, nur für ein Material, dessen Bau sie bekam. */
	const bildlisteBefundeFuer = async (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		liste?: readonly BildlistenEintrag[],
	) => {
		if (!VERKAUF_ROLLEN.has(rolleVon(d)) || !(await mitBildliste(s)).includes(d.slug)) {
			return [];
		}
		const html = await materialHtml(s, d.slug);
		return html
			? bildlisteBefunde(liste ?? (await bildliste(s, plan)), html, {
					titel: d.titel,
					quellen: rolleVon(d) === 'quellen',
				})
			: [];
	};

	const MATERIAL = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument, pflicht: string[], thema: boolean) => {
		await sichereAuszuege(s);
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
			planFuerBau(plan),
			kanonText(plan.kanon, { ...kanonKapitel(plan, d), nachtrag: s.kanonNachtrag }),
			aufgabenFuerBau(plan, d.slug),
			fertigText(plan, fertigeMaterialien(s), s.steckbriefe ?? {}),
			await bilderText(s, rolleVon(d)),
			await bildlisteFuerBau(s, plan, d),
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const BILDER = async (s: EinheitStand, plan: EinheitPlan, pflicht: string[]) =>
		[
			'Schritt 2: die Bilder der Einheit. Baue in diesem Lauf kein Material.',
			pflichtAbschnitt(pflicht, 'bevor du das erste Bild erzeugst'),
			KOPF(s),
			planFuerBau(plan),
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
	const steckbriefDatei = (s: EinheitStand, slug: string) =>
		path.join(arbeitDir(s.id), 'dokumente', slug, STECKBRIEF_DATEI);

	const leseSteckbriefRoh = async (s: EinheitStand, slug: string): Promise<unknown> => {
		const datei = steckbriefDatei(s, slug);
		try {
			return (await stat(datei)).size <= MAX_STECKBRIEF_BYTES ? JSON.parse(await readFile(datei, 'utf8')) : null;
		} catch {
			// Kein Steckbrief: Seiten und Formate reichen.
			return null;
		}
	};

	const notiereSteckbrief = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument) => {
		if (!s.importiert[d.slug]) {
			return;
		}
		const roh = await leseSteckbriefRoh(s, d.slug);
		const seiten = aktiv?.seiten.get(d.slug) || aktiv?.gebaut.get(d.slug) || 0;
		const loesungsseiten = aktiv?.loesungen.get(d.slug) ?? s.steckbriefe?.[d.slug]?.loesungsseiten;
		// 246: nur Ergänzungen in den Kanon des Stands; ein Material baut nach dem anderen, `merke` schreibt den Stand.
		const kanon = fuehreKanonNach(plan, s.kanonNachtrag ?? [], d.slug, roh);
		if (plan.kanon) {
			s.kanonNachtrag = kanon.nachtrag;
		}
		s.steckbriefe = {
			...s.steckbriefe,
			[d.slug]: {
				seiten,
				...(loesungsseiten === undefined ? {} : { loesungsseiten }),
				formate: formateDesMaterials(plan, d.slug),
				...leseSteckbrief(roh),
				...(kanon.widerspruch.length ? { widerspruch: kanon.widerspruch } : {}),
			},
		};
	};

	/**
	 * Was eine Korrekturrunde unter `folgen` in `steckbrief.json` nennt (243): andere fertige Materialien mit derselben
	 * Aussage, als offener Befund für den Schlusslauf. Das Feld nimmt der Server danach heraus, damit eine spätere Runde
	 * es nicht noch einmal meldet.
	 */
	const notiereFolgen = async (s: EinheitStand, plan: EinheitPlan, d: PlanDokument) => {
		const roh = await leseSteckbriefRoh(s, d.slug);
		if (typeof roh !== 'object' || roh === null || !(FOLGEN_FELD in roh)) {
			return;
		}
		const fertig = plan.dokumente.filter((x) => s.importiert[x.slug]).map((x) => x.slug);
		for (const f of leseFolgen(roh, fertig, d.slug)) {
			const alt = s.befunde.find((b) => b.slug === f.material);
			const text = folgeBefund(d.slug, d.titel, f.aussage);
			if (!alt?.texte.includes(text)) {
				befund(s, f.material, alt?.dok ?? s.importiert[f.material]?.dok ?? null, [...(alt?.texte ?? []), text]);
			}
		}
		const rest = Object.fromEntries(Object.entries(roh).filter(([k]) => k !== FOLGEN_FELD));
		await writeFile(steckbriefDatei(s, d.slug), `${JSON.stringify(rest)}\n`).catch(() => undefined);
	};

	// ── Prüfen nach dem Bau (220, Teil 2) ──

	const titelVon = (s: EinheitStand) => (slug: string) =>
		s.plan?.dokumente.find((d) => d.slug === slug)?.titel ?? slug;

	/** Das Format jedes übernommenen Materials aus seiner `meta.json`, für die Zählung von Seiten und Folien (241). */
	const formateDerEinheit = async (s: EinheitStand): Promise<FormateDerEinheit> => {
		const formate: Record<string, Format> = {};
		for (const [slug, { dok }] of Object.entries(s.importiert)) {
			try {
				formate[slug] = (await leseMeta(materialDir, s.mappe, dok)).format;
			} catch {
				// Ohne meta.json gilt das Format des Plans.
			}
		}
		return formate;
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

	/** Hat das Material neue KI-Bilder? Dann prüft der zweite Blick sie gegen ihren Vertrag. */
	const mitKiBildern = async (s: EinheitStand, html: string) => {
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

	/** Fertige Materialien, deren Lösungsseiten der Fachblick der Hinweise bekommt: ohne Rahmen und ohne die Hinweise. */
	const OHNE_FREMDE_LOESUNG = new Set(['deckblatt', 'quellen', 'angebot', 'hinweise', 'bilder']);

	/** Die Lektüre eines Prüflaufs: beim Fachblick der Fach-Skill, wenn er ihn liest, sonst die Regeln des Blicks. */
	const pruefPflicht = (pruefRolle: PruefRolle, fachSkill: string | null, regeln: readonly string[]) => {
		if (pruefRolle === 'kind') {
			return blickLektuere(regeln);
		}
		return fachSkill ? blickLektuere([fachSkill]) : [];
	};

	/** Die Lösungsseiten der anderen fertigen Materialien für den Fachblick der Hinweise (244). */
	const fremdeLoesungen = (s: EinheitStand, plan: EinheitPlan, d: PlanDokument, fachOrdner: string) =>
		legeFremdeLoesungenAb(
			fachOrdner,
			plan.dokumente
				.filter((x) => x.slug !== d.slug && s.importiert[x.slug] && !OHNE_FREMDE_LOESUNG.has(rolleVon(x)))
				.map((x) => ({
					slug: x.slug,
					titel: x.titel,
					quelle: path.join(arbeitDir(s.id), ANSICHT_ORDNER, x.slug),
				})),
		);

	interface PruefAuftraege {
		kind: { text: string; teil?: PruefTeil }[];
		fach: { text: string; teil?: PruefTeil }[];
		/** Die KI-Bilder im Auftrag mit Kinderaugen, mit Kennung (248). */
		bilder: PruefBild[];
	}

	/**
	 * Baut die Seiten in den Prüfordner, trennt den Ordner des Fachblicks ab und schreibt die Aufträge beider Rollen,
	 * je Teil einen (241). Wirft, wenn sich die Seiten nicht bauen ließen.
	 */
	const pruefAuftraege = async (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		o: { mitKind: boolean; kind: boolean; bilder: boolean; fach: boolean },
		html: string,
		ordner: string,
	): Promise<PruefAuftraege> => {
		const fachOrdner = `${ordner}-fach`;
		const ablage = ablageDir(s.id);
		const pruefpunkte = pruefpunkteText(s.recherche?.text, plan.berichtigungen);
		const fachSkill = fachSkillDatei(fach(s), pruefpunkte);
		const kanon = pruefKanon(plan, d, s.kanonNachtrag);
		const ansicht = await baueAnsicht(path.join(arbeitDir(s.id), 'dokumente', d.slug, 'material.html'), ordner, {
			sw: false,
		});
		const teile = await richtePruefOrdnerEin(
			ordner,
			ansicht.bilder,
			html,
			arbeitDir(s.id),
			o.kind || o.fach,
			new Set(s.bilderGeprueft ?? []),
		);
		const kopf = {
			titel: d.titel,
			artName: ART_NAME[d.art],
			klasse: klasseText(s.rechercheAnfrage?.klasse),
			fach: FACH_NAME[fach(s)],
		};
		const kind = o.mitKind
			? pruefTeile<PruefAuftrag>({
					...kopf,
					...teile,
					loesungen: o.kind ? teile.loesungen : [],
					formate: formateDerReihe(s, plan, d.slug),
					kind: o.kind,
					regeln: blickRegeln(rolleVon(d), o.bilder).map((r) => path.join(ablage, '.claude', 'skills', r)),
					auftrag: s.auftrag,
					figuren: plan.figuren ?? [],
					...kanon.kind,
					felder: ansicht.bericht.felder,
				}).map((a) => ({ text: pruefText(a), teil: a.teil }))
			: [];
		const bilder = o.mitKind && o.bilder ? teile.bilder : [];
		if (!o.fach) {
			return { kind, fach: [], bilder };
		}
		await trennePruefOrdner(ordner, fachOrdner, o.kind);
		const andere = rolleVon(d) === 'hinweise' ? await fremdeLoesungen(s, plan, d, fachOrdner) : [];
		const fachLaeufe = pruefTeile<FachblickAuftrag>({
			...kopf,
			seiten: teile.seiten,
			ausschnitte: teile.ausschnitte,
			loesungen: teile.loesungen,
			auftrag: s.auftrag,
			pruefpunkte,
			fachSkill: fachSkill ? path.join(ablage, '.claude', 'skills', fachSkill) : null,
			ziele: s.rechercheAnfrage?.ziele ?? [],
			stunden: fachblickStunden(plan, d.slug),
			berechnet: berechneteElemente(html),
			andere,
			notizen: folienNotizen(html),
			...kanon.fach,
		}).map((a) => ({ text: fachblickText(a), teil: a.teil }));
		return { kind, fach: fachLaeufe, bilder };
	};

	/**
	 * Einmal gründlich, dann nur Geändertes (248): Ein Bild, das der Lauf mit Kinderaugen in Vierteln geprüft hat, ohne
	 * dass ein Befund es nennt, gilt mit seiner Kennung (Inhalt und Vertrag) als geprüft. Nennt ein Befund es, auch einer
	 * des Fachblicks, fällt es heraus. Nur nach einem vollständigen Lauf mit Kinderaugen.
	 */
	const merkeGepruefteBilder = (s: EinheitStand, bilder: readonly PruefBild[], befunde: readonly PruefBefund[]) => {
		const mitBefund = new Set(bilderMitBefund(bilder, befunde).map((b) => b.kennung));
		const inVierteln = (b: PruefBild) => b.pruefbilder.some((p) => /-v[1-4]\.png$/.test(p));
		const neu = bilder.filter((b) => b.kennung && !b.geprueft && inVierteln(b) && !mitBefund.has(b.kennung));
		const bleibt = (s.bilderGeprueft ?? []).filter((k) => !mitBefund.has(k));
		s.bilderGeprueft = [...new Set([...bleibt, ...neu.flatMap((b) => (b.kennung ? [b.kennung] : []))])].slice(
			-MAX_GEPRUEFTE_BILDER,
		);
	};

	/**
	 * Die Prüfläufe für ein Material: neue Sitzungen, nur Read, frisch gebaute Seiten in einem eigenen Ordner. Der Lauf
	 * mit Kinderaugen (mit dem zweiten Blick, `mitKind`) und der Fachblick (`fach`, 244) laufen gleichzeitig, der
	 * Fachblick in einer Kopie des Ordners (`pruefung-fach`, `trennePruefOrdner`) mit den Lösungsseiten unter `loesung/`.
	 * Im Ordner mit Kinderaugen liegen sie nur bei Rollen mit Kind, das sie erst nach dem Lösen ansieht. Den Bau,
	 * die Quelle und den Plan sehen sie nicht; Klasse, Fach, den Auftrag der Lehrkraft, die Figuren, die Formate der Reihe
	 * und dem Fachblick die Prüfpunkte, die Stunden und die berechneten Elemente nennt die Nachricht. Ein langes Material
	 * prüfen je Rolle getrennte Läufe nacheinander (`pruefTeile`, 241), jeder mit eigenem Eintrag im Protokoll und eigener
	 * Zählung der Kosten; die Befunde kommen zusammen. Jede Rolle zählt für sich (`rollenErgebnis`): Gescheitert ist die
	 * Prüfung nur, wenn alle Rollen scheitern; scheitert eine, steht es in `luecke`. Die Ordner löscht der Server erst,
	 * wenn beide Rollen fertig sind; Abbruch beendet beide (`stoppe`).
	 */
	const pruefeMaterial = async (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		o: { mitKind: boolean; kind: boolean; bilder: boolean; fach: boolean },
	): Promise<{ befunde: PruefBefund[]; lesbar: boolean; fehler: string | null; luecke: string | null }> => {
		const ordner = path.join(dir(s.id), 'pruefung');
		const fachOrdner = `${ordner}-fach`;
		const html = (await materialHtml(s, d.slug)) ?? '';
		const gescheitert = (grund: string) => ({
			befunde: [] as PruefBefund[],
			lesbar: true,
			fehler: grund as string | null,
			luecke: null,
		});
		if (!html || sperreVon(html).length) {
			return gescheitert('Das Material ließ sich nicht prüfen: Die Sperre des Servers greift.');
		}
		const halt = erschoepft(grenzenFuer(KI_GRENZEN.einheit.pruefung));
		if (!aktiv || aktiv.abbruch || halt) {
			return gescheitert(fehlerText(halt) ?? 'Abgebrochen.');
		}
		await rm(ordner, { recursive: true, force: true });
		await mkdir(ordner, { recursive: true });
		const regeln = blickRegeln(rolleVon(d), o.bilder);
		const ablage = ablageDir(s.id);
		const fachSkill = fachSkillDatei(fach(s), pruefpunkteText(s.recherche?.text, plan.berichtigungen));
		/** Ein Lauf über einen Teil; ohne `text` nur der Eintrag für eine Ansicht, die sich nicht bauen ließ. */
		const einTeil = async (pruefRolle: PruefRolle, text: string | null, teil: PruefTeil | undefined) => {
			const pflicht = pruefPflicht(pruefRolle, fachSkill, regeln);
			const eintrag: LaufEintrag = { ...neuerEintrag('pruefung', d.slug, pflicht), rolle: pruefRolle };
			const lauf = { eintrag, gelesen: new Set<string>() };
			const beginn = Date.now();
			// Mit der Reserve des anderen, gleichzeitigen Laufs; ist nichts mehr übrig, startet dieser nicht.
			const grenzen = grenzenFuer(KI_GRENZEN.einheit.pruefung);
			const zuEnde = erschoepft(grenzen);
			aktiv?.protokoll.laeufe.push(eintrag);
			if (zuEnde) {
				beendeEintrag(eintrag, beginn, fehlerText(zuEnde), {});
				await schreibeProtokoll();
				return { ...gescheitert(fehlerText(zuEnde) ?? 'Abgebrochen.'), verbrauch: {} };
			}
			// Der andere Prüflauf dieses Materials läuft womöglich gleichzeitig: seine Grenzen sind bis zum Ende vergeben.
			const vergeben = { kostenUsd: Math.max(0, grenzen.budgetUsd), runden: Math.max(0, grenzen.runden) };
			if (aktiv) {
				aktiv.reserviert.kostenUsd += vergeben.kostenUsd;
				aktiv.reserviert.runden += vergeben.runden;
			}
			await schreibeProtokoll();
			const ergebnis: PruefErgebnis = await (
				text
					? pruefeLauf({
							bin,
							...kiJetzt(),
							ordner: pruefRolle === 'fach' ? fachOrdner : ordner,
							ablage,
							text,
							grenzen,
							auftragDatei: pruefRolle === 'fach' ? FACHBLICK_AUFTRAG : PRUEF_AUFTRAG,
							rolle: pruefRolle,
							gestartet: (k) => {
								if (aktiv) {
									merkeKind(aktiv.kinder, k, path.join(dir(s.id), PID), aktiv.abbruch);
								}
							},
							werkzeug: (name, eingabe) => notiereGelesen(lauf, name, eingabe),
							mitschrift: mitschrift(s, pruefRolle === 'fach' ? 'fachblick' : 'pruefung', d.slug),
						})
					: Promise.resolve({
							...gescheitert('Die Seiten ließen sich für die Prüfung nicht bauen.'),
							verbrauch: {},
						})
			).finally(() => {
				if (aktiv) {
					aktiv.reserviert.kostenUsd -= vergeben.kostenUsd;
					aktiv.reserviert.runden -= vergeben.runden;
				}
			});
			const fehler = aktiv?.abbruch ? 'Abgebrochen.' : fehlerText(ergebnis.fehler);
			eintrag.befunde = ergebnis.befunde.map(befundZeile);
			const hinweis = [
				teil
					? `Prüflauf ${teil.nr} von ${teil.von}, Seiten ${teil.erste}–${teil.letzte} von ${teil.gesamt}.`
					: '',
				ergebnis.lesbar
					? ''
					: 'Die Antwort hatte keinen lesbaren Block mit Befunden: keine Befunde übernommen.',
			]
				.filter(Boolean)
				.join(' ');
			if (hinweis) {
				eintrag.hinweis = hinweis;
			}
			beendeEintrag(eintrag, beginn, fehler, ergebnis.verbrauch);
			await schreibeProtokoll();
			await notiereVerbrauch(s, fehler ? 'unvollstaendig' : 'fertig', beginn, {
				...ergebnis.verbrauch,
				lauf: 'pruefung',
				rolle: pruefRolle,
			});
			return { ...ergebnis, fehler };
		};
		/** Die Läufe einer Rolle nacheinander, Teil für Teil; nach einem gescheiterten Teil keiner mehr. */
		const strecke = async (pruefRolle: PruefRolle, laeufe: { text: string; teil?: PruefTeil }[] | null) => {
			const ergebnisse: { befunde: PruefBefund[]; lesbar: boolean; fehler: string | null }[] = [];
			for (const l of laeufe ?? [null]) {
				const zuEnde = erschoepft(grenzenFuer(KI_GRENZEN.einheit.pruefung));
				if (!aktiv || aktiv.abbruch || zuEnde) {
					ergebnisse.push(
						gescheitert(aktiv?.abbruch ? 'Abgebrochen.' : (fehlerText(zuEnde) ?? 'Abgebrochen.')),
					);
					break;
				}
				const e = await einTeil(pruefRolle, l?.text ?? null, l?.teil);
				ergebnisse.push(e);
				if (e.fehler) {
					break;
				}
			}
			return ergebnisse;
		};
		let beide: { befunde: PruefBefund[]; lesbar: boolean; fehler: string | null }[][] = [[], []];
		try {
			let auftraege: PruefAuftraege | null = null;
			try {
				auftraege = await pruefAuftraege(s, plan, d, o, html, ordner);
			} catch (fehler) {
				console.error('Prüflauf der Einheit:', (fehler as Error).message);
			}
			beide = await Promise.all([
				o.mitKind ? strecke('kind', auftraege?.kind ?? null) : [],
				o.fach ? strecke('fach', auftraege?.fach ?? null) : [],
			]);
			const kindTeile = beide[0] ?? [];
			if (auftraege?.bilder.length && kindTeile.length && kindTeile.every((t) => !t.fehler && t.lesbar)) {
				merkeGepruefteBilder(
					s,
					auftraege.bilder,
					beide.flat().flatMap((t) => t.befunde),
				);
			}
		} finally {
			await rm(ordner, { recursive: true, force: true });
			await rm(fachOrdner, { recursive: true, force: true });
		}
		const r = rollenErgebnis([
			{ rolle: 'kind', teile: beide[0] ?? [] },
			{ rolle: 'fach', teile: beide[1] ?? [] },
		]);
		return aktiv?.abbruch ? { ...r, fehler: 'Abgebrochen.', luecke: null } : r;
	};

	/**
	 * Wird das Budget knapp, entfällt die letzte Prüfrunde (262): Bleibt dem Durchgang weniger, als eine Runde für dieses
	 * und die noch ungebauten Materialien kostet. Die Befunde der Runde davor bleiben in `s.pruefung` und gehen so an den
	 * Schluss wie sonst die der letzten Runde. Die Reserve des Schlusses ist dabei schon abgezogen.
	 */
	const letzteRundeEntfaellt = (
		s: EinheitStand,
		plan: EinheitPlan,
		d: PlanDokument,
		weise: ReturnType<typeof pruefWeise>,
	) => {
		const k = KI_GRENZEN.einheit.pruefung.rundeUsd;
		const kosten = (w: ReturnType<typeof pruefWeise>) => (w.kind || w.blick ? k.kind : 0) + (w.fach ? k.fach : 0);
		const uebrige = plan.dokumente.filter((x) => x.slug !== d.slug && !s.importiert[x.slug]);
		const runde = uebrige.reduce((n, x) => n + kosten(pruefWeise(rolleVon(x), false)), kosten(weise));
		return restUsd(false) < runde;
	};

	/** Vermerkt an der letzten Korrekturrunde im Protokoll, dass die letzte Prüfrunde entfiel. */
	const vermerkeOhneLetzteRunde = async () => {
		const eintrag = aktiv?.protokoll.laeufe.at(-1);
		if (eintrag?.art === 'korrektur') {
			eintrag.hinweis = 'Die letzte Prüfrunde entfiel, das Budget wurde knapp; die Befunde gehen an den Schluss.';
			await schreibeProtokoll();
		}
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
		const weise = pruefWeise(rolleVon(d), await mitKiBildern(s, html));
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
		const mitPruefLauf = weise.kind || weise.blick || weise.fach;
		/** Ein Prüflauf, wenn das Material einen bekommt; `null`, wenn er gescheitert ist. */
		const pruefe = async (runde: number, server: string[]): Promise<PruefBefund[] | null> => {
			if (!mitPruefLauf) {
				return [];
			}
			await zeige();
			const p = await pruefeMaterial(s, plan, d, {
				mitKind: weise.kind || weise.blick,
				kind: weise.kind,
				bilder: weise.blick && (await mitKiBildern(s, html)),
				fach: weise.fach,
			});
			stand.runden += 1;
			stand.luecke = p.luecke;
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
			await notiereFolgen(s, plan, d);
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
		/** 264: Abweichungen vom Kanon, die der Steckbrief meldet, gehen je einmal in eine Korrekturrunde. */
		const gemeldet = new Set<string>();
		for (let runde = 0; ; runde += 1) {
			const server = [
				...dopplungTexte(await dopplungen(s, plan, d.slug), d.slug, titelVon(s)),
				...(await bildlisteBefundeFuer(s, plan, d)),
			];
			const letzte = runde > 0 && runde === KI_GRENZEN.einheit.pruefRunden;
			if (letzte && mitPruefLauf && letzteRundeEntfaellt(s, plan, d, weise)) {
				stand.server = server;
				stand.ohneLetzteRunde = true;
				await vermerkeOhneLetzteRunde();
				break;
			}
			const gefunden = await pruefe(runde, server);
			if (gefunden === null) {
				break;
			}
			const abweichung = (s.steckbriefe?.[d.slug]?.widerspruch ?? []).filter((w) => !gemeldet.has(w));
			const befunde = [...gefunden, ...widerspruchBefunde(abweichung)];
			stand.offen = befunde;
			stand.server = server;
			if (genug(runde, befunde, server, sitz)) {
				break;
			}
			for (const w of abweichung) {
				gemeldet.add(w);
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
				rechte: einheitBauRechte({ slug: d.slug, thema }),
				mitBildern: s.bilder,
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
		// Ohne Schlüssel (237) gibt es den Schritt nicht: Die Einheit hält hier an, bis der Admin ihn einträgt.
		if (!bilderStand(kontext.konfig).verfuegbar) {
			return BILDER_AUS;
		}
		await halteFreigabe(s);
		const ergebnis = await starteLauf(s, {
			art: 'bilder',
			material: BILDER_SCHRITT,
			text: await BILDER(s, plan, pflicht),
			sitzung: null,
			auftragDatei: materialAuftrag,
			rechte: einheitBauRechte({ slug: null, thema: false }),
			mitBildern: true,
			bauen: null,
			grenzen: KI_GRENZEN.einheit.bilder,
			pflicht,
		});
		await abgleich();
		if (!aktiv?.abbruch) {
			await uebernimmGrundposen(s, plan);
			await merke(s);
		}
		if (ergebnis.bilder?.gesperrt && !aktiv?.abbruch) {
			return ergebnis.fehler ?? bilderGesperrtText(s, BILDER_SCHRITT);
		}
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

	/** Die Bilder, die die Materialien nennen (`../../bilder/…`, ohne Vorschaubilder), und ob es ihre Strichfassung gibt. */
	const paketBilder = async (s: EinheitStand, htmls: readonly string[]) => {
		const da = new Set(await readdir(path.join(arbeitDir(s.id), 'bilder')).catch(() => [] as string[]));
		const genannt = new Set(
			htmls.flatMap((h) => [...h.matchAll(/\.\.\/\.\.\/bilder\/([^"'()\s?#]+)/g)].map((t) => t[1] ?? '')),
		);
		return [...genannt]
			.filter((n) => n && da.has(n) && !n.startsWith('v-'))
			.sort()
			.map((datei) => {
				const stamm = datei.replace(/\.[^.]+$/, '');
				return { datei, strich: [...da].some((n) => n.startsWith(`${stamm}-strich.`)) };
			});
	};

	/** Die Bestandteile für Quellen und Angebot (250): gezählt am Gebauten, mit Druckprofil und Strichfassungen. */
	const bestandteile = async (
		s: EinheitStand,
		plan: EinheitPlan,
		formate: FormateDerEinheit,
		nenntBildliste: boolean,
	) => {
		const htmls: Record<string, string> = {};
		for (const d of plan.dokumente) {
			const html = await materialHtml(s, d.slug);
			if (html) {
				htmls[d.slug] = html;
			}
		}
		return bestandteileText(plan, s.steckbriefe ?? {}, {
			formate,
			profile: Object.fromEntries(Object.entries(htmls).map(([slug, h]) => [slug, druckprofilAusHtml(h)])),
			bilder: await paketBilder(s, Object.values(htmls)),
			bildliste: nenntBildliste,
		});
	};

	/**
	 * 272: Die Pflichtlektüre je Material für den Schlusslauf: die der Rolle und, wie `bauen` sie verlangt
	 * (`abbildungenFehlen`), die Dateien des Katalogs zu den Elementen, die das Material schon verwendet.
	 */
	const schlussLektuere = async (s: EinheitStand, plan: EinheitPlan) => {
		const liste: Record<string, string[]> = {};
		for (const d of plan.dokumente) {
			const pflicht = lektuereFuer(s, rolleVon(d));
			const html = await materialHtml(s, d.slug);
			const teile = html ? abbildungenFehlen(html, new Set(pflicht)).map((t) => t.datei) : [];
			liste[d.slug] = [...pflicht, ...teile];
		}
		return liste;
	};

	const SCHLUSS = (
		s: EinheitStand,
		plan: EinheitPlan,
		dopplung: string[],
		formate: FormateDerEinheit,
		paket: string,
		bilder: string,
		lektuere: Readonly<Record<string, readonly string[]>>,
	) => {
		const offen = plan.dokumente.flatMap((d) => {
			const p = s.pruefung?.[d.slug];
			const folgen = (s.befunde.find((b) => b.slug === d.slug)?.texte ?? []).filter(istFolgekorrektur);
			const vorher = p?.ohneLetzteRunde ? ' (vor der letzten Korrektur gefunden, nicht mehr geprüft)' : '';
			return [
				...(p?.offen ?? []).map((b) => `- ${d.slug}${vorher}: ${befundZeile(b)}`),
				...(p?.server ?? []).map((t) => `- ${d.slug}: ${t}`),
				...folgen.map((t) => `- ${d.slug}: ${t}`),
			];
		});
		return [
			`Schritt 3: der Schlusslauf. Ändere höchstens ${KI_GRENZEN.einheit.schluss.neubau} Materialien und baue jedes geänderte mit bauen neu.`,
			KOPF(s),
			planFuerBau(plan),
			pruefpunkteText(s.recherche?.text, plan.berichtigungen),
			kanonText(plan.kanon, { nachtrag: s.kanonNachtrag }),
			widerspruchText(plan, (slug) => s.steckbriefe?.[slug]?.widerspruch),
			aufgabenFuerBau(plan, '').replace(
				/^.*\n/,
				'Aufgaben-Übersicht aus dem freigegebenen Plan, alle Stunden:\n',
			),
			fertigText(plan, fertigeMaterialien(s), s.steckbriefe ?? {}),
			`Die Zahlen der Schoolbox (nur diese schreibst du ab):\n${zahlenText(plan, s.steckbriefe ?? {}, formate)}`,
			paket,
			bilder,
			dopplung.length
				? ['Doppelte Abbildungen, die der Server gefunden hat:', ...dopplung.map((t) => `- ${t}`)].join('\n')
				: 'Doppelte Abbildungen: Der Server hat keine gefunden.',
			offen.length ? ['Was die Prüfläufe offen ließen:', ...offen].join('\n') : '',
			[
				'Pflichtlektüre je Material, ganz und vor dem ersten Aufruf von bauen für dieses Material (Pfade ab dem Ordner der Skills; Read ohne offset und limit):',
				...plan.dokumente.map((d) => `- ${d.slug}: ${(lektuere[d.slug] ?? []).map(lektuereZeile).join(' · ')}`),
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

	/** Was der Server nach dem Schlusslauf selbst nachzählt: Dopplungen, Herkunft der Bilder, Zahlen der Einheit. */
	const schlussNachzaehlen = async (s: EinheitStand, plan: EinheitPlan) => {
		const nachher = new Map<string, string | null>();
		for (const d of plan.dokumente) {
			nachher.set(d.slug, await materialHtml(s, d.slug));
		}
		const liste = await bildliste(s, plan);
		const herkunft = [];
		for (const d of plan.dokumente) {
			herkunft.push(...(await bildlisteBefundeFuer(s, plan, d, liste)));
		}
		return [
			...dopplungUebersicht(await dopplungen(s, plan), titelVon(s)),
			...herkunft,
			...zahlenBefunde(
				plan,
				s.steckbriefe ?? {},
				(slug) => nachher.get(slug) ?? null,
				await formateDerEinheit(s),
			),
		];
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
		await sichereAuszuege(s);
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
				mitBildern: false,
				bauen: bauenFuer(s, null),
				grenzen: KI_GRENZEN.einheit.schluss,
				pflicht: [],
			});
		const halt = erschoepft(grenzenFuer(KI_GRENZEN.einheit.schluss));
		const mitVerkauf = plan.dokumente.some((d) => VERKAUF_ROLLEN.has(rolleVon(d)));
		let ergebnis = halt
			? null
			: await lauf(
					'schluss',
					SCHLUSS(
						s,
						plan,
						dopplungUebersicht(await dopplungen(s, plan), titelVon(s)),
						await formateDerEinheit(s),
						await bestandteile(s, plan, await formateDerEinheit(s), mitVerkauf),
						mitVerkauf ? bildlisteText(await bildliste(s, plan)) : '',
						await schlussLektuere(s, plan),
					),
					null,
				);
		const zurueck: string[] = [];
		const uebernimm = async () => {
			for (const d of plan.dokumente) {
				const jetzt = await materialHtml(s, d.slug);
				if (jetzt === vorher.get(d.slug)) {
					continue;
				}
				if (gebaut.has(d.slug) && jetzt !== null) {
					await uebernimmMaterial(s, d);
					const alt = s.befunde.find((b) => b.slug === d.slug);
					if (alt?.texte.some(istFolgekorrektur)) {
						befund(
							s,
							d.slug,
							alt.dok,
							alt.texte.filter((t) => !istFolgekorrektur(t)),
						);
					}
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
		stand.server = await schlussNachzaehlen(s, plan);
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
		const fehler = d && !s.importiert[d.slug] ? await baueMaterial(s, plan, d) : null;
		// Sperrte die Bild-API im Lauf eines Materials, steht es mit Platzhaltern da; die Einheit hält danach an.
		return fehler ?? (aktiv?.bilderGesperrt && !aktiv.abbruch ? bilderGesperrtText(s, schritt) : null);
	};

	/** Die Schritte der Reihenfolge, dann Schluss und Posen. Gibt den letzten Fehler zurück, sonst `null`. */
	const baueAlleSchritte = async (s: EinheitStand, plan: EinheitPlan) => {
		let letzter: string | null = null;
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
		if (!aktiv?.abbruch && alleMaterialien(s)) {
			await uebernimmPosen(s);
		}
		return letzter;
	};

	/**
	 * Endet der Durchgang an seinem Budget, sagt der Hinweis, was noch fehlt (262), ohne Beträge: „Weiterbauen“ startet
	 * einen neuen Durchgang mit eigenem Budget und soll eine bewusste Entscheidung sein.
	 */
	const amEnde = (s: EinheitStand, fehler: string | null) => {
		if (fehler !== 'error_max_budget_usd' || aktiv?.abbruch) {
			return null;
		}
		const fehlen = (s.plan?.dokumente ?? []).filter((d) => !s.importiert[d.slug]).length;
		const offen = [
			fehlen ? `${fehlen} ${fehlen === 1 ? 'Material' : 'Materialien'}` : '',
			s.bilder && !s.bilderFertig ? 'die Bilder' : '',
			schlussErledigt(s) ? '' : 'der Abgleich der ganzen Einheit',
		].filter(Boolean);
		if (!offen.length) {
			return null;
		}
		const liste = offen.length > 1 ? `${offen.slice(0, -1).join(', ')} und ${offen.at(-1)}` : offen[0];
		return `${FEHLER_TEXT.error_max_budget_usd} Noch offen: ${liste}. ‚Weiterbauen‘ startet einen neuen Durchgang mit eigenem Budget.`;
	};

	/** Schritt 2: die Schritte der Reihenfolge nacheinander, jeder in einer neuen Sitzung. Fertiges überspringt er. */
	const fuehreAus = async (s: EinheitStand) => {
		const takt = setInterval(() => void abgleich(), TAKT_MS);
		if (aktiv) {
			aktiv.takt = takt;
		}
		let letzter: string | null = null;
		try {
			if (s.plan) {
				letzter = await baueAlleSchritte(s, s.plan);
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
				: (s.grund ??
					amEnde(s, letzter) ??
					fehlerText(letzter) ??
					'Claude hat nicht alle geplanten Materialien fertig gebaut.');
		s.ende = new Date().toISOString();
		aktiv = null;
		await merke(s);
		await rm(path.join(dir(s.id), PID), { force: true });
	};

	const beginne = async (s: EinheitStand, text: string | null, sitzung: string | null, stufe: Stufe = 'bau') => {
		const ki = await kiLaufJetzt(kontext.konfig, 'gross');
		aktiv = {
			stand: s,
			stufe,
			kinder: new Set(),
			abbruch: false,
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
			reserviert: { kostenUsd: 0, runden: 0 },
			ki,
			bilder: null,
			bilderGesperrt: false,
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
		// Ohne Schlüssel (237) startet die Einheit wie ohne neue Bilder; der Auftrag sagt es Claude so.
		angaben = { ...angaben, bilder: angaben.bilder && bilderStand(kontext.konfig).verfuegbar };
		// 242: Name und Kennung einer Figur der Bibliothek gelten so, wie die Bibliothek sie führt.
		if (angaben.leitfigur.art === 'bibliothek') {
			const da = await bibliothek();
			const figuren = angaben.leitfigur.figuren.map((w) => {
				const f = da.find((x) => x.id === w.id);
				if (!f) {
					throw new HttpFehler(400, 'Diese Figur gibt es nicht mehr in der Bibliothek.');
				}
				return { id: f.id, name: f.name };
			});
			angaben = { ...angaben, leitfigur: { art: 'bibliothek', figuren } };
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
			leitfigur: leitfigurIds(angaben.leitfigur),
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
		const kopf = sitzung
			? ''
			: `${[KOPF(s), bibliothekFuerPlan(await bibliothek())].filter(Boolean).join('\n\n')}\n\n`;
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
			let pids: number[] = [];
			try {
				pids = lesePids(path.join(wurzel, name, PID));
			} catch {
				// Keine Datei.
			}
			// Seit 244 bis zu zwei: Kinderaugen und Fachblick liefen gleichzeitig.
			for (const pid of pids) {
				try {
					if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(wurzel)) {
						process.kill(pid, 'SIGTERM');
					}
				} catch {
					// Kein Prozess mehr.
				}
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
				for (const kind of aktiv.kinder) {
					kind.kill('SIGTERM');
				}
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
