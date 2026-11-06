import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FIGUR_ANKER } from '../../web/e2e/gestaltung-daten';
import { leseLage } from './gestaltung';
import { DRUCKRAND } from './gestaltung-arten';
import type { Seitenmass } from './gestaltung-pruefung';
import { holeInSeite } from './gestaltung-pruefung';
import { attribut, zerlege } from './quelltext';

const A4 = { breite: 794, hoehe: 1123 };

const form = (stil: string) =>
	`<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="${stil}"><circle cx="50" cy="50" r="48"/></svg>`;

const nrDer = (quelle: string, selektor: (k: ReturnType<typeof zerlege>['knoten'][number]) => boolean) => {
	const k = zerlege(quelle).knoten.find(selektor);
	assert.ok(k, 'Element fehlt');
	return k.nr;
};

const formNr = (quelle: string) => nrDer(quelle, (k) => attribut(k, 'data-form')?.wert === 'kreis');

/** Ein Element ohne Drehung in der Ebene: Rechteck und Größe folgen aus der Lage. */
const massOhneDrehen = (x: number, y: number, b: number, h: number): Seitenmass => ({
	seite: A4,
	rechteck: { links: x, oben: y, breite: b, hoehe: h },
	groesse: { breite: b, hoehe: h },
});

/** Ganz innerhalb des Druckrands, für ein Element ohne Drehung in der Ebene. */
const liegtInnen = (quelle: string, nr: number) => {
	const { b = 0, h = 0, x = 0, y = 0 } = leseLage(quelle, nr);
	assert.ok(x >= DRUCKRAND && y >= DRUCKRAND, `links oben im Druckrand: ${x}, ${y}`);
	assert.ok(x + b <= A4.breite - DRUCKRAND, `rechts im Druckrand: ${x + b}`);
	assert.ok(y + h <= A4.hoehe - DRUCKRAND, `unten im Druckrand: ${y + h}`);
};

/** Bis auf `style` Zeichen für Zeichen gleich: nur die Lage hat sich geändert, also ein Schritt ohne neue Nummern. */
const nurDerStil = (alt: string, neu: string) =>
	assert.equal(neu.replace(/style="[^"]*"/g, ''), alt.replace(/style="[^"]*"/g, ''));

describe('In die Seite holen (096)', () => {
	it('verschiebt ein Element, das links zu mehr als der Hälfte außen liegt, bis hinter den Druckrand', () => {
		const quelle = blattMit({ vorne: [form('--x:-60px;--y:850px;--b:100px;--h:100px')] });
		const nr = formNr(quelle);
		const neu = holeInSeite(quelle, nr, massOhneDrehen(-60, 850, 100, 100));
		assert.deepEqual(leseLage(neu, nr), { x: 20, y: 850, b: 100, h: 100 });
		liegtInnen(neu, nr);
		nurDerStil(quelle, neu);
	});

	it('verschiebt nach links oben, wenn es rechts unten hinausragt; die Größe bleibt', () => {
		const quelle = blattMit({ vorne: [form('--x:760px;--y:1100px;--b:100px;--h:100px')] });
		const nr = formNr(quelle);
		const neu = holeInSeite(quelle, nr, massOhneDrehen(760, 1100, 100, 100));
		assert.deepEqual(leseLage(neu, nr), { x: 674, y: 1003, b: 100, h: 100 });
		liegtInnen(neu, nr);
	});

	it('verkleinert nur, wenn es größer ist als die Fläche innerhalb des Druckrands, mit gleichem Seitenverhältnis', () => {
		const quelle = blattMit({ vorne: [form('--x:-50px;--y:200px;--b:900px;--h:300px')] });
		const nr = formNr(quelle);
		const neu = holeInSeite(quelle, nr, massOhneDrehen(-50, 200, 900, 300));
		const { b = 0, h = 0 } = leseLage(neu, nr);
		assert.ok(b < 900 && b >= 750, `Breite ${b}`);
		assert.ok(Math.abs(b / h - 3) < 0.02, `Seitenverhältnis ${b / h}`);
		liegtInnen(neu, nr);
	});

	it('setzt ohne Größe in der Lage nur die Breite, die Höhe folgt dem Bild', () => {
		const bild =
			'<img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:-100px;--y:100px">';
		const quelle = blattMit({ vorne: [bild] });
		const nr = nrDer(quelle, (k) => attribut(k, 'data-figur')?.wert === 'wilma');
		const neu = holeInSeite(quelle, nr, massOhneDrehen(-100, 100, 1000, 1000));
		const lage = leseLage(neu, nr);
		assert.equal(lage.h, undefined);
		assert.ok((lage.b ?? 0) <= A4.breite - 2 * DRUCKRAND, `Breite ${lage.b}`);
		assert.equal(lage.x, DRUCKRAND + 1);
	});

	it('rechnet bei Drehung mit dem Rechteck danach und hält die Mitte', () => {
		const quelle = blattMit({ vorne: [form('--x:-100px;--y:500px;--b:100px;--h:100px;--drehen:45deg')] });
		const nr = formNr(quelle);
		// 100 × 100 um 45° gedreht: außen 141 × 141 um dieselbe Mitte (-50, 550).
		const neu = holeInSeite(quelle, nr, {
			seite: A4,
			rechteck: { links: -120.5, oben: 479.5, breite: 141, hoehe: 141 },
			groesse: { breite: 100, hoehe: 100 },
		});
		const { drehen, x = 0, y } = leseLage(neu, nr);
		assert.equal(drehen, 45);
		assert.equal(y, 500, 'senkrecht lag es schon innen');
		assert.ok(x + 50 - 70.5 >= DRUCKRAND, `gedreht im Druckrand: ${x}`);
	});

	it('verschiebt am Anker um den Unterschied, die Koordinaten bleiben die des Bausteins', () => {
		const quelle = blattMit({ anker: [FIGUR_ANKER] });
		const nr = nrDer(quelle, (k) => attribut(k, 'data-anker') !== undefined);
		// --x:560px in der Aufgabe, die bei 90 px beginnt: auf der Seite 650 bis 760, um 100 px nach rechts gezogen.
		const neu = holeInSeite(quelle, nr, {
			seite: A4,
			rechteck: { links: 750, oben: 60, breite: 110, hoehe: 110 },
			groesse: { breite: 110, hoehe: 110 },
		});
		assert.deepEqual(leseLage(neu, nr), { x: 560 + (A4.breite - DRUCKRAND - 1 - 110 - 750), y: -40, b: 110 });
	});

	it('lehnt ab, was keine Gestaltung ist', () => {
		const quelle = blattMit();
		const nr = nrDer(quelle, (k) => k.tag === 'h1');
		assert.throws(() => holeInSeite(quelle, nr, massOhneDrehen(0, 0, 10, 10)), /keine Gestaltung/);
	});
});
