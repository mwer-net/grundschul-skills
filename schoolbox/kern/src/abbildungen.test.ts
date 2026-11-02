import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import type { AbbildungSchema, Feld, ListeFeld, Werte } from './abbildungen';
import {
	ABBILDUNG_SCHEMA,
	aendereFeld,
	attributeVon,
	feldWert,
	NUR_ZUR_LAUFZEIT,
	pruefeWerte,
	rasterText,
	rasterVon,
	schemaVon,
	setzeAbbildung,
	werteVon,
	zeilenText,
	zeilenVon,
	ziffernText,
} from './abbildungen';
import { ASSETS } from './konfig';
import { zerlege } from './quelltext';

const JS = readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8');

/** Tag → Name der Zeichenfunktion, aus `const ARTEN = { "x-uhr": uhr, … }`. */
const arten = (): Record<string, string> => {
	const liste = /const ARTEN = \{([^}]*)\}/.exec(JS)?.[1] ?? '';
	return Object.fromEntries([...liste.matchAll(/"(x-[a-z0-9-]+)":\s*(\w+)/g)].map((t) => [t[1] ?? '', t[2] ?? '']));
};

/** Alle Attribute, die eine Zeichenfunktion liest (`num(el, "…")`, `getAttribute("…")`, `hasAttribute("…")`). */
const gelesen = (funktion: string) => {
	const start = JS.indexOf(`function ${funktion}(el)`);
	assert.ok(start >= 0, funktion);
	const rumpf = JS.slice(start, JS.indexOf('\n  }\n', start));
	const namen = [
		...rumpf.matchAll(
			/(?:num\(el, |attr\(el, |liste\(el, |paare\(el, |raster\(el, |getAttribute\(|hasAttribute\()"([a-z0-9-]+)"/g,
		),
	].map((t) => t[1]);
	if (/\binhalt\(el\)/.test(rumpf)) {
		namen.push('inhalt');
	}
	return [...new Set(namen)].sort();
};

const schema = (tag: keyof typeof ABBILDUNG_SCHEMA): AbbildungSchema => ABBILDUNG_SCHEMA[tag];

const feld = (s: AbbildungSchema, attribut: string): Feld => {
	const f = s.felder.find((x) => x.attribut === attribut);
	assert.ok(f, attribut);
	return f;
};

const pruefe = (tag: keyof typeof ABBILDUNG_SCHEMA, werte: Werte) => {
	const s = schema(tag);
	const leer = Object.fromEntries(attributeVon(s).map((a) => [a, null]));
	return pruefeWerte(s, { ...leer, ...werte });
};

describe('Schema der Abbildungen', () => {
	it('hat für jedes Element aus abbildungen.js genau einen Eintrag', () => {
		assert.deepEqual(Object.keys(arten()).sort(), Object.keys(ABBILDUNG_SCHEMA).sort());
	});

	it('kennt genau die Attribute, die abbildungen.js liest', () => {
		for (const [tag, funktion] of Object.entries(arten())) {
			const s = schemaVon(tag);
			assert.ok(s, tag);
			const imSchema = [...attributeVon(s), ...NUR_ZUR_LAUFZEIT.filter((a) => gelesen(funktion).includes(a))];
			assert.deepEqual([...new Set(imSchema)].sort(), gelesen(funktion), tag);
		}
	});

	it('nimmt jede Abbildung aus den Vorlagen, Beispielen und Musterblättern als gültig an', () => {
		let anzahl = 0;
		const dateien = [
			...readdirSync(ASSETS)
				.filter((d) => d.endsWith('.html'))
				.map((d) => path.join(ASSETS, d)),
			...readdirSync(path.join(ASSETS, 'muster')).map((d) => path.join(ASSETS, 'muster', d)),
		];
		for (const datei of dateien) {
			const z = zerlege(readFileSync(datei, 'utf8'));
			for (const k of z.knoten) {
				const s = schemaVon(k.tag);
				if (s && !k.attribute.some((a) => a.name === 'data-erwarteter-fehler')) {
					anzahl += 1;
					assert.deepEqual(pruefeWerte(s, werteVon(s, k, z)), {}, `${datei}: <${k.tag}>`);
				}
			}
		}
		assert.ok(anzahl > 5);
	});

	it('abbildungen.js nennt jedes Element wie das Schema', () => {
		const block = /const NAMEN = \{([^}]*)\}/.exec(JS)?.[1] ?? '';
		const namen = new Map([...block.matchAll(/"(x-[a-z0-9-]+)":\s*"([^"]+)"/g)].map((t) => [t[1], t[2]]));
		for (const [tag, s] of Object.entries(ABBILDUNG_SCHEMA)) {
			assert.equal(namen.get(tag), s.name, tag);
		}
	});
});

describe('Prüfen', () => {
	it('Uhrzeit: Minuten 0 bis 59, Format Stunde:Minute', () => {
		assert.deepEqual(pruefe('x-uhr', { zeit: '4:30' }), {});
		assert.deepEqual(pruefe('x-uhr', { loesung: '11:05' }), {});
		assert.match(pruefe('x-uhr', { zeit: '4:75' }).zeit ?? '', /Minuten 0 bis 59/);
		assert.match(pruefe('x-uhr', { zeit: 'halb fünf' }).zeit ?? '', /4:30/);
	});

	it('Zahlen: ganz und in den Grenzen', () => {
		assert.match(pruefe('x-zwanzigerfeld', { n: '21' }).n ?? '', /von 0 bis 20/);
		assert.match(pruefe('x-zwanzigerfeld', { n: '2,5' }).n ?? '', /ganze Zahl/);
		assert.deepEqual(pruefe('x-zwanzigerfeld', { n: '20' }), {});
	});

	it('Menge: Bündel nur bei 10 je Reihe und nur volle Zehner', () => {
		assert.deepEqual(pruefe('x-menge', { 'n': '36', 'buendel-loesung': '3' }), {});
		assert.match(pruefe('x-menge', { n: '36', buendel: '4' }).buendel ?? '', /nur 3 volle Zehnerreihen/);
		assert.match(pruefe('x-menge', { n: '8', buendel: '1' }).buendel ?? '', /keinen vollen Zehner/);
		assert.match(pruefe('x-menge', { n: '36', reihe: '5', buendel: '1' }).buendel ?? '', /10 in einer Reihe/);
	});

	it('Zahlenstrahl: von < bis, Zahlen und Pfeile im Bereich, nicht zu viele Striche', () => {
		assert.deepEqual(pruefe('x-zahlenstrahl', { von: '0', bis: '100', schritt: '10', pfeile: '30 70' }), {});
		assert.match(pruefe('x-zahlenstrahl', { von: '20', bis: '20' }).bis ?? '', /größer/);
		assert.match(pruefe('x-zahlenstrahl', { pfeile: '7 25' }).pfeile ?? '', /25 liegt nicht zwischen 0 und 20/);
		assert.match(pruefe('x-zahlenstrahl', { bis: '1000' }).schritt ?? '', /1000 Striche/);
		assert.match(pruefe('x-zahlenstrahl', { zahlen: '0 fünf' }).zahlen ?? '', /keine Zahl/);
	});

	it('Stellentafel: so viele Zahlen wie Stellen, Lücken nur rechts', () => {
		assert.deepEqual(pruefe('x-stellentafel', { stellen: 'H Z E', loesung: '1 3 5' }), {});
		assert.deepEqual(pruefe('x-stellentafel', { werte: '3' }), {});
		assert.match(pruefe('x-stellentafel', { loesung: '1 3 5' }).werte ?? '', /nur 2 Stellen/);
		assert.match(pruefe('x-stellentafel', { stellen: 'H Z E', werte: '? 3 5' }).werte ?? '', /Bei „H“ fehlt/);
	});

	it('Timer: die Skala reicht bis zu den Minuten', () => {
		assert.deepEqual(pruefe('x-timer', { minuten: '5', skala: '5' }), {});
		assert.match(pruefe('x-timer', { minuten: '25', skala: '10' }).skala ?? '', /nur bis 10/);
	});

	it('Strich-Punkt und Dienes: mindestens ein Zehner oder Einer', () => {
		assert.match(pruefe('x-strichpunkt', { z: '0', e: '0' }).e ?? '', /Mindestens/);
		assert.deepEqual(pruefe('x-dienes', { z: '3' }), {});
	});
});

describe('Felder ändern', () => {
	it('legt den Wert mit „nur in der Lösung“ in das Lösungs-Attribut und zurück', () => {
		const s = schema('x-uhr');
		const uhrzeit = feld(s, 'zeit');
		const start: Werte = { zeit: '4:30', loesung: null, ziffern: null, groesse: null };
		const versteckt = aendereFeld(s, start, uhrzeit, '4:30', true);
		assert.deepEqual([versteckt.zeit, versteckt.loesung], [null, '4:30']);
		assert.deepEqual(feldWert(uhrzeit, versteckt), { wert: '4:30', nurLoesung: true });
		const spaeter = aendereFeld(s, versteckt, uhrzeit, '5:00');
		assert.deepEqual([spaeter.zeit, spaeter.loesung], [null, '5:00']);
		const leer = aendereFeld(s, spaeter, uhrzeit, null);
		assert.deepEqual([leer.zeit, leer.loesung], [null, null]);
	});

	it('Bündel: das Lösungs-Attribut hat Vorrang wie in abbildungen.js', () => {
		const s = schema('x-menge');
		assert.deepEqual(feldWert(feld(s, 'buendel'), { 'buendel': '1', 'buendel-loesung': '3' }), {
			wert: '3',
			nurLoesung: true,
		});
	});

	it('Stellen ändern: Zahlen bleiben rechtsbündig an ihrer Stelle', () => {
		const s = schema('x-stellentafel');
		const stellen = feld(s, 'stellen');
		const start: Werte = { stellen: null, werte: null, loesung: '3 5', zeilen: null };
		const mehr = aendereFeld(s, start, stellen, 'H Z E');
		assert.equal(mehr.loesung, '? 3 5');
		assert.match(pruefeWerte(s, mehr).werte ?? '', /Bei „H“ fehlt/);
		const weniger = aendereFeld(s, { ...start, stellen: 'H Z E', loesung: '1 3 5' }, stellen, null);
		assert.equal(weniger.loesung, '3 5');
	});

	it('ziffernText: leere Stellen rechts fallen weg, eine leere Tafel hat keinen Wert', () => {
		assert.equal(ziffernText(['3', '', '']), '3');
		assert.equal(ziffernText(['', '5']), '? 5');
		assert.equal(ziffernText(['', '']), null);
	});
});

describe('neue Feldtypen', () => {
	const probe = schema('x-probe');
	const liste = feld(probe, 'eintraege') as ListeFeld;

	it('Liste: Paare lesen und schreiben, leere Felder bleiben im Entwurf sichtbar', () => {
		assert.deepEqual(zeilenVon(liste, 'Hund: 7; Katze: 4'), [
			['Hund', '7'],
			['Katze', '4'],
		]);
		assert.deepEqual(zeilenVon(liste, 'Hund: 7;'), [['Hund', '7']]);
		assert.equal(
			zeilenText(liste, [
				['Hund', '7'],
				['Katze', '4'],
			]),
			'Hund: 7; Katze: 4',
		);
		const entwurf = zeilenText(liste, [
			['Hund', ''],
			['', '4'],
		]);
		assert.deepEqual(zeilenVon(liste, entwurf), [
			['Hund', ''],
			['', '4'],
		]);
		assert.equal(zeilenText(liste, []), null);
	});

	it('Liste: andere Trenner', () => {
		const spruenge: ListeFeld = {
			art: 'liste',
			attribut: 'a',
			name: 'A',
			zeilenTrenner: ' ',
			unter: [{ name: 'S', art: 'text' }],
		};
		assert.deepEqual(zeilenVon(spruenge, '+30 +4'), [['+30'], ['+4']]);
		assert.equal(zeilenText(spruenge, [['+30'], ['+4']]), '+30 +4');
		const paar: ListeFeld = {
			art: 'liste',
			attribut: 'a',
			name: 'A',
			feldTrenner: ' ',
			unter: [
				{ name: 'X', art: 'zahl' },
				{ name: 'Y', art: 'zahl' },
			],
		};
		assert.deepEqual(zeilenVon(paar, '3 4; 5 2'), [
			['3', '4'],
			['5', '2'],
		]);
		assert.equal(
			zeilenText(paar, [
				['3', '4'],
				['5', '2'],
			]),
			'3 4; 5 2',
		);
	});

	it('Prüfen: Text, Liste, Mehrfach, Raster, Muster und Regeln', () => {
		assert.match(pruefe('x-probe', { titel: 'x'.repeat(21) }).titel ?? '', /Höchstens 20/);
		assert.match(pruefe('x-probe', { inhalt: 'Ro1' }).inhalt ?? '', /Nur Buchstaben/);
		assert.deepEqual(pruefe('x-probe', { inhalt: 'Ro|si|ne' }), {});
		assert.match(pruefe('x-probe', { eintraege: 'A: 200' }).eintraege ?? '', /Zeile 1.*0 bis 99/);
		assert.match(pruefe('x-probe', { eintraege: 'A: ∅' }).eintraege ?? '', /Zeile 1: „Zahl“ fehlt/);
		assert.match(pruefe('x-probe', { eintraege: 'A: 1; B: 1; C: 1; D: 1' }).eintraege ?? '', /Vier geht nicht/);
		assert.match(pruefe('x-probe', { arten: 'vier' }).arten ?? '', /gibt es hier nicht/);
		assert.match(pruefe('x-probe', { feld: '0 2' }).feld ?? '', /„2“ geht/);
		assert.match(pruefe('x-probe', { hoehen: '1 9' }).hoehen ?? '', /von 0 bis 5/);
		assert.match(pruefe('x-probe', { farbe: 'pink' }).farbe ?? '', /gibt es hier nicht/);
	});

	it('Feld am Inhalt: Wert ist der Text im Element, geschrieben wird nur der Inhalt', () => {
		const q = '<div><x-probe titel="a">Ro|si&amp;ne</x-probe></div>';
		const z = zerlege(q);
		const k = z.knoten.find((x) => x.tag === 'x-probe');
		assert.ok(k);
		assert.equal(werteVon(probe, k, z).inhalt, 'Ro|si&ne');
		const { quelle } = setzeAbbildung('<div><x-probe titel="a">Ro|sine</x-probe></div>', k.nr, {
			inhalt: 'Ro|si|ne<',
		});
		assert.equal(quelle, '<div><x-probe titel="a">Ro|si|ne&lt;</x-probe></div>');
	});

	it('Raster lesen und schreiben', () => {
		assert.deepEqual(rasterVon('0 1 1 / 0 1 0'), [
			['0', '1', '1'],
			['0', '1', '0'],
		]);
		assert.equal(
			rasterText([
				['0', '1'],
				['1', '0'],
			]),
			'0 1 / 1 0',
		);
		assert.equal(rasterText([]), null);
	});
});

describe('setzeAbbildung', () => {
	const QUELLE = `<div class="aufgabe">
  <div class="reihe">
    <div class="zelle beispiel"><x-uhr zeit="4:30" groesse="88"></x-uhr></div>
    <div class="zelle"><x-uhr loesung="9:00"></x-uhr></div>
  </div>
</div>
`;
	const uhren = (q: string) => zerlege(q).knoten.filter((k) => k.tag === 'x-uhr');

	it('ändert nur das Attribut, die Nummern bleiben', () => {
		const nr = uhren(QUELLE)[0]?.nr ?? -1;
		const { nr: danach, quelle } = setzeAbbildung(QUELLE, nr, { zeit: '7:15' });
		assert.equal(danach, nr);
		assert.equal(quelle, QUELLE.replace('zeit="4:30"', 'zeit="7:15"'));
		assert.equal(zerlege(quelle).knoten.length, zerlege(QUELLE).knoten.length);
	});

	it('setzt mehrere neue Attribute und entfernt andere', () => {
		const nr = uhren(QUELLE)[1]?.nr ?? -1;
		const { quelle } = setzeAbbildung(QUELLE, nr, { loesung: null, zeit: '9:00', ziffern: 'nein', groesse: '120' });
		assert.match(quelle, /<x-uhr groesse="120" ziffern="nein" zeit="9:00"><\/x-uhr>/);
	});

	it('lehnt ungültige Werte und Nicht-Abbildungen ab', () => {
		const nr = uhren(QUELLE)[0]?.nr ?? -1;
		assert.throws(() => setzeAbbildung(QUELLE, nr, { zeit: '4:99' }), /Minuten 0 bis 59/);
		assert.throws(() => setzeAbbildung(QUELLE, 0, { zeit: '4:30' }), /keine Abbildung/);
	});
});

/** Lädt `abbildungen.js` ohne Browser; nötig sind nur die Rechenkerne. */
const rechenkerne = () => {
	const fenster: Record<string, unknown> = {};
	const dokument = {
		readyState: 'complete',
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	runInNewContext(JS, { window: fenster, document: dokument, Element: class {} });
	return fenster.schoolboxAbbildungen as {
		zahl: (n: number) => string;
		cm: (x: number) => number;
		zufall: (seed: number) => () => number;
		gemischt: <T>(feld: T[], zz: () => number) => T[];
		trenneListe: (text: string) => string[];
		trenneRaster: (text: string) => string[][];
	};
};

describe('Rechenkerne in abbildungen.js', () => {
	it('schreibt Zahlen mit Komma und schmalem Leerzeichen ab fünf Stellen', () => {
		const { zahl } = rechenkerne();
		assert.equal(zahl(1000), '1000');
		assert.equal(zahl(12_500), '12\u202F500');
		assert.equal(zahl(2.5), '2,5');
		assert.equal(zahl(-3), '−3');
	});

	it('mischt mit gleichem Seed gleich, mit anderem anders', () => {
		const { gemischt, zufall } = rechenkerne();
		const zahlen = Array.from({ length: 20 }, (_, i) => i);
		assert.deepEqual([...gemischt(zahlen, zufall(7))], [...gemischt(zahlen, zufall(7))]);
		assert.notDeepEqual([...gemischt(zahlen, zufall(7))], [...gemischt(zahlen, zufall(8))]);
		assert.deepEqual(
			[...gemischt(zahlen, zufall(7))].sort((a, b) => a - b),
			zahlen,
		);
	});

	it('trennt Listen und Raster wie das Schema', () => {
		const { trenneListe, trenneRaster } = rechenkerne();
		assert.deepEqual([...trenneListe('a b c')], ['a', 'b', 'c']);
		assert.deepEqual([...trenneListe('a b; c')], ['a b', 'c']);
		assert.deepEqual(
			Array.from(trenneRaster('0 1 / 1 0'), (z) => [...z]),
			[
				['0', '1'],
				['1', '0'],
			],
		);
	});
});
