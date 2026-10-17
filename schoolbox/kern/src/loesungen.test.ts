import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS } from './konfig';
import {
	andereBeispiele,
	fehlendeLoesungen,
	hatLoesung,
	kannBeispielSein,
	kannLoesungHaben,
	setzeBeispiel,
	setzeLoesung,
} from './loesungen';
import type { Knoten } from './quelltext';
import { attribut, klassenVon, zerlege } from './quelltext';

const vorlage = () => readFile(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');

const mitKlasse = (quelle: string, klasse: string) =>
	zerlege(quelle).knoten.filter((k) => klassenVon(k).includes(klasse));

const nrVon = (k: Knoten | undefined) => k?.nr ?? -1;

/** Zeilen der neuen Fassung, die sich geändert haben. */
const geaendert = (alt: string, neu: string) => {
	const vorher = alt.split('\n');
	return neu.split('\n').filter((zeile, i) => zeile !== vorher[i]);
};

describe('Lösungen', () => {
	it('erkennt Lösungen wie blatt.py', () => {
		assert.equal(hatLoesung('<span class="antwort" data-l="3"></span>'), true);
		assert.equal(hatLoesung('<x-uhr loesung="3:00"></x-uhr>'), true);
		assert.equal(hatLoesung('<x-menge n="23" buendel-loesung="2"></x-menge>'), true);
		assert.equal(hatLoesung('<div class="nur-loesung">Ja</div>'), true);
		assert.equal(hatLoesung('<span class="antwort"></span>'), false);
		assert.equal(kannLoesungHaben(zerlege('<span class="antwort"></span>')), true);
		assert.equal(kannLoesungHaben(zerlege('<p>Male.</p>')), false);
	});

	it('setzt die Lösung einer Antwortlinie und ändert nur dieses Attribut', async () => {
		const alt = await vorlage();
		const [, zweite] = mitKlasse(alt, 'antwort');
		const neu = setzeLoesung(alt, nrVon(zweite), '  halb fünf & „ß“ ');
		assert.deepEqual(geaendert(alt, neu), [
			'        <div class="zelle"><x-uhr zeit="4:30"></x-uhr><span class="antwort breit" data-l="halb fünf &amp; „ß“"></span></div>',
		]);
		assert.equal(attribut(zerlege(neu).knoten[nrVon(zweite)] as Knoten, 'data-l')?.wert, 'halb fünf & „ß“');
	});

	it('entfernt data-l bei leerer Eingabe und meldet die Linie als fehlend', async () => {
		const alt = await vorlage();
		assert.equal(fehlendeLoesungen(zerlege(alt)).length, 0);
		const [erste] = mitKlasse(alt, 'antwort');
		const neu = setzeLoesung(alt, nrVon(erste), '   ');
		assert.deepEqual(geaendert(alt, neu), [
			'        <div class="zelle beispiel"><x-uhr zeit="3:00"></x-uhr><span class="antwort breit"></span></div>',
		]);
		assert.deepEqual(
			fehlendeLoesungen(zerlege(neu)).map((k) => k.nr),
			[nrVon(erste)],
		);
		assert.equal(setzeLoesung(neu, nrVon(erste), ''), neu);
		assert.equal(fehlendeLoesungen(zerlege('<span class="antwort" data-l=" "></span>')).length, 1);
	});

	it('lehnt Elemente ab, die keine Antwortlinie sind', async () => {
		const alt = await vorlage();
		const h1 = zerlege(alt).knoten.find((k) => k.tag === 'h1');
		assert.throws(() => setzeLoesung(alt, nrVon(h1), 'x'), /keine Antwortlinie/);
	});
});

describe('Beispiel', () => {
	it('macht ein Item zum Beispiel und löst das bisherige derselben Aufgabe ab, in einem Schritt', async () => {
		const alt = await vorlage();
		const [erstes, zweites] = mitKlasse(alt, 'zelle');
		assert.deepEqual(
			andereBeispiele(zerlege(alt), nrVon(zweites)).map((k) => k.nr),
			[nrVon(erstes)],
		);
		const { abgeloest, quelle: neu } = setzeBeispiel(alt, nrVon(zweites), true);
		assert.deepEqual(abgeloest, [nrVon(erstes)]);
		assert.deepEqual(geaendert(alt, neu), [
			'        <div class="zelle"><x-uhr zeit="3:00"></x-uhr><span class="antwort breit" data-l="3 Uhr"></span></div>',
			'        <div class="zelle beispiel"><x-uhr zeit="4:30"></x-uhr><span class="antwort breit" data-l="halb 5"></span></div>',
		]);
		assert.equal(setzeBeispiel(neu, nrVon(zweites), true).quelle, neu);
		assert.equal(setzeBeispiel(setzeBeispiel(neu, nrVon(zweites), false).quelle, nrVon(erstes), true).quelle, alt);
	});

	it('lässt Beispiele anderer Aufgaben stehen', async () => {
		const alt = await vorlage();
		const zellen = mitKlasse(alt, 'zelle');
		const ausAufgabe2 = zellen[4];
		const { abgeloest, quelle: neu } = setzeBeispiel(alt, nrVon(ausAufgabe2), true);
		assert.deepEqual(abgeloest, []);
		assert.equal(mitKlasse(neu, 'beispiel').length, 2);
		assert.equal(setzeBeispiel(neu, nrVon(ausAufgabe2), false).quelle, alt);
	});

	it('entfernt das class-Attribut nicht, solange andere Klassen bleiben, und nur Items mit Lösung taugen', () => {
		const html =
			'<div class="reihe"><div class="zelle beispiel"><b>9</b></div><div class="zelle"><b>8</b></div></div>';
		const [erstes, zweites] = mitKlasse(html, 'zelle');
		assert.equal(
			setzeBeispiel(html, nrVon(erstes), false).quelle,
			'<div class="reihe"><div class="zelle"><b>9</b></div><div class="zelle"><b>8</b></div></div>',
		);
		assert.equal(kannBeispielSein(zerlege(html), nrVon(zweites)), false);
		for (const innen of [
			'<span class="antwort" data-l="9"></span>',
			'<x-uhr loesung="9:00"></x-uhr>',
			'<x-menge n="23" buendel-loesung="2"></x-menge>',
			'<x-zahlenstrahl pfeile="4"></x-zahlenstrahl>',
			'<table class="stellentafel"><tr><td class="l">3</td></tr></table>',
		]) {
			const z = zerlege(`<div class="reihe"><div class="zelle">${innen}</div></div>`);
			assert.equal(kannBeispielSein(z, nrVon(mitKlasse(z.quelle, 'zelle')[0])), true, innen);
		}
		assert.equal(
			kannBeispielSein(
				zerlege('<div class="reihe"><div class="zelle"><span class="antwort"></span></div></div>'),
				1,
			),
			false,
		);
	});
});
