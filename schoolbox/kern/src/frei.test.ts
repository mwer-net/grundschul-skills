import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { istEinElement, neueFunde, pruefeFreiesHtml } from './frei';
import { markiere, zerlege } from './quelltext';

const SKILL = path.resolve(__dirname, '..', '..', '..', 'skills', 'html-materialerstellung');

const SVG = '<svg viewBox="0 0 10 10" width="100"><polygon points="0,0 10,0 5,5" fill="none" stroke="#000"/></svg>';

const gesperrt = (name: string, html: string) =>
	it(`sperrt: ${name}`, () => {
		assert.notEqual(pruefeFreiesHtml(html).length, 0, html);
	});

const erlaubt = (name: string, html: string) =>
	it(`erlaubt: ${name}`, () => {
		assert.deepEqual(
			pruefeFreiesHtml(html).map((f) => f.text),
			[],
			html,
		);
	});

describe('pruefeFreiesHtml: was bleibt', () => {
	erlaubt('SVG mit viewBox', SVG);
	erlaubt(
		'figure mit Kennzeichnung',
		`<figure data-frei data-frei-titel="Tangram Waschbär">${SVG}<figcaption>Text</figcaption></figure>`,
	);
	erlaubt(
		'style-Attribut',
		'<div style="color:red;width:calc(100% - 2px);background:linear-gradient(#000,#fff)">x</div>',
	);
	erlaubt('style-Element', '<style>.a{color:rgb(0,0,0)}.a:not(.b){margin:0}@media print{.a{color:#000}}</style>');
	erlaubt(
		'use auf eine Stelle im Blatt',
		'<svg><defs><path id="a" d="M0 0"/></defs><use href="#a"/><use xlink:href="#a"/></svg>',
	);
	erlaubt(
		'Muster als Attribut',
		'<svg><defs><pattern id="m" width="4" height="4"/></defs><rect fill="url(#m)" stroke="url(#m)" width="4" height="4"/></svg>',
	);
	erlaubt('Bild aus der Mappe', '<img src="../../bilder/wilma.png" alt="Wilma">');
	erlaubt('eingebettetes Pixelbild', '<img src="data:image/png;base64,iVBORw0KGgo=" alt="">');
	erlaubt('Sprung im Blatt', '<a href="#oben">Oben</a>');
	erlaubt('eigene Abbildung aus dem Katalog', '<x-uhr zeit="4:30" groesse="88" class="a" data-name="Uhr"></x-uhr>');
	erlaubt('Kommentar mit Tags darin', '<!-- <x-uhr> Beispiel: 1 < 2 --><p>a < b</p>');
	erlaubt(
		'Doctype und Rahmen',
		'<!doctype html><html lang="de"><head><title>A &amp; B</title></head><body class="kl2"><p>x</p></body></html>',
	);
	erlaubt(
		'Tabelle',
		'<table><thead><tr><th scope="col" colspan="2">a</th></tr></thead><tr><td rowspan="1">b</td></tr></table>',
	);
	erlaubt('geschlossenes SVG-Element', '<svg><circle cx="1" cy="1" r="1"/></svg><p>x</p>');
	erlaubt(
		'Entitäten aus dem Alltag',
		'<div title="K&auml;fer &amp; Co &#8211; 3 &lt; 4 und A & B" class="a">x</div>',
	);
	erlaubt(
		'Text in SVG mit Titel',
		'<svg><title>Waschbär</title><desc>Umriss</desc><text x="1" y="1">Hallo <tspan>du</tspan></text></svg>',
	);
});

describe('pruefeFreiesHtml: die Sperren aus Entscheidung 38', () => {
	gesperrt('script', '<script>alert(1)</script>');
	gesperrt('script mit Quelle', '<script src="https://boese.example/a.js"></script>');
	gesperrt('script in anderer Schreibung', '<ScRiPt>alert(1)</sCrIpT>');
	gesperrt('script mit Leerzeichen vor dem Ende', '<script >alert(1)</script >');
	gesperrt('onclick', '<div onclick="alert(1)">x</div>');
	gesperrt('onclick in anderer Schreibung', '<div OnClIcK="alert(1)">x</div>');
	gesperrt('Ereignis ohne Wert', '<div onmouseover>x</div>');
	gesperrt('javascript in href', '<a href="javascript:alert(1)">x</a>');
	gesperrt('fremde Adresse in href', '<a href="https://boese.example/">x</a>');
	gesperrt('Adresse ohne Schema', '<a href="//boese.example/">x</a>');
	for (const tag of [
		'iframe',
		'object',
		'embed',
		'form',
		'base',
		'meta',
		'link',
		'audio',
		'video',
		'source',
		'applet',
	]) {
		gesperrt(tag, `<${tag} src="a" href="a"></${tag}>`);
	}
	for (const tag of [
		'button',
		'input',
		'select',
		'textarea',
		'details',
		'dialog',
		'template',
		'noscript',
		'math',
		'plaintext',
		'xmp',
		'marquee',
	]) {
		gesperrt(tag, `<${tag}>x</${tag}>`);
	}
	gesperrt('style mit @import', '<style>@import "https://boese.example/a.css";</style>');
	gesperrt('style-Element mit url', '<style>.a{background:url(http://boese.example/x.png)}</style>');
	gesperrt('style-Attribut mit url', '<div style="background:url(http://boese.example/x.png)">x</div>');
	gesperrt('style mit expression', '<div style="width:expression(alert(1))">x</div>');
	gesperrt('fremdes Bild', '<img src="https://boese.example/x.png">');
	gesperrt('Bild mit Rückstrich', '<img src="\\\\boese.example\\x.png">');
	gesperrt('Bild als SVG-Daten', '<img src="data:image/svg+xml;base64,PHN2Zz4=">');
	gesperrt('eigener x-Name', '<x-waschbaer></x-waschbaer>');
});

describe('pruefeFreiesHtml: SVG kommt nicht an der Liste vorbei', () => {
	gesperrt('script im SVG', '<svg><script>alert(1)</script></svg>');
	gesperrt(
		'style im SVG liest der Browser anders',
		'<svg><style>@im&#112;ort "https://boese.example/a.css";</style></svg>',
	);
	gesperrt('onload am SVG', '<svg onload="alert(1)"></svg>');
	gesperrt('Ereignis an einer Form', '<svg><rect onmouseover="alert(1)"/></svg>');
	gesperrt('foreignObject', '<svg><foreignObject><div>x</div></foreignObject></svg>');
	gesperrt('foreignobject klein', '<svg><foreignobject></foreignobject></svg>');
	gesperrt('HTML im SVG', '<svg><div>x</div></svg>');
	gesperrt('Bild im SVG', '<svg><img src="x.png"></svg>');
	gesperrt('image', '<svg><image href="https://boese.example/x.png"/></svg>');
	gesperrt('feImage', '<svg><filter id="f"><feImage href="https://boese.example/x.png"/></filter></svg>');
	gesperrt('animate setzt Attribute', '<svg><a><animate attributeName="href" to="javascript:alert(1)"/></a></svg>');
	gesperrt('set setzt Attribute', '<svg><set attributeName="onclick" to="alert(1)"/></svg>');
	gesperrt('a im SVG', '<svg><a href="#a"><text>x</text></a></svg>');
	gesperrt('use mit fremder Adresse', '<svg><use href="https://boese.example/x.svg#a"/></svg>');
	gesperrt('use mit xlink und Daten', '<svg><use xlink:href="data:image/svg+xml;base64,PHN2Zz4=#a"/></svg>');
	gesperrt('use auf eine Datei', '<svg><use href="x.svg#a"/></svg>');
	gesperrt('use mit XLINK groß', '<svg><use XLINK:HREF="https://boese.example/x.svg#a"/></svg>');
	gesperrt('use ohne Anführungszeichen', '<svg><use href=https://boese.example/x.svg#a /></svg>');
	gesperrt('href an einer Form', '<svg><rect href="#a"/></svg>');
	gesperrt('xlink:href an einem Text', '<svg><text xlink:href="javascript:alert(1)">x</text></svg>');
	gesperrt('fill mit fremder url', '<svg><rect fill="url(https://boese.example/x.svg#a)"/></svg>');
	gesperrt('mask mit fremder url', '<svg><rect mask="url(//boese.example/x.svg#a)"/></svg>');
	gesperrt('url in einem anderen Attribut', '<svg><rect stroke-width="url(https://boese.example/x)"/></svg>');
	gesperrt('url im style einer Form', '<svg><rect style="fill:url(https://boese.example/x.svg#a)"/></svg>');
	gesperrt('xml:base', '<svg xml:base="https://boese.example/"></svg>');
	gesperrt('fremder Namensraum', '<svg xmlns="https://boese.example/"></svg>');
	gesperrt('Skript im Titel', '<svg><title><script>alert(1)</script></title></svg>');
	gesperrt('HTML im Titel', '<svg><title><img src=x onerror=alert(1)></title></svg>');
	gesperrt('HTML in der Beschreibung', '<svg><desc><p>x</p></desc></svg>');
});

describe('pruefeFreiesHtml: Umgehungen', () => {
	gesperrt('Schrägstrich statt Leerzeichen', '<svg/onload=alert(1)>');
	gesperrt('Schrägstriche im Bild', '<img/src=x/onerror=alert(1)>');
	gesperrt('Anführungszeichen vor dem Attribut', '<div " onclick=alert(1)>x</div>');
	gesperrt('offenes Anführungszeichen', '<div title="a> <div title=" onclick=alert(1) x=">x</div>');
	gesperrt('kein Leerzeichen nach dem Wert', '<div title="a"onclick="alert(1)">x</div>');
	gesperrt('geschütztes Leerzeichen im Tag', '<img src=x onerror=alert(1)>');
	gesperrt('Nullzeichen im Namen', '<scr\0ipt>alert(1)</scr\0ipt>');
	gesperrt('Tag ohne Ende am Schluss', '<div onclick="alert(1)"');
	gesperrt('Attribute am End-Tag', '<div>x</div onclick="alert(1)">');
	gesperrt('javascript mit Zahl-Entität', '<a href="&#106;avascript:alert(1)">x</a>');
	gesperrt('javascript ohne Semikolon', '<a href="&#106avascript:alert(1)">x</a>');
	gesperrt('javascript mit Hex', '<a href="java&#x73;cript:alert(1)">x</a>');
	gesperrt('javascript mit benannter Entität', '<a href="javascript&colon;alert(1)">x</a>');
	gesperrt('Tab und Zeile im Schema', '<a href="java&Tab;script:alert(1)">x</a>');
	gesperrt('Tab direkt im Schema', '<a href="java\tscript:alert(1)">x</a>');
	gesperrt('Leerzeichen vor dem Schema', '<a href=" javascript:alert(1)">x</a>');
	gesperrt('url mit Zahl-Entität im style', '<div style="background:&#117;rl(http://boese.example/x)">x</div>');
	gesperrt('url mit benannter Klammer', '<div style="background:url&lpar;http://boese.example/x&rpar;">x</div>');
	gesperrt('url in anderer Schreibung', '<div style="background:URL(http://boese.example/x)">x</div>');
	gesperrt('url mit CSS-Escape', '<div style="background:u\\72l(http://boese.example/x)">x</div>');
	gesperrt('@import mit CSS-Escape', '<style>@\\69mport "https://boese.example/a.css";</style>');
	gesperrt('@import mit Kommentar', '<style>@/**/import "https://boese.example/a.css";</style>');
	gesperrt('@import in anderer Schreibung', '<style>@IMPORT "https://boese.example/a.css";</style>');
	gesperrt('@font-face', '<style>@font-face{font-family:a;src:local(a)}</style>');
	gesperrt(
		'image-set ohne url',
		'<div style="background:image-set(&quot;https://boese.example/x.png&quot; 1x)">x</div>',
	);
	gesperrt('falsches Ende von style', '<style>a{}</stylex>@import "https://boese.example/a.css";</style>');
	gesperrt('offener CSS-Kommentar', '<style>a{}/* </style>');
	gesperrt('style ohne Ende', '<style>a{}');
	gesperrt('behavior', '<div style="behavior:foo">x</div>');
	gesperrt('javascript in CSS', '<div style="width:javascript:alert(1)">x</div>');
	gesperrt('Kommentar endet früh mit >', '<!--><script>alert(1)</script>-->');
	gesperrt('Kommentar endet früh mit ->', '<!---><img src=x onerror=alert(1)>-->');
	gesperrt('Kommentar endet mit --!>', '<!-- --!><script>alert(1)</script>-->');
	gesperrt('Kommentar ohne Ende', '<!-- <p>x</p>');
	gesperrt('CDATA', '<svg><![CDATA[><script>alert(1)</script>]]></svg>');
	gesperrt('Entity-Deklaration', '<!DOCTYPE html [<!ENTITY a "b">]>');
	gesperrt('Verarbeitungsanweisung', '<?xml version="1.0"?>');
	gesperrt('unbekannte Attribute', '<div srcdoc="x" formaction="y" background="z.png">x</div>');
	gesperrt('Wert einer Abbildung beginnt ein Tag', '<x-uhr zeit="&lt;img src=x onerror=alert(1)&gt;"></x-uhr>');
	gesperrt('Wert einer Abbildung schließt ein Attribut', '<x-uhr zeit="&quot; onload=&quot;alert(1)"></x-uhr>');
	gesperrt('Ereignis an einer Abbildung', '<x-uhr onclick="alert(1)"></x-uhr>');
	gesperrt('unbekanntes Attribut an einer Abbildung', '<x-uhr href="https://boese.example/"></x-uhr>');
	gesperrt('zu große Entität', '<div title="&#x110000;">x</div>');
	gesperrt('Nullzeichen als Entität', '<a href="#a&#0;">x</a>');
});

describe('Der Zerleger lässt freies SVG, wie es ist', () => {
	it('Groß- und Kleinschreibung bleibt beim Markieren', () => {
		const html =
			'<svg viewBox="0 0 1 1"><clipPath id="a"><linearGradient gradientUnits="userSpaceOnUse"/></clipPath></svg>';
		const markiert = markiere(zerlege(html));
		assert.match(markiert, /viewBox="0 0 1 1"/);
		assert.match(markiert, /<clipPath /);
		assert.match(markiert, /<linearGradient /);
		assert.match(markiert, /gradientUnits=/);
	});
});

describe('neueFunde: nur was dazukam (Entscheidung 26)', () => {
	const BESTAND =
		'<head><script src="abbildungen.js"></script><link rel="stylesheet" href="blatt.css"><style>.a{background:url(x.png)}</style></head><body><div onclick="f()">Tipp</div></body>';

	it('Tippkorrektur im Blatt mit Skript, Link und Ereignis', () => {
		assert.notEqual(pruefeFreiesHtml(BESTAND).length, 0);
		assert.deepEqual(neueFunde(BESTAND, BESTAND.replace('Tipp', 'Tipp!')), []);
	});

	it('Eine Kopie des alten Skripts ist neu', () => {
		const neu = BESTAND.replace('</body>', '<script src="abbildungen.js"></script></body>');
		assert.equal(neueFunde(BESTAND, neu).length, 1);
	});

	it('Verschoben ist nicht neu', () => {
		const neu = BESTAND.replace('<script src="abbildungen.js"></script>', '').replace(
			'</body>',
			'<script src="abbildungen.js"></script></body>',
		);
		assert.deepEqual(neueFunde(BESTAND, neu), []);
	});

	it('Ein geändertes Skript ist neu', () => {
		const alt = '<script>a()</script><p>x</p>';
		assert.equal(neueFunde(alt, '<script>b()</script><p>x</p>').length, 1);
	});

	it('Inhalt in einem alten leeren Skript ist neu', () => {
		const neu = BESTAND.replace(
			'<script src="abbildungen.js"></script>',
			'<script src="abbildungen.js">alert(1)</script>',
		);
		assert.notEqual(neueFunde(BESTAND, neu).length, 0);
	});

	it('Ein neues Ereignis am selben Element ist neu', () => {
		assert.notEqual(neueFunde(BESTAND, BESTAND.replace('<div onclick="f()">', '<div onclick="g()">')).length, 0);
	});

	it('Im Bestand-CSS eine andere Regel ändern geht, fremde dazu nicht', () => {
		const anders = BESTAND.replace('.a{', '.b{color:#000}.a{');
		assert.deepEqual(neueFunde(BESTAND, anders), []);
		const fremd = BESTAND.replace('.a{', '.b{background:url(https://boese.example/x)}.a{');
		assert.equal(neueFunde(BESTAND, fremd).length, 1);
	});

	it('Altes Tag im SVG liest der Browser anders: neu', () => {
		const alt = '<script>a()</script><svg></svg>';
		assert.notEqual(neueFunde(alt, '<svg><script>a()</script></svg>').length, 0);
	});

	it('Was im alten Kommentar stand, ist neu, wenn der Kommentar weg ist', () => {
		const alt = '<!-- <script>a()</script> --><p>x</p>';
		assert.deepEqual(pruefeFreiesHtml(alt), []);
		assert.equal(neueFunde(alt, '<script>a()</script><p>x</p>').length, 1);
	});

	it('Saubere Änderung am sauberen Blatt', () => {
		assert.deepEqual(neueFunde('<p>x</p>', `<p>x</p>${SVG}`), []);
	});
});

describe('Vorhandenes Material besteht die Prüfung', () => {
	const htmlIn = (ordner: string) =>
		readdirSync(ordner)
			.filter((n) => n.endsWith('.html'))
			.map((n) => path.join(ordner, n));
	const dateien = [...htmlIn(path.join(SKILL, 'assets')), ...htmlIn(path.join(SKILL, 'assets', 'muster'))];

	it('Vorlagen und Muster: Der Kopf mit seinen drei Tags ist Bestand, alles andere geht', () => {
		assert.ok(dateien.length > 20);
		for (const datei of dateien) {
			const funde = pruefeFreiesHtml(readFileSync(datei, 'utf8')).filter(
				(f) => !/^Das Element <(?:meta|link|script)> ist nicht erlaubt$/.test(f.text),
			);
			assert.deepEqual(funde, [], datei);
		}
	});

	it('Das Beispiel aus dem Skill', () => {
		const katalog = readFileSync(path.join(SKILL, 'references', 'abbildungen.md'), 'utf8');
		const beispiel = /<!-- frei-beispiel -->\n```html\n([\s\S]*?)```/.exec(katalog)?.[1];
		assert.ok(beispiel);
		assert.deepEqual(pruefeFreiesHtml(beispiel), []);
		assert.equal(istEinElement(beispiel), true);
		assert.match(beispiel, /data-frei /);
		assert.match(beispiel, /data-frei-titel=/);
	});
});

describe('istEinElement', () => {
	const eins = (html: string, wert: boolean) =>
		it(`${wert ? 'ja' : 'nein'}: ${html}`, () => assert.equal(istEinElement(html), wert));
	eins('<figure data-frei><svg></svg></figure>', true);
	eins('  <div>x</div>\n', true);
	eins('<svg data-frei/>', true);
	eins('<hr>', true);
	eins('<div>x</div><div>y</div>', false);
	eins('<div>x</div> Text', false);
	eins('Text <div>x</div>', false);
	eins('Text', false);
	eins('', false);
	eins('<div>x', false);
	eins('<div><div>x</div>', false);
	eins('<div>x</div></div>', false);
	eins('<p>a<div>b</div>', false);
});
