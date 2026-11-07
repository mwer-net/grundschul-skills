import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from '@schoolbox/kern/src/quelltext';

import type { GliederungKnoten } from './gliederung-modell';
import {
	alleSchluessel,
	ketteZu,
	ohneWirkung,
	seitenAbgleich,
	seitenTexte,
	zeileZurAuswahl,
} from './gliederung-modell';

const quelle = (...seiten: string[]) =>
	`<body>${seiten.map((s) => `<section class="seite">${s}</section>`).join('\n')}</body>`;

const zaehler = (start: number) => {
	let n = start;
	return () => {
		n += 1;
		return n;
	};
};

const spuren = (...texte: string[]) => texte.map((text, i) => ({ id: i + 1, text }));

describe('seitenAbgleich', () => {
	it('folgt einer Seite, die wandert', () => {
		const neu = seitenAbgleich(spuren('a', 'b', 'c'), ['c', 'a', 'b'], zaehler(10));
		assert.deepEqual(
			neu.map((s) => s.id),
			[3, 1, 2],
		);
	});

	it('geänderte Seiten behalten ihren Platz, neue bekommen eine neue Id', () => {
		const neu = seitenAbgleich(spuren('a', 'b'), ['a2', 'b', 'n'], zaehler(10));
		assert.deepEqual(
			neu.map((s) => s.id),
			[1, 2, 11],
		);
	});

	it('vergibt keine Id doppelt, auch bei gleichem Inhalt', () => {
		const neu = seitenAbgleich(spuren('x', 'x'), ['x', 'x', 'x'], zaehler(10));
		assert.deepEqual(
			neu.map((s) => s.id),
			[1, 2, 11],
		);
	});

	it('eine gelöschte Seite gibt ihre Id nicht an die nächste weiter', () => {
		const neu = seitenAbgleich(spuren('a', 'b', 'c'), ['a', 'c'], zaehler(10));
		assert.deepEqual(
			neu.map((s) => s.id),
			[1, 3],
		);
	});
});

describe('seitenTexte', () => {
	it('sieht von den Nummern der Aufgaben ab, damit eine gewanderte Seite erkennbar bleibt', () => {
		const eins = seitenTexte(zerlege(quelle('<div class="aufgabe"><span class="nr">1</span>Text</div>')));
		const fuenf = seitenTexte(zerlege(quelle('<div class="aufgabe"><span class="nr">5</span>Text</div>')));
		assert.deepEqual(eins, fuenf);
	});
});

describe('Auswahl in der Liste', () => {
	const z = zerlege(quelle('<div class="aufgabe"><p>eins</p></div>', '<div class="aufgabe"><p>zwei</p></div>'));
	const p = z.knoten.filter((k) => k.tag === 'p');
	const aufgaben = z.knoten.filter((k) => k.attribute.some((a) => a.wert === 'aufgabe'));

	it('findet die Zeile um ein inneres Element', () => {
		const nr = p[1]?.nr ?? null;
		assert.equal(zeileZurAuswahl(z, nr, new Set(aufgaben.map((a) => a.nr))), aufgaben[1]?.nr);
		assert.equal(zeileZurAuswahl(z, null, new Set()), null);
	});

	it('ohne Wirkung: direkt vor den Nachfolger, ans Ende, wo es schon steht', () => {
		const [a, b] = aufgaben;
		assert.ok(a && b);
		const [s1, s2] = z.knoten.filter((k) => k.tag === 'section');
		assert.ok(s1 && s2);
		assert.equal(ohneWirkung(z, a.nr, { nr: b.nr, wo: 'vor' }), false);
		assert.equal(ohneWirkung(z, s1.nr, { nr: s2.nr, wo: 'vor' }), true);
		assert.equal(ohneWirkung(z, s2.nr, { nr: s1.nr, wo: 'nach' }), true);
		assert.equal(ohneWirkung(z, s2.nr, { nr: s1.nr, wo: 'vor' }), false);
		assert.equal(ohneWirkung(z, a.nr, { in: s1.nr }), true);
		assert.equal(ohneWirkung(z, a.nr, { in: s2.nr }), false);
	});
});

describe('Baum', () => {
	const knoten = (nr: number, schluessel: string, kinder: GliederungKnoten[] = []): GliederungKnoten => ({
		nr,
		titel: '',
		nummer: null,
		name: '',
		art: '',
		aufgabe: false,
		fest: false,
		ziehbar: true,
		schluessel,
		kinder,
	});
	const modell = [
		{ id: 1, nr: 1, schluessel: '1', kinder: [knoten(2, '1/0', [knoten(3, '1/0/0', [knoten(4, '1/0/0/0')])])], unten: [] },
		{ id: 2, nr: 10, schluessel: '2', kinder: [knoten(11, '2/0')], unten: [] },
	];

	it('findet die Kette von der Seite bis zur Zeile', () => {
		assert.deepEqual(ketteZu(modell, 4), ['1', '1/0', '1/0/0', '1/0/0/0']);
		assert.deepEqual(ketteZu(modell, 10), ['2']);
		assert.deepEqual(ketteZu(modell, 99), []);
	});

	it('kennt alle Zeilen, die sich einklappen lassen', () => {
		assert.deepEqual(alleSchluessel(modell), ['1', '1/0', '1/0/0', '2']);
	});
});
