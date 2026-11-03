import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { AbbildungSchema, Werte } from './abbildungen';
import { ABBILDUNG_SCHEMA, attributeVon, KATALOG_KATEGORIEN, NUR_ZUR_LAUFZEIT, pruefeWerte } from './abbildungen';
import { KIT_KATALOG } from './bausteine';
import { KATALOG, sucheImKatalog } from './katalog';
import { leseStarter } from './katalog-starter';
import { ASSETS, BLATT_PY } from './konfig';

const STARTER = leseStarter();
const CSS = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');
/** Gepflegte Liste aus 043: Diese Klassen des Kits müssen im Katalog stehen. */
const KIT_KLASSEN = [
	'aufgabe',
	'anw',
	'reihe',
	'zelle',
	'karten',
	'karte',
	'antwort',
	'schreiblinie',
	'box',
	'malfeld',
	'vermutung',
	'punkte',
	'tipp',
	'blase',
	'figur',
	'platzhalter',
	'notiz',
	'kopf',
	'ziel',
	'wahlhilfe',
	'namenszeile',
	'fuss',
	'reflexion',
	'trenner',
	'beispiel',
	'zeile',
];

const attribute = (html: string): Werte => {
	const kopf = /^<[a-z0-9-]+([^>]*)>/.exec(html)?.[1] ?? '';
	return Object.fromEntries(
		[...kopf.matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/g)].map((a) => [
			a[1] ?? '',
			(a[2] ?? '').replace(/&quot;/g, '"'),
		]),
	);
};

describe('Katalog', () => {
	it('deckt jedes Element aus ABBILDUNG_SCHEMA ab, nur das Testelement fehlt', () => {
		const ids = new Set(KATALOG.map((e) => e.id));
		assert.deepEqual(
			Object.keys(ABBILDUNG_SCHEMA).filter((t) => !ids.has(t)),
			['x-probe'],
		);
		const zahl = KATALOG.filter((e) => e.herkunft === 'abbildung').length;
		assert.equal(zahl, Object.keys(ABBILDUNG_SCHEMA).length - 1);
	});

	it('jede Kit-Klasse aus der Liste steht im Katalog und in blatt.css', () => {
		const html = [...STARTER.values()].join('\n');
		const klassen = KATALOG.flatMap((e) => (e.klasse ? [e.klasse] : []));
		const fehlt = KIT_KLASSEN.filter(
			(k) => !klassen.includes(k) && !new RegExp(`class="[^"]*\\b${k}\\b`).test(html),
		);
		assert.deepEqual(fehlt, []);
		for (const k of KIT_KLASSEN.filter((x) => x !== 'zelle')) {
			assert.ok(new RegExp(`\\.${k}\\b`).test(CSS), `blatt.css: .${k}`);
		}
	});

	it('Ids sind eindeutig, Kategorien gültig, Suchbegriffe da', () => {
		assert.equal(new Set(KATALOG.map((e) => e.id)).size, KATALOG.length);
		for (const e of KATALOG) {
			assert.ok(KATALOG_KATEGORIEN.includes(e.kategorie), e.id);
			assert.ok(e.suchbegriffe.length > 0, `${e.id}: keine Suchbegriffe`);
		}
	});

	it('jeder Starter steht in den Mustern, jede Kennung im Katalog', () => {
		const verlangt = new Set(KATALOG.flatMap((e) => [...(e.starter ? [e.starter] : []), ...(e.teile ?? [])]));
		assert.deepEqual(
			[...verlangt].filter((id) => !STARTER.has(id)),
			[],
		);
		const bekannt = new Set(KATALOG.flatMap((e) => [e.starter, ...(e.teile ?? [])]));
		assert.deepEqual(
			[...STARTER.keys()].filter((id) => !bekannt.has(id)),
			[],
		);
	});

	it('jeder x-Starter besteht die Prüfung des Schemas', () => {
		const falsch = KATALOG.filter((e) => e.herkunft === 'abbildung').flatMap((e) => {
			const s = ABBILDUNG_SCHEMA[e.id as keyof typeof ABBILDUNG_SCHEMA] as AbbildungSchema;
			const html = STARTER.get(e.id) ?? '';
			const leer = Object.fromEntries(attributeVon(s).map((a) => [a, null]));
			const innen = />([^<]*)</.exec(html)?.[1]?.trim();
			const fehler = pruefeWerte(s, { ...leer, ...attribute(html), ...(innen ? { inhalt: innen } : {}) });
			return Object.keys(fehler).length === 0 ? [] : [`${e.id}: ${JSON.stringify(fehler)}`];
		});
		assert.deepEqual(falsch, []);
		assert.ok(!NUR_ZUR_LAUFZEIT.includes('data-katalog'));
	});

	it('Wächter: Kein x-Eintrag hat eigenen Namen oder HTML, Kit-Einträge haben genau eine Namensquelle', () => {
		const quelle = readFileSync(path.join(__dirname, 'katalog.ts'), 'utf8');
		assert.deepEqual(
			[...quelle.matchAll(/id: '(x-[a-z-]+)'/g)].map((t) => t[1]),
			[],
		);
		assert.ok(
			!/<[a-z]+[\s>]/.test(
				quelle
					.replace(/\/\*[\s\S]*?\*\//g, '')
					.replace(/`[^`]*`/g, '')
					.replace(/<[A-Z][^>]*>/g, ''),
			),
		);
		for (const e of KIT_KATALOG) {
			assert.ok((e.art === undefined) !== (e.name === undefined), `${e.id}: art oder name, nicht beides`);
		}
	});

	it('Probe: Ein Element ohne Katalog-Angaben fehlt und schlägt an', () => {
		const { 'x-uhr': _uhr, ...rest } = ABBILDUNG_SCHEMA as Record<string, AbbildungSchema>;
		const ids = new Set(KATALOG.filter((e) => e.id !== 'x-uhr').map((e) => e.id));
		assert.ok(_uhr);
		assert.deepEqual(
			Object.keys({ 'x-uhr': _uhr, ...rest })
				.filter((t) => !ids.has(t))
				.sort(),
			['x-probe', 'x-uhr'],
		);
	});

	it('Probe: Eine doppelte Kennung im Muster ist ein Fehler', () => {
		const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-katalog-'));
		try {
			writeFileSync(path.join(ordner, 'a.html'), '<div data-katalog="x"></div>');
			writeFileSync(path.join(ordner, 'b.html'), '<div data-katalog="x"></div>');
			assert.throws(() => leseStarter(ordner), /doppelt/);
		} finally {
			rmSync(ordner, { force: true, recursive: true });
		}
	});
});

describe('Suche', () => {
	const treffer = (anfrage: string) => sucheImKatalog(anfrage).map((e) => e.id);

	it('findet die Fachsprache der Skills', () => {
		for (const [anfrage, id] of [
			['Rechenmauer', 'x-zahlenmauer'],
			['Hunderterraum', 'x-hundertertafel'],
			['Zahlengerade', 'x-zahlenstrahl'],
			['Wendeplättchen', 'x-zwanzigerfeld'],
			['Säulendiagramm', 'x-diagramm'],
			['Wörtersuche', 'x-suchsel'],
			['Silbenbögen', 'x-silben'],
			['Lineatur', 'x-lineatur'],
			['Umstellprobe', 'x-satzglieder'],
			['Himmelsrichtungen', 'x-windrose'],
			['Stromkreis', 'x-schaltplan'],
			['Ich-kann-Ziel', 'ziel'],
			['Leitfigur', 'willi'],
		] as const) {
			assert.ok(treffer(anfrage).includes(id), `${anfrage} → ${id}`);
		}
	});

	it('Treffer im Namen stehen vorn, leere Suche liefert alles, Unsinn nichts', () => {
		assert.equal(treffer('Zahlenstrahl')[0], 'x-zahlenstrahl');
		assert.equal(treffer('').length, KATALOG.length);
		assert.deepEqual(treffer('gibtsnicht'), []);
	});
});

const hatBrowser = () => {
	try {
		execFileSync(
			'python3',
			[
				'-c',
				'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()',
				path.dirname(BLATT_PY),
			],
			{ stdio: 'ignore' },
		);
		return true;
	} catch {
		return false;
	}
};

describe('Starter im Browser', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-starter-'));
	after(() => rmSync(ordner, { force: true, recursive: true }));

	const pruefe = (profil: string, id: string, html: string) => {
		const dir = path.join(ordner, profil, id);
		mkdirSync(dir, { recursive: true });
		const datei = path.join(dir, 'material.html');
		const seite = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${id}</title><link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head><body class="kl3 ${profil}"><section class="seite"><div class="kopf"><div class="titel"><h1>Test</h1></div></div><div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Test</span></div><div class="koerper">${html}</div></div></section></body></html>`;
		writeFileSync(datei, seite);
		const bericht = path.join(dir, 'b.json');
		try {
			execFileSync('python3', ['-B', BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht], {
				stdio: 'ignore',
			});
		} catch {
			// Exit 1 bei FEHLER; der Bericht steht trotzdem da.
		}
		return (JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: { stufe: string; text: string }[] }).meldungen
			.filter((m) => m.stufe === 'FEHLER')
			.map((m) => `${profil} ${id}: ${m.text}`);
	};

	for (const profil of ['sw', 'farbe palette-himmel']) {
		it(`jeder x-Starter zeichnet fehlerfrei auf leerer Seite: ${profil}`, { timeout: 600_000 }, () => {
			const fehler = KATALOG.filter((e) => e.herkunft === 'abbildung').flatMap((e) =>
				pruefe(profil, e.id, STARTER.get(e.id) ?? ''),
			);
			assert.deepEqual(fehler, []);
		});
	}
});
