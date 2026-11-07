import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { FORMEN, formHtml, formVon, zeichneForm } from './formen';
import { ergaenzeFormen, legeForm, leseForm, setzeFormParameter, setzeKontur, wechsleForm } from './formen-aendern';
import { umrandung, zuegeAus } from './formen-geometrie';
import { pruefeFreiesHtml } from './frei';
import { setzeLage } from './gestaltung';
import { attribut, zerlege } from './quelltext';

const GROESSEN = [
	[120, 120],
	[240, 120],
	[40, 90],
] as const;

const SCHNAPPSCHUSS = JSON.parse(
	readFileSync(path.join(__dirname, 'formen.schnappschuss.json'), 'utf8'),
) as Record<string, string>;

const ARTEN = Object.keys(FORMEN);

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find((k) => k.tag === 'section' && /\bseite\b/.test(attribut(k, 'class')?.wert ?? ''));
	assert.ok(seite, 'Das Blatt hat eine Seite.');
	return seite.nr;
};

const formElement = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return quelle.slice(k.start, k.ende);
};

describe('Formen zeichnen', () => {
	for (const art of ARTEN) {
		for (const [b, h] of GROESSEN) {
			it(`${art} in ${b}×${h} zeichnet denselben Pfad wie im Schnappschuss`, () => {
				assert.equal(zeichneForm(art, {}, b, h, 3)?.d, SCHNAPPSCHUSS[`${art} ${b}x${h}`]);
			});
			it(`${art} in ${b}×${h}: der Strich liegt innen`, () => {
				const g = zeichneForm(art, {}, b, h, 3);
				assert.ok(g);
				assert.equal(g.viewBox, `0 0 ${b} ${h}`);
				const zuege = zuegeAus(g.d);
				assert.ok(zuege, 'Der Pfad besteht nur aus M, L, C, Q und Z.');
				const u = umrandung(zuege);
				const t = 0.01;
				assert.ok(u.x >= 1.5 - t && u.y >= 1.5 - t, `links oben ${u.x}, ${u.y}`);
				assert.ok(u.x + u.b <= b - 1.5 + t && u.y + u.h <= h - 1.5 + t, `rechts unten ${u.x + u.b}, ${u.y + u.h}`);
			});
		}
		it(`${art} mit Standardwerten besteht die Prüfung freier Elemente`, () => {
			const html = formHtml({ art, b: 120, h: 120 }).replace(
				'data-lage="frei"',
				'data-lage="frei" style="--x:10px;--y:10px;--b:120px;--h:120px"',
			);
			assert.deepEqual(pruefeFreiesHtml(`<div class="ebene vorne">${html}</div>`), []);
		});
	}
});

describe('Formen ändern', () => {
	it('legeForm legt eine Form mit Pfad in der Standardgröße ab', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'stern', lage: { x: 10, y: 20 } });
		assert.ok(nr !== null);
		const stand = leseForm(quelle, nr);
		assert.equal(stand?.art, 'stern');
		assert.match(formElement(quelle, nr), /viewBox="0 0 120 120"[^>]*><path d="M/);
	});

	it('wechsleForm bleibt in der Klasse, alte Parameter fallen weg', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'stern' });
		assert.ok(nr !== null);
		const mitZacken = setzeFormParameter(quelle, nr, { 'data-zacken': 8 });
		const herz = wechsleForm(mitZacken, nr, 'herz');
		assert.equal(leseForm(herz, nr)?.art, 'herz');
		assert.doesNotMatch(formElement(herz, nr), /data-zacken/);
		assert.throws(() => wechsleForm(herz, nr, 'gibt-es-nicht'));
		const fremd = ARTEN.find((a) => formVon(a)?.klasse !== formVon('stern')?.klasse);
		if (fremd) {
			assert.throws(() => wechsleForm(herz, nr, fremd));
		}
	});

	it('Zacken 5 → 8 ändert nur den Parameter und zeichnet neu', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'stern' });
		assert.ok(nr !== null);
		const acht = setzeFormParameter(quelle, nr, { 'data-zacken': 8 });
		assert.equal(leseForm(acht, nr)?.param['data-zacken'], 8);
		assert.ok(formElement(acht, nr).includes(`d="${zeichneForm('stern', { 'data-zacken': 8 }, 120, 120, 3)?.d}"`));
	});

	it('setzeLage mit neuer Breite schreibt viewBox und Pfad neu, die Strichstärke bleibt', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'rechteck', param: { 'data-radius': 20 } });
		assert.ok(nr !== null);
		const breit = setzeLage(quelle, nr, { b: 240 });
		const el = formElement(breit, nr);
		assert.match(el, /viewBox="0 0 240 120"/);
		assert.ok(el.includes(`d="${zeichneForm('rechteck', { 'data-radius': 20 }, 240, 120, 3)?.d}"`));
		assert.match(el, /stroke-width:3px/);
	});

	it('setzeKontur ohne Kontur entfernt Farbe und Stärke', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeForm(vorher, { seite: seiteIn(vorher), art: 'ellipse' });
		assert.ok(nr !== null);
		const ohne = setzeKontur(quelle, nr, null);
		assert.equal(leseForm(ohne, nr)?.kontur, null);
		assert.doesNotMatch(formElement(ohne, nr), /stroke-width/);
	});

	it('ergaenzeFormen erzeugt den fehlenden Pfad und lässt Blätter ohne Formen unverändert', () => {
		const ohneFormen = blattMit();
		assert.equal(ergaenzeFormen(ohneFormen), ohneFormen);
		const roh = blattMit({
			vorne: ['<svg class="form" data-lage="frei" data-form="vieleck" data-ecken="4" style="--x:10px;--y:10px"></svg>'],
		});
		const ergaenzt = ergaenzeFormen(roh);
		const form = ergaenzt.slice(ergaenzt.indexOf('<svg class="form"'));
		assert.match(form, /^<svg [^>]*viewBox="0 0 120 120"/);
		assert.match(form, /^<svg [^>]*--b:120px;--h:120px/);
		assert.match(form, /^<svg [^>]*><path d="M[^"]+" style="[^"]*fill:var\(--akzent\)/);
		assert.equal(ergaenzeFormen(ergaenzt), ergaenzt);
	});
});

describe('ergaenzeFormen bei Formen, die schon selbst zeichnen', () => {
	it('lässt eine Form mit eigenem <rect> ohne zusätzlichen Pfad', () => {
		const roh = blattMit({
			vorne: [
				'<svg class="form" data-lage="frei" data-form="rechteck" viewBox="0 0 200 120" style="--x:20px;--y:20px;--b:200px;--h:120px"><rect x="2" y="2" width="196" height="116"/></svg>',
			],
		});
		assert.equal(ergaenzeFormen(roh), roh);
	});
});
