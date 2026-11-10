import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { zeichneForm } from './formen';
import {
	ergaenzeFormen,
	legeForm,
	leseForm,
	linieHtml,
	setzeFormParameter,
	setzeKontur,
	setzeLinie,
} from './formen-aendern';
import { in45, linieAus, linienRand } from './formen-linie';
import { pruefeFreiesHtml } from './frei';
import { leseLage, setzeLage } from './gestaltung';
import { attribut, zerlege } from './quelltext';

const SCHNAPPSCHUSS = JSON.parse(
	readFileSync(path.join(__dirname, 'formen-text.schnappschuss.json'), 'utf8'),
) as Record<string, string>;

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find(
		(k) => k.tag === 'section' && /\bseite\b/.test(attribut(k, 'class')?.wert ?? ''),
	);
	assert.ok(seite, 'Das Blatt hat eine Seite.');
	return seite.nr;
};

const element = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return quelle.slice(k.start, k.ende);
};

const neueLinie = () => {
	const vorher = blattMit();
	const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'linie', lage: { x: 50, y: 50 } });
	assert.ok(nr !== null);
	return { nr, quelle };
};

describe('Linie zeichnen', () => {
	for (const [anfang, ende] of [
		[0, 0],
		[0, 1],
		[2, 1],
	] as const) {
		it(`Enden ${anfang}/${ende} zeichnen wie im Schnappschuss`, () => {
			const g = zeichneForm(
				'linie',
				{
					'data-anfang': anfang,
					'data-ende': ende,
					'linie-x1': 10,
					'linie-y1': 10,
					'linie-x2': 150,
					'linie-y2': 80,
				},
				160,
				90,
				3,
			);
			assert.equal(JSON.stringify(g), SCHNAPPSCHUSS[`linie ${anfang}-${ende}`]);
		});
	}

	it('der Rand reicht für Strich und Spitze; eine senkrechte Linie ist nie 0 px breit', () => {
		const { lage } = linieAus({ x: 100, y: 100 }, { x: 100, y: 300 }, 3);
		assert.equal(lage.b, 2 * linienRand(3));
		assert.ok(lage.b >= 3 + 9);
	});

	it('⇧ rastet in 45°-Schritten ein', () => {
		assert.deepEqual(in45({ x: 0, y: 0 }, { x: 100, y: 10 }), { x: 100, y: 0 });
		assert.deepEqual(in45({ x: 0, y: 0 }, { x: 100, y: 90 }), { x: 95, y: 95 });
	});

	it('Linie und Pfeil bestehen die Prüfung freier Elemente', () => {
		for (const html of [linieHtml(), linieHtml({ ende: 'pfeil', anfang: 'punkt' })]) {
			const mitLage = html.replace(
				'data-lage="frei"',
				'data-lage="frei" style="--x:10px;--y:10px;--b:180px;--h:20px"',
			);
			assert.deepEqual(pruefeFreiesHtml(`<div class="ebene vorne">${mitLage}</div>`), []);
		}
	});
});

describe('Linie ändern', () => {
	it('setzeLinie waagerecht, senkrecht und schräg: Rechteck, Punkte und Pfad', () => {
		const { nr, quelle } = neueLinie();
		const waagerecht = setzeLinie(quelle, nr, { x: 100, y: 100 }, { x: 300, y: 100 });
		const l = leseLage(waagerecht, nr);
		assert.deepEqual([l.x, l.y, l.b, l.h], [90, 90, 220, 20]);
		assert.match(element(waagerecht, nr), /data-punkte="10,10 210,10"/);
		assert.match(element(waagerecht, nr), /<path d="M10 10 L210 10"/);
		const senkrecht = setzeLinie(waagerecht, nr, { x: 100, y: 100 }, { x: 100, y: 300 });
		assert.match(element(senkrecht, nr), /data-punkte="10,10 10,210"/);
		assert.match(element(senkrecht, nr), /viewBox="0 0 20 220"/);
		const schraeg = setzeLinie(senkrecht, nr, { x: 300, y: 100 }, { x: 100, y: 200 });
		assert.match(element(schraeg, nr), /data-punkte="210,10 10,110"/);
		assert.doesNotMatch(element(schraeg, nr), /--drehen/);
	});

	it('Spitzen sind ein eigener Pfad in der Farbe der Kontur und folgen ihr', () => {
		const { nr, quelle } = neueLinie();
		const pfeil = setzeFormParameter(quelle, nr, { 'data-ende': 1 });
		assert.match(element(pfeil, nr), /data-ende="pfeil"/);
		assert.match(
			element(pfeil, nr),
			/<path class="spitzen" d="M[^"]+Z" style="fill:var\(--dunkel\);stroke:none"\/>/,
		);
		const bunt = setzeKontur(pfeil, nr, { farbe: 'var(--akzent)', staerke: 4 });
		assert.match(element(bunt, nr), /<path class="spitzen" d="[^"]+" style="fill:var\(--akzent\);stroke:none"\/>/);
		const ohne = setzeFormParameter(bunt, nr, { 'data-ende': 0 });
		assert.doesNotMatch(element(ohne, nr), /spitzen/);
		assert.equal(leseForm(ohne, nr)?.fuellung, null);
	});

	it('größer gezogen wandern die Punkte mit, der Rand bleibt', () => {
		const { nr, quelle } = neueLinie();
		const breit = setzeLage(quelle, nr, { b: 340 });
		assert.match(element(breit, nr), /data-punkte="10,10 330,10"/);
	});

	it('ergaenzeFormen erzeugt Pfad und Spitzen aus data-punkte', () => {
		const roh =
			'<svg class="form" data-lage="frei" data-form="linie" data-punkte="10,10 100,50" data-ende="pfeil" style="--x:10px;--y:10px;--b:110px;--h:60px"></svg>';
		const ergaenzt = ergaenzeFormen(blattMit({ vorne: [roh] }));
		assert.match(
			ergaenzt,
			/viewBox="0 0 110 60"><path d="M10 10 L[^"]+" style="fill:none;[^"]*stroke-linecap:round"\/><path class="spitzen"/,
		);
	});
});
