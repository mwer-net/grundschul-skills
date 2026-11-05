import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EinordnungOrdner } from './einordnung';
import { einordnungSchema, pruefeEinordnung, rueckfallEinordnung } from './einordnung';
import { ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

const UHRZEIT: EinordnungOrdner = { id: 'o1', pfad: 'Klasse 2 > Uhrzeit', fach: 'mathematik', klasse: 2 };
const LEER: EinordnungOrdner = { id: 'o2', pfad: 'AI generiert' };
const gut = {
	titel: 'Wie spät ist es?',
	fach: 'sachunterricht',
	klasse: 3,
	art: 'arbeitsblatt',
	format: 'a4-hoch',
	ordnerId: null,
};

describe('Einordnung neuen Materials', () => {
	it('das Schema enthält die Listen vollständig', () => {
		const { properties } = einordnungSchema(['o1']);
		assert.deepEqual(properties.fach.enum, [...FAECHER]);
		assert.deepEqual(properties.klasse.enum, [...KLASSEN]);
		assert.deepEqual(properties.format.enum, [...FORMATE]);
		assert.deepEqual(properties.art.enum.slice(0, ARTEN.length), [...ARTEN]);
		assert.deepEqual(properties.ordnerId.enum, ['o1', null]);
	});

	it('nimmt gültige Werte und legt ohne Vorschlag in „Mein Material“ ab, nie in einen neuen Ordner', () => {
		const e = pruefeEinordnung({ ...gut, neueMappe: 'Tiere im Herbst' }, [UHRZEIT]);
		assert.equal(e?.fach, 'sachunterricht');
		assert.equal(e?.ordner, null);
		assert.equal(e?.fest, false);
		assert.equal(e?.rueckfall, false);
	});

	it('Ungültiges ergibt den Rückfall, auch eine Art ohne Katalog und ein Format, das nicht zur Art passt', () => {
		for (const falsch of [
			null,
			{},
			{ ...gut, fach: 'latein' },
			{ ...gut, klasse: 9 },
			{ ...gut, art: 'unbekannt' },
			{ ...gut, format: 'a2' },
			{ ...gut, format: 'folie' },
			{ ...gut, titel: ' ' },
			{ ...gut, titel: 'x'.repeat(81) },
			{ ...gut, ordnerId: 'gibt-es-nicht' },
		]) {
			assert.equal(pruefeEinordnung(falsch, [UHRZEIT]), null, JSON.stringify(falsch));
		}
	});

	it('ein vorgeschlagener Ordner mit Behälter gibt Fach und Klasse vor, einer ohne nicht', () => {
		const e = pruefeEinordnung({ ...gut, ordnerId: 'o1' }, [UHRZEIT, LEER]);
		assert.deepEqual(e?.ordner, { id: 'o1', pfad: 'Klasse 2 > Uhrzeit', vorhanden: true });
		assert.equal(e?.fach, 'mathematik');
		assert.equal(e?.klasse, 2);
		assert.equal(e?.fest, true);
		const ohne = pruefeEinordnung({ ...gut, ordnerId: 'o2' }, [UHRZEIT, LEER]);
		assert.equal(ohne?.fach, 'sachunterricht');
		assert.equal(ohne?.fest, false);
	});

	it('in einem Ordner bleibt das Dokument in diesem Ordner', () => {
		const e = pruefeEinordnung({ ...gut, ordnerId: 'o2' }, [UHRZEIT, LEER], UHRZEIT);
		assert.deepEqual(e?.ordner, { id: 'o1', pfad: 'Klasse 2 > Uhrzeit' });
		assert.equal(e?.fach, 'mathematik');
	});

	it('der Rückfall nimmt die ersten Wörter und den Ordner', () => {
		const e = rueckfallEinordnung('Arbeitsblatt Uhrzeiten volle und halbe Stunden Klasse 2', UHRZEIT);
		assert.equal(e.titel, 'Arbeitsblatt Uhrzeiten volle und halbe Stunden');
		assert.equal(e.fach, 'mathematik');
		assert.equal(e.rueckfall, true);
		assert.equal(e.fest, true);
		assert.equal(rueckfallEinordnung('Igel').ordner, null);
	});
});
