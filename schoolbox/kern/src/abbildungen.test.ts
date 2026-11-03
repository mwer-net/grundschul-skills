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
	markeSetzen,
	markeTrennen,
	markeVerbinden,
	markierungKlartext,
	markierungLesen,
	markierungNeuerText,
	markierungText,
	NUR_ZUR_LAUFZEIT,
	planLage,
	planObjekteText,
	planObjekteVon,
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

	it('nimmt bei einem Schritt unter 1 auch Kommazahlen an, sonst nur ganze', () => {
		const plan = schemaVon('x-plan');
		assert.ok(plan);
		const fehler = (wert: string) => pruefeWerte(plan, { kaestchen: wert }).kaestchen;
		assert.equal(fehler('0.9'), undefined);
		assert.equal(fehler('1,2'), undefined);
		assert.match(fehler('0.95') ?? '', /Schritten von 0,1/);
		assert.match(fehler('0.5') ?? '', /von 0,8 bis 3/);
		assert.match(pruefeWerte(plan, { spalten: '2.5' }).spalten ?? '', /ganze Zahl/);
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
		ANDIKA_X_HOEHE: number;
		lineaturMass: (
			art: string,
			band: number | null,
		) => { band: number; oben: number; unten: number; abstand: number; hoehe: number; schrift: number };
		silbenTeile: (text: string) => { silben?: string[]; text?: string }[];
		pruefeSilben: (text: string) => void;
		WORTARTEN: Record<string, { name: string; symbol: string; voll: boolean; linie: string }>;
		ROLLEN: Record<string, { name: string; frage: string }>;
		wortartenTeile: (text: string) => { wort?: string; marke?: string | null; text?: string }[];
		satzLesen: (text: string) => { glieder: { text: string; rolle: string | null }[]; zeichen: string };
		satzUmstellen: (
			text: string,
			vorn?: string | null,
		) => { glieder: { text: string; rolle: string | null }[]; zeichen: string };
		pruefeBausteine: (wort: string, stamm: string | null) => string[];
		zeitPos: (jahr: number) => number;
		jahrText: (jahr: number) => string;
		MUENZEN: Record<string, { mm: number; wert: number }>;
		SCHEINE: Record<string, { b: number; h: number; wert: number }>;
		betragText: (cent: number, klasse: number) => string;
		mindestStueckelung: (cent: number, vorrat?: string[]) => string[] | null;
		skalaStriche: (
			von: number,
			bis: number,
			haupt: number,
			klein: number,
		) => { wert: number; gross: boolean; anteil: number }[];
		kalenderMonat: (jahr: number, monat: number) => { tage: number; start: number };
		isoWoche: (jahr: number, monat: number, tag: number) => number;
		zeitStationen: (von: number, bis: number, spruenge: string | null) => number[];
		dauerText: (minuten: number) => string;
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

describe('Größen (030)', () => {
	it('Münzen haben die echten Verhältnisse', () => {
		const { MUENZEN } = rechenkerne();
		assert.ok((MUENZEN['10ct']?.mm ?? 0) < (MUENZEN['5ct']?.mm ?? 0));
		assert.equal(MUENZEN['2€']?.mm, 25.75);
		assert.equal(MUENZEN['1ct']?.mm, 16.25);
	});

	it('Beträge: bis Klasse 2 mit Einheiten, ab Klasse 3 mit Komma', () => {
		const { betragText } = rechenkerne();
		assert.equal(betragText(345, 2), '3 € 45 ct');
		assert.equal(betragText(345, 3), '3,45 €');
		assert.equal(betragText(45, 1), '45 ct');
		assert.equal(betragText(300, 2), '3 €');
		assert.equal(betragText(5, 4), '0,05 €');
	});

	it('Wenigste Stücke gegen Hand-Beispiele', () => {
		const { mindestStueckelung } = rechenkerne();
		assert.deepEqual([...(mindestStueckelung(345) ?? [])], ['2€', '1€', '20ct', '20ct', '5ct']);
		assert.deepEqual([...(mindestStueckelung(880) ?? [])], ['5€', '2€', '1€', '50ct', '20ct', '10ct']);
		assert.deepEqual([...(mindestStueckelung(40, ['20ct', '20ct', '10ct']) ?? [])], ['20ct', '20ct']);
		assert.deepEqual(
			[...(mindestStueckelung(60, ['50ct', '20ct', '20ct', '20ct']) ?? [])],
			['20ct', '20ct', '20ct'],
		);
		assert.equal(mindestStueckelung(30, ['20ct', '20ct']), null);
	});

	it('Skala: gleiche Abstände, auch bei Kommateilung', () => {
		const { skalaStriche } = rechenkerne();
		const striche = Array.from(skalaStriche(0, 2, 1, 0.1));
		assert.equal(striche.length, 21);
		assert.equal(striche[3]?.wert, 0.3);
		assert.deepEqual(
			striche.filter((s) => s.gross).map((s) => s.wert),
			[0, 1, 2],
		);
		striche.forEach((s, i) => {
			assert.ok(Math.abs(s.anteil - i / 20) < 1e-9);
		});
		const kalt = Array.from(skalaStriche(-20, 40, 10, 2));
		assert.deepEqual(
			kalt.filter((s) => s.gross).map((s) => s.wert),
			[-20, -10, 0, 10, 20, 30, 40],
		);
		assert.throws(() => skalaStriche(0, 10, 5, 3), /passen nicht/);
	});

	it('Kalender stimmt für viele Monate mit Date überein', () => {
		const { isoWoche, kalenderMonat } = rechenkerne();
		const februar = kalenderMonat(2028, 2);
		assert.equal(februar.tage, 29);
		assert.equal(februar.start, 1);
		for (let i = 0; i < 2400; i++) {
			const jahr = 1900 + Math.floor(i / 12);
			const monat = (i % 12) + 1;
			const { start, tage } = kalenderMonat(jahr, monat);
			assert.equal(tage, new Date(Date.UTC(jahr, monat, 0)).getUTCDate());
			assert.equal(start, (new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay() + 6) % 7);
		}
		assert.equal(isoWoche(2028, 1, 1), 52);
		assert.equal(isoWoche(2026, 1, 1), 1);
		assert.equal(isoWoche(2026, 12, 31), 53);
		assert.equal(isoWoche(2028, 2, 14), 7);
	});

	it('Zeitspanne: zur vollen Stunde, dann weiter', () => {
		const { dauerText, zeitStationen } = rechenkerne();
		assert.deepEqual([...zeitStationen(500, 585, null)], [500, 540, 585]);
		assert.deepEqual([...zeitStationen(500, 705, null)], [500, 540, 660, 705]);
		assert.deepEqual([...zeitStationen(540, 660, null)], [540, 660]);
		assert.deepEqual([...zeitStationen(500, 580, 'bis 9:00, +40 min')], [500, 540, 580]);
		assert.throws(() => zeitStationen(500, 590, 'bis 9:00, +40 min'), /enden bei/);
		assert.equal(dauerText(85), '1 h 25 min');
		assert.equal(dauerText(60), '1 h');
		assert.equal(dauerText(5), '5 min');
	});
});

describe('Lineatur und Silben (031)', () => {
	it('Lineatur: Maße je Art, Schrift aus dem Mittelband', () => {
		const { ANDIKA_X_HOEHE, lineaturMass } = rechenkerne();
		const zwei = lineaturMass('2', null);
		assert.deepEqual([zwei.oben, zwei.band, zwei.unten], [4, 4, 4]);
		assert.equal(zwei.schrift * ANDIKA_X_HOEHE, 4);
		assert.equal(lineaturMass('1', null).band, 5);
		assert.equal(lineaturMass('3', null).band, 3.5);
		assert.equal(lineaturMass('3', null).oben, 0);
		assert.equal(lineaturMass('4', null).band, 0);
		const eigen = lineaturMass('1', 6);
		assert.deepEqual([eigen.oben, eigen.band, eigen.unten], [6, 6, 6]);
	});

	it('Silben: Wörter, Satzzeichen und Grenzen', () => {
		const { pruefeSilben, silbenTeile } = rechenkerne();
		const teile = Array.from(silbenTeile('Die Ro|si|ne, süß.'), (t) => (t.silben ? [...t.silben] : t.text));
		assert.deepEqual(teile, [['Die'], ' ', ['Ro', 'si', 'ne'], ', ', ['süß'], '.']);
		pruefeSilben('A|bend „Was|ser“, Zu|cker!');
		assert.throws(() => pruefeSilben('Ro||si'), /direkt nebeneinander/);
		assert.throws(() => pruefeSilben('|Rosine'), /Anfang oder Ende/);
		assert.throws(() => pruefeSilben('Ro|si| ne'), /Anfang oder Ende/);
		assert.throws(() => pruefeSilben('Rosine|.'), /Anfang oder Ende/);
		assert.throws(() => pruefeSilben('Ro5si'), /Erlaubt sind/);
	});

	it('Schema sperrt dieselben Silbenfehler', () => {
		const regeln = ABBILDUNG_SCHEMA['x-silben'].regeln;
		const fuer = (wort: string) =>
			regeln?.({
				liste: () => [],
				raster: () => [],
				text: (a) => (a === 'inhalt' ? wort : null),
				zahl: () => 0,
				zahlen: () => [],
				zeilen: () => [],
			}) ?? {};
		assert.deepEqual(fuer('Ro|si|ne.'), {});
		assert.ok(fuer('Ro||si').inhalt);
		assert.ok(fuer('|Ro').inhalt);
		assert.ok(fuer('Ro5').inhalt);
	});
});

describe('Sprache untersuchen (032)', () => {
	it('stellt Sätze richtig um: Verbzweit, Partikel, Großschreibung', () => {
		const { satzUmstellen } = rechenkerne();
		const faelle: [string, string, string?][] = [
			['[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.', 'Den Briefträger bellt der Hund an.'],
			['[Anna]S [liest]P [ein Buch]AkO.', 'Ein Buch liest Anna.'],
			['[Der Lehrer]S [gibt]P [dem Kind]DaO [das Heft]AkO.', 'Dem Kind gibt der Lehrer das Heft.'],
			['[Heute]Zeit [spielt]P [Ben]S [Fußball]AkO.', 'Ben spielt heute Fußball.'],
			['[Die Katze]S [schläft]P [auf dem Sofa]Ort.', 'Auf dem Sofa schläft die Katze.'],
			['[Wir]S [gehen]P [morgen]Zeit [ins Kino]Ort.', 'Morgen gehen wir ins Kino.'],
			['[Mein Bruder]S [räumt]P [sein Zimmer]AkO [auf]P.', 'Sein Zimmer räumt mein Bruder auf.'],
			['[Tante Anna]S [ruft]P [uns]AkO [an]P.', 'Uns ruft Tante Anna an.'],
			['[Kleine Kinder]S [malen]P [bunte Bilder]AkO.', 'Bunte Bilder malen kleine Kinder.'],
			['[Ben und Anna]S [bauen]P [ein Haus]AkO.', 'Ein Haus bauen Ben und Anna.'],
			['[Hunde]S [fressen]P [Knochen]AkO.', 'Knochen fressen Hunde.'],
			['[Im Garten]Ort [wächst]P [eine Blume]S.', 'Eine Blume wächst im Garten.'],
			['[Er]S [schenkt]P [ihr]DaO [eine Rose]AkO.', 'Ihr schenkt er eine Rose.'],
			['[Frau Meier]S [schreibt]P [einen Brief]AkO.', 'Einen Brief schreibt Frau Meier.'],
			['[Die Kinder]S [steigen]P [in den Bus]Ort [ein]P.', 'In den Bus steigen die Kinder ein.'],
			['[Am Montag]Zeit [fährt]P [die Klasse]S [nach Ulm]Ort.', 'Die Klasse fährt am Montag nach Ulm.'],
			['[Das Kind]S [hilft]P [der Oma]DaO!', 'Der Oma hilft das Kind!'],
			['[Oma]S [backt]P [einen Kuchen]AkO.', 'Einen Kuchen backt Oma.'],
			['[Der Hund]S [bellt]P [den Mann]AkO [heute]Zeit [an]P.', 'Heute bellt der Hund den Mann an.', 'Zeit'],
			['[Viele Vögel]S [fliegen]P [im Herbst]Zeit [nach Süden]Ort.', 'Im Herbst fliegen viele Vögel nach Süden.'],
		];
		for (const [satz, erwartet, vorn] of faelle) {
			const neu = satzUmstellen(satz, vorn ?? null);
			assert.equal(`${neu.glieder.map((g) => g.text).join(' ')}${neu.zeichen}`, erwartet, satz);
		}
	});

	it('lehnt ab, was sich nicht umstellen lässt', () => {
		const { satzLesen, satzUmstellen } = rechenkerne();
		assert.throws(() => satzLesen('[Der Hund]S schläft.'), /Prädikat/);
		assert.throws(() => satzLesen('[Der Hund]X [bellt]P.'), /gibt es nicht/);
		assert.throws(() => satzLesen('[Der Hund S [bellt]P.'), /Klammer/);
		assert.throws(() => satzUmstellen('[Bellt]P [der Hund]S?'), /Fragen/);
		assert.throws(() => satzUmstellen('[Bring]P [den Ball]AkO!'), /zweiter Stelle/);
		assert.throws(() => satzUmstellen('[Der Hund]S [bellt]P.'), /noch ein Satzglied/);
		assert.throws(() => satzUmstellen('Der Hund [bellt]P [laut]Ort.'), /zweiter Stelle|jedes Wort/);
	});

	it('Wortarten: Kürzel je Wort, jedes Symbol und jede Linie einzeln', () => {
		const { WORTARTEN, wortartenTeile } = rechenkerne();
		const teile = Array.from(wortartenTeile('Der/Art Hund/N bellt, laut/A.'), (t) => ({ ...t }));
		assert.deepEqual(teile, [
			{ wort: 'Der', marke: 'Art' },
			{ text: ' ' },
			{ wort: 'Hund', marke: 'N' },
			{ text: ' ' },
			{ wort: 'bellt', marke: null },
			{ text: ', ' },
			{ wort: 'laut', marke: 'A' },
			{ text: '.' },
		]);
		const alle = Object.values(WORTARTEN);
		assert.equal(new Set(alle.map((w) => w.symbol)).size, alle.length);
		assert.equal(new Set(alle.map((w) => w.linie)).size, alle.length);
	});

	it('Wortbausteine: Stamm muss ein Baustein sein', () => {
		const { pruefeBausteine } = rechenkerne();
		assert.deepEqual(Array.from(pruefeBausteine('ver|fahr|en', 'fahr')), ['ver', 'fahr', 'en']);
		assert.deepEqual(Array.from(pruefeBausteine('Fahr|er', 'fahr')), ['Fahr', 'er']);
		assert.throws(() => pruefeBausteine('ver|fahr|en', 'lauf'), /keiner der Bausteine/);
		assert.throws(() => pruefeBausteine('ver||en', null), /fehlt ein Baustein/);
		assert.deepEqual(pruefe('x-wortbausteine', { inhalt: 'ver|fahr|en', stamm: 'fahr' }), {});
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr|en', stamm: 'lauf' }).stamm);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr', art: 'familie', woerter: 'a; b' }).inhalt);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'fahr', art: 'familie' }).woerter);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr', aufgabe: 'familie' }).aufgabe);
	});

	it('Schema: Kürzel, Rollen und Prädikat', () => {
		assert.deepEqual(pruefe('x-wortarten', { inhalt: 'Der/Art Hund/N bellt/V.' }), {});
		assert.ok(pruefe('x-wortarten', { inhalt: 'Der/X Hund.' }).inhalt);
		assert.deepEqual(pruefe('x-satzglieder', { inhalt: '[Der Hund]S [bellt]P.' }), {});
		assert.match(pruefe('x-satzglieder', { inhalt: '[Der Hund]S schläft.' }).inhalt ?? '', /Prädikat/);
		assert.ok(pruefe('x-satzglieder', { inhalt: '[Der Hund]X [bellt]P.' }).inhalt);
		assert.ok(pruefe('x-satzglieder', { inhalt: '[Der Hund S [bellt]P.' }).inhalt);
	});

	it('Markierung: lesen, schreiben, Gruppen', () => {
		const einzeln = 'Der/Art Hund/N bellt laut/A.';
		const satz = markierungLesen(einzeln);
		assert.equal(markierungKlartext(satz), 'Der Hund bellt laut.');
		assert.equal(markierungText(satz), einzeln);
		const glieder = '[Der Hund]S [bellt]P den Mann [an]P.';
		const g = markierungLesen(glieder, true);
		assert.equal(markierungKlartext(g), 'Der Hund bellt den Mann an.');
		assert.equal(markierungText(g, true), glieder);

		const verbunden = markeVerbinden(g, 3);
		assert.equal(markierungText(verbunden, true), '[Der Hund]S [bellt]P [den Mann] [an]P.');
		const gesetzt = markeSetzen(verbunden, 4, 'AkO');
		assert.equal(markierungText(gesetzt, true), '[Der Hund]S [bellt]P [den Mann]AkO [an]P.');
		assert.equal(markierungText(markeTrennen(gesetzt, 0), true), '[Der]S [Hund]S [bellt]P [den Mann]AkO [an]P.');
		assert.equal(markierungText(markeVerbinden(g, 1), true), '[Der Hund bellt]S den Mann [an]P.');
	});

	it('Markierung: ändert sich ein Wort, bleiben die übrigen markiert', () => {
		const alt = markierungLesen('Der/Art Hund/N bellt/V laut/A.');
		assert.equal(
			markierungText(markierungNeuerText(alt, 'Der Dackel bellt laut.')),
			'Der/Art Dackel bellt/V laut/A.',
		);
		assert.equal(markierungText(markierungNeuerText(alt, 'Der Hund bellt.')), 'Der/Art Hund/N bellt/V.');
		assert.equal(markierungText(markierungNeuerText(alt, 'Heute bellt der Hund.')), 'Heute bellt/V der Hund.');
		const g = markierungLesen('[Der Hund]S [bellt]P.', true);
		assert.equal(
			markierungText(markierungNeuerText(g, 'Der große Hund bellt.'), true),
			'[Der große Hund]S [bellt]P.',
		);
		assert.equal(
			markierungText(markierungNeuerText(g, 'Der Hund bellt laut.'), true),
			'[Der Hund]S [bellt]P laut.',
		);
	});
});

describe('Sachunterricht: Zeit und Raum (033)', () => {
	it('Zeitleiste: kein Jahr 0, v. Chr. ausgeschrieben', () => {
		const { jahrText, zeitPos } = rechenkerne();
		assert.equal(zeitPos(1) - zeitPos(-1), 1);
		assert.equal(zeitPos(2000) - zeitPos(1900), 100);
		assert.equal(jahrText(-500), '500 v. Chr.');
		assert.equal(jahrText(1969), '1969');
	});

	it('Zeitleiste: Regeln', () => {
		assert.deepEqual(
			pruefe('x-zeitleiste', { von: '1900', bis: '2020', ereignisse: '1914: Krieg; 1900-1914: Zeit' }),
			{},
		);
		assert.ok(pruefe('x-zeitleiste', { von: '2000', bis: '1900' }).bis);
		assert.match(pruefe('x-zeitleiste', { ereignisse: '1800: Alt' }).ereignisse ?? '', /außerhalb/);
		assert.match(pruefe('x-zeitleiste', { ereignisse: 'um 1900: Alt' }).ereignisse ?? '', /kein Jahr/);
		assert.match(pruefe('x-zeitleiste', { von: '-100', ereignisse: '0: Null' }).ereignisse ?? '', /Jahr 0/);
		assert.deepEqual(pruefe('x-zeitleiste', { art: 'leben', von: '0', bis: '10', ereignisse: '0: Geburt' }), {});
	});

	it('Jahreskreis: Jahreszeiten und Markierung passen zur Art', () => {
		assert.deepEqual(pruefe('x-jahreskreis', { markiert: 'Juli', jahreszeiten: 'ja' }), {});
		assert.ok(pruefe('x-jahreskreis', { art: 'tag', jahreszeiten: 'ja' }).jahreszeiten);
		assert.ok(pruefe('x-jahreskreis', { art: 'tag', markiert: 'Juli' }).markiert);
	});

	it('Plan: Planquadrate und Objekte', () => {
		assert.deepEqual(planLage('B3', 6, 5), { x: 1, y: 2 });
		assert.equal(planLage('G1', 6, 5), null);
		assert.equal(planLage('A6', 6, 5), null);
		const orte = planObjekteVon('schule: B3; baum: A2 A3');
		assert.equal(orte.get('A3'), 'baum');
		assert.equal(planObjekteText(orte), 'schule: B3; baum: A2 A3');
		assert.equal(planObjekteText(new Map()), null);
		assert.ok(pruefe('x-plan', { objekte: 'tisch: A1' }).boden);
		assert.ok(pruefe('x-plan', { objekte: 'schule: Z9' }).boden);
		assert.ok(pruefe('x-plan', { spalten: '26' }).spalten);
		assert.deepEqual(pruefe('x-plan', { aufgabe: 'weg', weg: 'A1 A2 B2' }), {});
		assert.ok(pruefe('x-plan', { aufgabe: 'weg', weg: 'A1 C3' }).weg);
	});
});
