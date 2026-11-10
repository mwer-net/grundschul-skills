import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formVon, standardWerte } from './formen';
import type { Punkt } from './formen-geometrie';
import { zuegeAus } from './formen-geometrie';
import { maskeFuer, MASKEN_FORMEN, MASKEN_PUNKTE, tastePfadAb } from './formen-masken';
import { pruefeFreiesHtml } from './frei';

/** Der Umriss fein abgetastet (je Segment 400 Punkte), um den Abstand eines Punkts zum Pfad zu messen. */
const feinerUmriss = (d: string): Punkt[] => {
	const punkte: Punkt[] = [];
	for (const z of zuegeAus(d) ?? []) {
		let von = z.start;
		for (const s of z.segmente) {
			for (let i = 0; i <= 400; i += 1) {
				const t = i / 400;
				const u = 1 - t;
				if (s.art === 'L') {
					punkte.push({ x: von.x + (s.p.x - von.x) * t, y: von.y + (s.p.y - von.y) * t });
				} else if (s.art === 'Q') {
					punkte.push({
						x: u * u * von.x + 2 * u * t * s.c.x + t * t * s.p.x,
						y: u * u * von.y + 2 * u * t * s.c.y + t * t * s.p.y,
					});
				} else {
					punkte.push({
						x: u ** 3 * von.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t ** 3 * s.p.x,
						y: u ** 3 * von.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t ** 3 * s.p.y,
					});
				}
			}
			von = s.p;
		}
		// Der schließende Strich zurück zum Start.
		for (let i = 0; i <= 400; i += 1) {
			const t = i / 400;
			punkte.push({ x: von.x + (z.start.x - von.x) * t, y: von.y + (z.start.y - von.y) * t });
		}
	}
	return punkte;
};

const abstand = (p: Punkt, umriss: readonly Punkt[]) =>
	Math.min(...umriss.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));

describe('Masken aus Formen (111)', () => {
	for (const form of MASKEN_FORMEN) {
		it(`tastePfadAb liefert 64 Punkte auf dem Umriss: ${form.art}`, () => {
			const { d } = form.zeichne(standardWerte(form), 240, 180, 0);
			const punkte = tastePfadAb(d);
			assert.equal(punkte.length, MASKEN_PUNKTE);
			const umriss = feinerUmriss(d);
			for (const p of punkte) {
				assert.ok(abstand(p, umriss) < 0.5, `${form.art}: ${p.x}, ${p.y} liegt neben dem Pfad`);
			}
		});
	}

	it('die Spitzen des Sterns sind Punkte der Maske (keine abgeschnittenen Ecken)', () => {
		const stern = formVon('stern');
		assert.ok(stern);
		const { d } = stern.zeichne(standardWerte(stern), 200, 200, 0);
		const ecken = (zuegeAus(d)?.[0]?.segmente ?? []).map((s) => s.p);
		const punkte = tastePfadAb(d);
		for (const e of ecken) {
			assert.ok(abstand(e, punkte) < 0.01, `Ecke ${e.x}, ${e.y} fehlt`);
		}
	});

	it('Kreis wird ellipse(), Rechteck mit Radius inset() mit round, ohne Radius inset(0)', () => {
		assert.equal(maskeFuer('ellipse', {}, 200, 120), 'ellipse(50% 50% at 50% 50%)');
		assert.equal(maskeFuer('rechteck', { 'data-radius': 24 }, 200, 120), 'inset(0 round 24px)');
		assert.equal(maskeFuer('rechteck', {}, 200, 120), 'inset(0)');
		// Der Radius ist höchstens die halbe kurze Seite.
		assert.equal(maskeFuer('rechteck', { 'data-radius': 200 }, 200, 120), 'inset(0 round 60px)');
	});

	it('alles andere wird polygon() mit 64 Punkten in Prozent', () => {
		const maske = maskeFuer('stern', {}, 240, 240) ?? '';
		assert.match(maske, /^polygon\(/);
		const paare = maske.slice('polygon('.length, -1).split(', ');
		assert.equal(paare.length, MASKEN_PUNKTE);
		for (const paar of paare) {
			assert.match(paar, /^-?[\d.]+% -?[\d.]+%$/);
			for (const w of paar.split(' ').map((x) => parseFloat(x))) {
				assert.ok(w >= -0.01 && w <= 100.01, paar);
			}
		}
	});

	it('Formen mit Text, Linien und Unbekanntes geben keine Maske', () => {
		assert.equal(maskeFuer('sprechblase', {}, 200, 100), null);
		assert.equal(maskeFuer('linie', {}, 200, 100), null);
		assert.equal(maskeFuer('gibtsnicht', {}, 200, 100), null);
	});

	it('jede Maske geht durch die Allow-Liste (frei.ts), path() nicht', () => {
		for (const form of MASKEN_FORMEN) {
			const maske = maskeFuer(form.art, {}, 220, 160);
			assert.ok(maske, form.art);
			const html = `<img class="bild-frei" data-lage="frei" data-maske="${form.art}" src="bilder/a.png" alt="" style="--x:0px;--y:0px;--b:220px;--h:160px;clip-path:${maske}">`;
			assert.deepEqual(pruefeFreiesHtml(`<div class="ebene vorne">${html}</div>`), [], form.art);
		}
		assert.deepEqual(pruefeFreiesHtml('<div style="clip-path:circle(40% at 50% 50%)"></div>'), []);
		assert.notDeepEqual(pruefeFreiesHtml('<div style="clip-path:path(\'M0 0 L10 10 Z\')"></div>'), []);
	});
});
