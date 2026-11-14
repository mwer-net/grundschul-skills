import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from './quelltext';
import { loesungDaneben, schreibeUhrzeitUm, zeitDerUhr } from './uhrzeit-text';

const blatt = (innen: string) =>
	`<!doctype html><html><head><title>t</title></head><body><section class="seite">${innen}</section></body></html>`;
const uhrNr = (q: string, i = 0) => zerlege(q).knoten.filter((k) => k.tag === 'x-uhr')[i]?.nr ?? -1;

describe('197-01: Die Zeit neben der Uhr folgt der Uhr', () => {
	it('schreibt „3 Uhr“, „halb 4“ und „3:30 Uhr“ im Text und in der Lösung um', () => {
		const q = blatt(
			'<div class="aufgabe"><x-uhr zeit="3:30"></x-uhr><p>Es ist 3:30 Uhr, also halb 4.</p><span class="antwort" data-l="15.30 Uhr"></span></div>',
		);
		const neu = schreibeUhrzeitUm(q, uhrNr(q), '3:30', '7:30');
		assert.match(neu, /Es ist 7:30 Uhr, also halb 8\./);
		assert.match(neu, /data-l="19\.30 Uhr"/);
		const voll = blatt('<div class="aufgabe"><x-uhr zeit="3:00"></x-uhr><p>3 Uhr</p></div>');
		assert.match(schreibeUhrzeitUm(voll, uhrNr(voll), '3:00', '5:00'), /<p>5 Uhr<\/p>/);
	});

	it('bleibt im eigenen Eintrag der Reihe', () => {
		const q = blatt(
			'<div class="aufgabe"><div class="reihe"><div class="zelle"><x-uhr zeit="3:00"></x-uhr><p>3 Uhr</p></div><div class="zelle"><x-uhr zeit="3:00"></x-uhr><p>3 Uhr</p></div></div></div>',
		);
		const neu = schreibeUhrzeitUm(q, uhrNr(q, 1), '3:00', '9:00');
		assert.match(neu, /<p>3 Uhr<\/p><\/div><div class="zelle"><x-uhr zeit="3:00"><\/x-uhr><p>9 Uhr<\/p>/);
	});

	it('meldet eine Lösung daneben, die nicht mitgehen kann', () => {
		const fremd = blatt('<div class="aufgabe"><x-uhr zeit="3:00"></x-uhr><span class="antwort" data-l="Mittag"></span></div>');
		assert.notEqual(loesungDaneben(fremd, uhrNr(fremd), 'x-uhr', '3:00'), null);
		const passt = blatt('<div class="aufgabe"><x-uhr zeit="3:00"></x-uhr><span class="antwort" data-l="3 Uhr"></span></div>');
		assert.equal(loesungDaneben(passt, uhrNr(passt), 'x-uhr', '3:00'), null);
		assert.equal(zeitDerUhr({ zeit: null, loesung: '4:15' }), '4:15');
	});
});
