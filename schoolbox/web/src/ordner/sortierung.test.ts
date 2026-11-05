import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sortiereObjekte, standardSortierung } from '@schoolbox/kern/src/ordner-sortierung';

import { leseSortierung, naechsteSortierung, schreibeSortierung } from './sortierung';

const o = (name: string, erstellt: string, istOrdner = false) => ({
	name,
	erstellt,
	geaendert: erstellt,
	art: 'x',
	istOrdner,
});

const speicher = () => {
	const daten = new Map<string, string>();
	return {
		getItem: (k: string) => daten.get(k) ?? null,
		setItem: (k: string, v: string) => void daten.set(k, v),
	};
};

describe('Sortierung', () => {
	it('natürlich: „Station 10“ steht nach „Station 2“', () => {
		const namen = sortiereObjekte([o('Station 10', '1'), o('Station 2', '2'), o('Station 1', '3')], {
			feld: 'name',
			auf: true,
		}).map((x) => x.name);
		assert.deepEqual(namen, ['Station 1', 'Station 2', 'Station 10']);
	});

	it('Ordner stehen immer zuerst, auch umgedreht', () => {
		const liste = [o('A', '1'), o('Z', '2', true), o('B', '3')];
		for (const auf of [true, false]) {
			assert.equal(sortiereObjekte(liste, { feld: 'name', auf })[0]?.name, 'Z');
		}
	});

	it('Standard nach Herkunft: aus einer Mappe nach Erstellt, sonst nach Name', () => {
		assert.deepEqual(standardSortierung({ behaelter: 'm' }), { feld: 'erstellt', auf: true });
		assert.deepEqual(standardSortierung({ behaelter: null }), { feld: 'name', auf: true });
		assert.deepEqual(standardSortierung(null), { feld: 'name', auf: true });
	});

	it('je Ordner gespeichert; Kaputtes im Speicher ist der Standard', () => {
		const s = speicher();
		const ordner = { id: 'o-1', behaelter: 'm', name: 'x', eltern: null, erstellt: '', geaendert: '' };
		assert.deepEqual(leseSortierung(ordner, s), { feld: 'erstellt', auf: true });
		schreibeSortierung('o-1', { feld: 'name', auf: false }, s);
		assert.deepEqual(leseSortierung(ordner, s), { feld: 'name', auf: false });
		assert.deepEqual(leseSortierung({ ...ordner, id: 'o-2' }, s), { feld: 'erstellt', auf: true });
		s.setItem('schoolbox.ordner-sortierung:o-1', '{kaputt');
		assert.deepEqual(leseSortierung(ordner, s), { feld: 'erstellt', auf: true });
	});

	it('zweiter Klick dreht die Richtung; Geändert beginnt mit dem Neuesten', () => {
		assert.deepEqual(naechsteSortierung({ feld: 'name', auf: true }, 'name'), { feld: 'name', auf: false });
		assert.deepEqual(naechsteSortierung({ feld: 'name', auf: true }, 'geaendert'), {
			feld: 'geaendert',
			auf: false,
		});
	});
});
