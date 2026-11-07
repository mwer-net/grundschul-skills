import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DRUCKRAND } from './druckrand';
import type { Kandidat } from './einrasten';
import { FANGWEITE, rasteEin, umschliessend } from './einrasten';
import type { Kasten } from './geste';
import { GRIFFE } from './geste';

/** A4 hoch in Koordinaten der Seite, Innenrand 60 px wie `--rand` in `blatt.css`. */
const SEITE: Kandidat = { links: 0, oben: 0, rechts: 794, unten: 1123, fang: 'mitte' };
const DRUCK: Kandidat = {
	links: DRUCKRAND,
	oben: DRUCKRAND,
	rechts: 794 - DRUCKRAND,
	unten: 1123 - DRUCKRAND,
	fang: 'kanten',
};
const INNEN: Kandidat = { links: 60, oben: 60, rechts: 734, unten: 1063, fang: 'kanten' };
const ANDERES: Kandidat = { links: 500, oben: 600, rechts: 600, unten: 700 };
const ALLE = [SEITE, DRUCK, INNEN, ANDERES];

const kasten = (x: number, y: number, b = 100, h = 50, drehen = 0): Kasten => ({ x, y, b, h, drehen });

describe('rasteEin beim Ziehen', () => {
	it('rastet die Mitte an der Seitenmitte und zeigt eine senkrechte Linie', () => {
		// Mitte bei 400, Seitenmitte bei 397.
		const { lage, linien } = rasteEin(kasten(350, 300), ALLE, 1);
		assert.equal(lage.x, 347);
		assert.equal(lage.y, 300);
		assert.ok(linien.some((l) => l.x1 === 397 && l.x2 === 397 && l.y1 === 0 && l.y2 === 1123));
	});

	it('rastet die linke Kante am Druckrand und am Innenrand', () => {
		assert.equal(rasteEin(kasten(22, 300), ALLE, 1).lage.x, DRUCKRAND);
		assert.equal(rasteEin(kasten(63, 300), ALLE, 1).lage.x, 60);
		// Rechte Kante am Innenrand rechts.
		assert.equal(rasteEin(kasten(637, 300), ALLE, 1).lage.x, 634);
	});

	it('rastet an Kante und Mitte eines anderen Elements', () => {
		// Obere Kante 603 → 600.
		assert.equal(rasteEin(kasten(100, 603), ALLE, 1).lage.y, 600);
		// Linke Kante 552 → Mitte des anderen bei 550.
		const { lage, linien } = rasteEin(kasten(552, 800), ALLE, 1);
		assert.equal(lage.x, 550);
		assert.ok(linien.some((l) => l.x1 === 550 && l.y1 === 600 && l.y2 === 850));
	});

	it('außerhalb der Fangweite rastet nichts', () => {
		// Linke Kante 207, Mitte 257, rechte Kante 307: keine Linie näher als die Fangweite.
		const lage = kasten(207, 300);
		const ergebnis = rasteEin(lage, ALLE, 1);
		assert.deepEqual(ergebnis.lage, lage);
		assert.deepEqual(ergebnis.linien, []);
		// Eins mehr als die Fangweite neben dem Innenrand: nichts.
		assert.equal(rasteEin(kasten(60 + FANGWEITE + 1, 300), ALLE, 1).lage.x, 60 + FANGWEITE + 1);
	});

	it('die Fangweite gilt auf dem Bildschirm: bei Zoom 2 nur 3 px im Material', () => {
		assert.equal(rasteEin(kasten(64, 300), ALLE, 2).lage.x, 64);
		assert.equal(rasteEin(kasten(63, 300), ALLE, 2).lage.x, 60);
		assert.equal(rasteEin(kasten(70, 300), ALLE, 0.5).lage.x, 60);
	});

	it('mit `aus` (⌘) rastet nichts', () => {
		const lage = kasten(350, 300);
		assert.deepEqual(rasteEin(lage, ALLE, 1, { aus: true }), { lage, linien: [] });
	});

	it('gedrehte Elemente rasten mit dem umschließenden Rechteck', () => {
		// 100 × 100, um 45° gedreht: umschließend ±70,7 um die Mitte.
		const lage = kasten(100, 300, 100, 100, 45);
		const r = umschliessend(lage);
		assert.ok(Math.abs(r.links - (150 - 50 * Math.SQRT2)) < 1e-6);
		const { lage: neu } = rasteEin({ ...lage, x: lage.x - r.links + 62 }, ALLE, 1);
		assert.ok(Math.abs(umschliessend(neu).links - 60) < 1e-6);
	});
});

describe('rasteEin beim Skalieren', () => {
	it('rastet nur die bewegte Kante', () => {
		// Rechter Griff: rechte Kante 736 → 734 (Innenrand), links bleibt.
		const { lage } = rasteEin(kasten(400, 300, 336), ALLE, 1, { griff: GRIFFE.rechts });
		assert.equal(lage.x, 400);
		assert.equal(lage.b, 334);
		// Die linke Kante läge 3 px neben dem Innenrand, rastet aber nicht: Sie bewegt sich nicht.
		const links = rasteEin(kasten(63, 300, 200), ALLE, 1, { griff: GRIFFE.rechts });
		assert.equal(links.lage.x, 63);
		assert.equal(links.lage.b, 200);
	});

	it('am linken Griff wandert die linke Kante, die rechte bleibt', () => {
		const { lage } = rasteEin(kasten(63, 300, 200), ALLE, 1, { griff: GRIFFE.links });
		assert.equal(lage.x, 60);
		assert.equal(lage.b, 203);
	});

	it('mit festem Verhältnis folgt die andere Achse', () => {
		const { lage } = rasteEin(kasten(400, 300, 336, 168), ALLE, 1, {
			griff: GRIFFE['unten-rechts'],
			verhaeltnis: true,
		});
		assert.equal(lage.b, 334);
		assert.equal(lage.h, 167);
		assert.equal(lage.y, 300);
	});

	it('gedreht oder mit `aus` rastet beim Skalieren nichts', () => {
		const gedreht = kasten(400, 300, 336, 50, 10);
		assert.deepEqual(rasteEin(gedreht, ALLE, 1, { griff: GRIFFE.rechts }).lage, gedreht);
		const gerade = kasten(400, 300, 336);
		assert.deepEqual(rasteEin(gerade, ALLE, 1, { griff: GRIFFE.rechts, aus: true }).lage, gerade);
	});
});

describe('Leistung (4.12)', () => {
	it('50 Kandidaten, 1000 Bewegungen deutlich unter 16 ms je Bewegung', () => {
		const viele: Kandidat[] = Array.from({ length: 50 }, (_, i) => ({
			links: (i * 37) % 700,
			oben: (i * 53) % 1000,
			rechts: ((i * 37) % 700) + 60,
			unten: ((i * 53) % 1000) + 40,
		}));
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			rasteEin(kasten(i % 700, (i * 3) % 1000), [...ALLE, ...viele], 1);
		}
		assert.ok((performance.now() - start) / 1000 < 1);
	});
});
