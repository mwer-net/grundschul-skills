import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inhaltText, inhaltVon, ordnerObjekt, seitenText, VORNE, vorneVon } from './objekte';
import type { AblageDok, AblageOrdner, AblageStand } from './typen';

const ordner = (id: string, name: string, eltern: string | null): AblageOrdner => ({
	id,
	name,
	eltern,
	behaelter: null,
	erstellt: '2026-11-01T08:00:00.000Z',
	geaendert: '2026-11-01T08:00:00.000Z',
});

const blatt = (id: string, titel: string, ort: string | null, erstellt: number): AblageDok => {
	const zeit = `2026-11-0${erstellt}T08:00:00.000Z`;
	return {
		id,
		mappe: 'mappe',
		fach: 'mathematik',
		klasse: 3,
		ordner: ort,
		vorschau: null,
		meta: {
			titel,
			art: 'arbeitsblatt',
			format: 'a4-hoch',
			druckprofil: 'sw',
			hatLoesung: false,
			druckhinweise: [],
			status: 'fertig',
			seiten: 1,
			pruefung: null,
			entwuerfe: [],
			erstellt: zeit,
			geaendert: zeit,
		},
	};
};

/** „Klasse“ mit „Deutsch“ (leer) und „Mathe“; in „Mathe“ „Uhrzeit“ mit vier Blättern und zwei Blätter; dazu „Leer“. */
const STAND: AblageStand = {
	rev: 1,
	ordner: [
		ordner('klasse', 'Klasse', null),
		ordner('deutsch', 'Deutsch', 'klasse'),
		ordner('mathe', 'Mathe', 'klasse'),
		ordner('uhrzeit', 'Uhrzeit', 'mathe'),
		ordner('leer', 'Leer', null),
	],
	dokumente: [
		blatt('blatt-b', 'Blatt b', 'mathe', 1),
		blatt('blatt-a', 'Blatt a', 'mathe', 2),
		blatt('volle', 'Volle Stunden', 'uhrzeit', 1),
		blatt('halbe', 'Halbe Stunden', 'uhrzeit', 2),
		blatt('viertel', 'Viertelstunden', 'uhrzeit', 3),
		blatt('minuten', 'Minuten', 'uhrzeit', 4),
		blatt('lose', 'Loses Blatt', null, 1),
	],
	defekt: [],
	geteilt: { ordner: [], dokumente: [] },
};

const namen = (id: string, feld: 'name' | 'erstellt', auf: boolean) =>
	vorneVon(STAND, id, { feld, auf }).map((o) => o.name);

describe('Ordner zeigen, was drin ist (164)', () => {
	it('inhaltVon zählt nur, was direkt darin liegt', () => {
		assert.deepEqual(inhaltVon(STAND, 'klasse'), { ordner: 2, materialien: 0 });
		assert.deepEqual(inhaltVon(STAND, 'mathe'), { ordner: 1, materialien: 2 });
		assert.deepEqual(inhaltVon(STAND, 'leer'), { ordner: 0, materialien: 0 });
		assert.deepEqual(inhaltVon(STAND, null), { ordner: 2, materialien: 1 });
		// Gegenprobe: Die vier Blätter in „Uhrzeit“ zählen für „Mathe“ nicht.
		assert.notEqual(inhaltVon(STAND, 'mathe').materialien, 6);
	});

	it('die Ordnerkachel trägt denselben Inhalt', () => {
		const mathe = STAND.ordner.find((o) => o.id === 'mathe');
		assert.ok(mathe);
		assert.deepEqual(ordnerObjekt(STAND, mathe).inhalt, inhaltVon(STAND, 'mathe'));
	});

	it('inhaltText: „Leer“, Ordner und Materialien getrennt, nie „Objekt“ oder „0 “', () => {
		const faelle: [number, number, string][] = [
			[0, 0, 'Leer'],
			[1, 0, '1 Ordner'],
			[3, 0, '3 Ordner'],
			[0, 1, '1 Material'],
			[0, 12, '12 Materialien'],
			[1, 2, '1 Ordner · 2 Materialien'],
		];
		for (const [o, m, text] of faelle) {
			const ergebnis = inhaltText({ ordner: o, materialien: m });
			assert.equal(ergebnis, text);
			assert.ok(!ergebnis.includes('Objekt'), ergebnis);
			assert.ok(!ergebnis.includes('0 '), ergebnis);
		}
	});

	it('seitenText: „1 Seite“, „3 Seiten“, ungezählt „–“', () => {
		assert.equal(seitenText(1), '1 Seite');
		assert.equal(seitenText(3), '3 Seiten');
		assert.equal(seitenText(0), '–');
	});

	it('vorneVon: bis zu drei in der Sortierung des Ordners, Ordner zuerst', () => {
		assert.deepEqual(namen('mathe', 'name', true), ['Uhrzeit', 'Blatt a', 'Blatt b']);
		assert.deepEqual(namen('mathe', 'name', false), ['Uhrzeit', 'Blatt b', 'Blatt a']);
		assert.deepEqual(namen('mathe', 'erstellt', true), ['Uhrzeit', 'Blatt b', 'Blatt a']);
		const uhrzeit = namen('uhrzeit', 'erstellt', true);
		assert.equal(uhrzeit.length, VORNE);
		assert.deepEqual(uhrzeit, ['Volle Stunden', 'Halbe Stunden', 'Viertelstunden']);
		assert.ok(!uhrzeit.includes('Minuten'));
		assert.deepEqual(vorneVon(STAND, 'leer', { feld: 'name', auf: true }), []);
	});
});
