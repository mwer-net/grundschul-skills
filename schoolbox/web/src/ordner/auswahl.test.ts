import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { alles, bereinige, bewege, findeNachName, KEINE, klicke } from './auswahl';

const R = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const OHNE = { befehl: false, umschalt: false };

describe('Auswahl', () => {
	it('Klick wählt nur dieses und setzt den Anker', () => {
		const s = klicke({ gewaehlt: ['a', 'b'], anker: 'a' }, 'c', OHNE, R);
		assert.deepEqual(s, { gewaehlt: ['c'], anker: 'c' });
	});

	it('⌘ fügt hinzu und nimmt heraus, in Anzeigereihenfolge', () => {
		let s = klicke(KEINE, 'c', { ...OHNE, befehl: true }, R);
		s = klicke(s, 'a', { ...OHNE, befehl: true }, R);
		assert.deepEqual(s.gewaehlt, ['a', 'c']);
		s = klicke(s, 'c', { ...OHNE, befehl: true }, R);
		assert.deepEqual(s.gewaehlt, ['a']);
	});

	it('⇧ wählt den Bereich vom Anker, in beide Richtungen; der Anker bleibt', () => {
		const a = klicke(KEINE, 'c', OHNE, R);
		const b = klicke(a, 'e', { ...OHNE, umschalt: true }, R);
		assert.deepEqual(b, { gewaehlt: ['c', 'd', 'e'], anker: 'c' });
		assert.deepEqual(klicke(b, 'a', { ...OHNE, umschalt: true }, R).gewaehlt, ['a', 'b', 'c']);
	});

	it('der Bereich läuft über aufgeklappte Zeilen: Es zählt die angezeigte Reihenfolge', () => {
		const aufgeklappt = ['a', 'a/1', 'a/2', 'b'];
		const s = klicke(klicke(KEINE, 'a', OHNE, aufgeklappt), 'b', { ...OHNE, umschalt: true }, aufgeklappt);
		assert.deepEqual(s.gewaehlt, aufgeklappt);
	});

	it('im Raster bewegen die Pfeile zweidimensional, ⇧ erweitert', () => {
		const opt = { reihenfolge: R, spalten: 3, erweitern: false };
		assert.equal(bewege(KEINE, 'b', 'runter', opt).zeiger, 'e');
		assert.equal(bewege(KEINE, 'e', 'hoch', opt).zeiger, 'b');
		assert.equal(bewege(KEINE, 'b', 'rechts', opt).zeiger, 'c');
		assert.equal(bewege(KEINE, 'a', 'hoch', opt).zeiger, 'a', 'am Rand bleibt sie stehen');
		assert.equal(bewege(KEINE, 'e', 'runter', opt).zeiger, 'g', 'die kurze letzte Zeile bleibt erreichbar');
		const weit = bewege({ gewaehlt: ['b'], anker: 'b' }, 'b', 'runter', { ...opt, erweitern: true });
		assert.deepEqual(weit.stand.gewaehlt, ['b', 'c', 'd', 'e']);
	});

	it('ohne Auswahl beginnen die Pfeile am Anfang oder Ende', () => {
		const opt = { reihenfolge: R, spalten: 1, erweitern: false };
		assert.equal(bewege(KEINE, null, 'runter', opt).zeiger, 'a');
		assert.equal(bewege(KEINE, null, 'hoch', opt).zeiger, 'g');
	});

	it('alles, und was nicht mehr da ist, fällt heraus', () => {
		assert.deepEqual(alles(['a', 'b']).gewaehlt, ['a', 'b']);
		assert.deepEqual(bereinige({ gewaehlt: ['a', 'x'], anker: 'x' }, ['a', 'b']), { gewaehlt: ['a'], anker: 'a' });
		const gleich = { gewaehlt: ['a'], anker: 'a' };
		assert.equal(bereinige(gleich, ['a']), gleich);
	});

	it('Tippen findet den Namensanfang', () => {
		const objekte = [
			{ schluessel: '1', name: 'Übung' },
			{ schluessel: '2', name: 'Uhrzeit' },
		];
		const falte = (t: string) => t.toLowerCase().replace(/ü/g, 'ue');
		assert.equal(findeNachName('uh', objekte, falte), '2');
		assert.equal(findeNachName('ueb', objekte, falte), '1');
		assert.equal(findeNachName('x', objekte, falte), null);
	});
});
