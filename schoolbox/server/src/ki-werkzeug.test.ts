import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { Ansicht, Meldung } from '@schoolbox/kern';
import { baueAnsichtAus, laufMeldungen } from '@schoolbox/kern';
import { browserSkip } from '@schoolbox/kern/src/browsertest';

import { ansichtText } from './ki-werkzeug';

const ansicht = (meldungen: Meldung[]): Ansicht => ({
	bericht: { seiten: [{}], meldungen, fehler: meldungen.filter((m) => m.stufe === 'FEHLER').length },
	bilder: ['seite-1.png'],
});

describe('ansichtText: Hinweise kommen bei Claude an (225)', () => {
	it('Hinweise stehen im eigenen Block nach Fehlern und Warnungen, ohne ausgeblendet und kit-anteil', () => {
		const text = ansichtText(
			ansicht([
				{ stufe: 'HINWEIS', seite: 1, code: 'bild-unscharf', text: 'Bild „Hund“ hat im Druck nur 90 dpi' },
				{ stufe: 'FEHLER', seite: 1, code: 'rand', text: '„A“ ragt in den Seitenrand (3 px) → kürzen' },
				{ stufe: 'HINWEIS', seite: 0, code: 'ausgeblendet', text: '1 Element ist ausgeblendet' },
				{ stufe: 'HINWEIS', seite: 0, code: 'kit-anteil', text: 'Kit-Anteil 50 %' },
				{ stufe: 'HINWEIS', seite: 0, code: 'thema-klasse', text: 'thema.css: Klasse ohne Registereintrag: x' },
				{ stufe: 'WARNUNG', seite: 2, code: 'platz-frei', text: '120 px frei unten' },
			]),
			'ansicht',
			[{ stufe: 'WARNUNG', seite: 0, code: 'zeitziel-fehlt', text: 'Am <body> fehlt data-zeit.' }],
		);
		assert.deepEqual(text.split('\n').slice(0, 7), [
			'Gebaut: 1 Seite. Prüfbericht: 1 Fehler, 2 Warnungen, 2 Hinweise.',
			'FEHLER Seite 1: „A“ ragt in den Seitenrand (3 px) → kürzen',
			'WARNUNG Seite 2: 120 px frei unten',
			'WARNUNG: Am <body> fehlt data-zeit.',
			'Hinweise (ansehen, kein Zwang):',
			'HINWEIS Seite 1: Bild „Hund“ hat im Druck nur 90 dpi',
			'HINWEIS: thema.css: Klasse ohne Registereintrag: x',
		]);
		assert.doesNotMatch(text, /ausgeblendet|Kit-Anteil/);
	});

	it('höchstens 15 Hinweise; ohne Hinweise kein Block', () => {
		const viele = Array.from({ length: 17 }, (_, i): Meldung => ({
			stufe: 'HINWEIS',
			seite: 1,
			code: 'verdeckt',
			text: `Hinweis ${i + 1}`,
		}));
		const text = ansichtText(ansicht(viele));
		assert.match(text, /0 Fehler, 0 Warnungen, 17 Hinweise/);
		assert.match(text, /Hinweis 15\n… und 2 weitere Hinweise\./);
		assert.doesNotMatch(text, /Hinweis 16/);
		assert.doesNotMatch(ansichtText(ansicht([])), /Hinweise \(/);
	});
});

describe('bauen für Claude: Probeblatt (225, Abnahme)', { skip: browserSkip() }, () => {
	it('ohne data-zeit, mit Aufgabe ohne Lösung und hellgelbem Wort: drei Meldungen im Text', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-225-'));
		try {
			const html = [
				'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Probe</title>',
				'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
				'<body class="kl2 a4-hoch farbe palette-himmel" data-satz="2"><section class="seite">',
				'<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Lies das <b style="color:#fff59d">Wort</b>.</span></div>',
				'<div class="koerper"><span class="antwort"></span></div></div>',
				'</section></body></html>',
			].join('\n');
			const quelle = path.join(tmp, 'material.html');
			await writeFile(quelle, html);
			const gebaut = await baueAnsichtAus({ pythonBin: 'python3' }, quelle, path.join(tmp, 'ansicht'));
			const text = ansichtText(gebaut, 'ansicht', laufMeldungen(html, 'arbeitsblatt'));
			assert.match(text, /^WARNUNG: Am <body> fehlt data-zeit\./m);
			assert.match(text, /^WARNUNG Seite 1: Aufgabe 1 hat keine Lösung/m);
			assert.match(text, /^HINWEIS Seite 1: In s\/w kaum lesbar/m);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});
