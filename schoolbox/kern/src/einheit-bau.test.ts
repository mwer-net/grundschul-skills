import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { leseAbbildungsKatalog } from './abbildungen-katalog';
import type { EinheitPlan } from './einheit';
import { lesePlan } from './einheit';
import {
	ABBILDUNGEN_DATEIEN,
	bauReihenfolge,
	beendeLaufEintrag,
	BILDER_SCHRITT,
	fehlendeAbbildungsTeile,
	fertigText,
	gelesenAus,
	lektuereFehltText,
	lektuereZeile,
	leseSteckbrief,
	neuerLaufEintrag,
	pflichtFuer,
	PFLICHTLEKTUERE,
	READ_ZEILEN,
	rolleVon,
	SKILL_PRAEFIX,
} from './einheit-bau';
import { WURZEL } from './konfig';
import { FAECHER } from './werte';

const dok = (slug: string, art: EinheitPlan['dokumente'][number]['art'] = 'arbeitsblatt') => ({
	slug,
	titel: slug,
	art,
	format: 'a4-hoch',
	zweck: '',
	fertig: false,
});

/** Jede Datei, die `pflichtFuer` nennen kann, als Pfad ab dem Ordner der Skills; ein Skill als seine `SKILL.md`. */
const allePflichtDateien = () => {
	const eintraege = new Set<string>();
	for (const l of PFLICHTLEKTUERE) {
		for (const fach of FAECHER) {
			for (const e of pflichtFuer(l.rolle, { fach, reihe: true, verkauf: true })) {
				eintraege.add(e.startsWith(SKILL_PRAEFIX) ? `${e.slice(SKILL_PRAEFIX.length)}/SKILL.md` : e);
			}
		}
	}
	return [...eintraege];
};

/**
 * Rund 21.000 Token, unter der Grenze von 25.000 Token je Read. Von einer größeren Datei liefert Read ohne offset und
 * limit nur den Anfang, und `bauen` zählt sie trotzdem als ganz gelesen (226).
 */
const ZEICHEN_MAX = 40_000;
/**
 * Heute schon größer; der heutige Wert ist der Deckel. Der Auftakt hat 26.606 Token, Read liefert davon nur die Zeilen
 * 1–416. Ticket 231 bringt ihn unter die Grenze.
 */
const GROESSER_ERLAUBT: Record<string, number> = {
	// Geprüfter Auftakt als Beispiel für Szenen aus SVG; Pflicht nur für einen Auftakt in einer Reihe.
	'html-materialerstellung/assets/beispiel-auftakt.html': 48_465,
};

describe('Pflichtlektüre (220)', () => {
	it('jeder Skill und jede Datei der Liste existiert, auch die Fach-Skills', () => {
		const fehlen = allePflichtDateien().filter((d) => !existsSync(path.join(WURZEL, 'skills', d)));
		assert.deepEqual(fehlen, []);
	});

	it(`Größenwächter: keine Pflichtdatei und keine Datei des Katalogs über ${ZEICHEN_MAX} Zeichen oder ${READ_ZEILEN} Zeilen (226)`, () => {
		const dateien = [...new Set([...allePflichtDateien(), ...ABBILDUNGEN_DATEIEN])];
		const zu = dateien.flatMap((d) => {
			const text = readFileSync(path.join(WURZEL, 'skills', d), 'utf8');
			const zeilen = text.split('\n').length;
			const max = GROESSER_ERLAUBT[d] ?? ZEICHEN_MAX;
			return text.length > max || zeilen > READ_ZEILEN ? [`${d}: ${text.length} Zeichen, ${zeilen} Zeilen`] : [];
		});
		assert.deepEqual(zu, []);
		assert.ok(dateien.includes('html-materialerstellung/references/abbildungen/mathe-geometrie.md'));
		assert.ok(dateien.includes('html-materialerstellung/references/gestaltung.md'));
		assert.ok(dateien.includes('fach-mathematik/SKILL.md'));
	});

	it('Fach-Skill an zweiter Stelle, Reihe und Verkauf nur, wenn sie gelten; Unbekanntes wie „sonstiges“', () => {
		const ohne = pflichtFuer('arbeitsblatt', { fach: 'mathematik', reihe: false, verkauf: false });
		assert.equal(ohne[0], 'skill:grundschul-didaktik');
		assert.equal(ohne[1], 'skill:fach-mathematik');
		assert.ok(ohne.includes('html-materialerstellung/references/layout.md'));
		assert.ok(!ohne.includes('unterrichtsplanung/references/reihe-als-geschichte.md'));
		const reihe = pflichtFuer('arbeitsblatt', { fach: 'mathematik', reihe: true, verkauf: false });
		assert.ok(reihe.includes('unterrichtsplanung/references/reihe-als-geschichte.md'));
		const deck = pflichtFuer('deckblatt', { fach: 'mathematik', reihe: false, verkauf: true });
		assert.ok(deck.includes('html-materialerstellung/references/verkauf.md'));
		assert.deepEqual(
			pflichtFuer('gibt-es-nicht', { fach: 'deutsch', reihe: false, verkauf: false }),
			pflichtFuer('sonstiges', { fach: 'deutsch', reihe: false, verkauf: false }),
		);
		assert.equal(new Set(ohne).size, ohne.length);
	});

	it('Präsentation und Auftakt lesen die Folien, das Arbeitsblatt nicht (227)', () => {
		const folien = 'html-materialerstellung/references/folien.md';
		assert.ok(pflichtFuer('praesentation', { fach: 'deutsch', reihe: false, verkauf: false }).includes(folien));
		assert.ok(pflichtFuer('praesentation', { fach: 'deutsch', reihe: true, verkauf: false }).includes(folien));
		assert.ok(!pflichtFuer('arbeitsblatt', { fach: 'deutsch', reihe: true, verkauf: true }).includes(folien));
	});

	it('liest Skill-Aufrufe und Read im Ordner der Skills; alles andere zählt nicht', () => {
		assert.equal(gelesenAus('Skill', { skill: 'fach-mathematik' }), 'skill:fach-mathematik');
		assert.equal(gelesenAus('Skill', { skill: 'anthropic-skills:lernspiel' }), 'skill:lernspiel');
		assert.equal(
			gelesenAus('Read', {
				file_path: '/tmp/x/ablage/.claude/skills/grundschul-didaktik/references/druck-und-platz.md',
			}),
			'grundschul-didaktik/references/druck-und-platz.md',
		);
		assert.equal(gelesenAus('Read', { file_path: '/tmp/x/.claude/skills/lernspiel/SKILL.md' }), 'skill:lernspiel');
		assert.equal(gelesenAus('Read', { file_path: '/tmp/x/arbeit/einheit.json' }), null);
		assert.equal(gelesenAus('Edit', { file_path: '/tmp/x/skills/lernspiel/SKILL.md' }), null);
		assert.equal(lektuereZeile('skill:lernspiel'), 'Skill lernspiel laden');
		assert.equal(lektuereZeile('lernspiel/references/x.md'), 'Read lernspiel/references/x.md');
	});

	it('ein Read zählt nur, wenn er die Datei ganz abdeckt (226)', () => {
		const file_path = '/tmp/x/.claude/skills/html-materialerstellung/references/abbildungen.md';
		const eintrag = 'html-materialerstellung/references/abbildungen.md';
		assert.equal(gelesenAus('Read', { file_path }), eintrag);
		assert.equal(gelesenAus('Read', { file_path, limit: 50 }), null);
		assert.equal(gelesenAus('Read', { file_path, offset: 200 }), null);
		assert.equal(gelesenAus('Read', { file_path, offset: 200, limit: 2000 }), null);
		assert.equal(gelesenAus('Read', { file_path, offset: 1, limit: 2000 }), eintrag);
		assert.equal(gelesenAus('Read', { file_path, limit: 5000 }), eintrag);
		assert.equal(gelesenAus('Read', { file_path: '/tmp/x/.claude/skills/lernspiel/SKILL.md', limit: 20 }), null);
	});
});

describe('Reihenfolge und fertige Materialien (220)', () => {
	const plan = lesePlan(
		{
			titel: 'Uhr',
			annahmen: [],
			dokumente: [
				dok('deckblatt', 'sonstiges'),
				dok('hinweise', 'unterrichtsplanung'),
				dok('kapitel-2'),
				dok('spiel', 'lernspiel'),
				dok('kapitel-1'),
				dok('vorleseheft', 'unterrichtsplanung'),
				dok('quellen', 'sonstiges'),
				dok('eduki-angebot', 'sonstiges'),
			],
			stunden: [
				{
					nr: 1,
					handlung: '',
					begriffe: [],
					aufgaben: [
						{ dokument: 'kapitel-1', format: 'zuordnen', inhalt: '', bereich: 'I', zweitesMal: false },
					],
				},
				{
					nr: 2,
					handlung: '',
					begriffe: [],
					aufgaben: [
						{ dokument: 'kapitel-2', format: 'sortieren', inhalt: '', bereich: 'II', zweitesMal: false },
					],
				},
			],
		},
		24,
	) as EinheitPlan;

	it('Vorleseheft, Bilder, Kapitel nach Stunde, übrige, dann Hinweise, Deckblatt, Quellen, Angebot', () => {
		assert.deepEqual(bauReihenfolge(plan, true), [
			'vorleseheft',
			BILDER_SCHRITT,
			'kapitel-1',
			'kapitel-2',
			'spiel',
			'hinweise',
			'deckblatt',
			'quellen',
			'eduki-angebot',
		]);
		assert.ok(!bauReihenfolge(plan, false).includes(BILDER_SCHRITT));
		assert.equal(rolleVon(dok('eduki-angebot', 'sonstiges')), 'angebot');
		assert.equal(rolleVon(dok('hinweise', 'unterrichtsplanung')), 'hinweise');
	});

	it('Fertige Materialien mit Seiten und Steckbrief; Fremdes im Steckbrief fällt weg', () => {
		assert.equal(fertigText(plan, [], {}), 'Schon fertig: noch nichts.');
		const steckbrief = leseSteckbrief({ figuren: ['Willi'], loesung: 'U', merken: 'Minutenzeiger', boese: 'x' });
		assert.deepEqual(Object.keys(steckbrief).sort(), ['figuren', 'loesung', 'merken']);
		const text = fertigText(plan, ['kapitel-1'], {
			'kapitel-1': { seiten: 2, formate: ['zuordnen'], ...steckbrief },
		});
		assert.match(
			text,
			/- dokumente\/kapitel-1 „kapitel-1“: 2 Seiten\. Formate: zuordnen\. Figuren: Willi\. Rätselkette: U\. Merken: Minutenzeiger/,
		);
		assert.doesNotMatch(text, /kapitel-2/);
	});
});

describe('Katalog der Abbildungen je Element (226)', () => {
	const katalog = leseAbbildungsKatalog();
	const EINSTIEG = 'html-materialerstellung/references/abbildungen.md';
	const GEOMETRIE = 'html-materialerstellung/references/abbildungen/mathe-geometrie.md';
	const ZAHLEN = 'html-materialerstellung/references/abbildungen/mathe-zahlen.md';

	it('verlangt je Element seine Datei und den Einstieg, nur was noch fehlt', () => {
		const html = '<p>Zähle.</p><x-gitter art="punkt"></x-gitter><x-uhr zeit="4:30"/><x-gitter></x-gitter>';
		assert.deepEqual(fehlendeAbbildungsTeile(html, new Set(), katalog), [
			{ datei: EINSTIEG, elemente: ['x-gitter', 'x-uhr'] },
			{ datei: GEOMETRIE, elemente: ['x-gitter'] },
			{ datei: ZAHLEN, elemente: ['x-uhr'] },
		]);
		assert.deepEqual(fehlendeAbbildungsTeile(html, new Set([EINSTIEG, ZAHLEN]), katalog), [
			{ datei: GEOMETRIE, elemente: ['x-gitter'] },
		]);
		assert.deepEqual(fehlendeAbbildungsTeile(html, new Set([EINSTIEG, ZAHLEN, GEOMETRIE]), katalog), []);
	});

	it('Elemente aus dem Einstieg verlangen nur ihn; Kommentare, unbekannte x-… und ein Text ohne Element nichts', () => {
		assert.deepEqual(fehlendeAbbildungsTeile('<x-lueckentext>Der [Hund]</x-lueckentext>', new Set(), katalog), [
			{ datei: EINSTIEG, elemente: ['x-lueckentext'] },
		]);
		const ohne = '<!-- <x-gitter></x-gitter> --><p>x-gitter</p><x-gibt-es-nicht></x-gibt-es-nicht><x-gitterchen>';
		assert.deepEqual(fehlendeAbbildungsTeile(ohne, new Set(), katalog), []);
		assert.deepEqual(fehlendeAbbildungsTeile('<p>Lesetext</p>', new Set(), katalog), []);
	});

	it('die Antwort von bauen nennt alles Fehlende auf einmal', () => {
		assert.equal(
			lektuereFehltText([], [{ datei: GEOMETRIE, elemente: ['x-gitter'] }]),
			`Nicht gebaut: Du verwendest <x-gitter>. Lies zuerst ganz, ohne offset und limit:\n- Read ${GEOMETRIE}\nRufe bauen danach wieder auf.`,
		);
		const beides = lektuereFehltText(
			[EINSTIEG, 'skill:fach-mathematik'],
			[
				{ datei: EINSTIEG, elemente: ['x-gitter', 'x-uhr'] },
				{ datei: GEOMETRIE, elemente: ['x-gitter'] },
				{ datei: ZAHLEN, elemente: ['x-uhr'] },
			],
		);
		assert.equal(
			beides,
			[
				'Nicht gebaut: Die Pflichtlektüre fehlt noch. Du verwendest <x-gitter>, <x-uhr>. Lies zuerst ganz, ohne offset und limit:',
				`- Read ${EINSTIEG}`,
				'- Skill fach-mathematik laden',
				`- Read ${GEOMETRIE}`,
				`- Read ${ZAHLEN}`,
				'Rufe bauen danach wieder auf.',
			].join('\n'),
		);
	});
});

describe('Protokoll der Läufe (240)', () => {
	it('hält die Kosten des Laufs und daneben die der Sitzung fest', () => {
		const e = neuerLaufEintrag('korrektur', 'kapitel-1', []);
		beendeLaufEintrag(e, Date.now(), {
			fehler: null,
			abgebrochen: false,
			verbrauch: { runden: 43, kostenUsd: 2.24, kostenSitzungUsd: 9.34 },
		});
		assert.equal(e.kostenUsd, 2.24);
		assert.equal(e.kostenSitzungUsd, 9.34);
		assert.equal(e.ergebnis, 'fertig');
	});
});
