import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	einfuegbarAus,
	fuegeBausteinEin,
	fuegeZusatzEin,
	kannAnschliessen,
	kannUmbrechenVor,
	klasseDesBlatts,
	mitLineaturDerKlasse,
	neueAufgabe,
	schliesseAn,
	schonDa,
	seiteZumAnschliessen,
	umbruchVor,
} from './einfuegen';
import { blaetterVon } from './fluss';
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

describe('Einfügen nach 203', () => {
	const starter = leseStarter();
	const aus = (id: string) => {
		const e = KATALOG.find((k) => k.id === id);
		assert.ok(e, id);
		return einfuegbarAus(e, starter);
	};
	const KARTEN = BLATT.replace(
		'<div class="aufgabe">\n    <span class="nr stern">',
		'<div class="karten"><div class="karte"><div class="kartentext">K</div></div></div>\n  <div class="aufgabe">\n    <span class="nr stern">',
	);
	const FOLIEN = `<!doctype html><html><head><title>t</title></head><body class="kl3 farbe folie">
<section class="seite"><div class="kopf"><div class="titel"><h1>Eins</h1></div></div><p class="text">Inhalt</p><aside class="notiz">N</aside></section>
<section class="seite"><div class="kopf"><div class="titel"><h1>Zwei</h1></div></div><aside class="notiz">N</aside></section>
</body></html>`;
	const folien = (q: string) => zerlege(q).knoten.filter((k) => klassenVon(k).includes('seite'));
	const jeSeite = { jeSeite: true };

	it('203-03: in eine gewählte Karte, nicht lose daneben in den Kartenbogen', () => {
		const karte = nrVon(KARTEN, 'kartentext');
		const { quelle } = fuegeBausteinEin(KARTEN, aus('x-uhr'), karte, n);
		const k = zerlege(quelle).knoten.find((x) => klassenVon(x).includes('karte'));
		assert.ok(k?.kinder.some((c) => c.tag === 'x-uhr'));
		assert.equal(quelle.match(/class="karte"/g)?.length, 1);
	});

	it('203-14: Kopf, Namenszeile und Selbsteinschätzung gibt es je Seite nur einmal', () => {
		for (const id of ['kopf', 'namenszeile', 'fuss']) {
			const da = schonDa(BLATT, aus(id), null);
			assert.equal(da?.nr, nrVon(BLATT, id), id);
			assert.match(da?.meldung ?? '', /schon/);
		}
		const leer = BLATT.replace(/<section class="seite">[\s\S]*<\/section>/, '<section class="seite"></section>');
		assert.equal(schonDa(leer, aus('kopf'), null), null);
		assert.equal(schonDa(BLATT, aus('x-uhr'), null), null);
	});

	it('203-07: Punkte und Unterschrift hinter die letzte Aufgabe, die Auswertung auf eine eigene Seite', () => {
		const abschluss = fuegeBausteinEin(BLATT, aus('abschluss'), null, n).quelle;
		assert.ok(abschluss.indexOf('x-gesamtpunkte') > abschluss.indexOf('Stern'));
		assert.ok(abschluss.indexOf('x-gesamtpunkte') < abschluss.indexOf('class="fuss"'));
		const auswertung = fuegeBausteinEin(BLATT, aus('auswertung'), nrVon(BLATT, 'anw'), n).quelle;
		assert.equal(folien(auswertung).length, 2);
		assert.ok(auswertung.indexOf('x-notenschluessel') > auswertung.lastIndexOf('<section'));
		assert.match(schonDa(auswertung, aus('auswertung'), null)?.meldung ?? '', /Lehrkraft/);
	});

	it('203-10: Folieninhalt in eine Folie mit nur Kopf und Notiz, sonst auf eine neue Folie dahinter', () => {
		const zweite = nrVon(FOLIEN, 'titel', 1);
		const rein = fuegeBausteinEin(FOLIEN, aus('folie-bild'), zweite, jeSeite).quelle;
		assert.equal(folien(rein).length, 2);
		assert.ok(rein.indexOf('class="buehne"') > rein.indexOf('Zwei'));
		const erste = nrVon(FOLIEN, 'titel', 0);
		const neu = fuegeBausteinEin(FOLIEN, aus('folie-bild'), erste, jeSeite).quelle;
		assert.equal(folien(neu).length, 3);
		assert.ok(neu.indexOf('Titel der Folie') > neu.indexOf('Inhalt'));
		assert.ok(neu.indexOf('Titel der Folie') < neu.indexOf('Zwei'));
		assert.ok(neu.indexOf('class="buehne"') > neu.indexOf('Titel der Folie'));
	});

	it('203-N02, 203-N03: der Timer ist eine Folie für sich; gewählt ist danach die Folie, nicht die Bühne', () => {
		const timer = aus('x-timer');
		assert.equal(timer.ort, 'folie');
		assert.doesNotMatch(timer.html ?? '', /class="(aufgabe|nr)"/);
		const neu = fuegeBausteinEin(FOLIEN, timer, nrVon(FOLIEN, 'text'), jeSeite);
		assert.equal(folien(neu.quelle).length, 3);
		assert.doesNotMatch(neu.quelle, /<span class="nr/);
		assert.ok(neu.quelle.indexOf('<x-timer') > neu.quelle.indexOf('Titel der Folie'));
		assert.equal(neu.nr, folien(neu.quelle)[1]?.nr);
		const rein = fuegeBausteinEin(FOLIEN, aus('folie-bild'), nrVon(FOLIEN, 'titel', 1), jeSeite);
		assert.equal(rein.nr, folien(rein.quelle)[1]?.nr);
	});

	it('203-19: der Lageplan kommt ohne `boden`, mit Post und Spielplatz', () => {
		const plan = aus('x-plan').html ?? '';
		assert.match(plan, /<x-plan [^>]*objekte="post: B2; spielplatz: E3"/);
		assert.doesNotMatch(plan, /boden/);
	});

	it('203-10: die Schritte einer Folie sind eindeutig und fortlaufend', () => {
		for (const id of ['folie-schritte']) {
			const schritte = [...(aus(id).html ?? '').matchAll(/data-schritt="(\d+)"/g)].map((t) => Number(t[1]));
			assert.deepEqual(
				schritte,
				schritte.map((_, i) => i + 1),
			);
		}
	});

	it('203-18: eine neue Aufgabe ist nur Nummer und Aufgabentext', () => {
		const html = aus('aufgabe').html ?? '';
		assert.match(html, /class="nr"/);
		assert.match(html, /<div class="koerper"><\/div>/);
	});

	it('203-06: die Antwortlinie kommt mit „Es ist … .“ in eine eigene Zeile', () => {
		const { quelle } = fuegeBausteinEin(BLATT, aus('antwort'), nrVon(BLATT, 'anw'), n);
		assert.match(quelle, /<div class="zeile">Es ist <span class="antwort[^"]*"[^>]*><\/span>\.<\/div>/);
	});

	it('203-02: die Klasse des Blatts steht am body, nicht an der Mappe', () => {
		assert.equal(klasseDesBlatts(BLATT), 2);
		assert.equal(klasseDesBlatts('<body class="farbe kl4">'), 4);
		assert.equal(klasseDesBlatts('<body class="farbe">'), undefined);
		assert.equal(klasseDesBlatts('<div class="kl1"></div>'), undefined);
	});

	it('203-12: eine Lineatur ohne art bekommt die der Klasse, eine mit art bleibt', () => {
		const b = { id: 'l', ort: 'aufgabe' as const, html: '<x-lineatur zeilen="3"></x-lineatur>' };
		assert.equal(mitLineaturDerKlasse(BLATT, b).html, '<x-lineatur art="2" zeilen="3"></x-lineatur>');
		const karo = { ...b, html: '<x-lineatur art="karo" zeilen="3"></x-lineatur>' };
		assert.equal(mitLineaturDerKlasse(BLATT, karo).html, karo.html);
		assert.equal(mitLineaturDerKlasse('<body class="sw">', b), b);
		const { quelle } = fuegeBausteinEin(BLATT, aus('x-lineatur'), nrVon(BLATT, 'anw'), n);
		assert.match(quelle, /<x-lineatur art="2" zeilen="3">/);
		assert.ok(!quelle.includes('Rosine'));
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

describe('Fester Umbruch (206-06)', () => {
	const N = { jeSeite: false };
	const aufgabe = (i: number) =>
		`<div class="aufgabe"><span class="nr">${i}</span><div class="anw"><span class="text">A${i}</span></div></div>`;
	const SEITEN = `<!DOCTYPE html>
<html lang="de">
<head><link rel="stylesheet" href="blatt.css"></head>
<body class="kl2">
<section class="seite">
  <div class="namenszeile"><span class="name">Name</span></div>
  <header class="kopf"><div class="titel"><h1>T</h1></div></header>
  ${[1, 2, 3, 4].map(aufgabe).join('\n  ')}
  <div class="fuss">F</div>
</section>
</body>
</html>
`;
	const aufgabeNr = (q: string, text: string) =>
		zerlege(q).knoten.find((k) => klassenVon(k).includes('aufgabe') && q.slice(k.start, k.ende).includes(text))
			?.nr ?? -1;
	const texteJeSeite = (q: string) => {
		const z = zerlege(q);
		return blaetterVon(z).map((b) =>
			b.folge.map((nr) => q.slice(z.knoten[nr]?.start, z.knoten[nr]?.ende).match(/A\d|F/)?.[0]),
		);
	};

	it('„Ab hier neue Seite“ beginnt vor dem Block ein neues festes Blatt, mit allem dahinter', () => {
		const nr = aufgabeNr(SEITEN, 'A3');
		assert.ok(kannUmbrechenVor(SEITEN, nr));
		const e = umbruchVor(SEITEN, nr, N);
		assert.deepEqual(texteJeSeite(e.quelle), [
			['A1', 'A2'],
			['A3', 'A4', 'F'],
		]);
		assert.match(e.quelle, /<section class="seite" data-weiter>/);
		assert.doesNotMatch(e.quelle, /data-weiter="auto"/);
		assert.equal(e.quelle.match(/namenszeile/g)?.length, 1);
		// Die Auswahl bleibt auf dem Block
		const z = zerlege(e.quelle);
		assert.match(e.quelle.slice(z.knoten[e.nr ?? -1]?.start, z.knoten[e.nr ?? -1]?.ende), /A3/);
	});

	it('nicht vor dem ersten Flussblock, nicht vor dem Kopf und nicht auf einer Folie', () => {
		assert.equal(kannUmbrechenVor(SEITEN, aufgabeNr(SEITEN, 'A1')), false);
		const kopf = zerlege(SEITEN).knoten.find((k) => klassenVon(k).includes('kopf'))?.nr ?? -1;
		assert.equal(kannUmbrechenVor(SEITEN, kopf), false);
		const folie = SEITEN.replace('<body class="kl2">', '<body class="kl2 folie">');
		assert.equal(kannUmbrechenVor(folie, aufgabeNr(folie, 'A3')), false);
		assert.throws(() => umbruchVor(SEITEN, aufgabeNr(SEITEN, 'A1'), N));
	});

	it('„An vorige Seite anschließen“ macht die feste Seite automatisch, hin und zurück zeichengleich', () => {
		const geteilt = umbruchVor(SEITEN, aufgabeNr(SEITEN, 'A3'), N).quelle;
		const seiten = blaetterVon(zerlege(geteilt)).flatMap((b) => b.seiten);
		const zweite = seiten[1]?.nr ?? -1;
		assert.equal(kannAnschliessen(geteilt, seiten[0]?.nr ?? -1), false);
		assert.ok(kannAnschliessen(geteilt, zweite));
		const an = schliesseAn(geteilt, zweite, N);
		assert.match(an.quelle, /data-weiter="auto"/);
		assert.equal(blaetterVon(zerlege(an.quelle)).length, 1);
		assert.equal(an.quelle.replace(' data-weiter="auto"', ' data-weiter'), geteilt);
	});

	it('„An vorige Seite anschließen“ auch am ersten Block der festen Seite, nicht am zweiten (N06)', () => {
		const geteilt = umbruchVor(SEITEN, aufgabeNr(SEITEN, 'A3'), N).quelle;
		const zweite = blaetterVon(zerlege(geteilt))[1]?.seiten[0]?.nr ?? -1;
		assert.equal(seiteZumAnschliessen(geteilt, zweite), zweite);
		assert.equal(seiteZumAnschliessen(geteilt, aufgabeNr(geteilt, 'A3')), zweite);
		assert.equal(seiteZumAnschliessen(geteilt, aufgabeNr(geteilt, 'A4')), null);
	});

	it('nicht an einer Seite mit Kopf oder Namenszeile', () => {
		const zwei = SEITEN.replace(
			'</section>\n</body>',
			`</section>\n${SEITEN.slice(SEITEN.indexOf('<section'), SEITEN.indexOf('</body>'))}</body>`,
		);
		const zweite = blaetterVon(zerlege(zwei))[1]?.seiten[0]?.nr ?? -1;
		assert.ok(zweite > 0);
		assert.equal(kannAnschliessen(zwei, zweite), false);
	});
});
