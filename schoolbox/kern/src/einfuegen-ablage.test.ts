import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fuegeBausteinAn, huelleImStapel } from './einfuegen-ablage';
import { klassenVon, zerlege } from './quelltext';

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

	it('Rezepte kommen als Aufgabe mit ihren Teilen', () => {
		const rezept = { id: 'r', ort: 'seite' as const, teile: ['<p>A</p>', '<p>B</p>'], anweisung: 'Mach' };
		const { nr, quelle } = fuegeBausteinAn(BLATT, rezept, { nr: nrVon(BLATT, 'aufgabe', 1), wo: 'vor' }, nein);
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

	it('eine unbekannte Nummer bricht ab, ohne die Quelle zu ändern', () => {
		assert.throws(() => fuegeBausteinAn(BLATT, NEU, { nr: 9999, wo: 'vor' }, nein));
	});
});
