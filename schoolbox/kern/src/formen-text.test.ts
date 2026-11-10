import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { formHtml, zeichneForm } from './formen';
import { ergaenzeFormen, formMitTextHtml, legeFormMitText, leseForm, setzeZipfel, wechsleForm } from './formen-aendern';
import { zuegeAus } from './formen-geometrie';
import { BLASEN } from './formen-text';
import { pruefeFreiesHtml } from './frei';
import { setzeLage } from './gestaltung';
import { attribut, zerlege } from './quelltext';
import { leseSchmuck } from './schmuck';

const SCHNAPPSCHUSS = JSON.parse(
	readFileSync(path.join(__dirname, 'formen-text.schnappschuss.json'), 'utf8'),
) as Record<string, string>;

const GROESSEN = [
	[180, 84],
	[240, 120],
	[90, 60],
] as const;

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

const dVon = (html: string) => /<svg[^>]*>\s*<path d="([^"]*)"/.exec(html)?.[1] ?? null;

describe('Formen mit Text zeichnen', () => {
	for (const [b, h] of GROESSEN) {
		BLASEN.forEach((blase, i) => {
			it(`Sprechblase ${blase.wert} in ${b}×${h} zeichnet denselben Pfad wie im Schnappschuss`, () => {
				const g = zeichneForm('sprechblase', { 'data-blase': i }, b, h, 3);
				assert.ok(g);
				assert.equal(g.viewBox, `0 0 ${b} ${h}`);
				assert.equal(g.d, SCHNAPPSCHUSS[`sprechblase ${i} ${b}x${h}`]);
				assert.ok(zuegeAus(g.d), 'Der Pfad besteht nur aus M, L, C, Q und Z.');
			});
		});
		it(`Band in ${b}×${h} zeichnet denselben Pfad wie im Schnappschuss`, () => {
			assert.equal(zeichneForm('band', {}, b, h, 3)?.d, SCHNAPPSCHUSS[`band ${b}x${h}`]);
		});
	}

	it('ein Zipfel außerhalb führt zur Spitze, einer in der Box entfällt', () => {
		const aussen = zeichneForm('sprechblase', { 'zipfel-x': -26, 'zipfel-y': 70 }, 180, 84, 3);
		assert.ok(aussen?.d.includes('L-26 70'));
		const innen = zeichneForm('sprechblase', { 'zipfel-x': 90, 'zipfel-y': 40 }, 180, 84, 3);
		assert.ok(innen);
		assert.doesNotMatch(innen.d, /L/, 'Ohne Zipfel ist die runde Blase nur eine Ellipse aus Kurven.');
		const eckig = zeichneForm('sprechblase', { 'data-blase': 1, 'zipfel-x': 90, 'zipfel-y': 200 }, 180, 84, 3);
		assert.ok(eckig?.d.includes('L90 200'));
	});

	it('die Denkblase hat statt des Zipfels zwei bis drei Kreise', () => {
		const g = zeichneForm('sprechblase', { 'data-blase': 2, 'zipfel-x': 20, 'zipfel-y': 200 }, 180, 84, 3);
		const zuege = zuegeAus(g?.d ?? '');
		assert.ok(zuege);
		assert.ok(zuege.length >= 3 && zuege.length <= 4, `${zuege.length} Teilpfade`);
	});

	it('jede neue Form besteht die Prüfung freier Elemente', () => {
		for (const html of [
			formMitTextHtml({ art: 'sprechblase' }),
			formMitTextHtml({ art: 'sprechblase', blase: 'gedanke' }),
			formMitTextHtml({ art: 'band' }),
			formHtml({ art: 'band', b: 180, h: 84 }),
		]) {
			const mitLage = html.replace(
				'data-lage="frei"',
				'data-lage="frei" style="--x:10px;--y:10px;--b:180px;--h:84px"',
			);
			assert.deepEqual(pruefeFreiesHtml(`<div class="ebene vorne">${mitLage}</div>`), []);
		}
	});
});

describe('Formen mit Text ändern', () => {
	it('legeFormMitText legt eine Sprechblase mit Text, Zipfel und Schrift der Klasse ab', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeFormMitText(vorher, {
			seite: seiteIn(vorher),
			art: 'sprechblase',
			fs: 26,
			lage: { x: 40, y: 50 },
		});
		assert.ok(nr !== null);
		const html = element(quelle, nr);
		assert.match(
			html,
			/^<div class="form-text" data-lage="frei" data-form="sprechblase" data-blase="rund" data-zipfel="40,118"/,
		);
		assert.match(html, /--gr:26px/);
		assert.match(html, /<div class="form-inhalt">Text<\/div>/);
		assert.equal(leseForm(quelle, nr)?.fuellung, '#ffffff');
		assert.equal(leseSchmuck(quelle, nr)?.ausrichtung, 'mitte');
	});

	it('die Schrift ist mindestens 22 px', () => {
		assert.match(formMitTextHtml({ art: 'band', fs: 16 }), /--gr:22px/);
	});

	it('setzeZipfel zeichnet neu; wechseln zum Band behält Text, Füllung und Lage', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeFormMitText(vorher, {
			seite: seiteIn(vorher),
			art: 'sprechblase',
			text: 'Zähl genau!',
		});
		assert.ok(nr !== null);
		const gezogen = setzeZipfel(quelle, nr, { x: -30, y: 60 });
		assert.match(element(gezogen, nr), /data-zipfel="-30,60"/);
		assert.ok(dVon(element(gezogen, nr))?.includes('L-30 60'));
		const band = wechsleForm(gezogen, nr, 'band');
		const html = element(band, nr);
		assert.match(html, /data-form="band"/);
		assert.match(html, /data-kerbe="0.15"/);
		assert.doesNotMatch(html, /data-blase/);
		assert.match(html, /Zähl genau!/);
		assert.equal(leseForm(band, nr)?.fuellung, '#ffffff');
		assert.throws(() => wechsleForm(band, nr, 'stern'));
	});

	it('größer gezogen behält der Zipfel seine Länge und das svg die Größe der Box', () => {
		const vorher = blattMit();
		const { nr, quelle } = legeFormMitText(vorher, { seite: seiteIn(vorher), art: 'sprechblase' });
		assert.ok(nr !== null);
		const gross = setzeLage(quelle, nr, { b: 260, h: 120 });
		const html = element(gross, nr);
		assert.match(html, /data-zipfel="58,154"/);
		assert.match(html, /<svg viewBox="0 0 260 120"/);
	});

	it('ergaenzeFormen erzeugt das fehlende svg in .form-text, ein vorhandenes d bleibt', () => {
		const ohne =
			'<div class="form-text" data-lage="frei" data-form="sprechblase" data-zipfel="-20,60" style="--x:10px;--y:10px;--b:180px;--h:84px"><div class="form-inhalt">Hallo</div></div>';
		const quelle = blattMit({ vorne: [ohne] });
		const ergaenzt = ergaenzeFormen(quelle);
		assert.match(
			ergaenzt,
			/<div class="form-text"[^>]*><svg viewBox="0 0 180 84" aria-hidden="true"><path d="M[^"]+L-20 60 Z" style="fill:#ffffff;/,
		);
		assert.match(ergaenzt, /<div class="form-inhalt">Hallo<\/div>/);
		assert.equal(ergaenzeFormen(ergaenzt), ergaenzt);
	});
});
