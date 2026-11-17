import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { EinheitPlan } from './einheit';
import { lesePlan } from './einheit';
import {
	bauReihenfolge,
	BILDER_SCHRITT,
	fertigText,
	gelesenAus,
	lektuereZeile,
	leseSteckbrief,
	pflichtFuer,
	PFLICHTLEKTUERE,
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

describe('Pflichtlektüre (220)', () => {
	it('jeder Skill und jede Datei der Liste existiert, auch die Fach-Skills', () => {
		const eintraege = new Set<string>();
		for (const l of PFLICHTLEKTUERE) {
			for (const fach of FAECHER) {
				for (const e of pflichtFuer(l.rolle, { fach, reihe: true, verkauf: true })) {
					eintraege.add(e);
				}
			}
		}
		const fehlen = [...eintraege].filter((e) => {
			const datei = e.startsWith(SKILL_PRAEFIX) ? path.join(e.slice(SKILL_PRAEFIX.length), 'SKILL.md') : e;
			return !existsSync(path.join(WURZEL, 'skills', datei));
		});
		assert.deepEqual(fehlen, []);
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
