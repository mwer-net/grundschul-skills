import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KERN_NEUE_ZAHLEN, neueZahlenImKern, zahlenraumDerKlasse } from './neue-zahlen';

/** Immer dieselbe Folge, damit die Grenzen sicher getroffen werden. */
const folge = (...werte: number[]) => {
	let i = 0;
	return () => werte[i++ % werte.length] ?? 0;
};

describe('197-U6: Neue Zahlen im Kern', () => {
	it('Zahlenraum je Klasse', () => {
		assert.deepEqual([1, 2, 3, 4, undefined].map(zahlenraumDerKlasse), [20, 100, 1000, 1_000_000, 100]);
	});

	it('bleibt im Zahlenraum der Klasse und im Platz der Abbildung', () => {
		for (const z of [0, 0.5, 0.999]) {
			const menge = neueZahlenImKern('x-menge', {}, 1, folge(z));
			assert.ok(Number(menge?.n) >= 1 && Number(menge?.n) <= 20);
			const feld = neueZahlenImKern('x-zwanzigerfeld', { n: '3', n2: '2' }, 4, folge(z, z));
			assert.ok(Number(feld?.n) + Number(feld?.n2) <= 20);
			const sp = neueZahlenImKern('x-strichpunkt', {}, 2, folge(z));
			assert.ok(Number(sp?.z) * 10 + Number(sp?.e) <= 99);
		}
	});

	it('Würfel nur flach mit Augen oder Zahl; unbekannte Arten liefern nichts', () => {
		assert.ok(neueZahlenImKern('x-wuerfel', {}, 1, folge(0.4))?.augen);
		assert.equal(neueZahlenImKern('x-wuerfel', { ansicht: 'netz' }, 1), null);
		assert.equal(neueZahlenImKern('x-stellentafel', {}, 2), null);
		assert.equal('x-diagramm' in KERN_NEUE_ZAHLEN, false);
	});
});
