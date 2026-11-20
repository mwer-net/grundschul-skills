import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { auszugAus } from './auszug';

const KAPITEL = readFileSync(path.join(__dirname, 'testdaten', 'auszug-kapitel.html'), 'utf8');

describe('Auszug eines Materials (252)', () => {
	const auszug = auszugAus(KAPITEL, 'Kapitel 5: Das goldene Glöckchen');

	it('Aufgabe 2 mit Anweisung und Lösung, ohne SVG und Markup', () => {
		const a2 = auszug.slice(auszug.indexOf('### Aufgabe 2'));
		assert.match(a2, /^### Aufgabe 2 \(4 Min\.\)\nAnweisung: Beschrifte das Bild mit den Wörtern\.$/m);
		assert.match(a2, /^1 \[___ Lösung: Spiegel\]$/m);
		assert.match(a2, /^2 \[___ Lösung: Spiegelachse\]$/m);
		assert.match(a2, /\[x-wortspeicher woerter="Spiegel; Spiegelachse" spalten="2"\]/);
		assert.match(a2, /\[Abbildung: Pfotenspur mit Spiegel; Text: 1 2; Lösung: Achse\]/);
		assert.match(a2, /\[nur Lösung: Die Achse steht senkrecht\.\]/);
		assert.doesNotMatch(auszug, /<svg|<path|<div|style=|class=|viewBox/);
	});

	it('Seiten mit Art und Niveau, Titel, Ziel, Bilder mit Motiv; ohne Kopf, Name, Fußzeile und Kommentare', () => {
		assert.match(auszug, /^# Kapitel 5: Das goldene Glöckchen\nZeitziel: 20 Min\.$/m);
		assert.match(auszug, /^## Seite 1 \(fall\)$/m);
		assert.match(auszug, /^\[Bild \.\.\/\.\.\/bilder\/fall-5\.jpg: Ida hält das Glöckchen unter der Tanne\]$/m);
		assert.match(auszug, /^\[Abbildung: Zettel in Spiegelschrift; Text: BALD HELL\]$/m);
		assert.match(auszug, /^## Seite 2 · Niveau 1\nTitel: Spurensuche mit dem Spiegel\nZiel: Ich kann mit dem Spiegel prüfen\.$/m);
		assert.match(auszug, /^### Aufgabe 1 \(7 Min\.\)\nAnweisung: Prüfe mit dem Spiegel\. Kreuze an\.\nTipp: /m);
		assert.match(auszug, /^nicht symmetrisch \| \| \[Lösung: X\]$/m);
		assert.doesNotMatch(auszug, /Name:|Datum:|Vorlagen|Kapitel5|color: red|Seite 1: Fall-Karte|^Lösung$|Kapitel 5$/m);
		assert.ok(auszug.length < KAPITEL.length / 2);
	});

	it('ohne Seiten: der Text des Body', () => {
		assert.equal(
			auszugAus('<body><p>Hallo <span class="antwort" data-l="Welt"></span></p></body>', 'Probe'),
			'# Probe\n\nHallo [___ Lösung: Welt]\n',
		);
	});
});
