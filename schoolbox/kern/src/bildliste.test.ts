import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { BildlistenHerkunft } from './bildliste';
import { bildlisteBefunde, bildlisteText, erstelleBildliste, leseBildQuellen } from './bildliste';

const KOPF = 'datei\tquelle\tmodell\tdatum\tmotiv\tart\tbefund\tinhalt';

/** Eine Testmappe mit KI-Bild, Bibliotheksfigur (bekannte und unbekannte Herkunft) und SVG. */
const HERKUNFT: BildlistenHerkunft = {
	herkunft: new Map([
		['fall-1.jpg', { quelle: 'openai', modell: 'gpt-image' }],
		['folie-3-2.jpg', { quelle: 'openai', modell: 'gpt-image' }],
	]),
	posen: new Map([
		['luna', { quelle: 'openai', modell: 'gpt-image' }],
		['pelle', null],
	]),
	dateien: new Set([
		'fall-1.jpg',
		'folie-3-2.jpg',
		'bib-luna.png',
		'bib-luna-strich.png',
		'bib-pelle.png',
		'v-k-1.png',
	]),
};

const KAPITEL = [
	'<section class="seite"><img src="../../bilder/fall-1.jpg"><img class="figur-frei" src="../../bilder/bib-luna.png"></section>',
	'<section class="seite folie"><svg viewBox="0 0 10 10"></svg><x-uhr zeit="3:00"></x-uhr></section>',
	'<section class="seite"><img src="../../bilder/bib-pelle.png"><img src="bilder/willi.png"></section>',
].join('\n');
const DECKBLATT =
	'<section class="seite deckblatt"><img src="../../bilder/v-k-1.png"><img src="../../bilder/fall-1.jpg"></section>';

const liste = () =>
	erstelleBildliste(
		[
			{ slug: 'kapitel-1', html: KAPITEL },
			{ slug: 'deckblatt', html: DECKBLATT },
		],
		HERKUNFT,
	);

const quellenblatt = (zeilen: [string, string][]) =>
	`<section class="seite"><table class="kit-tabelle">${zeilen.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></section>`;

const RICHTIG = quellenblatt([
	['Bilder (fall-1.jpg)', 'Selbst erstellt mit dem KI-Bildgenerator GPT Image von OpenAI'],
	['Luna aus der Figurenbibliothek (bib-luna.png, bib-luna-strich.png)', 'Selbst erstellt mit GPT Image von OpenAI'],
	['Pelle aus der Figurenbibliothek', 'Quelle bitte ergänzen: bib-pelle.png'],
	['Abbildungen', 'Per Programmcode gezeichnet, kein KI-Bildgenerator'],
]);

describe('Bildliste (271)', () => {
	it('nennt KI-Bild, Bibliotheksfigur, Bild der Skills und SVG mit Art, Quelle und Seiten', () => {
		assert.deepEqual(liste(), [
			{
				datei: 'bib-luna.png',
				art: 'bibliothek',
				figur: 'luna',
				quelle: { quelle: 'openai', modell: 'gpt-image' },
				strich: 'bib-luna-strich.png',
				verwendet: [{ slug: 'kapitel-1', seiten: [1] }],
			},
			{
				datei: 'bib-pelle.png',
				art: 'bibliothek',
				figur: 'pelle',
				verwendet: [{ slug: 'kapitel-1', seiten: [3] }],
			},
			{
				datei: 'fall-1.jpg',
				art: 'ki',
				quelle: { quelle: 'openai', modell: 'gpt-image' },
				verwendet: [
					{ slug: 'kapitel-1', seiten: [1] },
					{ slug: 'deckblatt', seiten: [1] },
				],
			},
			{
				datei: 'willi.png',
				art: 'bibliothek',
				figur: 'willi',
				quelle: { quelle: 'canva' },
				verwendet: [{ slug: 'kapitel-1', seiten: [3] }],
			},
			{ datei: 'svg', art: 'berechnet', verwendet: [{ slug: 'kapitel-1', seiten: [2] }] },
			{ datei: 'x-uhr', art: 'berechnet', verwendet: [{ slug: 'kapitel-1', seiten: [2] }] },
		]);
		const text = bildlisteText(liste());
		assert.match(text, /- fall-1\.jpg: KI-Bild, Quelle openai \(gpt-image\); in kapitel-1 S\. 1; deckblatt S\. 1/);
		assert.match(
			text,
			/- bib-pelle\.png: Figur der Figurenbibliothek, Pose pelle, Herkunft unbekannt; in kapitel-1 S\. 3/,
		);
		assert.match(text, /- x-uhr: berechnet/);
		assert.doesNotMatch(text, /folie-3-2|v-k-1/, 'nur, was das HTML verwendet');
	});

	it('ein Quellenblatt nach der Liste: kein Befund', () => {
		assert.deepEqual(bildlisteBefunde(liste(), RICHTIG, { titel: 'Quellen', quellen: true }), []);
	});

	it('eine fremde Datei ist ein Befund, auch eine Strichfassung, die es nicht gibt, und ein Bild, das kein Material zeigt', () => {
		const html = quellenblatt([
			['Bilder (fall-1.jpg, folie-3-2.jpg, luna-lupe-strich.png)', 'GPT Image von OpenAI'],
			['Pelle', 'Quelle bitte ergänzen: bib-pelle.png'],
		]);
		const befunde = bildlisteBefunde(liste(), html, { titel: 'Quellen', quellen: true });
		assert.equal(befunde.length, 2);
		assert.match(befunde[0] ?? '', /„Quellen“ nennt folie-3-2\.jpg; diese Datei verwendet kein Material/);
		assert.match(befunde[1] ?? '', /luna-lupe-strich\.png/);
	});

	it('eine andere Art oder Quelle als die Liste ist ein Befund', () => {
		const html = quellenblatt([
			['Luna (bib-luna.png)', 'Quelle bitte ergänzen'],
			['Pelle (bib-pelle.png)', 'Selbst erstellt mit GPT Image von OpenAI'],
			['Titelbild (fall-1.jpg)', 'Per Programmcode gezeichnet'],
		]);
		const befunde = bildlisteBefunde(liste(), html, { titel: 'Quellen', quellen: true });
		assert.equal(befunde.length, 3);
		assert.match(befunde[0] ?? '', /bib-luna\.png .*Dort steht Quelle openai \(gpt-image\)/);
		assert.match(befunde[1] ?? '', /bib-pelle\.png .*Dort steht Herkunft unbekannt/);
		assert.match(befunde[2] ?? '', /fall-1\.jpg .*Dort steht KI-Bild/);
	});

	it('ein Bild unbekannter Herkunft fehlt im Quellenblatt; das Angebot muss es nicht nennen', () => {
		const html = quellenblatt([['Bilder', 'Selbst erstellt mit GPT Image von OpenAI']]);
		assert.deepEqual(bildlisteBefunde(liste(), html, { titel: 'Quellen', quellen: true }), [
			'„Quellen“ nennt Bilder unbekannter Herkunft nicht: bib-pelle.png. Jedes bekommt die Zeile „Quelle bitte ergänzen: <Datei>“.',
		]);
		assert.deepEqual(bildlisteBefunde(liste(), html, { titel: 'Angebot', quellen: false }), []);
	});

	it('liest bilder-herkunft.tsv vor canva-ids.tsv, je Datei die letzte Zeile', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'schoolbox-bildliste-'));
		await writeFile(
			path.join(dir, 'canva-ids.tsv'),
			'datei\tmedia-id\tmotiv\nalt.png\tMAH1\tx\nbeide.png\tMAH2\ty\n',
		);
		await writeFile(
			path.join(dir, 'bilder-herkunft.tsv'),
			[KOPF, 'beide.png\topenai\tm1\t2026\tSzene', 'beide.png\topenai\tm2\t2026\tSzene\terzeugt\t\t'].join('\n'),
		);
		const q = await leseBildQuellen(dir);
		assert.deepEqual(q.get('alt.png'), { quelle: 'canva' });
		assert.deepEqual(q.get('beide.png'), { quelle: 'openai', modell: 'm2' });
		assert.equal((await leseBildQuellen(path.join(dir, 'fehlt'))).size, 0);
	});
});
