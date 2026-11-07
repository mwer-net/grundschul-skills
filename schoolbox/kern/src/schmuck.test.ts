import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, SCHMUCK_ETIKETT } from '../../web/e2e/gestaltung-daten';
import { pruefeFreiesHtml } from './frei';
import { leseLage } from './gestaltung';
import { attribut, klassenVon, macheRueckgaengig, neuerVerlauf, nimmAuf, zerlege } from './quelltext';
import type { SchmuckArt } from './schmuck';
import {
	entferneLeereSchmuck,
	fasseMitAnlegenZusammen,
	GROESSE_MAX,
	GROESSE_MIN,
	legeSchmuck,
	leseSchmuck,
	SCHMUCK_ARTEN,
	schmuckHtml,
	setzeSchmuck,
	standardGroesse,
} from './schmuck';

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find((k) => k.tag === 'section' && klassenVon(k).includes('seite'));
	assert.ok(seite, 'Das Blatt hat eine Seite.');
	return seite.nr;
};

const elementIn = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return quelle.slice(k.start, k.ende);
};

const stil = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return attribut(k, 'style')?.wert ?? '';
};

const BLATT = blattMit();

const lege = (art: SchmuckArt, extra: Partial<Parameters<typeof legeSchmuck>[1]> = {}) => {
	const e = legeSchmuck(BLATT, { seite: seiteIn(BLATT), art, lage: { x: 100, y: 200 }, ...extra });
	assert.ok(e.nr !== null);
	return { quelle: e.quelle, nr: e.nr };
};

describe('Schmuckschrift anlegen', () => {
	for (const art of Object.keys(SCHMUCK_ARTEN) as SchmuckArt[]) {
		it(`${art}: frei in der Ebene vorne, mit Platzhalter und Standardgröße`, () => {
			const { nr, quelle } = lege(art);
			const html = elementIn(quelle, nr);
			assert.match(html, new RegExp(`^<div class="schmuck" data-lage="frei" data-schmuck="${art}"`));
			assert.ok(html.includes(`>${SCHMUCK_ARTEN[art].text}</div>`), html);
			assert.ok(stil(quelle, nr).includes(`--gr:${SCHMUCK_ARTEN[art].gr}px`), stil(quelle, nr));
			const k = zerlege(quelle).knoten[nr];
			assert.ok(k?.eltern && klassenVon(k.eltern).includes('vorne'));
			assert.deepEqual({ x: leseLage(quelle, nr).x, y: leseLage(quelle, nr).y }, { x: 100, y: 200 });
			assert.equal(leseLage(quelle, nr).b, undefined, 'ohne --b so breit wie der Text');
			assert.deepEqual(pruefeFreiesHtml(html), [], 'besteht die Allow-Liste');
		});
	}

	it('der Stempel steht leicht schräg', () => {
		const { nr, quelle } = lege('stempel');
		assert.equal(leseLage(quelle, nr).drehen, -8);
	});

	it('mit Breite bricht der Text um (--b)', () => {
		const { nr, quelle } = lege('titel', { lage: { x: 10, y: 10, b: 300 } });
		assert.equal(leseLage(quelle, nr).b, 300);
	});

	it('Text wird geschützt', () => {
		assert.ok(schmuckHtml({ art: 'titel', text: 'A <b> & C' }).includes('>A &lt;b&gt; &amp; C</div>'));
	});

	it('keine Standardgröße unter 0.8 × --fs (schrift-klein)', () => {
		assert.equal(standardGroesse('etikett', 24), 19);
		assert.equal(standardGroesse('etikett', 28), 22);
		assert.equal(standardGroesse('etikett', 18), 18);
		assert.equal(standardGroesse('stempel', 48), 38);
		assert.equal(standardGroesse('titel', 48), 56);
		assert.ok(schmuckHtml({ art: 'etikett', fs: 28 }).includes('--gr:22px'));
	});
});

describe('Schmuckschrift einstellen', () => {
	it('setzt jede Variable und nimmt sie wieder heraus', () => {
		const { nr, quelle } = lege('etikett');
		const gesetzt = setzeSchmuck(quelle, nr, {
			gr: 40,
			farbe: 'var(--akzent)',
			hg: '#ff0000',
			schrift: 'Andika',
			ausrichtung: 'mitte',
		});
		const s = stil(gesetzt, nr);
		for (const teil of ['--gr:40px', '--farbe:var(--akzent)', '--hg:#ff0000', '--schrift:Andika', '--ausrichtung:center']) {
			assert.ok(s.includes(teil), `${teil} in ${s}`);
		}
		assert.deepEqual(leseSchmuck(gesetzt, nr), {
			art: 'etikett',
			gr: 40,
			farbe: 'var(--akzent)',
			hg: '#ff0000',
			schrift: 'Andika',
			ausrichtung: 'mitte',
			breite: null,
		});
		const zurueck = setzeSchmuck(gesetzt, nr, { farbe: null, hg: null, schrift: 'Fredoka', ausrichtung: 'links' });
		assert.equal(stil(zurueck, nr), stil(gesetzt, nr).replace(/;--(farbe|hg|schrift|ausrichtung):[^;]*/g, ''));
		assert.equal(leseSchmuck(zurueck, nr)?.schrift, 'Fredoka');
	});

	it('Größe bleibt zwischen 12 und 160 px', () => {
		const { nr, quelle } = lege('titel');
		assert.equal(leseSchmuck(setzeSchmuck(quelle, nr, { gr: 400 }), nr)?.gr, GROESSE_MAX);
		assert.equal(leseSchmuck(setzeSchmuck(quelle, nr, { gr: 3 }), nr)?.gr, GROESSE_MIN);
	});

	it('nur Andika und Fredoka, nur Farben des Blatts', () => {
		const { nr, quelle } = lege('titel');
		assert.throws(() => setzeSchmuck(quelle, nr, { schrift: 'Comic Sans' as never }));
		assert.throws(() => setzeSchmuck(quelle, nr, { farbe: 'url(x)' }));
		assert.throws(() => setzeSchmuck(quelle, nr, { farbe: 'red;background:red' }));
	});

	it('liest Schmuckschrift aus den Beispielen (Claude)', () => {
		const quelle = blattMit({ vorne: [SCHMUCK_ETIKETT] });
		const k = zerlege(quelle).knoten.find((n) => attribut(n, 'data-schmuck')?.wert === 'etikett');
		assert.ok(k);
		assert.equal(leseSchmuck(quelle, k.nr)?.hg, 'var(--haupt)');
		assert.equal(leseSchmuck(quelle, k.nr)?.gr, 16);
	});
});

describe('leerer Text', () => {
	it('entfernt das Element und die leer gewordene Ebene', () => {
		const { nr, quelle } = lege('titel', { text: ' ' });
		assert.equal(entferneLeereSchmuck(quelle, nr).quelle, BLATT);
	});

	it('Text mit Inhalt bleibt', () => {
		const { nr, quelle } = lege('titel');
		assert.equal(entferneLeereSchmuck(quelle, nr).quelle, quelle);
	});

	it('Anlegen und Textsitzung sind ein Schritt; leer bleibt keiner', () => {
		const davor = nimmAuf(neuerVerlauf('<p>a</p>'), BLATT, 'vorher');
		const { nr, quelle } = lege('titel');
		const angelegt = nimmAuf(davor, quelle, 'Text');
		const getippt = quelle.replace('>Titel</div>', '>Die <span style="color:var(--akzent)">Formen</span></div>');
		const eins = fasseMitAnlegenZusammen(angelegt, getippt);
		assert.equal(eins.zurueck.length, 2);
		assert.equal(eins.zurueck.at(-1)?.beschreibung, 'Text');
		assert.equal(macheRueckgaengig(eins).quelle, BLATT);

		const leer = entferneLeereSchmuck(quelle.replace('>Titel</div>', '></div>'), nr).quelle;
		const keiner = fasseMitAnlegenZusammen(angelegt, leer);
		assert.equal(keiner.quelle, BLATT);
		assert.equal(keiner.zurueck.length, 1);
		assert.equal(keiner.zurueck.at(-1)?.beschreibung, 'vorher');
	});
});
