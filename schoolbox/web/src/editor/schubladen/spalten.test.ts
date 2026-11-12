import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LinksStand, LinksZeigt } from './spalten';
import {
	ALT,
	angezeigt,
	BREITE,
	istEng,
	linksAusSpeicher,
	schalte,
	schalteLeiste,
	sichtbar,
	SPEICHER,
} from './spalten';

const BEREIT = () => true;
const stand = (mehr: Partial<LinksStand> = {}): LinksStand => ({
	ebenen: true,
	schublade: 'bausteine',
	offen: false,
	...mehr,
});
const nichts: LinksZeigt = { ebenen: false, schublade: null };

/** Ein Klick wie im Editor: erst sehen, was da ist, dann schalten. */
const klick = (s: LinksStand, id: Parameters<typeof schalte>[1], eng: boolean) =>
	schalte(s, id, angezeigt(s, eng, BEREIT), eng);

const speicher = (werte: Record<string, string>) => (schluessel: string) => werte[schluessel] ?? null;

describe('Spalten links (183)', () => {
	it('istEng: Mac 1512 und 1440 haben Platz für zwei Spalten, 1280 mit Inspektor und das iPad nicht', () => {
		for (const bereich of [1264, 1192, 1152]) {
			assert.equal(istEng(bereich, 'bausteine'), false, String(bereich));
		}
		for (const bereich of [1151, 1032, 832]) {
			assert.equal(istEng(bereich, 'bausteine'), true, String(bereich));
		}
		assert.deepEqual(BREITE, { ebenen: 240, schublade: 280 });
	});

	it('angezeigt: breit beide, eng nur die Schublade; nicht bereit stehen die Ebenen da', () => {
		const beide = stand({ offen: true });
		assert.deepEqual(angezeigt(beide, false, BEREIT), { ebenen: true, schublade: 'bausteine' });
		assert.deepEqual(angezeigt(beide, true, BEREIT), { ebenen: false, schublade: 'bausteine' });
		assert.deepEqual(angezeigt(stand(), true, BEREIT), { ebenen: true, schublade: null });
		assert.deepEqual(angezeigt(stand({ ebenen: false }), false, BEREIT), nichts);

		const ohneEbenen = stand({ ebenen: false, offen: true });
		assert.deepEqual(
			angezeigt(ohneEbenen, false, () => false),
			{ ebenen: true, schublade: null },
		);
		assert.deepEqual(angezeigt(ohneEbenen, false, BEREIT), { ebenen: false, schublade: 'bausteine' });
	});

	it('schalte breit: die Schublade schaltet für sich, die Ebenen bleiben', () => {
		let s = klick(stand(), 'bausteine', false);
		assert.deepEqual(sichtbar(angezeigt(s, false, BEREIT)), ['ebenen', 'bausteine']);
		s = klick(s, 'bausteine', false);
		assert.equal(s.ebenen, true);
		assert.deepEqual(sichtbar(angezeigt(s, false, BEREIT)), ['ebenen']);
		s = klick(klick(s, 'bausteine', false), 'figuren', false);
		assert.deepEqual(sichtbar(angezeigt(s, false, BEREIT)), ['ebenen', 'figuren']);
		s = klick(s, 'ebenen', false);
		assert.deepEqual(s, { ebenen: false, schublade: 'figuren', offen: true });
		assert.deepEqual(sichtbar(angezeigt(s, false, BEREIT)), ['figuren']);
		s = klick(s, 'ebenen', false);
		assert.deepEqual(sichtbar(angezeigt(s, false, BEREIT)), ['ebenen', 'figuren']);
	});

	it('schalte eng: die Ebenen schließen die Schublade an ihrer Stelle und kommen nach ihr zurück', () => {
		const anIhrerStelle = klick(stand(), 'bausteine', true);
		assert.deepEqual(angezeigt(anIhrerStelle, true, BEREIT), { ebenen: false, schublade: 'bausteine' });

		const ebenen = klick(anIhrerStelle, 'ebenen', true);
		assert.deepEqual(angezeigt(ebenen, true, BEREIT), { ebenen: true, schublade: null });

		const zurueck = klick(anIhrerStelle, 'bausteine', true);
		assert.deepEqual(angezeigt(zurueck, true, BEREIT), { ebenen: true, schublade: null });

		// Gegenprobe: Waren die Ebenen zu, kommt nichts zurück.
		const ohne = klick(klick(stand({ ebenen: false }), 'bausteine', true), 'bausteine', true);
		assert.deepEqual(angezeigt(ohne, true, BEREIT), nichts);
	});

	it('schalteLeiste schließt alles und holt dasselbe wieder; ohne `vorher` die Ebenen', () => {
		const beide = stand({ offen: true });
		const zu = schalteLeiste(beide, angezeigt(beide, false, BEREIT), null);
		assert.deepEqual(angezeigt(zu.stand, false, BEREIT), nichts);
		assert.deepEqual(zu.vorher, beide);
		const wieder = schalteLeiste(zu.stand, nichts, zu.vorher);
		assert.deepEqual(wieder, { stand: beide, vorher: null });
		assert.deepEqual(sichtbar(angezeigt(wieder.stand, false, BEREIT)), ['ebenen', 'bausteine']);

		const ohneVorher = schalteLeiste(stand({ ebenen: false }), nichts, null);
		assert.deepEqual(angezeigt(ohneVorher.stand, false, BEREIT), { ebenen: true, schublade: null });
	});

	it('linksAusSpeicher übernimmt alte Werte einmal', () => {
		const ebenen: LinksZeigt = { ebenen: true, schublade: null };
		const faelle: [Record<string, string>, LinksZeigt][] = [
			[{}, ebenen],
			[{ [SPEICHER.links]: 'ebenen' }, ebenen],
			[{ [SPEICHER.links]: 'gliederung' }, ebenen],
			[{ [SPEICHER.links]: 'seiten' }, ebenen],
			[{ [SPEICHER.links]: 'rezepte' }, ebenen],
			[{ [SPEICHER.links]: 'unbekannt' }, ebenen],
			[
				{ [SPEICHER.links]: 'bausteine', [ALT[0]]: '1' },
				{ ebenen: true, schublade: 'bausteine' },
			],
			[
				{ [SPEICHER.links]: 'formen', [ALT[0]]: '1' },
				{ ebenen: true, schublade: 'werkzeuge' },
			],
			[
				{ [SPEICHER.links]: 'text', [ALT[0]]: '1', [ALT[1]]: '0.4' },
				{ ebenen: true, schublade: 'werkzeuge' },
			],
			[{ [SPEICHER.links]: 'bausteine' }, { ebenen: false, schublade: 'bausteine' }],
			[
				{ [SPEICHER.links]: 'figuren', [ALT[0]]: '0' },
				{ ebenen: false, schublade: 'figuren' },
			],
			[{ [SPEICHER.links]: 'zu', [ALT[0]]: '1' }, ebenen],
			[{ [SPEICHER.links]: 'zu' }, nichts],
			[{ [SPEICHER.links]: 'zu', [ALT[0]]: '0' }, nichts],
		];
		for (const [werte, erwartet] of faelle) {
			const { stand: s, uebernehmen } = linksAusSpeicher(speicher(werte), false);
			assert.deepEqual(angezeigt(s, false, BEREIT), erwartet, JSON.stringify(werte));
			assert.equal(uebernehmen, true, JSON.stringify(werte));
		}
	});

	it('linksAusSpeicher: der neue Schlüssel schlägt `angeheftet`; ein neues Material öffnet „Bausteine“', () => {
		const neu = linksAusSpeicher(
			speicher({ [SPEICHER.links]: 'bausteine', [SPEICHER.ebenen]: '0', [ALT[0]]: '1' }),
			false,
		);
		assert.equal(neu.uebernehmen, false);
		assert.deepEqual(angezeigt(neu.stand, false, BEREIT), { ebenen: false, schublade: 'bausteine' });

		for (const [ebenen, erwartet] of [
			['1', true],
			['0', false],
		] as const) {
			const werte = { [SPEICHER.links]: 'figuren', [SPEICHER.ebenen]: ebenen };
			const material = linksAusSpeicher(speicher(werte), true);
			assert.deepEqual(material.stand, { ebenen: erwartet, schublade: 'bausteine', offen: true });
		}
	});
});
