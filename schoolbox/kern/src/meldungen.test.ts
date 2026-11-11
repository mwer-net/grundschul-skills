import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Meldung, MeldungCode } from './meldungen';
import { erklaere, MELDUNG_CODES } from './meldungen';

const mit = (code: MeldungCode, text: string, namen: string[]) =>
	erklaere({ stufe: 'HINWEIS', seite: 1, code, text } satisfies Meldung, namen);

describe('Texte der Meldungen', () => {
	it('jeder Code hat einen Satz', () => {
		for (const code of MELDUNG_CODES) {
			const { satz } = mit(code, 'Text', []);
			assert.ok(satz.trim().length > 0, code);
		}
	});

	it('die Codes der Gestaltung (096) sagen, was zu tun ist', () => {
		assert.deepEqual(mit('druckrand', '…', ['„Wilma“']), {
			satz: '„Wilma“ liegt im Druckrand und fehlt beim Drucken vielleicht.',
			tipp: 'Etwas nach innen ziehen.',
		});
		assert.deepEqual(mit('aussen', '…', ['„Sprechblase“']), {
			satz: '„Sprechblase“ liegt außerhalb der Seite.',
			tipp: 'In die Seite holen.',
		});
		assert.deepEqual(mit('verdeckt', '…', ['„Wilma“', '„Zeichne ein Haus aus Formen“']), {
			satz: '„Wilma“ verdeckt „Zeichne ein Haus aus Formen“.',
			tipp: 'Verschieben, nach hinten legen oder im Inspektor „Darf Inhalt überdecken“ wählen.',
		});
		const tipp = 'In den Ebenen mit dem Auge wieder einblenden.';
		assert.deepEqual(mit('ausgeblendet', '2 Elemente sind ausgeblendet und werden nicht gedruckt → …', []), {
			satz: '2 Elemente sind ausgeblendet und werden nicht gedruckt.',
			tipp,
		});
		assert.deepEqual(mit('ausgeblendet', '1 Element ist ausgeblendet und wird nicht gedruckt → …', []), {
			satz: 'Ein Element ist ausgeblendet und wird nicht gedruckt.',
			tipp,
		});
	});

	it('der Platzhalter-Text passt zu Rahmen und Platzhalter, ohne Tipp (172)', () => {
		assert.deepEqual(mit('platzhalter', '1 Platzhalter (Entwurf)', ['„Uhr“']), {
			satz: 'Hier fehlt noch ein Bild.',
			tipp: null,
		});
		assert.deepEqual(mit('platzhalter', '2 Platzhalter (Entwurf)', ['„Uhr“', '„Bildrahmen“']), {
			satz: 'Auf der Seite fehlen noch 2 Bilder.',
			tipp: null,
		});
	});
});
