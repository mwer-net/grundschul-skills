import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './index';
import { gruppiere, INSPEKTOR_TEILE } from './index';

const art = (name: string) => {
	const b = BAUSTEINE.find((x) => x.art === name);
	assert.ok(b, name);
	return b;
};

const Leer = () => null;

describe('Gestaltungs-Inspektor: Gruppierung (099)', () => {
	it('zeigt bei einer Figur Position, Ebene und Druck in dieser Reihenfolge', () => {
		const gruppen = gruppiere(INSPEKTOR_TEILE, 'figurfrei', art('figurfrei'));
		assert.deepEqual(
			gruppen.map((g) => g.titel),
			['Position und Größe', 'Bild', 'Ebene und Anker', 'Druck'],
		);
	});

	it('zeigt bei Seitenfläche und Seitenrahmen nur „Druck“', () => {
		for (const name of ['seitenflaeche', 'seitenrahmen']) {
			assert.deepEqual(
				gruppiere(INSPEKTOR_TEILE, name, art(name)).map((g) => g.name),
				['druck'],
				name,
			);
		}
	});

	it('stellt einen Teil im Abschnitt 8 mit Reihenfolge 3 hinter ebene.tsx und anker.tsx', () => {
		const probe: InspektorTeil = { id: 'probe', abschnitt: 8, reihenfolge: 3, fuer: () => true, Inhalt: Leer };
		const gruppen = gruppiere([probe, ...INSPEKTOR_TEILE], 'form', art('form'));
		const ebene = gruppen.find((g) => g.nr === 8);
		assert.deepEqual(
			ebene?.teile.map((t) => t.id),
			['ebene', 'anker', 'probe'],
		);
	});

	it('ordnet die Abschnitte nach Nummer, nicht nach der Liste', () => {
		const spaet: InspektorTeil = { id: 'form', abschnitt: 3, reihenfolge: 1, fuer: () => true, Inhalt: Leer };
		const gruppen = gruppiere([...INSPEKTOR_TEILE, spaet], 'form', art('form'));
		assert.deepEqual(
			gruppen.map((g) => g.nr),
			[2, 3, 4, 8, 9],
		);
	});
});
