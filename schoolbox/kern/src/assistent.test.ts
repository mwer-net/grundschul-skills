import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { Antworten } from './assistent';
import {
	AUFTRAG_ZEICHEN,
	auftragAus,
	auftragSaetze,
	bausteinSchalter,
	blattLeitfigurStandard,
	einheitAngabenAus,
	einheitBestandteile,
	formatOptionen,
	formatWahl,
	FREITEXT,
	FUNKTIONEN,
	leereAntworten,
	leereEinheit,
	LERNGRUPPE,
	pruefeAntworten,
	schritteFuer,
	titelVorschlag,
	WEGE,
} from './assistent';
import type { EinheitAngaben } from './einheit';
import { EINHEIT_BESTANDTEILE, einheitAuftragAus, pruefeEinheitAngaben } from './einheit';
import { SchoolboxFehler } from './fehler';
import { WURZEL } from './konfig';
import { MAX_NAME } from './ordner';
import { ART_ANGABEN, ART_FORMATE, ARTEN } from './werte';

const RUECKFRAGEN = readFileSync(path.join(WURZEL, 'skills/grundschul-didaktik/references/rueckfragen.md'), 'utf8');

const mit = (teil: Partial<Antworten>): Antworten => ({
	...leereAntworten({ fach: 'mathematik', klasse: 2 }),
	...teil,
});

const ids = (a: Antworten) => schritteFuer(a).map((s) => s.id);

describe('Assistent: Schritte (131)', () => {
	it('Schrittfolge je Art in beiden Wegen', () => {
		// „Auftrag prüfen“ entfällt (190-37): Die Kontrolle ist der Aufgabenplan.
		const voll = ['start', 'art', 'format', 'fuerWen', 'thema', 'bausteine', 'klasse'];
		const ohne = (...weg: string[]) => voll.filter((s) => !weg.includes(s));
		const erwartet: Record<string, Record<string, string[]>> = {
			claude: {
				arbeitsblatt: voll,
				lesetext: voll,
				lernzielkontrolle: voll,
				klassenarbeit: voll,
				lernspiel: voll,
				stationen: voll,
				karten: ohne('bausteine'),
				lernplakat: ohne('bausteine'),
				praesentation: ohne('format'),
				unterrichtsplanung: ohne('format', 'bausteine'),
				sonstiges: ohne('bausteine'),
			},
			leer: {
				arbeitsblatt: ['start', 'art', 'format', 'titel'],
				lesetext: ['start', 'art', 'format', 'titel'],
				lernzielkontrolle: ['start', 'art', 'format', 'titel'],
				klassenarbeit: ['start', 'art', 'format', 'titel'],
				lernspiel: ['start', 'art', 'format', 'titel'],
				stationen: ['start', 'art', 'format', 'titel'],
				karten: ['start', 'art', 'format', 'titel'],
				lernplakat: ['start', 'art', 'titel'],
				praesentation: ['start', 'art', 'titel'],
				unterrichtsplanung: ['start', 'art', 'titel'],
				sonstiges: ['start', 'art', 'titel'],
			},
		};
		for (const weg of WEGE) {
			for (const art of ARTEN) {
				assert.deepEqual(ids(mit({ weg, art })), erwartet[weg]?.[art], `${weg} ${art}`);
			}
		}
	});

	it('Pflicht: Thema mit Claude, Titel beim leeren Blatt; „Deine Klasse“ ist optional', () => {
		const schritt = (a: Antworten, id: string) => schritteFuer(a).find((s) => s.id === id);
		assert.match(schritt(mit({}), 'thema')?.fehlt?.(mit({})) ?? '', /worum es geht/);
		const thema = mit({ thema: 'Uhr', titel: 'Uhr' });
		assert.equal(schritt(thema, 'thema')?.fehlt?.(thema), null);
		// Der Titel steht im Schritt „Thema und Ziel“ (190-37).
		const ohneTitel = mit({ thema: 'Uhr', titel: ' ' });
		assert.match(schritt(ohneTitel, 'thema')?.fehlt?.(ohneTitel) ?? '', /Titel/);
		const leer = mit({ weg: 'leer' });
		assert.match(schritt(leer, 'titel')?.fehlt?.(leer) ?? '', /Titel/);
		assert.equal(schritt(mit({}), 'klasse')?.optional, true);
	});

	it('Schrittleiste zeigt die Antworten wie A1', () => {
		const a = mit({ thema: 'Uhrzeit', lerngruppe: ['daz'], sonst: 'Bitte keine Digitaluhren.' });
		const antworten = Object.fromEntries(schritteFuer(a).map((s) => [s.id, s.antwort(a)]));
		assert.deepEqual(antworten, {
			start: 'Mit Claude',
			art: 'Arbeitsblatt',
			format: 'A4 hoch',
			fuerWen: 'Klasse 2 · Mathematik',
			thema: 'Uhrzeit · Übung · 20 min',
			bausteine: 'Selbsteinschätzung, Niveaus',
			klasse: '2 Angaben',
		});
		// Die Arbeitszeit steht beim Thema (190-38); „Claude entscheidet“ nennt die Leiste nicht.
		const lesen = mit({ art: 'lernspiel', thema: 'Uhrzeit' });
		assert.equal(
			schritteFuer(lesen)
				.find((s) => s.id === 'thema')
				?.antwort(lesen),
			'Uhrzeit · Übung',
		);
		assert.equal(
			schritteFuer(mit({ formatText: 'A5 quer' }))[2]?.antwort(mit({ formatText: 'A5 quer' })),
			'Anders: A5 quer',
		);
	});

	it('Titelvorschlag: Thema mit Claude, „Neues …“ beim leeren Blatt', () => {
		assert.equal(titelVorschlag(mit({ thema: 'Uhrzeit' })), 'Uhrzeit');
		assert.equal(titelVorschlag(mit({ weg: 'leer', thema: 'Uhrzeit' })), 'Neues Arbeitsblatt');
		assert.equal(titelVorschlag(mit({ weg: 'leer', art: 'praesentation' })), 'Neue Präsentation');
		assert.equal(titelVorschlag(mit({ art: 'lesetext' })), 'Neuer Lesetext');
		assert.equal(FREITEXT.titel.zeichen, MAX_NAME);
	});
});

describe('Assistent: Empfehlungen (131)', () => {
	it('Format: die erste Fassung der Tabelle ist vorgewählt, beim leeren Blatt jedes Format einmal', () => {
		for (const art of ARTEN) {
			assert.equal(formatWahl(mit({ art })).format, ART_ANGABEN[art].format, art);
			const leer = formatOptionen(mit({ weg: 'leer', art })).filter((o) => !o.vorlage);
			assert.deepEqual(
				leer.map((o) => o.format),
				ART_FORMATE[art],
				art,
			);
		}
		assert.deepEqual(
			formatOptionen(mit({ art: 'karten' })).map((o) => o.format),
			['a4-hoch', 'a4-hoch', 'a4-quer', 'folie'],
		);
		assert.equal(formatWahl(mit({ art: 'karten', format: 'Tafelkarten A4 quer' })).format, 'a4-quer');
	});

	it('Mini-Book nur bei Lesetext, mit Gerüst, in beiden Wegen', () => {
		for (const weg of WEGE) {
			for (const art of ARTEN) {
				const mini = formatOptionen(mit({ weg, art })).filter((o) => o.vorlage === 'minibuch');
				assert.equal(mini.length, art === 'lesetext' ? 1 : 0, `${weg} ${art}`);
				assert.ok(mini.every((o) => o.format === 'minibuch' && !o.empfohlen));
			}
		}
	});

	it('Bausteine nach `rueckfragen.md`: ★ folgt den Niveaus, bis man es selbst schaltet', () => {
		const an = (a: Antworten) => Object.fromEntries(bausteinSchalter(a).map((s) => [s.wert, s.an]));
		assert.deepEqual(an(mit({})), { selbsteinschaetzung: true, niveaus: true, sternchen: false });
		assert.deepEqual(an(mit({ bausteine: { niveaus: false } })), {
			selbsteinschaetzung: true,
			niveaus: false,
			sternchen: true,
		});
		assert.deepEqual(an(mit({ bausteine: { niveaus: false, sternchen: false } })).sternchen, false);
		assert.deepEqual(an(mit({ art: 'klassenarbeit' })), { selbsteinschaetzung: true, sternchen: true });
		assert.deepEqual(an(mit({ art: 'lernzielkontrolle' })), { selbsteinschaetzung: true });
		assert.deepEqual(an(mit({ art: 'lernspiel' })), { niveaus: true });
		assert.deepEqual(an(mit({ art: 'karten' })), {});
		assert.equal(bausteinSchalter(mit({ art: 'klassenarbeit' }))[0]?.bedingung, 'vor der Abgabe, nie benotet');
		assert.match(RUECKFRAGEN, /Ja {3}← Empfehlung, wenn Churer „nein" oder nicht gefragt/);
		assert.match(RUECKFRAGEN, /Nein ← Empfehlung, wenn Churer „ja"/);
	});

	it('Funktion und Lerngruppe stehen im Ablauf von `rueckfragen.md`', () => {
		assert.ok(RUECKFRAGEN.includes(`Funktion in der Reihe (${FUNKTIONEN.map((f) => f.name).join(' / ')})`));
		assert.ok(RUECKFRAGEN.includes('Lerngruppe (Leistungsspanne, DaZ, Förderbedarfe)'));
		assert.equal(LERNGRUPPE.length, 5);
	});
});

describe('Assistent: Freitext (131)', () => {
	it('gibt es nicht bei Klasse und Fach', () => {
		assert.equal('fach' in FREITEXT || 'klasse' in FREITEXT, false);
	});

	it('zählt nur, wo der Schritt ihn anbietet', () => {
		const text = (a: Partial<Antworten>) => auftragAus(mit({ thema: 'Uhr', ...a }));
		assert.match(text({ formatText: 'A5 quer' }), /Format: „A5 quer“ \(angelegt als A4 hoch\)/);
		assert.doesNotMatch(text({ weg: 'leer', formatText: 'A5 quer' }), /A5 quer/);
		assert.doesNotMatch(text({ art: 'praesentation', formatText: 'A5 quer' }), /A5 quer/);
		assert.doesNotMatch(text({ art: 'arbeitsblatt', artText: 'Rätselheft' }), /Rätselheft/);
		assert.doesNotMatch(text({ art: 'karten', umfangText: 'drei' }), /drei/);
		assert.match(text({ funktionText: 'Wiederholung' }), /Funktion in der Reihe: „Wiederholung“/);
		assert.match(text({ umfangText: 'drei Seiten' }), /Arbeitszeit je Kind: „drei Seiten“/);
		// Kein zweiter Punkt hinter einem Freitext, der schon mit einem Satzzeichen endet (190-21).
		assert.match(
			text({ thema: 'Wie spät ist es?', ziel: 'Ich kann die Uhr lesen.' }),
			/„Wie spät ist es\?“ Ich-kann/,
		);
		assert.doesNotMatch(text({ thema: 'Uhr.', ziel: 'Ich kann die Uhr lesen.' }), /“\./);
	});

	it('ein alter gespeicherter „Noch etwas aufs Blatt“ zählt nicht (190-43)', () => {
		const a = pruefeAntworten({ thema: 'Uhr', bausteineText: 'ein Rätsel' }, { fach: 'deutsch', klasse: 1 });
		assert.equal('bausteineText' in a, false);
		assert.doesNotMatch(auftragAus(a), /Rätsel|Zusätzlich/);
	});

	it('steht in der Vorschau als eigener Teil', () => {
		const saetze = auftragSaetze(mit({ thema: 'Uhrzeit', sonst: 'Keine Digitaluhren.' }));
		const frei = saetze.flat().filter((t) => t.art === 'freitext');
		assert.deepEqual(
			frei.map((t) => t.text),
			['Uhrzeit', 'Keine Digitaluhren.'],
		);
	});
});

describe('Assistent: Auftrag (131)', () => {
	it('Beispiel aus A1 S. 9', () => {
		const a = mit({
			thema: 'Uhrzeit: volle und halbe Stunden',
			lerngruppe: ['leistungsspanne', 'daz'],
			sonst: 'Bitte keine Digitaluhren. Willi darf bei Aufgabe 1 einen Tipp geben.',
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle ein Arbeitsblatt für Mathematik, Klasse 2, Format A4 hoch, Arbeitszeit je Kind 20 Minuten.',
				'Thema: „Uhrzeit: volle und halbe Stunden“. Formuliere das Ich-kann-Ziel selbst. Das Material dient zum Üben.',
				'Mit Selbsteinschätzung: Wachstumsstufen Samen → Keimling → Pflanze → Blume zum Ankreuzen und eine Reflexionsfrage.',
				'Mit drei Niveaus zur Wahl: ● Grundlage, ●● Kern, ●●● Herausforderung, die Kinder wählen.',
				'Ohne Sternchenaufgabe ★.',
				'Lerngruppe: große Leistungsspanne, Kinder mit Deutsch als Zweitsprache.',
				'Außerdem: „Bitte keine Digitaluhren. Willi darf bei Aufgabe 1 einen Tipp geben.“',
			].join('\n'),
		);
	});

	it('Präsentation ohne Niveaus: ★ springt auf an', () => {
		const a = mit({
			art: 'praesentation',
			fach: 'englisch',
			klasse: 3,
			thema: 'Colours',
			funktion: 'einfuehrung',
			bausteine: { niveaus: false },
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle eine Präsentation für Englisch, Klasse 3, Format Folien 16:9 für Beamer, Smartboard oder Display.',
				'Thema: „Colours“. Formuliere das Ich-kann-Ziel selbst. Das Material dient zur Einführung.',
				'Mit Selbsteinschätzung: Wachstumsstufen Samen → Keimling → Pflanze → Blume zum Ankreuzen und eine Reflexionsfrage.',
				'Ohne drei Niveaus zur Wahl: alle Kinder bearbeiten dieselben Aufgaben, steigend im Anspruch; keine Niveau-Punkte ● ●● ●●●, keine Wahlhilfe.',
				'Mit Sternchenaufgabe: eine Knobelaufgabe ★ als letzte Aufgabe, freiwillig für alle.',
				'Lerngruppe: keine Besonderheiten angegeben.',
			].join('\n'),
		);
	});

	it('Etwas anderes mit Freitext überall', () => {
		const a = mit({
			art: 'sonstiges',
			artText: 'Rätselheft',
			formatText: 'A5 quer',
			fach: 'deutsch',
			klasse: 'gemischt',
			thema: 'Tiere im Winter',
			ziel: 'Ich kann Tierspuren erkennen',
			funktionText: 'Wiederholung',
			lerngruppe: ['lrs'],
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle dieses Material: „Rätselheft“ für Deutsch, jahrgangsgemischt, Format: „A5 quer“ (angelegt als A4 hoch).',
				'Thema: „Tiere im Winter“. Ich-kann-Ziel: „Ich kann Tierspuren erkennen“. Funktion in der Reihe: „Wiederholung“.',
				'Lerngruppe: Kinder mit Lese-Rechtschreib-Schwierigkeiten.',
			].join('\n'),
		);
	});

	it('Längengrenze: alle Freitexte voll passen, längere lehnt der Kern ab', () => {
		const voll = Object.fromEntries(
			Object.entries(FREITEXT).map(([feld, { zeichen }]) => [feld, 'x'.repeat(zeichen)]),
		) as Partial<Antworten>;
		for (const art of ARTEN) {
			const leitfigur = { art: 'bibliothek' as const, figuren: [{ id: 'luna', name: 'L'.repeat(60) }] };
			const a = mit({ ...voll, art, lerngruppe: LERNGRUPPE.map((l) => l.wert), umfang: '30', leitfigur });
			assert.ok(auftragAus(a).length <= AUFTRAG_ZEICHEN, art);
			assert.deepEqual(pruefeAntworten(a, a), a);
		}
		assert.throws(
			() => pruefeAntworten({ sonst: 'x'.repeat(FREITEXT.sonst.zeichen + 1) }, mit({})),
			/höchstens 1000 Zeichen/,
		);
	});
});

describe('Assistent: Leitfigur eines einzelnen Materials (253)', () => {
	it('Willi ist die Vorgabe und steht nicht im Auftrag; eine Figur der Bibliothek oder keine schon', () => {
		const ohne = auftragAus(mit({ thema: 'Uhrzeit' }));
		assert.equal(auftragAus(mit({ thema: 'Uhrzeit', leitfigur: blattLeitfigurStandard() })), ohne);
		assert.doesNotMatch(ohne, /Leitfigur/);
		const luna = { art: 'bibliothek' as const, figuren: [{ id: 'luna', name: 'Luna' }] };
		assert.match(auftragAus(mit({ thema: 'Uhrzeit', leitfigur: luna })), /^Leitfigur: Luna aus der Bibliothek\.$/m);
		assert.match(auftragAus(mit({ thema: 'Uhrzeit', leitfigur: { art: 'keine' } })), /^Ohne Leitfigur\.$/m);
	});

	it('der Server nimmt eine Figur oder keine, nie eine eigene oder ein Paar', () => {
		const vorbelegt = { fach: 'mathematik' as const, klasse: 2 as const };
		assert.deepEqual(pruefeAntworten({}, vorbelegt).leitfigur, blattLeitfigurStandard());
		assert.deepEqual(pruefeAntworten({ leitfigur: { art: 'keine' } }, vorbelegt).leitfigur, { art: 'keine' });
		for (const falsch of [
			{ art: 'neu', name: 'Luna' },
			{ art: 'bibliothek', figuren: [{ id: 'willi', name: 'Willi' }, { id: 'wilma', name: 'Wilma' }] },
		]) {
			assert.throws(() => pruefeAntworten({ leitfigur: falsch }, vorbelegt), SchoolboxFehler);
		}
	});
});

describe('Assistent: jede Einstellung steht im Auftrag (210)', () => {
	type Paar<T> = [Partial<T>, Partial<T>];

	it('einzelnes Material: jedes Feld ändert den Auftrag, an wie aus', () => {
		const formate = formatOptionen({ art: 'arbeitsblatt', weg: 'claude' });
		// `null`: kein Teil dieses Auftrags, mit Grund. Ein neues Feld muss hier stehen, sonst schlägt `tsc` an.
		const paare: Record<keyof Antworten, Paar<Antworten> | null> = {
			weg: null, // Nur der Weg mit Claude hat einen Auftrag.
			einheit: null, // Die Einheit hat ihren eigenen Auftrag, siehe unten.
			eh: null,
			titel: null, // Steht als Titel des Dokuments im Kopf des Prompts.
			art: [{ art: 'arbeitsblatt' }, { art: 'lesetext' }],
			artText: [
				{ art: 'sonstiges', artText: '' },
				{ art: 'sonstiges', artText: 'Rätselheft' },
			],
			format: [{ format: '' }, { format: formate[1]?.wert ?? '' }],
			formatText: [{ formatText: '' }, { formatText: 'A5 quer' }],
			fach: [{ fach: 'mathematik' }, { fach: 'deutsch' }],
			klasse: [{ klasse: 2 }, { klasse: 'gemischt' }],
			thema: [{ thema: 'Uhrzeit' }, { thema: 'Igel' }],
			ziel: [{ ziel: '' }, { ziel: 'Ich kann die Uhr lesen.' }],
			funktion: [{ funktion: null }, { funktion: 'vertiefung' }],
			funktionText: [{ funktionText: '' }, { funktionText: 'Wiederholung' }],
			bausteine: [{ bausteine: {} }, { bausteine: { selbsteinschaetzung: false } }],
			umfang: [{ umfang: null }, { umfang: 'claude' }],
			umfangText: [{ umfangText: '' }, { umfangText: 'zwei Schulstunden' }],
			lerngruppe: [{ lerngruppe: [] }, { lerngruppe: ['daz'] }],
			sonst: [{ sonst: '' }, { sonst: 'Keine Digitaluhren.' }],
			leitfigur: [{ leitfigur: blattLeitfigurStandard() }, { leitfigur: { art: 'keine' } }],
		};
		for (const [feld, paar] of Object.entries(paare)) {
			if (paar) {
				const [a, b] = paar.map((teil) => auftragAus(mit({ thema: 'Uhrzeit', ...teil })));
				assert.notEqual(a, b, feld);
			}
		}
	});

	it('einzelnes Material: jeder angebotene Baustein steht mit seiner Wirkung da, an wie aus', () => {
		for (const art of ARTEN) {
			for (const s of bausteinSchalter({ art, bausteine: {} })) {
				const text = (an: boolean) => auftragAus(mit({ art, thema: 'Uhr', bausteine: { [s.wert]: an } }));
				assert.notEqual(text(true), text(false), `${art} ${s.wert}`);
				assert.match(text(false), /^Ohne [^:\n]+(:| ★)/m, `${art} ${s.wert}`);
				assert.match(text(true), /^Mit [^:\n]+: /m, `${art} ${s.wert}`);
			}
		}
		const aus = auftragAus(
			mit({ thema: 'Uhr', bausteine: { selbsteinschaetzung: false, niveaus: false, sternchen: false } }),
		);
		assert.match(aus, /^Ohne Selbsteinschätzung: keine Wachstumsstufen/m);
		assert.match(aus, /^Ohne drei Niveaus zur Wahl: alle Kinder bearbeiten dieselben Aufgaben/m);
		assert.match(aus, /^Ohne Sternchenaufgabe ★\.$/m);
	});

	it('einzelnes Material: „Claude entscheidet“ und leere Lerngruppe stehen ausdrücklich da', () => {
		const text = auftragAus(mit({ thema: 'Uhr', umfang: 'claude' }));
		assert.match(text, /Arbeitszeit je Kind nicht festgelegt, entscheide du\./);
		assert.match(text, /^Lerngruppe: keine Besonderheiten angegeben\.$/m);
		// In der Vorschau ist die Wahl hervorgehoben, die Wirkung nicht.
		const saetze = auftragSaetze(mit({ thema: 'Uhr', bausteine: { niveaus: false } }));
		const niveaus = saetze.find((satz) => satz.some((t) => t.text === 'drei Niveaus zur Wahl'));
		assert.deepEqual(
			niveaus?.map((t) => t.art),
			['fest', 'antwort', 'fest'],
		);
	});

	it('Einheit: jedes Feld ändert den Auftrag, an wie aus', () => {
		const basis = { thema: 'Uhrzeit', fach: 'mathematik', klasse: 2 };
		const text = (teil: Partial<EinheitAngaben>) => einheitAuftragAus(pruefeEinheitAngaben({ ...basis, ...teil }));
		const paare: Record<keyof EinheitAngaben, Paar<EinheitAngaben>> = {
			titel: [{ titel: '' }, { titel: 'Die Rathausuhr' }],
			fach: [{ fach: 'mathematik' }, { fach: 'deutsch' }],
			klasse: [{ klasse: 2 }, { klasse: 'gemischt' }],
			thema: [{ thema: 'Uhrzeit' }, { thema: 'Geld' }],
			ziele: [{ ziele: [] }, { ziele: ['Ich kann volle Stunden ablesen.'] }],
			vorwissen: [{ vorwissen: '' }, { vorwissen: 'Zahlen bis 12' }],
			dauer: [{ dauer: '1 Woche' }, { dauer: '2 Wochen' }],
			stundenJeWoche: [{ stundenJeWoche: 2 }, { stundenJeWoche: 4 }],
			bestandteile: [{ bestandteile: [] }, { bestandteile: ['Lernspiel'] }],
			nochEtwas: [{ nochEtwas: '' }, { nochEtwas: 'ein Elternbrief' }],
			idee: [{ idee: '' }, { idee: 'Detektive' }],
			leitfigur: [
				{ leitfigur: { art: 'bibliothek', figuren: [{ id: 'willi', name: 'Willi' }] } },
				{ leitfigur: { art: 'neu', name: 'Luna', aussehen: 'braune Eule' } },
			],
			aussehen: [{ aussehen: 'eigen' }, { aussehen: 'schlicht' }],
			bilder: [{ bilder: true }, { bilder: false }],
			verkauf: [{ verkauf: false }, { verkauf: true }],
			autor: [
				{ verkauf: true, autor: '' },
				{ verkauf: true, autor: 'Lernwerkstatt Muster' },
			],
			bausteine: [
				{ bausteine: { selbsteinschaetzung: false, niveaus: false, sternchen: false } },
				{ bausteine: { selbsteinschaetzung: true, niveaus: true, sternchen: true } },
			],
			lerngruppe: [{ lerngruppe: [] }, { lerngruppe: ['große Leistungsspanne'] }],
			klasseText: [{ klasseText: '' }, { klasseText: 'Viele lieben Detektivgeschichten.' }],
		};
		for (const [feld, [a, b]] of Object.entries(paare)) {
			assert.notEqual(text(a), text(b), feld);
		}
		for (const b of ['selbsteinschaetzung', 'niveaus', 'sternchen'] as const) {
			const aus = { selbsteinschaetzung: false, niveaus: false, sternchen: false };
			assert.notEqual(text({ bausteine: aus }), text({ bausteine: { ...aus, [b]: true } }), b);
		}
	});

	it('Einheit (242): eine eigene Leitfigur, und im Auftrag steht kein Willi', () => {
		const angaben = pruefeEinheitAngaben({
			thema: 'Spiegeln',
			fach: 'mathematik',
			klasse: 2,
			leitfigur: { art: 'neu', name: 'Luna', aussehen: 'braune Eule mit grünem Strickschal.' },
		});
		const text = einheitAuftragAus(angaben);
		assert.match(text, /^Leitfigur: Luna \(neu, Aussehen: braune Eule mit grünem Strickschal\)\.$/m);
		assert.doesNotMatch(text, /Willi|Wilma/);
	});

	it('Einheit (242): Name und Aussehen der eigenen Figur bleiben je in einer Zeile', () => {
		const text = einheitAuftragAus(
			pruefeEinheitAngaben({
				thema: 'Spiegeln',
				fach: 'mathematik',
				klasse: 2,
				leitfigur: { art: 'neu', name: ' Luna\n\nEule ', aussehen: 'braun,\r\n\tmit Schal' },
			}),
		);
		assert.match(text, /^Leitfigur: Luna Eule \(neu, Aussehen: braun, mit Schal\)\.$/m);
	});

	it('Einheit (242): Figur der Bibliothek, Vorgabe und die Werte vor 242', () => {
		const satz = (leitfigur: unknown) =>
			einheitAuftragAus(pruefeEinheitAngaben({ thema: 'Uhrzeit', fach: 'mathematik', klasse: 2, leitfigur }))
				.split('\n')
				.find((z) => z.startsWith('Leitfigur') || z.startsWith('Ohne Leitfigur'));
		assert.equal(
			satz({ art: 'bibliothek', figuren: [{ id: 'pelle', name: 'Pelle' }] }),
			'Leitfigur: Pelle aus der Bibliothek.',
		);
		assert.equal(satz(undefined), 'Leitfigur: Willi und Wilma aus der Bibliothek.');
		assert.equal(satz('beide'), 'Leitfigur: Willi und Wilma aus der Bibliothek.');
		assert.equal(satz('wilma'), 'Leitfigur: Wilma aus der Bibliothek.');
		assert.equal(satz('keine'), 'Ohne Leitfigur.');
		assert.equal(satz({ art: 'keine' }), 'Ohne Leitfigur.');
		assert.equal(satz({ art: 'neu', name: 'Luna' }), 'Leitfigur: Luna (neu, Aussehen: entscheide du).');
		for (const falsch of [
			'luna',
			{ art: 'neu', name: ' ' },
			{ art: 'bibliothek', figuren: [] },
			{ art: 'bibliothek', figuren: [{ id: '../x', name: 'X' }] },
		]) {
			assert.throws(() => satz(falsch), SchoolboxFehler);
		}
	});

	it('Einheit: alles aus oder leer ergibt je Feld einen ausdrücklichen Satz', () => {
		const text = einheitAuftragAus(pruefeEinheitAngaben({ thema: 'Uhrzeit', fach: 'mathematik', klasse: 2 }));
		for (const zeile of [
			/^Ich-kann-Ziele: nicht angegeben, formuliere sie selbst\.$/m,
			/^Vorwissen der Klasse: nicht angegeben/m,
			/^Bestandteile: keine ausgewählt, entscheide du\.$/m,
			/^Mit Rahmengeschichte, Idee: nicht angegeben/m,
			/^Ohne Selbsteinschätzung: kein Fuß mit Wachstumsstufen \(Samen bis Blume\), keine Lernlandkarte/m,
			/^Ohne drei Niveaus: je Stunde ein Arbeitsblatt für alle/m,
			/^Ohne Sternchenaufgabe ★\.$/m,
			/^Lerngruppe: keine Besonderheiten angegeben\.$/m,
			/^Zur Klasse: nichts weiter angegeben\.$/m,
			/^Nicht für den Verkauf: /m,
		]) {
			assert.match(text, zeile);
		}
		const an = einheitAuftragAus(
			pruefeEinheitAngaben({
				thema: 'Uhrzeit',
				fach: 'mathematik',
				klasse: 2,
				bausteine: { selbsteinschaetzung: true, niveaus: true, sternchen: true },
			}),
		);
		assert.match(an, /^Mit Selbsteinschätzung: /m);
		assert.match(an, /^Mit drei Niveaus zur Wahl /m);
		assert.match(an, /^Mit Sternchenaufgabe: /m);
		assert.doesNotMatch(an, /^Ohne (Selbst|drei|Stern)/m);
	});
});

describe('Assistent: Antworten prüfen (131)', () => {
	const fehler = (roh: unknown) => () => pruefeAntworten(roh, { fach: 'deutsch', klasse: 1 });

	it('füllt Fehlendes mit der Vorbelegung, die Empfehlung gilt', () => {
		const a = pruefeAntworten({ thema: 'Igel' }, { fach: 'sachunterricht', klasse: 3 });
		assert.deepEqual(a, { ...leereAntworten({ fach: 'sachunterricht', klasse: 3 }), thema: 'Igel' });
	});

	it('lehnt Unbekanntes ab', () => {
		for (const roh of [
			null,
			[],
			'Text',
			{ boese: 1 },
			{ art: 'quiz' },
			{ weg: 'chat' },
			{ format: 'A2 hoch' },
			{ art: 'praesentation', format: 'A4 hoch' },
			{ format: 3 },
			{ fach: 'mathe' },
			{ klasse: '2' },
			{ funktion: 'wiederholung' },
			{ umfang: '3' },
			{ bausteine: { glitzer: true } },
			{ bausteine: { niveaus: 'ja' } },
			{ bausteine: [] },
			{ lerngruppe: 'daz' },
			{ lerngruppe: ['hochbegabt'] },
			{ thema: 42 },
		]) {
			assert.throws(fehler(roh), SchoolboxFehler, JSON.stringify(roh));
		}
	});

	it('nimmt gültige Werte und doppelte Lerngruppen nur einmal', () => {
		const a = pruefeAntworten(
			{
				art: 'karten',
				format: 'Tafelkarten A4 quer',
				funktion: 'vertiefung',
				umfang: 'claude',
				lerngruppe: ['daz', 'daz'],
				bausteine: { sternchen: true },
			},
			{ fach: 'englisch', klasse: 4 },
		);
		assert.equal(a.format, 'Tafelkarten A4 quer');
		assert.deepEqual(a.lerngruppe, ['daz']);
		assert.deepEqual(a.bausteine, { sternchen: true });
		assert.equal(a.funktion, 'vertiefung');
	});
});

describe('Assistent: Unterrichtseinheit (140)', () => {
	const einheit = (teil: Partial<Antworten> = {}) =>
		mit({ weg: 'claude', einheit: true, art: 'arbeitsblatt', thema: 'Uhrzeit', ...teil });

	it('eigene Schrittfolge nur im Weg Claude', () => {
		assert.deepEqual(ids(einheit()), [
			'start',
			'art',
			'fuerWen',
			'eThema',
			'eUmfang',
			'eBestandteile',
			'eRahmen',
			'bausteine',
			'klasse',
		]);
		assert.ok(!ids(einheit({ weg: 'leer' })).some((id) => id.startsWith('e')));
		assert.ok(!ids(mit({ weg: 'claude' })).some((id) => id.startsWith('e')));
	});

	it('Empfehlungen: fünf Bestandteile vorgewählt, Rahmengeschichte immer (190-39)', () => {
		assert.deepEqual(
			einheitBestandteile(leereEinheit()),
			EINHEIT_BESTANDTEILE.filter((b) => b.empfohlen).map((b) => b.name),
		);
		assert.equal(einheitBestandteile(leereEinheit()).length, 5);
		const text = einheitAuftragAus(pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Uhrzeit' }))));
		assert.match(text, /Mit Rahmengeschichte/);
		assert.match(text, /Zahl der Materialien: entscheide du\./);
		// Titel gleich Thema: kein doppeltes „zum Thema“ (190-21).
		assert.doesNotMatch(text, /zum Thema/);
	});

	it('nur mit Thema und sonst Empfehlungen: Angaben gehen durch die Prüfung des Servers', () => {
		const angaben = pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Uhrzeit' })));
		assert.equal(angaben.thema, 'Uhrzeit');
		assert.equal(angaben.dauer, '2 Wochen');
		assert.equal(angaben.bilder, true);
	});

	it('Bestandteile, Freitext und „Anders …“ stehen im Auftrag', () => {
		const eh = {
			...leereEinheit(),
			bestandteile: ['Lernspiel', 'Lesetexte'],
			nochEtwas: 'ein Elternbrief',
			dauerText: '5 Wochen',
		};
		const text = einheitAuftragAus(pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Uhrzeit', eh }))));
		assert.match(text, /Lernspiel/);
		assert.match(text, /Lesetexte/);
		assert.match(text, /ein Elternbrief/);
		assert.match(text, /5 Wochen/);
		assert.match(text, /^Bestandteile: Lernspiel, Lesetexte\.$/m);
		// Was nicht gewählt ist, steht ausdrücklich da: Sonst ergänzt Claude es nach dem Skill (210).
		assert.match(text, /^Nicht gewählt, also weglassen: .*Lernzielkontrolle.*\.$/m);
		assert.doesNotMatch(text, /weglassen: .*Lernspiel/);
	});

	it('Verkauf auf Eduki steht nur im Auftrag, wenn er gewählt ist', () => {
		const auftrag = (eh: Partial<ReturnType<typeof leereEinheit>>) =>
			einheitAuftragAus(
				pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Geld', eh: { ...leereEinheit(), ...eh } }))),
			);
		assert.doesNotMatch(auftrag({}), /Eduki/);
		assert.match(
			auftrag({}),
			/Nicht für den Verkauf: kein Deckblatt, kein Quellenverzeichnis, kein Angebotstext\.$/,
		);
		assert.doesNotMatch(auftrag({ autor: 'Lernwerkstatt Muster' }), /Eduki|Lernwerkstatt/);
		assert.match(
			auftrag({ verkauf: true }),
			/Die Einheit soll auf Eduki verkauft werden, ohne Namen auf dem Deckblatt\.$/,
		);
		assert.match(
			auftrag({ verkauf: true, autor: ' Lernwerkstatt Muster ' }),
			/auf Eduki verkauft werden, Name auf dem Deckblatt: Lernwerkstatt Muster\.$/,
		);
	});
});
