import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilderOffenSatz, bildHinweisZeile, fachlichOffenSatz } from './einheit-pruefung-text';

describe('Prüfung der Einheit: Texte', () => {
	it('Satz über offene fachliche Befunde mit Leerzeichen vor „fachlich prüfen“', () => {
		assert.equal(
			fachlichOffenSatz(1),
			'Ein fachlicher Befund nach den Korrekturrunden offen: bitte fachlich prüfen.',
		);
		assert.equal(
			fachlichOffenSatz(3),
			'3 fachliche Befunde nach den Korrekturrunden offen: bitte fachlich prüfen.',
		);
	});

	it('Bilder, die nicht gelungen sind (248): Satz und je Bild eine Zeile mit dem Material', () => {
		assert.equal(bilderOffenSatz(1), 'Ein Bild ist nicht gelungen: bitte neu erzeugen oder ersetzen.');
		assert.equal(bilderOffenSatz(2), '2 Bilder sind nicht gelungen: bitte neu erzeugen oder ersetzen.');
		const titel = (slug: string) => (slug === 'kapitel-1' ? 'Kapitel 1' : slug);
		assert.equal(
			bildHinweisZeile(
				{ datei: 'fall-1.jpg', text: 'Der Spiegel ist eine Glasscheibe.', von: 'kapitel-1' },
				titel,
			),
			'fall-1.jpg („Kapitel 1“): Der Spiegel ist eine Glasscheibe.',
		);
		assert.equal(
			bildHinweisZeile({ datei: 'folie-3-1.jpg', text: 'Luna hat drei Flügel.', von: '_bilder' }, titel),
			'folie-3-1.jpg: Luna hat drei Flügel.',
		);
	});
});
