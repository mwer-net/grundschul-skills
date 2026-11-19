import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { leseKanon } from '@schoolbox/kern/src/einheit-kanon';

import { kanonAbschnitte, kanonZahl } from './einheit-kanon-text';

describe('Kanon im Plan (246)', () => {
	it('ohne Kanon kein Abschnitt, also kein Aufklapper', () => {
		assert.deepEqual(kanonAbschnitte(undefined, [{ name: 'X', was: 'Y', von: 'a' }]), []);
	});

	it('je Abschnitt eine Zeile je Eintrag; leere fehlen; Ergänzungen mit dem Titel des Materials', () => {
		const kanon = leseKanon({
			figuren: [{ name: 'Ella', fest: ['ein buschiger Schwanz'], nie: ['trägt das Glöckchen'] }, { name: 'Pelle', nie: ['keine Brille'] }],
			dinge: [{ name: 'das Glöckchen', kapitel: { '5': 'Hanne findet es', '0': 'am Fenster' } }],
			geheim: [
				{ was: 'Ella ist die Täterin', bis: 6 },
				{ was: 'der Name des Absenders' },
			],
			begriffe: [{ wort: 'symmetrisch', bedeutung: 'beide Hälften gleich', ab: 2 }],
		});
		const abschnitte = kanonAbschnitte(kanon, [{ name: 'Kurt', was: 'Postbote', von: 'kapitel-2' }], () => 'Kapitel 2');
		assert.deepEqual(abschnitte, [
			{ titel: 'Figuren', zeilen: ['Ella: ein buschiger Schwanz · nie: trägt das Glöckchen', 'Pelle: nie: keine Brille'] },
			{ titel: 'Gegenstände', zeilen: ['das Glöckchen: Auftakt am Fenster · Kap. 5 Hanne findet es'] },
			{ titel: 'Geheim', zeilen: ['Ella ist die Täterin (bis Kap. 6)', 'der Name des Absenders (bis zum Schluss)'] },
			{ titel: 'Fachwörter', zeilen: ['symmetrisch: beide Hälften gleich (ab Stunde 2)'] },
			{ titel: 'Ergänzt', zeilen: ['Kurt: Postbote („Kapitel 2“)'] },
		]);
		assert.equal(kanonZahl(abschnitte), 7);
	});
});
