import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from '@schoolbox/kern/src/quelltext';

import { seitenAbgleich, seitenStelle, seitenTexte, zeileZurAuswahl } from './gliederung-modell';

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

	it('findet die Stelle der Seite', () => {
		assert.equal(seitenStelle(z, p[1]?.nr ?? null), 1);
		assert.equal(seitenStelle(z, null), null);
	});
});
