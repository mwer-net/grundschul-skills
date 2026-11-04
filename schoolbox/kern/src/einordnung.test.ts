import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EinordnungMappe } from './einordnung';
import { einordnungSchema, pruefeEinordnung, rueckfallEinordnung } from './einordnung';
import { ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

const UHRZEIT: EinordnungMappe = { id: 'm1', titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 };
const gut = {
	titel: 'Wie spät ist es?',
	fach: 'sachunterricht',
	klasse: 3,
	art: 'arbeitsblatt',
	format: 'a4-hoch',
	mappeId: null,
	neueMappe: 'Tiere im Herbst',
};

describe('Einordnung neuen Materials', () => {
	it('das Schema enthält die Listen vollständig', () => {
		const { properties } = einordnungSchema(['m1']);
		assert.deepEqual(properties.fach.enum, [...FAECHER]);
		assert.deepEqual(properties.klasse.enum, [...KLASSEN]);
		assert.deepEqual(properties.format.enum, [...FORMATE]);
		assert.deepEqual(properties.art.enum.slice(0, ARTEN.length), [...ARTEN]);
		assert.deepEqual(properties.mappeId.enum, ['m1', null]);
	});

	it('nimmt gültige Werte und schlägt eine neue Mappe vor', () => {
		const e = pruefeEinordnung(gut, [UHRZEIT]);
		assert.equal(e?.fach, 'sachunterricht');
		assert.deepEqual(e?.mappe, { neu: 'Tiere im Herbst' });
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
			{ ...gut, neueMappe: null },
			{ ...gut, mappeId: 'gibt-es-nicht' },
		]) {
			assert.equal(pruefeEinordnung(falsch, [UHRZEIT]), null, JSON.stringify(falsch));
		}
	});

	it('eine neue Mappe mit vorhandenem Titel wird die vorhandene, mit deren Fach und Klasse', () => {
		const e = pruefeEinordnung({ ...gut, neueMappe: ' uhrzeit ' }, [UHRZEIT]);
		assert.deepEqual(e?.mappe, { id: 'm1', titel: 'Uhrzeit', vorhanden: true });
		assert.equal(e?.fach, 'mathematik');
		assert.equal(e?.klasse, 2);
	});

	it('in einer Mappe bleibt das Dokument in dieser Mappe', () => {
		const e = pruefeEinordnung(gut, [UHRZEIT], UHRZEIT);
		assert.deepEqual(e?.mappe, { id: 'm1', titel: 'Uhrzeit' });
		assert.equal(e?.fach, 'mathematik');
	});

	it('der Rückfall nimmt die ersten Wörter und die Mappe', () => {
		const e = rueckfallEinordnung('Arbeitsblatt Uhrzeiten volle und halbe Stunden Klasse 2', UHRZEIT);
		assert.equal(e.titel, 'Arbeitsblatt Uhrzeiten volle und halbe Stunden');
		assert.equal(e.fach, 'mathematik');
		assert.equal(e.rueckfall, true);
		assert.deepEqual(rueckfallEinordnung('Igel').mappe, { neu: 'Igel' });
	});
});
