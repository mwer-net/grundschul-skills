import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bausteinNach, kann, kannImFormat } from './bausteine';
import { klassenVon, zerlege } from './quelltext';
import { bausteinVonKnoten, pfadVon } from './referenz';

describe('kannImFormat', () => {
	const seite = bausteinNach('seite');
	const aufgabe = bausteinNach('aufgabe');
	assert.ok(seite && aufgabe);

	it('lässt die Seiten eines Mini-Books ordnen, aber nicht vermehren oder löschen', () => {
		assert.equal(kannImFormat(seite, 'ordnen', 'minibuch'), true);
		assert.equal(kannImFormat(seite, 'hinzufuegen', 'minibuch'), false);
		assert.equal(kannImFormat(seite, 'duplizieren', 'minibuch'), false);
		assert.equal(kannImFormat(seite, 'loeschen', 'minibuch'), false);
	});

	it('ändert nichts an anderen Formaten und anderen Bausteinen', () => {
		assert.equal(kannImFormat(seite, 'loeschen', 'a4-hoch'), true);
		assert.equal(kannImFormat(seite, 'hinzufuegen', 'folie'), true);
		assert.equal(kannImFormat(aufgabe, 'loeschen', 'minibuch'), true);
	});
});

describe('Freies Element (Entscheidung 38)', () => {
	const treffer = (html: string) => {
		const z = zerlege(`<!doctype html><html><body class="kl3 sw"><div class="seite">${html}</div></body></html>`);
		const k = z.knoten.find((n) => n.attribute.some((a) => a.name === 'data-frei'));
		assert.ok(k);
		return { b: bausteinVonKnoten(k, false), z, k };
	};

	it('figure, svg und Tabelle sind freie Elemente, nicht Tabelle oder Block', () => {
		for (const html of [
			'<figure data-frei><svg></svg></figure>',
			'<svg data-frei></svg>',
			'<div data-frei><div>a</div><div>b</div></div>',
			'<table data-frei><tr><td>a</td></tr></table>',
		]) {
			assert.equal(treffer(html).b?.art, 'freieselement', html);
		}
	});

	it('kann ordnen, duplizieren, löschen, aber keine Einstellungen', () => {
		const { b } = treffer('<svg data-frei></svg>');
		assert.ok(b);
		assert.deepEqual([...b.faehigkeiten], ['ordnen', 'duplizieren', 'loeschen']);
	});

	it('Text im div geht wie bei freiem Material, Text im SVG nicht', () => {
		const { b } = treffer('<div data-frei>Text</div>');
		assert.equal(b?.art, 'freiestext');
		assert.equal(b && kann(b, 'text'), true);
		const svg = treffer('<svg data-frei><text>Text</text></svg>').b;
		assert.equal(svg && kann(svg, 'text'), false);
		const figur = treffer('<figure data-frei><svg><text>Text</text></svg></figure>').b;
		assert.equal(figur && kann(figur, 'text'), false);
	});

	it('Der Name kommt aus data-frei-titel, sonst „Freies Element“, auch im Pfad für den Auftrag', () => {
		const benannt = treffer('<figure data-frei data-frei-titel="Tangram Waschbär"><svg></svg></figure>');
		assert.deepEqual(
			pfadVon(benannt.z, benannt.k.nr, false).map((s) => s.name),
			['Seite 1', 'Tangram Waschbär'],
		);
		const ohne = treffer('<svg data-frei></svg>');
		assert.deepEqual(
			pfadVon(ohne.z, ohne.k.nr, false).map((s) => s.name),
			['Seite 1', 'Freies Element'],
		);
	});
});

describe('Frei gestaltetes Material (054)', () => {
	const artVon = (html: string, klasse: string, loesung = false) => {
		const z = zerlege(`<!doctype html><html><body class="kl3 sw"><div class="seite">${html}</div></body></html>`);
		const k = z.knoten.find((n) => klassenVon(n).includes(klasse));
		assert.ok(k, klasse);
		return bausteinVonKnoten(k, loesung)?.art;
	};

	it('macht Text ohne Block darunter bearbeitbar, leere Hüllen und Bilder aber nicht', () => {
		assert.equal(artVon('<div class="a">Fall 8</div>', 'a'), 'freitext');
		assert.equal(artVon('<div class="a"><b>Fall</b> 8 <span>heute</span></div>', 'a'), 'freitext');
		assert.equal(artVon('<table><tr><td class="a" colspan="2">x</td></tr></table>', 'a'), 'freitext');
		assert.equal(artVon('<div class="r"><div class="a"></div><p>x</p></div>', 'a'), 'block');
		assert.equal(artVon('<div class="r"><div class="a"> &nbsp; </div><p>x</p></div>', 'a'), 'block');
		assert.equal(artVon('<div class="r"><div class="a"><img src="x.png"></div><p>x</p></div>', 'a'), 'block');
		assert.equal(artVon('<h4 class="a">Titel</h4>', 'a'), 'freitext');
		assert.equal(artVon('<figure><figcaption class="a">Bild 1</figcaption></figure>', 'a'), 'freitext');
	});

	it('nimmt nur den äußeren Textträger, nicht die Stücke darin', () => {
		assert.equal(artVon('<div>Fall <span class="a">8</span></div>', 'a'), undefined);
		assert.equal(artVon('<p>Fall <b><i class="a">8</i></b></p>', 'a'), undefined);
		assert.equal(artVon('<div><span class="a">Text</span><div>Block</div></div>', 'a'), 'freitext');
	});

	it('lässt alles Geschützte in Ruhe: Abbildungen samt Inhalt, Nummern, Lösungen', () => {
		assert.equal(artVon('<x-uhr class="a">12</x-uhr>', 'a'), 'abbildung');
		assert.equal(artVon('<x-uhr><div class="a">12</div></x-uhr>', 'a'), undefined);
		assert.equal(artVon('<x-uhr><span class="a">12</span></x-uhr>', 'a'), undefined);
		assert.equal(artVon('<div class="nr a">1</div>', 'a'), 'block');
		assert.equal(artVon('<div class="b"><span class="nr a">1</span><div>x</div></div>', 'a'), 'block');
		assert.equal(artVon('<div class="nur-loesung"><div class="a">42</div></div>', 'a'), undefined);
		assert.equal(
			artVon('<div class="b">Wort <span class="a" data-l="42">x</span><div>y</div></div>', 'a'),
			undefined,
		);
	});

	it('der Inhalt fester Bausteine bleibt, wie er ist', () => {
		assert.equal(
			artVon('<div class="aufgabe a"><div class="anw"><span class="text">x</span></div></div>', 'a'),
			'aufgabe',
		);
		assert.equal(artVon('<div class="anw a"><span class="text">Lies.</span></div>', 'a'), 'block');
		assert.equal(
			artVon('<div class="b"><div class="anw a"><span class="text">Lies.</span></div><p>x</p></div>', 'a'),
			'block',
		);
		assert.equal(artVon('<p class="a">Text</p>', 'a'), 'absatz');
	});

	it('Blöcke: direkte Kinder der Seite und einfacher Rahmen, nicht tiefer', () => {
		assert.equal(artVon('<div class="a"><p>x</p></div>', 'a'), 'block');
		assert.equal(artVon('<ul class="a"><li>x</li></ul>', 'a'), 'block');
		assert.equal(artVon('<div class="r"><div class="a"><p>x</p></div></div>', 'a'), 'block');
		assert.equal(artVon('<div class="r">Text<div class="a"><p>x</p></div></div>', 'a'), undefined);
		assert.equal(artVon('<div class="reihe"><section class="a"><p>x</p></section></div>', 'a'), undefined);
		assert.equal(
			artVon('<div><div><div><div><div class="a"><p>x</p></div></div></div></div></div>', 'a'),
			undefined,
		);
		assert.equal(artVon('<style class="a">p{}</style>', 'a'), undefined);
	});

	it('Tabellen: einfache wie die Kit-Tabelle, verbundene oder beschriftete nur als Block mit Zellentext', () => {
		const einfach = (zelle: string) =>
			`<table class="t"><tr class="z"><td>1</td>${zelle}</tr><tr><td>2</td><td>3</td></tr></table>`;
		assert.equal(artVon(einfach('<td class="c">x</td>'), 't'), 'tabelle');
		assert.equal(artVon(einfach('<td class="c">x</td>'), 'z'), 'tabellenzeile');
		assert.equal(artVon(einfach('<td class="c">x</td>'), 'c'), 'tabellenzelle');
		assert.equal(artVon(einfach('<td class="c" colspan="2">x</td>'), 't'), 'block');
		assert.equal(artVon(einfach('<td class="c" colspan="2">x</td>'), 'z'), undefined);
		assert.equal(artVon(einfach('<td class="c" colspan="2">x</td>'), 'c'), 'freitext');
		assert.equal(artVon(einfach('<td class="c" colspan="1">x</td>'), 't'), 'tabelle');
		assert.equal(artVon('<table class="t"><caption>Plan</caption><tr><td>1</td></tr></table>', 't'), 'block');
		assert.equal(artVon('<table class="t"><tr><td>1</td></tr><tr><td>1</td><td>2</td></tr></table>', 't'), 'block');
		assert.equal(artVon('<table class="t"><tr><td class="c"><div>x</div></td></tr></table>', 'c'), undefined);
		assert.equal(
			artVon('<table class="kit-tabelle"><thead><tr class="z"><th>x</th></tr></thead></table>', 'z'),
			undefined,
		);
	});
});
