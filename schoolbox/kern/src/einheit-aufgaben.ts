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
	{ name: 'zuordnen', titel: 'Zuordnen / Verbinden', geeignet: 'Kl. 1–2, Begriffe, Bild-Wort', hinweis: 'Max. 6 Paare, `x-zuordnen`' },
	{
		name: 'lueckentext',
		titel: 'Lückentext mit Wortauswahl',
		geeignet: 'Deutsch, Sachunterricht, Merksatz',
		hinweis: '`x-lueckentext`, `x-wortspeicher`',
	},
	{ name: 'ankreuzen', titel: 'Ankreuzen / Einkreisen', geeignet: 'Verständnis, Wortarten', hinweis: '`x-ankreuzen`' },
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
		titel: 'Fehler finden („Willi hat sich vertan“)',
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

/** Wie oft ein Format in einer Reihe vorkommen darf (218). */
export const FORMAT_HOECHSTENS = 2;
const FORMAT_ZEICHEN = 40;
const MAX_STUNDEN = 30;
const MAX_AUFGABEN = 16;

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
}

export interface PlanStunde {
	nr: number;
	handlung: string;
	begriffe: string[];
	aufgaben: PlanAufgabe[];
	/** Lernzielkontrolle: nutzt die Formate der Reihe mit neuen Items und zählt nicht mit. */
	kontrolle: boolean;
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
					return { dokument, format, inhalt, bereich, zweitesMal: y.zweitesMal === true };
				})
				.filter((a): a is PlanAufgabe => a !== null)
				.slice(0, MAX_AUFGABEN);
			return {
				nr,
				handlung: kurz(x.handlung, 300),
				begriffe: (Array.isArray(x.begriffe) ? x.begriffe : [])
					.map((b) => kurz(b, 60))
					.filter(Boolean)
					.slice(0, 8),
				aufgaben,
				kontrolle: x.kontrolle === true,
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
const kurzInhalt = (a: PlanAufgabe) => (a.inhalt ? `„${a.inhalt.slice(0, 60)}${a.inhalt.length > 60 ? '…' : ''}“` : 'ohne Inhalt');
const liste = (nrn: number[]) => [...new Set(nrn)].join(', ');
const muster = (wort: string) =>
	new RegExp(`(?<![\\p{L}\\p{N}])${wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu');

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
	const befunde: string[] = [];
	const fehlt = kapitel.filter((nr) => !stunden.some((s) => s.nr === nr));
	if (fehlt.length) {
		befunde.push(
			`In „stunden“ fehlt Stunde ${liste(fehlt)}: Zu jedem Kapitel gehört eine Stunde mit Handlungsform, Fachwörtern und Aufgaben.`,
		);
	}
	for (const s of stunden) {
		if (!s.handlung) {
			befunde.push(`Stunde ${s.nr} hat keine Handlungsform: Nenne in „handlung“, was die Kinder mit welchem Material tun.`);
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
	// Formate in der Reihenfolge der Reihe: das zweite Vorkommen markiert, kein drittes.
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
	// Fachwörter: eingeführt in oder vor der Stunde, in der eine Aufgabe sie zuerst nennt, und nur einmal.
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
	for (const { wort, nr } of eingefuehrt.values()) {
		const vorher = stunden.find((s) => s.nr < nr && s.aufgaben.some((a) => muster(wort).test(a.inhalt)));
		if (vorher) {
			befunde.push(
				`Das Fachwort „${wort}“ steht schon in Stunde ${vorher.nr} in einer Aufgabe, eingeführt wird es erst in Stunde ${nr}: Führe es spätestens in Stunde ${vorher.nr} ein oder nimm es dort aus der Aufgabe.`,
			);
		}
	}
	if (klasse === 1 || klasse === 2) {
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
	}
	return befunde;
};

const zeile = (a: PlanAufgabe) =>
	`- ${formatTitel(a.format) || 'ohne Format'}, Bereich ${a.bereich ?? '?'}${a.zweitesMal ? ', zum zweiten Mal: mit höherem Anspruch als beim ersten' : ''}: ${a.inhalt}`;

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
