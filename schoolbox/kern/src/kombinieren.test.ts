import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FORM_TEXT } from '../../web/e2e/gestaltung-daten';
import { formHtml } from './formen';
import { leseLage } from './gestaltung';
import type { KombiArt } from './kombinieren';
import { alsPolygon, bereiche, kombiGrund, kombiniere, liegtIn, schereGrund, wendeScherenzugAn } from './kombinieren';
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

describe('Formen-Schere (121)', () => {
	it('zwei überlappende Kreise ergeben drei Bereiche, drei im Dreieck sieben', () => {
		const zwei = blatt(kreis(100, 100), kreis(160, 100));
		assert.equal(bereiche(zwei, formen(zwei)).length, 3);
		const drei = blatt(kreis(100, 100), kreis(160, 100), kreis(130, 150));
		assert.equal(bereiche(drei, formen(drei)).length, 7);
	});

	it('nicht bereit ohne Überlappung oder mit mehr als acht Formen', () => {
		const q = blatt(kreis(100, 100), kreis(400, 100));
		assert.equal(schereGrund(q, formen(q)), 'Die Formen überlappen sich nicht.');
		const neun = blatt(...Array.from({ length: 9 }, (_, i) => kreis(100 + i * 10, 100)));
		assert.equal(schereGrund(neun, formen(neun)), 'Höchstens 8 Formen.');
		const gut = blatt(kreis(100, 100), kreis(160, 100));
		assert.equal(schereGrund(gut, formen(gut)), null);
	});

	it('Ein Zug vereint zwei Bereiche, die übrigen werden einzelne Formen; mit entfernen fehlen sie', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100));
		const b = bereiche(q, formen(q));
		const mitte = b.find((x) => x.in.length === 2);
		const links = b.find((x) => x.in.length === 1 && x.in[0] === 0);
		assert.ok(mitte && links);
		const r = wendeScherenzugAn(q, formen(q), [mitte.id, links.id], false);
		assert.ok(r);
		assert.equal(r.nrn.length, 2);
		assert.equal(formen(r.quelle).length, 2);
		const weg = wendeScherenzugAn(q, formen(q), [mitte.id, links.id], true);
		assert.ok(weg);
		assert.equal(weg.nrn.length, 1);
		assert.equal(formen(weg.quelle).length, 1);
	});

	it('ohne markierten Bereich passiert nichts', () => {
		const q = blatt(kreis(100, 100), kreis(160, 100));
		assert.equal(wendeScherenzugAn(q, formen(q), [], false), null);
	});
});
