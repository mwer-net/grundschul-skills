import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { Antworten } from './assistent';
import {
	AUFTRAG_ZEICHEN,
	auftragAus,
	auftragSaetze,
	bausteinSchalter,
	EINHEIT_BESTANDTEILE,
	einheitAngabenAus,
	einheitBestandteile,
	einheitRahmen,
	formatOptionen,
	formatWahl,
	FREITEXT,
	FUNKTIONEN,
	leereAntworten,
	leereEinheit,
	LERNGRUPPE,
	pruefeAntworten,
	pruefeAuftragText,
	schritteFuer,
	titelVorschlag,
	WEGE,
} from './assistent';
import { einheitAuftragAus, pruefeEinheitAngaben } from './einheit';
import { SchoolboxFehler } from './fehler';
import { WURZEL } from './konfig';
import { MAX_NAME } from './ordner';
import { ART_ANGABEN, ART_FORMATE, ARTEN } from './werte';

const RUECKFRAGEN = readFileSync(path.join(WURZEL, 'skills/grundschul-didaktik/references/rueckfragen.md'), 'utf8');

const mit = (teil: Partial<Antworten>): Antworten => ({
	...leereAntworten({ fach: 'mathematik', klasse: 2 }),
	...teil,
});

const ids = (a: Antworten) => schritteFuer(a).map((s) => s.id);

describe('Assistent: Schritte (131)', () => {
	it('Schrittfolge je Art in beiden Wegen', () => {
		const voll = ['start', 'art', 'format', 'fuerWen', 'thema', 'bausteine', 'klasse', 'pruefen'];
		const ohne = (...weg: string[]) => voll.filter((s) => !weg.includes(s));
		const erwartet: Record<string, Record<string, string[]>> = {
			claude: {
				arbeitsblatt: voll,
				lesetext: voll,
				lernzielkontrolle: voll,
				klassenarbeit: voll,
				lernspiel: voll,
				stationen: voll,
				karten: ohne('bausteine'),
				lernplakat: ohne('bausteine'),
				praesentation: ohne('format'),
				unterrichtsplanung: ohne('format', 'bausteine'),
				sonstiges: ohne('bausteine'),
			},
			leer: {
				arbeitsblatt: ['start', 'art', 'format', 'titel'],
				lesetext: ['start', 'art', 'format', 'titel'],
				lernzielkontrolle: ['start', 'art', 'format', 'titel'],
				klassenarbeit: ['start', 'art', 'format', 'titel'],
				lernspiel: ['start', 'art', 'format', 'titel'],
				stationen: ['start', 'art', 'format', 'titel'],
				karten: ['start', 'art', 'format', 'titel'],
				lernplakat: ['start', 'art', 'titel'],
				praesentation: ['start', 'art', 'titel'],
				unterrichtsplanung: ['start', 'art', 'titel'],
				sonstiges: ['start', 'art', 'titel'],
			},
		};
		for (const weg of WEGE) {
			for (const art of ARTEN) {
				assert.deepEqual(ids(mit({ weg, art })), erwartet[weg]?.[art], `${weg} ${art}`);
			}
		}
	});

	it('Pflicht: Thema mit Claude, Titel beim leeren Blatt; „Deine Klasse“ ist optional', () => {
		const schritt = (a: Antworten, id: string) => schritteFuer(a).find((s) => s.id === id);
		assert.match(schritt(mit({}), 'thema')?.fehlt?.(mit({})) ?? '', /worum es geht/);
		assert.equal(schritt(mit({ thema: 'Uhr' }), 'thema')?.fehlt?.(mit({ thema: 'Uhr' })), null);
		const leer = mit({ weg: 'leer' });
		assert.match(schritt(leer, 'titel')?.fehlt?.(leer) ?? '', /Titel/);
		assert.equal(schritt(mit({}), 'klasse')?.optional, true);
	});

	it('Schrittleiste zeigt die Antworten wie A1', () => {
		const a = mit({ thema: 'Uhrzeit', lerngruppe: ['daz'], sonst: 'Bitte keine Digitaluhren.' });
		const antworten = Object.fromEntries(schritteFuer(a).map((s) => [s.id, s.antwort(a)]));
		assert.deepEqual(antworten, {
			start: 'Mit Claude',
			art: 'Arbeitsblatt',
			format: 'A4 hoch',
			fuerWen: 'Klasse 2 · Mathematik',
			thema: 'Uhrzeit · Übung',
			bausteine: 'Selbsteinschätzung, Niveaus',
			klasse: '2 Angaben',
			pruefen: '',
		});
		assert.equal(
			schritteFuer(mit({ formatText: 'A5 quer' }))[2]?.antwort(mit({ formatText: 'A5 quer' })),
			'Anders: A5 quer',
		);
	});

	it('Titelvorschlag: Thema mit Claude, „Neues …“ beim leeren Blatt', () => {
		assert.equal(titelVorschlag(mit({ thema: 'Uhrzeit' })), 'Uhrzeit');
		assert.equal(titelVorschlag(mit({ weg: 'leer', thema: 'Uhrzeit' })), 'Neues Arbeitsblatt');
		assert.equal(titelVorschlag(mit({ weg: 'leer', art: 'praesentation' })), 'Neue Präsentation');
		assert.equal(titelVorschlag(mit({ art: 'lesetext' })), 'Neuer Lesetext');
		assert.equal(FREITEXT.titel.zeichen, MAX_NAME);
	});
});

describe('Assistent: Empfehlungen (131)', () => {
	it('Format: die erste Fassung der Tabelle ist vorgewählt, beim leeren Blatt jedes Format einmal', () => {
		for (const art of ARTEN) {
			assert.equal(formatWahl(mit({ art })).format, ART_ANGABEN[art].format, art);
			const leer = formatOptionen(mit({ weg: 'leer', art })).filter((o) => !o.vorlage);
			assert.deepEqual(
				leer.map((o) => o.format),
				ART_FORMATE[art],
				art,
			);
		}
		assert.deepEqual(
			formatOptionen(mit({ art: 'karten' })).map((o) => o.format),
			['a4-hoch', 'a4-hoch', 'a4-quer', 'folie'],
		);
		assert.equal(formatWahl(mit({ art: 'karten', format: 'Tafelkarten A4 quer' })).format, 'a4-quer');
	});

	it('Mini-Book nur bei Lesetext, mit Gerüst, in beiden Wegen', () => {
		for (const weg of WEGE) {
			for (const art of ARTEN) {
				const mini = formatOptionen(mit({ weg, art })).filter((o) => o.vorlage === 'minibuch');
				assert.equal(mini.length, art === 'lesetext' ? 1 : 0, `${weg} ${art}`);
				assert.ok(mini.every((o) => o.format === 'minibuch' && !o.empfohlen));
			}
		}
	});

	it('Bausteine nach `rueckfragen.md`: ★ folgt den Niveaus, bis man es selbst schaltet', () => {
		const an = (a: Antworten) => Object.fromEntries(bausteinSchalter(a).map((s) => [s.wert, s.an]));
		assert.deepEqual(an(mit({})), { selbsteinschaetzung: true, niveaus: true, sternchen: false });
		assert.deepEqual(an(mit({ bausteine: { niveaus: false } })), {
			selbsteinschaetzung: true,
			niveaus: false,
			sternchen: true,
		});
		assert.deepEqual(an(mit({ bausteine: { niveaus: false, sternchen: false } })).sternchen, false);
		assert.deepEqual(an(mit({ art: 'klassenarbeit' })), { selbsteinschaetzung: true, sternchen: true });
		assert.deepEqual(an(mit({ art: 'lernzielkontrolle' })), { selbsteinschaetzung: true });
		assert.deepEqual(an(mit({ art: 'lernspiel' })), { niveaus: true });
		assert.deepEqual(an(mit({ art: 'karten' })), {});
		assert.equal(bausteinSchalter(mit({ art: 'klassenarbeit' }))[0]?.bedingung, 'vor der Abgabe, nie benotet');
		assert.match(RUECKFRAGEN, /Ja {3}← Empfehlung, wenn Churer „nein" oder nicht gefragt/);
		assert.match(RUECKFRAGEN, /Nein ← Empfehlung, wenn Churer „ja"/);
	});

	it('Funktion und Lerngruppe stehen im Ablauf von `rueckfragen.md`', () => {
		assert.ok(RUECKFRAGEN.includes(`Funktion in der Reihe (${FUNKTIONEN.map((f) => f.name).join(' / ')})`));
		assert.ok(RUECKFRAGEN.includes('Lerngruppe (Leistungsspanne, DaZ, Förderbedarfe)'));
		assert.equal(LERNGRUPPE.length, 5);
	});
});

describe('Assistent: Freitext (131)', () => {
	it('gibt es nicht bei Klasse und Fach', () => {
		assert.equal('fach' in FREITEXT || 'klasse' in FREITEXT, false);
	});

	it('zählt nur, wo der Schritt ihn anbietet', () => {
		const text = (a: Partial<Antworten>) => auftragAus(mit({ thema: 'Uhr', ...a }));
		assert.match(text({ formatText: 'A5 quer' }), /Format: „A5 quer“ \(angelegt als A4 hoch\)/);
		assert.doesNotMatch(text({ weg: 'leer', formatText: 'A5 quer' }), /A5 quer/);
		assert.doesNotMatch(text({ art: 'praesentation', formatText: 'A5 quer' }), /A5 quer/);
		assert.doesNotMatch(text({ art: 'arbeitsblatt', artText: 'Rätselheft' }), /Rätselheft/);
		assert.doesNotMatch(text({ art: 'karten', bausteineText: 'Rätsel', umfangText: 'drei' }), /Rätsel|drei/);
		assert.match(text({ funktionText: 'Wiederholung' }), /Funktion in der Reihe: „Wiederholung“/);
		assert.match(text({ umfangText: 'drei Seiten' }), /Umfang: „drei Seiten“/);
		assert.match(text({ bausteineText: 'ein Rätsel' }), /Zusätzlich aufs Blatt: „ein Rätsel“/);
	});

	it('steht in der Vorschau als eigener Teil', () => {
		const saetze = auftragSaetze(mit({ thema: 'Uhrzeit', sonst: 'Keine Digitaluhren.' }));
		const frei = saetze.flat().filter((t) => t.art === 'freitext');
		assert.deepEqual(
			frei.map((t) => t.text),
			['Uhrzeit', 'Keine Digitaluhren.'],
		);
	});
});

describe('Assistent: Auftrag (131)', () => {
	it('Beispiel aus A1 S. 9', () => {
		const a = mit({
			thema: 'Uhrzeit: volle und halbe Stunden',
			lerngruppe: ['leistungsspanne', 'daz'],
			sonst: 'Bitte keine Digitaluhren. Willi darf bei Aufgabe 1 einen Tipp geben.',
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle ein Arbeitsblatt für Mathematik, Klasse 2, Format A4 hoch, eine Seite.',
				'Thema: „Uhrzeit: volle und halbe Stunden“. Formuliere das Ich-kann-Ziel selbst. Das Material dient zum Üben.',
				'Mit Selbsteinschätzung und drei Niveaus zur Wahl, ohne Sternchenaufgabe.',
				'Lerngruppe: große Leistungsspanne, Kinder mit Deutsch als Zweitsprache.',
				'Außerdem: „Bitte keine Digitaluhren. Willi darf bei Aufgabe 1 einen Tipp geben.“',
			].join('\n'),
		);
	});

	it('Präsentation ohne Niveaus: ★ springt auf an', () => {
		const a = mit({
			art: 'praesentation',
			fach: 'englisch',
			klasse: 3,
			thema: 'Colours',
			funktion: 'einfuehrung',
			bausteine: { niveaus: false },
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle eine Präsentation für Englisch, Klasse 3, Format Folien 16:9 für Beamer, Smartboard oder Display.',
				'Thema: „Colours“. Formuliere das Ich-kann-Ziel selbst. Das Material dient zur Einführung.',
				'Mit Selbsteinschätzung und Sternchenaufgabe, ohne Niveaus.',
			].join('\n'),
		);
	});

	it('Etwas anderes mit Freitext überall', () => {
		const a = mit({
			art: 'sonstiges',
			artText: 'Rätselheft',
			formatText: 'A5 quer',
			fach: 'deutsch',
			klasse: 'gemischt',
			thema: 'Tiere im Winter',
			ziel: 'Ich kann Tierspuren erkennen',
			funktionText: 'Wiederholung',
			lerngruppe: ['lrs'],
		});
		assert.equal(
			auftragAus(a),
			[
				'Erstelle dieses Material: „Rätselheft“ für Deutsch, jahrgangsgemischt, Format: „A5 quer“ (angelegt als A4 hoch).',
				'Thema: „Tiere im Winter“. Ich-kann-Ziel: „Ich kann Tierspuren erkennen“. Funktion in der Reihe: „Wiederholung“.',
				'Lerngruppe: Kinder mit Lese-Rechtschreib-Schwierigkeiten.',
			].join('\n'),
		);
	});

	it('Längengrenze: alle Freitexte voll passen, längere lehnt der Kern ab', () => {
		const voll = Object.fromEntries(
			Object.entries(FREITEXT).map(([feld, { zeichen }]) => [feld, 'x'.repeat(zeichen)]),
		) as Partial<Antworten>;
		for (const art of ARTEN) {
			const a = mit({ ...voll, art, lerngruppe: LERNGRUPPE.map((l) => l.wert), umfang: '2' });
			assert.ok(auftragAus(a).length <= AUFTRAG_ZEICHEN, art);
			assert.deepEqual(pruefeAntworten(a, a), a);
		}
		assert.throws(
			() => pruefeAntworten({ sonst: 'x'.repeat(FREITEXT.sonst.zeichen + 1) }, mit({})),
			/höchstens 1000 Zeichen/,
		);
		assert.throws(() => pruefeAuftragText('x'.repeat(AUFTRAG_ZEICHEN + 1)), /höchstens/);
		assert.throws(() => pruefeAuftragText('  '), /leer/);
		assert.equal(pruefeAuftragText('  Mach ein Blatt. '), 'Mach ein Blatt.');
	});
});

describe('Assistent: Antworten prüfen (131)', () => {
	const fehler = (roh: unknown) => () => pruefeAntworten(roh, { fach: 'deutsch', klasse: 1 });

	it('füllt Fehlendes mit der Vorbelegung, die Empfehlung gilt', () => {
		const a = pruefeAntworten({ thema: 'Igel' }, { fach: 'sachunterricht', klasse: 3 });
		assert.deepEqual(a, { ...leereAntworten({ fach: 'sachunterricht', klasse: 3 }), thema: 'Igel' });
	});

	it('lehnt Unbekanntes ab', () => {
		for (const roh of [
			null,
			[],
			'Text',
			{ boese: 1 },
			{ art: 'quiz' },
			{ weg: 'chat' },
			{ format: 'A2 hoch' },
			{ art: 'praesentation', format: 'A4 hoch' },
			{ format: 3 },
			{ fach: 'mathe' },
			{ klasse: '2' },
			{ funktion: 'wiederholung' },
			{ umfang: '3' },
			{ bausteine: { glitzer: true } },
			{ bausteine: { niveaus: 'ja' } },
			{ bausteine: [] },
			{ lerngruppe: 'daz' },
			{ lerngruppe: ['hochbegabt'] },
			{ thema: 42 },
		]) {
			assert.throws(fehler(roh), SchoolboxFehler, JSON.stringify(roh));
		}
	});

	it('nimmt gültige Werte und doppelte Lerngruppen nur einmal', () => {
		const a = pruefeAntworten(
			{
				art: 'karten',
				format: 'Tafelkarten A4 quer',
				funktion: 'vertiefung',
				umfang: 'claude',
				lerngruppe: ['daz', 'daz'],
				bausteine: { sternchen: true },
			},
			{ fach: 'englisch', klasse: 4 },
		);
		assert.equal(a.format, 'Tafelkarten A4 quer');
		assert.deepEqual(a.lerngruppe, ['daz']);
		assert.deepEqual(a.bausteine, { sternchen: true });
		assert.equal(a.funktion, 'vertiefung');
	});
});

describe('Assistent: Unterrichtseinheit (140)', () => {
	const einheit = (teil: Partial<Antworten> = {}) =>
		mit({ weg: 'claude', einheit: true, art: 'arbeitsblatt', thema: 'Uhrzeit', ...teil });

	it('eigene Schrittfolge nur im Weg Claude', () => {
		assert.deepEqual(ids(einheit()), [
			'start',
			'art',
			'fuerWen',
			'eThema',
			'eUmfang',
			'eBestandteile',
			'eRahmen',
			'bausteine',
			'klasse',
			'pruefen',
		]);
		assert.ok(!ids(einheit({ weg: 'leer' })).some((id) => id.startsWith('e')));
		assert.ok(!ids(mit({ weg: 'claude' })).some((id) => id.startsWith('e')));
	});

	it('Empfehlungen: fünf Bestandteile vorgewählt, Rahmen nur in Klasse 1 und 2', () => {
		assert.deepEqual(
			einheitBestandteile(leereEinheit()),
			EINHEIT_BESTANDTEILE.filter((b) => b.empfohlen).map((b) => b.name),
		);
		assert.equal(einheitBestandteile(leereEinheit()).length, 5);
		assert.equal(einheitRahmen(leereEinheit(), 1), true);
		assert.equal(einheitRahmen(leereEinheit(), 2), true);
		assert.equal(einheitRahmen(leereEinheit(), 3), false);
		assert.equal(einheitRahmen({ ...leereEinheit(), rahmen: true }, 4), true);
	});

	it('nur mit Thema und sonst Empfehlungen: Angaben gehen durch die Prüfung des Servers', () => {
		const angaben = pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Uhrzeit' })));
		assert.equal(angaben.thema, 'Uhrzeit');
		assert.equal(angaben.dauer, '2 Wochen');
		assert.equal(angaben.rahmen, true);
		assert.equal(angaben.bilder, true);
	});

	it('Bestandteile, Freitext und „Anders …“ stehen im Auftrag', () => {
		const eh = {
			...leereEinheit(),
			bestandteile: ['Lernspiel', 'Lesetexte'],
			nochEtwas: 'ein Elternbrief',
			dauerText: '5 Wochen',
		};
		const text = einheitAuftragAus(pruefeEinheitAngaben(einheitAngabenAus(einheit({ titel: 'Uhrzeit', eh }))));
		assert.match(text, /Lernspiel/);
		assert.match(text, /Lesetexte/);
		assert.match(text, /ein Elternbrief/);
		assert.match(text, /5 Wochen/);
		assert.doesNotMatch(text, /Lernzielkontrolle/);
	});
});
