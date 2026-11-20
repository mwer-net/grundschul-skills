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
					// Zahlenraum (207) prüft „pruefung.js: was die Fassung selbst so setzt“.
					'zahlenraum',
					// Die Dichte (213) prüft „pruefung.js: Arbeitsseite gefüllt wie im Schulbuch“.
					'inhalt-wenig',
					// Ausschneidematerial (214) prüft „pruefung.js: Ausschneide- und Legematerial“.
					'teile-viele',
					'teil-klein',
					'motiv-klein',
					'schnitt-knapp',
					'karten-einzeln',
					// 225: zeit-viel, Thema und Kit-Anteil prüft „pruefung.js: Prüfbericht im Lauf“; zeitziel-fehlt meldet
					// der Server (laufMeldungen).
					'zeit-viel',
					'thema-klasse',
					'thema-layout',
					'kit-anteil',
					'zeitziel-fehlt',
					// Symmetrie (245) prüft „pruefung.js: Symmetrie“.
					'symmetrie-achse',
					// Platz und Größe (249) prüft „pruefung.js: Platz und Größe“.
					'kontrast-sw-schau',
					'feld-klein',
					'feld-fuer',
					'linien-wenig',
					'antwort-menge',
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
				{
					code: 'ueberlappung',
					stufe: 'FEHLER',
					text: '„Willi oben“ überlappt „Wilma darunter“ (54 × 120 px) → Abstand vergrößern, Spalten senken oder das zweite Element in die nächste Zeile',
				},
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
		assert.ok(
			!bericht.some((m) => m.ziele?.some((z) => z.name.startsWith('Versteckt')) && m.code !== 'ausgeblendet'),
		);
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
			'flaeche': true,
			'flaeche-grau': true,
			'rahmen': true,
			'streuung': true,
			'streuung-grau': true,
			'schmuck': true,
			'weg': true,
			'aus': false,
			'stapelHg': '#fff3b0',
		});
	});

	it('s/w: Seitenfläche und Streuung ohne data-sw weg, mit "grau" da; data-sw="weg" und data-aus weg', async () => {
		const w = await messe<Record<string, boolean | string>>(seite('sw'));
		assert.deepEqual(w, {
			'flaeche': false,
			'flaeche-grau': true,
			'rahmen': true,
			'streuung': false,
			'streuung-grau': true,
			'schmuck': true,
			'weg': false,
			'aus': false,
			'stapelHg': 'transparent',
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
			bericht.map(({ code, seite, stufe }) => ({ seite, code, stufe })),
			[{ seite: 2, code: 'abgeschnitten', stufe: 'FEHLER' }],
		);
		assert.match(bericht[0]?.text ?? '', /über den Rand der Fläche hinaus/);
	});
});

/** 207: Zeilennummern, „Nur Lösung“ und automatische Folgeseiten erzeugen keine Prüfpunkte. */
describe('pruefung.js: was die Fassung selbst so setzt (207)', { skip: browserSkip() }, () => {
	const AUFGABE = (nr: number, extra = '') =>
		`<div class="aufgabe${extra}"><span class="nr">${nr}</span><div class="anw"><span class="text">Rechne.</span></div>` +
		'<div class="koerper"><div class="zelle">3 + 4 = <span class="antwort" data-l="7"></span></div></div></div>';
	const SATZ = 'Der Igel sucht im Herbst ein warmes Nest aus Laub und Moos für den langen Winter. ';
	const BLATT = [
		'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>207</title>',
		'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
		'<body class="kl2 farbe">',
		`<section class="seite"><p data-zeilennummern="1">${SATZ.repeat(6)}</p>`,
		AUFGABE(1),
		AUFGABE(2, ' nur-loesung'),
		AUFGABE(3),
		'</section>',
		`<section class="seite">${AUFGABE(4)}</section>`,
		`<section class="seite" data-weiter="auto">${AUFGABE(5)}</section>`,
		'</body></html>',
	].join('\n');

	it('Zeilennummern: kein „Rand“ und keine „Schrift zu klein“ (194-35)', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-207-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, BLATT);
			const meldungen = (await pruefe(datei)).filter((m) => m.seite === 1);
			const anNummern = meldungen.filter((m) =>
				(m.ziele ?? []).some(
					(z) => /^\d+$/.test(z.name ?? '') && ['rand', 'ueberlauf', 'schrift-klein'].includes(m.code ?? ''),
				),
			);
			assert.deepEqual(anNummern, []);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	it('„Nur Lösung“: kein Abstand zu einer Aufgabe, die auf dem Arbeitsblatt nicht steht (193-28)', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-207-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, BLATT);
			const abstand = (await pruefe(datei)).filter((m) => m.code === 'abstand-knapp');
			assert.deepEqual(abstand, []);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	it('Zahlenraum: Über der Klasse wird gezeichnet und gewarnt, über einer Million nicht (197-U1)', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-207-'));
		try {
			const datei = path.join(tmp, 'malkreuz.html');
			const seite =
				'<section class="seite"><x-malkreuz a="34" b="6"></x-malkreuz><x-zahlenhaus dach="2000000" zerlegungen="1000000 1000000"></x-zahlenhaus>' +
				'<x-zahlenstrahl von="0" bis="200" schritt="10" zahlen="0 100 200"></x-zahlenstrahl>' +
				'<x-zahlenhaus dach="7" zerlegungen="3 4,5"></x-zahlenhaus></section>';
			await writeFile(
				datei,
				BLATT.replace(/<section class="seite"><p data-zeilennummern[\s\S]*?<\/section>/, seite),
			);
			const meldungen = (await pruefe(datei)).filter((m) => m.seite === 1);
			const warnung = meldungen.filter((m) => m.code === 'zahlenraum');
			assert.deepEqual(
				warnung.map(({ stufe, text }) => ({ stufe, text })),
				[
					{ stufe: 'WARNUNG', text: 'Abbildung „Malkreuz“: Ein Feld wäre 204. In Klasse 2 geht es bis 100.' },
					// 207-N01: Der Zahlenstrahl hat keine Felder.
					{
						stufe: 'WARNUNG',
						text: 'Abbildung „Zahlenstrahl“: Er geht bis 200. In Klasse 2 geht es bis 100.',
					},
				],
			);
			const fehler = meldungen.filter((m) => m.code === 'abbildung').map((m) => m.text);
			assert.equal(fehler.length, 2, 'das Zahlenhaus über einer Million und das mit Kommazahl');
			assert.match(
				fehler[0] ?? '',
				/^Abbildung „Zahlenhaus“: Ein Feld wäre 2\D000\D000\. Mehr als 1\D000\D000 geht nicht\.$/,
			);
			// 207-N03: nie „NaN“ in einer Meldung.
			assert.equal(fehler[1], 'Abbildung „Zahlenhaus“: 4,5 ist keine ganze Zahl. Nimm ganze Zahlen.');
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	it('kein „Platz frei“ vor einer automatischen Seite, wohl aber auf der letzten (206)', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-207-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, BLATT);
			const frei = (await pruefe(datei)).filter((m) => m.code === 'platz-frei').map((m) => m.seite);
			assert.ok(!frei.includes(2), 'Seite 2 hat eine automatische Folgeseite');
			assert.ok(frei.includes(3), 'die letzte Seite meldet weiter');
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});

describe('pruefung.js: Arbeitsseite gefüllt wie im Schulbuch (213)', { skip: browserSkip() }, () => {
	const aufgabe = (nr: number, items: number) =>
		`<div class="aufgabe"><span class="nr">${nr}</span><div class="anw"><span class="text">Rechne.</span></div>` +
		`<div class="koerper"><div class="reihe" style="--spalten:3">${'<div class="zelle links"><div class="zeile">3 + 4 = <span class="antwort" data-l="7"></span></div></div>'.repeat(items)}</div></div></div>`;
	const blatt = (body: string, seite: string, aufgaben: string) =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>213</title>',
			'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
			`<body class="kl2 farbe"${body}>`,
			`<section class="seite"${seite}><div class="kopf"><div class="titel"><h1>Plus</h1></div></div>${aufgaben}</section>`,
			'</body></html>',
		].join('\n');
	const WENIG = [1, 2, 3].map((nr) => aufgabe(nr, 3)).join('');
	const melde = async (html: string) => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-213-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, html);
			return await pruefe(datei);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};
	const stufe = (meldungen: Meldung[], code: string) => meldungen.find((m) => m.code === code)?.stufe;

	it('drei Aufgaben mit neun Teilaufgaben: „inhalt-wenig“ und „platz-frei“ als WARNUNG', async () => {
		const meldungen = await melde(blatt(' data-satz="2"', '', WENIG));
		assert.equal(stufe(meldungen, 'inhalt-wenig'), 'WARNUNG');
		assert.equal(stufe(meldungen, 'platz-frei'), 'WARNUNG');
	});

	it('data-dicht-ok an der Seite nimmt sie aus', async () => {
		const meldungen = await melde(blatt(' data-satz="2"', ' data-dicht-ok', WENIG));
		assert.equal(stufe(meldungen, 'inhalt-wenig'), undefined);
		assert.equal(stufe(meldungen, 'platz-frei'), 'HINWEIS');
	});

	it('ohne data-satz bleibt die Prüfung, wie sie war', async () => {
		assert.equal(stufe(await melde(blatt('', '', WENIG)), 'inhalt-wenig'), undefined);
	});

	it('vier Aufgaben und zwölf Teilaufgaben auf halb leerer Seite: „platz-frei“ meldet, „inhalt-wenig“ nicht doppelt', async () => {
		const meldungen = await melde(blatt(' data-satz="2"', '', [1, 2, 3, 4].map((nr) => aufgabe(nr, 3)).join('')));
		assert.ok(meldungen.some((m) => m.code === 'platz-frei' && m.stufe === 'WARNUNG'));
		assert.equal(stufe(meldungen, 'inhalt-wenig'), undefined);
	});
});

describe('pruefung.js: Bild mit Ebenen (215)', { skip: browserSkip() }, () => {
	const fallKarte = (bild: string) =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>215</title>',
			'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
			'<body class="kl2 farbe" data-satz="2"><section class="seite fall">',
			`<div class="fall-bild" style="--h:660px">${bild}<div class="fall-band">Kapitel 1</div></div>`,
			'<div class="fall-innen"><h1>Die Turmuhr</h1><div class="fall-text"><p>Willi schaut hinauf.</p></div></div>',
			'</section></body></html>',
		].join('\n');
	const ebenen =
		'<img src="bilder/wachstum.png" alt="Szene">' +
		'<img class="lage" src="bilder/willi.png" alt="Willi" style="--x:2%;--y:40%;--b:30%">' +
		'<div class="lage lage-zettel" style="--x:20%;--y:50%;--b:20%"><x-uhr zeit="7:30" groesse="100"></x-uhr></div>';
	const melde = async (html: string) => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-215-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, html);
			return (await pruefe(datei)).filter((m) =>
				['ueberlappung', 'ueberlauf', 'rand', 'abgeschnitten'].includes(m.code ?? ''),
			);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};

	it('Ebenen in .bild-lagen liegen mit Absicht übereinander und am Platz beschnitten', async () => {
		const html = fallKarte(
			`<div class="bild-lagen"><div class="lagen-flaeche" style="--ar:16/9">${ebenen}</div></div>`,
		);
		assert.deepEqual(await melde(html), []);
	});

	it('ohne .bild-lagen meldet die Prüfung die Überlappung weiter', async () => {
		const html = fallKarte(
			`<div style="position:relative;height:100%">${ebenen.replaceAll('class="lage', 'class="frei')}</div>`,
		);
		assert.ok((await melde(html)).some((m) => m.code === 'ueberlappung'));
	});
});

describe('pruefung.js: Ausschneide- und Legematerial (214)', { skip: browserSkip() }, () => {
	const CODES = ['teile-viele', 'teil-klein', 'motiv-klein', 'schnitt-knapp', 'karten-einzeln'];
	const figur = '1 1 0 / 1 1 1 / 0 1 1';
	const blatt = (body: string, inhalt: string) =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>214</title>',
			'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
			`<body class="kl2 farbe"${body}><section class="seite">${inhalt}</section></body></html>`,
		].join('\n');
	const karten = (stil: string, n: number, gitter: string) =>
		`<div class="karten" style="${stil}">${`<div class="karte"><x-gitter spalten="3" zeilen="3" figur="${figur}"${gitter}></x-gitter></div>`.repeat(n)}</div>`;
	const melde = async (html: string) => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-214-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, html);
			return (await pruefe(datei)).filter((m) => CODES.includes(m.code ?? ''));
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};
	const stufe = (meldungen: Meldung[], code: string) => meldungen.find((m) => m.code === code)?.stufe;

	it('zwölf Karten mit kleinem Gitter: „teile-viele“ und „motiv-klein“ als WARNUNG', async () => {
		const meldungen = await melde(
			blatt(' data-satz="2"', karten('--spalten:3;--zeilen:4', 12, ' kaestchen="0.5"')),
		);
		assert.equal(stufe(meldungen, 'teile-viele'), 'WARNUNG');
		assert.equal(stufe(meldungen, 'motiv-klein'), 'WARNUNG');
	});

	it('ohne data-satz bleibt die Prüfung, wie sie war', async () => {
		assert.deepEqual(await melde(blatt('', karten('--spalten:3;--zeilen:4', 12, ' kaestchen="0.5"'))), []);
	});

	it('3 × 3 Karten, Gitter ohne kaestchen füllt die Karte: keine Meldung', async () => {
		assert.deepEqual(await melde(blatt(' data-satz="2"', karten('--spalten:3;--zeilen:3', 9, ''))), []);
	});

	describe('Karten je A4 (250)', () => {
		const wort = (w: string) => `<div class="karte"><span class="kartentext">${w}</span></div>`;
		const seite = (inhalt: string, mehr = '') =>
			`<section class="seite"${mehr}><div class="karten" style="--spalten:1;--zeilen:1">${inhalt}</div></section>`;
		const mappe = (body: string, seiten: string) =>
			[
				'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>250</title>',
				'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
				`<body class="kl2 farbe"${body}>${seiten}</body></html>`,
			].join('\n');
		const einzeln = async (html: string) =>
			(await melde(html)).filter((m) => m.code === 'karten-einzeln').map((m) => [m.stufe, m.seite]);

		it('Wortkarten eine je A4 ohne Angabe: WARNUNG auf der ersten Seite', async () => {
			assert.deepEqual(await einzeln(mappe(' data-satz="2"', seite(wort('Hälfte')) + seite(wort('Spiegel')))), [
				['WARNUNG', 1],
			]);
		});

		it('mit data-tafel-gross, ohne data-satz oder mit einem letzten Bogen nach vollen Seiten: keine Meldung', async () => {
			const zwei = `<section class="seite"><div class="karten" style="--spalten:1;--zeilen:2">${wort('Hälfte')}${wort('Spiegel')}</div></section>`;
			assert.deepEqual(await einzeln(mappe(' data-satz="2" data-tafel-gross', seite(wort('Hälfte')))), []);
			assert.deepEqual(await einzeln(mappe(' data-satz="2"', seite(wort('Hälfte'), ' data-tafel-gross'))), []);
			assert.deepEqual(await einzeln(mappe('', seite(wort('Hälfte')) + seite(wort('Spiegel')))), []);
			assert.deepEqual(await einzeln(mappe(' data-satz="2"', zwei + seite(wort('Achse')))), []);
		});
	});

	it('Schneidebogen mit 30 mm breiten Teilen: „teil-klein“', async () => {
		const bogen = `<div class="schneidebogen" style="--spalten:4;--teil-b:30mm;--teil-h:45mm">${'<div><span class="kartentext">7</span></div>'.repeat(4)}</div>`;
		const meldungen = await melde(blatt(' data-satz="2"', bogen));
		assert.match(
			meldungen.find((m) => m.code === 'teil-klein')?.text ?? '',
			/^4 Teile zum Selbstschneiden sind zu klein \(30 × 45 mm\)/,
		);
	});

	it('Karte mit 1 mm Innenabstand: „schnitt-knapp“', async () => {
		const karte =
			'<div class="karte" style="padding:1mm;justify-content:flex-start"><span class="kartentext">Ein langes Wort hier</span></div>';
		const meldungen = await melde(
			blatt(' data-satz="2"', `<div class="karten" style="--spalten:2;--zeilen:2">${karte.repeat(4)}</div>`),
		);
		assert.equal(stufe(meldungen, 'schnitt-knapp'), 'WARNUNG');
	});
});

describe('pruefung.js: Auftakt (217)', { skip: browserSkip() }, () => {
	const folien = (body: string, inhalt: string) =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>217</title>',
			'<link rel="stylesheet" href="blatt.css"></head>',
			`<body class="kl2 farbe folie${body}" data-satz="2"><section class="seite">${inhalt}</section></body></html>`,
		].join('\n');
	const szene =
		'<aside class="notiz"><p>Schauen lassen.</p></aside><div class="ebene hinten">' +
		'<svg data-frei data-frei-titel="Szene" data-lage="frei" viewBox="0 0 1280 720" style="--b:1280px;--h:720px"><rect width="1280" height="720" fill="#123"/></svg></div>';
	const melde = async (html: string) => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-217-'));
		try {
			const datei = path.join(tmp, 'folien.html');
			await writeFile(datei, html);
			return await pruefe(datei);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};

	it('Szene bis an den Rand: im Auftakt kein „druckrand“, auf anderen Folien schon', async () => {
		assert.equal((await melde(folien(' auftakt', szene))).filter((m) => m.code === 'druckrand').length, 0);
		assert.ok((await melde(folien('', szene))).some((m) => m.code === 'druckrand'));
	});

	it('kleine Schrift meldet die Prüfung auch im Auftakt', async () => {
		const klein = `${szene}<div class="ebene vorne"><div class="schmuck" data-lage="frei" data-schmuck="titel" style="--x:100px;--y:100px;--gr:20px">Zu klein</div></div>`;
		assert.ok((await melde(folien(' auftakt', klein))).some((m) => m.code === 'schrift-klein'));
	});
});

describe('pruefung.js: Prüfbericht im Lauf (225)', { skip: browserSkip() }, () => {
	const aufgabe = (nr: number, min: number) =>
		`<div class="aufgabe" data-min="${min}"><span class="nr">${nr}</span><div class="anw"><span class="text">Rechne.</span></div></div>`;
	const melde = async (body: string, inhalt: string, thema = '') => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-225-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(path.join(tmp, 'thema.css'), thema);
			await writeFile(
				datei,
				[
					'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>225</title>',
					`<link rel="stylesheet" href="blatt.css">${thema ? '<link rel="stylesheet" href="thema.css">' : ''}</head>`,
					`<body class="kl2 farbe"${body}>${inhalt}</body></html>`,
				].join('\n'),
			);
			return await pruefe(datei);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};

	it('zeit-viel: über 125 % des Zeitziels, je Weg; bis 125 % still', async () => {
		const meldungen = await melde(
			' data-zeit="10"',
			`<section class="seite">${aufgabe(1, 8)}${aufgabe(2, 8)}</section><section class="seite">${aufgabe(1, 6)}${aufgabe(2, 6)}</section>`,
		);
		assert.deepEqual(
			meldungen.filter((m) => m.code === 'zeit-viel').map(({ seite, stufe, text }) => ({ seite, stufe, text })),
			[
				{
					seite: 1,
					stufe: 'WARNUNG',
					text: 'Die Aufgaben reichen für etwa 16 min, Ziel sind 10 min → Aufgabe auf ein weiteres Blatt oder zur Sternchenaufgabe machen',
				},
			],
		);
		assert.equal(meldungen.filter((m) => m.code === 'zeit-knapp').length, 0);
	});

	it('Thema und Kit-Anteil haben ihre Codes (HINWEIS)', async () => {
		const eigen = '<div class="eigen-kasten">x</div>'.repeat(5);
		const meldungen = await melde(
			'',
			`<section class="seite">${aufgabe(1, 5)}${eigen}</section>`,
			'.eigen-kasten { color: #333; }\n.titel { margin-top: 4px; }',
		);
		const stufe = (code: string) => meldungen.find((m) => m.code === code)?.stufe;
		assert.equal(stufe('thema-klasse'), 'HINWEIS');
		assert.equal(stufe('thema-layout'), 'HINWEIS');
		assert.equal(stufe('kit-anteil'), 'HINWEIS');
	});
});

describe('pruefung.js: Symmetrie (245)', { skip: browserSkip() }, () => {
	const blatt = (anweisung: string, inhalt: string) =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>245</title>',
			'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
			'<body class="kl3 farbe"><section class="seite"><div class="kopf"><div class="titel"><h1>Spiegel</h1></div></div>',
			`<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">${anweisung}</span></div>`,
			`<div class="koerper">${inhalt}</div></div>`,
			'</section></body></html>',
		].join('\n');
	const melde = async (html: string) => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-245-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			await writeFile(datei, html);
			return (await pruefe(datei)).filter((m) => m.code?.startsWith('symmetrie'));
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};

	it('Gitter mit „nur“, die Anweisung nennt die Achse nicht: FEHLER', async () => {
		const gitter =
			'<x-gitter spalten="4" zeilen="4" aufgabe="pruefen" nur="senkrecht" figur="1 1 / 1 0"></x-gitter>';
		const ohne = await melde(blatt('Ist die Figur symmetrisch?', gitter));
		assert.deepEqual(
			ohne.map((m) => [m.stufe, m.code]),
			[['FEHLER', 'symmetrie-achse']],
		);
		assert.deepEqual(await melde(blatt('Ist die Figur symmetrisch zur senkrechten Achse?', gitter)), []);
	});
});

describe('pruefung.js: Platz und Größe (249)', { skip: browserSkip() }, () => {
	interface Bericht {
		meldungen: Meldung[];
		felder?: {
			seite: number;
			aufgabe: string | null;
			art: string;
			anzahl: number;
			breite: number;
			hoehe: number;
		}[];
	}
	const blatt = (inhalt: string, body = 'kl2 farbe') =>
		[
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>249</title>',
			'<link rel="stylesheet" href="blatt.css"></head>',
			`<body class="${body}" data-satz="2"><section class="seite" data-dicht-ok>${inhalt}</section></body></html>`,
		].join('\n');
	const aufgabe = (nr: number, text: string, koerper: string, attr = '') =>
		`<div class="aufgabe"${attr}><span class="nr">${nr}</span><div class="anw"><span class="text">${text}</span></div><div class="koerper">${koerper}</div></div>`;
	const pruefeMit = async (html: string, ...zusatz: string[]): Promise<Bericht> => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-249-'));
		try {
			const datei = path.join(tmp, 'blatt.html');
			const bericht = path.join(tmp, 'bericht.json');
			await writeFile(datei, html);
			try {
				execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht, ...zusatz], {
					stdio: 'ignore',
				});
			} catch {
				// Exit-Code 1 bei FEHLER
			}
			return JSON.parse(await readFile(bericht, 'utf8')) as Bericht;
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	};
	const codes = (b: Bericht, ...nur: string[]) =>
		b.meldungen.filter((m) => m.code && nur.includes(m.code)).map((m) => [m.stufe, m.code, m.text]);

	it('Klebefeld 26 × 77 mm für einen Faltschnitt 80 × 95 mm: FEHLER; groß genug oder gedreht: still', async () => {
		const feld = (b: number, h: number, fuer = '80x95') =>
			aufgabe(
				3,
				'Klebe den Faltschnitt auf.',
				`<div class="feld-kleben" data-fuer="${fuer}" style="--b:${b}mm;--h:${h}mm"></div>`,
			);
		const klein = await pruefeMit(blatt(feld(26, 77)));
		assert.deepEqual(
			codes(klein, 'feld-klein').map(([stufe, , text]) => [stufe, text?.split(' → ')[0]]),
			[['FEHLER', 'A3: Klebefeld 26 × 77 mm, hinein soll 80 × 95 mm']],
		);
		assert.deepEqual(codes(await pruefeMit(blatt(feld(90, 105))), 'feld-klein', 'feld-fuer'), []);
		assert.deepEqual(codes(await pruefeMit(blatt(feld(105, 90))), 'feld-klein', 'feld-fuer'), []);
		assert.deepEqual(
			codes(await pruefeMit(blatt(feld(90, 105, 'groß'))), 'feld-fuer').map(([stufe]) => stufe),
			['FEHLER'],
		);
	});

	it('Zeichenfeld ohne data-fuer: Maß der Klasse als WARNUNG', async () => {
		const feld = aufgabe(1, 'Zeichne.', '<div class="feld-zeichnen" style="--b:45mm;--h:45mm"></div>');
		assert.deepEqual(
			codes(await pruefeMit(blatt(feld)), 'feld-klein').map(([stufe]) => stufe),
			['WARNUNG'],
		);
		assert.deepEqual(codes(await pruefeMit(blatt(feld, 'kl3 farbe')), 'feld-klein'), []);
	});

	it('Begründung mit einer Linie in Kl. 2: WARNUNG; mit drei Linien still', async () => {
		const linien = (n: number) => '<div class="schreiblinie"></div>'.repeat(n);
		const eine = await pruefeMit(
			blatt(aufgabe(2, 'Ist das symmetrisch?', linien(1), ' data-antwort="begruendung"')),
		);
		assert.deepEqual(codes(eine, 'linien-wenig'), [
			[
				'WARNUNG',
				'linien-wenig',
				'A2: 1 Schreiblinie für eine Begründung, Klasse 2 braucht mindestens 3 → weitere .schreiblinie',
			],
		]);
		const drei = await pruefeMit(
			blatt(aufgabe(2, 'Ist das symmetrisch?', linien(3), ' data-antwort="begruendung"')),
		);
		assert.deepEqual(codes(drei, 'linien-wenig', 'antwort-menge'), []);
	});

	it('„weil“ ohne data-antwort: ein HINWEIS je Seite für alle Aufgaben', async () => {
		const weil = (nr: number) =>
			aufgabe(nr, 'Ist das symmetrisch?', '<div class="zeile">Nein, weil</div><div class="schreiblinie"></div>');
		const bericht = await pruefeMit(
			blatt(`${weil(1)}${weil(2)}${aufgabe(3, 'Rechne.', '<div class="schreiblinie"></div>')}`),
		);
		assert.deepEqual(
			codes(bericht, 'antwort-menge').map(([stufe, , text]) => [stufe, text?.split(':')[0]]),
			[['HINWEIS', 'A1, A2']],
		);
	});

	it('Ausschneidemotiv mit 15 mm in Kl. 2: WARNUNG teil-klein', async () => {
		const motiv = aufgabe(
			1,
			'Schneide aus.',
			'<svg data-schnitt width="57" height="57"><circle cx="28" cy="28" r="26" fill="none" stroke="#000" stroke-dasharray="4 3"/></svg>',
		);
		const text = codes(await pruefeMit(blatt(motiv)), 'teil-klein').map(([stufe, , t]) => [
			stufe,
			t?.split(':')[0],
		]);
		assert.deepEqual(text, [['WARNUNG', '1 Teil zum Selbstschneiden ist zu klein (15 × 15 mm)']]);
	});

	it('Messung: leere Felder je Aufgabe zusammen, ohne Kästchen, Schreiblinien und Rahmen um Aufgaben', async () => {
		const rechteck =
			'<svg viewBox="0 0 50 100" width="49" height="95"><rect x="2" y="2" width="46" height="96" fill="#fff" stroke="#000" stroke-width="1.5"/><path d="M2 2V98" stroke="#000" stroke-width="3" stroke-dasharray="0.1 6"/></svg>';
		const voll =
			'<svg viewBox="0 0 50 100" width="49" height="95"><rect x="2" y="2" width="46" height="96" fill="#fff" stroke="#000"/><circle cx="25" cy="50" r="15"/></svg>';
		const bericht = await pruefeMit(
			blatt(
				[
					aufgabe(
						3,
						'Male die Fehler.',
						`<div class="reihe" style="--spalten:3">${`<div class="zelle">${rechteck}</div>`.repeat(3)}</div>`,
					),
					aufgabe(4, 'Kreuze an.', `<span class="box"></span> ja ${voll}<div class="schreiblinie"></div>`),
					`<div style="border:2px solid #000;padding:4mm">${aufgabe(5, 'Male.', '<div class="malfeld" style="--h:100px;width:60mm"></div>')}</div>`,
				].join(''),
			),
		);
		assert.deepEqual(
			bericht.felder?.map(({ anzahl, art, aufgabe: a, breite, hoehe, seite }) => [
				seite,
				a,
				art,
				anzahl,
				breite,
				hoehe,
			]),
			[
				[1, 'A3', 'leer', 3, 12, 24],
				[1, 'A5', 'leer', 1, 60, 26],
			],
		);
	});

	it('Schauseite in s/w: WARNUNG nur, wenn s/w gedruckt wird (Quelle in s/w oder --sw-druck)', async () => {
		const fall =
			'<section class="seite fall"><div class="fall-innen" style="background:#fff"><h1 style="color:#c8c8c8">Schnipsel im Schnee</h1></div></section>';
		const html = (body: string) => blatt('', body).replace('<section class="seite" data-dicht-ok></section>', fall);
		const schau = async (body: string, ...zusatz: string[]) =>
			codes(await pruefeMit(html(body), ...zusatz), 'kontrast-sw-schau', 'kontrast-sw').map(
				([stufe, code]) => `${stufe} ${code}`,
			);
		assert.deepEqual(await schau('kl2 farbe', '--profil', 'sw'), ['HINWEIS kontrast-sw']);
		assert.deepEqual((await schau('kl2 farbe', '--profil', 'sw', '--sw-druck')).sort(), [
			'HINWEIS kontrast-sw',
			'WARNUNG kontrast-sw-schau',
		]);
		assert.deepEqual((await schau('kl2 sw')).sort(), ['HINWEIS kontrast-sw', 'WARNUNG kontrast-sw-schau']);
	});

	it('Schauseite in s/w liest color(srgb …) aus color-mix: dunkler Titel still, heller Titel WARNUNG', async () => {
		// .seite.fall hat eine Fläche aus color-mix, berechnet als color(srgb 0.92 0.92 0.92); als 0–255 gelesen wäre
		// sie fast schwarz und der dunkle Titel kaum lesbar.
		const seite = (farbe: string) =>
			blatt('', 'kl2 sw').replace(
				'<section class="seite" data-dicht-ok></section>',
				`<section class="seite fall"><div class="fall-innen" style="background:color-mix(in srgb,#fff 85%,#000)"><h1 style="color:${farbe}">Schnipsel im Schnee</h1></div></section>`,
			);
		const schau = async (farbe: string) =>
			codes(await pruefeMit(seite(farbe)), 'kontrast-sw-schau').map(([stufe, code]) => `${stufe} ${code}`);
		assert.deepEqual(await schau('#1d1d1d'), []);
		assert.deepEqual(await schau('#c8c8c8'), ['WARNUNG kontrast-sw-schau']);
	});

	it('kontrast-sw liest color(srgb …) aus color-mix; eine unbekannte Farbform meldet nichts', async () => {
		const seite = (flaeche: string, farbe: string) =>
			blatt('', 'kl2 sw').replace(
				'<section class="seite" data-dicht-ok></section>',
				`<section class="seite"><div style="background:${flaeche};padding:4mm"><p style="color:${farbe}">Lies den Text genau.</p></div></section>`,
			);
		const sw = async (flaeche: string, farbe: string) =>
			codes(await pruefeMit(seite(flaeche, farbe)), 'kontrast-sw').map(([stufe, code]) => `${stufe} ${code}`);
		const mix = 'color-mix(in srgb,#fff 85%,#000)';
		assert.deepEqual(await sw(mix, '#1d1d1d'), []);
		assert.deepEqual(await sw(mix, '#c8c8c8'), ['HINWEIS kontrast-sw']);
		assert.deepEqual(await sw('oklch(0.95 0 0)', '#c8c8c8'), []);
	});
});
