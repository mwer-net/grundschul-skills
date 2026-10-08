import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SchoolboxFehler } from './fehler';
import { MAPPE_SCHEMA, META_SCHEMA, pruefeSchema } from './schema';
import { ARTEN, FAECHER, FORMATE, waehleKlasse, waehleWert } from './werte';

describe('waehleWert', () => {
	it('akzeptiert gültige Werte unabhängig von Groß-/Kleinschreibung', () => {
		assert.equal(waehleWert('Fach', ' Sachunterricht ', FAECHER), 'sachunterricht');
		assert.equal(waehleKlasse('3'), 3);
		assert.equal(waehleKlasse('gemischt'), 'gemischt');
	});

	it('lehnt ungültige Werte mit der Liste gültiger Werte ab', () => {
		for (const [feld, wert, liste] of [
			['Fach', 'mathe', FAECHER],
			['Art', 'quiz', ARTEN],
			['Format', 'a4', FORMATE],
		] as const) {
			assert.throws(
				() => waehleWert(feld, wert, liste),
				(fehler: unknown) =>
					fehler instanceof SchoolboxFehler &&
					fehler.message.includes(`„${wert}“ ist ungültig`) &&
					liste.every((g) => fehler.message.includes(g)),
			);
		}
		assert.throws(() => waehleKlasse('5'), /Gültige Werte: 1, 2, 3, 4, gemischt/);
		assert.throws(() => waehleWert('Fach', undefined, FAECHER), /Fach fehlt/);
	});
});

describe('pruefeSchema', () => {
	const mappe = {
		id: '2026-10-08-kartoffeln-su-kl3',
		titel: 'Kartoffeln',
		fach: 'sachunterricht',
		klasse: 3,
		erstellt: '2026-10-08T10:15:03.000Z',
		geaendert: '2026-10-08T10:15:03.000Z',
		status: 'entwurf',
		dokumente: ['folien-kreisinput'],
	};

	it('akzeptiert eine gültige Mappe', () => {
		assert.deepEqual(pruefeSchema(MAPPE_SCHEMA, mappe), []);
	});

	it('meldet falsche Werte, Typen und fehlende Felder mit Pfad', () => {
		const kaputt: Record<string, unknown> = { ...mappe, fach: 'mathe', klasse: '3', dokumente: ['Gross'] };
		delete kaputt.status;
		const fehler = pruefeSchema(MAPPE_SCHEMA, kaputt);
		assert.equal(fehler.length, 4);
		assert.ok(fehler.some((f) => f.startsWith('(Wurzel): „status“ fehlt')));
		assert.ok(fehler.some((f) => f.startsWith('fach:')));
		assert.ok(fehler.some((f) => f.startsWith('klasse:')));
		assert.ok(fehler.some((f) => f.startsWith('dokumente[0]:')));
	});

	it('erlaubt pruefung = null und prüft Entwürfe', () => {
		const meta = {
			titel: 'Kreisinput',
			art: 'praesentation',
			format: 'folie',
			druckprofil: 'farbe',
			hatLoesung: false,
			druckhinweise: [],
			status: 'entwurf',
			seiten: 0,
			pruefung: null,
			entwuerfe: [{ name: 'a', titel: 'x', idee: '' }],
			erstellt: mappe.erstellt,
			geaendert: mappe.erstellt,
		};
		assert.deepEqual(pruefeSchema(META_SCHEMA, meta), ['entwuerfe[0].name: „a“ passt nicht zu ^[A-Z]$']);
	});
});
