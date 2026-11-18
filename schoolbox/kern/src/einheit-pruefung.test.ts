import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { EinheitPlan, PlanDokument } from './einheit';
import type { Steckbrief } from './einheit-bau';
import {
	abbildungenIn,
	blickLektuere,
	blickRegeln,
	figurenDopplungen,
	gepruefteZahl,
	lesePruefung,
	pruefKorrektur,
	pruefText,
	pruefWeise,
	zahlenBefunde,
	zahlenText,
} from './einheit-pruefung';
import { WURZEL } from './konfig';

const dok = (slug: string, art: PlanDokument['art'] = 'arbeitsblatt'): PlanDokument => ({
	slug,
	titel: slug,
	art,
	format: 'a4-hoch',
	zweck: '',
	fertig: false,
});
const brief = (seiten: number, loesungsseiten = 0): Steckbrief => ({
	seiten,
	loesungsseiten,
	formate: [],
	figuren: [],
	loesung: '',
	merken: '',
});
const GITTER = '<x-gitter art="geobrett" spalten="6" zeilen="4" linien="3,0 0,2 3,4" achse="senkrecht"></x-gitter>';

describe('Antwort des Prüflaufs (220, Teil 2)', () => {
	it('liest den letzten JSON-Block, normalisiert die Art und säubert den Text', () => {
		const antwort = [
			'Erst ein Entwurf:',
			'```json\n{"befunde": [{"seite": 9, "art": "unklar", "text": "alt"}]}\n```',
			'Endgültig:',
			'```json\n{"befunde": [{"seite": "2", "aufgabe": 3, "art": "Zu schwer", "text": "Zahlenraum <b>bis 1000</b>."}, {"art": "Fehlendes Material", "text": "Ein Spiegel fehlt."}, {"art": "lob", "text": "Schön."}]}\n```',
		].join('\n');
		const { befunde, lesbar } = lesePruefung(antwort);
		assert.equal(lesbar, true);
		assert.deepEqual(befunde, [
			{ seite: 2, aufgabe: '3', art: 'zu-schwer', text: 'Zahlenraum bbis 1000/b.' },
			{ seite: null, aufgabe: '', art: 'fehlt', text: 'Ein Spiegel fehlt.' },
		]);
	});

	it('nimmt auch „offen“, ein bloßes Array und JSON ohne Block; doppelte Befunde einmal, höchstens 15', () => {
		assert.equal(
			lesePruefung('{"offen": [{"material": "deckblatt", "art": "zahlen", "text": "12 Seiten"}]}').befunde[0]
				?.material,
			'deckblatt',
		);
		assert.equal(lesePruefung('```\n[{"art": "dopplung", "text": "wie eben"}]\n```').befunde[0]?.art, 'dopplung');
		const viele = Array.from({ length: 30 }, (_, i) => ({ art: 'unklar', text: `Befund ${i % 20}` }));
		assert.equal(lesePruefung(JSON.stringify({ befunde: viele })).befunde.length, 15);
		const zwei = [
			{ art: 'unklar', text: 'gleich' },
			{ art: 'unklar', text: 'gleich' },
		];
		assert.equal(lesePruefung(JSON.stringify({ befunde: zwei })).befunde.length, 1);
	});

	it('ersetzt Steuerzeichen und Unsichtbares im Text durch Leerzeichen, anderes bleibt', () => {
		const roh = 'a\u0000b\u001fc\u007fd\u009fe\u200bf\u202eg\u206fh\ufeffi\u00a0j\u2070k\u{1f600}l';
		const befund = lesePruefung(JSON.stringify({ befunde: [{ art: 'unklar', text: roh }] })).befunde[0];
		assert.equal(befund?.text, 'a b c d e f g h i j\u2070k\u{1f600}l');
	});

	it('Unlesbares heißt keine Befunde, mit Vermerk', () => {
		assert.deepEqual(lesePruefung('Alles gut, nichts gefunden.'), { befunde: [], lesbar: false });
		assert.deepEqual(lesePruefung('```json\n{"befunde": [kaputt\n```'), { befunde: [], lesbar: false });
		assert.deepEqual(lesePruefung('{"befunde": []}'), { befunde: [], lesbar: true });
	});

	it('Korrekturrunde nennt Befunde und Meldungen des Servers', () => {
		const text = pruefKorrektur(
			[{ seite: 1, aufgabe: '2', art: 'unklar', text: 'Was zu tun ist, fehlt.' }],
			['Dieselbe Abbildung.'],
		);
		assert.match(text, /^Korrekturrunde nach der Prüfung\./);
		assert.match(text, /- Seite 1, Aufgabe 2, [^:]+: Was zu tun ist, fehlt\./);
		assert.match(text, /Die Schoolbox meldet:\n- Dieselbe Abbildung\./);
		assert.doesNotMatch(text, /Lösung falsch/);
	});

	it('nimmt „loesung“ an; die Korrekturrunde fragt dann, ob Aufgabe oder Lösung falsch ist (229)', () => {
		const { befunde } = lesePruefung(
			'{"befunde": [{"seite": 1, "aufgabe": "2", "art": "loesung", "text": "7 + 8 ist 15, nicht 16."}, {"art": "Lösung fehlt", "text": "Aufgabe 3 hat keine Lösung."}]}',
		);
		assert.deepEqual(
			befunde.map((b) => b.art),
			['loesung', 'loesung'],
		);
		const text = pruefKorrektur(befunde, []);
		assert.match(text, /- Seite 1, Aufgabe 2, Lösung falsch: 7 \+ 8 ist 15, nicht 16\./);
		assert.match(text, /Prüfe, ob die Aufgabe oder die Lösung falsch ist, und ändere das Falsche\./);
	});

	it('zu „bild“ verschiebt die Korrekturrunde keine Figur, sie bearbeitet das Bild oder erzeugt es neu (234)', () => {
		const text = pruefKorrektur([{ seite: 1, aufgabe: '', art: 'bild', text: 'Die Figur schwebt vor der Wand.' }], []);
		assert.match(text, /Eine schwebende oder eingeklebte Figur verschiebst du nicht/);
		assert.match(text, /Bearbeite das Bild mit der Figur darin/);
		assert.doesNotMatch(pruefKorrektur([{ seite: 1, aufgabe: '2', art: 'unklar', text: 'x' }], []), /schwebende/);
	});
});

describe('Nachricht an den Prüflauf (229)', () => {
	const AUFTRAG = {
		titel: 'Uhr',
		artName: 'Arbeitsblatt',
		klasse: 'Klasse 2',
		fach: 'Mathematik',
		seiten: ['seite-1.png'],
		ausschnitte: ['seite-1-aufgabe-1.png'],
		formate: [],
		kind: true,
		regeln: [],
		bilder: [],
		loesungen: [],
	};
	const TEIL_1 = [
		'Prüfung von „Uhr“ (Arbeitsblatt), Klasse 2, Mathematik.',
		'Teil 1, mit Kinderaugen: Löse jede Aufgabe wirklich, so wie ein Kind dieser Klasse sie liest und löst.',
		'Die Seiten liegen in deinem Arbeitsordner. Sieh dir jede mit Read an:\n- seite-1.png',
		'Ausschnitte je Aufgabe, wenn du etwas genauer sehen willst: seite-1-aufgabe-1.png',
	];

	it('ohne Lösungsseiten wörtlich wie vor 229, auch beim zweiten Blick allein', () => {
		assert.equal(pruefText(AUFTRAG), TEIL_1.join('\n\n'));
		assert.equal(
			pruefText({ ...AUFTRAG, kind: false, regeln: ['r.md'], loesungen: ['loesung/loesung-seite-1.png'] }),
			[
				TEIL_1[0],
				'Hier gibt es nichts zu lösen: nur der zweite Blick.',
				TEIL_1[2],
				TEIL_1[3],
				'Teil 2, der zweite Blick. Lies zuerst diese Regeln ganz mit Read:\n- r.md',
			].join('\n\n'),
		);
	});

	it('mit Lösungsseiten nennt sie erst nach den Seiten des ersten Teils', () => {
		const teile = pruefText({ ...AUFTRAG, regeln: ['r.md'], loesungen: ['loesung/loesung-seite-1.png'] }).split(
			'\n\n',
		);
		assert.deepEqual(teile.slice(0, 4), TEIL_1);
		assert.ok(teile.slice(0, 4).every((t) => !t.includes('loesung')));
		assert.match(teile[4] ?? '', /^Lösung nachrechnen, erst nach Teil 1: .*\n- loesung\/loesung-seite-1\.png$/);
		assert.match(teile[5] ?? '', /^Teil 2, der zweite Blick/);
	});
});

describe('Wer geprüft wird und gegen welche Regeln', () => {
	it('Aufgaben mit Kinderaugen, Schauseiten mit dem zweiten Blick, Hinweise gar nicht', () => {
		assert.deepEqual(pruefWeise('arbeitsblatt', false), { kind: true, blick: false });
		assert.deepEqual(pruefWeise('lernspiel', false), { kind: true, blick: true });
		assert.deepEqual(pruefWeise('karten', false), { kind: false, blick: true });
		assert.deepEqual(pruefWeise('hinweise', false), { kind: false, blick: false });
		assert.deepEqual(pruefWeise('hinweise', true), { kind: false, blick: true });
		assert.equal(
			gepruefteZahl([dok('a'), dok('b', 'unterrichtsplanung'), dok('deckblatt'), dok('c', 'karten')]),
			3,
		);
	});

	it('jede Regeldatei des zweiten Blicks existiert; SKILL.md steht im Protokoll als skill:', () => {
		const alle = ['karten', 'lernspiel', 'praesentation', 'lernplakat', 'deckblatt'].flatMap((r) =>
			blickRegeln(r, true),
		);
		assert.deepEqual(
			alle.filter((r) => !existsSync(path.join(WURZEL, 'skills', r))),
			[],
		);
		assert.deepEqual(blickLektuere(['praesentation/SKILL.md', 'a/references/b.md']), [
			'skill:praesentation',
			'a/references/b.md',
		]);
	});
});

describe('Doppelte Abbildungen (220, Punkt 5)', () => {
	it('findet dieselbe Figur in zwei Materialien, unabhängig von Reihenfolge und Aussehen der Attribute', () => {
		const anders =
			'<x-gitter class="gross" achse="senkrecht" linien="3,0  0,2 3,4" zeilen="4" spalten="6" art="geobrett" groesse="2"></x-gitter>';
		const d = figurenDopplungen([
			{ slug: 'kapitel-4', art: 'lesetext', html: `<p>${GITTER}</p>` },
			{ slug: 'station-2', art: 'stationen', html: anders },
			{
				slug: 'blatt',
				art: 'arbeitsblatt',
				html: '<x-gitter art="geobrett" spalten="6" zeilen="4" linien="1,1 2,2"></x-gitter>',
			},
		]);
		assert.equal(d.length, 1);
		assert.deepEqual(d[0]?.slugs, ['kapitel-4', 'station-2']);
		assert.match(d[0]?.figur ?? '', /^<x-gitter .*linien="3,0 0,2 3,4"/);
	});

	it('Gegenprobe: Lösung, Kontrolle, Rahmenelemente und Figuren ohne Inhalt zählen nicht', () => {
		assert.deepEqual(abbildungenIn(`<div class="nur-loesung"><div>${GITTER}</div></div>`).size, 0);
		assert.equal(abbildungenIn('<x-gitter art="geobrett" spalten="6" zeilen="4"></x-gitter>').size, 0);
		assert.equal(abbildungenIn('<x-wortspeicher woerter="Achse, Spiegel"></x-wortspeicher>').size, 0);
		assert.deepEqual(
			figurenDopplungen([
				{ slug: 'blatt', art: 'arbeitsblatt', html: GITTER },
				{ slug: 'lzk', art: 'lernzielkontrolle', html: GITTER },
				{ slug: 'blatt-loesung', art: 'arbeitsblatt', html: GITTER },
			]),
			[],
		);
	});
});

describe('Zahlen auf Deckblatt und Angebot (220, Punkt 4)', () => {
	const plan: EinheitPlan = {
		titel: 'Spiegeln',
		annahmen: [],
		dokumente: [dok('ab-1'), dok('ab-2'), dok('deckblatt'), dok('eduki-angebot')],
	};
	const briefe = { 'ab-1': brief(2, 2), 'ab-2': brief(3, 1), 'deckblatt': brief(1), 'eduki-angebot': brief(1) };
	const mit =
		(deckblatt: string, angebot = '') =>
		(slug: string) => {
			const texte: Record<string, string> = { deckblatt, 'eduki-angebot': angebot };
			const t = texte[slug];
			return t === undefined ? null : `<p>${t}</p>`;
		};

	it('nennt eine Seitenzahl, die keine Zählung ergibt', () => {
		const befunde = zahlenBefunde(plan, briefe, mit('Die Einheit hat 51 Seiten.'));
		assert.equal(befunde.length, 1);
		assert.match(
			befunde[0] ?? '',
			/„deckblatt“ nennt 51 Seiten\. Die Schoolbox zählt 7 Seiten \(mit Lösungen 10\)/,
		);
	});

	it('Gegenprobe: mit und ohne Lösung, ohne Deckblatt und Angebot, Materialien gezählt ohne Rahmen', () => {
		assert.deepEqual(zahlenBefunde(plan, briefe, mit('7 Seiten', '10 Seiten, davon 5 Seiten Aufgaben')), []);
		assert.deepEqual(zahlenBefunde(plan, briefe, mit('8 Seiten · 2 Materialien', '4 Materialien')), []);
		assert.equal(zahlenBefunde(plan, briefe, mit('9 Materialien')).length, 1);
	});

	it('ohne gezählte Seiten keine Seitenbefunde; die Liste für den Schlusslauf nennt die Zahlen', () => {
		assert.deepEqual(zahlenBefunde(plan, { ...briefe, 'ab-2': brief(0) }, mit('51 Seiten')), []);
		const text = zahlenText(plan, briefe);
		assert.match(text, /7/);
		assert.match(text, /ab-2/);
	});
});
