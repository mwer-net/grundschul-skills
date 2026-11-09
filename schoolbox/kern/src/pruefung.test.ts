import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { BROWSER_HINWEIS, browserFehlt, browserSkip, imStapel } from './browsertest';
import { DRUCKRAND } from './gestaltung-arten';
import { ASSETS, BLATT_PY } from './konfig';
import type { Meldung } from './meldungen';
import { MELDUNG_CODES } from './meldungen';

const TESTDATEN = path.join(__dirname, 'testdaten');

const pruefe = async (datei: string) => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-pruefung-'));
	const bericht = path.join(tmp, 'bericht.json');
	try {
		try {
			execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht], {
				stdio: 'ignore',
			});
		} catch {
			// Exit-Code 1 bei FEHLER; der Bericht steht trotzdem da.
		}
		return (JSON.parse(await readFile(bericht, 'utf8')) as { meldungen: Meldung[] }).meldungen;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

describe('pruefung.js (mit blatt.py)', () => {
	it('liefert dieselben Meldungstexte wie vor den Codes, jetzt mit Code und Zielen', async (t) => {
		if (browserFehlt()) {
			t.skip(BROWSER_HINWEIS);
			return;
		}
		const erwartet = JSON.parse(await readFile(path.join(TESTDATEN, 'pruefung-erwartet.json'), 'utf8')) as Record<
			string,
			Meldung[]
		>;
		const gesehen = new Set<string>();
		const berichte = new Map<string, Meldung[]>();
		for (const [name, meldungen] of Object.entries(erwartet)) {
			const datei = name.startsWith('pruefung-') ? path.join(TESTDATEN, name) : path.join(ASSETS, name);
			const bericht = await pruefe(datei);
			berichte.set(name, bericht);
			assert.deepEqual(
				bericht.map(({ seite, stufe, text }) => ({ stufe, seite, text })),
				meldungen,
				name,
			);
			for (const m of bericht) {
				assert.ok(m.code && MELDUNG_CODES.includes(m.code), `${name}: Code zu „${m.text}“`);
				assert.ok(Array.isArray(m.ziele), `${name}: Ziele zu „${m.text}“`);
				gesehen.add(m.code);
			}
		}
		const ueberlappung = berichte.get('pruefung-blatt.html')?.find((m) => m.code === 'ueberlappung');
		assert.deepEqual(
			ueberlappung?.ziele?.map((z) => z.name),
			['Erste Zeile', 'Zweite Zeile'],
		);
		assert.equal(ueberlappung?.ziele?.[0]?.sb, null, 'ohne Editor kein data-sb');
		assert.equal(ueberlappung?.ziele?.[0]?.rechteck.length, 4);
		const fehlt = MELDUNG_CODES.filter(
			(c) =>
				!gesehen.has(c) &&
				// Die Codes der Gestaltung (096) prüft „pruefung.js: Codes der Gestaltung“ mit eigenen Testdaten.
				![
					'schrift-fehlt',
					'pruefskript',
					'loesung-fehlt',
					'verweis',
					'druckrand',
					'aussen',
					'verdeckt',
					'ausgeblendet',
				].includes(c),
		);
		assert.deepEqual(fehlt, [], 'jede Regel kommt in den Testdaten vor');
	});
});

/** Gestaltung (091): Ebenen und frei liegende Elemente lösen die alten Codes nicht aus, Inhalt meldet wie vorher. */
describe('pruefung.js mit Gestaltung (091)', { skip: browserSkip() }, () => {
	const DURCH_GESTALTUNG = ['rand', 'ueberlauf', 'abgeschnitten', 'ueberlappung', 'flaeche'];
	const DATEI = path.join(TESTDATEN, 'pruefung-gestaltung.html');

	it('Seite 1: keine Meldung durch Gestaltung, kein FEHLER, als WARNUNG nur der Druckrand (096)', async () => {
		const seite1 = (await pruefe(DATEI)).filter((m) => m.seite === 1);
		assert.deepEqual(
			seite1.filter((m) => DURCH_GESTALTUNG.includes(m.code ?? '') || m.stufe === 'FEHLER').map((m) => m.text),
			[],
		);
		// Im Seitenrand liegen Willi am Anker (gedreht, das Rechteck danach zählt), Wilma und der Titel unten links.
		assert.deepEqual(
			seite1.filter((m) => m.stufe === 'WARNUNG').map(({ code, ziele }) => [code, ziele?.[0]?.name]),
			[
				['druckrand', 'Willi'],
				['druckrand', 'Wilma'],
				['druckrand', 'Detektive'],
			],
		);
	});

	it('Seite 2, Gegenproben neben einer Ebene: rand, ueberlappung und flaeche melden weiter', async () => {
		const seite2 = (await pruefe(DATEI)).filter((m) => m.seite === 2);
		assert.deepEqual(
			seite2.filter((m) => m.code !== 'platz-frei').map(({ code, stufe, text }) => ({ code, stufe, text })),
			[
				{
					code: 'rand',
					stufe: 'FEHLER',
					text: '„Diese Zeile ragt in den Rand.“ ragt in den Seitenrand (91 px) → kürzen, Item streichen oder zweite Seite',
				},
				{ code: 'ueberlappung', stufe: 'FEHLER', text: '„Willi oben“ überlappt „Wilma darunter“ (54 × 120 px)' },
				// Die freie Figur vorne überdeckt Aufgabe 4: dafür gibt es seit 096 den Hinweis statt ueberlappung.
				{
					code: 'verdeckt',
					stufe: 'HINWEIS',
					text: '„Willi“ verdeckt „Zwei Bilder übereinander.“ (4463 px²) → verschieben oder nach hinten legen',
				},
				{
					code: 'flaeche',
					stufe: 'WARNUNG',
					text: 'Fläche hinter „div“ (rgb(204, 204, 204)) → Aufgaben ohne Kasten und Fläche',
				},
			],
		);
	});

	it('platz-frei misst wie ohne Ebenen', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-gestaltung-'));
		try {
			const ohne = path.join(tmp, 'ohne-ebenen.html');
			// Bilder und blatt.css findet blatt.py auch dort in assets/.
			const quelle = await readFile(DATEI, 'utf8');
			await writeFile(
				ohne,
				quelle
					.replace(/<div class="ebene (?:hinten|vorne)">[\s\S]*?\n {2}<\/div>\n/g, '')
					.replace(/\n {4}<img class="figur-frei"[^>]*data-anker[^>]*>/, ''),
			);
			assert.ok(!(await readFile(ohne, 'utf8')).includes('data-lage'), 'Gestaltung ganz entfernt');
			const platz = (meldungen: Meldung[]) =>
				meldungen.filter((m) => m.code === 'platz-frei').map(({ seite, text }) => ({ seite, text }));
			const mit = platz(await pruefe(DATEI));
			assert.equal(mit.length, 3, 'alle Seiten haben unten Platz');
			assert.deepEqual(mit, platz(await pruefe(ohne)));
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});

/** Die eigenen Codes der Gestaltung (096): Seite 3 von `pruefung-gestaltung.html` und das Mini-Book, je mit Gegenprobe. */
describe('pruefung.js: Codes der Gestaltung (096)', { skip: browserSkip() }, () => {
	const DATEI = path.join(TESTDATEN, 'pruefung-gestaltung.html');
	const kurz = (meldungen: Meldung[]) =>
		meldungen.map(({ code, stufe, text, ziele }) => ({ code, stufe, text, ziele: ziele?.map((z) => z.name) }));

	it('Seite 3 meldet genau: aussen, druckrand und zweimal verdeckt; die Gegenproben nicht', async () => {
		const seite3 = (await pruefe(DATEI)).filter((m) => m.seite === 3 && m.code !== 'platz-frei');
		assert.deepEqual(kurz(seite3), [
			{
				code: 'druckrand',
				stufe: 'WARNUNG',
				text: '„Wilma am Rand“ liegt im Druckrand (8 px vom Blattrand) → etwas nach innen ziehen',
				ziele: ['Wilma am Rand'],
			},
			{
				code: 'aussen',
				stufe: 'FEHLER',
				text: '„kreis“ liegt außerhalb der Seite → in die Seite holen',
				ziele: ['kreis'],
			},
			{
				code: 'verdeckt',
				stufe: 'HINWEIS',
				text: '„Wilma vorne“ verdeckt „Zeichne ein Haus aus Formen.“ (2705 px²) → verschieben oder nach hinten legen',
				ziele: ['Wilma vorne', 'Zeichne ein Haus aus Formen.'],
			},
			{
				code: 'verdeckt',
				stufe: 'HINWEIS',
				text: '„Wilma über der Marke“ verdeckt „Lösung“ (1896 px²) → verschieben oder nach hinten legen',
				ziele: ['Wilma über der Marke', 'Lösung'],
			},
		]);
	});

	it('ausgeblendet: einmal je Material mit der Zahl, Ziel ist das erste; sonst taucht Ausgeblendetes nirgends auf', async () => {
		const bericht = await pruefe(DATEI);
		const aus = bericht.filter((m) => m.code === 'ausgeblendet');
		assert.deepEqual(kurz(aus), [
			{
				code: 'ausgeblendet',
				stufe: 'HINWEIS',
				text: '2 Elemente sind ausgeblendet und werden nicht gedruckt → in den Ebenen wieder einblenden',
				ziele: ['Versteckt eins'],
			},
		]);
		assert.equal(aus[0]?.seite, 0);
		assert.ok(!bericht.some((m) => m.ziele?.some((z) => z.name.startsWith('Versteckt')) && m.code !== 'ausgeblendet'));
	});

	it('Mini-Book: kein druckrand an der Falz, wohl aber am Blattrand', async () => {
		const bericht = await pruefe(path.join(TESTDATEN, 'pruefung-gestaltung-minibuch.html'));
		assert.deepEqual(
			bericht.filter((m) => m.code === 'druckrand').map((m) => [m.seite, m.ziele?.[0]?.name]),
			[
				[1, 'Blattrand rechts'],
				[3, 'Blattrand unten'],
			],
		);
	});
});

describe('Druckrand (096)', () => {
	it('pruefung.js und gestaltung-arten.ts haben denselben Wert', async () => {
		const skript = await readFile(path.join(ASSETS, 'pruefung.js'), 'utf8');
		assert.equal(Number(/const DRUCKRAND = (\d+);/.exec(skript)?.[1]), DRUCKRAND);
	});
});

/** Misst im Chromium von blatt.py; die Seite schreibt ihr Ergebnis nach `<pre id="ergebnis">`. */
const messe = async <T>(body: string, kopf = ''): Promise<T> => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-gestaltung-'));
	try {
		const quelle = path.join(tmp, 'blatt.html');
		await copyFile(path.join(TESTDATEN, 'thema-letztes-kind.css'), path.join(tmp, 'thema.css'));
		await writeFile(
			quelle,
			`<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="stylesheet" href="blatt.css">${kopf}</head>
${body}
<script>addEventListener('load', async () => {
	await (window.grauBereit ?? 0);
	const pre = document.createElement('pre');
	pre.id = 'ergebnis';
	pre.textContent = JSON.stringify(window.messung());
	document.body.appendChild(pre);
});</script></body></html>`,
		);
		const [text] = imStapel([{ quelle, element: 'ergebnis', pruefen: false }]);
		assert.ok(text, 'Messung lief nicht durch');
		return JSON.parse(text ?? '') as T;
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

describe('blatt.css: s/w und data-aus bei Gestaltung (091, Briefing 4.2)', { skip: browserSkip() }, () => {
	const seite = (klasse: string) => `<body class="kl2 ${klasse}"><section class="seite">
<div class="aufgabe"><span class="nr">1</span><div class="anw"><div class="text">Aufgabe</div></div></div>
<div class="ebene hinten">
	<div class="seitenflaeche" id="flaeche" style="background:#ffe0b8"></div>
	<div class="seitenflaeche" id="flaeche-grau" data-sw="grau" style="background:#ffe0b8"></div>
	<div class="seitenrahmen" id="rahmen" style="border:3px solid #3a86ff"></div>
	<svg class="streuung" id="streuung" data-lage="frei" viewBox="0 0 10 10" style="--b:100px;--h:100px"><circle cx="5" cy="5" r="4"/></svg>
	<svg class="streuung" id="streuung-grau" data-lage="frei" data-sw="grau" viewBox="0 0 10 10" style="--b:100px;--h:100px"><circle cx="5" cy="5" r="4"/></svg>
</div>
<div class="ebene vorne">
	<div class="schmuck" id="schmuck" data-lage="frei" style="--x:100px;--y:400px">Prima!</div>
	<div class="schmuck" id="weg" data-lage="frei" data-sw="weg" style="--x:100px;--y:500px">Weg in s/w</div>
	<img class="figur-frei" id="aus" data-lage="frei" data-aus src="bilder/willi.png" alt="Willi" style="--x:100px;--y:600px;--b:100px">
	<div class="stapel" id="stapel" data-lage="frei" style="--x:300px;--y:600px;--b:200px;--stapel-hg:#fff3b0">Notiz</div>
</div>
</section>
<script>window.messung = () => {
	const da = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
	return {
		...Object.fromEntries(['flaeche', 'flaeche-grau', 'rahmen', 'streuung', 'streuung-grau', 'schmuck', 'weg', 'aus'].map((id) => [id, da(id)])),
		stapelHg: getComputedStyle(document.getElementById('stapel')).getPropertyValue('--stapel-hg').trim(),
	};
};</script>`;

	it('Farbe: alles sichtbar außer data-aus', async () => {
		const w = await messe<Record<string, boolean | string>>(seite('farbe'));
		assert.deepEqual(w, {
			flaeche: true,
			'flaeche-grau': true,
			rahmen: true,
			streuung: true,
			'streuung-grau': true,
			schmuck: true,
			weg: true,
			aus: false,
			stapelHg: '#fff3b0',
		});
	});

	it('s/w: Seitenfläche und Streuung ohne data-sw weg, mit "grau" da; data-sw="weg" und data-aus weg', async () => {
		const w = await messe<Record<string, boolean | string>>(seite('sw'));
		assert.deepEqual(w, {
			flaeche: false,
			'flaeche-grau': true,
			rahmen: true,
			streuung: false,
			'streuung-grau': true,
			schmuck: true,
			weg: false,
			aus: false,
			stapelHg: 'transparent',
		});
	});
});

describe('Thema mit .seite > :last-child neben Ebenen (091, Briefing 4.7)', { skip: browserSkip() }, () => {
	const SEITE = (ebenen: string) => `<section class="seite">
<div class="aufgabe"><span class="nr">1</span><div class="anw"><div class="text">Aufgabe</div></div></div>
<div class="fuss"><span>Fuß</span><span>1</span></div>${ebenen}
</section>`;

	it('lässt den Hauptstapel gleich; die Regel trifft aber die vordere Ebene statt des Fußes (Abweichung in 091)', async () => {
		const w = await messe<{ fuss: string[]; ebene: string; aufgaben: number[] }>(
			`<body class="kl2 farbe palette-himmel">${SEITE('')}${SEITE(
				'\n<div class="ebene vorne"><div class="schmuck" data-lage="frei">Prima!</div></div>',
			)}
<script>window.messung = () => ({
	fuss: [...document.querySelectorAll('.fuss')].map((f) => getComputedStyle(f).borderTopStyle),
	ebene: getComputedStyle(document.querySelector('.ebene')).borderTopStyle,
	aufgaben: [...document.querySelectorAll('.seite')].map((s) => Math.round(s.querySelector('.aufgabe').getBoundingClientRect().top - s.getBoundingClientRect().top)),
});</script>`,
			'<link rel="stylesheet" href="thema.css">',
		);
		assert.equal(w.aufgaben[0], w.aufgaben[1], 'Hauptstapel liegt gleich');
		assert.deepEqual(w.fuss, ['dashed', 'solid'], 'ohne Ebenen trifft die Regel den Fuß, mit Ebenen nicht');
		assert.equal(w.ebene, 'dashed', 'mit Ebenen trifft sie die vordere Ebene');
	});
});

/** Fläche im Stapel (115): was über ihren Rand hinausragt, wird gekappt und deshalb gemeldet. */
describe('pruefung.js: Fläche im Stapel (115)', { skip: browserSkip() }, () => {
	it('meldet nur das Element, das über den Rand der Fläche hinausragt', async () => {
		const bericht = (await pruefe(path.join(TESTDATEN, 'pruefung-flaeche.html'))).filter(
			(m) => m.code !== 'platz-frei',
		);
		assert.deepEqual(
			bericht.map(({ seite, code, stufe }) => ({ seite, code, stufe })),
			[{ seite: 2, code: 'abgeschnitten', stufe: 'FEHLER' }],
		);
		assert.match(bericht[0]?.text ?? '', /über den Rand der Fläche hinaus/);
	});
});
