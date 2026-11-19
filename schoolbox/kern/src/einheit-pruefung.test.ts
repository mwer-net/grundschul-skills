import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { EinheitPlan, PlanDokument } from './einheit';
import type { Steckbrief } from './einheit-bau';
import {
	abbildungenIn,
	befundeDerTeile,
	blickLektuere,
	blickRegeln,
	figurenDopplungen,
	gepruefteZahl,
	lesePruefung,
	pruefKorrektur,
	pruefTeile,
	pruefText,
	pruefWeise,
	zahlenBefunde,
	zahlenText,
} from './einheit-pruefung';
import { WURZEL } from './konfig';

const dok = (
	slug: string,
	art: PlanDokument['art'] = 'arbeitsblatt',
	format: PlanDokument['format'] = 'a4-hoch',
): PlanDokument => ({
	slug,
	titel: slug,
	art,
	format,
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
		const text = pruefKorrektur(
			[{ seite: 1, aufgabe: '', art: 'bild', text: 'Die Figur schwebt vor der Wand.' }],
			[],
		);
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

	it('ohne Auftrag, Figuren und Teile bleibt die Nachricht Byte für Byte wie vor 241', () => {
		assert.equal(pruefText({ ...AUFTRAG, figuren: [] }), TEIL_1.join('\n\n'));
		assert.deepEqual(pruefTeile(AUFTRAG), [AUFTRAG]);
	});

	it('nennt den Auftrag der Lehrkraft und die Figuren des Plans vor Teil 1 (241)', () => {
		const auftrag = 'Erstelle eine Unterrichtseinheit „Spiegeln“.\nLeitfigur: Luna.';
		const teile = pruefText({ ...AUFTRAG, auftrag, figuren: ['Luna, die Eule', 'Ella'] }).split('\n\n');
		assert.equal(teile[0], TEIL_1[0]);
		assert.equal(teile[1], `Auftrag der Lehrkraft (aus dem Assistenten):\n${auftrag}`);
		assert.equal(teile[2], 'Figuren der Geschichte laut Plan: Luna, die Eule · Ella');
		assert.deepEqual(teile.slice(3), TEIL_1.slice(1));
	});

	describe('lange Materialien in getrennten Läufen (241)', () => {
		const seiten = Array.from({ length: 30 }, (_, i) => `seite-${i + 1}.png`);
		const ausschnitte = seiten.flatMap((_, i) => [`seite-${i + 1}-aufgabe-1.png`, `seite-${i + 1}-aufgabe-2.png`]);
		const loesungen = Array.from({ length: 31 }, (_, i) => `loesung/loesung-seite-${i + 1}.png`);
		const lang = { ...AUFTRAG, seiten, ausschnitte, loesungen, auftrag: 'Leitfigur: Luna.' };

		it('30 Seiten ergeben zwei Läufe mit allen 30 Seiten und dem Satz zum anderen Teil', () => {
			const teile = pruefTeile(lang);
			assert.equal(teile.length, 2);
			assert.deepEqual(
				teile.flatMap((t) => t.seiten),
				seiten,
			);
			assert.deepEqual(
				teile.map((t) => t.seiten.length),
				[16, 14],
			);
			const [eins, zwei] = teile.map(pruefText);
			assert.match(
				zwei ?? '',
				/Prüflauf 2 von 2: Das Material hat 30 Seiten, du prüfst die Seiten 17–30\. Die Seiten 1–16 prüft ein anderer Lauf: Melde nichts als fehlend, was dort stehen kann/,
			);
			assert.match(eins ?? '', /Prüflauf 1 von 2: .*die Seiten 1–16\. Die Seiten 17–30 prüft ein anderer Lauf/);
			assert.match(eins ?? '', /- seite-16\.png$/m);
			assert.doesNotMatch(eins ?? '', /- seite-17\.png/);
			assert.match(zwei ?? '', /- seite-30\.png$/m);
			for (const t of [eins, zwei]) {
				assert.match(t ?? '', /Auftrag der Lehrkraft \(aus dem Assistenten\):\nLeitfigur: Luna\./);
			}
		});

		it('Ausschnitte und Lösungsseiten gehen zum Teil ihrer Seite, Ausschnitte gekappt mit Hinweis', () => {
			const [eins, zwei] = pruefTeile(lang);
			assert.deepEqual(eins?.loesungen, loesungen.slice(0, 16));
			assert.deepEqual(zwei?.loesungen, loesungen.slice(16));
			assert.equal(eins?.ausschnitte.length, 32);
			assert.ok(zwei?.ausschnitte.every((a) => Number(/seite-(\d+)/.exec(a)?.[1]) >= 17));
			const text = pruefText({ ...AUFTRAG, ausschnitte });
			assert.match(text, /seite-20-aufgabe-2\.png; weitere Ausschnitte im Ordner$/m);
			assert.doesNotMatch(text, /seite-21-aufgabe-1\.png/);
			assert.doesNotMatch(pruefText(eins ?? AUFTRAG), /weitere Ausschnitte/);
		});

		it('drei Teile: der mittlere nennt beide anderen Bereiche', () => {
			const viele = Array.from({ length: 40 }, (_, i) => `seite-${i + 1}.png`);
			const teile = pruefTeile({ ...AUFTRAG, seiten: viele });
			assert.equal(teile.length, 3);
			assert.match(
				pruefText(teile[1] ?? AUFTRAG),
				/du prüfst die Seiten 17–32\. Die Seiten 1–16 und 33–40 prüfen andere Läufe/,
			);
		});

		it('24 Seiten bleiben ein Lauf, alle Seiten genannt', () => {
			const vier = Array.from({ length: 24 }, (_, i) => `seite-${i + 1}.png`);
			const teile = pruefTeile({ ...AUFTRAG, seiten: vier });
			assert.equal(teile.length, 1);
			assert.match(pruefText(teile[0] ?? AUFTRAG), /- seite-24\.png/);
			assert.doesNotMatch(pruefText(teile[0] ?? AUFTRAG), /Prüflauf 1 von/);
		});

		it('Befunde der Teile zusammen, Doppelte einmal', () => {
			const b = { seite: null, aufgabe: '', art: 'fehlt' as const, text: 'Ein Spiegel fehlt.' };
			const c = { seite: 20, aufgabe: '1', art: 'unklar' as const, text: 'x' };
			assert.deepEqual(befundeDerTeile([[b], [b, c]]), [b, c]);
		});
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

	it('Folien zählen getrennt: 72 Seiten A4, 30 Folien, 2 Seiten Angebot (241)', () => {
		const paket: EinheitPlan = {
			titel: 'Achsensymmetrie',
			annahmen: [],
			dokumente: [
				dok('deckblatt'),
				dok('auftakt', 'praesentation', 'folie'),
				dok('ab-1'),
				dok('ab-2'),
				dok('eduki-angebot'),
			],
		};
		const zaehlung = {
			'deckblatt': brief(1),
			'auftakt': brief(30),
			'ab-1': brief(40, 4),
			'ab-2': brief(31, 3),
			'eduki-angebot': brief(2),
		};
		const angebot = (t: string) => (slug: string) => (slug === 'eduki-angebot' ? `<p>${t}</p>` : null);
		const befunde = (t: string) => zahlenBefunde(paket, zaehlung, angebot(t));
		assert.deepEqual(befunde('Das steckt drin: 72 Seiten'), []);
		assert.deepEqual(befunde('30 Folien zum Auftakt'), []);
		assert.deepEqual(befunde('72 Seiten und 30 Folien'), []);
		assert.deepEqual(befunde('104 Seiten im PDF'), []);
		const falsch = befunde('51 Seiten');
		assert.equal(falsch.length, 1);
		assert.match(falsch[0] ?? '', /nennt 51 Seiten\. Die Schoolbox zählt 74 Seiten A4 und 30 Folien \(mit Lösungen 81 Seiten A4 und 30 Folien\)/);
		assert.equal(befunde('31 Folien').length, 1);
		const umgestellt = zahlenBefunde(paket, zaehlung, angebot('72 Seiten'), { auftakt: 'a4-quer' });
		assert.equal(umgestellt.length, 1, 'das Format aus meta.json gilt vor dem des Plans');
		const text = zahlenText(paket, zaehlung);
		assert.match(text, /- Seiten A4: 74 gesamt, dazu 7 Lösungsseiten; ohne Deckblatt, Quellen, Angebot und Hinweise 71\./);
		assert.match(text, /- Folien: 30\. Nenne Seiten und Folien getrennt \(„74 Seiten A4 und 30 Folien“\)/);
		assert.match(text, /„auftakt“ \(dokumente\/auftakt\): 30 Folien/);
	});

	it('ohne gezählte Seiten keine Seitenbefunde; die Liste für den Schlusslauf nennt die Zahlen', () => {
		assert.deepEqual(zahlenBefunde(plan, { ...briefe, 'ab-2': brief(0) }, mit('51 Seiten')), []);
		const text = zahlenText(plan, briefe);
		assert.match(text, /- Seiten: 7 gesamt, dazu 3 Lösungsseiten;/);
		assert.doesNotMatch(text, /Folien/);
		assert.match(text, /ab-2/);
	});
});
