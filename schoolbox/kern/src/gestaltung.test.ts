import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit, FORM_VERLAUF } from '../../web/e2e/gestaltung-daten';
import { fuegeBausteinEin } from './einfuegen';
import {
	dupliziereGestaltung,
	fuerAlle,
	legeGestaltungAb,
	leseLage,
	loescheGestaltung,
	neueSvgIds,
	ordneAlle,
	ordneInEbene,
	raeumeEbenenAuf,
	setzeAus,
	setzeGesperrt,
	setzeLage,
	setzeName,
	setzeSw,
	stilMitLage,
	verschiebeAufSeite,
	wechsleEbene,
} from './gestaltung';
import { ASSETS } from './konfig';
import { dupliziere, klassenVon, wendeAn, zerlege } from './quelltext';
import { dupliziereBaustein, loescheBaustein, nummeriere, verschiebeBaustein } from './struktur';

const N = { jeSeite: false };

/** Ein kleines Blatt: eine Aufgabe, danach was gegeben ist, jede Zeile für sich. */
const blatt = (...zeilen: string[]) =>
	['<body>', '<section class="seite">', '  <div class="aufgabe"><span class="nr">1</span></div>', ...zeilen]
		.concat(['</section>', '</body>', ''])
		.join('\n');

const ebene = (name: 'hinten' | 'vorne', ...elemente: string[]) => [
	`  <div class="ebene ${name}">`,
	...elemente.map((e) => `    ${e}`),
	'  </div>',
];

const nrMit = (quelle: string, klasse: string, i = 0) => {
	const k = zerlege(quelle).knoten.filter((n) => klassenVon(n).includes(klasse))[i];
	assert.ok(k, `.${klasse} fehlt`);
	return k.nr;
};

/** Die Klasse des Elements `nr` in `quelle`: So prüft ein Test, dass die gemeldete Nummer stimmt. */
const klasseAn = (quelle: string, nr: number | null) =>
	nr === null ? null : (zerlege(quelle).knoten[nr]?.attribute.find((a) => a.name === 'class')?.wert ?? null);

const A = '<img class="a" data-lage="frei">';
const B = '<img class="b" data-lage="frei">';
const C = '<img class="c" data-lage="frei">';
const FLAECHE = '<div class="seitenflaeche"></div>';

describe('Lage im style', () => {
	it('rundet px ganzzahlig, die Drehung auf eine Nachkommastelle, und schreibt fehlende Werte nicht', () => {
		assert.equal(stilMitLage(null, { x: 10.4, y: 20.6, drehen: -3.14 }), '--x:10px;--y:21px;--drehen:-3.1deg');
		assert.equal(stilMitLage('color:red', { b: 100.2 }), '--b:100px;color:red');
	});

	it('hält die Reihenfolge --x --y --b --h --drehen --spiegeln und lässt Fremdes stehen', () => {
		assert.equal(
			stilMitLage('--y:5px;color:red', { x: 3.6, b: 100.2, drehen: 12.345 }),
			'--x:4px;--y:5px;--b:100px;--drehen:12.3deg;color:red',
		);
		assert.equal(stilMitLage('--x:1px;--h:9px', { b: 4, spiegeln: -1 }), '--x:1px;--b:4px;--h:9px;--spiegeln:-1');
	});

	it('null entfernt, nichts übrig heißt kein style', () => {
		assert.equal(stilMitLage('--x:1px;color:red', { x: null }), 'color:red');
		assert.equal(stilMitLage('--x:1px', { x: null }), null);
	});

	it('setzeLage und leseLage', () => {
		const vorher = blatt(...ebene('vorne', '<img class="a" data-lage="frei" style="--y:5px;color:red">'));
		const nr = nrMit(vorher, 'a');
		const nachher = setzeLage(vorher, nr, { x: 3.6, b: 100.2, drehen: 12.345, y: null });
		assert.equal(
			nachher,
			blatt(
				...ebene(
					'vorne',
					'<img class="a" data-lage="frei" style="--x:4px;--b:100px;--drehen:12.3deg;color:red">',
				),
			),
		);
		assert.deepEqual(leseLage(nachher, nr), { x: 4, b: 100, drehen: 12.3 });
		assert.equal(setzeLage(vorher, nr, {}), vorher);
	});
});

describe('legeGestaltungAb', () => {
	it('legt die Ebene beim ersten Element am Ende der Seite an, mit data-lage und Lage', () => {
		const vorher = blatt();
		const { nr, quelle } = legeGestaltungAb(vorher, {
			seite: nrMit(vorher, 'seite'),
			html: '<img class="figur-frei" src="w.png" alt="W">',
			lage: { x: 10.4, y: 20.6, drehen: -3.14 },
		});
		assert.equal(
			quelle,
			blatt(
				...ebene(
					'vorne',
					'<img class="figur-frei" src="w.png" alt="W" data-lage="frei" style="--x:10px;--y:21px;--drehen:-3.1deg">',
				),
			),
		);
		assert.equal(klasseAn(quelle, nr), 'figur-frei');
	});

	it('hinten kommt vor vorne; die Streuung liegt von sich aus hinten', () => {
		const vorher = blatt(...ebene('vorne', A));
		const { nr, quelle } = legeGestaltungAb(vorher, {
			seite: nrMit(vorher, 'seite'),
			html: '<svg class="streuung"></svg>',
		});
		assert.equal(
			quelle,
			blatt(...ebene('hinten', '<svg class="streuung" data-lage="frei"></svg>'), ...ebene('vorne', A)),
		);
		assert.equal(klasseAn(quelle, nr), 'streuung');
	});

	it('kommt in eine vorhandene Ebene ganz nach vorne', () => {
		const vorher = blatt(...ebene('vorne', A));
		const { nr, quelle } = legeGestaltungAb(vorher, { seite: nrMit(vorher, 'seite'), ebene: 'vorne', html: B });
		assert.equal(quelle, blatt(...ebene('vorne', A, B)));
		assert.equal(klasseAn(quelle, nr), 'b');
	});
});

describe('loescheGestaltung und raeumeEbenenAuf', () => {
	it('die Ebene verschwindet mit dem letzten Element, gewählt ist dann die Seite', () => {
		const vorher = blatt(...ebene('vorne', A));
		const { nr, quelle } = loescheGestaltung(vorher, nrMit(vorher, 'a'));
		assert.equal(quelle, blatt());
		assert.equal(klasseAn(quelle, nr), 'seite');
	});

	it('mit Nachbarn bleibt die Ebene, gewählt ist der Nachbar', () => {
		const vorher = blatt(...ebene('vorne', A, B));
		const { nr, quelle } = loescheGestaltung(vorher, nrMit(vorher, 'a'));
		assert.equal(quelle, blatt(...ebene('vorne', B)));
		assert.equal(klasseAn(quelle, nr), 'b');
	});

	it('neben der Seitenfläche bleibt die Ebene hinten', () => {
		const vorher = blatt(...ebene('hinten', FLAECHE, A));
		assert.equal(loescheGestaltung(vorher, nrMit(vorher, 'a')).quelle, blatt(...ebene('hinten', FLAECHE)));
	});

	it('raeumeEbenenAuf entfernt leere Ebenen, auch mit Kommentar', () => {
		const vorher = blatt('  <div class="ebene hinten">', '  </div>', '  <div class="ebene vorne"><!-- x --></div>');
		assert.equal(raeumeEbenenAuf(vorher), blatt());
		const voll = blatt(...ebene('vorne', A));
		assert.equal(raeumeEbenenAuf(voll), voll);
	});
});

describe('ordneInEbene (5.6)', () => {
	const ZWEI = blatt(...ebene('hinten', FLAECHE, A, B), ...ebene('vorne', C));

	const pruefe = (klasse: string, richtung: Parameters<typeof ordneInEbene>[2], erwartet: string) => {
		const { nr, quelle } = ordneInEbene(ZWEI, nrMit(ZWEI, klasse), richtung);
		assert.equal(quelle, erwartet);
		assert.equal(klasseAn(quelle, nr), klasse);
	};

	it('einen Platz und ganz innerhalb der Ebene; die Seitenfläche bleibt zuunterst', () => {
		pruefe('a', 'vor', blatt(...ebene('hinten', FLAECHE, B, A), ...ebene('vorne', C)));
		pruefe('b', 'ganz-zurueck', blatt(...ebene('hinten', FLAECHE, B, A), ...ebene('vorne', C)));
		pruefe('a', 'ganz-zurueck', ZWEI);
	});

	it('an der Grenze wechselt die Ebene: vorne in hinten geht nach vorne', () => {
		pruefe('b', 'vor', blatt(...ebene('hinten', FLAECHE, A), ...ebene('vorne', B, C)));
		pruefe('b', 'ganz-vor', blatt(...ebene('hinten', FLAECHE, A), ...ebene('vorne', C, B)));
	});

	it('an der Grenze wechselt die Ebene: hinten in vorne geht nach hinten, die leere Ebene verschwindet', () => {
		pruefe('c', 'zurueck', blatt(...ebene('hinten', FLAECHE, A, B, C)));
		pruefe('c', 'ganz-zurueck', blatt(...ebene('hinten', FLAECHE, C, A, B)));
	});

	it('ganz vorne in vorne bleibt es, wie es ist', () => {
		pruefe('c', 'vor', ZWEI);
		pruefe('c', 'ganz-vor', ZWEI);
	});

	it('am Anker gibt es keine zweite Ebene', () => {
		const vorher = [
			'<body>',
			'<section class="seite">',
			`  <div class="aufgabe"><span class="nr">1</span>${A}${B}</div>`,
			'</section>',
			'</body>',
			'',
		].join('\n');
		assert.equal(ordneInEbene(vorher, nrMit(vorher, 'b'), 'vor').quelle, vorher);
		const { quelle } = ordneInEbene(vorher, nrMit(vorher, 'b'), 'zurueck');
		assert.equal(quelle, vorher.replace(`${A}${B}`, `${B}${A}`));
	});
});

describe('wechsleEbene und verschiebeAufSeite', () => {
	it('in die andere Ebene, dort ganz nach vorne', () => {
		const vorher = blatt(...ebene('hinten', FLAECHE, A, B), ...ebene('vorne', C));
		const { nr, quelle } = wechsleEbene(vorher, nrMit(vorher, 'a'), 'vorne');
		assert.equal(quelle, blatt(...ebene('hinten', FLAECHE, B), ...ebene('vorne', C, A)));
		assert.equal(klasseAn(quelle, nr), 'a');
		assert.equal(wechsleEbene(vorher, nrMit(vorher, 'c'), 'vorne').quelle, vorher);
	});

	it('auf eine andere Seite, in dieselbe Ebene, mit neuer Lage', () => {
		const zwei = (eins: string[], andere: string[]) =>
			[
				'<body>',
				'<section class="seite">',
				'  <div class="aufgabe"><span class="nr">1</span></div>',
				...eins,
				'</section>',
				'<section class="seite">',
				'  <div class="aufgabe"><span class="nr">2</span></div>',
				...andere,
				'</section>',
				'</body>',
				'',
			].join('\n');
		const vorher = zwei(ebene('vorne', A), []);
		const { nr, quelle } = verschiebeAufSeite(vorher, nrMit(vorher, 'a'), nrMit(vorher, 'seite', 1), {
			x: 50,
			y: 60,
		});
		assert.equal(quelle, zwei([], ebene('vorne', '<img class="a" data-lage="frei" style="--x:50px;--y:60px">')));
		assert.equal(klasseAn(quelle, nr), 'a');
	});
});

describe('Schalter und Name', () => {
	const vorher = blatt(...ebene('vorne', '<img class="a" data-lage="frei" style="--y:5px">'));
	const nr = nrMit(vorher, 'a');
	const mit = (attribute: string) =>
		blatt(...ebene('vorne', `<img class="a" data-lage="frei" style="--y:5px"${attribute}>`));

	it('setzeAus und setzeGesperrt schreiben Attribute ohne Wert und nehmen sie wieder weg', () => {
		const aus = setzeAus(vorher, nr, true);
		assert.equal(aus, mit(' data-aus'));
		assert.equal(setzeGesperrt(aus, nr, true), mit(' data-aus data-gesperrt'));
		assert.equal(setzeAus(aus, nr, false), vorher);
		assert.equal(setzeAus(vorher, nr, false), vorher);
	});

	it('setzeSw und setzeName', () => {
		assert.equal(setzeSw(vorher, nr, 'grau'), mit(' data-sw="grau"'));
		assert.equal(setzeSw(setzeSw(vorher, nr, 'weg'), nr, null), vorher);
		assert.equal(setzeName(vorher, nr, ' Wilma links '), mit(' data-name="Wilma links"'));
		assert.equal(setzeName(setzeName(vorher, nr, 'x'), nr, '  '), vorher);
	});
});

describe('Duplizieren mit neuen Ids (3.11)', () => {
	const SVG =
		'<svg class="form" data-lage="frei" style="--x:10px"><defs><linearGradient id="verlauf-a1b2"></linearGradient></defs>' +
		'<circle fill="url(#verlauf-a1b2)"/><use href="#verlauf-a1b2"/></svg>';
	const ids = (quelle: string) => [...quelle.matchAll(/\sid="([^"]*)"/g)].map((t) => t[1]);

	it('die Kopie liegt 16 px versetzt davor, Ids sind eindeutig, die Verweise passen', () => {
		const vorher = blatt(...ebene('vorne', SVG));
		const { nr, quelle } = dupliziereGestaltung(vorher, nrMit(vorher, 'form'));
		const kopie = zerlege(quelle).knoten[nr ?? -1];
		assert.ok(kopie);
		const html = quelle.slice(kopie.start, kopie.ende);
		const [id] = ids(html);
		assert.match(id ?? '', /^verlauf-[a-z0-9]{4}$/);
		assert.notEqual(id, 'verlauf-a1b2');
		assert.equal(new Set(ids(quelle)).size, 2);
		assert.equal(html, SVG.replace('--x:10px', '--x:26px;--y:16px').replaceAll('verlauf-a1b2', id ?? ''));
		assert.equal(quelle, blatt(...ebene('vorne', SVG, html)));
	});

	it('⌘D und ⌫ im Editor: dupliziereBaustein und loescheBaustein leiten weiter', () => {
		const vorher = blatt(...ebene('vorne', SVG));
		assert.deepEqual(
			dupliziereBaustein(vorher, nrMit(vorher, 'form'), N),
			dupliziereGestaltung(vorher, nrMit(vorher, 'form')),
		);
		const weg = loescheBaustein(vorher, nrMit(vorher, 'form'), N);
		assert.equal(weg.quelle, blatt());
		assert.equal(klasseAn(weg.quelle, weg.nr), 'seite');
	});

	it('eine Seite kopiert ihre Ebenen mit, mit neuen Ids', () => {
		const vorher = blatt(...ebene('vorne', SVG));
		const { quelle } = dupliziereBaustein(vorher, nrMit(vorher, 'seite'), N);
		assert.equal(zerlege(quelle).knoten.filter((k) => klassenVon(k).includes('ebene')).length, 2);
		const alle = ids(quelle);
		assert.equal(alle.length, 2);
		assert.equal(new Set(alle).size, 2);
		for (const id of alle) {
			assert.ok(quelle.includes(`url(#${id})`) && quelle.includes(`href="#${id}"`), id);
		}
	});

	it('neueSvgIds hält die Art und meidet Ids der Quelle', () => {
		const neu = neueSvgIds(FORM_VERLAUF, FORM_VERLAUF);
		const [id] = ids(neu);
		assert.match(id ?? '', /^verlauf-[a-z0-9]{4}$/);
		assert.equal(neu, FORM_VERLAUF.replaceAll('verlauf-a1b2', id ?? ''));
	});
});

describe('Der Stapel übergeht die Ebenen', () => {
	it('ein Baustein, der ans Seitenende eingefügt wird, steht vor .ebene', () => {
		const vorher = blatt(...ebene('vorne', A));
		const neu = '<div class="aufgabe"><span class="nr">0</span></div>';
		const { nr, quelle } = fuegeBausteinEin(vorher, { id: 'aufgabe', ort: 'seite', html: neu }, null, N);
		assert.equal(quelle, blatt('  <div class="aufgabe"><span class="nr">2</span></div>', ...ebene('vorne', A)));
		assert.equal(klasseAn(quelle, nr), 'aufgabe');
		// Ist Gestaltung gewählt, gilt dasselbe.
		assert.equal(
			fuegeBausteinEin(vorher, { id: 'aufgabe', ort: 'seite', html: neu }, nrMit(vorher, 'a'), N).quelle,
			quelle,
		);
	});

	it('verschiebeBaustein legt nie in oder hinter eine Ebene', () => {
		const zwei = [
			'<body>',
			'<section class="seite">',
			'  <div class="aufgabe"><span class="nr">1</span></div>',
			...ebene('vorne', A),
			'</section>',
			'<section class="seite">',
			'  <div class="aufgabe x"><span class="nr">2</span></div>',
			'</section>',
			'</body>',
			'',
		].join('\n');
		const erwartet = [
			'<body>',
			'<section class="seite">',
			'  <div class="aufgabe"><span class="nr">1</span></div>',
			'  <div class="aufgabe x"><span class="nr">2</span></div>',
			...ebene('vorne', A),
			'</section>',
			'<section class="seite">',
			'</section>',
			'</body>',
			'',
		].join('\n');
		const x = nrMit(zwei, 'x');
		assert.equal(verschiebeBaustein(zwei, x, { nr: nrMit(zwei, 'a'), wo: 'nach' }, N).quelle, erwartet);
		assert.equal(verschiebeBaustein(zwei, x, { nr: nrMit(zwei, 'ebene'), wo: 'nach' }, N).quelle, erwartet);
		assert.equal(verschiebeBaustein(zwei, x, { in: nrMit(zwei, 'seite') }, N).quelle, erwartet);
	});

	it('Nummern zählen Gestaltung nicht mit', () => {
		const mit = blattMit({ vorne: [A], anker: [B] });
		assert.equal(nummeriere(mit, N), mit);
	});

	it('nach dem Löschen eines Bausteins ist nie die Ebene gewählt', () => {
		const vorher = blatt('  <div class="aufgabe zwei"><span class="nr">2</span></div>', ...ebene('vorne', A));
		const { nr, quelle } = loescheBaustein(vorher, nrMit(vorher, 'zwei'), N);
		assert.equal(klasseAn(quelle, nr), 'aufgabe');
	});
});

describe('Bestand (Entscheidung 26)', () => {
	const materialien = [
		...readdirSync(ASSETS)
			.filter((d) => d.endsWith('.html'))
			.map((d) => path.join(ASSETS, d)),
		...readdirSync(path.join(ASSETS, 'muster')).map((d) => path.join(ASSETS, 'muster', d)),
	];

	it('ohne Gestaltung kommt jede Umformung Zeichen für Zeichen wie vorher zurück', () => {
		assert.ok(materialien.length > 10);
		for (const datei of materialien) {
			const quelle = readFileSync(datei, 'utf8');
			const z = zerlege(quelle);
			assert.equal(raeumeEbenenAuf(quelle), quelle, datei);
			for (const seite of z.knoten.filter((k) => klassenVon(k).includes('seite')).slice(0, 2)) {
				for (const k of [seite, ...seite.kinder]) {
					const wie = nummeriere(wendeAn(quelle, dupliziere(z, k)), N);
					assert.equal(dupliziereBaustein(quelle, k.nr, N).quelle, wie, `${datei}: ${k.tag} ${k.nr}`);
				}
			}
		}
	});
});

describe('fuerAlle und ordneAlle (113)', () => {
	it('löscht drei Elemente in einem Schritt, auch wenn sich die Nummern verschieben', () => {
		const vorher = blatt(...ebene('hinten', FLAECHE, A, B), ...ebene('vorne', C));
		const r = fuerAlle(vorher, [nrMit(vorher, 'a'), nrMit(vorher, 'c'), nrMit(vorher, 'b')], loescheGestaltung);
		assert.equal(r.quelle, blatt(...ebene('hinten', FLAECHE)));
	});

	it('meldet die neuen Nummern in der Reihenfolge der Eingabe', () => {
		const vorher = blatt(...ebene('vorne', A, B, C));
		const r = fuerAlle(vorher, [nrMit(vorher, 'c'), nrMit(vorher, 'a')], (q, nr) => setzeLage(q, nr, { x: 5 }));
		const [c, a] = r.alle;
		assert.ok(c !== null && c !== undefined && a !== null && a !== undefined);
		assert.equal(klasseAn(r.quelle, c), 'c');
		assert.equal(klasseAn(r.quelle, a), 'a');
		assert.equal(leseLage(r.quelle, a).x, 5);
	});

	it('ordneAlle behält die Reihenfolge der Gewählten untereinander', () => {
		const vorher = blatt(...ebene('vorne', A, B, C));
		const nrn = [nrMit(vorher, 'a'), nrMit(vorher, 'b')];
		assert.equal(ordneAlle(vorher, nrn, 'ganz-vor').quelle, blatt(...ebene('vorne', C, A, B)));
		assert.equal(ordneAlle(vorher, nrn, 'vor').quelle, blatt(...ebene('vorne', C, A, B)));
		const zwei = blatt(...ebene('vorne', A, B, C));
		const hinten = [nrMit(zwei, 'b'), nrMit(zwei, 'c')];
		assert.equal(ordneAlle(zwei, hinten, 'ganz-zurueck').quelle, blatt(...ebene('vorne', B, C, A)));
		assert.ok(!ordneAlle(zwei, hinten, 'zurueck').quelle.includes('data-mehrfach-schritt'));
	});
});
