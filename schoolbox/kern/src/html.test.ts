import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bodyKlassen, hatSatz, satzBefund, setzeBodyKlassen } from './html';

const blatt = (body: string) => `<html><head><title>T</title></head>${body}<section class="seite"></section></body></html>`;
const EINSTELLUNGEN = { druckprofil: 'farbe', format: 'a4-hoch', klasse: 2 } as const;

describe('Satz wie im Schulbuch (212)', () => {
	it('hatSatz liest die Angabe nur am <body>', () => {
		assert.equal(hatSatz(blatt('<body class="kl2 farbe" data-satz="2">')), true);
		assert.equal(hatSatz(blatt('<body data-satz="2" class="kl2">')), true);
		assert.equal(hatSatz(blatt('<body class="kl2 farbe">')), false);
		assert.equal(hatSatz(blatt('<body class="kl2"><div data-satz="2"></div>')), false);
		assert.equal(hatSatz(blatt('<body class="kl2" data-satz="1">')), false);
	});

	it('satzBefund nennt die fehlende Angabe und schweigt, wenn sie da ist', () => {
		assert.match(satzBefund(blatt('<body class="kl2 farbe">')) ?? '', /data-satz="2"/);
		assert.equal(satzBefund(blatt('<body class="kl2 farbe" data-satz="2">')), null);
	});

	it('setzeBodyKlassen hängt die Angabe an, einmal, und lässt die Klassen wie bisher', () => {
		const neu = setzeBodyKlassen(blatt('<body class="kl1 sw">'), EINSTELLUNGEN);
		assert.ok(hatSatz(neu));
		assert.deepEqual(bodyKlassen(neu), ['kl2', 'farbe', 'palette-himmel']);
		const nochmal = setzeBodyKlassen(neu, EINSTELLUNGEN);
		assert.equal(nochmal.match(/data-satz/g)?.length, 1);
		assert.ok(hatSatz(setzeBodyKlassen(blatt('<body>'), EINSTELLUNGEN)));
		assert.ok(hatSatz(setzeBodyKlassen(blatt('<body data-zeit="20" class="kl3">'), EINSTELLUNGEN)));
	});
});
