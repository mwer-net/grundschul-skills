import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from './quelltext';
import { verschobeneVerweise, verweisText } from './verweise';

const aufgabe = (nr: number | string, anw: string, items = 'a b c') =>
	`<div class="aufgabe"><span class="nr">${nr}</span><div class="anw"><span class="text">${anw}</span></div>` +
	`<div class="koerper">${items}</div></div>`;

const blatt = (tipp: string, ...aufgaben: string[]) =>
	`<html><body class="kl2"><section class="seite"><div class="kopf"><div class="tipp"><div class="blase">${tipp}` +
	`</div></div></div>${aufgaben.join('')}</section></body></html>`;

const pruefe = (vorher: string, nachher: string) => verschobeneVerweise(zerlege(vorher), zerlege(nachher));

const AUSGANG = blatt('Zu 1: Erst zählen.', aufgabe(1, 'Zähle.'), aufgabe(2, 'Rechne.'), aufgabe(3, 'Male.'));

describe('verschobeneVerweise', () => {
	it('meldet nichts, solange die Aufgabe ihre Nummer behält', () => {
		assert.deepEqual(pruefe(AUSGANG, AUSGANG), []);
		const getippt = blatt(
			'Zu 1: Erst zählen.',
			aufgabe(1, 'Zähle genau.'),
			aufgabe(2, 'Rechne.'),
			aufgabe(3, 'Male.'),
		);
		assert.deepEqual(pruefe(AUSGANG, getippt), [], 'in der Aufgabe getippt');
	});

	it('findet die gemeinte Aufgabe nach dem Umsortieren unter ihrer neuen Nummer', () => {
		const neu = blatt('Zu 1: Erst zählen.', aufgabe(1, 'Rechne.'), aufgabe(2, 'Male.'), aufgabe(3, 'Zähle.'));
		const verweise = pruefe(AUSGANG, neu);
		assert.equal(verweise.length, 1);
		assert.deepEqual({ ...verweise[0], blase: undefined }, { blase: undefined, alt: 1, neu: 3 });
		assert.equal(
			verweisText(verweise[0] ?? { blase: 0, alt: 0, neu: null }),
			'Der Tipp „Zu 1“ gehört jetzt zu Aufgabe 3.',
		);
		const blase = zerlege(neu).knoten[verweise[0]?.blase ?? -1];
		assert.ok(
			blase?.attribute.some((a) => a.wert === 'blase'),
			'Nummer der Sprechblase',
		);
	});

	it('erkennt die Aufgabe an der Anweisung, wenn auch die Items geändert wurden', () => {
		const neu = blatt(
			'Zu 1: Erst zählen.',
			aufgabe(1, 'Rechne.'),
			aufgabe(2, 'Zähle.', 'x y'),
			aufgabe(3, 'Male.'),
		);
		assert.deepEqual(
			pruefe(AUSGANG, neu).map(({ alt, neu: n }) => [alt, n]),
			[[1, 2]],
		);
	});

	it('meldet eine gelöschte Aufgabe, aber keinen Tipp, den die Lehrkraft selbst geändert hat', () => {
		const geloescht = blatt('Zu 1: Erst zählen.', aufgabe(1, 'Rechne.'), aufgabe(2, 'Male.'));
		assert.deepEqual(
			pruefe(AUSGANG, geloescht).map(({ alt, neu }) => [alt, neu]),
			[[1, null]],
		);
		assert.match(verweisText({ blase: 0, alt: 1, neu: null }), /nicht mehr gibt/);
		const korrigiert = blatt(
			'Zu 3: Erst zählen.',
			aufgabe(1, 'Rechne.'),
			aufgabe(2, 'Male.'),
			aufgabe(3, 'Zähle.'),
		);
		assert.deepEqual(pruefe(AUSGANG, korrigiert), []);
	});

	it('lässt Tipps ohne Bezug und Kopien der gemeinten Aufgabe in Ruhe', () => {
		const ohne = blatt('Erst zählen!', aufgabe(1, 'Rechne.'), aufgabe(2, 'Zähle.'));
		assert.deepEqual(pruefe(ohne, blatt('Erst zählen!', aufgabe(1, 'Zähle.'), aufgabe(2, 'Rechne.'))), []);
		const kopie = blatt('Zu 1: Erst zählen.', aufgabe(1, 'Zähle.'), aufgabe(2, 'Zähle.'), aufgabe(3, 'Rechne.'));
		assert.deepEqual(pruefe(AUSGANG, kopie), []);
	});
});
