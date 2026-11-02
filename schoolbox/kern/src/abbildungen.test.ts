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
import { ASSETS, BLATT_PY } from './konfig';
import { hatLoesung, MIT_LOESUNG, OHNE_LOESUNGSANGABE } from './loesungen';
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
	if (/\bsamen\(el,/.test(rumpf)) {
		namen.push('seed');
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

	it('Liste ohne Trenner zwischen Zahl und Zeichen', () => {
		const weg: ListeFeld = {
			art: 'liste',
			attribut: 'weg',
			name: 'Weg',
			zeilenTrenner: ' ',
			feldTrenner: '',
			unter: [
				{ name: 'S', art: 'zahl' },
				{ name: 'R', art: 'text' },
			],
		};
		assert.deepEqual(zeilenVon(weg, '3→ 12↑'), [
			['3', '→'],
			['12', '↑'],
		]);
		assert.equal(
			zeilenText(weg, [
				['3', '→'],
				['12', '↑'],
			]),
			'3→ 12↑',
		);
		assert.deepEqual(zeilenVon(weg, zeilenText(weg, [['', '→']])), [['', '→']]);
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

interface Form {
	zellen: number[][];
	polys: number[][][];
}

const flaecheVon = (p: number[][]) =>
	Math.abs(
		p.reduce((summe, [x = 0, y = 0], i) => {
			const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
			return summe + x * d - c * y;
		}, 0),
	) / 2;

const kantenVon = (p: number[][]) =>
	p
		.map(([x = 0, y = 0], i) => {
			const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
			return Math.round(Math.hypot(c - x, d - y) * 1000) / 1000;
		})
		.sort((a, b) => a - b);

const liegtIn = (x: number, y: number, p: number[][]) => {
	let drin = false;
	p.forEach(([a = 0, b = 0], i) => {
		const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
		const [ober, unter] = [b > y, d > y];
		if (ober !== unter && x < a + ((y - b) * (c - a)) / (d - b)) {
			drin = !drin;
		}
	});
	return drin;
};

interface Stellenrechnung {
	ziffern: number[];
	uebertraege?: number[];
	neu?: (number | null)[];
	sprechweise?: string[];
	ergebnis: number;
}

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
		bildVon: (form: Form, abbildung: (x: number, y: number) => number[]) => Form;
		spiegelung: (achse: string, bei: number) => (x: number, y: number) => number[];
		skaliere: (form: Form, faktor: number) => Form;
		gehWeg: (start: number[], schritte: string[], spalten: number, zeilen: number) => number[][];
		flaecheUmfang: (form: Form) => { flaeche: number; umfang: number | null };
		TANGRAM_TEILE: Record<string, number[][]>;
		TANGRAM_UMRISSE: Record<string, Record<string, number[][]>>;
		ansichtenVon: (plan: number[][]) => { vorne: number[]; rechts: number[]; links: number[]; oben: number[][] };
		wuerfelVon: (plan: number[][]) => unknown[];
		verdeckteWuerfel: (plan: number[][], art?: string) => unknown[];
		WUERFELNETZE: Record<string, string>;
		NICHT_NETZE: Record<string, string>;
		netzZellen: (code: string) => { nr: number; c: number; r: number }[];
		falteNetz: (zellen: unknown[]) => { nr: number; rahmen: { n: number[] } }[];
		istWuerfelnetz: (zellen: unknown[]) => boolean;
		netzLaschen: (zellen: unknown[]) => { nr: number; seite: string }[];
		AUGEN_DER_SEITE: Record<string, number>;
		vielflach: (form: string, masse: number[]) => { punkte: unknown[]; kanten: unknown[]; flaechen: unknown[] };
		KOERPER_ZAHLEN: Record<string, { ecken: number; kanten: number; flaechen: number }>;
		tafelOrt: (von: number, zahl: number) => number[];
		ausschnittZahlen: (von: number, bis: number, art: string, mitte: number | null) => number[];
		rechenstrichWerte: (start: number, spruenge: number[]) => number[];
		leseSprung: (text: string) => number;
		mauerWerte: (basis: number[], art?: string) => number[][];
		mauerEindeutig: (stufen: number, offen: string[], art?: string) => boolean;
		istEindeutig: (gleichungen: Record<string, number>[], offen: string[]) => boolean;
		RECHENDREIECK_GLEICHUNGEN: Record<string, number>[];
		zauberLoesungen: (art: string, zahlen: number[], summe: number | null) => Record<string, number>[];
		ketteWerte: (start: number, ops: unknown[]) => number[];
		leseOperator: (text: string) => unknown;
		malkreuzRechnung: (a: number, b: number) => { produkte: number[][]; summen: number[]; ergebnis: number };
		addiere: (zahlen: number[]) => Stellenrechnung;
		subtrahiereErweitern: (a: number, b: number, verfahren: string) => Stellenrechnung;
		subtrahiereEntbuendeln: (a: number, b: number, verfahren: string) => Stellenrechnung;
		multipliziere: (
			a: number,
			b: number,
		) => {
			teile: { faktor: number; verschoben: number; uebertraege: number[]; wert: number }[];
			summe: Stellenrechnung | null;
			ergebnis: number;
		};
		dividiere: (
			a: number,
			b: number,
		) => {
			schritte: { ende: number; teil: number; q: number; produkt: number; rest: number }[];
			quotient: number;
			rest: number;
		};
		moeglicheFehler: (art: string, zahlen: number[], verfahren: string | null) => { art: string }[];
		rechnungsplan: (
			art: string,
			zahlen: number[],
			verfahren: string | null,
			fehler: unknown,
			mitUebertrag: boolean,
		) => { text: string | number; zeilen: { zellen: { c: number; t: string; rolle: string }[] }[] };
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

describe('Daten und Zufall (024)', () => {
	it('prüft die Regeln über mehrere Felder', () => {
		assert.match(pruefe('x-gluecksrad', { felder: 'rot; blau', anteile: '0 0' }).anteile ?? '', /mehr als 0/);
		assert.match(pruefe('x-gluecksrad', { felder: 'rot; blau', anteile: '1 1 2' }).anteile ?? '', /genau 2 Zahlen/);
		assert.match(pruefe('x-diagramm', { werte: 'A: 12', bis: '10' }).bis ?? '', /größer als 10/);
		assert.match(pruefe('x-urne', { kugeln: 'rot: 15; blau: 6' }).kugeln ?? '', /21/);
		assert.match(
			pruefe('x-wahrscheinlichkeit', { ereignisse: 'A: sehr wahrscheinlich' }).ereignisse ?? '',
			/nicht auf/,
		);
		assert.deepEqual(pruefe('x-wahrscheinlichkeit', { stufen: '5', ereignisse: 'A: sehr wahrscheinlich' }), {});
	});

	it('hält die Regel fürs Lösungsblatt mit blatt.py gleich', () => {
		const blatt = readFileSync(BLATT_PY, 'utf8');
		assert.ok(blatt.includes(`OHNE_LOESUNGSANGABE = r"${OHNE_LOESUNGSANGABE}"`));
		assert.ok(blatt.includes(`MIT_LOESUNG = r"${MIT_LOESUNG}"`));
		assert.equal(hatLoesung('<x-gluecksrad felder="rot; blau"></x-gluecksrad>'), false);
		assert.equal(hatLoesung('<x-diagramm werte="A: 1"></x-diagramm>'), false);
		assert.equal(hatLoesung('<x-diagramm werte="A: 1" offen="1"></x-diagramm>'), true);
		assert.equal(hatLoesung('<x-strichliste werte="A: 1"></x-strichliste>'), true);
	});
});

describe('Ebene Geometrie (025)', () => {
	const zuListe = (w: number[][]) => Array.from(w, (z) => Array.from(z).join(',')).sort();
	const leer: number[][][] = [];

	it('spiegelt Kästchen und Linien genau', () => {
		const { bildVon, spiegelung } = rechenkerne();
		const b = bildVon(
			{
				zellen: [
					[3, 1],
					[4, 2],
				],
				polys: [
					[
						[0, 0],
						[3, 0],
						[3, 2],
					],
				],
			},
			spiegelung('senkrecht', 6),
		);
		assert.deepEqual(zuListe(b.zellen), ['7,2', '8,1']);
		assert.deepEqual(
			Array.from(b.polys[0] ?? [], (p) => Array.from(p).join(',')),
			['12,0', '9,0', '9,2'],
		);
		const w = bildVon({ zellen: [[3, 1]], polys: leer }, spiegelung('waagerecht', 4));
		assert.deepEqual(zuListe(w.zellen), ['3,6']);
	});

	it('vergrößert und verkleinert', () => {
		const { skaliere } = rechenkerne();
		assert.deepEqual(zuListe(skaliere({ zellen: [[2, 1]], polys: leer }, 2).zellen), ['0,0', '0,1', '1,0', '1,1']);
		const voll = [
			[2, 2],
			[3, 2],
			[2, 3],
			[3, 3],
		];
		assert.deepEqual(zuListe(skaliere({ zellen: voll, polys: leer }, 0.5).zellen), ['0,0']);
		assert.throws(() => skaliere({ zellen: [[2, 2]], polys: leer }, 0.5), /nicht halbieren/);
	});

	it('geht den Weg und lehnt das Verlassen ab', () => {
		const { gehWeg } = rechenkerne();
		const orte = gehWeg([1, 4], ['3→', '2↑', '1←'], 10, 6);
		assert.deepEqual(Array.from(orte.at(-1) ?? []), [3, 2]);
		assert.throws(() => gehWeg([1, 1], ['2↑'], 10, 6), /verlässt das Gitter/);
	});

	it('rechnet Fläche und Umfang', () => {
		const { flaecheUmfang } = rechenkerne();
		assert.deepEqual(
			{
				...flaecheUmfang({
					zellen: [
						[0, 0],
						[1, 0],
					],
					polys: leer,
				}),
			},
			{ flaeche: 2, umfang: 6 },
		);
		const schraeg = flaecheUmfang({
			zellen: [],
			polys: [
				[
					[1, 1],
					[5, 1],
					[3, 3],
				],
			],
		});
		assert.equal(schraeg.flaeche, 4);
		assert.equal(schraeg.umfang, null);
	});

	it('Tangram: Die sieben Teile ergeben das Quadrat, jeder Umriss ist eine gültige Lage', () => {
		const { TANGRAM_TEILE, TANGRAM_UMRISSE } = rechenkerne();
		const teile = Object.entries(TANGRAM_TEILE);
		assert.equal(teile.length, 7);
		assert.equal(
			teile.reduce((a, [, p]) => a + flaecheVon(p), 0),
			16,
		);
		const pruefeLage = (name: string, lage: Record<string, number[][]>) => {
			for (const [teil, p] of teile) {
				const q = lage[teil];
				assert.ok(q, `${name}: ${teil}`);
				assert.equal(q.length, p.length, `${name}: ${teil}`);
				assert.deepEqual(kantenVon(q), kantenVon(p), `${name}: ${teil} ist deckungsgleich`);
			}
			const alle = Object.values(lage);
			const xs = alle.flat().map((v) => v[0] ?? 0);
			const ys = alle.flat().map((v) => v[1] ?? 0);
			for (let x = Math.min(...xs) + 0.07; x < Math.max(...xs); x += 0.13) {
				for (let y = Math.min(...ys) + 0.11; y < Math.max(...ys); y += 0.13) {
					assert.ok(
						alle.filter((p) => liegtIn(x, y, p)).length <= 1,
						`${name}: Teile überlappen bei ${x},${y}`,
					);
				}
			}
		};
		pruefeLage('Quadrat', TANGRAM_TEILE);
		assert.ok(Object.keys(TANGRAM_UMRISSE).length >= 5);
		for (const [name, lage] of Object.entries(TANGRAM_UMRISSE)) {
			pruefeLage(name, lage);
		}
	});
});

describe('Räumliche Geometrie (026)', () => {
	const netto = <T>(wert: T): T => JSON.parse(JSON.stringify(wert)) as T;

	it('Ansichten passen zu Bauplänen, die von Hand gerechnet sind', () => {
		const { ansichtenVon, wuerfelVon } = rechenkerne();
		const faelle = [
			{
				plan: [
					[2, 1],
					[3, 1],
				],
				anzahl: 7,
				vorne: [3, 1],
				rechts: [3, 2],
				links: [2, 3],
				oben: [
					[1, 1],
					[1, 1],
				],
			},
			{
				plan: [
					[3, 0, 1],
					[2, 1, 1],
				],
				anzahl: 8,
				vorne: [3, 1, 1],
				rechts: [2, 3],
				links: [3, 2],
				oben: [
					[1, 0, 1],
					[1, 1, 1],
				],
			},
			{
				plan: [[0], [4], [1]],
				anzahl: 5,
				vorne: [4],
				rechts: [1, 4, 0],
				links: [0, 4, 1],
				oben: [[0], [1], [1]],
			},
		];
		for (const { anzahl, links, oben, plan, rechts, vorne } of faelle) {
			assert.deepEqual(netto(ansichtenVon(plan)), { vorne, rechts, links, oben });
			assert.equal(wuerfelVon(plan).length, anzahl);
		}
	});

	it('findet verdeckte Würfel', () => {
		const { verdeckteWuerfel } = rechenkerne();
		const voll = [
			[2, 2],
			[2, 2],
		];
		assert.equal(verdeckteWuerfel(voll).length, 1);
		assert.equal(verdeckteWuerfel(voll, 'iso').length, 1);
		assert.equal(
			verdeckteWuerfel([
				[1, 2],
				[1, 3],
			]).length,
			0,
		);
	});

	it('Alle 11 Netze falten sich zum Würfel mit 7 Laschen, Nicht-Netze scheitern', () => {
		const { AUGEN_DER_SEITE, NICHT_NETZE, WUERFELNETZE, falteNetz, istWuerfelnetz, netzLaschen, netzZellen } =
			rechenkerne();
		assert.equal(Object.keys(WUERFELNETZE).length, 11);
		for (const code of Object.keys(WUERFELNETZE)) {
			const zellen = netzZellen(code);
			assert.equal(zellen.length, 6, code);
			assert.ok(istWuerfelnetz(zellen), code);
			assert.equal(netzLaschen(zellen).length, 7, code);
			const augen = Object.fromEntries(
				falteNetz(zellen).map((z) => [z.rahmen.n.join(), AUGEN_DER_SEITE[z.rahmen.n.join()]]),
			);
			for (const [seite, zahl] of Object.entries(augen)) {
				const gegen = seite
					.split(',')
					.map((a) => -Number(a) || 0)
					.join();
				assert.equal((zahl ?? 0) + (augen[gegen] ?? 0), 7, code);
			}
		}
		assert.equal(Object.keys(NICHT_NETZE).length, 8);
		for (const code of Object.keys(NICHT_NETZE)) {
			const zellen = netzZellen(code);
			assert.equal(zellen.length, 6, code);
			assert.ok(!istWuerfelnetz(zellen), code);
		}
	});

	it('Körper haben die richtigen Zahlen', () => {
		const { KOERPER_ZAHLEN, vielflach } = rechenkerne();
		for (const form of ['wuerfel', 'quader', 'pyramide', 'prisma']) {
			const { flaechen, kanten, punkte } = vielflach(form, [3, 2, 2]);
			assert.deepEqual(
				{ ecken: punkte.length, kanten: kanten.length, flaechen: flaechen.length },
				netto(KOERPER_ZAHLEN[form]),
				form,
			);
		}
	});
});

describe('Zahldarstellungen (027)', () => {
	it('Hundertertafel: Ausschnitte stehen an der richtigen Stelle', () => {
		const { ausschnittZahlen, tafelOrt } = rechenkerne();
		assert.deepEqual([...ausschnittZahlen(1, 100, 'kreuz', 45)], [35, 44, 45, 46, 55]);
		assert.deepEqual([...tafelOrt(1, 45)], [4, 4]);
		assert.deepEqual([...tafelOrt(1, 35)], [4, 3]);
		assert.deepEqual([...tafelOrt(301, 345)], [4, 4]);
		assert.deepEqual([...ausschnittZahlen(301, 400, 'kreuz', 345)], [335, 344, 345, 346, 355]);
		assert.deepEqual([...ausschnittZahlen(1, 100, 'zeile', 45)], [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
		assert.equal(ausschnittZahlen(1, 100, 'spalte', 45).length, 10);
		assert.deepEqual([...ausschnittZahlen(1, 100, 'treppe', 23)], [23, 24, 34, 35, 45, 46]);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', 41), /am Rand/);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', 5), /steht nicht auf dieser Tafel/);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', null), /fehlt die Mittelzahl/);
	});

	it('Rechenstrich rechnet und liest Sprünge', () => {
		const { leseSprung, rechenstrichWerte } = rechenkerne();
		assert.deepEqual([...rechenstrichWerte(47, [30, 4])], [47, 77, 81]);
		assert.equal(leseSprung('+30'), 30);
		assert.equal(leseSprung('−4'), -4);
		assert.equal(leseSprung('-4'), -4);
		assert.throws(() => leseSprung('30'), /kein Sprung/);
	});
});

describe('Rechenformate (028)', () => {
	it('Zahlenmauer rechnet und prüft die Eindeutigkeit', () => {
		const { mauerEindeutig, mauerWerte } = rechenkerne();
		const reihen = Array.from(mauerWerte([3, 5, 2]), (r) => [...r]);
		assert.deepEqual(reihen, [[3, 5, 2], [8, 7], [15]]);
		assert.ok(mauerEindeutig(3, ['1-0', '1-1', '2-0']));
		assert.ok(!mauerEindeutig(3, ['0-0', '0-1', '0-2', '1-0', '1-1']));
		assert.ok(mauerEindeutig(3, ['0-1', '1-0', '2-0']));
		assert.deepEqual([...(mauerWerte([20, 7, 3], 'minus').at(-1) ?? [])], [9]);
	});

	it('Rechendreieck: Außenzahlen allein reichen, Mischungen nicht immer', () => {
		const { RECHENDREIECK_GLEICHUNGEN, istEindeutig } = rechenkerne();
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'i2']));
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['a0', 'a1', 'a2']));
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'a0']));
		assert.ok(!istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'i2', 'a0']));
	});

	it('Zauberdreieck und magisches Quadrat', () => {
		const { zauberLoesungen } = rechenkerne();
		assert.equal(zauberLoesungen('quadrat', [1, 2, 3, 4, 5, 6, 7, 8, 9], 15).length, 8);
		for (const summe of [9, 10, 11, 12]) {
			const alle = zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], summe);
			assert.equal(alle.length, 6, String(summe));
			for (const l of alle) {
				const s = (a: string, b: string, c: string) => (l[a] ?? 0) + (l[b] ?? 0) + (l[c] ?? 0);
				assert.equal(s('e0', 's0', 'e1'), summe);
				assert.equal(s('e1', 's1', 'e2'), summe);
				assert.equal(s('e2', 's2', 'e0'), summe);
			}
		}
		assert.equal(zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], null).length, 24);
		assert.equal(zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], 13).length, 0);
	});

	it('Rechenschritte', () => {
		const { ketteWerte, leseOperator } = rechenkerne();
		assert.deepEqual([...ketteWerte(8, ['+5', '−3', '·2'].map(leseOperator))], [8, 13, 10, 20]);
		assert.throws(() => ketteWerte(9, [leseOperator(':4')]), /ohne Rest/);
		assert.throws(() => leseOperator('5'), /kein Rechenschritt/);
	});
});

describe('Einmaleins und schriftliches Rechnen (029)', () => {
	const stellen = (n: number) => [...String(n)].reverse().map(Number);
	const liste = <T>(x: readonly T[] | undefined) => Array.from(x ?? []);
	const zufaellig = (seed: number) => {
		const zz = rechenkerne().zufall(seed);
		return (bis: number) => Math.floor(zz() * bis);
	};

	it('Malkreuz zerlegt nach Stellenwerten', () => {
		const { malkreuzRechnung } = rechenkerne();
		const r = malkreuzRechnung(23, 45);
		assert.deepEqual(
			Array.from(r.produkte, (z) => [...z]),
			[
				[800, 120],
				[100, 15],
			],
		);
		assert.deepEqual([...r.summen], [920, 115]);
		assert.equal(r.ergebnis, 1035);
		assert.equal(malkreuzRechnung(30, 6).produkte.length, 1);
	});

	it('903 − 478 wie im Schulbuch: Entbündeln oben, Erweitern unter dem Subtrahenden', () => {
		const { subtrahiereEntbuendeln, subtrahiereErweitern } = rechenkerne();
		const bund = subtrahiereEntbuendeln(903, 478, 'abziehen');
		assert.deepEqual(liste(bund.neu), [13, 9, 8]);
		assert.deepEqual(liste(bund.ziffern), [5, 2, 4]);
		assert.deepEqual(liste(bund.sprechweise), ['13 − 8 = 5', '9 − 7 = 2', '8 − 4 = 4']);
		const ergaenzen = subtrahiereErweitern(903, 478, 'ergaenzen');
		assert.deepEqual(liste(ergaenzen.uebertraege), [0, 1, 1]);
		assert.deepEqual(liste(ergaenzen.ziffern), [5, 2, 4]);
		assert.deepEqual(liste(ergaenzen.sprechweise), ['8 + 5 = 13, 1 gemerkt', '8 + 2 = 10, 1 gemerkt', '5 + 4 = 9']);
		assert.equal(subtrahiereErweitern(903, 478, 'abziehen').sprechweise?.[0], '13 − 8 = 5, 1 gemerkt');
	});

	it('Hand-Beispiele für Plus, Mal und Geteilt', () => {
		const { addiere, dividiere, multipliziere } = rechenkerne();
		assert.deepEqual(liste(addiere([345, 278, 96]).uebertraege), [0, 1, 2]);
		const mal = multipliziere(345, 23);
		assert.deepEqual(
			Array.from(mal.teile, (t) => t.wert),
			[6900, 1035],
		);
		assert.deepEqual(liste(mal.teile[1]?.uebertraege), [0, 1, 1, 1]);
		const geteilt = dividiere(957, 4);
		assert.deepEqual(
			Array.from(geteilt.schritte, (x) => [x.teil, x.q, x.produkt, x.rest]),
			[
				[9, 2, 8, 1],
				[15, 3, 12, 3],
				[37, 9, 36, 1],
			],
		);
		assert.equal(dividiere(4081, 4).quotient, 1020);
		assert.equal(dividiere(3, 4).quotient, 0);
		assert.equal(dividiere(3, 4).rest, 3);
	});

	it('1000 zufällige Aufgaben je Verfahren stimmen mit der Rechnung überein', () => {
		const { addiere, dividiere, multipliziere, subtrahiereEntbuendeln, subtrahiereErweitern } = rechenkerne();
		const zz = zufaellig(29);
		for (let i = 0; i < 1000; i++) {
			const zahlen = Array.from({ length: 2 + zz(3) }, () => zz(300_000));
			const summe = addiere(zahlen);
			assert.equal(
				summe.ergebnis,
				zahlen.reduce((x, y) => x + y, 0),
			);
			liste(summe.ziffern).forEach((z, stelle) => {
				const spalte = zahlen.reduce((t, n) => t + (stellen(n)[stelle] ?? 0), summe.uebertraege?.[stelle] ?? 0);
				assert.equal(spalte % 10, z);
				assert.equal(Math.floor(spalte / 10), summe.uebertraege?.[stelle + 1] ?? 0);
			});

			const [x, y] = [zz(1_000_000), zz(1_000_000)];
			const [a, b] = [Math.max(x, y), Math.min(x, y)];
			const erweitern = subtrahiereErweitern(a, b, 'ergaenzen');
			assert.equal(erweitern.ergebnis, a - b);
			const entbuendeln = subtrahiereEntbuendeln(a, b, 'abziehen');
			assert.equal(entbuendeln.ergebnis, a - b);
			stellen(a).forEach((o, stelle) => {
				const unten = (stellen(b)[stelle] ?? 0) + (erweitern.uebertraege?.[stelle] ?? 0);
				const z = stellen(a - b)[stelle] ?? 0;
				assert.equal((unten + z) % 10, o);
				assert.equal(unten + z >= 10 ? 1 : 0, erweitern.uebertraege?.[stelle + 1] ?? 0);
				assert.equal((entbuendeln.neu?.[stelle] ?? o) - (stellen(b)[stelle] ?? 0), z);
			});

			const [m, n] = [zz(10_000), zz(1000)];
			const mal = multipliziere(m, n);
			assert.equal(mal.ergebnis, m * n);
			mal.teile.forEach((t) => {
				assert.equal(t.wert, m * t.faktor * 10 ** t.verschoben);
			});

			const [p, q] = [zz(1_000_000), 2 + zz(8)];
			const geteilt = dividiere(p, q);
			assert.equal(geteilt.quotient, Math.floor(p / q));
			assert.equal(geteilt.rest, p % q);
			geteilt.schritte.forEach((schritt) => {
				assert.equal(schritt.produkt, schritt.q * q);
				assert.equal(schritt.rest, schritt.teil - schritt.produkt);
				assert.ok(schritt.q < 10 && schritt.rest < q);
			});
		}
	});

	it('Jeder eingebaute Fehler verfälscht das Ergebnis', () => {
		const { moeglicheFehler, rechnungsplan } = rechenkerne();
		const zz = zufaellig(7);
		const verfahren = ['abziehen-entbuendeln', 'ergaenzen-erweitern'];
		for (let i = 0; i < 300; i++) {
			const [x, y] = [zz(100_000), zz(100_000)];
			const aufgaben: [string, number[]][] = [
				['plus', [x, y]],
				['minus', [Math.max(x, y), Math.min(x, y)]],
				['mal', [zz(1000), zz(100)]],
				['geteilt', [x, 2 + zz(8)]],
			];
			for (const [art, zahlen] of aufgaben) {
				const v = verfahren[i % 2] ?? null;
				const richtig = rechnungsplan(art, zahlen, v, null, true).text;
				for (const fehler of moeglicheFehler(art, zahlen, v)) {
					const falsch = rechnungsplan(art, zahlen, v, fehler, true).text;
					assert.notEqual(
						String(falsch),
						String(richtig),
						`${art} ${zahlen.join(' ')} ${JSON.stringify(fehler)}`,
					);
				}
			}
		}
	});

	it('Das Raster hat eine Ziffer je Kästchen, Stellen stehen untereinander', () => {
		const { rechnungsplan } = rechenkerne();
		const plan = rechnungsplan('minus', [903, 478], 'ergaenzen-erweitern', null, true);
		const zeile = (nr: number) => Array.from(plan.zeilen[nr]?.zellen ?? [], (z) => `${z.c}:${z.t}`);
		assert.deepEqual(zeile(0), ['3:3', '2:0', '1:9']);
		assert.deepEqual(zeile(1), ['3:8', '2:7', '1:4', '0:−']);
		assert.deepEqual(zeile(2), ['2:1', '1:1']);
		assert.deepEqual(zeile(3), ['3:5', '2:2', '1:4']);
		const karte = rechnungsplan('mal', [345, 23], null, null, false);
		for (const z of karte.zeilen) {
			assert.ok(z.zellen.every((c) => c.t.length === 1));
		}
	});
});
