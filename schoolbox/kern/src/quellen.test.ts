/**
 * Wächter aus 062: Skill-Texte und Daten laufen nicht auseinander. Jeder Wächter hat eine Probe, die zeigt, dass er bei
 * einer absichtlichen Abweichung anschlägt. Sie finden Namen, Zahlen und Listen, keine Widersprüche im Sinn.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { AbbildungSchema, Feld, Werte } from './abbildungen';
import { ABBILDUNG_SCHEMA, attributeVon, NUR_ZUR_LAUFZEIT, pruefeWerte, SKALA_STANDARD, zahlStandard } from './abbildungen';
import { ASSETS, BLATT_PY, SKILL_DIR, WURZEL } from './konfig';
import { MELDUNG_CODES } from './meldungen';
import { abgleichen, ABSCHNITTE, setzeAbschnitt } from './quellen';
import { ARTEN, ART_ANGABEN, ART_FORMATE, FORMATE, STANDARD_FORMAT, VORLAGE_FORMAT, standardFormat } from './werte';

const KATALOG = readFileSync(path.join(SKILL_DIR, 'references', 'abbildungen.md'), 'utf8');
const JS = readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8');
const schemata = Object.entries(ABBILDUNG_SCHEMA) as [string, AbbildungSchema][];
/** Nur für die Tests der Feldtypen im Panel, nie im Material. */
const NUR_FUER_TESTS = new Set(['x-probe']);
const imKatalog = schemata.filter(([tag]) => !NUR_FUER_TESTS.has(tag));

/** Alle Abschnitte, die das Element nennen; ohne Abschnitt mit dem Element in der Überschrift: `null`. */
const abschnittVon = (katalog: string, tag: string) => {
	const teile = katalog.split(/^(?=#{2,3} )/m);
	const nennen = new RegExp(`\\b${tag}\\b`);
	return teile.some((t) => new RegExp(`^### .*\`${tag}\``).test(t)) ? teile.filter((t) => nennen.test(t)).join('\n') : null;
};

const beispiele = (katalog: string) =>
	[...katalog.matchAll(/```html\n([\s\S]*?)```/g)].flatMap((block) =>
		[...(block[1] ?? '').matchAll(/<(x-[a-z0-9-]+)((?:\s+[a-z0-9-]+(?:="[^"]*")?)*)\s*>([^<]*)/g)].map((t) => ({
			tag: t[1] ?? '',
			attribute: {
				...Object.fromEntries(
					[...(t[2] ?? '').matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/g)].map((a) => [a[1] ?? '', a[2] ?? '']),
				),
				...(t[3]?.trim() ? { inhalt: t[3].trim() } : {}),
			} as Werte,
			text: t[0],
		})),
	);

/** Prüft die Attribute eines Beispiels wie der Editor. Fehlt ein Element im Schema, ist das selbst ein Fehler. */
const beispielFehler = ({ attribute, tag }: { tag: string; attribute: Werte }) => {
	const s = ABBILDUNG_SCHEMA[tag as keyof typeof ABBILDUNG_SCHEMA] as AbbildungSchema | undefined;
	if (!s) {
		return `${tag} steht nicht im Schema`;
	}
	const bekannt = new Set(attributeVon(s));
	const fremd = Object.keys(attribute).filter((a) => !bekannt.has(a) && !NUR_ZUR_LAUFZEIT.includes(a) && a !== 'class');
	if (fremd.length > 0) {
		return `unbekannt: ${fremd.join(', ')}`;
	}
	const leer = Object.fromEntries(attributeVon(s).map((a) => [a, null]));
	const fehler = pruefeWerte(s, { ...leer, ...attribute });
	return Object.keys(fehler).length === 0 ? null : JSON.stringify(fehler);
};

const fehlendeAttribute = (katalog: string, tag: string, s: AbbildungSchema) => {
	const text = abschnittVon(katalog, tag);
	return text === null
		? ['(kein Abschnitt)']
		: attributeVon(s).filter(
				(a) => !NUR_ZUR_LAUFZEIT.includes(a) && a !== 'inhalt' && a !== 'seed' && !new RegExp(`\\b${a}\\b`).test(text),
			);
};

describe('Katalog gegen Schema', () => {
	it('jedes Element hat einen Abschnitt mit allen Attributen', () => {
		const fehlt = imKatalog.flatMap(([tag, s]) => fehlendeAttribute(KATALOG, tag, s).map((a) => `${tag}.${a}`));
		assert.deepEqual(fehlt, []);
	});

	it('jedes Beispiel kennt seine Attribute und besteht die Prüfung', () => {
		const alle = beispiele(KATALOG);
		assert.ok(alle.length >= 100, `nur ${alle.length} Beispiele gefunden`);
		const falsch = alle.flatMap((b) => {
			const fehler = beispielFehler(b);
			return fehler === null ? [] : [`${b.text}: ${fehler}`];
		});
		assert.deepEqual(falsch, []);
	});

	it('Probe: Ein neues Element ohne Abschnitt und ein gekürztes Beispiel schlagen an', () => {
		assert.deepEqual(fehlendeAttribute(KATALOG, 'x-gibt-es-nicht', { name: 'Neu', felder: [] }), ['(kein Abschnitt)']);
		const ohneSchrift = KATALOG.replace(', `schrift` Größe der Zahlen', '').replace(/schrift=/g, 'schrift_=');
		const zahlenstrahl = ABBILDUNG_SCHEMA['x-zahlenstrahl'] as AbbildungSchema;
		assert.ok(fehlendeAttribute(ohneSchrift, 'x-zahlenstrahl', zahlenstrahl).includes('schrift'));
		assert.ok(beispielFehler({ tag: 'x-uhr', attribute: { zeit: '4:99' } }));
		assert.ok(beispielFehler({ tag: 'x-uhr', attribute: { gibtsnicht: '1' } }));
		assert.ok(beispielFehler({ tag: 'x-neu', attribute: {} }));
	});
});

describe('Format je Art', () => {
	it('jede Art hat einen Eintrag, jedes Format gibt es in blatt.css und blatt.py', () => {
		assert.deepEqual(Object.keys(ART_ANGABEN).sort(), [...ARTEN].sort());
		const css = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');
		const py = readFileSync(BLATT_PY, 'utf8');
		for (const format of FORMATE.filter((f) => f !== STANDARD_FORMAT)) {
			assert.ok(css.includes(`body.${format}`), `blatt.css: ${format}`);
			assert.ok(py.includes(`"${format}"`), `blatt.py: ${format}`);
		}
	});

	it('standardFormat liest die Tabelle', () => {
		for (const art of ARTEN) {
			assert.equal(standardFormat(art), ART_ANGABEN[art].format);
		}
		for (const [vorlage, { format }] of Object.entries(VORLAGE_FORMAT)) {
			assert.equal(standardFormat('arbeitsblatt', vorlage), format);
		}
	});
});

describe('Meldungen', () => {
	it('jede ID aus pruefung.js steht in meldungen.ts', () => {
		const js = readFileSync(path.join(ASSETS, 'pruefung.js'), 'utf8');
		const ids = [...js.matchAll(/\bcode:\s*["'`]([a-z0-9-]+)["'`]/g)].map((t) => t[1] ?? '');
		assert.ok(ids.length > 0, 'keine IDs gefunden');
		assert.deepEqual(
			ids.filter((id) => !(MELDUNG_CODES as readonly string[]).includes(id)),
			[],
		);
	});
});

describe('Erzeugte Abschnitte', () => {
	const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-quellen-'));
	after(() => rmSync(ordner, { force: true, recursive: true }));

	const kopie = (name: string) => {
		const ziel = path.join(ordner, name);
		for (const datei of [...new Set(ABSCHNITTE.map((a) => a.datei)), 'skills/html-materialerstellung/assets/blatt.css']) {
			mkdirSync(path.dirname(path.join(ziel, datei)), { recursive: true });
			cpSync(path.join(WURZEL, datei), path.join(ziel, datei));
		}
		return ziel;
	};

	it('sind im Repo aktuell', () => {
		assert.deepEqual(abgleichen(WURZEL, false), []);
	});

	it('Probe: Eine geänderte Zahl in blatt.css schlägt an, Schreiben behebt es', () => {
		const wurzel = kopie('css');
		const css = path.join(wurzel, 'skills/html-materialerstellung/assets/blatt.css');
		writeFileSync(css, readFileSync(css, 'utf8').replace('body.kl1{--fs:28px', 'body.kl1{--fs:29px'));
		assert.deepEqual(abgleichen(wurzel, false), [
			'skills/grundschul-didaktik/references/druck-und-platz.md: schrift-und-abstand',
		]);
		abgleichen(wurzel, true);
		assert.deepEqual(abgleichen(wurzel, false), []);
		assert.match(readFileSync(path.join(wurzel, ABSCHNITTE[2]?.datei ?? ''), 'utf8'), /Kl\. 1 \| 29 px/);
	});

	it('Probe: Eine geänderte Zeile im Skill schlägt an, die Quelle gilt', () => {
		const wurzel = kopie('md');
		const datei = path.join(wurzel, 'skills/grundschul-didaktik/references/rueckfragen.md');
		writeFileSync(datei, readFileSync(datei, 'utf8').replace('**A3**', '**A2**'));
		assert.deepEqual(abgleichen(wurzel, false), [
			'skills/grundschul-didaktik/references/rueckfragen.md: format-je-art',
		]);
		abgleichen(wurzel, true);
		assert.match(readFileSync(datei, 'utf8'), /\*\*A3\*\*/);
	});

	it('Probe: Eine fehlende Markierung ist ein Fehler, nicht „aktuell“', () => {
		assert.throws(() => setzeAbschnitt('Text', 'format-je-art', 'x'), /Markierung/);
	});
});

const hatBrowser = () => {
	try {
		execFileSync('python3', ['-c', 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()', path.dirname(BLATT_PY)], {
			stdio: 'ignore',
		});
		return true;
	} catch {
		return false;
	}
};

interface Fall {
	tag: string;
	attribut: string;
	basis: Werte;
	standard: string;
	/** Ein anderer gültiger Wert: Er muss das Bild ändern, sonst beweist der Vergleich nichts. */
	anders: string | null;
}

/** Ein anderer Wert als der Standard, im Bereich des Feldes. */
const andererWert = (f: Feld, standard: string): string | null => {
	if (f.art === 'zahl') {
		const schritt = f.schritt ?? 1;
		const wert = Number(standard) + schritt <= f.max ? Number(standard) + schritt : Number(standard) - schritt;
		return String(Number(wert.toFixed(4)));
	}
	if (f.art === 'auswahl' || f.art === 'muster') {
		const option = f.optionen.find((o) => o.wert !== null && o.wert !== standard);
		return option?.wert ?? null;
	}
	return null;
};

const standardText = (f: Feld, w: Werte): string | null => {
	if (f.art === 'zahl') {
		return String(zahlStandard(f, w));
	}
	if ((f.art === 'auswahl' || f.art === 'muster') && f.standard !== undefined) {
		return f.standard;
	}
	if (f.art === 'mehrfach' && f.standard) {
		return f.standard.join(' ');
	}
	return null;
};

/** Fälle eines Elements auf festen Grundwerten; ein fester Seed macht gemischte Elemente vergleichbar. */
const faelle = (grundwerte: (tag: string, s: AbbildungSchema) => Werte, schema = imKatalog): Fall[] =>
	schema.flatMap(([tag, s]) => {
		const roh = grundwerte(tag, s);
		const mitSeed = attributeVon(s).includes('seed') ? { seed: '1', ...roh } : roh;
		return s.felder.flatMap((f): Fall[] => {
			const basis = { ...mitSeed };
			delete basis[f.attribut];
			const standard = standardText(f, basis);
			return standard === null
				? []
				: [{ tag, attribut: f.attribut, basis, standard, anders: andererWert(f, standard) }];
		});
	});

/** Grundwerte aus dem ersten gültigen Beispiel des Katalogs. */
const ausBeispiel = (tag: string) =>
	beispiele(KATALOG).find((b) => b.tag === tag && beispielFehler(b) === null)?.attribute ?? {};

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const element = (tag: string, w: Werte) =>
	`<${tag} ${Object.entries(w)
		.filter(([a]) => a !== 'inhalt')
		.map(([a, v]) => `${a}="${esc(v ?? '')}"`)
		.join(' ')}>${w.inhalt ? esc(w.inhalt) : ''}</${tag}>`;

/** Zeichnet je Fall ohne Attribut, mit Standard und mit anderem Wert. Gibt die Fälle mit ihren Zeichnungen zurück. */
const zeichne = (liste: Fall[]) => {
	const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-standard-'));
	try {
		for (const name of ['abbildungen.js', 'blatt.css']) {
			cpSync(path.join(ASSETS, name), path.join(ordner, name));
		}
		const zeilen = liste.map((f) =>
			[
				element(f.tag, f.basis),
				element(f.tag, { ...f.basis, [f.attribut]: f.standard }),
				element(f.tag, f.anders === null ? f.basis : { ...f.basis, [f.attribut]: f.anders }),
			]
				.map((e) => `<div class="z">${e}</div>`)
				.join(''),
		);
		const datei = path.join(ordner, 'blatt.html');
		writeFileSync(
			datei,
			`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="blatt.css"><body class="kl2 sw"><div class="seite">${zeilen.join('\n')}</div>
<script src="abbildungen.js"></script><script>
addEventListener('load', () => setTimeout(() => {
	const pre = document.createElement('pre'); pre.id = 'ergebnis';
	pre.textContent = JSON.stringify([...document.querySelectorAll('.z')].map((z) => z.firstElementChild.innerHTML));
	document.body.appendChild(pre);
}, 200));
</script>`,
		);
		const skript = [
			'import sys, re, html',
			'sys.path.insert(0, sys.argv[1])',
			'import blatt',
			'from pathlib import Path',
			'dom = blatt.chromium(["--dump-dom", "--virtual-time-budget=20000"], Path(sys.argv[2]).resolve().as_uri())',
			'print(html.unescape(re.search(r"<pre id=\\"ergebnis\\">(.*?)</pre>", dom, re.S).group(1)))',
		].join('\n');
		const aus = execFileSync('python3', ['-B', '-c', skript, path.dirname(BLATT_PY), datei], {
			encoding: 'utf8',
			maxBuffer: 256 * 1024 * 1024,
		});
		const bilder = JSON.parse(aus) as string[];
		// Laufende Nummern in Kennungen (Muster, Verläufe) unterscheiden sonst gleiche Bilder
		const bild = (i: number) => (bilder[i] ?? '').replace(/abb-[a-z]+-?\d+/g, 'abb-id');
		return liste.map((fall, i) => ({
			fall,
			ohne: bild(3 * i),
			mit: bild(3 * i + 1),
			anders: bild(3 * i + 2),
		}));
	} finally {
		rmSync(ordner, { force: true, recursive: true });
	}
};

/** Bewusst kein fester Standard in der Zeichnung; das Schema nennt den Startwert für das Panel. */
const OHNE_FESTEN_STANDARD = new Set([
	'x-zeitleiste.schritt', // folgt aus der Spanne von „von“ bis „bis“
	'x-zahlenhaus.dach', // ohne Angabe bleibt das Dach leer
]);

const istFehlerbild = (html: string) => html.includes('abbildung-fehler') || html === '';

describe('Standardwerte: Zeichnung gegen Schema', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	/** Erst das nackte Element: Dort gilt jeder Standard. Was so nicht zeichnet, bekommt die Werte eines Beispiels. */
	const gezeichnet = () => {
		const nackt = zeichne(faelle(() => ({})));
		const schluessel = (f: Fall) => `${f.tag}.${f.attribut}`;
		const offen = new Set(nackt.filter((g) => istFehlerbild(g.ohne)).map((g) => schluessel(g.fall)));
		const nachBeispiel = zeichne(faelle(ausBeispiel).filter((f) => offen.has(schluessel(f))));
		return [...nackt.filter((g) => !istFehlerbild(g.ohne)), ...nachBeispiel];
	};

	it('ohne Attribut sieht jedes Element aus wie mit dem Standardwert aus dem Schema', { timeout: 240_000 }, () => {
		const vergleichbar = gezeichnet().filter((g) => !istFehlerbild(g.ohne) && !istFehlerbild(g.mit));
		assert.ok(vergleichbar.length >= 150, `nur ${vergleichbar.length} gezeichnet`);
		assert.deepEqual(
			vergleichbar
				.filter((g) => g.ohne !== g.mit && !OHNE_FESTEN_STANDARD.has(`${g.fall.tag}.${g.fall.attribut}`))
				.map((g) => `${g.fall.tag}.${g.fall.attribut}=${g.fall.standard}`),
			[],
		);
	});

	it('Gegenprobe: Der Test zeichnet wirklich, und andere Werte ändern das Bild', { timeout: 240_000 }, () => {
		const gueltig = gezeichnet().filter((g) => g.fall.anders !== null && !istFehlerbild(g.ohne) && !istFehlerbild(g.anders));
		const geaendert = gueltig.filter((g) => g.ohne !== g.anders);
		assert.ok(gueltig.length >= 120, `nur ${gueltig.length} gültig`);
		assert.ok(geaendert.length >= gueltig.length / 2, `nur ${geaendert.length} von ${gueltig.length} ändern das Bild`);
		console.log(`Standardwerte: ${geaendert.length} von ${gueltig.length} anderen Werten ändern das Bild`);
	});

	it('Probe: Ein falscher Standardwert im Schema schlägt an', { timeout: 60_000 }, () => {
		const [zeichnung] = zeichne([
			{ tag: 'x-uhr', attribut: 'groesse', basis: { zeit: '4:30' }, standard: '120', anders: null },
		]);
		assert.notEqual(zeichnung?.ohne, zeichnung?.mit);
	});

	it('Messgerät: Von, bis und Teilung folgen Gerät und Einheit wie in abbildungen.js', () => {
		const js = /const SKALA_STANDARD = (\{[\s\S]*?\n {2}\});/.exec(JS)?.[1] ?? '';
		assert.deepEqual(new Function(`return ${js}`)(), SKALA_STANDARD);
		const felder = (ABBILDUNG_SCHEMA['x-skala'] as AbbildungSchema).felder;
		const bis = felder.find((f) => f.attribut === 'bis');
		assert.ok(bis?.art === 'zahl');
		assert.equal(zahlStandard(bis, { art: 'messbecher' }), 500);
		assert.equal(zahlStandard(bis, { art: 'waage', einheit: 'kg' }), 5);
		assert.equal(zahlStandard(bis, {}), 15);
	});
});

describe('Assistent (045)', () => {
	it('die Empfehlung im Assistenten ist das Format aus der Tabelle je Art', () => {
		for (const art of ARTEN) {
			assert.equal(ART_FORMATE[art][0], ART_ANGABEN[art].format, art);
		}
	});
});
