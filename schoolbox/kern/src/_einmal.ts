import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from '/tmp/090-124-hilfe/laeufer';

import { BEISPIELE, blattMit, blattMitBeispiel, SEITENFLAECHE } from '../../web/e2e/gestaltung-daten';
import {
	AUFMACHUNGEN,
	aufmachungenTabelle,
	entferneAufmachung,
	gleicheAufmachungAb,
	hatThemaKopf,
	istDeckblatt,
	legeAufmachungFrei,
	leseAufmachung,
	TEIL,
	wendeAufmachungAn,
	wuerfleAufmachung,
	zieheAufmachungNach,
} from './aufmachungen';
import { browserSkip } from './browsertest';
import { setzeBlatt } from './kit-einstellungen';
import { ASSETS, BLATT_PY } from './konfig';
import { KOPFBAND_MASKEN, kopfbandPfad } from './aufmachungen';
import type { Meldung } from './meldungen';
import type { Knoten } from './quelltext';
import { attribut, entferne, innenVon, klassenVon, quelleVon, wendeAn, zerlege } from './quelltext';
import { leseSeitengestaltung, seitenNummern, setzeSeitenflaeche } from './seitengestaltung';
import { fuegeSeiteEin } from './struktur';

const TESTDATEN = path.join(__dirname, 'testdaten');
/** Kopien der Testmappen und der Produktion, falls der Materialvergleich (091) sie angelegt hat. */
const KOPIEN = process.env.SCHOOLBOX_KOPIEN ?? '/tmp/090-124-materialvergleich/kopie';

const hat = (k: Knoten, klasse: string) => klassenVon(k).includes(klasse);

/** Ein Deckblatt: erste Seite ohne Aufgabe, dahinter ein Arbeitsblatt. */
const DECKBLATT = blattMit().replace(
	'<section class="seite">',
	[
		'<section class="seite">',
		'  <div class="kopf"><div class="titel"><h1>Die Formen-Detektive</h1><div class="ziel">Reihe Geometrie</div></div></div>',
		'  <img class="figur" src="bilder/willi.png" alt="Willi" style="width:260px;align-self:center">',
		'</section>',
		'<section class="seite">',
	].join('\n'),
);

/**
 * Die Quelle ohne alles, was ein Rezept anfassen darf: `body`-Start-Tag, Teile, eigene Seitenfläche und eigener
 * Seitenrahmen (beim ersten Anwenden ersetzt) und leere Ebenen. Was übrig bleibt, muss vor und nach gleich sein (Z7).
 */
const ohneRezeptBereich = (quelle: string) => {
	let q = quelle;
	for (;;) {
		const z = zerlege(q);
		const weg = z.knoten.filter(
			(k) =>
				attribut(k, TEIL) !== undefined ||
				(k.eltern !== null && hat(k.eltern, 'ebene') && (hat(k, 'seitenflaeche') || hat(k, 'seitenrahmen'))),
		);
		const leer = z.knoten.filter(
			(k) => hat(k, 'ebene') && hat(k, 'hinten') && k.kinder.every((c) => weg.includes(c)),
		);
		const oberste = [...leer, ...weg.filter((k) => !leer.some((e) => k.eltern === e))];
		if (oberste.length === 0) {
			break;
		}
		q = wendeAn(q, oberste.flatMap((k) => entferne(z, k)));
	}
	return q.replace(/<body[^>]*>/, '<body>');
};

const alleTestdaten = () => {
	const dateien: [string, string][] = [
		...BEISPIELE.map((b): [string, string] => [`Beispiel ${b.art}`, blattMitBeispiel(b)]),
		['blattMit', blattMit()],
		['Deckblatt', DECKBLATT],
	];
	for (const ordner of [TESTDATEN, ASSETS, path.join(ASSETS, 'muster')]) {
		for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.html'))) {
			dateien.push([datei, readFileSync(path.join(ordner, datei), 'utf8')]);
		}
	}
	if (existsSync(KOPIEN)) {
		const suche = (ordner: string): string[] =>
			readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
				const p = path.join(ordner, e.name);
				if (e.isDirectory()) {
					return suche(p);
				}
				return e.name === 'material.html' ? [p] : [];
			});
		for (const datei of suche(KOPIEN)) {
			dateien.push([path.relative(KOPIEN, datei), readFileSync(datei, 'utf8')]);
		}
	}
	return dateien.filter(([, q]) => !/<body[^>]*class="[^"]*\bminibuch\b/.test(q));
};

const streuungen = (quelle: string) =>
	zerlege(quelle).knoten.filter((k) => attribut(k, TEIL)?.wert === 'streuung');

describe('Rezepte im Kern (114)', () => {
	it('hat das Register mit Zirkus (118: und Detektiv, Dschungel, Ruhig)', () => {
		assert.deepEqual(
			AUFMACHUNGEN.map((a) => a.id),
			['detektiv', 'zirkus', 'dschungel', 'ruhig'],
		);
		const zirkus = AUFMACHUNGEN.find((a) => a.id === 'zirkus');
		assert.ok(zirkus);
		assert.equal(zirkus.farbwelten.length, 3);
		assert.ok(aufmachungenTabelle().includes('| Zirkus | `zirkus` |'));
	});

	it('schreibt Werte am body und Teile hinten, gesperrt', () => {
		const q = wendeAufmachungAn(blattMit(), 'zirkus');
		assert.match(
			q,
			/<body class="kl2 farbe palette-himmel" data-aufmachung="zirkus" data-aufmachung-farben="1" data-aufmachung-kopfband="welle" data-aufmachung-rahmen="gepunktet" data-aufmachung-konfetti="0.6 punkt dreieck stern" data-aufmachung-saat="4711" style="--a1:#e63946;/,
		);
		const teile = zerlege(q).knoten.filter((k) => attribut(k, TEIL) !== undefined);
		assert.deepEqual(
			teile.map((k) => attribut(k, TEIL)?.wert),
			['flaeche', 'rahmen', 'streuung'],
		);
		for (const k of teile) {
			assert.ok(attribut(k, 'data-gesperrt'));
			assert.ok(k.eltern && hat(k.eltern, 'ebene') && hat(k.eltern, 'hinten'));
		}
		assert.deepEqual(leseAufmachung(q), {
			id: 'zirkus',
			farben: 1,
			kopfband: 'welle',
			rahmen: 'gepunktet',
			konfetti: { menge: 0.6, formen: ['punkt', 'dreieck', 'stern'] },
			saat: 4711,
		});
		assert.equal(leseAufmachung(blattMit()), null);
	});

	it('ist idempotent, und Entfernen stellt die Quelle Zeichen für Zeichen wieder her', () => {
		for (const quelle of [blattMit(), DECKBLATT, ...BEISPIELE.filter((b) => !b.art.startsWith('seiten')).map(blattMitBeispiel)]) {
			const mit = wendeAufmachungAn(quelle, 'zirkus');
			assert.equal(wendeAufmachungAn(mit, 'zirkus'), mit);
			assert.equal(entferneAufmachung(mit), quelle);
			const anders = wendeAufmachungAn(quelle, 'zirkus', { farben: 3, kopfband: 'zacken', rahmen: 'doppelt', saat: 9 });
			assert.equal(wendeAufmachungAn(anders, 'zirkus', leseAufmachung(anders) ?? {}), anders);
			assert.equal(entferneAufmachung(anders), quelle);
		}
	});

	it('ändert nichts außer body-Werten und eigenen Teilen (Z7), über alle Testdaten', () => {
		const daten = alleTestdaten();
		assert.ok(daten.length > 30);
		for (const [name, quelle] of daten) {
			const mit = wendeAufmachungAn(quelle, 'zirkus', { saat: 17 });
			assert.equal(ohneRezeptBereich(mit), ohneRezeptBereich(quelle), name);
			assert.equal(wendeAufmachungAn(mit, 'zirkus', { saat: 17 }), mit, `${name}: idempotent`);
		}
	});

	it('ersetzt eigene Fläche beim ersten Anwenden; danach geändert bleibt sie beim Würfeln', () => {
		const quelle = blattMitBeispiel({ art: 'seitenflaeche', ort: 'hinten', html: SEITENFLAECHE });
		const mit = wendeAufmachungAn(quelle, 'zirkus');
		const [seite = 0] = seitenNummern(mit);
		assert.equal(leseSeitengestaltung(mit, seite).flaeche?.rezept, true);
		// Die Lehrkraft ändert die Fläche des Rezepts: Sie verliert Kennzeichen und Sperre.
		const eigen = setzeSeitenflaeche(mit, [seite], { art: 'farbe', f1: '#ffeeaa' });
		const f = leseSeitengestaltung(eigen, seite).flaeche;
		assert.equal(f?.rezept, false);
		assert.equal(f?.f1, '#ffeeaa');
		assert.ok(!/class="seitenflaeche"[^>]*data-gesperrt/.test(eigen));
		const gewuerfelt = wuerfleAufmachung(eigen, 99);
		assert.equal(leseSeitengestaltung(gewuerfelt, seite).flaeche?.f1, '#ffeeaa');
		assert.equal((gewuerfelt.match(/data-aufmachung-teil="flaeche"/g) ?? []).length, 0);
		assert.equal(wuerfleAufmachung(gewuerfelt, 99), gewuerfelt);
	});

	it('Würfeln ändert nur Saat und Streuungen', () => {
		const mit = wendeAufmachungAn(DECKBLATT, 'zirkus');
		const neu = wuerfleAufmachung(mit, 12345);
		assert.notEqual(neu, mit);
		const ohneStreuung = (q: string) => {
			const z = zerlege(q);
			return wendeAn(q, streuungen(q).flatMap((k) => entferne(z, k))).replace(/ data-aufmachung-saat="\d+"/, '');
		};
		assert.equal(ohneStreuung(neu), ohneStreuung(mit));
		assert.equal(leseAufmachung(neu)?.saat, 12345);
		assert.equal(wuerfleAufmachung(blattMit(), 3), blattMit());
	});

	it('gibt einer neuen Seite die Teile und erzeugt sie beim Formatwechsel neu', () => {
		const mit = wendeAufmachungAn(blattMit(), 'zirkus');
		const zwei = fuegeSeiteEin(mit, { nach: null, mitNamenszeile: true }, { jeSeite: false });
		const seiten = zerlege(zwei.quelle).knoten.filter((k) => hat(k, 'seite'));
		assert.equal(seiten.length, 2);
		for (const s of seiten) {
			const hinten = s.kinder.find((k) => hat(k, 'ebene') && hat(k, 'hinten'));
			assert.deepEqual(
				hinten?.kinder.map((k) => attribut(k, TEIL)?.wert),
				['flaeche', 'rahmen', 'streuung'],
			);
		}
		assert.equal(zwei.nr, seiten[1]?.nr);
		// Die Saat je Seite ist Saat + Seitennummer.
		assert.deepEqual(
			streuungen(zwei.quelle).map((k) => attribut(k, 'data-saat')?.wert),
			['4712', '4713'],
		);
		const quer = setzeBlatt(mit, { format: 'a4-quer' });
		assert.notEqual(quelleVon(zerlege(quer), streuungen(quer)[0] as Knoten), quelleVon(zerlege(mit), streuungen(mit)[0] as Knoten));
		assert.equal(quer, wendeAufmachungAn(setzeBlatt(blattMit(), { format: 'a4-quer' }), 'zirkus'));
		assert.equal(setzeBlatt(quer, { format: 'a4-hoch' }), mit);
		// Ins Minibuch fällt das Rezept weg.
		assert.equal(leseAufmachung(setzeBlatt(mit, { format: 'minibuch' })), null);
		assert.equal(zieheAufmachungNach(blattMit()), blattMit());
	});

	it('erkennt das Deckblatt: erste Seite ohne Aufgabe', () => {
		const [erste = 0, zweite = 0] = seitenNummern(DECKBLATT);
		assert.equal(istDeckblatt(DECKBLATT, erste), true);
		assert.equal(istDeckblatt(DECKBLATT, zweite), false);
		const [ab = 0] = seitenNummern(blattMit());
		assert.equal(istDeckblatt(blattMit(), ab), false);
		assert.throws(() => istDeckblatt(blattMit(), 0));
		// Das Deckblatt bekommt Streifen und Sterne am Rand, das Arbeitsblatt Farbe und Punkte.
		const mit = wendeAufmachungAn(DECKBLATT, 'zirkus');
		assert.deepEqual(
			streuungen(mit).map((k) => attribut(k, 'data-streuung')?.wert),
			['konfetti', 'punkte'],
		);
		assert.ok(mit.includes('data-flaeche="muster" data-muster="streifen"'));
	});

	it('lehnt das Minibuch und unbekannte Rezepte ab', () => {
		const mini = readFileSync(path.join(ASSETS, 'vorlage-minibuch.html'), 'utf8');
		assert.throws(() => wendeAufmachungAn(mini, 'zirkus'), /Minibuch/);
		assert.throws(() => wendeAufmachungAn(blattMit(), 'gibtsnicht'));
	});

	it('setzt mit Thema mit eigenem Kopf kein Kopfband, der Titel bleibt lesbar', () => {
		const thema = blattMit().replace(
			'<div class="kopf">',
			'<div class="thema-band"></div>\n  <div class="kopf">',
		);
		assert.ok(hatThemaKopf(thema));
		const mit = wendeAufmachungAn(thema, 'zirkus', { kopfband: 'welle' });
		assert.ok(!mit.includes('data-aufmachung-kopfband'));
		assert.ok(mit.includes('--a-titel:#1d3557'));
		assert.equal(leseAufmachung(mit)?.kopfband, 'ohne');
		assert.ok(wendeAufmachungAn(blattMit(), 'zirkus').includes('--a-titel:#ffffff'));
	});

	it('legt frei: mit Maßen das Kopfband als Form, ohne Maße ohne Kopfband', () => {
		const mit = wendeAufmachungAn(blattMit(), 'zirkus');
		const [seite = 0] = seitenNummern(mit);
		for (const kopfbaender of [[], [{ seite, x: 0, y: 0, b: 794, h: 160, d: 'M0 0H794V140C600 170 200 120 0 150Z' }]]) {
			const frei = legeAufmachungFrei(mit, kopfbaender);
			const z = zerlege(frei);
			assert.equal(leseAufmachung(frei), null);
			assert.ok(!frei.includes('data-aufmachung'));
			assert.ok(!/class="(seitenflaeche|seitenrahmen|streuung)"[^>]*data-gesperrt/.test(frei));
			// 119: Die Farben stehen nicht mehr am body, sondern in jedem Teil.
			assert.ok(!/<body[^>]*--a1/.test(frei));
			assert.ok(/class="seitenflaeche"[^>]*style="--a1:#e63946;/.test(frei));
			const band = z.knoten.find((k) => attribut(k, 'data-name')?.wert === 'Kopfband');
			const h1 = z.knoten.find((k) => k.tag === 'h1');
			if (kopfbaender.length) {
				assert.ok(band && band.eltern && hat(band.eltern, 'hinten'));
				assert.equal(band.eltern.kinder.at(-1), band);
				assert.ok(innenVon(z, band).includes('url(#verlauf-'));
				assert.equal(attribut(h1 as Knoten, 'style')?.wert, 'color:#ffffff');
				assert.equal(attribut(h1 as Knoten, 'data-sw')?.wert, 'dunkel');
			} else {
				assert.equal(band, undefined);
				assert.equal(attribut(h1 as Knoten, 'style')?.wert, 'color:#1d3557');
			}
		}
		assert.throws(() => legeAufmachungFrei(mit, [{ seite, x: 0, y: 0, b: 10, h: 10, d: 'url(x)' }]));
	});
});

const pruefe = async (html: string, profil: 'farbe' | 'sw') => {
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-rezept-'));
	try {
		const datei = path.join(tmp, 'material.html');
		const bericht = path.join(tmp, 'bericht.json');
		await writeFile(datei, html);
		try {
			execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--profil', profil, '--bericht', bericht], {
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

describe('Zirkus in allen Formaten ohne FEHLER und WARNUNG (114)', { skip: browserSkip() }, () => {
	const vorlage = (name: string) => readFileSync(path.join(ASSETS, name), 'utf8');
	// Je Format ein Arbeitsblatt, das ohne Rezept schon passt, und das Deckblatt.
	const arbeitsblatt = {
		'a4-hoch': () => vorlage('vorlage-arbeitsblatt.html'),
		'a4-quer': () => blattMit(),
		'a5-hoch': () => blattMit(),
		'a3-hoch': () => vorlage('vorlage-arbeitsblatt.html'),
		folie: () => vorlage('vorlage-praesentation.html'),
	} as const;
	for (const [format, ab] of Object.entries(arbeitsblatt)) {
		for (const [art, quelle] of [
			['Arbeitsblatt', ab],
			['Deckblatt', () => DECKBLATT],
		] as const) {
			it(`${art} ${format}`, { timeout: 120_000 }, async () => {
				const html = wendeAufmachungAn(setzeBlatt(quelle(), { format: format as 'a4-hoch' }), 'zirkus');
				for (const profil of ['farbe', 'sw'] as const) {
					const ernst = (await pruefe(html, profil)).filter((m) => m.stufe !== 'HINWEIS');
					assert.deepEqual(
						ernst.map((m) => `${m.code}: ${m.text}`),
						[],
						profil,
					);
				}
			});
		}
	}
});

// Alle Rezepte im Register: dieselben Kern-Tests wie für Zirkus, dazu der Kontrast am Band
/** Relative Leuchtdichte nach WCAG. */
const leuchte = (hex: string) => {
	const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a: string, b: string) => {
	const [hell, dunkel] = [leuchte(a), leuchte(b)].sort((x, y) => y - x) as [number, number];
	return (hell + 0.05) / (dunkel + 0.05);
};

describe('Alle Rezepte im Register (118)', () => {
	for (const a of AUFMACHUNGEN) {
		it(`${a.name}: idempotent, Entfernen stellt her, gleiche Saat gleiche Quelle`, () => {
			for (const quelle of [blattMit(), DECKBLATT]) {
				const mit = wendeAufmachungAn(quelle, a.id);
				assert.equal(wendeAufmachungAn(mit, a.id), mit);
				assert.equal(entferneAufmachung(mit), quelle);
				assert.equal(wendeAufmachungAn(quelle, a.id, { saat: 5 }), wendeAufmachungAn(quelle, a.id, { saat: 5 }));
				for (const farben of [2, 3] as const) {
					const anders = wendeAufmachungAn(quelle, a.id, { farben, saat: 9 });
					assert.equal(entferneAufmachung(anders), quelle);
				}
			}
		});

		it(`${a.name}: ändert nichts außer body-Werten und eigenen Teilen (Z7), über alle Testdaten`, () => {
			for (const [name, quelle] of alleTestdaten()) {
				const mit = wendeAufmachungAn(quelle, a.id, { saat: 17 });
				assert.equal(ohneRezeptBereich(mit), ohneRezeptBereich(quelle), name);
				assert.equal(wendeAufmachungAn(mit, a.id, { saat: 17 }), mit, `${name}: idempotent`);
			}
		});

		// Nur, wo das Band Standard ist oder das Rezept es dafür ausgelegt hat (Zirkus aus 114 und Detektiv nicht).
		it(`${a.name}: Weiß auf dem Band hat in jeder Farbwelt mindestens 4,5 : 1`, { skip: !['dschungel', 'ruhig'].includes(a.id) }, () => {
			for (const w of a.farbwelten) {
				for (const band of [w.a1, w.a2]) {
					assert.ok(kontrast(w.aTitel, band) >= 4.5, `${w.name}: ${w.aTitel} auf ${band}`);
				}
			}
		});
	}

	it('Ruhig hat keine Fläche, keine Streuung und kein Kopfband', () => {
		const q = wendeAufmachungAn(blattMit(), 'ruhig');
		const teile = zerlege(q).knoten.map((k) => attribut(k, TEIL)?.wert).filter(Boolean);
		assert.deepEqual([...new Set(teile)], ['rahmen']);
		assert.ok(!q.includes('data-aufmachung-kopfband='));
	});
});

describe('Detektiv, Dschungel, Ruhig in allen Formaten ohne FEHLER und WARNUNG (118)', { skip: browserSkip() }, () => {
	const vorlage = (name: string) => readFileSync(path.join(ASSETS, name), 'utf8');
	const arbeitsblatt = {
		'a4-hoch': () => vorlage('vorlage-arbeitsblatt.html'),
		'a4-quer': () => blattMit(),
		'a5-hoch': () => blattMit(),
		'a3-hoch': () => vorlage('vorlage-arbeitsblatt.html'),
		folie: () => vorlage('vorlage-praesentation.html'),
	} as const;
	for (const id of ['detektiv', 'dschungel', 'ruhig']) {
		for (const [format, ab] of Object.entries(arbeitsblatt)) {
			for (const [art, quelle] of [
				['Arbeitsblatt', ab],
				['Deckblatt', () => DECKBLATT],
			] as const) {
				it(`${id} ${art} ${format}`, { timeout: 120_000 }, async () => {
					const html = wendeAufmachungAn(setzeBlatt(quelle(), { format: format as 'a4-hoch' }), id);
					for (const profil of ['farbe', 'sw'] as const) {
						const ernst = (await pruefe(html, profil)).filter((m) => m.stufe !== 'HINWEIS');
						assert.deepEqual(
							ernst.map((m) => `${m.code}: ${m.text}`),
							[],
							profil,
						);
					}
				});
			}
		}
	}
});

// Freilegen im Detail (7-rezepte.md, Freilegen und Entfernen)
describe('Freilegen friert ein (119)', () => {
	const mit = wendeAufmachungAn(blattMit(), 'zirkus');
	const [seite = 0] = seitenNummern(mit);
	const band = { seite, x: 0, y: 0, b: 794, h: 160, d: kopfbandPfad('welle', 794, 160, 26, 180) };

	it('jedes Teil trägt die Farben; ein zweites Rezept danach ändert Streuung und Kopfband nicht', () => {
		const frei = legeAufmachungFrei(mit, [band]);
		for (const k of zerlege(frei).knoten.filter((k) => hat(k, 'seitenflaeche') || hat(k, 'seitenrahmen'))) {
			assert.match(attribut(k, 'style')?.wert ?? '', /^--a1:#e63946;/);
		}
		// Fläche und Rahmen ersetzt ein neues Rezept wie jede eigene Fläche (114); der Rest bleibt, wie er ist.
		const teile = (q: string) =>
			zerlege(q)
				.knoten.filter((k) => hat(k, 'streuung') || attribut(k, 'data-name')?.wert === 'Kopfband')
				.filter((k) => attribut(k, TEIL) === undefined)
				.map((k) => quelleVon(zerlege(q), k));
		const vorher = teile(frei);
		assert.equal(vorher.length, 2);
		for (const t of vorher) {
			assert.match(t, /--a1:#e63946;--a2:#f77f00;/);
		}
		const danach = wendeAufmachungAn(frei, 'dschungel');
		assert.deepEqual(teile(danach), vorher);
	});

	it('der Titel auf dem Band wird in s/w dunkel, ohne Band bleibt er ohne data-sw', () => {
		const h1 = (q: string) => /<h1[^>]*>/.exec(q)?.[0] ?? '';
		assert.match(h1(legeAufmachungFrei(mit, [band])), /data-sw="dunkel"/);
		assert.doesNotMatch(h1(legeAufmachungFrei(mit, [])), /data-sw/);
		const css = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');
		assert.ok(css.includes('body.sw [data-sw="dunkel"]{color:var(--dunkel) !important}'));
	});

	it('das Kopfband wird ein Pfad mit Verlauf a1 → a2, in s/w weg', () => {
		const frei = legeAufmachungFrei(mit, [band]);
		const svg = /<svg class="form" data-form="pfad" data-name="Kopfband"[^>]*>[\s\S]*?<\/svg>/.exec(frei)?.[0] ?? '';
		assert.match(svg, /data-sw="weg"/);
		assert.match(svg, /stop-color:var\(--a1\)[\s\S]*stop-color:var\(--a2\)/);
		assert.ok(svg.includes(band.d));
	});

	it('kopfbandPfad hat dieselbe Kante wie die Maske in blatt.css', () => {
		const css = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');
		for (const [form, m] of Object.entries(KOPFBAND_MASKEN)) {
			assert.ok(css.includes(`viewBox='0 0 ${m.b} ${m.h}'`), form);
			assert.ok(css.includes(`d='${m.d}'`), form);
		}
		// Eine Kachel der Welle in Originalgröße ist genau der Pfad der Maske, nur ab der Kante versetzt.
		assert.equal(kopfbandPfad('welle', 120, 24, 24, 120), 'M0 0H120V12C100 0 80 0 60 12C40 24 20 24 0 12Z');
		assert.equal(kopfbandPfad('zacken', 32, 24, 24, 0), 'M0 0H33.6V0L16.8 24L0 0Z');
		assert.equal(kopfbandPfad('gerade', 100, 50, 10, 0), 'M0 0H100V50H0Z');
	});
});

describe('Abgleich nach einem Vorschlag von Claude (123)', () => {
	const mit = wendeAufmachungAn(blattMit(), 'zirkus');
	const streuung = (q: string) =>
		zerlege(q)
			.knoten.filter((k) => attribut(k, TEIL)?.wert === 'streuung')
			.map((k) => quelleVon(zerlege(q), k));

	it('ohne Rezept unverändert, ein abgeglichenes Blatt ebenso', () => {
		assert.equal(gleicheAufmachungAb(blattMit()), blattMit());
		assert.equal(gleicheAufmachungAb(mit), mit);
	});

	it('ein geänderter Wert am body erzeugt passende Teile', () => {
		const geaendert = mit.replace('data-aufmachung-kopfband="welle"', 'data-aufmachung-kopfband="zacken"');
		const ab = gleicheAufmachungAb(geaendert);
		assert.equal(ab, wendeAufmachungAn(blattMit(), 'zirkus', { kopfband: 'zacken' }));
		const saat = mit.replace('data-aufmachung-saat="4711"', 'data-aufmachung-saat="12"');
		assert.notDeepEqual(streuung(gleicheAufmachungAb(saat)), streuung(mit));
	});

	it('ein von Hand geändertes Teil wird zurückgesetzt', () => {
		const z = zerlege(mit);
		const flaeche = z.knoten.find((k) => attribut(k, TEIL)?.wert === 'flaeche');
		assert.ok(flaeche);
		const angefasst = mit.slice(0, flaeche.start) + mit.slice(flaeche.start).replace('style="', 'style="opacity:0.2;');
		assert.notEqual(angefasst, mit);
		assert.equal(gleicheAufmachungAb(angefasst), mit);
	});

	it('ein erfundenes Rezept und das Minibuch bleiben unverändert', () => {
		const erfunden = mit.replace('data-aufmachung="zirkus"', 'data-aufmachung="piraten"');
		assert.equal(gleicheAufmachungAb(erfunden), erfunden);
		const mini = readFileSync(path.join(ASSETS, 'vorlage-minibuch.html'), 'utf8').replace('<body', '<body data-aufmachung="zirkus"');
		assert.ok(leseAufmachung(mini));
		assert.equal(gleicheAufmachungAb(mini), mini);
	});
});
