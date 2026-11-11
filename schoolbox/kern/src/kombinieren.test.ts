import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FORM_TEXT } from '../../web/e2e/gestaltung-daten';
import { formHtml } from './formen';
import { leseLage } from './gestaltung';
import type { KombiArt } from './kombinieren';
import { alsPolygon, kombiGrund, kombiniere, liegtIn } from './kombinieren';
import { attribut, zerlege } from './quelltext';
import { ankerVon, liesPfad } from './vektor';

const mitLage = (html: string, x: number, y: number, b: number, h: number, extra = '') =>
	html.replace('<svg ', `<svg style="--x:${x}px;--y:${y}px;--b:${b}px;--h:${h}px${extra}" `);
const kreis = (x: number, y: number, b = 100, fuellung = 'var(--akzent)') =>
	mitLage(formHtml({ art: 'ellipse', b, h: b, fuellung }), x, y, b, b);
const rechteck = (x: number, y: number, b: number, h: number, extra = '') =>
	mitLage(formHtml({ art: 'rechteck', b, h }), x, y, b, h, extra);

const blatt = (...vorne: string[]) => blattMit({ vorne });
/** Die Nummern aller Formen in Quellreihenfolge. */
const formen = (q: string) =>
	zerlege(q)
		.knoten.filter((k) => attribut(k, 'data-lage')?.wert === 'frei' && attribut(k, 'data-form'))
		.map((k) => k.nr);
const pfade = (q: string) => zerlege(q).knoten.filter((k) => attribut(k, 'data-form')?.wert === 'pfad');
const dVon = (q: string, nr: number) => {
	const k = zerlege(q).knoten[nr];
	const pfad = k?.kinder.find((c) => c.tag === 'path');
	return (pfad && attribut(pfad, 'd')?.wert) ?? '';
};
const kurven = (d: string) => (d.match(/C/g) ?? []).length;
const teilpfade = (d: string) => (d.match(/M/g) ?? []).length;

const kombiniert = (q: string, art: KombiArt) => {
	const r = kombiniere(q, formen(q), art);
	assert.ok(r && r.nr !== null, `${art} ergibt etwas`);
	return { quelle: r.quelle, nr: r.nr };
};

describe('kombiniere (121)', () => {
	it('Vereinen zweier Kreise: ein Pfad, höchstens 16 Kurven, Lage um beide', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100));
		const r = kombiniert(q, 'vereinen');
		assert.equal(formen(r.quelle).length, 1);
		assert.equal(pfade(r.quelle).length, 1);
		const d = dVon(r.quelle, r.nr);
		assert.equal(teilpfade(d), 1);
		assert.ok(kurven(d) <= 16, `${kurven(d)} Kurven`);
		assert.deepEqual(leseLage(r.quelle, r.nr), { x: 100, y: 100, b: 160, h: 100 });
	});

	it('Vereinen dreier Kreise (Wolke) ist eine Fläche', () => {
		const q = blatt(kreis(100, 100), kreis(170, 80), kreis(240, 100));
		const r = kombiniert(q, 'vereinen');
		assert.equal(teilpfade(dVon(r.quelle, r.nr)), 1);
	});

	it('Abziehen eines Kreises aus einem Quadrat: ein Loch, evenodd, zwei Teilpfade', () => {
		const q = blatt(rechteck(100, 100, 200, 200), kreis(150, 150));
		const r = kombiniert(q, 'abziehen');
		const d = dVon(r.quelle, r.nr);
		assert.equal(teilpfade(d), 2);
		assert.match(r.quelle, /fill-rule:evenodd/);
		assert.deepEqual(leseLage(r.quelle, r.nr), { x: 100, y: 100, b: 200, h: 200 });
	});

	it('Schnitt zweier Kreise ist die Linse dazwischen', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100));
		const r = kombiniert(q, 'schneiden');
		const lage = leseLage(r.quelle, r.nr);
		assert.ok(Math.abs((lage.x ?? 0) - 160) <= 2 && Math.abs((lage.b ?? 0) - 40) <= 3, JSON.stringify(lage));
	});

	it('Ausschluss zweier Kreise: zwei Teile ohne die Mitte', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100));
		const r = kombiniert(q, 'ausschliessen');
		const poly = alsPolygon(r.quelle, r.nr).map((ring) => ring.map((p): [number, number] => [p.x, p.y]));
		assert.equal(liegtIn(poly, { x: 180, y: 150 }), false, 'die Mitte ist leer');
		assert.equal(liegtIn(poly, { x: 120, y: 150 }), true);
	});

	it('Das Aussehen kommt von der vordersten Form, Drehung und Parameter gehen weg', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100, 100, '#ff0000'));
		const r = kombiniert(q, 'vereinen');
		assert.match(r.quelle, /fill:#ff0000/);
		assert.doesNotMatch(r.quelle, /data-form="ellipse"/);
	});

	it('Gedrehtes Rechteck: Die Drehung steckt in den Punkten', () => {
		const q = blatt(rechteck(100, 100, 100, 40), rechteck(160, 100, 100, 40, ';--drehen:30deg'));
		const r = kombiniert(q, 'vereinen');
		assert.equal(leseLage(r.quelle, r.nr).drehen, undefined);
		const poly = alsPolygon(r.quelle, r.nr).map((ring) => ring.map((p): [number, number] => [p.x, p.y]));
		// Um 30° um (210, 120) gedreht: (241, 155) liegt jetzt darin, (255, 105) nicht mehr.
		assert.equal(liegtIn(poly, { x: 241, y: 155 }), true);
		assert.equal(liegtIn(poly, { x: 255, y: 105 }), false);
	});

	it('Gespiegelte Form: Die Spiegelung steckt in den Punkten', () => {
		const dreieck =
			'<svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 100 100" style="--x:0px;--y:0px;--b:100px;--h:100px;--spiegeln:-1"><path d="M0 0 L100 0 L0 100 Z" style="fill:#000"/></svg>';
		const q = blatt(dreieck, rechteck(300, 300, 20, 20));
		const poly = alsPolygon(q, formen(q)[0] ?? -1).map((ring) => ring.map((p): [number, number] => [p.x, p.y]));
		assert.equal(liegtIn(poly, { x: 90, y: 10 }), true);
		assert.equal(liegtIn(poly, { x: 10, y: 90 }), false);
	});

	it('Leeres Ergebnis ändert nichts', () => {
		const q = blatt(kreis(100, 100), kreis(400, 100));
		assert.equal(kombiniere(q, formen(q), 'schneiden'), null);
		const r = blatt(kreis(100, 100, 50), rechteck(80, 80, 120, 120));
		assert.equal(kombiniere(r, formen(r), 'abziehen'), null);
	});

	it('Anstoßende Quadrate ergeben ein Rechteck mit vier Ecken', () => {
		const q = blatt(rechteck(100, 100, 100, 100), rechteck(200, 100, 100, 100));
		const r = kombiniert(q, 'vereinen');
		const d = dVon(r.quelle, r.nr);
		assert.equal(teilpfade(d), 1);
		assert.equal(kurven(d), 0);
		assert.equal(ankerVon(liesPfad(d) ?? []).length, 4);
		assert.deepEqual(leseLage(r.quelle, r.nr), { x: 100, y: 100, b: 200, h: 100 });
	});

	it('Nur Formen ohne Text derselben Ebene', () => {
		const q = blatt(kreis(100, 100), FORM_TEXT);
		assert.equal(kombiGrund(q, formen(q)), 'Nur Formen ohne Text lassen sich kombinieren.');
		assert.throws(() => kombiniere(q, formen(q), 'vereinen'));
		const zwei = blattMit({ vorne: [kreis(100, 100)], hinten: [kreis(160, 100)] });
		assert.equal(kombiGrund(zwei, formen(zwei)), 'Nur Formen derselben Ebene lassen sich kombinieren.');
	});
});

/** Was ein ⌥-Zug der früheren Formen-Schere (121, entfernt in 173) über die Linse zweier Kreise schrieb. */
const SCHERE_MONDE = [
	'<svg class="form" data-lage="frei" data-name="Kreis" data-form="pfad" viewBox="0 0 130 160" style="--x:200px;--y:300px;--b:130px;--h:160px"><path d="M128.5 18.89 C89.83 48.18 89.83 111.82 128.5 141.11 C117.29 149.6 105.27 155.58 91.22 157.65 C79.81 159.33 68.11 158.5 57.07 155.18 C-16.58 133.03 -16.58 26.97 57.07 4.82 C68.11 1.5 79.81 0.67 91.22 2.35 C105.27 4.42 117.29 10.4 128.5 18.89 Z" style="fill:#ff0000;stroke:var(--dunkel);stroke-width:3px"/></svg>',
	'<svg class="form" data-lage="frei" data-name="Rechts" data-form="pfad" viewBox="0 0 130 160" style="--x:330px;--y:300px;--b:130px;--h:160px"><path d="M1.5 18.89 C12.71 10.4 24.73 4.42 38.78 2.35 C50.19 0.67 61.89 1.5 72.93 4.82 C146.58 26.97 146.58 133.03 72.93 155.18 C61.89 158.5 50.19 159.33 38.78 157.65 C24.73 155.58 12.71 149.6 1.5 141.11 C40.17 111.82 40.17 48.18 1.5 18.89 Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg>',
];

describe('Bestand: Ergebnis der früheren Formen-Schere (173)', () => {
	const q = blatt(...SCHERE_MONDE);
	const poly = (quelle: string, nr: number) =>
		alsPolygon(quelle, nr).map((ring) => ring.map((p): [number, number] => [p.x, p.y]));

	it('sind gewöhnliche Pfade, die sich kombinieren lassen', () => {
		assert.equal(pfade(q).length, 2);
		assert.equal(kombiGrund(q, formen(q)), null);
	});

	it('die Monde liegen links und rechts, die Linse dazwischen ist leer', () => {
		const [links = -1, rechts = -1] = formen(q);
		for (const [x, inLinks, inRechts] of [
			[230, true, false],
			[430, false, true],
			[330, false, false],
		] as const) {
			assert.equal(liegtIn(poly(q, links), { x, y: 380 }), inLinks, `links bei ${x}`);
			assert.equal(liegtIn(poly(q, rechts), { x, y: 380 }), inRechts, `rechts bei ${x}`);
		}
	});

	it('Vereinen ergibt einen Pfad mit zwei Teilen, evenodd, ohne Marke', () => {
		const r = kombiniert(q, 'vereinen');
		// Gegenprobe: Die Quelle ändert sich (zwei Pfade werden einer), der Test sieht also Änderungen.
		assert.notEqual(r.quelle, q);
		assert.equal(pfade(r.quelle).length, 1);
		assert.equal(teilpfade(dVon(r.quelle, r.nr)), 2);
		assert.match(r.quelle, /fill-rule:evenodd/);
		assert.doesNotMatch(r.quelle, /data-kombi-schritt/);
	});
});
