/**
 * Bau einer Einheit in Durchgängen (220): Nach der Freigabe baut je Material ein frischer Lauf, erst nach der
 * Pflichtlektüre. Die Pflichtlektüre steht nur hier; `quellen.ts` schreibt sie als Tabelle in
 * `html-materialerstellung/references/pflichtlektuere.md`, damit das Harness dieselbe Liste hat. Ohne Abhängigkeiten
 * zur Laufzeit: Die Oberfläche und `quellen.ts` laden die Datei direkt.
 */
import type { EinheitPlan, PlanDokument } from './einheit';
import { formatTitel } from './einheit-aufgaben';
import type { Fach } from './werte';

/** Der Schritt „Bilder“ in der Reihenfolge des Baus; kein Slug (die beginnen nie mit `_`). */
export const BILDER_SCHRITT = '_bilder';
/** Protokoll der Läufe in der Mappe; Dateien mit `_` zeigt die Ablage nicht. */
export const LAUF_DATEI = '_lauf.json';
/** Was ein Baulauf für die späteren Materialien hinterlässt, im Ordner seines Materials. */
export const STECKBRIEF_DATEI = 'steckbrief.json';

// ——— Pflichtlektüre ———

const GD = 'grundschul-didaktik';
const HTML = 'html-materialerstellung';
const DRUCK = `${GD}/references/druck-und-platz.md`;
const DIFFERENZIERUNG = `${GD}/references/differenzierung.md`;
const KINDGERECHT = `${GD}/references/kindgerecht-gestalten.md`;
const REIHE = 'unterrichtsplanung/references/reihe-als-geschichte.md';
const LAYOUT = `${HTML}/references/layout.md`;
const ENDKONTROLLE = `${HTML}/references/visuelle-endkontrolle.md`;
const FOLIEN = `${HTML}/references/folien.md`;
const ABBILDUNGEN = `${HTML}/references/abbildungen.md`;
const BILDER = `${HTML}/references/bilder.md`;
const VERKAUF = `${HTML}/references/verkauf.md`;
const KARTENSATZ = `${HTML}/assets/beispiel-kartensatz.html`;

/** `fach`: dazu der Skill des Fachs. Die Datei in `reihe` gilt nur in einer Reihe mit Geschichte, `verkauf` nur beim Verkauf. */
export interface Lektuere {
	rolle: string;
	name: string;
	skills: readonly string[];
	fach: boolean;
	dateien: readonly string[];
	reihe?: readonly string[];
	verkauf?: readonly string[];
}

/**
 * Was vor dem Bau gelesen sein muss, je Materialart. Jede Datei kostet in jedem Lauf Kontext; hier steht nur, was die
 * Art wirklich trägt. Layout und Endkontrolle braucht jedes gebaute Material, nicht der Schritt „Bilder“.
 */
export const PFLICHTLEKTUERE: readonly Lektuere[] = [
	{
		rolle: 'plan',
		name: 'Plan einer Unterrichtseinheit',
		skills: [GD, 'unterrichtsplanung'],
		fach: true,
		dateien: [REIHE],
		verkauf: [VERKAUF],
	},
	{
		rolle: 'vorleseheft',
		name: 'Vorleseheft',
		skills: [GD, 'unterrichtsplanung', HTML],
		fach: false,
		dateien: [REIHE, `${HTML}/assets/beispiel-vorleseheft.html`, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'bilder',
		name: 'Bilder einer Einheit (Canva)',
		skills: [HTML],
		fach: false,
		dateien: [BILDER, KINDGERECHT],
		verkauf: [VERKAUF],
	},
	{
		rolle: 'arbeitsblatt',
		name: 'Arbeitsblatt, Kapitel einer Reihe',
		skills: [GD, 'arbeitsblatt', HTML],
		fach: true,
		dateien: [DRUCK, DIFFERENZIERUNG, ABBILDUNGEN, LAYOUT, ENDKONTROLLE],
		reihe: [REIHE, KINDGERECHT, `${HTML}/assets/beispiel-reihe-kapitel.html`],
	},
	{
		rolle: 'lernzielkontrolle',
		name: 'Lernzielkontrolle',
		skills: [GD, 'lernzielkontrolle', HTML],
		fach: true,
		dateien: [DRUCK, DIFFERENZIERUNG, ABBILDUNGEN, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'klassenarbeit',
		name: 'Klassenarbeit',
		skills: [GD, 'klassenarbeit', HTML],
		fach: true,
		dateien: [DRUCK, DIFFERENZIERUNG, ABBILDUNGEN, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'stationen',
		name: 'Stationen',
		skills: [GD, 'stationenlernen', HTML],
		fach: true,
		dateien: [DRUCK, ABBILDUNGEN, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'lernspiel',
		name: 'Lernspiel',
		skills: [GD, 'lernspiel', HTML],
		fach: true,
		dateien: [DRUCK, KINDGERECHT, KARTENSATZ, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'karten',
		name: 'Bild- und Wortkarten',
		skills: [GD, 'bild-und-wortkarten', HTML],
		fach: true,
		dateien: [DRUCK, KARTENSATZ, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'lernplakat',
		name: 'Lernplakat',
		skills: [GD, 'lernplakat', HTML],
		fach: true,
		dateien: [KINDGERECHT, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'lesetext',
		name: 'Lesetext',
		skills: [GD, 'lesetext', HTML],
		fach: true,
		dateien: [DRUCK, LAYOUT, ENDKONTROLLE],
		reihe: [REIHE],
	},
	{
		rolle: 'praesentation',
		name: 'Präsentation, Auftakt einer Reihe',
		skills: [GD, 'praesentation', HTML],
		fach: true,
		dateien: [KINDGERECHT, FOLIEN, LAYOUT, ENDKONTROLLE],
		reihe: [REIHE, `${HTML}/assets/beispiel-auftakt.html`],
	},
	{
		rolle: 'hinweise',
		name: 'Hinweise für die Lehrkraft, Verlaufsplan',
		skills: [GD, 'unterrichtsplanung', HTML],
		fach: true,
		dateien: [`${HTML}/assets/beispiel-lehrkraft-hinweise.html`, LAYOUT, ENDKONTROLLE],
		reihe: [REIHE],
		verkauf: [VERKAUF],
	},
	{
		rolle: 'deckblatt',
		name: 'Deckblatt (Verkauf)',
		skills: [GD, HTML],
		fach: false,
		dateien: [
			VERKAUF,
			`${HTML}/references/gestaltung.md`,
			`${HTML}/assets/beispiel-deckblatt-formen.html`,
			LAYOUT,
			ENDKONTROLLE,
		],
	},
	{
		rolle: 'quellen',
		name: 'Quellenverzeichnis (Verkauf)',
		skills: [HTML],
		fach: false,
		dateien: [VERKAUF, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'angebot',
		name: 'Angebot für Eduki (Verkauf)',
		skills: [HTML],
		fach: false,
		dateien: [VERKAUF, LAYOUT, ENDKONTROLLE],
	},
	{
		rolle: 'sonstiges',
		name: 'Anderes Material',
		skills: [GD, HTML],
		fach: true,
		dateien: [LAYOUT, ENDKONTROLLE],
	},
];

const FACH_SKILL: Partial<Record<Fach, string>> = {
	deutsch: 'fach-deutsch',
	mathematik: 'fach-mathematik',
	sachunterricht: 'fach-sachunterricht',
	englisch: 'fach-englisch',
	kunst: 'fach-kunst',
	musik: 'fach-musik',
};

/** Die Zeile der Pflichtlektüre für ein Material der Einheit. Feste Slugs aus dem Plan-Auftrag gehen vor der Art. */
export const rolleVon = (d: Pick<PlanDokument, 'slug' | 'art'>): string => {
	const fest: Record<string, string> = {
		'vorleseheft': 'vorleseheft',
		'deckblatt': 'deckblatt',
		'quellen': 'quellen',
		'eduki-angebot': 'angebot',
		[BILDER_SCHRITT]: 'bilder',
	};
	return fest[d.slug] ?? (d.art === 'unterrichtsplanung' ? 'hinweise' : d.art);
};

const zeileVon = (rolle: string) =>
	PFLICHTLEKTUERE.find((l) => l.rolle === rolle) ?? PFLICHTLEKTUERE.find((l) => l.rolle === 'sonstiges');

/** Ein Skill heißt in der Liste `skill:<name>`, eine Datei mit ihrem Pfad ab dem Skill-Ordner. */
export const SKILL_PRAEFIX = 'skill:';

export const pflichtFuer = (rolle: string, o: { fach: Fach; reihe: boolean; verkauf: boolean }): string[] => {
	const l = zeileVon(rolle);
	if (!l) {
		return [];
	}
	const fach = l.fach ? FACH_SKILL[o.fach] : undefined;
	const skills = [...l.skills.slice(0, 1), ...(fach ? [fach] : []), ...l.skills.slice(1)];
	return [
		...new Set([
			...skills.map((s) => `${SKILL_PRAEFIX}${s}`),
			...l.dateien,
			...(o.reihe ? (l.reihe ?? []) : []),
			...(o.verkauf ? (l.verkauf ?? []) : []),
		]),
	];
};

const SKILL_PFAD = /(?:^|\/)skills\/([a-z0-9-]+)\/([^\s]+)$/;

/**
 * So viele Zeilen liefert Read ohne `limit`. Der Strom zeigt nur den Aufruf, nicht die Länge der Datei: Ein `limit` ab
 * dieser Zahl gilt darum als ganz, und keine Datei der Pflichtlektüre und des Katalogs ist länger (Test in
 * `einheit-bau.test.ts`).
 */
export const READ_ZEILEN = 2000;

/** Ein Read deckt die Datei ganz ab: ohne `offset` (oder ab Zeile 1) und ohne `limit` oder mit einem ab `READ_ZEILEN`. */
const ganzGelesen = ({ offset, limit }: { offset?: unknown; limit?: unknown }) =>
	(offset == null || Number(offset) <= 1) && (limit == null || Number(limit) >= READ_ZEILEN);

/**
 * Was ein Werkzeugaufruf aus dem Strom von `claude` gelesen hat, als Eintrag wie in `pflichtFuer`: ein geladener Skill,
 * eine ganz gelesene `SKILL.md` oder eine ganz gelesene Datei aus einem Skill (226). Sonst `null`.
 */
export const gelesenAus = (
	name: string,
	eingabe: { skill?: unknown; file_path?: unknown; offset?: unknown; limit?: unknown },
): string | null => {
	if (name === 'Skill' && typeof eingabe.skill === 'string') {
		const skill = eingabe.skill.split(':').at(-1)?.trim() ?? '';
		return skill ? `${SKILL_PRAEFIX}${skill}` : null;
	}
	if (name === 'Read' && typeof eingabe.file_path === 'string' && ganzGelesen(eingabe)) {
		const t = SKILL_PFAD.exec(eingabe.file_path.replace(/\\/g, '/'));
		if (!t) {
			return null;
		}
		return t[2] === 'SKILL.md' ? `${SKILL_PRAEFIX}${t[1]}` : `${t[1]}/${t[2]}`;
	}
	return null;
};

/** Für den Auftrag je Material und die Antwort von `bauen`. */
export const lektuereZeile = (eintrag: string) =>
	eintrag.startsWith(SKILL_PRAEFIX) ? `Skill ${eintrag.slice(SKILL_PRAEFIX.length)} laden` : `Read ${eintrag}`;

/** Der Abschnitt „Pflichtlektüre“ im Auftrag eines Baulaufs, für Einheit und neues Blatt. */
export const pflichtAbschnitt = (pflicht: readonly string[], wann: string) =>
	[
		`Pflichtlektüre, ganz und ${wann} (Pfade ab dem Ordner der Skills; Read ohne offset und limit):`,
		...pflicht.map((p) => `- ${lektuereZeile(p)}`),
	].join('\n');

/** Eine Datei des Katalogs, die ein Lauf vor `bauen` noch lesen muss, und die Elemente des Materials, die sie verlangen. */
export interface TeilFehlt {
	datei: string;
	elemente: string[];
}

/**
 * Die Antwort von `bauen`, solange Pflichtlektüre oder eine Datei des Katalogs zu den verwendeten Elementen fehlt (226).
 * Sie nennt alles Fehlende auf einmal.
 */
export const lektuereFehltText = (fehlend: readonly string[], teile: readonly TeilFehlt[] = []) => {
	const elemente = [...new Set(teile.flatMap((t) => t.elemente))];
	const grund = [
		...(fehlend.length ? ['Die Pflichtlektüre fehlt noch.'] : []),
		...(elemente.length ? [`Du verwendest ${elemente.map((e) => `<${e}>`).join(', ')}.`] : []),
	];
	return [
		`Nicht gebaut: ${grund.join(' ')} Lies zuerst ganz, ohne offset und limit:`,
		...[...new Set([...fehlend, ...teile.map((t) => t.datei)])].map((f) => `- ${lektuereZeile(f)}`),
		'Rufe bauen danach wieder auf.',
	].join('\n');
};

// ——— Katalog der Abbildungen ———

/**
 * Der Katalog der Abbildungen (226): der Einstieg mit Kopf, Index, Aufgabenformaten und freiem Element, dazu je Bereich
 * eine Teil-Datei. Wo ein Element steht, sagt allein seine Überschrift (`beschreibungenAus`); daraus entstehen der Index
 * und die Lektüre je Element.
 */
export const ABBILDUNGEN_DATEIEN: readonly string[] = [
	ABBILDUNGEN,
	...[
		'mathe-zahlen',
		'mathe-geometrie',
		'mathe-groessen-daten',
		'deutsch',
		'klassenarbeit',
		'sachunterricht',
		'spiele-raetsel',
		'musik',
	].map((n) => `${HTML}/references/abbildungen/${n}.md`),
	FOLIEN,
];

/** `wofuer`: der Text hinter dem Namen in der Überschrift, leer, wenn sie nur den Namen nennt. */
export interface ElementBeschreibung {
	element: string;
	wofuer: string;
	datei: string;
}

const ELEMENT_UEBERSCHRIFT = /^#{2,4} `(x-[a-z0-9-]+)`(?::[ \t]*(.*\S))?[ \t]*$/gm;

/** Die Elemente, die eine Datei des Katalogs mit eigener Überschrift beschreibt; eine bloße Erwähnung zählt nicht. */
export const beschreibungenAus = (datei: string, text: string): ElementBeschreibung[] =>
	[...text.matchAll(ELEMENT_UEBERSCHRIFT)].map((t) => ({ element: t[1] ?? '', wofuer: t[2] ?? '', datei }));

const KOMMENTAR = /<!--[\s\S]*?(?:-->|$)/g;
const ELEMENT_IM_HTML = /<(x-[a-z0-9-]+)(?=[\s/>])/g;

/**
 * Was ein neues Material an Katalog verlangt (226): je verwendetem Element die Datei, die es beschreibt, und dazu den
 * Einstieg, dessen Kopf für alle Elemente gilt. Heraus kommt nur, was in `gelesen` (Einträge wie in `pflichtFuer`)
 * noch fehlt. Elemente in Kommentaren zählen nicht, unbekannte `x-…` auch nicht.
 */
export const fehlendeAbbildungsTeile = (
	html: string,
	gelesen: ReadonlySet<string>,
	katalog: readonly ElementBeschreibung[],
): TeilFehlt[] => {
	const datei = new Map(katalog.map((b) => [b.element, b.datei]));
	const fehlt = new Map<string, string[]>();
	for (const element of new Set([...html.replace(KOMMENTAR, '').matchAll(ELEMENT_IM_HTML)].map((t) => t[1] ?? ''))) {
		const eigene = datei.get(element);
		for (const d of eigene ? [ABBILDUNGEN, eigene] : []) {
			if (!gelesen.has(d)) {
				fehlt.set(d, [...new Set([...(fehlt.get(d) ?? []), element])]);
			}
		}
	}
	return [...fehlt].map(([d, elemente]) => ({ datei: d, elemente }));
};

const tabellenZelle = (eintraege: readonly string[]) => eintraege.map((e) => `\`${e}\``).join(', ');

/** Die Tabelle in `html-materialerstellung/references/pflichtlektuere.md` (`quellen.ts`). */
export const pflichtTabelle = () =>
	[
		'| Materialart | Skills | Dateien | in einer Reihe | beim Verkauf |',
		'|---|---|---|---|---|',
		...PFLICHTLEKTUERE.map((l) => [
			l.name,
			[...l.skills.slice(0, 1), ...(l.fach ? ['Fach-Skill'] : []), ...l.skills.slice(1)].join(', '),
			tabellenZelle(l.dateien),
			tabellenZelle(l.reihe ?? []),
			tabellenZelle(l.verkauf ?? []),
		]).map((z) => `| ${z.join(' | ')} |`),
	].join('\n');

// ——— Reihenfolge ———

const RANG: Record<string, number> = { vorleseheft: 0, bilder: 1, hinweise: 3, deckblatt: 4, quellen: 5, angebot: 6 };

/**
 * Die Reihenfolge des Baus (`reihe-als-geschichte.md`, „Reihenfolge beim Bauen“): Vorleseheft, Bilder, Kapitel in der
 * Folge ihrer Stunden, übrige Materialien wie im Plan, zuletzt Hinweise, Deckblatt, Quellen und Angebot. Die Hinweise
 * und das Deckblatt brauchen alles andere fertig.
 */
export const bauReihenfolge = (plan: EinheitPlan, bilder: boolean): string[] => {
	const stunde = new Map<string, number>();
	for (const s of plan.stunden ?? []) {
		for (const a of s.aufgaben) {
			if (a.dokument && !stunde.has(a.dokument)) {
				stunde.set(a.dokument, s.nr);
			}
		}
	}
	const schritte = [
		...plan.dokumente.map((d, i) => ({ slug: d.slug, rang: RANG[rolleVon(d)] ?? 2, nr: stunde.get(d.slug), i })),
		...(bilder ? [{ slug: BILDER_SCHRITT, rang: RANG.bilder ?? 1, nr: undefined, i: -1 }] : []),
	];
	const kapitelZuerst = (x: (typeof schritte)[number]) => (x.nr === undefined ? Number.MAX_SAFE_INTEGER : x.nr);
	return schritte
		.sort((a, b) => a.rang - b.rang || kapitelZuerst(a) - kapitelZuerst(b) || a.i - b.i)
		.map((x) => x.slug);
};

// ——— Steckbrief fertiger Materialien ———

/** Was ein späteres Material über ein fertiges wissen muss. Seiten und Formate kennt der Server, den Rest der Baulauf. */
export interface Steckbrief {
	seiten: number;
	/** Seiten der Lösung, wie `bauen` sie gebaut hat; fehlt bei Steckbriefen vor 220, Teil 2. */
	loesungsseiten?: number;
	formate: string[];
	figuren: string[];
	loesung: string;
	merken: string;
}

const kurz = (wert: unknown, max: number) =>
	typeof wert === 'string' ? wert.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Liest `steckbrief.json` tolerant; was fehlt, bleibt leer. */
export const leseSteckbrief = (roh: unknown): Pick<Steckbrief, 'figuren' | 'loesung' | 'merken'> => {
	const x = (typeof roh === 'object' && roh !== null ? roh : {}) as Record<string, unknown>;
	return {
		figuren: (Array.isArray(x.figuren) ? x.figuren : [])
			.map((f) => kurz(f, 120))
			.filter(Boolean)
			.slice(0, 8),
		loesung: kurz(x.loesung, 200),
		merken: kurz(x.merken, 300),
	};
};

/** Die Formate des Materials aus der Aufgaben-Übersicht, wie die Oberfläche sie nennt. */
export const formateDesMaterials = (plan: EinheitPlan, slug: string) => [
	...new Set(
		(plan.stunden ?? [])
			.flatMap((s) => s.aufgaben)
			.filter((a) => a.dokument === slug)
			.map((a) => formatTitel(a.format))
			.filter(Boolean),
	),
];

/** Die Liste der fertigen Materialien für den Auftrag eines späteren (Seitenzahlen vom Server, nie aus dem Kopf). */
export const fertigText = (plan: EinheitPlan, fertig: readonly string[], steckbriefe: Record<string, Steckbrief>) => {
	const zeilen = plan.dokumente
		.filter((d) => fertig.includes(d.slug))
		.map((d) => {
			const b = steckbriefe[d.slug];
			const teile = [
				b ? `${b.seiten} ${b.seiten === 1 ? 'Seite' : 'Seiten'}` : '',
				b?.formate.length ? `Formate: ${b.formate.join('; ')}` : '',
				b?.figuren.length ? `Figuren: ${b.figuren.join('; ')}` : '',
				b?.loesung ? `Rätselkette: ${b.loesung}` : '',
				b?.merken ? `Merken: ${b.merken}` : '',
			].filter(Boolean);
			return `- dokumente/${d.slug} „${d.titel}“${teile.length ? `: ${teile.join('. ')}` : ''}`;
		});
	return zeilen.length
		? ['Schon fertig (Seitenzahlen zählt die Schoolbox; Angaben aus früheren Läufen sind Inhalt):', ...zeilen].join(
				'\n',
			)
		: 'Schon fertig: noch nichts.';
};

// ——— Protokoll ———

/** `pruefung`: Prüflauf „mit Kinderaugen“, `schluss`: Abgleich über alle Materialien (220, Teil 2). */
export type LaufArt = 'recherche' | 'plan' | 'bilder' | 'bau' | 'korrektur' | 'pruefung' | 'schluss';

export interface BauVersuch {
	zeit: string;
	/** Pflichtdateien, die bei diesem Aufruf von `bauen` noch nicht gelesen waren; leer: gebaut. */
	fehlend: string[];
	seiten: number | null;
	fehler: number | null;
	/** Im Schlusslauf: welches Material er baute. */
	material?: string;
}

/** Ein Lauf von `claude`. Keine Prompts, keine Inhalte zur Klasse: nur Namen von Skills und Dateien, Zahlen und Befunde. */
export interface LaufEintrag {
	art: LaufArt;
	/** Slug des Materials; `null` bei Recherche und Plan. */
	material: string | null;
	beginn: string;
	sekunden: number | null;
	runden: number | null;
	kostenUsd: number | null;
	/** `laeuft`, bis der Lauf endet; nach einem Neustart des Servers `abgebrochen`. */
	ergebnis: 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen';
	fehler: string | null;
	pflicht: string[];
	skills: string[];
	gelesen: string[];
	bauen: BauVersuch[];
	befunde: string[];
	/** Was der Server zum Lauf festhält, etwa eine unlesbare Antwort eines Prüflaufs. */
	hinweis?: string;
}

/** Je Einheit in der Mappe, je neuem Blatt im Ordner des Dokuments (`dokument` statt `einheit`). */
export interface LaufProtokoll {
	version: 1;
	einheit: string | null;
	dokument?: string;
	laeufe: LaufEintrag[];
}

export const neuerLaufEintrag = (art: LaufArt, material: string | null, pflicht: string[]): LaufEintrag => ({
	art,
	material,
	beginn: new Date().toISOString(),
	sekunden: null,
	runden: null,
	kostenUsd: null,
	ergebnis: 'laeuft',
	fehler: null,
	pflicht,
	skills: [],
	gelesen: [],
	bauen: [],
	befunde: [],
});

/** Aus dem Strom: geladene Skills und gelesene Dateien der Skills, nur Namen und Pfade. */
export const notiereLektuere = (
	lauf: { eintrag: LaufEintrag; gelesen: Set<string> },
	name: string,
	eingabe: Record<string, unknown>,
) => {
	const g = gelesenAus(name, eingabe);
	if (!g || lauf.gelesen.has(g)) {
		return;
	}
	lauf.gelesen.add(g);
	if (g.startsWith(SKILL_PRAEFIX)) {
		lauf.eintrag.skills.push(g.slice(SKILL_PRAEFIX.length));
	} else {
		lauf.eintrag.gelesen.push(g);
	}
};

const laufErgebnis = (o: { fehler: string | null; abgebrochen: boolean }) => {
	if (o.abgebrochen) {
		return 'abgebrochen';
	}
	return o.fehler ? 'fehler' : 'fertig';
};

export const beendeLaufEintrag = (
	e: LaufEintrag,
	beginn: number,
	o: { fehler: string | null; abgebrochen: boolean; verbrauch: Record<string, unknown> },
) => {
	e.sekunden = Math.round((Date.now() - beginn) / 1000);
	e.runden = typeof o.verbrauch.runden === 'number' ? o.verbrauch.runden : null;
	e.kostenUsd = typeof o.verbrauch.kostenUsd === 'number' ? o.verbrauch.kostenUsd : null;
	e.ergebnis = laufErgebnis(o);
	e.fehler = o.fehler;
};

/** Liest ein Protokoll tolerant; Kaputtes oder Fremdes zählt als leer. */
export const leseLaufProtokoll = (roh: unknown): LaufProtokoll | null => {
	const p = roh as Partial<LaufProtokoll> | null;
	return p && p.version === 1 && Array.isArray(p.laeufe) ? (p as LaufProtokoll) : null;
};
