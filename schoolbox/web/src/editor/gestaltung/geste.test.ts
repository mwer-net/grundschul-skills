import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GriffName, Kasten } from './geste';
import {
	bewege,
	drehe,
	dreheUm,
	ECKEN,
	GRIFFE,
	griffeFuer,
	haeltVerhaeltnis,
	normiereWinkel,
	punktImBehaelter,
	skaliere,
	skaliereMit,
	winkelZu,
} from './geste';

const K: Kasten = { x: 100, y: 200, b: 200, h: 100, drehen: 0 };

const nah = (ist: number, soll: number, text = '') => assert.ok(Math.abs(ist - soll) < 1e-6, `${text} ${ist} ≠ ${soll}`);

/** Die Ecke gegenüber dem Griff, in Koordinaten vor dem Drehen. */
const gegenecke = (k: Kasten, griff: GriffName) => {
	const { x, y } = GRIFFE[griff];
	return punktImBehaelter(k, x < 0 ? k.b : 0, y < 0 ? k.h : 0);
};

describe('bewege', () => {
	it('verschiebt um den Weg des Zeigers', () => {
		assert.deepEqual(bewege(K, 12, -7), { ...K, x: 112, y: 193 });
	});

	it('sperrt mit ⇧ auf die Achse mit dem größeren Weg', () => {
		assert.deepEqual(bewege(K, 30, 4, { achse: true }), { ...K, x: 130 });
		assert.deepEqual(bewege(K, -3, 25, { achse: true }), { ...K, y: 225 });
	});
});

describe('skaliere', () => {
	it('an jeder Ecke bleibt die Gegenecke stehen', () => {
		for (const griff of ECKEN) {
			const { x, y } = GRIFFE[griff];
			const neu = skaliere(K, griff, 20 * x, 10 * y);
			nah(neu.b, 220, griff);
			nah(neu.h, 110, griff);
			const vorher = gegenecke(K, griff);
			const nachher = gegenecke(neu, griff);
			nah(nachher.x, vorher.x, griff);
			nah(nachher.y, vorher.y, griff);
		}
	});

	it('bei gedrehtem Element bleibt die Gegenecke im Blatt stehen', () => {
		for (const drehen of [30, -45, 90, 172.5]) {
			const k = { ...K, drehen };
			for (const griff of ECKEN) {
				const neu = skaliere(k, griff, 37, -23);
				const vorher = gegenecke(k, griff);
				const nachher = gegenecke(neu, griff);
				nah(nachher.x, vorher.x, `${drehen} ${griff}`);
				nah(nachher.y, vorher.y, `${drehen} ${griff}`);
				nah(neu.drehen, drehen);
			}
		}
	});

	it('rechnet den Weg in die Richtung des gedrehten Elements um', () => {
		// Um 90° gedreht zeigt die rechte Kante nach unten: Ziehen nach unten macht es breiter.
		const neu = skaliere({ ...K, drehen: 90 }, 'rechts', 0, 40);
		nah(neu.b, 240);
		nah(neu.h, 100);
	});

	it('proportional hält das Verhältnis, auch wenn der Zeiger schräg zieht', () => {
		const neu = skaliere(K, 'unten-rechts', 100, 5, { verhaeltnis: true });
		nah(neu.b, 300);
		nah(neu.h, 150);
		const klein = skaliere(K, 'oben-links', 5, 40, { verhaeltnis: true });
		nah(klein.b / klein.h, 2);
		nah(klein.h, 60);
	});

	it('frei ändert Breite und Höhe getrennt, Kanten nur eine Richtung', () => {
		const neu = skaliere(K, 'unten-rechts', 100, 5);
		nah(neu.b, 300);
		nah(neu.h, 105);
		const kante = skaliere(K, 'links', -30, 50);
		assert.deepEqual([kante.x, kante.y, kante.b, kante.h], [70, 200, 230, 100]);
	});

	it('mit ⌥ von der Mitte: beide Seiten wachsen, die Mitte bleibt', () => {
		const neu = skaliere(K, 'unten-rechts', 10, 10, { mitte: true });
		assert.deepEqual([neu.x, neu.y, neu.b, neu.h], [90, 190, 220, 120]);
		const prop = skaliere({ ...K, drehen: 20 }, 'oben-rechts', 50, 0, { mitte: true, verhaeltnis: true });
		nah(prop.x + prop.b / 2, 200);
		nah(prop.y + prop.h / 2, 250);
		nah(prop.b / prop.h, 2);
	});

	it('wird nie kleiner als das Minimum', () => {
		const neu = skaliere(K, 'unten-rechts', -500, -500);
		assert.deepEqual([neu.b, neu.h], [8, 8]);
		const prop = skaliere(K, 'unten-rechts', -500, -500, { verhaeltnis: true });
		nah(prop.h, 8);
		nah(prop.b, 16);
	});
});

describe('drehe', () => {
	it('setzt den Winkel auf eine Nachkommastelle', () => {
		assert.equal(drehe(K, 12.345).drehen, 12.3);
		assert.equal(drehe(K, 190).drehen, -170);
	});

	it('rastet mit ⇧ in 15°-Schritten', () => {
		assert.equal(drehe(K, 22, { raster15: true }).drehen, 15);
		assert.equal(drehe(K, 23, { raster15: true }).drehen, 30);
		assert.equal(drehe(K, -8, { raster15: true }).drehen, -15);
		assert.equal(drehe(K, 7, { raster15: true }).drehen, 0);
	});

	it('misst den Winkel ab oben im Uhrzeigersinn', () => {
		const m = { x: 0, y: 0 };
		nah(normiereWinkel(winkelZu(m, { x: 0, y: -10 })), 0);
		nah(normiereWinkel(winkelZu(m, { x: 10, y: 0 })), 90);
		nah(normiereWinkel(winkelZu(m, { x: -10, y: 0 })), -90);
	});
});

describe('griffeFuer und haeltVerhaeltnis', () => {
	it('gibt jeder Art ihre Griffe', () => {
		assert.deepEqual(griffeFuer('proportional'), ECKEN);
		assert.equal(griffeFuer('frei').length, 8);
		assert.deepEqual(griffeFuer('breite'), ['links', 'rechts']);
		assert.deepEqual(griffeFuer('text'), [...ECKEN, 'links', 'rechts']);
	});

	it('proportional hält, ⇧ gibt frei; frei umgekehrt; Kanten nie', () => {
		assert.equal(haeltVerhaeltnis('proportional', 'unten-rechts', false), true);
		assert.equal(haeltVerhaeltnis('proportional', 'unten-rechts', true), false);
		assert.equal(haeltVerhaeltnis('frei', 'oben-links', false), false);
		assert.equal(haeltVerhaeltnis('frei', 'oben-links', true), true);
		assert.equal(haeltVerhaeltnis('text', 'oben-links', true), true);
		assert.equal(haeltVerhaeltnis('frei', 'rechts', true), false);
	});
});

// >> 113
describe('dreheUm und skaliereMit (Mehrfachauswahl)', () => {
	it('dreht um einen fremden Punkt: die Mitte wandert auf dem Kreis, der Winkel kommt dazu', () => {
		const k: Kasten = { x: 0, y: 0, b: 20, h: 20, drehen: 10 };
		const r = dreheUm(k, { x: 110, y: 10 }, 90);
		nah(r.x + r.b / 2, 110, 'mx');
		nah(r.y + r.h / 2, -90, 'my');
		nah(r.drehen, 100, 'drehen');
		assert.equal(r.b, 20);
	});

	it('um die eigene Mitte bleibt die Lage', () => {
		const r = dreheUm(K, { x: 200, y: 250 }, 45);
		nah(r.x, K.x);
		nah(r.y, K.y);
	});

	it('wächst mit der Auswahl, die Mitte bleibt relativ an ihrer Stelle', () => {
		const von: Kasten = { x: 0, y: 0, b: 100, h: 50, drehen: 0 };
		const nach: Kasten = { x: 10, y: 20, b: 200, h: 100, drehen: 0 };
		const r = skaliereMit({ x: 50, y: 0, b: 50, h: 50, drehen: 30 }, von, nach);
		nah(r.b, 100);
		nah(r.h, 100);
		nah(r.x + r.b / 2, 10 + 75 * 2);
		nah(r.y + r.h / 2, 20 + 25 * 2);
		assert.equal(r.drehen, 30);
	});
});
// << 113
