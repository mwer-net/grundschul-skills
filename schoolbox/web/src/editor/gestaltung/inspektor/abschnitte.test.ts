import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';

import type { InspektorTeil } from './index';
import { ABSCHNITTE, gruppiere, INSPEKTOR_TEILE, MEHRFACH_TEILE } from './index';

const art = (name: string) => {
	const b = BAUSTEINE.find((x) => x.art === name);
	assert.ok(b, name);
	return b;
};

const Leer = () => null;

describe('Gestaltungs-Inspektor: Gruppierung (099)', () => {
	it('zeigt bei einer Figur Bild, Aussehen, Anordnen und Sichtbarkeit in dieser Reihenfolge (185)', () => {
		const gruppen = gruppiere(INSPEKTOR_TEILE, 'figurfrei', art('figurfrei'));
		assert.deepEqual(
			gruppen.map((g) => g.titel),
			['Bild', 'Aussehen', 'Anordnen', 'Sichtbarkeit'],
		);
	});

	it('zeigt bei einer Form Form, Füllung und Kontur, Aussehen, Anordnen und Sichtbarkeit (185)', () => {
		assert.deepEqual(
			gruppiere(INSPEKTOR_TEILE, 'form', art('form')).map((g) => g.titel),
			['Form', 'Füllung und Kontur', 'Aussehen', 'Anordnen', 'Sichtbarkeit'],
		);
	});

	it('zeigt bei Seitenfläche und Seitenrahmen nur „Sichtbarkeit“', () => {
		for (const name of ['seitenflaeche', 'seitenrahmen']) {
			assert.deepEqual(
				gruppiere(INSPEKTOR_TEILE, name, art(name)).map((g) => g.name),
				['sichtbarkeit'],
				name,
			);
		}
	});

	it('ordnet unter „Anordnen“ Ebene, Lage, Anker und „Darf Inhalt überdecken“ (185)', () => {
		const probe: InspektorTeil = { id: 'probe', abschnitt: 8, reihenfolge: 3.5, fuer: () => true, Inhalt: Leer };
		const gruppen = gruppiere([probe, ...INSPEKTOR_TEILE], 'form', art('form'));
		assert.deepEqual(
			gruppen.find((g) => g.nr === 8)?.teile.map((t) => t.id),
			['ebene', 'position', 'anker', 'probe', 'ueberdecken'],
		);
	});

	it('stellt den Stil der Kontur hinter Füllung und Kontur, Schatten und Deckkraft unter „Aussehen“ (185)', () => {
		const gruppen = gruppiere(INSPEKTOR_TEILE, 'form', art('form'));
		assert.deepEqual(
			gruppen.find((g) => g.nr === 6)?.teile.map((t) => t.id),
			['fuellung', 'kontur-stil'],
		);
		for (const name of ['bildfrei', 'figurfrei', 'schmuck']) {
			assert.deepEqual(
				gruppiere(INSPEKTOR_TEILE, name, art(name))
					.find((g) => g.nr === 7)
					?.teile.map((t) => t.id),
				['aussehen'],
				name,
			);
		}
	});

	it('legt jeden Teil in einen der acht Abschnitte (185)', () => {
		const namen = Object.values(ABSCHNITTE).map((a) => a.name);
		assert.deepEqual(namen, [
			'form',
			'text',
			'bild',
			'streuung',
			'fuellung',
			'aussehen',
			'anordnen',
			'sichtbarkeit',
		]);
		for (const teil of [...INSPEKTOR_TEILE, ...MEHRFACH_TEILE]) {
			assert.ok(teil.abschnitt in ABSCHNITTE, teil.id);
		}
	});

	it('ordnet die Abschnitte nach Nummer, nicht nach der Liste', () => {
		const spaet: InspektorTeil = { id: 'form', abschnitt: 3, reihenfolge: 1, fuer: () => true, Inhalt: Leer };
		const gruppen = gruppiere([...INSPEKTOR_TEILE, spaet], 'form', art('form'));
		assert.deepEqual(
			gruppen.map((g) => g.nr),
			[2, 3, 6, 7, 8, 9],
		);
	});
});
