/**
 * Wächter aus 062: Skill-Texte und Daten laufen nicht auseinander. Jeder Wächter hat eine Probe, die zeigt, dass er bei
 * einer absichtlichen Abweichung anschlägt. Sie finden Namen, Zahlen und Listen, keine Widersprüche im Sinn.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import type { AbbildungSchema, Feld, Werte } from './abbildungen';
import {
	ABBILDUNG_SCHEMA,
	attributeVon,
	NUR_ZUR_LAUFZEIT,
	pruefeWerte,
	SKALA_STANDARD,
	zahlStandard,
} from './abbildungen';
import { leseAbbildungsKatalog } from './abbildungen-katalog';
import { browserSkip } from './browsertest';
import { LAUF_MELDUNGEN } from './einheit';
import { ABBILDUNGEN_DATEIEN } from './einheit-bau';
import { ersterSatz, klassenIndex } from './klassen-index';
import { ASSETS, BLATT_PY, SKILL_DIR, WURZEL } from './konfig';
import { MELDUNG_CODES } from './meldungen';
import { abgleichen, ABSCHNITTE, katalogFehler, setzeAbschnitt } from './quellen';
import type { Format } from './werte';
import { ART_ANGABEN, ART_FORMATE, ARTEN, FORMATE, STANDARD_FORMAT, standardFormat, VORLAGE_FORMAT } from './werte';

const SKILLS = path.dirname(SKILL_DIR);
/** Der Katalog der Abbildungen (226): Einstieg und Teil-Dateien, je Datei ihr Text. */
const KATALOG_DATEIEN = new Map(ABBILDUNGEN_DATEIEN.map((d) => [d, readFileSync(path.join(SKILLS, d), 'utf8')]));
const KATALOG = [...KATALOG_DATEIEN.values()].join('\n');
const JS = readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8');
const schemata = Object.entries(ABBILDUNG_SCHEMA) as [string, AbbildungSchema][];
/** Nur für die Tests der Feldtypen im Panel, nie im Material. */
const NUR_FUER_TESTS = new Set(['x-probe']);
const imKatalog = schemata.filter(([tag]) => !NUR_FUER_TESTS.has(tag));

/** Alle Abschnitte, die das Element nennen; ohne Abschnitt mit dem Element in der Überschrift: `null`. */
const abschnittVon = (katalog: string, tag: string) => {
	const teile = katalog.split(/^(?=#{2,3} )/m);
	const nennen = new RegExp(`\\b${tag}\\b`);
	return teile.some((t) => new RegExp(`^### .*\`${tag}\``).test(t))
		? teile.filter((t) => nennen.test(t)).join('\n')
		: null;
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
			},
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
	const fremd = Object.keys(attribute).filter(
		(a) => !bekannt.has(a) && !NUR_ZUR_LAUFZEIT.includes(a) && a !== 'class',
	);
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
				(a) =>
					!NUR_ZUR_LAUFZEIT.includes(a) &&
					a !== 'inhalt' &&
					a !== 'seed' &&
					!new RegExp(`\\b${a}\\b`).test(text),
			);
};

describe('Katalog gegen Schema', () => {
	it('jedes Element hat einen Abschnitt mit allen Attributen', () => {
		const fehlt = imKatalog.flatMap(([tag, s]) => fehlendeAttribute(KATALOG, tag, s).map((a) => `${tag}.${a}`));
		assert.deepEqual(fehlt, []);
	});

	it('jedes Element nennt alle Attribute in der Datei, die es beschreibt (226)', () => {
		const datei = new Map(leseAbbildungsKatalog(SKILLS).map((b) => [b.element, b.datei]));
		const fehlt = imKatalog.flatMap(([tag, s]) =>
			fehlendeAttribute(KATALOG_DATEIEN.get(datei.get(tag) ?? '') ?? '', tag, s).map((a) => `${tag}.${a}`),
		);
		assert.deepEqual(fehlt, []);
	});

	it('die Spalte „Katalog“ in fach-mathematik nennt die Datei des Index (226)', () => {
		const datei = new Map(leseAbbildungsKatalog(SKILLS).map((b) => [b.element, b.datei]));
		const tabellenFehler = (text: string) => {
			const zeilen = [...text.matchAll(/^\| `(x-[a-z0-9-]+)` \|.*\| `([^`|]+)` \|$/gm)];
			assert.ok(zeilen.length >= 30, `nur ${zeilen.length} Zeilen gefunden`);
			return zeilen.flatMap(([, tag = '', spalte = '']) => {
				if (!(tag in ABBILDUNG_SCHEMA)) {
					return [`${tag} steht nicht im Schema`];
				}
				return datei.get(tag) === `html-materialerstellung/references/abbildungen/${spalte}`
					? []
					: [`${tag}: ${spalte} statt ${datei.get(tag) ?? '(keine Datei)'}`];
			});
		};
		const text = readFileSync(path.join(SKILLS, 'fach-mathematik/SKILL.md'), 'utf8');
		assert.deepEqual(tabellenFehler(text), []);
		const umgezogen = text.replace(
			'| `x-uhr` | Zifferblatt mit bzw. ohne Zeiger | `mathe-zahlen.md` |',
			'| `x-uhr` | Zifferblatt | `musik.md` |',
		);
		assert.deepEqual(tabellenFehler(umgezogen), [
			'x-uhr: musik.md statt html-materialerstellung/references/abbildungen/mathe-zahlen.md',
		]);
		assert.deepEqual(tabellenFehler(text.replace('| `x-urne` |', '| `x-urnen` |')), [
			'x-urnen steht nicht im Schema',
		]);
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
		assert.deepEqual(fehlendeAttribute(KATALOG, 'x-gibt-es-nicht', { name: 'Neu', felder: [] }), [
			'(kein Abschnitt)',
		]);
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
		for (const datei of [
			...new Set(ABSCHNITTE.map((a) => a.datei)),
			...ABBILDUNGEN_DATEIEN.map((d) => `skills/${d}`),
			'skills/html-materialerstellung/assets/blatt.css',
			'skills/html-materialerstellung/assets/pruefung.js',
		]) {
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
		writeFileSync(
			css,
			readFileSync(css, 'utf8').replace(
				'body.kl1[data-satz="2"]:not(.folie,.a3-hoch,.lehrkraft){--fs:19px',
				'body.kl1[data-satz="2"]:not(.folie,.a3-hoch,.lehrkraft){--fs:29px',
			),
		);
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

	it('Probe: Eine geänderte Schwelle in pruefung.js schlägt an, Schreiben behebt es', () => {
		const wurzel = kopie('schwelle');
		const js = path.join(wurzel, 'skills/html-materialerstellung/assets/pruefung.js');
		writeFileSync(js, readFileSync(js, 'utf8').replace('FREI_MAX = 90,', 'FREI_MAX = 120,'));
		assert.deepEqual(abgleichen(wurzel, false), [
			'skills/grundschul-didaktik/references/druck-und-platz.md: pruef-schwellen',
		]);
		abgleichen(wurzel, true);
		assert.match(
			readFileSync(path.join(wurzel, 'skills/grundschul-didaktik/references/druck-und-platz.md'), 'utf8'),
			/\| `platz-frei` \| WARNUNG, HINWEIS \| mehr als 120 px/,
		);
	});

	it('Probe: Eine Schwelle des älteren Satzes schlägt nur in aelterer-satz.md an (228)', () => {
		const wurzel = kopie('aelter');
		const js = path.join(wurzel, 'skills/html-materialerstellung/assets/pruefung.js');
		writeFileSync(
			js,
			readFileSync(js, 'utf8').replace('ABSTAND_MIN = satz2 ? 10 : 20', 'ABSTAND_MIN = satz2 ? 10 : 24'),
		);
		assert.deepEqual(abgleichen(wurzel, false), [
			'skills/html-materialerstellung/references/aelterer-satz.md: aelterer-satz-schwellen',
		]);
		abgleichen(wurzel, true);
		assert.match(
			readFileSync(path.join(wurzel, 'skills/html-materialerstellung/references/aelterer-satz.md'), 'utf8'),
			/\| `abstand-knapp` \| WARNUNG \| weniger als 24 px/,
		);
	});

	it('druck-und-platz.md nennt nur die Werte mit data-satz="2", die älteren stehen in aelterer-satz.md (228)', () => {
		const druck = readFileSync(
			path.join(WURZEL, 'skills/grundschul-didaktik/references/druck-und-platz.md'),
			'utf8',
		);
		const aelter = readFileSync(
			path.join(WURZEL, 'skills/html-materialerstellung/references/aelterer-satz.md'),
			'utf8',
		);
		assert.doesNotMatch(druck, /älter|Ältere/);
		assert.match(aelter, /\| Kl\. 2 \| 24 px, Abstand 28 px/);
		assert.match(aelter, /\| `aufgaben-viele` \| WARNUNG \| .*sonst 3\/4\/5\/6 \|/);
	});

	it('pruef-schwellen: Lauf-Meldungen aus LAUF_MELDUNGEN stehen drin, Meldungen ohne Schwelle nicht', () => {
		const text = readFileSync(
			path.join(WURZEL, 'skills/grundschul-didaktik/references/druck-und-platz.md'),
			'utf8',
		);
		const abschnitt = text.split('<!-- erzeugt: pruef-schwellen -->')[1]?.split('<!-- /erzeugt')[0] ?? '';
		for (const [code, stufe] of Object.entries(LAUF_MELDUNGEN)) {
			assert.match(abschnitt, new RegExp(`\\| \`${code}\` \\| ${stufe} \\|`));
		}
		assert.doesNotMatch(abschnitt, /`platzhalter`|`ueberlauf`/);
	});

	it('Probe: Eine neue Meldung ohne Zeile in pruef-schwellen ist ein Fehler', () => {
		const wurzel = kopie('code');
		const js = path.join(wurzel, 'skills/html-materialerstellung/assets/pruefung.js');
		writeFileSync(
			js,
			readFileSync(js, 'utf8').replace('melde("HINWEIS", nr, "platzhalter",', 'melde("HINWEIS", nr, "neu-code",'),
		);
		assert.throws(() => abgleichen(wurzel, false), /neu-code/);
	});

	it('Index der Abbildungen: jedes Element mit seiner Datei, der Text hinter dem Namen oder die Beschriftung', () => {
		const text = readFileSync(path.join(SKILL_DIR, 'references', 'abbildungen.md'), 'utf8');
		const index = text.split('<!-- erzeugt: abbildungen-index -->')[1]?.split('<!-- /erzeugt')[0] ?? '';
		assert.match(
			index,
			/\| `x-zeitspanne` \| Zeitspanne am Zeitstrahl \| `references\/abbildungen\/mathe-groessen-daten\.md` \|/,
		);
		assert.match(index, /\| `x-lueckentext` \| Lückentext \| `references\/abbildungen\.md` \|/);
		assert.match(index, /\| `x-timer` \| Zeitscheibe \| `references\/folien\.md` \|/);
		assert.doesNotMatch(index, /x-probe/);
	});

	it('Probe: Ein Element ohne Überschrift, doppelt oder außerhalb des Schemas ist ein Fehler (226)', () => {
		const schema = Object.keys(ABBILDUNG_SCHEMA);
		const alle = leseAbbildungsKatalog(SKILLS);
		assert.deepEqual(katalogFehler(alle, schema), []);
		const ohne = alle.filter((b) => b.element !== 'x-gitter');
		assert.deepEqual(katalogFehler(ohne, schema), ['x-gitter ist in keiner Datei des Katalogs beschrieben.']);
		const doppelt = [...alle, { element: 'x-gitter', wofuer: '', datei: 'b.md' }];
		assert.match(
			katalogFehler(doppelt, schema).join(),
			/x-gitter ist mehrfach beschrieben: .*mathe-geometrie\.md, b\.md/,
		);
		assert.deepEqual(katalogFehler([...alle, { element: 'x-neu', wofuer: '', datei: 'b.md' }], schema), [
			'x-neu steht nicht im Schema.',
		]);
		const wurzel = kopie('index');
		const geometrie = path.join(wurzel, 'skills/html-materialerstellung/references/abbildungen/mathe-geometrie.md');
		writeFileSync(
			geometrie,
			readFileSync(geometrie, 'utf8').replace('### `x-gitter`:', '### Gitter mit `x-gitter`:'),
		);
		assert.throws(() => abgleichen(wurzel, false), /x-gitter ist in keiner Datei/);
	});

	it('Probe: Eine neue Überschrift in einer Teil-Datei schlägt im Index an, Schreiben behebt es (226)', () => {
		const wurzel = kopie('index-neu');
		const geometrie = path.join(wurzel, 'skills/html-materialerstellung/references/abbildungen/mathe-geometrie.md');
		writeFileSync(
			geometrie,
			readFileSync(geometrie, 'utf8').replace('### `x-figur`: Ebene Figur', '### `x-figur`: Vieleck'),
		);
		assert.deepEqual(abgleichen(wurzel, false), [
			'skills/html-materialerstellung/references/abbildungen.md: abbildungen-index',
		]);
		abgleichen(wurzel, true);
		assert.match(
			readFileSync(path.join(wurzel, 'skills/html-materialerstellung/references/abbildungen.md'), 'utf8'),
			/\| `x-figur` \| Vieleck \|/,
		);
	});

	it('Probe: Eine fehlende Markierung ist ein Fehler, nicht „aktuell“', () => {
		assert.throws(() => setzeAbschnitt('Text', 'format-je-art', 'x'), /Markierung/);
	});
});

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

describe('Standardwerte: Zeichnung gegen Schema', { skip: browserSkip() }, () => {
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
		const gueltig = gezeichnet().filter(
			(g) => g.fall.anders !== null && !istFehlerbild(g.ohne) && !istFehlerbild(g.anders),
		);
		const geaendert = gueltig.filter((g) => g.ohne !== g.anders);
		assert.ok(gueltig.length >= 120, `nur ${gueltig.length} gültig`);
		assert.ok(
			geaendert.length >= gueltig.length / 2,
			`nur ${geaendert.length} von ${gueltig.length} ändern das Bild`,
		);
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
		assert.deepEqual(JSON.parse(JSON.stringify(runInNewContext(`(${js})`))), SKALA_STANDARD);
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

	it('ART_FORMATE kommt aus den Optionen und ist dieselbe Liste wie vor 131', () => {
		const A4: readonly Format[] = ['a4-hoch', 'a4-quer', 'a5-hoch'];
		assert.deepEqual(ART_FORMATE, {
			arbeitsblatt: A4,
			klassenarbeit: A4,
			lernzielkontrolle: A4,
			lesetext: A4,
			lernspiel: ['a4-hoch', 'a3-hoch'],
			karten: ['a4-hoch', 'a4-quer', 'folie'],
			lernplakat: ['a3-hoch'],
			praesentation: ['folie'],
			stationen: ['a5-hoch', 'a4-quer', 'a4-hoch'],
			unterrichtsplanung: ['a4-hoch'],
			sonstiges: ['a4-hoch'],
		});
		for (const art of ARTEN) {
			const erste = ART_ANGABEN[art].optionen[0];
			assert.equal(erste?.format ?? ART_ANGABEN[art].format, ART_ANGABEN[art].format, art);
		}
	});

	it('das Mini-Book steht als Option beim Lesetext und nur einmal in der Tabelle', () => {
		const mini = ARTEN.filter((art) => ART_ANGABEN[art].optionen.some((o) => o.vorlage === 'minibuch'));
		assert.deepEqual(mini, ['lesetext']);
		const tabelle = readFileSync(path.join(WURZEL, 'skills/grundschul-didaktik/references/rueckfragen.md'), 'utf8');
		assert.equal(tabelle.split('Mini-Book').length - 1, 1);
	});
});

describe('Klassen von blatt.css (252)', () => {
	const KLASSEN_MD = readFileSync(path.join(SKILL_DIR, 'references', 'klassen.md'), 'utf8');
	const imIndex = new Set([...KLASSEN_MD.matchAll(/`\.([\w-]+)`/g)].map((t) => t[1]));
	/** Steht im Muster, hat aber keine Regel: das Muster setzt alles im style. */
	const OHNE_REGEL = new Set(['zellen']);

	it('jede Klasse aus Vorlagen, Beispielen und Mustern steht in klassen.md', () => {
		const dateien = readdirSync(ASSETS, { recursive: true, encoding: 'utf8' }).filter((d) => d.endsWith('.html'));
		assert.ok(dateien.length > 10);
		const fehlt = new Set<string>();
		for (const datei of dateien) {
			const html = readFileSync(path.join(ASSETS, datei), 'utf8')
				.replace(/<svg[\s\S]*?<\/svg>/g, '')
				.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
			for (const [, liste] of html.matchAll(/class="([^"]*)"/g)) {
				for (const k of liste?.split(/\s+/).filter(Boolean) ?? []) {
					if (!imIndex.has(k) && !OHNE_REGEL.has(k)) {
						fehlt.add(`${k} (${datei})`);
					}
				}
			}
		}
		assert.deepEqual([...fehlt], []);
	});

	it('bleibt unter dem Lesen in einem Stück (Ziel unter 6000 Token)', () => {
		assert.ok(KLASSEN_MD.length <= 11_000, `${KLASSEN_MD.length} Zeichen`);
	});

	it('Probe: Klassen nur in einem x-Element fehlen, der erste Satz zählt, ein fehlender Schlüssel scheitert', () => {
		assert.equal(ersterSatz('/* == Satz 2 (212): neu ==\n   data-satz="2" am <body>. Mehr */'), 'Satz 2 (212): neu: data-satz="2" am <body>');
		assert.equal(ersterSatz('/* Bild mit Ebenen. .bild-lagen füllt */'), 'Bild mit Ebenen');
		const probe = [
			'/* Weniger Rand oben und unten. */',
			'/* Schulziffern: 1 ohne Fuß, offene 4, 7 mit Querstrich, wie die Kinder sie schreiben */',
			'/* Schlägt das font-family-Attribut am SVG-Text: Vorlage, Vorbild und Lösung in Schreibschrift */',
			'',
			'/* == Rätsel == */',
			'/* Karten mit Ecke. Mehr dazu in Kl. 2 */',
			'.karte,x-domino .stein{color:red}',
			'x-sortieren .sortier:is(.woerter,.zahlen){gap:1px}',
			'@media print{.karte .ecke{color:blue}}',
		].join('\n');
		const index = klassenIndex(probe);
		assert.doesNotMatch(index, /^#|Rätsel/m);
		assert.match(index, /^- Karten mit Ecke: `\.karte` `\.ecke`$/m);
		assert.doesNotMatch(index, /stein|woerter|zahlen/);
		assert.throws(() => klassenIndex('.a{}'), /hat den Kommentar nicht mehr/);
	});
});
