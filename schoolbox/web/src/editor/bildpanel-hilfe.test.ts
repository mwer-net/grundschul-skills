import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Sammlung, SammlungsBild } from '@schoolbox/kern/src/bildbefehle';

import { bildgruppenWerte } from './bildpanel-hilfe';

const bild: SammlungsBild = { schluessel: 'a/bilder/laterne.png', name: 'laterne.png', alt: [] };
const leer: Sammlung = { sammlung: [], mappe: [], meine: [], requisiten: [], figuren: [] };

describe('Gruppen der Bildauswahl (253)', () => {
	it('Requisiten nur, wenn es welche gibt, im Umschalter kurz', () => {
		assert.deepEqual(
			bildgruppenWerte(leer).map((g) => g.titel),
			['Dieser Ordner', 'Andere Ordner', 'Mitgeliefert'],
		);
		assert.deepEqual(
			bildgruppenWerte({ ...leer, requisiten: [bild] }).map((g) => g.titel),
			['Dieser Ordner', 'Andere Ordner', 'Requisiten', 'Mitgeliefert'],
		);
	});
});
