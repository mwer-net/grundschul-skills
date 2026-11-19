/**
 * Aufgaben-Übersicht im Plan einer Einheit (221): je Stunde Handlungsform, neue Fachwörter und die Aufgaben mit
 * Format und Anforderungsbereich. Der Server zählt nach festen Regeln (`arbeitsblatt/SKILL.md`, „Abwechslung über
 * mehrere Blätter“; `unterrichtsplanung/references/reihe-als-geschichte.md`, „Die Aufgaben der ganzen Reihe“) und
 * gibt Verstöße in eine Korrekturrunde des Planlaufs. Die Liste der Formate ist die Quelle für Skill und Auftrag
 * (`quellen.ts`). Ohne Abhängigkeiten: Die Oberfläche und `quellen.ts` laden die Datei direkt.
 */
import type { EinheitPlan } from './einheit';
import type { Klasse } from './werte';

export interface AufgabenFormat {
	/** Der Name im Plan (`einheit.json`). */
	name: string;
	titel: string;
	geeignet: string;
	hinweis: string;
}

/** Aus der Tabelle „Bewährte Aufgabenformate“ (`arbeitsblatt`) und den Stufen der Geometrie (`fach-mathematik`). */
export const AUFGABEN_FORMATE: readonly AufgabenFormat[] = [
	{
		name: 'zuordnen',
		titel: 'Zuordnen / Verbinden',
		geeignet: 'Kl. 1–2, Begriffe, Bild-Wort',
		hinweis: 'Max. 6 Paare, `x-zuordnen`',
	},
	{
		name: 'lueckentext',
		titel: 'Lückentext mit Wortauswahl',
		geeignet: 'Deutsch, Sachunterricht, Merksatz',
		hinweis: '`x-lueckentext`, `x-wortspeicher`',
	},
	{
		name: 'ankreuzen',
		titel: 'Ankreuzen / Einkreisen',
		geeignet: 'Verständnis, Wortarten',
		hinweis: '`x-ankreuzen`',
	},
	{
		name: 'richtig-falsch',
		titel: 'Richtig oder falsch („Stimmt das?“)',
		geeignet: 'Prüfen, Fehlvorstellungen',
		hinweis: '`x-richtigfalsch`; auch „ja oder nein“ schreiben',
	},
	{
		name: 'malen-nach-ergebnis',
		titel: 'Malen nach Ergebnis / Bildpuzzle',
		geeignet: 'Mathe-Übung mit Selbstkontrolle',
		hinweis: 'Farbschlüssel als ausgeschriebene Farbnamen, Bild als Strichzeichnung',
	},
	{
		name: 'rechenformat',
		titel: 'Zahlenmauer, Rechendreieck, Zahlenhaus',
		geeignet: 'Mathe, produktives Üben',
		hinweis: 'Siehe `fach-mathematik`',
	},
	{
		name: 'beschriften',
		titel: 'Beschriften',
		geeignet: 'Sachunterricht (Körper, Pflanze)',
		hinweis: '`x-beschriften` mit Wortspeicher',
	},
	{
		name: 'schreibrahmen',
		titel: 'Schreibrahmen',
		geeignet: 'Texte, Protokolle',
		hinweis: 'Satzanfänge vorgeben, Element `x-schreibrahmen` (Lineatur nach der Klasse)',
	},
	{
		name: 'forscheraufgabe',
		titel: 'Forscheraufgabe / offene Aufgabe',
		geeignet: 'Alle Fächer, natürliche Differenzierung',
		hinweis: '„Finde möglichst viele …“',
	},
	{
		name: 'fehler-finden',
		titel: 'Fehler finden („Die Leitfigur hat sich vertan“)',
		geeignet: 'Rechnen ab Kl. 2, Rechtschreibung erst ab Kl. 3',
		hinweis: 'Fehleranzahl angeben („Finde 3 Fehler.“)',
	},
	{
		name: 'legen-bauen-falten',
		titel: 'Legen, bauen, falten und festhalten',
		geeignet: 'Geometrie, Mengen, Sachunterricht',
		hinweis: 'Material nennen („Lege mit Plättchen.“), das Blatt hält das Ergebnis fest (zeichnen, ankreuzen)',
	},
	{
		name: 'ins-heft',
		titel: 'Ins Heft',
		geeignet: 'Zeichnen, Rechnen, Schreiben',
		hinweis: '„Im Heft:“ mit dem Anfang des Eintrags als Heft-Beispiel (`.kasten`)',
	},
	{
		name: 'beobachten',
		titel: 'Tun und beobachten (Beobachtungsbogen)',
		geeignet: 'Handlungsziele, vor allem in der Lernzielkontrolle',
		hinweis: 'Das Kind tut es mit Material oder Werkzeug, die Lehrkraft hakt je Kind in einer Tabelle ab, was gelingt',
	},
	{
		name: 'ergaenzen',
		titel: 'Ergänzen (Figur, Muster, Reihe)',
		geeignet: 'Geometrie, Muster und Strukturen',
		hinweis: '`x-gitter aufgabe="spiegeln"`; Stufen in `fach-mathematik`',
	},
	{
		name: 'einzeichnen',
		titel: 'Einzeichnen (Achse, Linie, Weg)',
		geeignet: 'Geometrie, Karten, Sachunterricht',
		hinweis: 'Lineal nennen, wenn gerade Linien verlangt sind',
	},
	{
		name: 'sortieren',
		titel: 'Sortieren / Ordnen',
		geeignet: 'Begriffe, Größen, Reihenfolgen',
		hinweis: 'Tabelle mit Spalten oder Nummern zum Eintragen',
	},
	{
		name: 'erklaeren',
		titel: 'Erklären / Begründen',
		geeignet: 'Anforderungsbereich III',
		hinweis: 'In Kl. 1/2 mit Satzanfang oder zum Ankreuzen (`grundschul-didaktik/references/sprachsensibel.md`)',
	},
	{
		name: 'raetsel',
		titel: 'Suchsel, Kreuzworträtsel',
		geeignet: 'Wortschatz',
		hinweis: '`x-suchsel`, `x-kreuzwort`, nur mit Anschlussaufgabe',
	},
];

/**
 * Formate, bei denen das Kind die Handlung selbst ausführt (250): Sie prüfen in der Lernzielkontrolle ein Ziel mit
 * `handlung`. `legen-bauen-falten` hält das Ergebnis auf dem Blatt fest, `beobachten` die Lehrkraft auf einem Bogen.
 */
export const HANDLUNGS_FORMATE: readonly string[] = ['legen-bauen-falten', 'beobachten'];

/** Wie oft ein Format in einer Reihe vorkommen darf (218). */
export const FORMAT_HOECHSTENS = 2;
const FORMAT_ZEICHEN = 40;
const MAX_STUNDEN = 30;
const MAX_AUFGABEN = 16;
/** Grenzen der Felder für Zeit und Ziel (247): Minuten einer Stunde oder Phase, Phasen je Stunde, Ziele je Plan. */
export const PLAN_ZEIT_GRENZEN = { minuten: 240, phasen: 12, was: 120, ziele: 12, ziel: 200 } as const;
export const NIVEAUS = [1, 2, 3] as const;
export type Niveau = (typeof NIVEAUS)[number];

export const ANFORDERUNGSBEREICHE = ['I', 'II', 'III'] as const;
export type Anforderungsbereich = (typeof ANFORDERUNGSBEREICHE)[number];

export interface PlanAufgabe {
	/** Slug des Materials, auf dem die Aufgabe steht; leer, wenn er im Plan fehlt. */
	dokument: string;
	/** Ein Name aus `AUFGABEN_FORMATE` oder ein freier kurzer Name. */
	format: string;
	inhalt: string;
	bereich: Anforderungsbereich | null;
	zweitesMal: boolean;
	/** 247: Nummer des Ich-kann-Ziels aus `EinheitPlan.ziele`, das die Aufgabe übt oder prüft. */
	ziel?: number;
	/** 247: geschätzte Arbeitszeit eines Kindes in Minuten. */
	minuten?: number;
	/** 247: Niveau (●, ●●, ●●●) bei drei Niveaus zur Wahl; fehlt bei einer Aufgabe für alle. */
	niveau?: Niveau;
}

/** Ein Abschnitt der Stunde mit seiner Dauer (247); `arbeit`: die Kinder arbeiten an den Aufgaben der Stunde. */
export interface PlanPhase {
	was: string;
	minuten: number;
	arbeit: boolean;
}

/** Ein Ich-kann-Ziel des Plans (247); Stunden und Aufgaben nennen es über `nr`. */
export interface PlanZiel {
	nr: number;
	text: string;
	/** 250: Das Ziel verlangt eine Handlung mit Material oder Werkzeug; fehlt bei Plänen davor und bei Zielen ohne. */
	handlung?: boolean;
}

export interface PlanStunde {
	nr: number;
	handlung: string;
	begriffe: string[];
	aufgaben: PlanAufgabe[];
	/** Lernzielkontrolle: nutzt die Formate der Reihe mit neuen Items und zählt nicht mit. */
	kontrolle: boolean;
	/** 247: Länge der Stunde in Minuten; fehlt bei Plänen davor. */
	minuten?: number;
	/** 247: Nummer des Ich-kann-Ziels der Stunde. */
	ziel?: number;
	/** 247: der Ablauf der Stunde mit Minuten. */
	phasen?: PlanPhase[];
}

const gleich = (wert: string) => wert.toLowerCase().replace(/\s+/g, ' ').trim();

/** Der Name im Plan: ein fester, auch wenn Claude den Titel schreibt, sonst der freie Name. */
export const formatAus = (roh: unknown) => {
	const t = (typeof roh === 'string' ? roh : '')
		.replace(/^\s*frei\s*:/i, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, FORMAT_ZEICHEN);
	const k = gleich(t);
	return AUFGABEN_FORMATE.find((f) => f.name === k || gleich(f.titel) === k)?.name ?? t;
};

/** Für die Lehrkraft: der Titel eines festen Formats, sonst der freie Name. */
export const formatTitel = (format: string) => AUFGABEN_FORMATE.find((f) => f.name === format)?.titel ?? format;

const kurz = (wert: unknown, max: number) => (typeof wert === 'string' ? wert.trim().slice(0, max) : '');

/** Eine ganze Zahl von 1 bis `max` (auch als Text), sonst `undefined`. */
const ganz = (wert: unknown, max: number) => {
	const n = typeof wert === 'string' && wert.trim() ? Number(wert) : wert;
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
};

const lesePhasen = (roh: unknown): PlanPhase[] =>
	(Array.isArray(roh) ? roh : [])
		.map((p): PlanPhase | null => {
			const x = (p ?? {}) as Record<string, unknown>;
			const minuten = ganz(x.minuten, PLAN_ZEIT_GRENZEN.minuten);
			const was = kurz(x.was, PLAN_ZEIT_GRENZEN.was);
			return minuten && was ? { was, minuten, arbeit: x.arbeit === true } : null;
		})
		.filter((p): p is PlanPhase => p !== null)
		.slice(0, PLAN_ZEIT_GRENZEN.phasen);

/** Liest `ziele` aus `einheit.json` (247): je Ziel Nummer und Ich-kann-Satz, eine Nummer nur einmal. */
export const leseZiele = (roh: unknown): PlanZiel[] => {
	const gesehen = new Set<number>();
	return (Array.isArray(roh) ? roh : [])
		.map((z): PlanZiel | null => {
			const x = (z ?? {}) as Record<string, unknown>;
			const nr = ganz(x.nr, PLAN_ZEIT_GRENZEN.ziele * 2);
			const text = kurz(x.text, PLAN_ZEIT_GRENZEN.ziel);
			if (!nr || !text || gesehen.has(nr)) {
				return null;
			}
			gesehen.add(nr);
			return { nr, text, ...(x.handlung === true ? { handlung: true } : {}) };
		})
		.filter((z): z is PlanZiel => z !== null)
		.slice(0, PLAN_ZEIT_GRENZEN.ziele);
};

/** Die Felder aus 247 nur, wenn sie gültig dastehen: Alte Pläne behalten ihre Form. */
const mitZahlen = (x: Record<string, unknown>) => {
	const ziel = ganz(x.ziel, PLAN_ZEIT_GRENZEN.ziele * 2);
	const minuten = ganz(x.minuten, PLAN_ZEIT_GRENZEN.minuten);
	return { ...(ziel ? { ziel } : {}), ...(minuten ? { minuten } : {}) };
};

/** Liest `stunden` aus `einheit.json` tolerant wie `lesePlan`: Ungültiges fällt heraus, eine Stunde je Nummer. */
export const leseStunden = (roh: unknown, slugs: ReadonlySet<string>): PlanStunde[] => {
	const gesehen = new Set<number>();
	return (Array.isArray(roh) ? roh : [])
		.map((s): PlanStunde | null => {
			const x = (s ?? {}) as Record<string, unknown>;
			const nr = Number(x.nr);
			if (!Number.isInteger(nr) || nr < 1 || nr > MAX_STUNDEN || gesehen.has(nr)) {
				return null;
			}
			gesehen.add(nr);
			const aufgaben = (Array.isArray(x.aufgaben) ? x.aufgaben : [])
				.map((a): PlanAufgabe | null => {
					const y = (a ?? {}) as Record<string, unknown>;
					const format = formatAus(y.format);
					const inhalt = kurz(y.inhalt, 300);
					if (!format && !inhalt) {
						return null;
					}
					const dokument = typeof y.dokument === 'string' && slugs.has(y.dokument) ? y.dokument : '';
					const bereich = ANFORDERUNGSBEREICHE.find((b) => b === kurz(y.bereich, 4).toUpperCase()) ?? null;
					const niveau = NIVEAUS.find((n) => n === ganz(y.niveau, 3));
					return {
						dokument,
						format,
						inhalt,
						bereich,
						zweitesMal: y.zweitesMal === true,
						...mitZahlen(y),
						...(niveau ? { niveau } : {}),
					};
				})
				.filter((a): a is PlanAufgabe => a !== null)
				.slice(0, MAX_AUFGABEN);
			const phasen = lesePhasen(x.phasen);
			return {
				nr,
				handlung: kurz(x.handlung, 300),
				begriffe: (Array.isArray(x.begriffe) ? x.begriffe : [])
					.map((b) => kurz(b, 60))
					.filter(Boolean)
					.slice(0, 8),
				aufgaben,
				kontrolle: x.kontrolle === true,
				...mitZahlen(x),
				...(phasen.length ? { phasen } : {}),
			};
		})
		.filter((s): s is PlanStunde => s !== null)
		.sort((a, b) => a.nr - b.nr);
};

const KONTROLL_ARTEN = new Set(['lernzielkontrolle', 'klassenarbeit']);

/** Zählt mit: nicht in der Stunde der Lernzielkontrolle und nicht auf einer Kontrolle oder Klassenarbeit. */
const zaehlt = (plan: EinheitPlan, s: PlanStunde, a: PlanAufgabe) => {
	const art = plan.dokumente.find((d) => d.slug === a.dokument)?.art ?? '';
	return !s.kontrolle && !KONTROLL_ARTEN.has(art);
};

export interface FormatVorkommen {
	format: string;
	/** Je Vorkommen die Stunde, in der Reihenfolge der Reihe. */
	stunden: number[];
}

/** Wie oft jedes Format in der Reihe vorkommt (ohne Lernzielkontrolle), das häufigste zuerst. */
export const formatZaehlung = (plan: EinheitPlan): FormatVorkommen[] => {
	const zahl = new Map<string, number[]>();
	for (const s of plan.stunden ?? []) {
		for (const a of s.aufgaben) {
			if (a.format && zaehlt(plan, s, a)) {
				const k = gleich(a.format);
				zahl.set(k, [...(zahl.get(k) ?? []), s.nr]);
			}
		}
	}
	const titel = new Map(
		(plan.stunden ?? []).flatMap((s) => s.aufgaben.map((a) => [gleich(a.format), a.format] as const)),
	);
	return [...zahl.entries()]
		.map(([k, stunden]) => ({ format: titel.get(k) ?? k, stunden }))
		.sort((a, b) => b.stunden.length - a.stunden.length);
};

const name = (format: string) => {
	const titel = formatTitel(format);
	return titel === format ? `„${format}“` : `„${titel}“ (${format})`;
};
const kurzInhalt = (a: PlanAufgabe) =>
	a.inhalt ? `„${a.inhalt.slice(0, 60)}${a.inhalt.length > 60 ? '…' : ''}“` : 'ohne Inhalt';
const liste = (nrn: number[]) => [...new Set(nrn)].join(', ');
const muster = (wort: string) => new RegExp(`(?<![\\p{L}\\p{N}])${wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu');

/** Jede Stunde da, mit Handlungsform und Aufgaben, jede Aufgabe mit Format, Bereich und Material. */
const stundenBefunde = (stunden: PlanStunde[], kapitel: number[]) => {
	const befunde: string[] = [];
	const fehlt = kapitel.filter((nr) => !stunden.some((s) => s.nr === nr));
	if (fehlt.length) {
		befunde.push(
			`In „stunden“ fehlt Stunde ${liste(fehlt)}: Zu jedem Kapitel gehört eine Stunde mit Handlungsform, Fachwörtern und Aufgaben.`,
		);
	}
	for (const s of stunden) {
		if (!s.handlung) {
			befunde.push(
				`Stunde ${s.nr} hat keine Handlungsform: Nenne in „handlung“, was die Kinder mit welchem Material tun.`,
			);
		}
		if (s.aufgaben.length === 0) {
			befunde.push(`Stunde ${s.nr} hat keine Aufgaben in „aufgaben“.`);
		}
		for (const a of s.aufgaben) {
			const was = [
				a.format ? '' : 'ein Format',
				a.bereich ? '' : 'einen Anforderungsbereich (I, II oder III)',
				a.dokument ? '' : 'das Material (ein Slug aus „dokumente“)',
			].filter(Boolean);
			if (was.length) {
				befunde.push(`Stunde ${s.nr}, Aufgabe ${kurzInhalt(a)}: Es fehlt ${was.join(', ')}.`);
			}
		}
	}
	return befunde;
};

/** Formate in der Reihenfolge der Reihe: das zweite Vorkommen markiert, kein drittes. */
const formatBefunde = (plan: EinheitPlan, stunden: PlanStunde[]) => {
	const befunde: string[] = [];
	const bisher = new Map<string, number[]>();
	const zuOft = new Map<string, { format: string; stunden: number[] }>();
	for (const s of stunden) {
		for (const a of s.aufgaben) {
			if (!a.format || !zaehlt(plan, s, a)) {
				continue;
			}
			const k = gleich(a.format);
			const vorher = bisher.get(k) ?? [];
			bisher.set(k, [...vorher, s.nr]);
			if (vorher.length >= FORMAT_HOECHSTENS) {
				zuOft.set(k, { format: a.format, stunden: [...vorher, s.nr] });
			} else if (vorher.length === 1 && !a.zweitesMal) {
				befunde.push(
					`${name(a.format)} kommt in Stunde ${s.nr} zum zweiten Mal vor (zuerst Stunde ${vorher[0]}): Setze dort „zweitesMal“: true und gib der Aufgabe erkennbar höheren Anspruch, oder nimm ein anderes Format.`,
				);
			} else if (vorher.length === 0 && a.zweitesMal) {
				befunde.push(
					`${name(a.format)} ist in Stunde ${s.nr} als zweites Mal markiert, kommt vorher aber nicht vor: Setze „zweitesMal“ auf false.`,
				);
			}
		}
	}
	for (const { format, stunden: nrn } of zuOft.values()) {
		befunde.push(
			`${name(format)} kommt ${nrn.length}-mal vor (Stunde ${liste(nrn)}); erlaubt sind höchstens ${FORMAT_HOECHSTENS}, das zweite mit höherem Anspruch. Ersetze die übrigen durch andere Formate, nicht nur durch einen anderen Namen.`,
		);
	}
	return befunde;
};

/** Fachwörter: eingeführt in oder vor der Stunde, in der eine Aufgabe sie zuerst nennt, und nur einmal. */
const fachwortBefunde = (stunden: PlanStunde[]) => {
	const befunde: string[] = [];
	const eingefuehrt = new Map<string, { wort: string; nr: number }>();
	for (const s of stunden) {
		for (const wort of s.begriffe) {
			const k = gleich(wort);
			const frueher = eingefuehrt.get(k);
			if (frueher) {
				befunde.push(
					`Das Fachwort „${wort}“ wird zweimal eingeführt (Stunde ${frueher.nr} und ${s.nr}): Führe es nur einmal ein.`,
				);
			} else {
				eingefuehrt.set(k, { wort, nr: s.nr });
			}
		}
	}
	for (const { nr, wort } of eingefuehrt.values()) {
		const vorher = stunden.find((s) => s.nr < nr && s.aufgaben.some((a) => muster(wort).test(a.inhalt)));
		if (vorher) {
			befunde.push(
				`Das Fachwort „${wort}“ steht schon in Stunde ${vorher.nr} in einer Aufgabe, eingeführt wird es erst in Stunde ${nr}: Führe es spätestens in Stunde ${vorher.nr} ein oder nimm es dort aus der Aufgabe.`,
			);
		}
	}
	return befunde;
};

/** In Kl. 1/2 höchstens eine Aufgabe aus Bereich III je Blatt. */
const bereichDreiBefunde = (stunden: PlanStunde[], klasse: 1 | 2) => {
	const befunde: string[] = [];
	const dritte = new Map<string, number>();
	for (const s of stunden) {
		for (const a of s.aufgaben.filter((x) => x.bereich === 'III')) {
			const blatt = a.dokument || `stunde-${s.nr}`;
			dritte.set(blatt, (dritte.get(blatt) ?? 0) + 1);
		}
	}
	for (const [blatt, n] of dritte) {
		if (n > 1) {
			const wo = blatt.startsWith('stunde-') ? `Stunde ${blatt.slice(7)}` : `dokumente/${blatt}`;
			befunde.push(
				`${wo} hat ${n} Aufgaben aus Bereich III; in Kl. ${klasse} höchstens eine je Blatt (grundschul-didaktik, references/differenzierung.md).`,
			);
		}
	}
	return befunde;
};

/**
 * Verstöße gegen die Regeln der Reihe, als Befund für die Korrekturrunde des Planlaufs. Nur was sich zählen lässt:
 * jede Stunde mit Handlungsform und Aufgaben, kein Format öfter als zweimal und das zweite markiert, ein Fachwort vor
 * der ersten Aufgabe, die es nennt, in Kl. 1/2 höchstens eine Aufgabe aus Bereich III je Blatt. Ein Plan ohne
 * Übersicht und ohne Kapitel (vor 221) hat keine Befunde.
 */
export const planBefunde = (plan: EinheitPlan, klasse?: Klasse): string[] => {
	const stunden = plan.stunden ?? [];
	const kapitel = (plan.geschichte?.kapitel ?? []).map((k) => k.nr).filter((nr) => nr >= 1);
	if (stunden.length === 0 && kapitel.length === 0) {
		return [];
	}
	return [
		...stundenBefunde(stunden, kapitel),
		...formatBefunde(plan, stunden),
		...fachwortBefunde(stunden),
		...(klasse === 1 || klasse === 2 ? bereichDreiBefunde(stunden, klasse) : []),
	];
};

/** Niveau, Ziel und Minuten einer Aufgabe (247); leer bei Plänen davor, damit ihr Auftrag gleich bleibt. */
const zahlenZeile = (a: PlanAufgabe) =>
	[
		a.niveau ? `Niveau ${'●'.repeat(a.niveau)}` : '',
		a.ziel ? `Ziel ${a.ziel}` : '',
		a.minuten ? `etwa ${a.minuten} min` : '',
	]
		.filter(Boolean)
		.map((t) => `, ${t}`)
		.join('');

const zeile = (a: PlanAufgabe) =>
	`- ${formatTitel(a.format) || 'ohne Format'}, Bereich ${a.bereich ?? '?'}${zahlenZeile(a)}${a.zweitesMal ? ', zum zweiten Mal: mit höherem Anspruch als beim ersten' : ''}: ${a.inhalt}`;

/** Länge und Ziel einer Stunde für den Bau (247); leer bei Plänen davor. */
const stundenZahlen = (plan: EinheitPlan, s: PlanStunde) => {
	const ziel = plan.ziele?.find((z) => z.nr === s.ziel);
	const phasen = s.phasen?.length ? `: ${s.phasen.map((p) => `${p.was} ${p.minuten} min`).join(', ')}` : '';
	return [
		s.minuten ? `Die Stunde hat ${s.minuten} min${phasen}.` : '',
		ziel ? `Ziel der Stunde (Ziel ${ziel.nr}): ${ziel.text}` : '',
	].filter(Boolean);
};

/**
 * Was der Baulauf eines Materials aus der Übersicht braucht (für 220): die Stunde mit Handlungsform und Fachwörtern,
 * die Aufgaben dieses Materials und der Stunde, und die Formate aller anderen Stunden. Die Stunde eines Materials sind
 * die Stunden, in denen seine Aufgaben stehen; ein Material ohne eigene Aufgaben (Vorleseheft, Hinweise) bekommt die
 * ganze Reihe. Leer, wenn der Plan keine Übersicht hat.
 */
export const aufgabenFuerBau = (plan: EinheitPlan, slug: string): string => {
	const stunden = plan.stunden ?? [];
	if (stunden.length === 0) {
		return '';
	}
	const eigene = stunden.filter((s) => s.aufgaben.some((a) => a.dokument === slug));
	const zeilen = [`Aufgaben-Übersicht aus dem freigegebenen Plan, für dokumente/${slug}:`];
	for (const s of eigene) {
		const frueher = stunden.filter((t) => t.nr < s.nr).flatMap((t) => t.begriffe);
		zeilen.push(
			'',
			`Stunde ${s.nr}${s.kontrolle ? ' (Lernzielkontrolle: Formate der Reihe, neue Items)' : ''}. Was die Kinder tun: ${s.handlung || 'nicht angegeben'}`,
			`Neue Fachwörter: ${s.begriffe.join(', ') || 'keine'}. Schon eingeführt: ${frueher.join(', ') || 'keine'}.`,
			...stundenZahlen(plan, s),
			'Aufgaben dieses Materials, in dieser Reihenfolge:',
			...s.aufgaben.filter((a) => a.dokument === slug).map(zeile),
		);
		const andere = s.aufgaben.filter((a) => a.dokument !== slug);
		if (andere.length) {
			zeilen.push('Weitere Aufgaben der Stunde auf anderen Materialien:', ...andere.map(zeile));
		}
	}
	const rest = stunden.filter((s) => !eigene.includes(s));
	if (rest.length) {
		zeilen.push(
			'',
			eigene.length ? 'Formate der anderen Stunden (nicht wiederholen):' : 'Formate der Stunden:',
			...rest.map(
				(s) =>
					`- Stunde ${s.nr}${s.kontrolle ? ' (Lernzielkontrolle)' : ''}: ${[...new Set(s.aufgaben.map((a) => formatTitel(a.format)).filter(Boolean))].join('; ') || 'keine Aufgaben'}${s.begriffe.length ? ` (neu: ${s.begriffe.join(', ')})` : ''}`,
			),
		);
	}
	const voll = formatZaehlung(plan)
		.filter((f) => f.stunden.length >= FORMAT_HOECHSTENS)
		.map((f) => formatTitel(f.format));
	if (voll.length) {
		zeilen.push('', `Schon ${FORMAT_HOECHSTENS}-mal in der Reihe, kein weiteres Mal: ${voll.join(', ')}.`);
	}
	return zeilen.join('\n');
};

// ——— Erzeugte Abschnitte in Skill und Auftrag (`quellen.ts`) ———

/** Tabelle „Bewährte Aufgabenformate“ in `arbeitsblatt/SKILL.md`. */
export const formateTabelle = () =>
	[
		'| Format | Name im Plan | Geeignet für | Hinweis |',
		'|---|---|---|---|',
		...AUFGABEN_FORMATE.map((f) => `| ${f.titel} | \`${f.name}\` | ${f.geeignet} | ${f.hinweis} |`),
	].join('\n');

/** Die Namen für `einheit.json` in `vorlagen/ki/einheit.md`. */
export const formateFuerAuftrag = () => AUFGABEN_FORMATE.map((f) => `\`${f.name}\`: ${f.titel}`).join('; ');
