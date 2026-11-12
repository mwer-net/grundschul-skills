/**
 * Ältere Blätter mit Rezept (bis 180): Der Code für Rezepte ist weg, die Dateien bleiben, wie sie sind. Ihr Aussehen
 * hängt an den Regeln für `data-aufmachung*` in `blatt.css` und daran, dass der Kern ihre Teile wie normale Gestaltung
 * behandelt. Die Probe `testdaten/bestand-aufmachung.html` ist eingefroren (Rezept „Detektiv“, Farbwelt 1, Kopfband
 * Welle, Konfetti 0,6, wie im Bestand); kein Code erzeugt sie mehr.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { setzeBlatt } from './kit-einstellungen';
import { ASSETS } from './konfig';
import { attribut, klassenVon, zerlege } from './quelltext';
import { leseSeitengestaltung, seitenNummern, setzeSeitenflaeche } from './seitengestaltung';
import { fuegeSeiteEin } from './struktur';

const PROBE = readFileSync(path.join(__dirname, 'testdaten', 'bestand-aufmachung.html'), 'utf8');
const BLATT_CSS = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');

/** Die Regeln, die ältere Blätter brauchen, Zeile für Zeile so eingefroren, wie sie in `blatt.css` stehen (180). */
const REGELN = readFileSync(path.join(__dirname, 'testdaten', 'bestand-regeln.css'), 'utf8')
	.split('\n')
	.filter(Boolean);

/** Die Regeln, die in `css` nicht als ganze Zeile stehen. */
const fehlend = (css: string) => {
	const zeilen = new Set(css.split('\n'));
	return REGELN.filter((r) => !zeilen.has(r));
};

const bodyTag = (quelle: string) => /<body[^>]*>/.exec(quelle)?.[0];
const anzahl = (quelle: string, klasse: string) =>
	zerlege(quelle).knoten.filter((k) => klassenVon(k).includes(klasse)).length;

describe('Ältere Blätter mit Rezept: Regeln in blatt.css (180)', () => {
	it('stehen alle unverändert da', () => {
		assert.deepEqual(fehlend(BLATT_CSS), []);
	});

	it('decken Kopfband, die drei Kanten, Titelfarbe und s/w ab', () => {
		const text = REGELN.join('\n');
		for (const teil of [
			'body[data-aufmachung-kopfband] .kopf::before{',
			'body[data-aufmachung-kopfband="welle"] .kopf::before{',
			'body[data-aufmachung-kopfband="bogen"] .kopf::before{',
			'body[data-aufmachung-kopfband="zacken"] .kopf::before{',
			'body[data-aufmachung] .kopf h1{',
			'body.sw[data-aufmachung] .kopf::before{display:none}',
			'body.sw[data-aufmachung] .kopf h1{',
			'body.sw [data-sw="dunkel"]{',
			'body[data-aufmachung] .seite{isolation:isolate}',
		]) {
			assert.ok(text.includes(teil), teil);
		}
	});

	it('Gegenprobe: Fehlt eine Zeile, meldet der Test sie', () => {
		for (const regel of REGELN) {
			const ohne = BLATT_CSS.split('\n')
				.filter((z) => z !== regel)
				.join('\n');
			assert.deepEqual(fehlend(ohne), [regel]);
		}
	});
});

describe('Kopfband als Element (181): Regeln in blatt.css', () => {
	const zeilen = new Set(BLATT_CSS.split('\n'));

	it('zeichnet das Band, blendet das alte aus und ist in s/w ohne Grau weg', () => {
		assert.ok(BLATT_CSS.includes('.kopfband{position:absolute;'));
		assert.ok(zeilen.has('.seite:has(> .ebene > .kopfband) .kopf::before{display:none}'));
		assert.ok(zeilen.has('body.sw .kopfband:not([data-sw="grau"]){display:none !important}'));
	});

	it('hängt Welle, Bogen und Zacken unter die Höhe (123)', () => {
		assert.ok(BLATT_CSS.includes('height:calc(var(--h,160px) + var(--kopfband-kante))'));
		for (const form of ['welle', 'bogen', 'zacken']) {
			assert.ok(BLATT_CSS.includes(`.kopfband[data-form="${form}"]{`), form);
		}
	});
});

describe('Ältere Blätter mit Rezept: der Kern behandelt die Teile als normale Gestaltung (180)', () => {
	it('die Probe hat einen Kopf mit Titel, eine Seitenfläche und zwei Streuungen', () => {
		assert.match(PROBE, /<div class="kopf">/);
		assert.match(PROBE, /<h1>/);
		assert.match(PROBE, /data-aufmachung="detektiv"/);
		assert.match(PROBE, /data-aufmachung-kopfband="welle"/);
		assert.equal(anzahl(PROBE, 'seitenflaeche'), 1);
		assert.equal(anzahl(PROBE, 'streuung'), 2);
	});

	it('eine neue Seite bleibt leer, body und die alten Teile bleiben', () => {
		const neu = fuegeSeiteEin(PROBE, { nach: null, mitNamenszeile: false }, { jeSeite: false }).quelle;
		assert.equal(seitenNummern(neu).length, seitenNummern(PROBE).length + 1);
		assert.equal(anzahl(neu, 'seitenflaeche'), 1);
		assert.equal(anzahl(neu, 'streuung'), 2);
		assert.equal(bodyTag(neu), bodyTag(PROBE));
		assert.ok(neu.includes('<section class="seite"></section>'));
	});

	it('ein neues Format lässt Teile und Werte am body stehen', () => {
		const neu = setzeBlatt(PROBE, { format: 'a4-quer' });
		assert.equal(bodyTag(neu), bodyTag(PROBE)?.replace('palette-himmel', 'palette-himmel a4-quer'));
		assert.equal(anzahl(neu, 'seitenflaeche'), 1);
		assert.equal(anzahl(neu, 'streuung'), 2);
		const teile = (q: string) => q.slice(q.indexOf('<div class="ebene hinten">'));
		assert.equal(teile(neu), teile(PROBE));
	});

	it('die Seitenfläche liest sich ohne Angabe „rezept“ und ändert sich mit Schloss und fremden Attributen', () => {
		const [seite = 0] = seitenNummern(PROBE);
		const g = leseSeitengestaltung(PROBE, seite);
		assert.deepEqual(g.flaeche, {
			art: 'farbe',
			f1: 'var(--a-flaeche)',
			f2: null,
			winkel: null,
			muster: null,
			musterGroesse: null,
			sw: null,
		});
		assert.equal(g.rahmen, null);
		const neu = setzeSeitenflaeche(PROBE, [seite], { ...g.flaeche, art: 'farbe', f1: '#fff3c4' });
		const flaeche = zerlege(neu).knoten.find((k) => klassenVon(k).includes('seitenflaeche'));
		assert.ok(flaeche);
		assert.equal(attribut(flaeche, 'style')?.wert, '--f1:#fff3c4');
		assert.notEqual(attribut(flaeche, 'data-gesperrt'), undefined, 'Schloss bleibt');
		assert.equal(attribut(flaeche, 'data-aufmachung-teil')?.wert, 'flaeche');
		assert.equal(bodyTag(neu), bodyTag(PROBE));
		// Nur die Fläche ändert sich, sonst nichts in der Datei.
		assert.equal(neu, PROBE.replace('style="--f1:var(--a-flaeche)"', 'style="--f1:#fff3c4"'));
	});
});
