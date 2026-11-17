/**
 * Unterrichtseinheit (139): Angaben aus dem Assistenten, der Auftrag an Claude und der Plan, den Claude in
 * `einheit.json` schreibt. Eine Einheit ist ein Ordner mit einem Behälter, keine neue `Art` (140).
 */
import type { PlanStunde } from './einheit-aufgaben';
import { leseStunden } from './einheit-aufgaben';
import type { Steckbrief } from './einheit-bau';
import type { PruefStand, SchlussStand } from './einheit-pruefung';
import { SchoolboxFehler } from './fehler';
import { hatSatz } from './html';
import { aufgabenOhneLoesung } from './loesungen';
import type { Meldung, MeldungCode } from './meldungen';
import { FACH_NAME } from './namen';
import { zerlege } from './quelltext';
import type { RechercheAnfrage, RechercheStand } from './recherche';
import { ID_MUSTER } from './schema';
import type { Art, Fach, Format, Klasse } from './werte';
import { ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

export const EINHEIT_PLAN = 'einheit.json';
export const EINHEIT_THEMA = 'thema.css';
export const EINHEIT_ZEICHEN = { thema: 200, ziel: 200, frei: 1500, idee: 300, titel: 120, autor: 60 };
export const EINHEIT_MAX_DOKUMENTE = 24;
/**
 * Kasten „Verbrauch“ vor dem Start (140). Seit 220 baut je Material ein eigener Durchgang, danach prüft ein eigener Lauf
 * Arbeitsblätter, Stationen, Spiele und Schauseiten, am Ende gleicht ein Schlusslauf alles ab. Geschätzt, am ersten
 * echten Lauf zu messen (Lauf vom 2026-11-16: 15 Materialien in 54 Minuten in einem Lauf, ohne Prüfung).
 */
export const EINHEIT_VERBRAUCH =
	'Zuerst sucht Claude im Web nach Bildungsplan und Fachdidaktik und zeigt dir den Plan: die Geschichte und alle Materialien. Das dauert einige Minuten. Nach deiner Freigabe baut Claude die Materialien nacheinander, jedes in einem eigenen Durchgang: Regeln lesen, bauen, prüfen, ansehen. Danach löst ein eigener Durchgang jedes Arbeitsblatt, jede Station und jedes Spiel wie ein Kind der Klasse, und Claude bessert nach, was dabei auffällt. Zum Schluss gleicht Claude alle Materialien mit deinem Auftrag ab. Je nach Umfang dauert das zwei bis vier Stunden und verbraucht sehr viel von deinem Limit. Du kannst weiterarbeiten; jedes Material erscheint im Ordner, sobald es fertig ist.';

/**
 * Minuten je Material in einem eigenen Durchgang (220), geschätzt; dazu einmal die Bilder. `pruefen`: Prüfläufe und
 * Korrekturrunden eines geprüften Materials (bis zu drei kurze Prüfläufe, bis zu zwei Korrekturen), `schluss` der
 * Schlusslauf einmal je Einheit.
 */
export const EINHEIT_MINUTEN_JE_MATERIAL = {
	von: 5,
	bis: 10,
	bilder: 15,
	pruefen: { von: 3, bis: 10 },
	schluss: { von: 10, bis: 25 },
};

const dauer = (minuten: number) => {
	if (minuten < 60) {
		return `${Math.max(5, Math.round(minuten / 5) * 5)} Minuten`;
	}
	const stunden = Math.round(minuten / 30) / 2;
	return `${String(stunden).replace('.', ',')} ${stunden === 1 ? 'Stunde' : 'Stunden'}`;
};

/** „etwa 1,5 bis 2,5 Stunden“ für den Text vor der Freigabe; `geprueft`: Materialien mit Prüflauf (`gepruefteZahl`). */
export const einheitBauDauer = (materialien: number, bilder: boolean, geprueft = 0) => {
	const m = EINHEIT_MINUTEN_JE_MATERIAL;
	const extra = bilder ? m.bilder : 0;
	const von = dauer(materialien * m.von + geprueft * m.pruefen.von + m.schluss.von + extra);
	const bis = dauer(materialien * m.bis + geprueft * m.pruefen.bis + m.schluss.bis + extra);
	if (von === bis) {
		return `etwa ${von}`;
	}
	const [zahl, einheit] = von.split(' ');
	return `etwa ${einheit === bis.split(' ')[1] || (einheit === 'Stunde' && bis.endsWith('Stunden')) ? zahl : von} bis ${bis}`;
};

const SLUG = new RegExp(ID_MUSTER);
const MAX_SLUG = 60;

export const EINHEIT_DAUER = ['1 Woche', '2 Wochen', '3–4 Wochen'] as const;
/** `keine` gibt es nur noch in alten Anfragen und Einheiten (190, Urteil 3); der Assistent bietet sie nicht an. */
export const EINHEIT_LEITFIGUR = ['willi', 'wilma', 'beide', 'keine'] as const;
/** Ein eigenes Thema von Claude oder schlicht. */
export const EINHEIT_AUSSEHEN = ['eigen', 'schlicht'] as const;

/**
 * Bestandteile einer Einheit (Schritt „Bestandteile“). Was eine Reihe braucht, steht im Skill `unterrichtsplanung`
 * (Reihenplanung); die Empfehlung ist der Kern daraus: Einstieg, Übung, Spiel, Überprüfung, Lösungen.
 */
export const EINHEIT_BESTANDTEILE = [
	{ name: 'Auftakt (Präsentation)', empfohlen: true },
	{ name: 'Arbeitsblätter', empfohlen: true },
	{ name: 'Lesetexte', empfohlen: false },
	{ name: 'Lernspiel', empfohlen: true },
	{ name: 'Bild- und Wortkarten', empfohlen: false },
	{ name: 'Lernplakat', empfohlen: false },
	{ name: 'Stationen', empfohlen: false },
	{ name: 'Lernzielkontrolle', empfohlen: true },
	{ name: 'Urkunde oder Abschluss', empfohlen: false },
	{ name: 'Verlaufsplan für dich', empfohlen: false },
	{ name: 'Lösungen', empfohlen: true },
] as const;

export interface EinheitAngaben {
	titel: string;
	fach: Fach;
	klasse: Klasse;
	thema: string;
	ziele: string[];
	vorwissen: string;
	dauer: string;
	stundenJeWoche: number;
	bestandteile: string[];
	nochEtwas: string;
	idee: string;
	leitfigur: (typeof EINHEIT_LEITFIGUR)[number];
	aussehen: (typeof EINHEIT_AUSSEHEN)[number];
	/** Neue Bilder mit Canva (138). */
	bilder: boolean;
	/** Für den Verkauf: Deckblatt, Quellenverzeichnis und Angebotstext kommen dazu (`html-materialerstellung/references/verkauf.md`). */
	verkauf: boolean;
	/** Name auf dem Deckblatt; nur mit `verkauf`. */
	autor: string;
	bausteine: { selbsteinschaetzung: boolean; niveaus: boolean; sternchen: boolean };
	lerngruppe: string[];
	klasseText: string;
}

const fehler = (text: string) => new SchoolboxFehler(text);

const text = (wert: unknown, max: number, name: string, pflicht = false) => {
	if (wert === undefined || wert === null) {
		if (pflicht) {
			throw fehler(`Es fehlt: ${name}.`);
		}
		return '';
	}
	if (typeof wert !== 'string' || wert.length > max) {
		throw fehler(`${name} ist zu lang oder ungültig (höchstens ${max} Zeichen).`);
	}
	const t = wert.trim();
	if (pflicht && t === '') {
		throw fehler(`Es fehlt: ${name}.`);
	}
	return t;
};

const liste = (wert: unknown, max: number, laenge: number, name: string) => {
	if (wert === undefined) {
		return [];
	}
	if (!Array.isArray(wert) || wert.length > laenge) {
		throw fehler(`${name} ist ungültig.`);
	}
	return wert.map((w) => text(w, max, name)).filter(Boolean);
};

const eins = <T extends string | number>(wert: unknown, erlaubt: readonly T[], name: string, standard?: T): T => {
	if (wert === undefined && standard !== undefined) {
		return standard;
	}
	if (!erlaubt.includes(wert as T)) {
		throw fehler(`${name} ist ungültig.`);
	}
	return wert as T;
};

const ja = (wert: unknown) => wert === true;

/** Prüft die Angaben aus dem Assistenten (140). Was fehlt, bekommt die Empfehlung. */
export const pruefeEinheitAngaben = (roh: unknown): EinheitAngaben => {
	const b = (roh ?? {}) as Record<string, unknown>;
	const thema = text(b.thema, EINHEIT_ZEICHEN.thema, 'Thema', true);
	const klasse = eins(b.klasse, KLASSEN, 'Die Klasse');
	const stunden = b.stundenJeWoche === undefined ? 4 : Number(b.stundenJeWoche);
	if (!Number.isInteger(stunden) || stunden < 1 || stunden > 10) {
		throw fehler('Stunden je Woche ist ungültig.');
	}
	const z = (b.bausteine ?? {}) as Record<string, unknown>;
	return {
		titel: text(b.titel, EINHEIT_ZEICHEN.titel, 'Titel') || thema,
		fach: eins(b.fach, FAECHER, 'Das Fach'),
		klasse,
		thema,
		ziele: liste(b.ziele, EINHEIT_ZEICHEN.ziel, 8, 'Ziele'),
		vorwissen: text(b.vorwissen, EINHEIT_ZEICHEN.frei, 'Vorwissen'),
		dauer: text(b.dauer, 60, 'Dauer') || '2 Wochen',
		stundenJeWoche: stunden,
		bestandteile: liste(b.bestandteile, 60, 20, 'Bestandteile'),
		nochEtwas: text(b.nochEtwas, EINHEIT_ZEICHEN.frei, 'Noch etwas'),
		idee: text(b.idee, EINHEIT_ZEICHEN.idee, 'Idee'),
		leitfigur: eins(b.leitfigur, EINHEIT_LEITFIGUR, 'Die Leitfigur', 'beide'),
		aussehen: eins(b.aussehen, EINHEIT_AUSSEHEN, 'Das Aussehen', 'eigen'),
		bilder: b.bilder === undefined ? true : ja(b.bilder),
		verkauf: ja(b.verkauf),
		autor: ja(b.verkauf) ? text(b.autor, EINHEIT_ZEICHEN.autor, 'Name auf dem Deckblatt') : '',
		bausteine: {
			selbsteinschaetzung: ja(z.selbsteinschaetzung),
			niveaus: ja(z.niveaus),
			sternchen: ja(z.sternchen),
		},
		lerngruppe: liste(b.lerngruppe, 80, 10, 'Lerngruppe'),
		klasseText: text(b.klasseText, EINHEIT_ZEICHEN.frei, 'Deine Klasse'),
	};
};

const KLASSE_NAME = (k: Klasse) => (k === 'gemischt' ? 'jahrgangsgemischt' : `Klasse ${k}`);
const FIGUR = { willi: 'Willi', wilma: 'Wilma', beide: 'Willi und Wilma', keine: '' };

export type Bausteine = EinheitAngaben['bausteine'];

/**
 * Was ein Baustein in der Einheit bewirkt, an wie aus (`grundschul-didaktik/references/rueckfragen.md`). Ohne den
 * Satz griffe die Empfehlung der Skills, und Abgewähltes käme trotzdem (210).
 */
const EINHEIT_BAUSTEIN_SATZ: Record<keyof Bausteine, { mit: string; ohne: string }> = {
	selbsteinschaetzung: {
		mit: 'Mit Selbsteinschätzung: auf den Arbeitsblättern ein Fuß mit Wachstumsstufen (Samen bis Blume) und Reflexionsfrage, am Ende der Reihe eine Lernlandkarte.',
		ohne: 'Ohne Selbsteinschätzung: kein Fuß mit Wachstumsstufen (Samen bis Blume), keine Lernlandkarte, keine Reflexionsfolie mit Wachstumsgrafik.',
	},
	niveaus: {
		mit: 'Mit drei Niveaus zur Wahl (● Grundlage, ●● Kern, ●●● Herausforderung): je Niveau eine eigene Seite, die Kinder wählen.',
		ohne: 'Ohne drei Niveaus: je Stunde ein Arbeitsblatt für alle, Aufgaben steigend im Anspruch, keine Niveau-Punkte ● ●● ●●● und keine Wahlhilfe.',
	},
	sternchen: {
		mit: 'Mit Sternchenaufgabe: auf jedem Arbeitsblatt als letzte Aufgabe eine Knobelaufgabe ★, freiwillig für alle.',
		ohne: 'Ohne Sternchenaufgabe ★.',
	},
};

/** Der Teil der Lehrkraft am Auftrag, lesbar und in Sätzen (wie 131). Der feste Teil steht in `vorlagen/ki/einheit.md`. */
const aussehenSatz = (wert: EinheitAngaben['aussehen']) =>
	wert === 'eigen' ? 'Aussehen: Gestalte ein eigenes Thema in thema.css.' : 'Aussehen: schlicht, ohne thema.css.';

/** Gewählte und ausdrücklich nicht gewählte Bestandteile: Was fehlt, soll Claude weglassen, nicht ergänzen (210). */
const bestandteilSaetze = (gewaehlt: string[]) => {
	if (gewaehlt.length === 0) {
		return ['Bestandteile: keine ausgewählt, entscheide du.'];
	}
	const nicht = EINHEIT_BESTANDTEILE.map((b) => b.name).filter((name) => !gewaehlt.includes(name));
	return [
		`Bestandteile: ${gewaehlt.join(', ')}.`,
		nicht.length ? `Nicht gewählt, also weglassen: ${nicht.join(', ')}.` : '',
	];
};

const verkaufSatz = (a: EinheitAngaben) => {
	if (!a.verkauf) {
		return 'Nicht für den Verkauf: kein Deckblatt, kein Quellenverzeichnis, kein Angebotstext.';
	}
	return `Die Einheit soll auf Eduki verkauft werden, ${a.autor ? `Name auf dem Deckblatt: ${a.autor}` : 'ohne Namen auf dem Deckblatt'}.`;
};

/** Ein Freitext als Satz: kein zweites Satzzeichen, wenn er schon mit einem endet (190-21). */
const alsSatz = (freitext: string) => (/[.!?…]$/.test(freitext) ? freitext : `${freitext}.`);

/** Jede Angabe aus dem Assistenten ergibt einen Satz, auch eine leere oder abgewählte (210). */
export const einheitAuftragAus = (a: EinheitAngaben): string => {
	const saetze = [
		`Erstelle eine Unterrichtseinheit „${a.titel}“ für ${FACH_NAME[a.fach]}, ${KLASSE_NAME(a.klasse)}${a.titel === a.thema ? '' : `, zum Thema „${a.thema}“`}.`,
		`Dauer: ${a.dauer}, ${a.stundenJeWoche} Stunden je Woche. Zahl der Materialien: entscheide du.`,
		a.ziele.length
			? `Ich-kann-Ziele: ${a.ziele.join(' · ')}`
			: 'Ich-kann-Ziele: nicht angegeben, formuliere sie selbst.',
		`Vorwissen der Klasse: ${a.vorwissen ? alsSatz(a.vorwissen) : 'nicht angegeben, nimm es nach Klasse und Thema an.'}`,
		...bestandteilSaetze(a.bestandteile),
		a.nochEtwas ? `Außerdem als Bestandteil: ${alsSatz(a.nochEtwas)}` : '',
		`Mit Rahmengeschichte, Idee: ${a.idee ? alsSatz(a.idee) : 'nicht angegeben, erfinde sie selbst.'}`,
		a.leitfigur === 'keine' ? 'Ohne Leitfigur.' : `Leitfigur: ${FIGUR[a.leitfigur]}.`,
		aussehenSatz(a.aussehen),
		a.bilder
			? 'Neue Bilder mit Canva sind erlaubt (bilder.json).'
			: 'Keine neuen Bilder: nur Willi, Wilma und berechnete Abbildungen.',
		...(Object.keys(EINHEIT_BAUSTEIN_SATZ) as (keyof Bausteine)[]).map((b) =>
			a.bausteine[b] ? EINHEIT_BAUSTEIN_SATZ[b].mit : EINHEIT_BAUSTEIN_SATZ[b].ohne,
		),
		`Lerngruppe: ${a.lerngruppe.length ? a.lerngruppe.join(', ') : 'keine Besonderheiten angegeben'}.`,
		`Zur Klasse: ${a.klasseText ? alsSatz(a.klasseText) : 'nichts weiter angegeben.'}`,
		verkaufSatz(a),
	];
	return saetze.filter(Boolean).join('\n');
};

export interface PlanDokument {
	slug: string;
	titel: string;
	art: Art;
	format: Format;
	zweck: string;
	fertig: boolean;
}

/** Ein Kapitel im Vorleseheft (216); `nr` 0 ist der Auftakt. `bildfolien` beginnen mit ihrer Nummer („1.2 …“). */
export interface PlanKapitel {
	nr: number;
	titel: string;
	offenesEnde: string;
	bildfolien: string[];
}

/** Die Geschichte der Reihe (216): Kurzfassung für die Lehrkraft, dazu was das Vorleseheft tragen muss. */
export interface PlanGeschichte {
	kurz: string;
	verdaechtige: string[];
	falscheFaehrte: string;
	aufloesung: string;
	kapitel: PlanKapitel[];
}

export interface EinheitPlan {
	titel: string;
	annahmen: string[];
	dokumente: PlanDokument[];
	/** Fehlt bei Plänen ohne Geschichte und bei Einheiten vor 216. */
	geschichte?: PlanGeschichte;
	/** Die Kurzfassung der Recherche (219) in drei, vier Sätzen; fehlt bei Plänen davor. */
	recherche?: string;
	/** Aufgaben-Übersicht je Stunde (221, `einheit-aufgaben.ts`); fehlt bei Plänen davor. */
	stunden?: PlanStunde[];
	/** Je Figur Name, Rolle und Aussehen; jeder Baulauf bekommt sie (220). */
	figuren?: string[];
	/** Was jedes Kapitel liefert und was am Ende herauskommt (220). */
	raetselkette?: string;
}

const kurz = (wert: unknown, max: number) => (typeof wert === 'string' ? wert.trim().slice(0, max) : '');

const kurzListe = (wert: unknown, max: number, laenge: number) =>
	(Array.isArray(wert) ? wert : [])
		.map((w) => kurz(w, max))
		.filter(Boolean)
		.slice(0, laenge);

const MAX_KAPITEL = 30;

const leseGeschichte = (p: Record<string, unknown>): PlanGeschichte | undefined => {
	const kapitel = (Array.isArray(p.kapitel) ? p.kapitel : [])
		.map((k): PlanKapitel | null => {
			const x = (k ?? {}) as Record<string, unknown>;
			const nr = Number(x.nr);
			if (!Number.isInteger(nr) || nr < 0 || nr > MAX_KAPITEL) {
				return null;
			}
			return {
				nr,
				titel: kurz(x.titel, EINHEIT_ZEICHEN.titel),
				offenesEnde: kurz(x.offenesEnde, 400),
				bildfolien: kurzListe(x.bildfolien, 200, 6),
			};
		})
		.filter((k): k is PlanKapitel => k !== null)
		.slice(0, MAX_KAPITEL + 1);
	const g: PlanGeschichte = {
		kurz: kurz(p.geschichte, 1200),
		verdaechtige: kurzListe(p.verdaechtige, 300, 4),
		falscheFaehrte: kurz(p.falscheFaehrte, 600),
		aufloesung: kurz(p.aufloesung, 600),
		kapitel,
	};
	const leer = !g.kurz && !g.verdaechtige.length && !g.falscheFaehrte && !g.aufloesung && !g.kapitel.length;
	return leer ? undefined : g;
};

/** Claude nennt als Art gern den Namen des Skills. Eine unbekannte Art darf kein fertiges Dokument verstecken. */
const ART_AUS_SKILL: Record<string, Art> = {
	'bild-und-wortkarten': 'karten',
	'stationenlernen': 'stationen',
};
const artAus = (roh: unknown): Art => {
	const art = typeof roh === 'string' ? (ART_AUS_SKILL[roh] ?? roh) : '';
	return ARTEN.includes(art as Art) ? (art as Art) : 'sonstiges';
};

/**
 * Liest `einheit.json`. Ein ungültiger Eintrag fällt heraus, statt den ganzen Plan zu verwerfen: Claude schreibt die
 * Datei oft und ein Tippfehler darf keine fertigen Dokumente verstecken. Der Slug ist der einzige Pfadteil, der aus
 * dem Lauf kommt; er passt auf `ID_MUSTER` oder fällt heraus.
 */
export const lesePlan = (roh: unknown, max = EINHEIT_MAX_DOKUMENTE): EinheitPlan | null => {
	if (typeof roh !== 'object' || roh === null) {
		return null;
	}
	const p = roh as Record<string, unknown>;
	const gesehen = new Set<string>();
	const dokumente = (Array.isArray(p.dokumente) ? p.dokumente : [])
		.map((d): PlanDokument | null => {
			const x = (d ?? {}) as Record<string, unknown>;
			const slug = typeof x.slug === 'string' ? x.slug : '';
			if (!SLUG.test(slug) || slug.length > MAX_SLUG || gesehen.has(slug)) {
				return null;
			}
			if (!FORMATE.includes(x.format as Format)) {
				return null;
			}
			gesehen.add(slug);
			return {
				slug,
				titel: kurz(x.titel, EINHEIT_ZEICHEN.titel) || slug,
				art: artAus(x.art),
				format: x.format as Format,
				zweck: kurz(x.zweck, 300),
				fertig: x.fertig === true,
			};
		})
		.filter((d): d is PlanDokument => d !== null)
		.slice(0, max);
	const geschichte = leseGeschichte(p);
	const recherche = kurz(p.recherche, 1200);
	const stunden = leseStunden(p.stunden, new Set(dokumente.map((d) => d.slug)));
	const figuren = kurzListe(p.figuren, 300, 8);
	const raetselkette = kurz(p.raetselkette, 1200);
	return {
		titel: kurz(p.titel, EINHEIT_ZEICHEN.titel),
		annahmen: kurzListe(p.annahmen, 300, 12),
		dokumente,
		...(geschichte ? { geschichte } : {}),
		...(recherche ? { recherche } : {}),
		...(stunden.length ? { stunden } : {}),
		...(figuren.length ? { figuren } : {}),
		...(raetselkette ? { raetselkette } : {}),
	};
};

/**
 * Was ein Thema der Einheit nicht darf: andere Dateien laden oder aus dem Stil ausbrechen. Die Regeln für Variablen
 * und Eigenschaften prüft `pruefung.js` beim Bauen jedes Dokuments; das hier ist die Sperre davor.
 */
export const themaBefund = (css: string): string | null => {
	if (css.length > 64 * 1024) {
		return 'thema.css ist zu groß.';
	}
	if (/@import|url\s*\(|expression\s*\(|<\/?style|<\/?script|javascript:/i.test(css)) {
		return 'thema.css lädt fremde Inhalte (@import, url() oder Skript).';
	}
	return null;
};

// ——— Wächter: Abgewähltes steht nicht im Material (210) ———

const KLASSE_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const WACHSTUM_BILD = /<img\b[^>]*\bsrc\s*=\s*["'][^"']*\bwachstum(?:-strich)?\.png["']/gi;
const LERNLANDKARTE = /<x-spielplan\b[^>]*\bart\s*=\s*["']lernlandkarte["']/gi;

const stellen = (n: number) => (n === 1 ? 'eine Stelle' : `${n} Stellen`);

/**
 * Was die Lehrkraft abgewählt hat und trotzdem im Material steht, als Befund für die Korrekturrunde. Nur ein Baustein
 * mit `false` zählt: Fragt der Assistent ihn bei der Art nicht ab, gilt der Skill. Die Kennzeichen sind die Bausteine
 * aus `html-materialerstellung/assets/blatt.css`; Kommentare zählen nicht.
 */
export const bausteinVerstoesse = (html: string, bausteine: Partial<Bausteine>): string[] => {
	const quelle = html.replace(/<!--[\s\S]*?-->/g, '');
	const klassen = [...quelle.matchAll(KLASSE_ATTR)].map((t) => (t[1] ?? t[2] ?? '').split(/\s+/));
	const zahl = (passt: (k: string[]) => boolean) => klassen.filter(passt).length;
	const befunde: string[] = [];
	if (bausteine.niveaus === false) {
		const n = zahl((k) => k.includes('niveau') || k.includes('wahlhilfe'));
		if (n) {
			befunde.push(
				`Laut Auftrag ohne drei Niveaus, das Material hat aber Niveau-Punkte oder Wahlhilfe (${stellen(n)} mit .niveau oder .wahlhilfe). Entferne sie und die getrennten Niveau-Seiten: alle Kinder bearbeiten dieselben Aufgaben, steigend im Anspruch.`,
			);
		}
	}
	if (bausteine.selbsteinschaetzung === false) {
		const wachstum = zahl((k) => k.includes('wachstum')) + [...quelle.matchAll(WACHSTUM_BILD)].length;
		const karten = [...quelle.matchAll(LERNLANDKARTE)].length;
		const was = [
			wachstum ? 'die Wachstumsgrafik (.wachstum, wachstum.png)' : '',
			karten ? 'eine Lernlandkarte' : '',
		]
			.filter(Boolean)
			.join(' und ');
		if (was) {
			befunde.push(
				`Laut Auftrag ohne Selbsteinschätzung, das Material hat aber ${was}. Entferne sie samt Reflexionsfrage; der Platz geht an Aufgaben.`,
			);
		}
	}
	if (bausteine.sternchen === false) {
		const n = zahl((k) => k.includes('nr') && k.includes('stern'));
		if (n) {
			befunde.push(
				`Laut Auftrag ohne Sternchenaufgabe, das Material hat aber ${n === 1 ? 'eine' : n} (.nr.stern). Entferne sie.`,
			);
		}
	}
	return befunde;
};

// ——— Prüfungen, die nur Claude im Lauf bekommt (225) ———

/** Material, dessen Menge nach Arbeitszeit geplant wird (`druck-und-platz.md`, „Menge nach Arbeitszeit“). */
export const MIT_ZEITZIEL: readonly Art[] = ['arbeitsblatt', 'stationen', 'lernzielkontrolle', 'klassenarbeit'];
const BODY_TAG = /<body\b[^>]*>/i;

/** Code und Stufe jeder Meldung von `laufMeldungen`; Quelle der Zeilen in `pruef-schwellen` (quellen.ts). */
export const LAUF_MELDUNGEN = {
	'zeitziel-fehlt': 'WARNUNG',
	'loesung-fehlt': 'WARNUNG',
} as const satisfies Partial<Record<MeldungCode, Meldung['stufe']>>;

/**
 * Was der Bau für Claude zusätzlich meldet, als WARNUNG neben dem Prüfbericht: Der Editor zeigt der Lehrkraft beides
 * nicht. Ohne `data-zeit` prüft `pruefung.js` die Menge nicht; nur neues Material (`data-satz="2"`), damit ein älteres
 * Blatt beim Nachbessern nicht in die Zeitprüfung rutscht.
 */
export const laufMeldungen = (html: string, art: Art): Meldung[] => {
	const quelle = html.replace(/<!--[\s\S]*?-->/g, '');
	const meldungen: Meldung[] = [];
	const body = BODY_TAG.exec(quelle)?.[0] ?? '';
	const mitAufgaben = [...quelle.matchAll(KLASSE_ATTR)].some((t) =>
		(t[1] ?? t[2] ?? '').split(/\s+/).includes('aufgabe'),
	);
	if (MIT_ZEITZIEL.includes(art) && hatSatz(quelle) && mitAufgaben && !/\sdata-zeit\s*=/i.test(body)) {
		meldungen.push({
			stufe: LAUF_MELDUNGEN['zeitziel-fehlt'],
			seite: 0,
			code: 'zeitziel-fehlt',
			text: 'Am <body> fehlt data-zeit. Ohne Zeitziel prüft der Bau die Menge nicht → ergänzen und je Aufgabe data-min setzen.',
		});
	}
	let zerlegt;
	try {
		zerlegt = zerlege(quelle);
	} catch {
		return meldungen;
	}
	for (const g of aufgabenOhneLoesung(zerlegt)) {
		const text =
			g.aufgabe === 0
				? `${g.fehlend} ${g.fehlend === 1 ? 'Antwortlinie' : 'Antwortlinien'} außerhalb einer Aufgabe ohne Lösung → data-l ergänzen`
				: g.fehlend === g.linien
					? `Aufgabe ${g.aufgabe} hat keine Lösung → data-l, loesung= oder, bei offener Aufgabe, ein Satz als .nur-loesung`
					: `Aufgabe ${g.aufgabe}: ${g.fehlend} von ${g.linien} Antwortlinien ohne Lösung → data-l ergänzen`;
		meldungen.push({ stufe: LAUF_MELDUNGEN['loesung-fehlt'], seite: g.seite, code: 'loesung-fehlt', text });
	}
	return meldungen;
};

// ——— Stand (Server und Oberfläche) ———

/** `plan`: Claude hat den Plan gezeigt und wartet auf die Freigabe der Lehrkraft. */
export type EinheitStatus = 'laeuft' | 'plan' | 'fertig' | 'unvollstaendig' | 'verworfen';

export interface EinheitBefund {
	slug: string;
	dok: string | null;
	texte: string[];
}

/** Liegt in `stand.json` neben dem Arbeitsordner, wo Claude nicht schreiben darf; `GET /api/einheiten` liefert ihn. */
export interface EinheitStand {
	id: string;
	titel: string;
	ordner: string;
	mappe: string;
	status: EinheitStatus;
	grund: string | null;
	start: string;
	/** Beginn des laufenden Schritts (Plan oder Bau): Die Laufzeit im Band zählt ab hier, wie beim Blatt (190-N04). */
	laufSeit?: string;
	ende: string | null;
	sitzung: string | null;
	plan: EinheitPlan | null;
	importiert: Record<string, { dok: string; kennung: string }>;
	befunde: EinheitBefund[];
	korrigiert: boolean;
	/** Der Teil der Lehrkraft am Auftrag, wie er an Claude ging. */
	auftrag: string;
	bilder: boolean;
	/** Verkauf: `bauen` legt die Seitenbilder für das Deckblatt ab. */
	verkauf?: boolean;
	/** Die Wahl der Lehrkraft; der Server meldet Abgewähltes im Material als Befund (210). Fehlt bei alten Einheiten. */
	bausteine?: Bausteine;
	geladeneBilder: number;
	fehlgeschlageneBilder: number;
	/** Claudes Plan als Text: Geschichte, Rätselkette, Materialien. Die Lehrkraft gibt ihn frei, bevor gebaut wird. */
	planText?: string | null;
	freigegeben?: boolean;
	/**
	 * Der Schritt, den der Server gerade baut (220): Slug des Materials oder `BILDER_SCHRITT`; `null` außerhalb des Baus.
	 * Nach einem Abbruch bleibt er stehen, bis der nächste Durchgang beginnt.
	 */
	inArbeit?: string | null;
	/** Die Reihenfolge des Baus (`bauReihenfolge`), fest ab der Freigabe. Fehlt bei Einheiten vor 220. */
	reihenfolge?: string[];
	/** Je fertigem Material, was spätere wissen müssen (`einheit-bau.ts`). */
	steckbriefe?: Record<string, Steckbrief>;
	/** Der Schritt „Bilder“ ist durch; „Weiterbauen“ überspringt ihn. */
	bilderFertig?: boolean;
	/** Die Lehrkraft will ein eigenes Thema (`thema.css`); fehlt bei Einheiten vor 220. */
	thema?: boolean;
	/** Die Recherche vor dem Plan (219). Fehlt bei Einheiten davor; `laeuft`: Claude recherchiert gerade. */
	recherche?: RechercheStand;
	/** Was die Recherche bekommt: Fach, Klasse, Thema und Ziele, nichts zur Lerngruppe. */
	rechercheAnfrage?: RechercheAnfrage;
	/** Was nach der Korrekturrunde des Planlaufs an der Aufgaben-Übersicht noch nicht stimmt (221). */
	planBefunde?: string[];
	/** Je geprüftem Material der Stand der Prüfung (220, Teil 2). Fehlt bei Einheiten davor. */
	pruefung?: Record<string, PruefStand>;
	/** Der Schlusslauf über alle Materialien; fehlt, bis er beginnt. */
	schluss?: SchlussStand;
}
