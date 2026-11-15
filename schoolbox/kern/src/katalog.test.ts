import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { AbbildungSchema, Werte } from './abbildungen';
import {
	ABBILDUNG_SCHEMA,
	attributeVon,
	BEREICH_SYMBOL,
	KATALOG_BEREICHE,
	KATALOG_KATEGORIEN,
	NUR_ZUR_LAUFZEIT,
	pruefeWerte,
} from './abbildungen';
import { KIT_KATALOG } from './bausteine';
import { browserSkip, pruefeStapel } from './browsertest';
import { einfuegbarAus } from './einfuegen';
import {
	ANGEBOT,
	angebotFuerBlatt,
	gehtImBlatt,
	KATALOG,
	kategorienFuer,
	passtZuBlatt,
	sucheImKatalog,
} from './katalog';
import { leseStarter } from './katalog-starter';
import { ASSETS } from './konfig';

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
		// Wer eigenes HTML hat (203-09, 203-10), braucht keinen Starter im Muster.
		const verlangt = new Set(
			KATALOG.flatMap((e) => [...(e.starter && e.html === undefined ? [e.starter] : []), ...(e.teile ?? [])]),
		);
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

	// HTML steht in katalog.ts nur in Vorlagenstrings, also nur im `html` eines Pakets (203-09).
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
					// Ohne Platzhalter schreibt der Stil des Projekts die Vorlage in einfache Anführungszeichen.
					.replace(/html: '[^']*'/g, '')
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

describe('Bereiche', () => {
	it('jede Kategorie steht genau einmal in einer Gruppe', () => {
		const inGruppen: string[] = KATALOG_BEREICHE.flatMap((g) => [...g.bereiche]);
		assert.equal(new Set(inGruppen).size, inGruppen.length);
		assert.deepEqual([...inGruppen].sort(), [...KATALOG_KATEGORIEN].sort());
	});

	it('jede Kategorie hat ein Symbol, und es gibt keine anderen', () => {
		assert.deepEqual(Object.keys(BEREICH_SYMBOL).sort(), [...KATALOG_KATEGORIEN].sort());
	});
});

describe('Suche', () => {
	const treffer = (anfrage: string) => sucheImKatalog(anfrage).map((e) => e.id);

	it('mehrere Wörter müssen alle passen, auch über Name und Suchbegriffe verteilt', () => {
		const [muster] = KATALOG;
		assert.ok(muster);
		const probe = { ...muster, id: 'probe', name: 'Zahlenmauer', suchbegriffe: ['Pyramide'] };
		const ids = (anfrage: string) => sucheImKatalog(anfrage, [probe]).map((e) => e.id);
		assert.deepEqual(ids('zahlen pyramide'), ['probe']);
		assert.deepEqual(ids('pyramide zahlen'), ['probe']);
		assert.deepEqual(ids('zahlen silben'), []);
	});

	it('Treffer im Namen stehen vor Treffern in den Suchbegriffen, auch wenn sie später in der Liste kommen', () => {
		const [muster] = KATALOG;
		assert.ok(muster);
		const imBegriff = { ...muster, id: 'im-begriff', name: 'Anderes', suchbegriffe: ['Domino'] };
		const imNamen = { ...muster, id: 'im-namen', name: 'Domino', suchbegriffe: [] };
		assert.deepEqual(
			sucheImKatalog('domino', [imBegriff, imNamen]).map((e) => e.id),
			['im-namen', 'im-begriff'],
		);
	});

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
			['Rechenreihe', 'x-rechenreihe'],
			['Rechenpäckchen', 'x-rechenreihe'],
			['Schreiblinien', 'x-lineatur'],
			['Plan', 'x-plan'],
			['Fuß', 'fuss'],
			['Fläche', 'flaeche'],
			['Rechenübersicht', 'paket-rechenuebersicht'],
			['Silbentext', 'x-silben'],
		] as const) {
			assert.ok(treffer(anfrage).includes(id), `${anfrage} → ${id}`);
		}
	});

	it('Treffer im Namen stehen vorn, leere Suche liefert alles, Unsinn nichts', () => {
		assert.equal(treffer('Zahlenstrahl')[0], 'x-zahlenstrahl');
		assert.equal(treffer('').length, ANGEBOT.length);
		assert.deepEqual(treffer('gibtsnicht'), []);
	});

	it('findet auch ohne Umlaute und ß', () => {
		const [muster] = KATALOG;
		assert.ok(muster);
		const eintrag = { ...muster, id: 'probe', name: 'Löschen und Größen', suchbegriffe: [] };
		for (const anfrage of ['loschen', 'grosse', 'Größen', 'löschen']) {
			assert.deepEqual(
				sucheImKatalog(anfrage, [eintrag]).map((e) => e.id),
				['probe'],
				anfrage,
			);
		}
		assert.ok(treffer('Saulendiagramm').includes('x-diagramm'));
	});
});

describe('Angebot (203)', () => {
	const ids = (liste: readonly { id: string }[]) => liste.map((e) => e.id);

	it('102 Bausteine in 13 Kategorien, jede mit mindestens drei', () => {
		assert.equal(ANGEBOT.length, 102);
		assert.equal(KATALOG_KATEGORIEN.length, 13);
		for (const k of KATALOG_KATEGORIEN) {
			const zahl = ANGEBOT.filter((e) => e.kategorie === k).length;
			assert.ok(zahl >= 3, `${k}: ${zahl}`);
		}
		assert.deepEqual(
			KATALOG_BEREICHE.map((g) => g.bereiche.length),
			[3, 8, 2],
		);
	});

	it('was nicht mehr angeboten wird, bleibt im Katalog und wird ohne Katalog nicht gefunden (203-04)', () => {
		for (const id of ['thema-band', 'ziel', 'reflexion', 'beispiel', 'willi', 'karte', 'silbentext']) {
			assert.ok(
				KATALOG.some((e) => e.id === id),
				id,
			);
			assert.ok(!ANGEBOT.some((e) => e.id === id), id);
		}
		for (const tag of ['x-gesamtpunkte', 'x-notenschluessel', 'x-erwartungshorizont']) {
			assert.ok(!ANGEBOT.some((e) => e.id === tag), tag);
		}
		assert.ok(!ids(sucheImKatalog('Ich-kann-Ziel')).includes('ziel'));
		assert.ok(ids(sucheImKatalog('Leitfigur', KATALOG)).includes('willi'));
	});

	it('Klasse 1 bekommt keine Rechen-Bausteine, die dort eine Fehlerbox zeichnen (203-02)', () => {
		const klasse = (id: string) => KATALOG.find((e) => e.id === id)?.klassen;
		assert.deepEqual(klasse('x-malkreuz'), [3, 4]);
		assert.deepEqual(klasse('x-schriftlich'), [3, 4]);
		assert.deepEqual(klasse('x-punktfeld'), [2, 3, 4]);
		assert.deepEqual(klasse('x-rechenrad'), [2, 3, 4]);
		const blatt = { fach: 'mathematik', klasse: 1, art: 'arbeitsblatt' } as const;
		const angebot = ids(angebotFuerBlatt(ANGEBOT, blatt));
		for (const id of ['x-malkreuz', 'x-schriftlich', 'x-punktfeld', 'x-rechenrad']) {
			assert.ok(!angebot.includes(id), id);
		}
		// Gesucht ist es trotzdem zu finden.
		assert.ok(ids(angebotFuerBlatt(ANGEBOT, blatt, 'malkreuz')).includes('x-malkreuz'));
	});

	it('ohne Suchwort: was zum Blatt passt, Aufgaben vorne, keine Notiz im Arbeitsblatt (203-05, 203-13)', () => {
		const blatt = { fach: 'mathematik', klasse: 2, art: 'arbeitsblatt' } as const;
		const liste = ids(angebotFuerBlatt(ANGEBOT, blatt));
		assert.deepEqual(liste.slice(0, 3), ['aufgabe', 'text', 'reihe']);
		assert.ok(!liste.includes('notiz'));
		assert.ok(!liste.includes('x-malkreuz'));
		assert.ok(!liste.includes('x-timer'));
		const folie = ids(angebotFuerBlatt(ANGEBOT, { ...blatt, art: 'praesentation' }));
		assert.ok(folie.includes('notiz') && folie.includes('folie-bild') && folie.includes('x-timer'));
		assert.ok(!folie.includes('namenszeile'));
		assert.equal(kategorienFuer('deutsch', ANGEBOT).indexOf('Deutsch'), 2);
		assert.ok(passtZuBlatt({ faecher: ['mathematik'] }, blatt));
		assert.ok(!passtZuBlatt({ arten: ['karten'] }, blatt));
	});

	it('Klasse und Folien filtern hart: kein Weg bietet an, was im Blatt nicht zeichnet (203-02, 203-N01)', () => {
		const geht = (b: { klasse: 1 | 2 | 3 | 4; art: 'arbeitsblatt' | 'praesentation' }) =>
			ids(ANGEBOT.filter((e) => gehtImBlatt(e, b)));
		const k1 = geht({ klasse: 1, art: 'arbeitsblatt' });
		const rechnen = ['x-rechenrad', 'x-punktfeld', 'x-malkreuz', 'x-schriftlich'];
		for (const id of rechnen) {
			assert.ok(!k1.includes(id), id);
		}
		const k2 = geht({ klasse: 2, art: 'arbeitsblatt' });
		assert.ok(!k2.includes('x-malkreuz') && !k2.includes('x-schriftlich') && k2.includes('x-rechenrad'));
		assert.ok(geht({ klasse: 4, art: 'arbeitsblatt' }).includes('x-malkreuz'));
		const folien = ANGEBOT.filter((e) => e.kategorie === 'Folien').map((e) => e.id);
		assert.equal(folien.length, 7);
		assert.ok(folien.every((id) => !k1.includes(id)));
		assert.ok(folien.every((id) => geht({ klasse: 1, art: 'praesentation' }).includes(id)));
		// Die Suche findet nur, was der harte Filter übrig lässt (Schublade, Schnellauswahl, Palette).
		const angebot = ANGEBOT.filter((e) => gehtImBlatt(e, { klasse: 1, art: 'arbeitsblatt' }));
		for (const wort of ['malkreuz', 'rechenrad', 'punktfeld', 'schriftlich', 'merksatz', 'folie']) {
			const blatt = { fach: 'mathematik', klasse: 1, art: 'arbeitsblatt' } as const;
			const treffer = ids(angebotFuerBlatt(angebot, blatt, wort));
			assert.ok(!treffer.some((id) => rechnen.includes(id)), wort);
			assert.ok(!treffer.some((id) => folien.includes(id)), wort);
		}
		// Weich bleibt: Fach und die übrigen Arten.
		assert.ok(gehtImBlatt({ kategorie: 'Blatt', arten: ['klassenarbeit'] }, { klasse: 1, art: 'arbeitsblatt' }));
	});

	it('die Uhr hat Zeiger, „Uhrzeit ablesen“ vier Uhren mit Beispiel (203-01)', () => {
		const leer = new Map<string, string>();
		const uhr = einfuegbarAus(
			KATALOG.find((e) => e.id === 'x-uhr')!,
			STARTER,
		);
		assert.match(uhr.html ?? '', /<x-uhr [^>]*zeit="\d+:\d\d"/);
		const paket =
			einfuegbarAus(
				KATALOG.find((e) => e.id === 'paket-uhr')!,
				leer,
			).teile?.join('') ?? '';
		assert.equal([...paket.matchAll(/<x-uhr [^>]*zeit="\d+:\d\d"/g)].length, 4);
		assert.equal([...paket.matchAll(/class="zelle beispiel"/g)].length, 1);
	});
});

describe('Starter im Browser', { skip: browserSkip() }, () => {
	const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-starter-'));
	after(() => rmSync(ordner, { force: true, recursive: true }));

	const seite = (profil: string, id: string, html: string) => {
		const dir = path.join(ordner, profil, id);
		mkdirSync(dir, { recursive: true });
		const datei = path.join(dir, 'material.html');
		writeFileSync(
			datei,
			`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${id}</title><link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head><body class="kl3 ${profil}"><section class="seite"><div class="kopf"><div class="titel"><h1>Test</h1></div></div><div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Test</span></div><div class="koerper">${html}</div></div></section></body></html>`,
		);
		return datei;
	};

	for (const profil of ['sw', 'farbe palette-himmel']) {
		it(`jeder x-Starter zeichnet fehlerfrei auf leerer Seite: ${profil}`, { timeout: 600_000 }, () => {
			const eintraege = KATALOG.filter((e) => e.herkunft === 'abbildung');
			const berichte = pruefeStapel(eintraege.map((e) => seite(profil, e.id, STARTER.get(e.id) ?? '')));
			const fehler = eintraege.flatMap((e, i) =>
				(berichte[i] ?? []).filter((m) => m.stufe === 'FEHLER').map((m) => `${profil} ${e.id}: ${m.text}`),
			);
			assert.deepEqual(fehler, []);
		});
	}
});
