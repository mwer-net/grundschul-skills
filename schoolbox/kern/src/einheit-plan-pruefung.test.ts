import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { EinheitPlan } from './einheit';
import { lesePlan, niveausImAuftrag } from './einheit';
import { aufgabenFuerBau } from './einheit-aufgaben';
import { nenntNamen } from './einheit-kanon';
import type { PlanPunkt, PlanPruefStand } from './einheit-plan-pruefung';
import { PRUEF_ARTEN } from './einheit-pruefung';
import { WURZEL } from './konfig';
import {
	lesePlanAntwort,
	nachAenderung,
	planPruefStand,
	planPruefText,
	planRueckrunde,
	rechnePlan,
} from './einheit-plan-pruefung';

const plan = (roh: object) => lesePlan(roh) as EinheitPlan;

const OHNE_NIVEAUS =
	'Ohne drei Niveaus: je Stunde ein Arbeitsblatt für alle, Aufgaben steigend im Anspruch, keine Niveau-Punkte ● ●● ●●● und keine Wahlhilfe.';

const DOKUMENTE = [
	{ slug: 'kapitel-1', art: 'arbeitsblatt', format: 'a4-hoch' },
	{ slug: 'kapitel-2', art: 'arbeitsblatt', format: 'a4-hoch' },
	{ slug: 'kontrolle', art: 'lernzielkontrolle', format: 'a4-hoch' },
];

const auf = (dokument: string, format: string, inhalt: string, mehr: object = {}) => ({
	dokument,
	format,
	inhalt,
	bereich: 'I',
	zweitesMal: false,
	...mehr,
});

/** Deutsch Kl. 2, Nomen: so, wie der Planlauf nach 247 schreibt, ohne Befund. */
const NOMEN = {
	titel: 'Die verschwundenen Wörter',
	ziele: [
		{ nr: 1, text: 'Ich kann Nomen im Satz finden.' },
		{ nr: 2, text: 'Ich kann Nomen großschreiben.' },
	],
	stunden: [
		{
			nr: 1,
			minuten: 45,
			ziel: 1,
			phasen: [
				{ was: 'Vorlesen', minuten: 5 },
				{ was: 'Kreisinput', minuten: 10 },
				{ was: 'Arbeitsblatt', minuten: 25, arbeit: true },
				{ was: 'Reflexion', minuten: 5 },
			],
			handlung: 'Nomen in Sätzen markieren.',
			aufgaben: [
				auf('kapitel-1', 'ankreuzen', 'Nomen einkreisen', { ziel: 1, minuten: 8 }),
				auf('kapitel-1', 'sortieren', 'Wörter nach Nomen sortieren', { ziel: 1, minuten: 10 }),
			],
		},
		{
			nr: 2,
			minuten: 45,
			ziel: 2,
			phasen: [
				{ was: 'Kreisinput', minuten: 12 },
				{ was: 'Arbeitsblatt', minuten: 28, arbeit: true },
				{ was: 'Reflexion', minuten: 5 },
			],
			handlung: 'Sätze abschreiben und Nomen großschreiben.',
			aufgaben: [auf('kapitel-2', 'ins-heft', 'Sätze richtig abschreiben', { ziel: 2, minuten: 15 })],
		},
		{
			nr: 3,
			kontrolle: true,
			minuten: 45,
			phasen: [
				{ was: 'Austeilen', minuten: 3 },
				{ was: 'Lernzielkontrolle', minuten: 30, arbeit: true },
			],
			handlung: 'Lernzielkontrolle.',
			aufgaben: [
				auf('kontrolle', 'ankreuzen', 'Nomen finden', { ziel: 1, minuten: 5 }),
				auf('kontrolle', 'ins-heft', 'Satz abschreiben', { ziel: 2, minuten: 8 }),
			],
		},
	],
	dokumente: DOKUMENTE,
};

describe('Plan-Prüfung: die Rechnung (247)', () => {
	it('Ein Plan mit allen Feldern ohne Fehler: kein Befund; ausgelassen nur Kanon und Niveaus ohne Satz im Auftrag', () => {
		const r = rechnePlan(plan(NOMEN), { klasse: 2, niveaus: null });
		assert.deepEqual(r.befunde, []);
		assert.deepEqual(r.ausgelassen, [
			'Kanon: Der Plan hat keine Gegenstände der Handlung („kanon.dinge“).',
			'Niveaus: Der Auftrag sagt nicht, ob mit drei Niveaus.',
		]);
	});

	it('Alter Plan ohne die neuen Felder: kein Befund nur wegen fehlender Felder', () => {
		const alt = plan({
			titel: 'Alt',
			figuren: ['Ella, die Katze, mit einem goldenen Glöckchen'],
			stunden: NOMEN.stunden.map((s) => ({
				nr: s.nr,
				kontrolle: s.kontrolle,
				handlung: s.handlung,
				aufgaben: s.aufgaben.map((a) => ({ ...a, ziel: undefined, minuten: undefined })),
			})),
			dokumente: DOKUMENTE,
		});
		assert.equal(alt.ziele, undefined);
		assert.equal(alt.stunden?.[0]?.minuten, undefined);
		assert.ok(!('phasen' in (alt.stunden?.[0] ?? {})));
		const r = rechnePlan(alt, { klasse: 2 });
		assert.deepEqual(r.befunde, []);
		assert.equal(r.ausgelassen.length, 4);
	});

	it('Zeit: Phasen über der Stunde, Aufgaben über der Arbeitsphase, Kind mit seinem längsten Niveau', () => {
		const roh = structuredClone(NOMEN);
		const s1 = roh.stunden[0];
		if (s1) {
			s1.phasen = [
				{ was: 'Vorlesen', minuten: 15 },
				{ was: 'Präsentation', minuten: 20 },
				{ was: 'Bastelbogen', minuten: 40, arbeit: true },
			];
		}
		const s2 = roh.stunden[1];
		if (s2) {
			s2.aufgaben = [
				auf('kapitel-2', 'ins-heft', 'Sätze abschreiben', { ziel: 2, minuten: 15 }),
				auf('kapitel-2', 'lueckentext', 'Lücken füllen', { ziel: 2, minuten: 10, niveau: 1 }),
				auf('kapitel-2', 'erklaeren', 'Regel erklären', { ziel: 2, minuten: 20, niveau: 3 }),
			];
		}
		const r = rechnePlan(plan(roh), { klasse: 2 });
		assert.deepEqual(r.befunde, [
			'Stunde 1 braucht 75 min von 45 (Vorlesen 15, Präsentation 20, Bastelbogen 40): Kürze, streiche oder verschiebe, bis der Ablauf in die Stunde passt.',
			'Die Aufgaben von Stunde 2 brauchen ein Kind 35 min (für alle 15, dazu Niveau ●●● 20), die Arbeitsphase hat 28: Nimm Aufgaben heraus oder verteile sie auf andere Stunden.',
		]);
	});

	it('Zeit: fehlende Länge und Aufgaben ohne Minuten, sobald der Plan Minuten nutzt', () => {
		const roh = structuredClone(NOMEN) as { stunden: Record<string, unknown>[] };
		delete roh.stunden[1]?.minuten;
		const s1 = roh.stunden[0] as { aufgaben: Record<string, unknown>[] };
		delete s1.aufgaben[1]?.minuten;
		const r = rechnePlan(plan(roh), {});
		assert.deepEqual(r.befunde, [
			'Stunde 1: 1 von 2 Aufgaben ohne geschätzte „minuten“.',
			'Stunde 2 hat keine Länge: Nenne in „minuten“, wie lang sie ist.',
		]);
	});

	it('Ziele: ein Ziel ohne Aufgabe in der Lernzielkontrolle, ein unbekanntes Ziel, eine Stunde ohne Aufgabe zum Ziel', () => {
		const roh = structuredClone(NOMEN);
		roh.ziele.push({ nr: 3, text: 'Ich kann Nomen mit Artikel nennen.' });
		const s2 = roh.stunden[1];
		if (s2) {
			s2.ziel = 3;
			s2.aufgaben = [...s2.aufgaben, auf('kapitel-2', 'zuordnen', 'Artikel zuordnen', { ziel: 4, minuten: 5 })];
		}
		const r = rechnePlan(plan(roh), {});
		assert.deepEqual(r.befunde, [
			'Stunde 2, Aufgabe „Artikel zuordnen“ nennt Ziel 4, das in „ziele“ fehlt.',
			'Stunde 2 hat Ziel 3 („Ich kann Nomen mit Artikel nennen.“), aber keine Aufgabe dazu: Gib einer Aufgabe dieses Ziel oder der Stunde das Ziel, das ihre Aufgaben üben.',
			'Ziel 3 („Ich kann Nomen mit Artikel nennen.“) übt keine Stunde: Gib ihm Aufgaben in einer Stunde oder nimm es heraus.',
			'Ziel 3 („Ich kann Nomen mit Artikel nennen.“) kommt in der Lernzielkontrolle nicht vor: Gib ihm dort eine Aufgabe, die dasselbe verlangt wie in der Stunde.',
		]);
	});

	it('Ziele: Handlungsziel der Reihe fehlt in der Lernzielkontrolle (Prüfstand PL3, Achsensymmetrie)', () => {
		const p = plan({
			titel: 'Symmetrie',
			ziele: [
				{ nr: 1, text: 'Ich kann symmetrische Figuren herstellen.' },
				{ nr: 2, text: 'Ich kann Spiegelachsen erkennen.' },
			],
			stunden: [
				{
					nr: 1,
					ziel: 1,
					handlung: 'Falten und schneiden.',
					aufgaben: [auf('kapitel-1', 'legen-bauen-falten', 'Faltschnitt', { ziel: 1 })],
				},
				{
					nr: 2,
					ziel: 2,
					handlung: 'Mit dem Spiegel prüfen.',
					aufgaben: [auf('kapitel-2', 'einzeichnen', 'Achse einzeichnen', { ziel: 2 })],
				},
				{
					nr: 3,
					kontrolle: true,
					handlung: 'Kontrolle.',
					aufgaben: [auf('kontrolle', 'einzeichnen', 'Achse', { ziel: 2 })],
				},
			],
			dokumente: DOKUMENTE,
		});
		assert.deepEqual(rechnePlan(p).befunde, [
			'Ziel 1 („Ich kann symmetrische Figuren herstellen.“) kommt in der Lernzielkontrolle nicht vor: Gib ihm dort eine Aufgabe, die dasselbe verlangt wie in der Stunde.',
		]);
	});

	describe('Handlungsziele in der Lernzielkontrolle (250)', () => {
		const sachunterricht = (format: string, handlung?: boolean) =>
			plan({
				titel: 'Strom',
				ziele: [
					{ nr: 1, text: 'Ich kann einen Stromkreis aufbauen.', ...(handlung === undefined ? {} : { handlung }) },
				],
				stunden: [
					{
						nr: 1,
						ziel: 1,
						handlung: 'Zu zweit mit Batterie, Kabel und Lämpchen einen Stromkreis bauen.',
						aufgaben: [auf('kapitel-1', 'legen-bauen-falten', 'Stromkreis bauen und zeichnen', { ziel: 1 })],
					},
					{
						nr: 2,
						kontrolle: true,
						handlung: 'Kontrolle.',
						aufgaben: [auf('kontrolle', format, 'Stromkreis', { ziel: 1 })],
					},
				],
				dokumente: DOKUMENTE,
			});

		it('Handlungsziel nur mit Ankreuzen geprüft: Befund mit den Formaten, die handeln lassen', () => {
			assert.deepEqual(rechnePlan(sachunterricht('ankreuzen', true)).befunde, [
				'Ziel 1 („Ich kann einen Stromkreis aufbauen.“) verlangt eine Handlung, die Lernzielkontrolle prüft es aber nur auf dem Papier: Gib ihm dort eine Aufgabe im Format „Legen, bauen, falten und festhalten“ (legen-bauen-falten) oder „Tun und beobachten (Beobachtungsbogen)“ (beobachten).',
			]);
		});

		it('Handlung auf dem Blatt festgehalten oder Beobachtungsbogen: kein Befund', () => {
			assert.deepEqual(rechnePlan(sachunterricht('legen-bauen-falten', true)).befunde, []);
			assert.deepEqual(rechnePlan(sachunterricht('Tun und beobachten (Beobachtungsbogen)', true)).befunde, []);
		});

		it('Ziel ohne die Angabe (alter Plan) oder ohne Handlung: kein Befund', () => {
			assert.deepEqual(rechnePlan(sachunterricht('ankreuzen')).befunde, []);
			assert.deepEqual(rechnePlan(sachunterricht('ankreuzen', false)).befunde, []);
			assert.equal(sachunterricht('ankreuzen').ziele?.[0]?.handlung, undefined);
			assert.equal(sachunterricht('ankreuzen', true).ziele?.[0]?.handlung, true);
		});
	});

	it('Niveaus nur, wenn der Auftrag ohne drei Niveaus ist', () => {
		const roh = structuredClone(NOMEN);
		const s1 = roh.stunden[0];
		if (s1) {
			s1.aufgaben = s1.aufgaben.map((a, i) => ({ ...a, niveau: i + 1 }));
		}
		assert.deepEqual(rechnePlan(plan(roh), { niveaus: true }).befunde, []);
		assert.deepEqual(rechnePlan(plan(roh), { niveaus: false }).befunde, [
			'Stunde 1 hat Aufgaben je Niveau (●, ●●, ●●●), der Auftrag ist ohne drei Niveaus: Gib allen Kindern dieselben Aufgaben, steigend im Anspruch.',
		]);
		assert.equal(
			niveausImAuftrag(
				'Thema. Mit drei Niveaus zur Wahl (● Grundlage, ●● Kern, ●●● Herausforderung): je Niveau eine eigene Seite, die Kinder wählen.',
			),
			true,
		);
		assert.equal(niveausImAuftrag(`Thema. ${OHNE_NIVEAUS}`), false);
		assert.equal(niveausImAuftrag('Thema.'), null);
	});

	it('Kanon: ein wechselnder Gegenstand als festes Merkmal und im Aussehen (Prüfstand PL1, Glöckchen)', () => {
		const p = plan({
			titel: 'Licht in der Tanne',
			figuren: [{ name: 'Ella', rolle: 'Katze', aussehen: 'graue Katze, am Schwanz ein goldenes Glöckchen' }],
			kanon: {
				figuren: [{ name: 'Ella', fest: ['grau getigert', 'goldenes Glöckchen am Schwanz'], nie: [] }],
				dinge: [
					{
						name: 'das Glöckchen',
						kapitel: { 0: 'an Ellas Schwanz', 5: 'unter der Tanne', 6: 'wieder an Ella' },
					},
				],
			},
			dokumente: DOKUMENTE,
		});
		assert.deepEqual(rechnePlan(p).befunde, [
			'„Ella“ hat „das Glöckchen“ als festes Merkmal („goldenes Glöckchen am Schwanz“), der Kanon lässt es aber je Kapitel wechseln (Kapitel 0, 5, 6): Nimm es aus „fest“ und „aussehen“; wer es wann hat, steht nur unter „dinge“.',
			'„Ella“ hat „das Glöckchen“ im Aussehen, der Kanon lässt es aber je Kapitel wechseln (Kapitel 0, 5, 6): Nimm es aus „fest“ und „aussehen“; wer es wann hat, steht nur unter „dinge“.',
		]);
	});

	it('nenntNamen: das letzte Wort des Namens als ganzes Wort, ohne Artikel und Groß/klein', () => {
		assert.equal(nenntNamen('Ein goldenes Glöckchen am Schwanz', 'das Glöckchen'), true);
		assert.equal(nenntNamen('Der Schlüsselbund hängt', 'der Schlüssel'), false);
		assert.equal(nenntNamen('ein Ei', 'das Ei'), false);
	});
});

describe('Plan-Prüfung: Auftrag, Rückrunde und Stand (247)', () => {
	const befund = {
		seite: null,
		aufgabe: 'Stunde 6',
		art: 'fehlt' as const,
		text: 'Die LZK prüft das Herstellen nicht.',
	};

	it('Der Auftrag nennt Dateien, Skills und die Rechnung, die er nicht noch einmal meldet', () => {
		const text = planPruefText({
			titel: 'Nomen',
			klasse: 'Klasse 2',
			fach: 'Deutsch',
			auftrag: 'Erstelle eine Einheit.',
			plan: 'einheit.json',
			recherche: null,
			skills: ['/skills/fach-deutsch/SKILL.md', '/skills/unterrichtsplanung/SKILL.md'],
			rechnung: ['Stunde 1 braucht 75 min von 45.'],
			ausgelassen: ['Ziele: Der Plan hat keine nummerierten „ziele“.'],
		});
		assert.match(text, /prüfe das selbst aus dem Inhalt:\n- Ziele: Der Plan hat keine nummerierten „ziele“\.$/);
		assert.match(text, /^Plan-Prüfung der Einheit „Nomen“ \(Klasse 2, Deutsch\)/);
		assert.match(text, /^- einheit\.json: der Plan$/m);
		assert.match(text, /^- Keine Recherche:/m);
		assert.match(text, /^- Read \/skills\/fach-deutsch\/SKILL\.md$/m);
		assert.match(text, /melde es nicht noch einmal:\n- Stunde 1 braucht 75 min von 45\.$/m);
	});

	it('Rückrunde: Rechnung und Befunde nummeriert, der Block mit den Begründungen immer', () => {
		const nur = planRueckrunde([{ von: 'rechnung', text: 'Stunde 1 braucht 75 min von 45.' }]);
		assert.match(nur, /^Korrekturrunde zum Plan\. /);
		assert.match(nur, /^1\. Stunde 1 braucht 75 min von 45\.$/m);
		assert.match(nur, /"geprueft"/);
		assert.match(nur, /ohne Begründungen im Plan-Text/);
		const beide = planRueckrunde([
			{ von: 'rechnung', text: 'Stunde 1 braucht 75 min von 45.' },
			{ von: 'pruefung', befund },
		]);
		assert.match(beide, /^2\. Stunde 6, fehlendes Material: Die LZK prüft das Herstellen nicht\.$/m);
		assert.match(beide, /"geprueft"/);
	});

	it('lesePlanAntwort nimmt den Block vom Ende; ohne Block oder kaputt bleibt der Text', () => {
		const a = lesePlanAntwort(
			'Der Plan.\n\n```json\n{"geprueft": [{"nr": 2, "behoben": true, "wie": "LZK  ergänzt."}, {"nr": "x", "behoben": true}]}\n```\n',
		);
		assert.equal(a.text, 'Der Plan.');
		assert.deepEqual([...a.geprueft], [[2, { behoben: true, wie: 'LZK ergänzt.' }]]);
		assert.equal(lesePlanAntwort('Nur Plan.').text, 'Nur Plan.');
		assert.equal(lesePlanAntwort('Plan.\n```json\n{"geprueft": [}\n```').geprueft.size, 0);
		const frueher = lesePlanAntwort(
			'Plan.\n```json\n{"titel": "x"}\n```\nMehr Plan.\n```json\n{"geprueft": [{"nr": 1, "behoben": true, "wie": "Gekürzt."}]}\n```',
		);
		assert.equal(frueher.text, 'Plan.\n```json\n{"titel": "x"}\n```\nMehr Plan.');
		assert.deepEqual([...frueher.geprueft], [[1, { behoben: true, wie: 'Gekürzt.' }]]);
		const nurFrueher = 'Plan.\n```json\n{"titel": "x"}\n```';
		assert.equal(lesePlanAntwort(nurFrueher).text, nurFrueher);
	});

	it('Stand: Rechnung behoben, wenn sie danach fehlt; Prüfung behoben, wenn der Planlauf es sagt', () => {
		const vorher: PlanPunkt[] = [
			{ von: 'rechnung', text: 'A' },
			{ von: 'rechnung', text: 'B' },
			{ von: 'pruefung', befund },
		];
		const s = planPruefStand({
			vorher,
			nachher: ['B'],
			geprueft: new Map([
				[1, { behoben: false, wie: 'Stunde 1 gekürzt.' }],
				[2, { behoben: true, wie: 'Bleibt, der Auftrag will 90 min.' }],
				[3, { behoben: false, wie: 'Bleibt.' }],
			]),
			pruefung: { fehler: null },
			rueckrunde: true,
		});
		assert.deepEqual(
			s.punkte.map((p) => [p.von, p.text, p.stand, p.antwort]),
			[
				['rechnung', 'A', 'behoben', 'Stunde 1 gekürzt.'],
				['rechnung', 'B', 'offen', 'Bleibt, der Auftrag will 90 min.'],
				['pruefung', befund.text, 'offen', 'Bleibt.'],
			],
		);
		assert.equal(s.pruefung, 'fertig');
		const ohne = planPruefStand({
			vorher,
			nachher: ['A', 'B'],
			geprueft: new Map(),
			pruefung: { fehler: 'X' },
			rueckrunde: false,
		});
		assert.equal(ohne.pruefung, 'gescheitert');
		assert.ok(ohne.punkte.every((p) => p.stand === 'offen'));
	});

	it('Nach „Ändern …“: Rechnung neu, Befunde der Prüfung bleiben; ohne früheren Stand nichts', () => {
		const alt: PlanPruefStand = {
			pruefung: 'fertig',
			grund: null,
			punkte: [
				{ von: 'rechnung', text: 'A', stand: 'behoben' },
				{ von: 'pruefung', text: befund.text, art: 'fehlt', wo: 'Stunde 6', stand: 'offen' },
			],
			geaendert: false,
		};
		const neu = nachAenderung(alt, {
			vorher: ['C'],
			nachher: [],
			rueckrunde: true,
			geprueft: new Map([[1, { behoben: true, wie: 'Gekürzt.' }]]),
		});
		assert.equal(neu?.geaendert, true);
		assert.deepEqual(
			neu?.punkte.map((p) => [p.von, p.text, p.stand, p.antwort]),
			[
				['rechnung', 'C', 'behoben', 'Gekürzt.'],
				['pruefung', befund.text, 'offen', undefined],
			],
		);
		assert.equal(nachAenderung(undefined, { vorher: ['C'], nachher: ['C'], rueckrunde: false }), undefined);
	});

	it('Bau: Minuten, Ziel und Niveau stehen in der Übersicht, bei alten Plänen nicht', () => {
		const roh = structuredClone(NOMEN);
		const s1 = roh.stunden[0];
		if (s1) {
			s1.aufgaben = s1.aufgaben.map((a, i) => (i === 0 ? { ...a, niveau: 2 } : a));
		}
		const text = aufgabenFuerBau(plan(roh), 'kapitel-1');
		assert.match(
			text,
			/^Die Stunde hat 45 min: Vorlesen 5 min, Kreisinput 10 min, Arbeitsblatt 25 min, Reflexion 5 min\.$/m,
		);
		assert.match(text, /^Ziel der Stunde \(Ziel 1\): Ich kann Nomen im Satz finden\.$/m);
		assert.match(text, /, Niveau ●●, Ziel 1, etwa 8 min: Nomen einkreisen$/m);
		const alt = aufgabenFuerBau(
			plan({
				stunden: [{ nr: 1, aufgaben: [auf('kapitel-1', 'ankreuzen', 'Nomen einkreisen')] }],
				dokumente: DOKUMENTE,
			}),
			'kapitel-1',
		);
		assert.doesNotMatch(alt, /Die Stunde hat|Ziel der Stunde|etwa/);
	});

	it('Vorlage: nur Read, Befunde im Format der Materialprüfung, nur bekannte Arten, nichts vom Prüfstand', () => {
		const vorlage = readFileSync(
			path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-plan-pruefung.md'),
			'utf8',
		);
		assert.match(vorlage, /Du hast nur Read/);
		assert.match(vorlage, /\{"befunde": \[\{"seite": null, "aufgabe": /);
		assert.match(vorlage, /Richtwerten für Minuten aus `unterrichtsplanung`/);
		const arten = [...vorlage.matchAll(/^- `([a-z-]+)`(?:, `([a-z-]+)`)*(?:, `([a-z-]+)`)?:/gm)].flatMap((t) =>
			t.slice(1).filter(Boolean),
		);
		assert.ok(arten.length >= 8);
		assert.deepEqual(
			arten.filter((a) => !(PRUEF_ARTEN as readonly string[]).includes(a)),
			[],
		);
		assert.doesNotMatch(vorlage, /Glöckchen|Ella|Hanne|Willi|Wilma|Achsensymmetr|Faltschnitt|Spiegel/);
		const plan = readFileSync(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit.md'), 'utf8');
		assert.match(plan, /"ziele": \[\{"nr": 1, "text": "Ich kann …", "handlung": true\}\]/);
		assert.match(plan, /"phasen": \[\{"was": "…", "minuten": 10, "arbeit": false\}\]/);
		const skill = readFileSync(path.join(WURZEL, 'skills', 'unterrichtsplanung', 'SKILL.md'), 'utf8');
		assert.match(skill, /^### Richtwerte für Minuten \(Kl\. 1–4\)$/m);
	});
});
