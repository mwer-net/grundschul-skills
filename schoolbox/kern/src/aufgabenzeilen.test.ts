import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	aussagenText,
	aussagenVerlustfrei,
	aussagenVon,
	fragenText,
	fragenVerlustfrei,
	fragenVon,
	VERBOTEN,
} from './aufgabenzeilen';

describe('S-06: Ankreuzen und Richtig/falsch als Zeilen', () => {
	it('Ankreuzen: lesen und schreiben ergibt die Kurzschrift zeichengleich', () => {
		const roh = 'Wie viele Beine hat ein Hund?: *4, 3, 6; Was miaut?: Hund, *Katze';
		assert.deepEqual(fragenVon(roh)[1], {
			frage: 'Was miaut?',
			antworten: [
				{ text: 'Hund', richtig: false },
				{ text: 'Katze', richtig: true },
			],
		});
		assert.equal(fragenText(fragenVon(roh)), roh);
		assert.equal(fragenVerlustfrei(roh), true);
		assert.equal(fragenText([]), null);
	});

	it('Ankreuzen: anders geschrieben, aber gleich gemeint, passt in Zeilen; mehrere richtig bleiben', () => {
		assert.equal(fragenVerlustfrei('Frage:*a,*b ,c'), true);
		assert.equal(fragenText(fragenVon('Frage:*a,*b ,c')), 'Frage: *a, *b, c');
	});

	it('Richtig/falsch: zeichengleich; ein Wert außer r und f öffnet als Text', () => {
		const roh = 'Hunde bellen: r; Katzen fliegen: f';
		assert.equal(aussagenText(aussagenVon(roh)), roh);
		assert.equal(aussagenVerlustfrei(roh), true);
		assert.equal(aussagenVerlustfrei('Hunde bellen'), false);
		assert.equal(aussagenVerlustfrei('Hunde bellen: ja'), false);
		assert.deepEqual(aussagenVon('Uhr: 3:00 ist früh: f'), [{ text: 'Uhr: 3:00 ist früh', wert: 'f' }]);
	});

	it('Trennzeichen kommen nicht in eine Zelle', () => {
		assert.equal('4, 5; 6:7'.replace(VERBOTEN.antwort, ''), '4 567');
		assert.equal('*4'.replace(VERBOTEN.antwort, ''), '4');
		assert.equal('Frage; zwei'.replace(VERBOTEN.frage, ''), 'Frage zwei');
	});
});
