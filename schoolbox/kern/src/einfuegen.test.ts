import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { einfuegbarAus, fuegeBausteinEin, fuegeZusatzEin, neueAufgabe, verschiebeAufNeueSeite } from './einfuegen';
import { KATALOG } from './katalog';
import { leseStarter } from './katalog-starter';
import { klassenVon, zerlege } from './quelltext';

const BLATT = `<!doctype html><html><head><title>t</title><style>.meins{color:red}</style></head>
<body class="kl2 farbe palette-himmel">
<section class="seite">
  <div class="namenszeile"></div>
  <div class="kopf"><div class="titel"><h1>T</h1></div></div>
  <div class="aufgabe">
    <span class="nr">1</span>
    <div class="anw"><span class="text">Eins</span></div>
    <div class="koerper">
      <div class="reihe" style="--spalten:2">
        <div class="zelle"><span class="antwort"></span></div>
        <div class="zelle">b</div>
      </div>
    </div>
  </div>
  <div class="aufgabe">
    <span class="nr stern">★</span>
    <div class="anw"><span class="text">Stern</span></div>
    <div class="koerper"></div>
  </div>
  <div class="fuss"><div class="text">Fuß</div></div>
</section>
</body></html>
`;
const n = { jeSeite: false };
const nrVon = (q: string, klasse: string, i = 0) =>
	zerlege(q).knoten.filter((k) => klassenVon(k).includes(klasse))[i]?.nr ?? null;
const aufgaben = (q: string) => [...q.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((t) => t[2]);

describe('Einfügen', () => {
	it('legt eine Aufgabe hinter die gewählte, vor den Stern, und nummeriert neu', () => {
		const html =
			'<div class="aufgabe"><span class="nr">9</span><div class="anw"><span class="text">Neu</span></div><div class="koerper"></div></div>';
		const { nr, quelle } = fuegeBausteinEin(
			BLATT,
			{ id: 'aufgabe', ort: 'seite', html },
			nrVon(BLATT, 'aufgabe'),
			n,
		);
		assert.deepEqual(aufgaben(quelle), ['1', '2', '★']);
		assert.ok(quelle.indexOf('Neu') < quelle.indexOf('Stern'));
		assert.equal(nr, nrVon(quelle, 'aufgabe', 1));
	});

	it('bei gewählter Sternchenaufgabe und ohne Auswahl bleibt der Stern am Ende, der Fuß auch', () => {
		const html =
			'<div class="aufgabe"><span class="nr">9</span><div class="anw"><span class="text">Neu</span></div><div class="koerper"></div></div>';
		for (const nr of [nrVon(BLATT, 'aufgabe', 1), null]) {
			const { quelle } = fuegeBausteinEin(BLATT, { id: 'aufgabe', ort: 'seite', html }, nr, n);
			assert.deepEqual(aufgaben(quelle), ['1', '2', '★']);
			assert.ok(quelle.indexOf('Neu') < quelle.indexOf('Stern'));
			assert.ok(quelle.indexOf('Stern') < quelle.indexOf('class="fuss"'));
		}
	});

	it('Element in eine Aufgabe: in den Körper; ohne passende Stelle in eine neue Aufgabe', () => {
		const uhr = '<x-uhr zeit="4:30"></x-uhr>';
		const koerper = fuegeBausteinEin(
			BLATT,
			{ id: 'x-uhr', ort: 'aufgabe', html: uhr },
			nrVon(BLATT, 'anw'),
			n,
		).quelle;
		assert.deepEqual(aufgaben(koerper), ['1', '★']);
		assert.ok(
			koerper.indexOf(uhr) > koerper.indexOf('class="reihe"') && koerper.indexOf(uhr) < koerper.indexOf('Stern'),
		);
		const neu = fuegeBausteinEin(BLATT, { id: 'x-uhr', ort: 'aufgabe', html: uhr }, nrVon(BLATT, 'kopf'), n).quelle;
		assert.deepEqual(aufgaben(neu), ['1', '2', '★']);
		assert.match(neu, /<div class="koerper"><x-uhr zeit="4:30"><\/x-uhr><\/div>/);
	});

	it('Element im Item: neues Item daneben, in einer Zeile: im Item', () => {
		const uhr = '<x-uhr zeit="4:30"></x-uhr>';
		const item = fuegeBausteinEin(
			BLATT,
			{ id: 'x-uhr', ort: 'aufgabe', html: uhr },
			nrVon(BLATT, 'zelle'),
			n,
		).quelle;
		assert.match(item, /<div class="zelle"><x-uhr zeit="4:30"><\/x-uhr><\/div>/);
		const antwort = '<span class="antwort"></span>';
		const inItem = fuegeBausteinEin(
			BLATT,
			{ id: 'antwort', ort: 'zeile', html: antwort },
			nrVon(BLATT, 'zelle', 1),
			n,
		).quelle;
		assert.equal(zerlege(inItem).knoten.length, zerlege(BLATT).knoten.length + 1);
	});

	it('Trenner setzt eine Klasse am Blatt, Beispiel am Item, und ändert sonst nichts', () => {
		const t = fuegeBausteinEin(BLATT, { id: 'trenner', ort: 'blatt', klasse: 'trenner' }, null, n).quelle;
		assert.match(t, /<body class="kl2 farbe palette-himmel trenner">/);
		assert.equal(t.replace(' trenner', ''), BLATT);
		const b = fuegeBausteinEin(
			BLATT,
			{ id: 'beispiel', ort: 'zeile', klasse: 'beispiel' },
			nrVon(BLATT, 'zelle'),
			n,
		).quelle;
		assert.match(b, /class="zelle beispiel"/);
		assert.throws(
			() => fuegeBausteinEin(BLATT, { id: 'beispiel', ort: 'zeile', klasse: 'beispiel' }, null, n),
			/Wähle/,
		);
	});

	it('leere Seite: geht ins Leere, ohne Fehler', () => {
		const leer = BLATT.replace(/<section class="seite">[\s\S]*<\/section>/, '<section class="seite"></section>');
		const { quelle } = fuegeBausteinEin(leer, { id: 'x-uhr', ort: 'aufgabe', html: '<x-uhr></x-uhr>' }, null, n);
		assert.match(quelle, /<section class="seite"><div class="aufgabe"><span class="nr">1<\/span>/);
	});

	it('Aufgabenpaket: eine neue Aufgabe mit Anweisung und allen Teilen', () => {
		const { quelle } = fuegeBausteinEin(
			BLATT,
			{
				id: 'r',
				ort: 'seite',
				teile: ['<x-uhr></x-uhr>', '<span class="antwort"></span>'],
				anweisung: 'Lies ab.',
			},
			null,
			n,
		);
		assert.match(
			quelle,
			/Lies ab\.<\/span><\/div><div class="koerper"><x-uhr><\/x-uhr><span class="antwort"><\/span>/,
		);
		assert.deepEqual(aufgaben(quelle), ['1', '2', '★']);
	});

	it('Kopf und Namenszeile an den Seitenanfang, Fuß ans Ende', () => {
		const q = (id: string, html: string) =>
			fuegeBausteinEin(BLATT, { id, ort: 'seite', html }, nrVon(BLATT, 'aufgabe'), n).quelle;
		const kopf = q('kopf', '<div class="kopf neu"></div>');
		assert.ok(
			kopf.indexOf('namenszeile') < kopf.indexOf('kopf neu') && kopf.indexOf('kopf neu') < kopf.indexOf('<h1>'),
		);
		const name = q('namenszeile', '<div class="namenszeile neu"></div>');
		assert.ok(name.indexOf('namenszeile neu') < name.indexOf('<div class="namenszeile">'));
		const fuss = q('fuss', '<div class="fuss neu"></div>');
		assert.ok(fuss.indexOf('Stern') < fuss.indexOf('fuss neu'));
	});

	it('ein Aufgabenpaket aus dem Katalog ergibt genau eine neue Aufgabe', () => {
		const e = KATALOG.find((k) => k.id === 'paket-uhr');
		assert.ok(e);
		const b = einfuegbarAus(e, leseStarter());
		const { quelle } = fuegeBausteinEin(BLATT, b, null, n);
		assert.deepEqual(aufgaben(quelle), ['1', '2', '★']);
		assert.equal(quelle.match(/class="aufgabe"/g)?.length, 3);
		assert.match(quelle, /<x-uhr/);
	});

	it('ändert in vorhandenem Material mit eigenem CSS nur die neue Stelle', () => {
		const { quelle } = fuegeBausteinEin(
			BLATT,
			{ id: 'x-uhr', ort: 'aufgabe', html: '<x-uhr></x-uhr>' },
			nrVon(BLATT, 'anw'),
			n,
		);
		assert.equal(quelle.replace(/\s*<x-uhr><\/x-uhr>/, ''), BLATT);
	});

	it('neue Aufgabe: Nummer 0 wie bisher, nur die Vorschau im Katalog gibt 1 mit (168)', () => {
		const vorschau = neueAufgabe('x', 'A', 1);
		assert.ok(vorschau.includes('<span class="nr">1</span>'));
		assert.ok(vorschau.includes('<span class="text">A</span>'));
		// Gegenprobe: Ohne drittes Argument Zeichen für Zeichen wie vor 168, das eingefügte HTML bleibt gleich (26).
		assert.equal(
			neueAufgabe('x', 'A'),
			'<div class="aufgabe"><span class="nr">0</span><div class="anw"><span class="text">A</span></div><div class="koerper">x</div></div>',
		);
		assert.equal(
			neueAufgabe('x'),
			'<div class="aufgabe"><span class="nr">0</span><div class="anw"><span class="text">Anweisung</span></div><div class="koerper">x</div></div>',
		);
	});

	it('jeder Katalogeintrag lässt sich einfügen, und die Quelle bleibt zerlegbar', () => {
		const starter = leseStarter();
		for (const e of KATALOG) {
			const b = einfuegbarAus(e, starter);
			const nr = e.klasse && e.ort === 'zeile' ? nrVon(BLATT, 'zelle') : nrVon(BLATT, 'anw');
			const { quelle } = fuegeBausteinEin(BLATT, b, nr, n);
			assert.notEqual(quelle, BLATT, e.id);
			const zahl = (t: string) => zerlege(t).knoten.length;
			assert.ok(zahl(quelle) >= zahl(BLATT), e.id);
			assert.ok(!e.starter || (b.html ?? '').length > 0, `${e.id}: Starter fehlt`);
		}
	});
});

describe('Zusatzbausteine', () => {
	const leer = BLATT.replace(/<section class="seite">[\s\S]*<\/section>/, '<section class="seite"></section>');
	it('legt nur Gewähltes an, in sinnvoller Reihenfolge', () => {
		const starter = leseStarter();
		assert.equal(fuegeZusatzEin(leer, {}, starter, n), leer);
		const q = fuegeZusatzEin(leer, { niveaus: true, sternchen: true, selbsteinschaetzung: true }, starter, n);
		assert.ok(q.indexOf('wahlhilfe') < q.indexOf('stern') && q.indexOf('stern') < q.indexOf('class="fuss"'));
	});
});

describe('Überlauf', () => {
	it('legt die Bausteine auf eine neue Seite dahinter und nummeriert neu; Fuß und Rest bleiben', () => {
		const zweite = nrVon(BLATT, 'aufgabe', 1) ?? -1;
		const { quelle } = verschiebeAufNeueSeite(BLATT, [zweite], n);
		const seiten = zerlege(quelle).knoten.filter((k) => klassenVon(k).includes('seite'));
		assert.equal(seiten.length, 2);
		assert.ok(quelle.indexOf('Stern') > quelle.lastIndexOf('<section'));
		assert.ok(quelle.indexOf('class="fuss"') < quelle.lastIndexOf('<section'));
	});

	it('lehnt Bausteine verschiedener Seiten ab', () => {
		assert.throws(() => verschiebeAufNeueSeite(BLATT, [nrVon(BLATT, 'zelle') ?? -1], n), /nicht zusammen/);
	});
});
