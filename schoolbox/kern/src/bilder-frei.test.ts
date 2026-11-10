import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BILD_FREI, blattMit } from '../../web/e2e/gestaltung-daten';
import { setzeBildBreite, tauscheBild } from './bildbefehle';
import {
	BILD_FREI_BREITE,
	breiteBeimAblegen,
	istBildBaustein,
	istFreiesElement,
	legeBildFrei,
	legeFreiesElementFrei,
} from './bilder-frei';
import { nameDerGestaltung } from './gestaltung-arten';
import { attribut, klassenVon, zerlege } from './quelltext';
import { bausteinVonKnoten } from './referenz';

const BAUSTEIN = '<img src="bilder/kuerbis.jpg" alt="Kürbis" style="width:240px">';
const MIT_UNTERSCHRIFT =
	'<figure><img src="bilder/kuerbis.jpg" alt="Kürbis"><figcaption>Ein <b>großer</b> Kürbis</figcaption></figure>';

const nrVon = (quelle: string, finde: (k: ReturnType<typeof zerlege>['knoten'][number]) => boolean) => {
	const k = zerlege(quelle).knoten.find(finde);
	assert.ok(k);
	return k.nr;
};

const bildNr = (quelle: string) => nrVon(quelle, (k) => k.tag === 'img');

const vorne = (quelle: string) =>
	zerlege(quelle).knoten.find((k) => klassenVon(k).includes('ebene') && klassenVon(k).includes('vorne'));

describe('legeBildFrei', () => {
	it('macht einen Bild-Baustein zum freien Bild an derselben Stelle', () => {
		const quelle = blattMit({ stapel: [BAUSTEIN] });
		const r = legeBildFrei(quelle, bildNr(quelle), { x: 60, y: 400, b: 240, h: 180 });
		assert.ok(!r.quelle.includes(BAUSTEIN));
		const z = zerlege(r.quelle);
		const bild = r.nr === null ? undefined : z.knoten[r.nr];
		assert.ok(bild);
		assert.equal(bild.tag, 'img');
		assert.deepEqual(klassenVon(bild), ['bild-frei']);
		assert.equal(attribut(bild, 'data-lage')?.wert, 'frei');
		assert.equal(attribut(bild, 'src')?.wert, 'bilder/kuerbis.jpg');
		assert.equal(attribut(bild, 'alt')?.wert, 'Kürbis');
		assert.equal(attribut(bild, 'style')?.wert, '--x:60px;--y:400px;--b:240px');
		assert.equal(bild.eltern?.nr, vorne(r.quelle)?.nr);
		assert.ok(!r.quelle.includes('schmuck'));
	});

	it('macht die Bildunterschrift zur Schmuckschrift darunter', () => {
		const quelle = blattMit({ stapel: [MIT_UNTERSCHRIFT] });
		const r = legeBildFrei(quelle, bildNr(quelle), { x: 60, y: 400, b: 240, h: 180 });
		assert.ok(!r.quelle.includes('<figure>'));
		const ebene = vorne(r.quelle);
		assert.ok(ebene);
		assert.deepEqual(
			ebene.kinder.map((k) => k.tag),
			['img', 'div'],
		);
		const [bild, schrift] = ebene.kinder;
		assert.equal(r.nr, bild?.nr);
		assert.ok(schrift);
		assert.deepEqual(klassenVon(schrift), ['schmuck']);
		assert.equal(attribut(schrift, 'data-schmuck')?.wert, 'titel');
		assert.match(attribut(schrift, 'style')?.wert ?? '', /--x:60px;--y:588px;--b:240px/);
		assert.match(r.quelle, /<b>großer<\/b> Kürbis<\/div>/);
	});

	it('lässt die figure stehen, wenn noch anderes darin ist', () => {
		const html = '<figure><img src="a.png" alt="A"><p>Text</p><figcaption>Unter</figcaption></figure>';
		const quelle = blattMit({ stapel: [html] });
		const r = legeBildFrei(quelle, bildNr(quelle), { x: 0, y: 0, b: 100, h: 100 });
		assert.match(r.quelle, /<figure><p>Text<\/p><figcaption>Unter<\/figcaption><\/figure>/);
		assert.ok(!r.quelle.includes('class="schmuck"'));
	});

	it('legt Leitfiguren, freie Bilder und Bilder in Abbildungen nicht frei', () => {
		const quelle = blattMit({
			stapel: ['<div class="tipp"><img class="figur" src="w.png" alt="Willi"></div>'],
			vorne: [BILD_FREI],
		});
		for (const k of zerlege(quelle).knoten.filter((n) => n.tag === 'img')) {
			assert.equal(istBildBaustein(k), false);
			assert.throws(() => legeBildFrei(quelle, k.nr, { x: 0, y: 0, b: 10, h: 10 }));
		}
		const abb = zerlege('<x-zuordnen><img src="a.png" alt=""></x-zuordnen>').knoten.find((k) => k.tag === 'img');
		assert.equal(istBildBaustein(abb), false);
	});
});

describe('Bild-Befehle bei freien Bildern', () => {
	it('tauscheBild behält style und Klassen', () => {
		const quelle = blattMit({ vorne: [BILD_FREI] });
		const nr = bildNr(quelle);
		const r = tauscheBild(quelle, nr, 'bilder/zirkus.jpg', 'Zirkus');
		const bild = zerlege(r.quelle).knoten[nr];
		assert.ok(bild);
		assert.equal(attribut(bild, 'src')?.wert, 'bilder/zirkus.jpg');
		assert.equal(attribut(bild, 'alt')?.wert, 'Zirkus');
		assert.equal(attribut(bild, 'style')?.wert, '--x:96px;--y:300px;--b:420px;--drehen:-3deg');
		assert.equal(attribut(bild, 'class')?.wert, 'bild-frei');
		assert.equal(attribut(bild, 'data-lage')?.wert, 'frei');
	});

	it('setzeBildBreite lehnt freie Bilder ab', () => {
		const quelle = blattMit({ vorne: [BILD_FREI] });
		assert.throws(() => setzeBildBreite(quelle, bildNr(quelle), 200), /Position und Größe/);
	});

	it('setzeBildBreite ändert Bild-Bausteine weiter über width', () => {
		const quelle = blattMit({ stapel: [BAUSTEIN] });
		const r = setzeBildBreite(quelle, bildNr(quelle), 300);
		assert.match(r.quelle, /style="width:300px"/);
	});
});

describe('breiteBeimAblegen', () => {
	it('höchstens 320 px, sonst die Breite der Datei', () => {
		assert.equal(breiteBeimAblegen({ breite: 4000 }), BILD_FREI_BREITE);
		assert.equal(breiteBeimAblegen({ breite: 120 }), 120);
		assert.equal(breiteBeimAblegen(null), BILD_FREI_BREITE);
	});
});

const FREI_FIGURE =
	'<figure data-frei data-frei-titel="Tangram Waschbär"><svg viewBox="0 0 100 100" width="100%"><polygon points="0,0 100,0 50,50" fill="none" stroke="#000" stroke-width="2"/></svg><figcaption>Lege den Waschbären.</figcaption></figure>';
const FREI_SVG =
	'<svg data-frei data-frei-titel="Lupe" width="100%" height="120"><circle cx="60" cy="60" r="40" fill="none" stroke="#000" stroke-width="2"/></svg>';

describe('legeFreiesElementFrei', () => {
	const freiNr = (quelle: string) => nrVon(quelle, (k) => attribut(k, 'data-frei') !== undefined);

	it('behält data-frei und data-frei-titel, legt vorne ab und wird Art gestaltung', () => {
		const quelle = blattMit({ stapel: [FREI_FIGURE] });
		const nr = freiNr(quelle);
		const vorher = zerlege(quelle).knoten[nr];
		assert.ok(vorher);
		assert.equal(bausteinVonKnoten(vorher, false)?.art, 'freieselement');
		const r = legeFreiesElementFrei(quelle, nr, { x: 40, y: 300, b: 280, h: 320 });
		const k = r.nr === null ? undefined : zerlege(r.quelle).knoten[r.nr];
		assert.ok(k);
		assert.equal(k.tag, 'figure');
		assert.ok(attribut(k, 'data-frei'));
		assert.equal(attribut(k, 'data-frei-titel')?.wert, 'Tangram Waschbär');
		assert.equal(attribut(k, 'data-lage')?.wert, 'frei');
		// Die gemessene Breite ersetzt width="100%" als Maß; ohne --h wächst die Höhe aus dem Inhalt.
		assert.equal(attribut(k, 'style')?.wert, '--x:40px;--y:300px;--b:280px');
		assert.equal(k.eltern?.nr, vorne(r.quelle)?.nr);
		assert.ok(r.quelle.includes('Lege den Waschbären.'));
		assert.equal(r.quelle.match(/data-frei-titel/g)?.length, 1);
		const baustein = bausteinVonKnoten(k, false);
		assert.equal(baustein?.art, 'gestaltung');
		assert.ok(baustein);
		assert.equal(
			nameDerGestaltung(baustein, (n) => attribut(k, n)?.wert ?? null),
			'Tangram Waschbär',
		);
		assert.equal(istFreiesElement(k), false);
	});

	it('setzt --h nur bei einem SVG ohne viewBox', () => {
		const quelle = blattMit({ stapel: [FREI_SVG] });
		const r = legeFreiesElementFrei(quelle, freiNr(quelle), { x: 0, y: 10, b: 600, h: 120 });
		const k = r.nr === null ? undefined : zerlege(r.quelle).knoten[r.nr];
		assert.ok(k);
		assert.equal(attribut(k, 'style')?.wert, '--x:0px;--y:10px;--b:600px;--h:120px');
	});

	it('nimmt nur freie Elemente im Stapel', () => {
		const quelle = blattMit({ stapel: [BAUSTEIN] });
		assert.throws(() => legeFreiesElementFrei(quelle, bildNr(quelle), { x: 0, y: 0, b: 10, h: 10 }));
	});
});
