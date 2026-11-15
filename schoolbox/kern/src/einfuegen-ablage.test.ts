import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fuegeBausteinEin } from './einfuegen';
import { fuegeBausteinAn, huelleImStapel } from './einfuegen-ablage';
import { attribut, klassenVon, zerlege } from './quelltext';

const aufgabe = (text: string, nr = '1') =>
	`<div class="aufgabe"><span class="nr">${nr}</span><div class="anw"><span class="text">${text}</span></div><div class="koerper"></div></div>`;

const BLATT = `<!doctype html><html><head><title>t</title></head>
<body class="kl2">
<section class="seite">
  <div class="namenszeile"></div>
  <div class="kopf"><div class="titel"><h1>T</h1></div></div>
  ${aufgabe('Eins', '1')}
  ${aufgabe('Zwei', '2')}
  <div class="fuss"><div class="text">Fuß</div></div>
</section>
<section class="seite">
  ${aufgabe('Drei', '3')}
</section>
<section class="seite"></section>
</body></html>
`;

const NEU = { id: 'aufgabe', ort: 'seite' as const, html: aufgabe('Neu', '0') };
const nein = { jeSeite: false };
const ja = { jeSeite: true };

const knoten = (q: string, klasse: string, i = 0) => zerlege(q).knoten.filter((k) => klassenVon(k).includes(klasse))[i];
const nrVon = (q: string, klasse: string, i = 0) => knoten(q, klasse, i)?.nr ?? -1;
const texte = (q: string) => [...q.matchAll(/<span class="text">([^<]*)</g)].map((t) => t[1]);
const nummern = (q: string) => [...q.matchAll(/<span class="nr( stern)?">([^<]*)</g)].map((t) => t[2]);

describe('Einfügen an einer Ablage', () => {
	it('vor der ersten Aufgabe: Nummern rücken nach', () => {
		const { nr, quelle } = fuegeBausteinAn(BLATT, NEU, { nr: nrVon(BLATT, 'aufgabe', 0), wo: 'vor' }, nein);
		assert.deepEqual(texte(quelle), ['Neu', 'Eins', 'Zwei', 'Drei']);
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '4']);
		assert.equal(nr, nrVon(quelle, 'aufgabe', 0));
	});

	it('hinter der ersten Aufgabe, also an Stelle 2', () => {
		const { quelle } = fuegeBausteinAn(BLATT, NEU, { nr: nrVon(BLATT, 'aufgabe', 0), wo: 'nach' }, nein);
		assert.deepEqual(texte(quelle), ['Eins', 'Neu', 'Zwei', 'Drei']);
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '4']);
	});

	it('auf der zweiten Seite zählt je Dokument weiter, je Seite von vorn', () => {
		const ablage = { nr: nrVon(BLATT, 'aufgabe', 2), wo: 'vor' as const };
		const dokument = fuegeBausteinAn(BLATT, NEU, ablage, nein).quelle;
		assert.deepEqual(texte(dokument), ['Eins', 'Zwei', 'Neu', 'Drei']);
		assert.deepEqual(nummern(dokument), ['1', '2', '3', '4']);
		const folien = fuegeBausteinAn(BLATT, NEU, ablage, ja).quelle;
		assert.deepEqual(nummern(folien), ['1', '2', '1', '2']);
	});

	it('in eine leere Seite', () => {
		const leer = nrVon(BLATT, 'seite', 2);
		const { nr, quelle } = fuegeBausteinAn(BLATT, NEU, { in: leer }, nein);
		const seite = knoten(quelle, 'seite', 2);
		assert.ok(seite?.kinder.some((k) => klassenVon(k).includes('aufgabe')));
		assert.equal(nr, nrVon(quelle, 'aufgabe', 3));
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '4']);
	});

	it('ans Ende einer Seite mit Fuß: vor den Fuß', () => {
		const { quelle } = fuegeBausteinAn(BLATT, NEU, { in: nrVon(BLATT, 'seite', 0) }, nein);
		assert.deepEqual(texte(quelle), ['Eins', 'Zwei', 'Neu', 'Drei']);
		assert.ok(quelle.indexOf('Neu') < quelle.indexOf('class="fuss"'));
	});

	it('der Kopf bleibt vorn, hinter der Namenszeile, wohin er auch gezogen wird', () => {
		const kopf = {
			id: 'kopf',
			ort: 'seite' as const,
			html: '<div class="kopf"><div class="titel"><h1>K</h1></div></div>',
		};
		const ablage = { nr: nrVon(BLATT, 'aufgabe', 1), wo: 'nach' as const };
		const { quelle } = fuegeBausteinAn(BLATT, kopf, ablage, nein);
		const seite = knoten(quelle, 'seite', 0);
		const klassen = seite?.kinder.map((k) => klassenVon(k)[0]);
		assert.deepEqual(klassen?.slice(0, 3), ['namenszeile', 'kopf', 'kopf']);
		assert.ok(quelle.indexOf('<h1>K</h1>') < quelle.indexOf('<h1>T</h1>'));
	});

	it('Kleines kommt im Stapel in eine neue Aufgabe und ist danach gewählt', () => {
		const uhr = { id: 'x-uhr', ort: 'aufgabe' as const, html: '<x-uhr data-zeit="3:00"></x-uhr>' };
		const { nr, quelle } = fuegeBausteinAn(BLATT, uhr, { nr: nrVon(BLATT, 'aufgabe', 0), wo: 'nach' }, nein);
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '4']);
		const neu = knoten(quelle, 'aufgabe', 1);
		assert.ok(neu && quelle.slice(neu.start, neu.ende).includes('<x-uhr'));
		assert.equal(zerlege(quelle).knoten[nr ?? -1]?.tag, 'x-uhr');
	});

	it('Aufgabenpakete kommen als Aufgabe mit ihren Teilen', () => {
		const paket = { id: 'r', ort: 'seite' as const, teile: ['<p>A</p>', '<p>B</p>'], anweisung: 'Mach' };
		const { nr, quelle } = fuegeBausteinAn(BLATT, paket, { nr: nrVon(BLATT, 'aufgabe', 1), wo: 'vor' }, nein);
		assert.deepEqual(texte(quelle).slice(0, 3), ['Eins', 'Mach', 'Zwei']);
		assert.equal(nr, nrVon(quelle, 'aufgabe', 1));
	});

	it('die Hülle für die Lücke ist dasselbe HTML', () => {
		assert.equal(huelleImStapel(NEU).html, NEU.html);
		assert.match(
			huelleImStapel({ id: 'u', ort: 'aufgabe', html: '<x-uhr></x-uhr>' }).html,
			/class="aufgabe".*<x-uhr>/,
		);
		assert.match(huelleImStapel({ id: 'z', ort: 'zeile', html: '<span>z</span>' }).html, /class="zeile"><span>z/);
	});

	it('203-06: eine Zeile im Stapel trägt ihren Satz mit, 203-12: die Lineatur die der Klasse', () => {
		const antwort = {
			id: 'antwort',
			ort: 'zeile' as const,
			html: '<span class="antwort"></span>',
			umZeile: ['Es ist ', '.'] as const,
		};
		assert.match(huelleImStapel(antwort).html, /class="zeile">Es ist <span class="antwort"><\/span>\.</);
		const lineatur = { id: 'x-lineatur', ort: 'aufgabe' as const, html: '<x-lineatur zeilen="3"></x-lineatur>' };
		const { quelle } = fuegeBausteinAn(BLATT, lineatur, { nr: nrVon(BLATT, 'aufgabe', 0), wo: 'nach' }, nein);
		assert.match(quelle, /<x-lineatur art="\d" zeilen="3">/);
	});

	it('eine unbekannte Nummer bricht ab, ohne die Quelle zu ändern', () => {
		assert.throws(() => fuegeBausteinAn(BLATT, NEU, { nr: 9999, wo: 'vor' }, nein));
	});
});

describe('Einfügen auf einer Folie zählt die Schritte neu (192-16)', () => {
	const zelle = (text: string, schritt: string) =>
		`<div class="zelle links" data-schritt="${schritt}"><b>${text}</b></div>`;
	const FOLIE = `<!doctype html><html><head><title>t</title></head>
<body class="kl3 folie">
<section class="seite">
  <div class="kopf"><div class="titel"><h1>T</h1></div></div>
  <div class="buehne"><div class="reihe" style="--spalten:1">
    ${zelle('eins', '1')}
    ${zelle('zwei', '2')}
    ${zelle('drei', '3')}
  </div></div>
</section>
<section class="seite"><div class="tipp" data-schritt="1">x</div></section>
</body></html>`;
	const folien = { jeSeite: true };
	const zellen = (quelle: string) => zerlege(quelle).knoten.filter((k) => klassenVon(k).includes('zelle'));
	const schritte = (quelle: string) => zellen(quelle).map((k) => attribut(k, 'data-schritt')?.wert);
	const zellenTexte = (quelle: string) =>
		zellen(quelle).map((k) => quelle.slice(k.start, k.ende).replace(/<[^>]+>/g, ''));
	const kopie = { id: 'ablage', ort: 'zeile' as const, html: zelle('eins', '1') };

	it('⌘V hinter die dritte Zeile: 1, 2, 3, 4', () => {
		const ziel = zellen(FOLIE)[2]?.nr ?? -1;
		const { quelle } = fuegeBausteinAn(FOLIE, kopie, { nr: ziel, wo: 'nach' }, folien);
		assert.deepEqual(schritte(quelle), ['1', '2', '3', '4']);
		assert.deepEqual(zellenTexte(quelle), ['eins', 'zwei', 'drei', 'eins']);
	});

	it('⌘V hinter die erste Zeile: Die Kopie ist Schritt 2', () => {
		const ziel = zellen(FOLIE)[0]?.nr ?? -1;
		const { quelle } = fuegeBausteinAn(FOLIE, kopie, { nr: ziel, wo: 'nach' }, folien);
		assert.deepEqual(schritte(quelle), ['1', '2', '3', '4']);
		assert.deepEqual(zellenTexte(quelle), ['eins', 'eins', 'zwei', 'drei']);
	});

	it('aus Schublade und Ablage über `fuegeBausteinEin`: ebenso fortlaufend, die andere Folie bleibt', () => {
		const ziel = zellen(FOLIE)[2]?.nr ?? -1;
		const { quelle } = fuegeBausteinEin(FOLIE, kopie, ziel, folien);
		assert.deepEqual(new Set(schritte(quelle)).size, schritte(quelle).length);
		assert.match(quelle, /<div class="tipp" data-schritt="1">x<\/div>/);
	});

	it('auf einem Blatt bleibt alles, wie es ist', () => {
		const ziel = zellen(FOLIE)[2]?.nr ?? -1;
		const { quelle } = fuegeBausteinAn(FOLIE, kopie, { nr: ziel, wo: 'nach' }, { jeSeite: false });
		assert.deepEqual(schritte(quelle), ['1', '2', '3', '1']);
	});
});
