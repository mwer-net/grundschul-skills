import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { pruefeFreiesHtml } from './frei';
import { setzeLage } from './gestaltung';
import { attribut, zerlege } from './quelltext';
import type { StreuParameter, Zone } from './streuen';
import {
	ergaenzeStreuungen,
	leseStreuung,
	MAX_TEILE,
	parameterVon,
	setzeStreuung,
	streue,
	streuungHtml,
	teileAlsSvg,
	wuerfle,
	zufall,
} from './streuen';
import { legeStreuung as lege } from './streuen-aendern';

/** Wie `legeStreuung`, mit gewisser Nummer. */
const legeStreuung = (...a: Parameters<typeof lege>) => {
	const r = lege(...a);
	assert.notEqual(r.nr, null);
	return { quelle: r.quelle, nr: r.nr as number };
};

const BASIS: StreuParameter = {
	art: 'konfetti',
	saat: 4711,
	dichte: 0.5,
	formen: ['punkt', 'dreieck', 'raute', 'streifen'],
	farben: ['haupt', 'akzent', 'dunkel'],
	groesse: 'mittel',
	b: 300,
	h: 300,
};
const ARTEN = ['punkte', 'konfetti', 'sterne'] as const;
const FORMEN_JE_ART: Partial<Record<(typeof ARTEN)[number], StreuParameter['formen']>> = {
	sterne: ['stern'],
	punkte: ['punkt'],
};
const mit = (art: (typeof ARTEN)[number], rest: Partial<StreuParameter> = {}): StreuParameter => ({
	...BASIS,
	art,
	formen: FORMEN_JE_ART[art] ?? BASIS.formen,
	...(art === 'punkte' ? { ecke: 'ul' as const } : {}),
	...rest,
});

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find(
		(k) => k.tag === 'section' && /\bseite\b/.test(attribut(k, 'class')?.wert ?? ''),
	);
	assert.ok(seite);
	return seite.nr;
};

describe('Streuung: Teile', () => {
	for (const art of ARTEN) {
		it(`${art}: gleiche Saat und Parameter ergeben dieselben Teile, andere Saat andere`, () => {
			assert.deepEqual(streue(mit(art)), streue(mit(art)));
			assert.ok(streue(mit(art)).length > 0);
			assert.notDeepEqual(streue(mit(art)), streue(mit(art, { saat: 4712 })));
		});

		it(`${art}: höchstens ${MAX_TEILE} Teile bei Dichte 1 und großer Fläche`, () => {
			for (const groesse of ['klein', 'mittel', 'gross'] as const) {
				const teile = streue(mit(art, { dichte: 1, groesse, b: 794, h: 1123 }));
				assert.ok(teile.length > 0 && teile.length <= MAX_TEILE, `${teile.length}`);
			}
		});

		it(`${art}: kein Teil ragt über den Rand`, () => {
			for (const [b, h] of [
				[300, 300],
				[120, 60],
				[794, 1123],
			] as const) {
				for (const t of streue(mit(art, { dichte: 1, b, h }))) {
					assert.ok(t.x - t.r >= 0 && t.y - t.r >= 0 && t.x + t.r <= b && t.y + t.r <= h, JSON.stringify(t));
				}
			}
		});

		it(`${art}: mit Zonen liegt jedes Teil in einer Zone`, () => {
			const zonen: Zone[] = [
				{ x: 0, y: 200, b: 100, h: 100 },
				{ x: 150, y: 0, b: 150, h: 60 },
			];
			const teile = streue(mit(art, { dichte: 1, zonen }));
			assert.ok(teile.length > 0);
			for (const t of teile) {
				assert.ok(
					zonen.some(
						(z) => t.x - t.r >= z.x && t.x + t.r <= z.x + z.b && t.y - t.r >= z.y && t.y + t.r <= z.y + z.h,
					),
					JSON.stringify(t),
				);
			}
		});

		it(`${art}: die Ausgabe geht ohne Fund durch frei.ts`, () => {
			assert.deepEqual(pruefeFreiesHtml(streuungHtml({ art, saat: 3, b: 300, h: 300, dichte: 1 })), []);
		});
	}

	it('Punkte stehen zur gewählten Ecke dichter', () => {
		const teile = streue(mit('punkte', { dichte: 1, ecke: 'ol' }));
		const nah = teile.filter((t) => t.x < 150 && t.y < 150).length;
		const fern = teile.filter((t) => t.x >= 150 && t.y >= 150).length;
		assert.ok(nah > fern);
	});

	it('Sterne: wenige große, viele kleine', () => {
		const r = streue(mit('sterne', { dichte: 1, saat: 9 }))
			.map((t) => t.r)
			.sort((a, b) => a - b);
		const mitte = r[Math.floor(r.length / 2)] ?? 0;
		assert.ok(r.filter((x) => x > mitte * 1.5).length < r.length / 2);
	});

	it('der Zufall kennt nur seine Saat', () => {
		const a = zufall(5);
		const b = zufall(5);
		assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
	});

	it('streue für 300 × 300 bei Dichte 1 läuft unter 5 ms', () => {
		for (const art of ARTEN) {
			streue(mit(art, { dichte: 1 }));
			const von = performance.now();
			for (let i = 0; i < 10; i += 1) {
				streue(mit(art, { dichte: 1, saat: i + 1 }));
			}
			const ms = (performance.now() - von) / 10;
			assert.ok(ms < 5, `${art}: ${ms} ms`);
		}
	});

	it('Zahlen stehen mit höchstens zwei Nachkommastellen', () => {
		assert.doesNotMatch(teileAlsSvg(streue(mit('sterne'))), /\d\.\d{3}/);
	});
});

describe('Streuung: in der Quelle', () => {
	const vorher = blattMit({});

	it('legeStreuung legt hinten ab, mit Teilen und gleichem Bild bei gleicher Saat', () => {
		const { nr, quelle } = legeStreuung(vorher, {
			seite: seiteIn(vorher),
			art: 'konfetti',
			saat: 77,
			lage: { x: 10, y: 20 },
		});
		assert.match(quelle, /class="ebene hinten"[^]*class="streuung"/);
		const stand = leseStreuung(quelle, nr);
		assert.equal(stand?.art, 'konfetti');
		assert.equal(stand?.saat, 77);
		assert.ok((stand?.anzahl ?? 0) > 0);
		const noch = legeStreuung(vorher, {
			seite: seiteIn(vorher),
			art: 'konfetti',
			saat: 77,
			lage: { x: 10, y: 20 },
		});
		assert.equal(noch.quelle, quelle);
	});

	it('die gespeicherten Kinder sind genau das, was streue mit den Attributen liefert', () => {
		const { nr, quelle } = legeStreuung(vorher, { seite: seiteIn(vorher), art: 'sterne', saat: 5 });
		const k = zerlege(quelle).knoten[nr];
		assert.ok(k);
		const gespeichert = quelle.slice(k.oeffnerEnde, k.schliesserStart);
		const stand = leseStreuung(quelle, nr);
		assert.ok(stand);
		assert.equal(gespeichert, teileAlsSvg(streue(parameterVon(stand, stand.b, stand.h))));
	});

	it('Würfeln ändert nur die Saat und die Teile', () => {
		const { nr, quelle } = legeStreuung(vorher, { seite: seiteIn(vorher), art: 'punkte', saat: 5 });
		const neu = wuerfle(quelle, nr, 999);
		assert.equal(leseStreuung(neu, nr)?.saat, 999);
		assert.notEqual(neu, quelle);
		assert.equal(leseStreuung(wuerfle(quelle, nr, 5), nr)?.saat, 6);
	});

	it('Größe ändern erzeugt mit derselben Saat neu und kehrt zum selben Bild zurück', () => {
		const { nr, quelle } = legeStreuung(vorher, { seite: seiteIn(vorher), art: 'konfetti', saat: 12 });
		const klein = setzeLage(quelle, nr, { b: 150, h: 100 });
		assert.notEqual(klein, quelle);
		assert.equal(leseStreuung(klein, nr)?.saat, 12);
		assert.match(klein, /viewBox="0 0 150 100"/);
		assert.equal(setzeLage(klein, nr, { b: 300, h: 300 }), quelle);
	});

	it('setzeStreuung ändert Art, Formen, Farben, Größe, Dichte; die Art setzt die Standard-Formen', () => {
		const { nr, quelle } = legeStreuung(vorher, { seite: seiteIn(vorher), art: 'konfetti', saat: 12 });
		const a = setzeStreuung(quelle, nr, { art: 'sterne' });
		assert.deepEqual(leseStreuung(a, nr)?.formen, ['stern']);
		const b = setzeStreuung(a, nr, { formen: ['punkt', 'raute'], farben: ['a1'], groesse: 'gross', dichte: 3 });
		const s = leseStreuung(b, nr);
		assert.deepEqual([s?.formen, s?.farben, s?.groesse, s?.dichte], [['punkt', 'raute'], ['a1'], 'gross', 1]);
	});

	it('fehlende Kinder entstehen aus den Attributen, vorhandene bleiben', () => {
		const leer =
			'<svg class="streuung" data-lage="frei" data-streuung="sterne" data-dichte="0.4" style="--x:0px;--y:0px;--b:200px;--h:100px"></svg>';
		const ganz = blattMit({ hinten: [leer] });
		const neu = ergaenzeStreuungen(ganz);
		assert.match(neu, /<polygon/);
		assert.match(neu, /data-saat="\d+"/);
		assert.equal(ergaenzeStreuungen(neu), neu);
		assert.equal(ergaenzeStreuungen(vorher), vorher);
	});

	it('Teile sind keine eigenen Gestaltungselemente', () => {
		const { quelle } = legeStreuung(vorher, { seite: seiteIn(vorher), art: 'konfetti', saat: 3 });
		assert.equal(quelle.split('data-lage="frei"').length - 1, 1);
	});
});
