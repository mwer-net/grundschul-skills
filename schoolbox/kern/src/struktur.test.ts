import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS } from './konfig';
import type { Knoten, Zerlegung } from './quelltext';
import {
	attribut,
	innenVon,
	klassenVon,
	macheRueckgaengig,
	neuerVerlauf,
	nimmAuf,
	quelleVon,
	zerlege,
} from './quelltext';
import {
	dupliziereBaustein,
	fuegeSeiteEin,
	hatNamenszeile,
	loescheBaustein,
	nummeriere,
	setzeAbstand,
	setzeSpalten,
	setzeStilWert,
	sternNichtAmEnde,
	stilWert,
	verschiebeBaustein,
} from './struktur';

const lies = (name: string) => readFileSync(path.join(ASSETS, name), 'utf8');
const ARBEITSBLATT = lies('vorlage-arbeitsblatt.html');
const PRAESENTATION = lies('vorlage-praesentation.html');
const BLATT = { jeSeite: false };
const FOLIEN = { jeSeite: true };

const mitKlasse = (z: Zerlegung, klasse: string) => z.knoten.filter((k) => klassenVon(k).includes(klasse));
const aufgaben = (quelle: string) => mitKlasse(zerlege(quelle), 'aufgabe');
const aufgabe = (quelle: string, i: number) => aufgaben(quelle)[i] as Knoten;
const seite = (quelle: string, i: number) => mitKlasse(zerlege(quelle), 'seite')[i] as Knoten;
const nummern = (quelle: string) => {
	const z = zerlege(quelle);
	return mitKlasse(z, 'nr')
		.filter((k) => klassenVon(k.eltern as Knoten).includes('aufgabe'))
		.map((k) => innenVon(z, k));
};
const anweisungen = (quelle: string) => {
	const z = zerlege(quelle);
	return mitKlasse(z, 'text')
		.filter((k) => klassenVon(k.eltern as Knoten).includes('anw'))
		.map((k) => innenVon(z, k).slice(0, 12));
};

/** Ein Befehl ist genau ein Schritt im Verlauf, und Rückgängig stellt die alte Fassung byte-genau her. */
const einSchritt = (alt: string, neu: string) => {
	const v = nimmAuf(neuerVerlauf(alt), neu, 'Test');
	assert.equal(v.zurueck.length, 1);
	assert.equal(macheRueckgaengig(v).quelle, alt);
};

describe('verschiebeBaustein', () => {
	it('zieht Aufgabe 3 nach vorn, zählt neu und liefert die neue Nummer des Elements', () => {
		const dritte = aufgabe(ARBEITSBLATT, 2);
		const ziel = aufgabe(ARBEITSBLATT, 0);
		const { nr, quelle } = verschiebeBaustein(ARBEITSBLATT, dritte.nr, { nr: ziel.nr, wo: 'vor' }, BLATT);
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '★']);
		assert.deepEqual(anweisungen(quelle), ['Willi sagt: ', 'Lies ab. Sch', 'Zeichne die ', 'Sternchenauf']);
		const z = zerlege(quelle);
		assert.equal(z.knoten[nr ?? -1]?.start, aufgabe(quelle, 0).start);
		assert.equal(quelle.split('\n').length, ARBEITSBLATT.split('\n').length);
		assert.equal(sternNichtAmEnde(quelle), false);
		einSchritt(ARBEITSBLATT, quelle);
	});

	it('warnt, wenn die Sternchenaufgabe nicht mehr am Ende steht', () => {
		const stern = aufgabe(ARBEITSBLATT, 3);
		const { quelle } = verschiebeBaustein(
			ARBEITSBLATT,
			stern.nr,
			{ nr: aufgabe(ARBEITSBLATT, 1).nr, wo: 'vor' },
			BLATT,
		);
		assert.deepEqual(nummern(quelle), ['1', '★', '2', '3']);
		assert.equal(sternNichtAmEnde(quelle), true);
	});

	it('legt eine Aufgabe auf eine leere Seite, eingerückt wie dort üblich', () => {
		const mitSeite = fuegeSeiteEin(ARBEITSBLATT, { nach: null, mitNamenszeile: false }, BLATT).quelle;
		const erste = aufgabe(mitSeite, 0);
		const { nr, quelle } = verschiebeBaustein(mitSeite, erste.nr, { in: seite(mitSeite, 1).nr }, BLATT);
		const z = zerlege(quelle);
		const neueSeite = seite(quelle, 1);
		assert.deepEqual(
			neueSeite.kinder.map((k) => k.nr),
			[nr],
		);
		assert.match(
			quelleVon(z, neueSeite),
			/^<section class="seite">\n {2}<div class="aufgabe">\n {4}<span class="nr">3<\/span>/,
		);
		assert.match(quelleVon(z, neueSeite), /\n {2}<\/div>\n<\/section>$/);
		assert.deepEqual(nummern(quelle), ['1', '2', '★', '3']);
		assert.equal(sternNichtAmEnde(quelle), true);
		einSchritt(mitSeite, quelle);
	});

	it('rückt beim Verschieben in eine andere Tiefe die Folgezeilen um', () => {
		const html =
			'<body>\n<div class="a">\n  <p>\n    x\n  </p>\n</div>\n<div class="b">\n    <i>y</i>\n</div>\n</body>';
		const z = zerlege(html);
		const p = z.knoten.find((k) => k.tag === 'p') as Knoten;
		const i = z.knoten.find((k) => k.tag === 'i') as Knoten;
		const { quelle } = verschiebeBaustein(html, p.nr, { nr: i.nr, wo: 'nach' }, BLATT);
		assert.equal(
			quelle,
			'<body>\n<div class="a">\n</div>\n<div class="b">\n    <i>y</i>\n    <p>\n      x\n    </p>\n</div>\n</body>',
		);
	});

	it('lässt kein Element in sich selbst ablegen', () => {
		const erste = seite(ARBEITSBLATT, 0);
		assert.throws(() => verschiebeBaustein(ARBEITSBLATT, erste.nr, { in: aufgabe(ARBEITSBLATT, 0).nr }, BLATT));
	});
});

describe('dupliziereBaustein und loescheBaustein', () => {
	it('kopiert ein Item samt Lösung und liefert die Kopie', () => {
		const z = zerlege(ARBEITSBLATT);
		const zelle = mitKlasse(z, 'zelle')[5] as Knoten;
		const { nr, quelle } = dupliziereBaustein(ARBEITSBLATT, zelle.nr, BLATT);
		const neu = zerlege(quelle);
		const kopie = neu.knoten[nr ?? -1] as Knoten;
		assert.equal(quelleVon(neu, kopie), quelleVon(z, zelle));
		assert.match(quelleVon(neu, kopie), /<x-uhr loesung="4:30" groesse="88">/);
		assert.equal(kopie.start > zelle.start, true);
		assert.equal(mitKlasse(neu, 'zelle').filter((k) => quelleVon(neu, k).includes('loesung="4:30"')).length, 2);
		einSchritt(ARBEITSBLATT, quelle);

		const mitDataL = dupliziereBaustein(ARBEITSBLATT, (mitKlasse(z, 'zelle')[1] as Knoten).nr, BLATT).quelle;
		assert.equal(mitDataL.split('data-l="halb 5"').length - 1, 2);
	});

	it('kopiert eine Aufgabe dahinter und zählt die folgenden weiter', () => {
		const { nr, quelle } = dupliziereBaustein(ARBEITSBLATT, aufgabe(ARBEITSBLATT, 0).nr, BLATT);
		assert.deepEqual(nummern(quelle), ['1', '2', '3', '4', '★']);
		assert.equal(zerlege(quelle).knoten[nr ?? -1]?.start, aufgabe(quelle, 1).start);
		assert.match(quelleVon(zerlege(quelle), aufgabe(quelle, 1)), /data-l="3 Uhr"/);
		einSchritt(ARBEITSBLATT, quelle);
	});

	it('löscht eine Aufgabe samt ihrer Zeilen und zählt neu', () => {
		const { nr, quelle } = loescheBaustein(ARBEITSBLATT, aufgabe(ARBEITSBLATT, 0).nr, BLATT);
		assert.equal(nr, null);
		assert.deepEqual(nummern(quelle), ['1', '2', '★']);
		assert.equal(quelle.includes('Lies ab.'), false);
		einSchritt(ARBEITSBLATT, quelle);
	});

	it('löscht nie die einzige Seite', () => {
		assert.throws(() => loescheBaustein(ARBEITSBLATT, seite(ARBEITSBLATT, 0).nr, BLATT), /einzige Seite/);
		const zwei = fuegeSeiteEin(ARBEITSBLATT, { nach: null, mitNamenszeile: false }, BLATT).quelle;
		assert.equal(mitKlasse(zerlege(loescheBaustein(zwei, seite(zwei, 1).nr, BLATT).quelle), 'seite').length, 1);
	});
});

describe('fuegeSeiteEin', () => {
	it('legt eine leere Seite hinter die gewählte', () => {
		const zwei = fuegeSeiteEin(PRAESENTATION, { nach: seite(PRAESENTATION, 0).nr, mitNamenszeile: false }, FOLIEN);
		const z = zerlege(zwei.quelle);
		assert.equal(z.knoten[zwei.nr ?? -1]?.start, seite(zwei.quelle, 1).start);
		assert.equal(quelleVon(z, seite(zwei.quelle, 1)), '<section class="seite"></section>');
		assert.equal(mitKlasse(z, 'seite').length, mitKlasse(zerlege(PRAESENTATION), 'seite').length + 1);
		assert.equal(hatNamenszeile(zerlege(PRAESENTATION)), false);
		einSchritt(PRAESENTATION, zwei.quelle);
	});

	it('übernimmt auf Wunsch Namenszeile und Lösungsmarke der ersten Seite', () => {
		assert.equal(hatNamenszeile(zerlege(ARBEITSBLATT)), true);
		const { nr, quelle } = fuegeSeiteEin(ARBEITSBLATT, { nach: null, mitNamenszeile: true }, BLATT);
		const z = zerlege(quelle);
		assert.equal(
			quelleVon(z, z.knoten[nr ?? -1] as Knoten),
			[
				'<section class="seite">',
				'  <div class="namenszeile"><span class="name">Name:</span><span class="datum">Datum:</span></div>',
				'  <span class="loesung-marke">Lösung</span>',
				'</section>',
			].join('\n'),
		);
		assert.ok(quelle.endsWith('</section>\n</body>\n</html>\n'));
	});
});

describe('nummeriere', () => {
	it('zählt Aufgaben auf Folien je Folie und Vermutungen je Gruppe', () => {
		const z = zerlege(PRAESENTATION);
		const vermutungen = mitKlasse(z, 'vermutung');
		const [a, , c] = vermutungen;
		const { quelle } = verschiebeBaustein(
			PRAESENTATION,
			(c as Knoten).nr,
			{ nr: (a as Knoten).nr, wo: 'vor' },
			FOLIEN,
		);
		const neu = zerlege(quelle);
		const buchstaben = mitKlasse(neu, 'vermutung').map((v) => innenVon(neu, v.kinder[0] as Knoten));
		assert.deepEqual(buchstaben.slice(0, 3), ['A', 'B', 'C']);
		assert.match(quelleVon(neu, mitKlasse(neu, 'vermutung')[0] as Knoten), /Die alte wird groß/);
		assert.equal(nummeriere(PRAESENTATION, FOLIEN), PRAESENTATION);
	});

	it('ändert nichts an einem richtig gezählten Blatt und lässt Nummern ohne Zahl stehen', () => {
		assert.equal(nummeriere(ARBEITSBLATT, BLATT), ARBEITSBLATT);
		const html =
			'<div class="aufgabe"><span class="nr">7</span></div><div class="aufgabe"><span class="nr">a</span></div>';
		assert.equal(nummeriere(html, BLATT), html.replace('>7<', '>1<'));
	});
});

describe('Spalten und Abstand', () => {
	it('setzt --spalten, lässt andere Angaben stehen und bleibt zwischen 1 und 6', () => {
		const z = zerlege(PRAESENTATION);
		const reihe = mitKlasse(z, 'reihe')[0] as Knoten;
		assert.equal(attribut(reihe, 'style')?.wert, '--spalten:1;width:620px');
		const zwei = setzeSpalten(PRAESENTATION, reihe.nr, 2);
		assert.equal(attribut(zerlege(zwei).knoten[reihe.nr] as Knoten, 'style')?.wert, '--spalten:2;width:620px');
		einSchritt(PRAESENTATION, zwei);
		assert.match(setzeSpalten(PRAESENTATION, reihe.nr, 0), /style="--spalten:1;width:620px"/);
		assert.match(setzeSpalten(PRAESENTATION, reihe.nr, 9), /style="--spalten:6;width:620px"/);
		const ohne = '<div class="karten"><div class="karte"></div></div>';
		assert.equal(
			setzeSpalten(ohne, 0, 3),
			'<div style="--spalten:3" class="karten"><div class="karte"></div></div>',
		);
	});

	it('setzt --abstand am body und nie unter 24 px', () => {
		const neu = setzeAbstand(ARBEITSBLATT, 32);
		assert.match(neu, /<body style="--abstand:32px" class="kl2 farbe palette-himmel">/);
		einSchritt(ARBEITSBLATT, neu);
		assert.match(setzeAbstand(ARBEITSBLATT, 10), /--abstand:24px/);
		assert.match(setzeAbstand(ARBEITSBLATT, 23.4), /--abstand:24px/);
		assert.match(setzeAbstand(ARBEITSBLATT, 100), /--abstand:48px/);
		assert.match(setzeAbstand(neu, 26), /<body style="--abstand:26px" class=/);
	});

	it('liest und setzt einzelne Angaben im style-Wert', () => {
		assert.equal(stilWert('--spalten:4; width: 620px', 'width'), '620px');
		assert.equal(stilWert(null, '--spalten'), null);
		assert.equal(setzeStilWert('color:red;--abstand:30px', '--abstand', '28px'), 'color:red;--abstand:28px');
	});
});
