import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EinheitPlan } from './einheit';
import { lesePlan, planFuerBau } from './einheit';
import { aufgabenFuerBau, formatAus, formatTitel, formatZaehlung, planBefunde } from './einheit-aufgaben';
import { kanonText } from './einheit-kanon';

const ARTEN: Record<string, string> = { kontrolle: 'lernzielkontrolle', vorleseheft: 'unterrichtsplanung' };

const DOKUMENTE = ['vorleseheft', 'kapitel-1', 'kapitel-2', 'kapitel-3', 'lernspiel', 'kontrolle'].map((slug) => ({
	slug,
	art: ARTEN[slug] ?? 'arbeitsblatt',
	format: 'a4-hoch',
}));

const auf = (dokument: string, format: string, inhalt: string, bereich = 'I', zweitesMal = false) => ({
	dokument,
	format,
	inhalt,
	bereich,
	zweitesMal,
});

/** Achsensymmetrie Kl. 2, wie sie sein soll: jedes Format höchstens zweimal, das Fachwort vor der Aufgabe. */
const GUT = {
	titel: 'Die halben Sterne',
	kapitel: [0, 1, 2, 3].map((nr) => ({ nr, titel: `Kapitel ${nr}` })),
	stunden: [
		{
			nr: 1,
			handlung: 'Faltschnitte aus Papier schneiden und aufklappen.',
			begriffe: ['Faltlinie'],
			aufgaben: [
				auf('kapitel-1', 'legen-bauen-falten', 'Stern falten und schneiden'),
				auf('kapitel-1', 'Ankreuzen / Einkreisen', 'Was siehst du beim Aufklappen?'),
				auf('kapitel-1', 'erklaeren', 'Warum passen die Hälften?', 'III'),
			],
		},
		{
			nr: 2,
			handlung: 'Mit dem Spiegel an Figuren prüfen.',
			begriffe: ['Spiegelachse', 'symmetrisch'],
			aufgaben: [
				auf('kapitel-2', 'richtig-falsch', 'Ist die Figur symmetrisch?'),
				auf('kapitel-2', 'einzeichnen', 'Spiegelachsen einzeichnen', 'II'),
				auf('lernspiel', 'Spiegel-Memory', 'Hälften finden'),
			],
		},
		{
			nr: 3,
			handlung: 'Zu zweit mit Steckwürfeln an einer Achse legen.',
			begriffe: [],
			aufgaben: [
				auf('kapitel-3', 'ergaenzen', 'Figur an senkrechter Achse ergänzen'),
				auf('kapitel-3', 'ergaenzen', 'Figur an waagerechter Achse mit Abstand', 'II', true),
				auf('kapitel-3', 'einzeichnen', 'Mehrere Spiegelachsen einzeichnen', 'II', true),
			],
		},
		{
			nr: 4,
			kontrolle: true,
			handlung: 'Prüfung der Detektive.',
			aufgaben: [auf('kontrolle', 'ergaenzen', 'Neue Figur ergänzen'), auf('kontrolle', 'einzeichnen', 'Achse')],
		},
	],
	dokumente: DOKUMENTE,
};

const plan = (roh: object) => lesePlan(roh) as EinheitPlan;

describe('Aufgaben-Übersicht im Plan (221)', () => {
	it('lesePlan: Stunden, Formate und Bereiche tolerant; Ungültiges fällt heraus, alte Pläne ohne Feld', () => {
		const p = plan({
			dokumente: DOKUMENTE,
			stunden: [
				{
					nr: 2,
					handlung: ' Spiegeln ',
					begriffe: ['Spiegelachse', '', 4],
					aufgaben: [
						auf('kapitel-2', 'LÜCKENTEXT mit Wortauswahl', 'Merksatz', 'ii'),
						auf('../boese', 'frei: Spiegelschrift lesen', 'Botschaft', 'IV'),
						{ inhalt: '' },
					],
				},
				{ nr: 2, handlung: 'doppelt' },
				{ nr: 0, handlung: 'Auftakt ist keine Stunde' },
				{ nr: 1, handlung: 'Falten' },
				'kaputt',
			],
		});
		assert.deepEqual(p.stunden, [
			{ nr: 1, handlung: 'Falten', begriffe: [], aufgaben: [], kontrolle: false },
			{
				nr: 2,
				handlung: 'Spiegeln',
				begriffe: ['Spiegelachse'],
				aufgaben: [
					{
						dokument: 'kapitel-2',
						format: 'lueckentext',
						inhalt: 'Merksatz',
						bereich: 'II',
						zweitesMal: false,
					},
					{
						dokument: '',
						format: 'Spiegelschrift lesen',
						inhalt: 'Botschaft',
						bereich: null,
						zweitesMal: false,
					},
				],
				kontrolle: false,
			},
		]);
		assert.equal('stunden' in plan({ dokumente: DOKUMENTE }), false);
		assert.equal(formatAus('Zuordnen / Verbinden'), 'zuordnen');
		assert.equal(formatTitel('zuordnen'), 'Zuordnen / Verbinden');
		assert.equal(formatTitel('Spiegel-Memory'), 'Spiegel-Memory');
	});

	it('Zählung: ein guter Plan hat keine Befunde, die Lernzielkontrolle zählt nicht mit', () => {
		const p = plan(GUT);
		assert.deepEqual(planBefunde(p, 2), []);
		const zahl = Object.fromEntries(formatZaehlung(p).map((f) => [f.format, f.stunden]));
		assert.deepEqual(zahl.ergaenzen, [3, 3]);
		assert.deepEqual(zahl.einzeichnen, [2, 3]);
		assert.deepEqual(zahl['Spiegel-Memory'], [2]);
	});

	it('Zählung: drittes Vorkommen, fehlende Markierung, freie Namen nach Namen gezählt', () => {
		const p = plan({
			...GUT,
			stunden: [
				{
					nr: 1,
					handlung: 'a',
					aufgaben: [auf('kapitel-1', 'lueckentext', 'Merksatz'), auf('kapitel-1', 'Spiegel-Memory', 'x')],
				},
				{
					nr: 2,
					handlung: 'b',
					aufgaben: [
						auf('kapitel-2', 'Lückentext mit Wortauswahl', 'Merksatz'),
						auf('kapitel-2', 'spiegel-memory', 'y', 'I', true),
					],
				},
				{
					nr: 3,
					handlung: 'c',
					aufgaben: [
						auf('kapitel-3', 'lueckentext', 'Merksatz', 'I', true),
						auf('kapitel-3', 'ankreuzen', 'z', 'I', true),
					],
				},
			],
		});
		const befunde = planBefunde(p, 3);
		assert.equal(befunde.length, 3, befunde.join('\n'));
		assert.match(
			befunde[0] ?? '',
			/„Lückentext mit Wortauswahl“ \(lueckentext\) kommt in Stunde 2 zum zweiten Mal vor \(zuerst Stunde 1\): Setze dort „zweitesMal“: true/,
		);
		assert.match(
			befunde[1] ?? '',
			/„Ankreuzen \/ Einkreisen“ \(ankreuzen\) ist in Stunde 3 als zweites Mal markiert/,
		);
		assert.match(
			befunde[2] ?? '',
			/„Lückentext mit Wortauswahl“ \(lueckentext\) kommt 3-mal vor \(Stunde 1, 2, 3\)/,
		);
	});

	it('Regeln: Stunde ohne Handlung, fehlende Stunde zum Kapitel, Fachwort zu spät, Bereich III in Kl. 2', () => {
		const p = plan({
			...GUT,
			stunden: [
				{
					nr: 1,
					handlung: '',
					begriffe: ['Faltlinie'],
					aufgaben: [
						auf('kapitel-1', 'einzeichnen', 'Die Spiegelachsen einzeichnen'),
						auf('kapitel-1', 'erklaeren', 'Warum?', 'III'),
						auf('kapitel-1', 'forscheraufgabe', 'Finde viele', 'III'),
						auf('kapitel-1', 'sortieren', 'Ohne Bereich', ''),
					],
				},
				{
					nr: 2,
					handlung: 'Spiegeln',
					begriffe: ['Spiegelachse', 'faltlinie'],
					aufgaben: [auf('kapitel-2', 'zuordnen', 'x')],
				},
			],
		});
		const befunde = planBefunde(p, 2).join('\n');
		assert.match(befunde, /In „stunden“ fehlt Stunde 3/);
		assert.match(befunde, /Stunde 1 hat keine Handlungsform/);
		assert.match(befunde, /Stunde 1, Aufgabe „Ohne Bereich“: Es fehlt einen Anforderungsbereich/);
		assert.match(
			befunde,
			/„Spiegelachse“ steht schon in Stunde 1 in einer Aufgabe, eingeführt wird es erst in Stunde 2/,
		);
		assert.match(befunde, /„faltlinie“ wird zweimal eingeführt \(Stunde 1 und 2\)/);
		assert.match(befunde, /dokumente\/kapitel-1 hat 2 Aufgaben aus Bereich III; in Kl\. 2 höchstens eine/);
		// In Kl. 3 gilt die Grenze für Bereich III nicht; ein Plan vor 221 ohne Übersicht und Kapitel hat keine Befunde.
		assert.doesNotMatch(planBefunde(p, 3).join('\n'), /Bereich III/);
		assert.deepEqual(planBefunde(plan({ dokumente: DOKUMENTE })), []);
	});

	it('Für den Bau (220): die eigene Stunde mit Aufgaben, die Formate der anderen Stunden', () => {
		const p = plan(GUT);
		const text = aufgabenFuerBau(p, 'kapitel-2');
		assert.equal(
			text,
			[
				'Aufgaben-Übersicht aus dem freigegebenen Plan, für dokumente/kapitel-2:',
				'',
				'Stunde 2. Was die Kinder tun: Mit dem Spiegel an Figuren prüfen.',
				'Neue Fachwörter: Spiegelachse, symmetrisch. Schon eingeführt: Faltlinie.',
				'Aufgaben dieses Materials, in dieser Reihenfolge:',
				'- Richtig oder falsch („Stimmt das?“), Bereich I: Ist die Figur symmetrisch?',
				'- Einzeichnen (Achse, Linie, Weg), Bereich II: Spiegelachsen einzeichnen',
				'Weitere Aufgaben der Stunde auf anderen Materialien:',
				'- Spiegel-Memory, Bereich I: Hälften finden',
				'',
				'Formate der anderen Stunden (nicht wiederholen):',
				'- Stunde 1: Legen, bauen, falten und festhalten; Ankreuzen / Einkreisen; Erklären / Begründen (neu: Faltlinie)',
				'- Stunde 3: Ergänzen (Figur, Muster, Reihe); Einzeichnen (Achse, Linie, Weg)',
				'- Stunde 4 (Lernzielkontrolle): Ergänzen (Figur, Muster, Reihe); Einzeichnen (Achse, Linie, Weg)',
				'',
				'Schon 2-mal in der Reihe, kein weiteres Mal: Einzeichnen (Achse, Linie, Weg), Ergänzen (Figur, Muster, Reihe).',
			].join('\n'),
		);
		assert.match(aufgabenFuerBau(p, 'kontrolle'), /Stunde 4 \(Lernzielkontrolle: Formate der Reihe, neue Items\)/);
		assert.match(
			aufgabenFuerBau(p, 'kapitel-3'),
			/zum zweiten Mal: mit höherem Anspruch als beim ersten: Figur an waagerechter Achse/,
		);
		// Ein Material ohne eigene Aufgaben bekommt jede Stunde ganz, mit den Aufgaben aller Materialien (252).
		const heft = aufgabenFuerBau(p, 'vorleseheft');
		assert.match(heft, /^Aufgaben-Übersicht.*\n\nStunde 1\. Was die Kinder tun: Faltschnitte/);
		assert.match(heft, /^- lernspiel: Spiegel-Memory, Bereich I: Hälften finden$/m);
		assert.doesNotMatch(heft, /Formate der (anderen )?Stunden/);
		assert.equal(aufgabenFuerBau(plan({ dokumente: DOKUMENTE }), 'kapitel-1'), '');
	});
});

/** Jedes Feld des Plans mit einem eigenen Wert, damit der Test sieht, ob es im Auftrag ankommt (252). */
const VOLL = {
	titel: 'T-titel',
	annahmen: ['T-annahme'],
	recherche: 'T-recherche',
	geschichte: 'T-geschichte',
	verdaechtige: ['T-verdaechtig'],
	falscheFaehrte: 'T-faehrte',
	aufloesung: 'T-aufloesung',
	kapitel: [{ nr: 1, titel: 'T-kapitel', offenesEnde: 'T-ende', bildfolien: ['1.1 T-bildfolie'] }],
	figuren: [{ name: 'T-figur', rolle: 'T-rolle', aussehen: 'T-aussehen', herkunft: 'bibliothek:luna' }],
	raetselkette: 'T-kette',
	berichtigungen: ['T-berichtigung'],
	ziele: [{ nr: 1, text: 'T-ziel', handlung: true }],
	stunden: [
		{
			nr: 1,
			handlung: 'T-handlung',
			begriffe: ['T-begriff'],
			kontrolle: true,
			minuten: 45,
			ziel: 1,
			phasen: [{ was: 'T-phase', minuten: 17, arbeit: true }],
			aufgaben: [
				{
					dokument: 'kapitel-1',
					format: 'T-format',
					inhalt: 'T-inhalt',
					bereich: 'II',
					zweitesMal: true,
					ziel: 1,
					minuten: 13,
					niveau: 3,
				},
			],
		},
	],
	dokumente: [
		{ slug: 'kapitel-1', titel: 'T-dokument', art: 'arbeitsblatt', format: 'a4-hoch', zweck: 'T-zweck' },
		{ slug: 'hinweise', titel: 'T-hinweise', art: 'unterrichtsplanung', format: 'a4-hoch', zweck: 'T-zweck2' },
	],
	kanon: {
		figuren: [{ name: 'T-figur', fest: ['T-fest'], nie: ['T-nie'] }],
		dinge: [{ name: 'T-ding', kapitel: { 1: 'T-zustand' } }],
		geheim: [{ was: 'T-geheim', bis: 2 }],
		regeln: ['T-regel'],
		begriffe: [{ wort: 'T-wort', bedeutung: 'T-bedeutung', ab: 1 }],
	},
};

/**
 * Wo jedes Feld von `EinheitPlan` im Auftrag des Baus steht (252). Ein neues Feld bricht die Typprüfung, bis es hier
 * eingetragen ist: im Plan-Abschnitt, im Kanon, in der Aufgaben-Übersicht, im Kopf (die ganze Recherche) oder nur für
 * den Server.
 */
const FELD_IM_BAU: Record<keyof EinheitPlan, 'plan' | 'kanon' | 'aufgaben' | 'kopf'> = {
	titel: 'plan',
	annahmen: 'plan',
	dokumente: 'plan',
	geschichte: 'plan',
	recherche: 'kopf',
	stunden: 'aufgaben',
	ziele: 'plan',
	figuren: 'plan',
	raetselkette: 'plan',
	berichtigungen: 'plan',
	kanon: 'kanon',
};

/** Alle Texte und Zahlen in einem Wert, mit dem Pfad dahin. */
const blaetter = (wert: unknown, pfad: string): [string, string][] => {
	if (typeof wert === 'string' || typeof wert === 'number') {
		return [[pfad, String(wert)]];
	}
	if (Array.isArray(wert)) {
		return wert.flatMap((w) => blaetter(w, `${pfad}[]`));
	}
	if (typeof wert === 'object' && wert !== null) {
		return Object.entries(wert).flatMap(([k, w]) => blaetter(w, `${pfad}.${k}`));
	}
	return [];
};

describe('Der Bau bekommt den ganzen Plan (252)', () => {
	it('jedes Feld, das nicht nur für den Server ist, steht im Auftrag', () => {
		const p = lesePlan(VOLL);
		assert.ok(p);
		// Jedes Feld des Fixtures kommt durch `lesePlan`: Sonst prüfte der Test eine Lücke nicht.
		assert.deepEqual(Object.keys(p).sort(), Object.keys(FELD_IM_BAU).sort());
		// Ein Material ohne eigene Aufgaben (Hinweise) bekommt alles; eines mit Aufgaben dieselben Plan-Zeilen.
		const auftrag = [planFuerBau(p), kanonText(p.kanon), aufgabenFuerBau(p, 'hinweise')].join('\n');
		// `fertig` und `arbeit` braucht nur der Server; die Herkunft steht als „aus der Bibliothek“ (unten geprüft).
		const nurServer = new Set(['dokumente[].fertig', 'stunden[].phasen[].arbeit', 'figuren[].herkunft']);
		const fehlen = (Object.keys(FELD_IM_BAU) as (keyof EinheitPlan)[])
			.filter((k) => FELD_IM_BAU[k] !== 'kopf')
			.flatMap((k) => blaetter(p[k], k))
			.filter(([pfad, wert]) => !nurServer.has(pfad) && !auftrag.includes(wert))
			.map(([pfad, wert]) => `${pfad}: ${wert}`);
		assert.deepEqual(fehlen, []);
		assert.match(auftrag, /T-figur \(aus der Bibliothek\)/);
		assert.match(auftrag, /Ziel 1: T-ziel \(verlangt eine Handlung/);
		assert.match(auftrag, /Stunde 1 \(Lernzielkontrolle/);
		assert.match(auftrag, /zum zweiten Mal/);
		assert.match(planFuerBau(p), /^Der freigegebene Plan, vollständig in dieser Nachricht/);
	});
});
