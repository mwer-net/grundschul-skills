import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from './quelltext';
import {
	fuegeSpalteEin,
	fuegeZeileEin,
	groesseVon,
	loescheSpalte,
	loescheZeile,
	naechsteZelle,
	setzeGroesse,
	setzeKopfzeile,
	teileTabelle,
} from './tabelle';

const QUELLE = `<!doctype html><html><head><title>t</title></head><body class="kl2 farbe">
<section class="seite">
  <p>Vorher</p>
  <table class="kit-tabelle"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td data-l="1">a</td><td>b</td></tr><tr class="beispiel"><td>c</td><td>d</td></tr></tbody></table>
  <p>Nachher</p>
</section>
</body></html>
`;
const n = { jeSeite: false };
const zelle = (q: string, text: string) => {
	const z = zerlege(q);
	return (
		z.knoten.find(
			(k) => (k.tag === 'td' || k.tag === 'th') && z.quelle.slice(k.oeffnerEnde, k.schliesserStart) === text,
		)?.nr ?? -1
	);
};
const ausserhalb = (q: string) => q.replace(/<table[\s\S]*<\/table>/, '');

describe('Kit-Tabelle', () => {
	it('Zeile davor und danach; der Rest der Quelle bleibt gleich', () => {
		const { nr, quelle } = fuegeZeileEin(QUELLE, zelle(QUELLE, 'a'), 'nach', n);
		assert.deepEqual(groesseVon(quelle, nr ?? -1), { zeilen: 4, spalten: 2, kopf: true });
		assert.equal(ausserhalb(quelle), ausserhalb(QUELLE));
		assert.match(
			quelle,
			/<td data-l="1">a<\/td><td>b<\/td><\/tr><tr><td><\/td><td><\/td><\/tr><tr class="beispiel">/,
		);
	});

	it('vor der Kopfzeile geht nichts: Die neue Zeile kommt dahinter', () => {
		const { quelle } = fuegeZeileEin(QUELLE, zelle(QUELLE, 'A'), 'vor', n);
		assert.match(quelle, /<\/thead><tbody><tr><td><\/td><td><\/td><\/tr><tr><td data-l/);
	});

	it('Spalte einfügen und löschen, Kopf bleibt th', () => {
		const { nr, quelle } = fuegeSpalteEin(QUELLE, zelle(QUELLE, 'A'), 'vor', n);
		assert.match(quelle, /<tr><th><\/th><th>A<\/th><th>B<\/th><\/tr>/);
		assert.match(loescheSpalte(quelle, nr ?? -1, n).quelle, /<tr><th>A<\/th><th>B<\/th><\/tr>/);
	});

	it('die letzte Zeile und Spalte bleiben', () => {
		const einzeln = QUELLE.replace(
			/<table[\s\S]*<\/table>/,
			'<table class="kit-tabelle"><tbody><tr><td>x</td></tr></tbody></table>',
		);
		assert.throws(() => loescheZeile(einzeln, zelle(einzeln, 'x'), n), /letzte Zeile/);
		assert.throws(() => loescheSpalte(einzeln, zelle(einzeln, 'x'), n), /letzte Spalte/);
	});

	it('Kopfzeile aus und an: Die erste Zeile wechselt zwischen th und td', () => {
		const ohne = setzeKopfzeile(QUELLE, zelle(QUELLE, 'a'), false, n).quelle;
		assert.doesNotMatch(ohne, /thead|<th>/);
		assert.match(
			setzeKopfzeile(ohne, zelle(ohne, 'a'), true, n).quelle,
			/<thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead>/,
		);
	});

	it('Größe setzen', () => {
		const { nr, quelle } = setzeGroesse(QUELLE, zelle(QUELLE, 'a'), { zeilen: 5, spalten: 3 }, n);
		assert.deepEqual(groesseVon(quelle, nr ?? -1), { zeilen: 5, spalten: 3, kopf: true });
		const klein = setzeGroesse(quelle, nr ?? -1, { zeilen: 2, spalten: 1 }, n);
		assert.deepEqual(groesseVon(klein.quelle, klein.nr ?? -1), { zeilen: 2, spalten: 1, kopf: true });
	});

	it('Tab: nächste Zelle, am Ende null', () => {
		assert.deepEqual(naechsteZelle({ zeile: 0, spalte: 0 }, 2, 2), { zeile: 0, spalte: 1 });
		assert.deepEqual(naechsteZelle({ zeile: 0, spalte: 1 }, 2, 2), { zeile: 1, spalte: 0 });
		assert.equal(naechsteZelle({ zeile: 1, spalte: 1 }, 2, 2), null);
	});

	it('Teilen: neue Seite dahinter, Kopfzeile auf beiden, keine Zeile verloren', () => {
		const { quelle } = teileTabelle(QUELLE, zelle(QUELLE, 'a'), 2, n);
		assert.equal(quelle.match(/<th>A<\/th>/g)?.length, 2);
		assert.equal(quelle.match(/<section class="seite"/g)?.length, 2);
		assert.ok(
			quelle.indexOf('>a<') < quelle.indexOf('Nachher') && quelle.indexOf('Nachher') < quelle.indexOf('>c<'),
		);
		assert.throws(() => teileTabelle(QUELLE, zelle(QUELLE, 'a'), 1, n), /nicht teilen/);
	});
});
