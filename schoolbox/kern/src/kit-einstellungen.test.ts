import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { leseBlatt, leseKit, leseSichtbarkeit, setzeBlatt, setzeKit, setzeSichtbarkeit } from './kit-einstellungen';
import { klassenVon, zerlege } from './quelltext';

const BLATT = `<!doctype html><html><head><title>Alt</title></head>
<body class="kl2 farbe palette-himmel">
<section class="seite">
  <div class="namenszeile"></div>
  <div class="kopf"><div class="titel"><h1>T</h1></div></div>
  <div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">A</span></div><div class="koerper">
    <div class="schreiblinie"></div>
    <div class="malfeld" style="--h:90px"></div>
    <span class="antwort breit" data-l="7"></span>
    <span class="box"></span>
    <p>Absatz</p>
  </div></div>
  <div class="aufgabe"><span class="nr">2</span><div class="anw"><span class="text">B</span></div><div class="koerper"></div></div>
</section>
</body></html>
`;
const nr = (q: string, klasse: string, i = 0) =>
	zerlege(q).knoten.filter((k) => klassenVon(k).includes(klasse))[i]?.nr ?? -1;
const tag = (q: string, t: string) => zerlege(q).knoten.find((k) => k.tag === t)?.nr ?? -1;
const n = (q: string, s: string) => q.split(s).length - 1;

describe('Einstellungen der Kit-Bausteine', () => {
	it('Schreiblinie: Anzahl vermehrt und mindert, Abstand gilt für die ganze Folge, Grenzen greifen', () => {
		const k = nr(BLATT, 'schreiblinie');
		const drei = setzeKit(BLATT, k, 'schreiblinie', 'anzahl', 3);
		assert.equal(n(drei, 'class="schreiblinie"'), 3);
		assert.equal(leseKit(drei, k, 'schreiblinie').anzahl, 3);
		assert.equal(n(setzeKit(drei, k, 'schreiblinie', 'anzahl', 1), 'class="schreiblinie"'), 1);
		assert.equal(n(setzeKit(BLATT, k, 'schreiblinie', 'anzahl', 99), 'class="schreiblinie"'), 12);
		assert.equal(n(setzeKit(drei, k, 'schreiblinie', 'abstand', 40), 'height:40px'), 3);
	});

	it('Malfeld, Antwort und Kästchen wirken genau auf ihr Element', () => {
		const hoch = setzeKit(BLATT, nr(BLATT, 'malfeld'), 'malfeld', 'hoehe', 200);
		assert.match(hoch, /class="malfeld" style="--h:200px"/);
		assert.equal(hoch.replace('--h:200px', '--h:90px'), BLATT);
		const a = nr(BLATT, 'antwort');
		assert.equal(leseKit(BLATT, a, 'antwort').breite, 'breit');
		assert.match(setzeKit(BLATT, a, 'antwort', 'breite', 'kurz'), /class="antwort kurz"/);
		assert.match(setzeKit(BLATT, a, 'antwort', 'loesung', '9'), /data-l="9"/);
		assert.doesNotMatch(setzeKit(BLATT, a, 'antwort', 'loesung', ''), /data-l/);
		assert.match(setzeKit(BLATT, nr(BLATT, 'box'), 'box', 'groesse', 30), /width:30px;height:30px/);
	});

	it('Aufgabe: Niveau, Punkte, Sternchen; die Nummern folgen', () => {
		const a = nr(BLATT, 'aufgabe');
		const niv = setzeKit(BLATT, a, 'aufgabe', 'niveau', 2);
		assert.equal(n(niv, '<i></i>'), 2);
		assert.equal(leseKit(niv, a, 'aufgabe').niveau, 2);
		assert.equal(setzeKit(niv, a, 'aufgabe', 'niveau', 0), BLATT);
		const p = setzeKit(BLATT, a, 'aufgabe', 'punkte', 4);
		assert.match(p, /<span class="punkte">\(4 P\.\)<\/span>/);
		assert.equal(leseKit(p, a, 'aufgabe').punkte, 4);
		const stern = setzeKit(BLATT, a, 'aufgabe', 'stern', true);
		assert.match(stern, /nr stern">★/);
		assert.match(stern, /class="nr">1<\/span><div class="anw"><span class="text">B/);
	});

	it('Kopf: Lernziel und Namenszeile an und aus', () => {
		const k = nr(BLATT, 'kopf');
		const mit = setzeKit(BLATT, k, 'kopf', 'ziel', true);
		assert.match(mit, /class="ziel"/);
		assert.equal(setzeKit(mit, k, 'kopf', 'ziel', false), BLATT);
		const ohne = setzeKit(BLATT, k, 'kopf', 'namenszeile', false);
		assert.doesNotMatch(ohne, /namenszeile/);
		assert.match(setzeKit(ohne, nr(ohne, 'kopf'), 'kopf', 'namenszeile', true), /namenszeile/);
	});

	it('Absatz wird Liste und zurück, der Inhalt bleibt', () => {
		const liste = setzeKit(BLATT, tag(BLATT, 'p'), 'absatz', 'liste', true);
		assert.match(liste, /<ul><li>Absatz<\/li><\/ul>/);
		assert.equal(setzeKit(liste, tag(liste, 'li'), 'absatz', 'liste', false), BLATT);
	});

	it('Sichtbarkeit: genau eine Klasse, wieder entfernbar', () => {
		const a = nr(BLATT, 'aufgabe');
		const nurL = setzeSichtbarkeit(BLATT, a, 'loesung');
		assert.equal(leseSichtbarkeit(nurL, a), 'loesung');
		const nurA = setzeSichtbarkeit(nurL, a, 'arbeitsblatt');
		assert.match(nurA, /class="aufgabe nicht-loesung"/);
		assert.equal(setzeSichtbarkeit(nurA, a, ''), BLATT);
	});
});

describe('Ganzes Blatt', () => {
	it('liest und ändert genau das Genannte', () => {
		assert.deepEqual(leseBlatt(BLATT), {
			titel: 'Alt',
			klasse: 2,
			palette: 'himmel',
			format: 'a4-hoch',
			trenner: false,
			punkte: true,
		});
		const klasse = setzeBlatt(BLATT, { klasse: 4 });
		assert.equal(klasse, BLATT.replace('kl2', 'kl4'));
		assert.equal(setzeBlatt(BLATT, { palette: 'wiese' }), BLATT.replace('palette-himmel', 'palette-wiese'));
		assert.equal(setzeBlatt(BLATT, { format: 'a4-quer' }).includes('palette-himmel a4-quer'), true);
		assert.equal(setzeBlatt(setzeBlatt(BLATT, { format: 'a4-quer' }), { format: 'a4-hoch' }), BLATT);
		assert.equal(setzeBlatt(BLATT, { trenner: true }), BLATT.replace('palette-himmel"', 'palette-himmel trenner"'));
		assert.match(setzeBlatt(BLATT, { titel: 'Neu & gut' }), /<title>Neu &amp; gut<\/title>/);
		assert.equal(leseBlatt(setzeBlatt(BLATT, { klasse: 'gemischt' })).klasse, 'gemischt');
	});
});

describe('Tabelle: Klassen und Lösung', () => {
	const T = '<body><table class="kit-tabelle"><tbody><tr><td>a</td></tr></tbody></table></body>';
	const kn = (q: string, tagName: string) => zerlege(q).knoten.find((k) => k.tag === tagName)?.nr ?? -1;
	it('setzt die Klassen einzeln und nimmt sie wieder weg', () => {
		const t = kn(T, 'table');
		const a = setzeKit(T, t, 'tabelle', 'zeilenhoehe', 'kompakt');
		assert.match(a, /class="kit-tabelle kompakt"/);
		assert.match(setzeKit(a, t, 'tabelle', 'zeilenhoehe', 'schreibzeilen'), /class="kit-tabelle schreibzeilen"/);
		assert.equal(setzeKit(a, t, 'tabelle', 'zeilenhoehe', ''), T);
		assert.equal(setzeKit(setzeKit(T, t, 'tabelle', 'kopfspalte', true), t, 'tabelle', 'kopfspalte', false), T);
		assert.match(setzeKit(T, kn(T, 'td'), 'tabellenzelle', 'loesung', '4'), /<td data-l="4">/);
	});
});
