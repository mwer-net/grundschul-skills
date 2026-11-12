import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zerlege } from '@schoolbox/kern/src/quelltext';
import { seitenVon } from '@schoolbox/kern/src/struktur';

import {
	blattMit,
	FIGUR_ANKER,
	FIGUR_FREI,
	FORM,
	KOPFBAND,
	SCHMUCK_STEMPEL,
	SEITENFLAECHE,
	SEITENRAHMEN,
	STREUUNG,
} from '../../e2e/gestaltung-daten';
import type { GliederungKnoten } from './gliederung-modell';
import {
	alleSchluessel,
	ankerIn,
	ebenenTeile,
	ketteZu,
	ohneWirkung,
	ordneSeite,
	seitenAbgleich,
	seitenTexte,
	stapelVon,
	titelDerGestaltung,
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
		zeile: 'baustein',
		kennung: '',
		aus: false,
		gesperrt: false,
		eigenerName: null,
		lage: null,
	});
	const modell = [
		{ id: 1, nr: 1, schluessel: '1', kinder: [knoten(2, '1/0', [knoten(3, '1/0/0', [knoten(4, '1/0/0/0')])])] },
		{ id: 2, nr: 10, schluessel: '2', kinder: [knoten(11, '2/0')] },
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

describe('Ebenen mit Gestaltung (101)', () => {
	const teileVon = (html: string) => {
		const z = zerlege(html);
		const [seite] = seitenVon(z);
		assert.ok(seite);
		return { z, teile: ebenenTeile(seite) };
	};
	const klasse = (z: ReturnType<typeof zerlege>, nr: number | null) =>
		nr === null ? null : (z.knoten[nr]?.attribute.find((a) => a.name === 'class')?.wert ?? null);
	const formDaten = (z: ReturnType<typeof zerlege>, nr: number) =>
		z.knoten[nr]?.attribute.find(
			(a) => a.name === 'data-form' || a.name === 'data-figur' || a.name === 'data-schmuck',
		)?.wert;

	it('ohne Gestaltung: keine Ebenen, der Baum bleibt der Stapel wie vorher (Schnappschuss)', () => {
		const { teile } = teileVon(blattMit());
		assert.deepEqual(teile, { vorne: [], hinten: [], kopfband: null, seitenrahmen: null, seitenflaeche: null });
		const stapel = ['Namenszeile', 'Kopf', 'Aufgabe 1', 'Aufgabe 2', 'Aufgabe 3'];
		const zeilen = ordneSeite(
			{ vorne: [], stapel, hinten: [], kopfband: null, seitenrahmen: null, seitenflaeche: null },
			() => 'Hauptstapel',
		);
		assert.deepEqual(zeilen, stapel);
	});

	it('mit Gestaltung: vorne, Hauptstapel, hinten, Rahmen, Fläche', () => {
		const { teile, z } = teileVon(
			blattMit({ vorne: [FORM, FIGUR_FREI], hinten: [SEITENFLAECHE, SEITENRAHMEN, STREUUNG] }),
		);
		assert.equal(teile.vorne.length, 2);
		assert.equal(teile.hinten.length, 1);
		assert.equal(teile.kopfband, null);
		assert.equal(klasse(z, teile.seitenrahmen), 'seitenrahmen');
		assert.equal(klasse(z, teile.seitenflaeche), 'seitenflaeche');
		const name = (nr: number | null) => (nr === null ? '' : `${klasse(z, nr)}`);
		const zeilen = ordneSeite(
			{
				vorne: teile.vorne.map(name),
				stapel: ['Aufgabe 1', 'Aufgabe 2'],
				hinten: teile.hinten.map(name),
				kopfband: null,
				seitenrahmen: name(teile.seitenrahmen),
				seitenflaeche: name(teile.seitenflaeche),
			},
			(stapel) => `Hauptstapel: ${stapel.join(', ')}`,
		);
		assert.deepEqual(zeilen, [
			'figur-frei',
			'form',
			'Hauptstapel: Aufgabe 1, Aufgabe 2',
			'streuung',
			'seitenrahmen',
			'seitenflaeche',
		]);
	});

	it('mit Kopfband (181): Hauptstapel, Kopfband, Streuung, Seitenrahmen, Seitenfläche', () => {
		const { teile, z } = teileVon(blattMit({ hinten: [SEITENFLAECHE, SEITENRAHMEN, KOPFBAND, STREUUNG] }));
		// Ein Kopfband ist kein frei liegendes Element: Es zählt nicht unter „hinten“.
		assert.equal(teile.hinten.length, 1);
		assert.equal(klasse(z, teile.kopfband), 'kopfband');
		const name = (nr: number | null) => (nr === null ? null : `${klasse(z, nr)}`);
		const zeilen = ordneSeite(
			{
				vorne: [],
				stapel: ['Aufgabe 1'],
				hinten: teile.hinten.map((nr) => `${klasse(z, nr)}`),
				kopfband: name(teile.kopfband),
				seitenrahmen: name(teile.seitenrahmen),
				seitenflaeche: name(teile.seitenflaeche),
			},
			() => 'Hauptstapel',
		);
		assert.deepEqual(zeilen, ['Hauptstapel', 'kopfband', 'streuung', 'seitenrahmen', 'seitenflaeche']);
	});

	it('Fläche, Rahmen oder Kopfband allein reichen für den Hauptstapel', () => {
		const zeilen = ordneSeite(
			{ vorne: [], stapel: ['A'], hinten: [], kopfband: null, seitenrahmen: null, seitenflaeche: 'F' },
			() => 'H',
		);
		assert.deepEqual(zeilen, ['H', 'F']);
		const mitBand = ordneSeite(
			{ vorne: [], stapel: ['A'], hinten: [], kopfband: 'K', seitenrahmen: null, seitenflaeche: null },
			() => 'H',
		);
		assert.deepEqual(mitBand, ['H', 'K']);
	});

	it('oben ist, was vorne liegt: umgekehrt zur Quelle', () => {
		const { teile, z } = teileVon(blattMit({ vorne: [FORM, FIGUR_FREI, SCHMUCK_STEMPEL] }));
		assert.deepEqual(
			teile.vorne.map((nr) => formDaten(z, nr)),
			['stempel', 'wilma', 'stern'],
		);
	});

	it('eine Streuung ist eine Zeile, ihre Teile nicht', () => {
		const { teile } = teileVon(blattMit({ hinten: [STREUUNG] }));
		assert.equal(teile.hinten.length, 1);
		assert.equal(teile.vorne.length, 0);
	});

	it('stapelVon findet die Bausteine auch unter dem Hauptstapel', () => {
		const k = (nr: number, zeile: 'baustein' | 'vorne' | 'hauptstapel', kinder: GliederungKnoten[] = []) =>
			({ nr, zeile, kinder }) as GliederungKnoten;
		assert.deepEqual(
			stapelVon({ kinder: [k(1, 'vorne'), k(-2, 'hauptstapel', [k(3, 'baustein'), k(4, 'baustein')])] }).map(
				(x) => x.nr,
			),
			[3, 4],
		);
		assert.deepEqual(
			stapelVon({ kinder: [k(3, 'baustein')] }).map((x) => x.nr),
			[3],
		);
	});

	it('Beschriftung: data-name zuerst, sonst nach der Art', () => {
		const angaben = (art: string, attribute: Record<string, string>, text = '', teile = 0, name = 'Name') => ({
			art,
			name,
			text,
			teile,
			wert: (a: string) => attribute[a] ?? null,
		});
		assert.equal(
			titelDerGestaltung(angaben('form', { 'data-name': 'Sonne', 'data-form': 'stern' }, '', 0, 'Sonne')),
			'Sonne',
		);
		assert.equal(titelDerGestaltung(angaben('bildfrei', { alt: 'Marktplatz', src: 'bilder/x.jpg' })), 'Marktplatz');
		assert.equal(titelDerGestaltung(angaben('bildfrei', { src: 'bilder/zoo-tiere.png?v=2' })), 'zoo-tiere');
		assert.equal(
			titelDerGestaltung(angaben('formtext', { 'data-form': 'sprechblase' }, 'Zähl genau!')),
			'Sprechblase „Zähl genau!“',
		);
		assert.equal(titelDerGestaltung(angaben('schmuck', {}, 'Die Formen-Detektive')), 'Die Formen-Detektive');
		assert.equal(titelDerGestaltung(angaben('schmuck', {}, 'x'.repeat(60))).length, 40);
		assert.equal(titelDerGestaltung(angaben('streuung', { 'data-streuung': 'punkte' }, '', 21)), 'Punkte (21)');
		assert.equal(titelDerGestaltung(angaben('gruppe', {}, '', 2, 'Gruppe')), 'Gruppe (2)');
		assert.equal(titelDerGestaltung(angaben('figurfrei', { 'data-figur': 'wilma' }, '', 0, 'Wilma')), 'Wilma');
	});
});

describe('ankerIn (106)', () => {
	it('die Elemente am Anker eines Bausteins, das vorderste (in der Quelle letzte) zuerst', () => {
		const zweites = FIGUR_ANKER.replace('data-figur="wilma"', 'data-figur="willi"');
		const z = zerlege(blattMit({ anker: [FIGUR_ANKER, zweites] }));
		const aufgabe = z.knoten.find((k) => k.attribute.some((a) => a.name === 'class' && a.wert === 'aufgabe'));
		assert.ok(aufgabe);
		const nrn = ankerIn(z, aufgabe.nr);
		assert.deepEqual(
			nrn.map((nr) => z.knoten[nr]?.attribute.find((a) => a.name === 'data-figur')?.wert),
			['willi', 'wilma'],
		);
		assert.deepEqual(ankerIn(zerlege(blattMit({ vorne: [FIGUR_FREI] })), aufgabe.nr), []);
	});
});
