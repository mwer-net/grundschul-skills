import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	begrenzeZoom,
	massstabVon,
	naechsteStufe,
	radFaktor,
	rasteZoom,
	rollenNachZoom,
	zoomAusSpeicher,
} from './zoom';

/** A4 hoch im Editor: 794 px Blatt und 2 × 16 px Rand, eine Seite samt Rand 1155 px. */
const A4 = { breite: 826, seite: 1155 };

const nah = (ist: number, soll: number, text?: string) =>
	assert.ok(Math.abs(ist - soll) < 0.005, `${text ?? ''} ${ist} statt ${soll}`);

describe('Zoom aufs Blatt (184)', () => {
	describe('massstabVon', () => {
		it('`breite`: so breit, wie Platz ist, höchstens 100 %', () => {
			assert.equal(massstabVon({ breite: 952, masse: A4, sichtHoehe: 900, zoom: 'breite' }).skala, 1);
			nah(massstabVon({ breite: 672, masse: A4, sichtHoehe: 900, zoom: 'breite' }).skala, 0.81);
			assert.equal(massstabVon({ breite: 2000, masse: A4, sichtHoehe: 900, zoom: 'breite' }).skala, 1);
		});

		it('eine Zahl ist der echte Maßstab, auch wenn das Blatt dann breiter ist als die Fläche', () => {
			assert.deepEqual(massstabVon({ breite: 672, masse: A4, sichtHoehe: 900, zoom: 1 }), {
				innenBreite: 826,
				links: 0,
				skala: 1,
			});
			const schmal = massstabVon({ breite: 952, masse: A4, sichtHoehe: 900, zoom: 0.5 });
			assert.equal(schmal.innenBreite, 952);
			assert.equal(schmal.links, (952 - 413) / 2);
		});

		it('`einpassen`: der kleinste Wert aus Breite, Höhe und 2', () => {
			nah(massstabVon({ breite: 952, masse: A4, sichtHoehe: 900, zoom: 'einpassen' }).skala, 900 / 1155);
			nah(massstabVon({ breite: 672, masse: A4, sichtHoehe: 2000, zoom: 'einpassen' }).skala, 672 / 826);
			assert.equal(massstabVon({ breite: 4000, masse: A4, sichtHoehe: 4000, zoom: 'einpassen' }).skala, 2);
		});

		it('ohne Maße 1', () => {
			assert.equal(massstabVon({ breite: 952, masse: null, sichtHoehe: 900, zoom: 'einpassen' }).skala, 1);
		});
	});

	it('naechsteStufe geht vom Wert aus, nicht vom Platz in der Liste', () => {
		assert.equal(naechsteStufe(0.81, 1), 1);
		assert.equal(naechsteStufe(0.81, -1), 0.75);
		assert.equal(naechsteStufe(0.3, -1), 0.25);
		assert.equal(naechsteStufe(0.25, -1), undefined);
		assert.equal(naechsteStufe(2, 1), undefined);
	});

	it('begrenzeZoom: 25 bis 200 %; steht das Blatt schon außerhalb, springt es nicht', () => {
		assert.equal(begrenzeZoom(3, 1), 2);
		assert.equal(begrenzeZoom(0.1, 1), 0.25);
		assert.equal(begrenzeZoom(0.15, 0.2), 0.2);
		assert.equal(begrenzeZoom(0.22, 0.2), 0.22);
	});

	it('rasteZoom: nahe einer Stufe auf die Stufe, sonst ganze Prozent', () => {
		assert.equal(rasteZoom(0.99), 1);
		assert.equal(rasteZoom(1.019), 1);
		assert.equal(rasteZoom(1.03), 1.03);
		assert.equal(rasteZoom(1.374), 1.37);
		assert.equal(rasteZoom(0.245), 0.25);
	});

	it('radFaktor: Rad hoch vergrößert, ein Ereignis zählt höchstens 25 px', () => {
		assert.equal(radFaktor(0, 0), 1);
		assert.ok(radFaktor(-8, 0) > 1);
		assert.ok(radFaktor(8, 0) < 1);
		assert.equal(radFaktor(100, 0), radFaktor(25, 0));
		assert.equal(radFaktor(3, 1), radFaktor(25, 0));
	});

	describe('rollenNachZoom', () => {
		it('hält die Stelle unter dem Zeiger', () => {
			const neu = rollenNachZoom({
				vorher: { skala: 1, links: 0 },
				nachher: { skala: 2, links: 0 },
				rollen: { x: 0, y: 100 },
				punkt: { x: 300, y: 200 },
				oben: 40,
			});
			assert.deepEqual(neu, { x: 300, y: 360 });
		});

		it('Verkleinern am Ende: der alte Rollstand zählt, nicht der vom Browser gekappte', () => {
			const neu = rollenNachZoom({
				vorher: { skala: 2, links: 0 },
				nachher: { skala: 1, links: 0 },
				rollen: { x: 0, y: 3750 },
				punkt: { x: 0, y: 425 },
				oben: 0,
			});
			assert.equal(neu.y, 1662.5);
		});

		it('gleicher Maßstab, gleicher Rollstand', () => {
			const lage = { skala: 0.5, links: 64 };
			const rollen = { x: 12, y: 345 };
			const neu = rollenNachZoom({ vorher: lage, nachher: lage, rollen, punkt: { x: 200, y: 300 }, oben: 48 });
			assert.deepEqual(neu, rollen);
		});
	});

	describe('zoomAusSpeicher', () => {
		const speicher = (neu: string | null, alt: string | null) => {
			const werte: Record<string, string | null> = { 'schoolbox-blatt-zoom': neu, 'schoolbox-zoom': alt };
			return zoomAusSpeicher((k) => werte[k] ?? null);
		};

		it('neues Gerät: so breit wie Platz', () => {
			assert.equal(speicher(null, null), 'breite');
		});

		it('vom alten Schlüssel gilt nur „einpassen“', () => {
			assert.equal(speicher(null, 'einpassen'), 'einpassen');
			for (const alt of ['1', '0.5', '1.5', '2', 'abc']) {
				assert.equal(speicher(null, alt), 'breite', alt);
			}
		});

		it('der neue Schlüssel gilt vor dem alten', () => {
			assert.equal(speicher('einpassen', '1.5'), 'einpassen');
			assert.equal(speicher('1.37', 'einpassen'), 1.37);
			assert.equal(speicher('0.25', null), 0.25);
			assert.equal(speicher('2', null), 2);
		});

		it('Unbekanntes oder außerhalb der Grenzen: so breit wie Platz', () => {
			for (const neu of ['5', 'abc', '0', '']) {
				assert.equal(speicher(neu, null), 'breite', neu);
			}
		});
	});
});
