import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { EinheitPlan, PlanDokument } from './einheit';
import { einheitBauDauer } from './einheit';
import type { Steckbrief } from './einheit-bau';
import type { PruefFeld } from './einheit-pruefung';
import {
	abbildungenIn,
	befundeDerTeile,
	berechneteElemente,
	bestandteileText,
	bilderMitBefund,
	BILDPRUEFUNG_ANFANG,
	bildPruefText,
	blickLektuere,
	blickRegeln,
	fachblickStunden,
	fachblickText,
	fachlichOffen,
	figurenDopplungen,
	folgeBefund,
	folienNotizen,
	fremdeGrenze,
	gepruefteZahl,
	istFolgekorrektur,
	leseFolgen,
	lesePruefung,
	PRUEF_GRENZEN,
	PRUEF_VORGABE_ART,
	pruefKorrektur,
	pruefTeile,
	pruefText,
	pruefWeise,
	rollenErgebnis,
	verteileLoesungen,
	vorschauSeiten,
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

	it('ein fachlicher Befund wird an der Sache behoben, andere Materialien kommen unter „folgen“ (243)', () => {
		const text = pruefKorrektur(
			[{ seite: 2, aufgabe: '3', art: 'loesung', text: 'B ist symmetrisch (waagerechte Achse).' }],
			[],
		);
		assert.match(
			text,
			/Ein fachlicher Befund wird an der Sache behoben: Aufgabe, Lösung, Beispiel und Tipp stimmen/,
		);
		assert.match(
			text,
			/\(Hinweise, Vorleseheft, Lernzielkontrolle\), nenne es in deiner Antwort und in steckbrief\.json/,
		);
		assert.match(text, /\{"folgen": \[\{"material": "<slug>", "aussage": /);
		assert.doesNotMatch(pruefKorrektur([{ seite: 1, aufgabe: '', art: 'unklar', text: 'x' }], []), /an der Sache/);
	});

	it('liest „folgen“ nur für fertige andere Materialien, je Aussage einmal (243)', () => {
		const roh = {
			figuren: [],
			folgen: [
				{ material: 'dokumente/hinweise', aussage: '  Dort steht B als   nicht symmetrisch. ' },
				{ material: 'hinweise', aussage: 'Dort steht B als nicht symmetrisch.' },
				{ material: 'kapitel-5', aussage: 'eigenes Material' },
				{ material: 'gibt-es-nicht', aussage: 'x' },
				{ material: 'vorleseheft', aussage: '' },
				'kaputt',
			],
		};
		assert.deepEqual(leseFolgen(roh, ['hinweise', 'kapitel-5', 'vorleseheft'], 'kapitel-5'), [
			{ material: 'hinweise', aussage: 'Dort steht B als nicht symmetrisch.' },
		]);
		assert.deepEqual(leseFolgen(null, ['hinweise'], 'x'), []);
		const t = folgeBefund('kapitel-5', 'Buchstaben', 'B steht als nicht symmetrisch.');
		assert.equal(t, 'Folgekorrektur aus dokumente/kapitel-5 („Buchstaben“): B steht als nicht symmetrisch.');
		assert.equal(istFolgekorrektur(t), true);
		assert.equal(istFolgekorrektur('Die Übernahme ist gescheitert.'), false);
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

	describe('schon geprüfte Bilder (248)', () => {
		const BILD = {
			datei: 'fall-1.jpg',
			motiv: 'Luna am Fenster',
			vertrag: '{"vertrag":{}}',
			pruefbilder: ['bilder/fall-1-v1.png', 'bilder/fall-1-platz.png'],
		};
		it('ein neues Bild wie vor 248, ein geprüftes nur mit Ausschnitt und der Frage nach dem Text', () => {
			const neu = pruefText({ ...AUFTRAG, regeln: ['r.md'], bilder: [{ ...BILD, kennung: 'abc' }] });
			assert.match(
				neu,
				/- fall-1\.jpg: Luna am Fenster\. Vertrag: \{"vertrag":\{\}\}\. Prüfbilder: bilder\/fall-1-v1\.png, bilder\/fall-1-platz\.png(\n|$)/,
			);
			const alt = pruefText({
				...AUFTRAG,
				regeln: ['r.md'],
				bilder: [{ ...BILD, pruefbilder: ['bilder/fall-1-platz.png'], geprueft: true }],
			});
			assert.match(
				alt,
				/- fall-1\.jpg: Luna am Fenster\. Schon in Vierteln gegen diesen Vertrag geprüft: Prüfe nur, ob es zum Text dieses Materials passt\. Ausschnitt: bilder\/fall-1-platz\.png\./,
			);
		});
		it('Befund mit Feld bild; bilderMitBefund ordnet zu, Unzuordenbares zählt für alle', () => {
			const [befund] = lesePruefung(
				JSON.stringify({
					befunde: [{ art: 'bild', bild: 'folie-3-1.jpg', aufgabe: '', text: 'Spiegel aus Glas' }],
				}),
			).befunde;
			assert.equal(befund?.bild, 'folie-3-1.jpg');
			assert.equal(
				lesePruefung('{"befunde":[{"art":"bild","bild":"../x.png","text":"t"}]}').befunde[0]?.bild,
				undefined,
			);
			const zwei = [
				{ ...BILD, datei: 'folie-3-1.jpg' },
				{ ...BILD, datei: 'fall-2.jpg' },
			];
			assert.deepEqual(
				bilderMitBefund(zwei, befund ? [befund] : []).map((b) => b.datei),
				['folie-3-1.jpg'],
			);
			const ohne = { seite: 1, aufgabe: '', art: 'bild' as const, text: 'Ein Bild ist unscharf.' };
			assert.equal(bilderMitBefund(zwei, [ohne]).length, 2);
			assert.equal(
				bilderMitBefund(zwei, [{ ...ohne, art: 'unklar' as const, text: 'Aufgabe 2 unklar' }]).length,
				0,
			);
			assert.deepEqual(
				bilderMitBefund(zwei, [
					{ ...ohne, art: 'kanon' as const, text: 'Auf fall-2 hängt das Glöckchen schon an Ella.' },
				]).map((b) => b.datei),
				['fall-2.jpg'],
			);
		});
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
		const figuren = [
			{ name: 'Luna', rolle: 'Leitfigur, gibt die Tipps', aussehen: 'braune Eule', herkunft: 'neu' as const },
			{ name: 'Pelle', rolle: 'Postbote', aussehen: '', herkunft: 'bibliothek:pelle' as const },
			{ name: '', rolle: '', aussehen: 'Ella, Eichhörnchen mit Glöckchen', herkunft: 'neu' as const },
		];
		const teile = pruefText({ ...AUFTRAG, auftrag, figuren }).split('\n\n');
		assert.equal(teile[0], TEIL_1[0]);
		assert.equal(teile[1], `Auftrag der Lehrkraft (aus dem Assistenten):\n${auftrag}`);
		assert.equal(
			teile[2],
			'Figuren der Geschichte laut Plan: Luna (neu); Leitfigur, gibt die Tipps; Aussehen: braune Eule · Pelle (aus der Bibliothek); Postbote · Ella, Eichhörnchen mit Glöckchen',
		);
		assert.deepEqual(teile.slice(3), TEIL_1.slice(1));
	});

	describe('Maße aus dem Bau (249)', () => {
		const DREI: PruefFeld = { seite: 1, aufgabe: 'A3', art: 'leer', anzahl: 3, breite: 11, hoehe: 24 };
		const FELDER: PruefFeld[] = [
			DREI,
			{ seite: 1, aufgabe: null, art: 'leer', anzahl: 1, breite: 89, hoehe: 66 },
			{
				seite: 1,
				aufgabe: null,
				art: 'teil',
				anzahl: 6,
				breite: 48,
				hoehe: 48,
				motiv: { klein: [6, 16], gross: [17, 18] },
			},
			{
				seite: 1,
				aufgabe: null,
				art: 'teil',
				anzahl: 1,
				breite: 80,
				hoehe: 95,
				motiv: { klein: null, gross: [26, 61] },
			},
			{ seite: 1, aufgabe: 'A4', art: 'linien', anzahl: 1, breite: 140, hoehe: 9 },
			{ seite: 1, aufgabe: 'A5', art: 'linien', anzahl: 3, breite: 160, hoehe: 30, fuer: 'begruendung' },
			{ seite: 2, aufgabe: 'A1', art: 'leer', anzahl: 2, breite: 1, hoehe: 26 },
		];

		it('ohne felder, mit leerer Liste oder nur fremden Seiten Byte für Byte wie vorher', () => {
			assert.equal(pruefText({ ...AUFTRAG, felder: [] }), TEIL_1.join('\n\n'));
			assert.equal(pruefText({ ...AUFTRAG, felder: [{ ...DREI, seite: 2 }] }), TEIL_1.join('\n\n'));
			assert.equal(
				pruefText({ ...AUFTRAG, kind: false, felder: FELDER }),
				pruefText({ ...AUFTRAG, kind: false }),
			);
		});

		it('nennt die Maße der eigenen Seiten in cm nach den Seiten, mit Motiv bei Teilen', () => {
			const teile = pruefText({ ...AUFTRAG, felder: FELDER }).split('\n\n');
			assert.deepEqual(teile.slice(0, 3), TEIL_1.slice(0, 3));
			assert.equal(
				teile[3],
				[
					'Gemessen beim Bau (Breite × Höhe): leere Felder mit Rahmen, Teile zum Ausschneiden und Schreiblinien für Sätze und Begründungen auf deinen Seiten.',
					'- S. 1, A3: drei leere Felder je 1,1 × 2,4 cm',
					'- S. 1: ein leeres Feld 8,9 × 6,6 cm',
					'- S. 1: sechs Teile je 4,8 × 4,8 cm zum Ausschneiden, Motiv 0,6 × 1,6 bis 1,7 × 1,8 cm',
					'- S. 1: ein Teil 8,0 × 9,5 cm zum Ausschneiden, Motiv bis 2,6 × 6,1 cm, manche ohne Motiv',
					'- S. 1, A4: eine Schreiblinie, 14,0 cm breit, zum Begründen oder Erklären',
					'- S. 1, A5: drei Schreiblinien, 16,0 cm breit, für eine Begründung',
				].join('\n'),
			);
			assert.equal(teile[4], TEIL_1[3]);
		});

		it('höchstens zwölf Zeilen, der Rest als Zahl; getrennte Läufe nennen nur ihre Seiten', () => {
			const viele = Array.from({ length: 15 }, (_, i) => ({ ...DREI, aufgabe: `A${i + 1}` }));
			const text = pruefText({ ...AUFTRAG, felder: viele });
			assert.equal((text.match(/^- S\. 1, A\d+: /gm) ?? []).length, 12);
			assert.match(text, /\n- und 3 weitere\n/);
			const seiten = Array.from({ length: 30 }, (_, i) => `seite-${i + 1}.png`);
			const felder = [
				{ ...DREI, seite: 4 },
				{ ...DREI, seite: 20, aufgabe: 'A1' },
			];
			const [eins, zwei] = pruefTeile({ ...AUFTRAG, seiten, ausschnitte: [], felder }).map(pruefText);
			assert.match(eins ?? '', /- S\. 4, A3: /);
			assert.doesNotMatch(eins ?? '', /S\. 20/);
			assert.match(zwei ?? '', /- S\. 20, A1: /);
			assert.doesNotMatch(zwei ?? '', /S\. 4,/);
		});
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

		it('ausgeblendete Seite 2 (256): Seiten nach ihrer Nummer im HTML, gezählt bis zur letzten', () => {
			const ohne2 = seiten.filter((s) => s !== 'seite-2.png');
			const [eins, zwei] = pruefTeile({ ...AUFTRAG, seiten: ohne2 }).map(pruefText);
			assert.match(eins ?? '', /Das Material hat 30 Seiten, du prüfst die Seiten 1–17\. Die Seiten 18–30 prüft/);
			assert.match(zwei ?? '', /du prüfst die Seiten 18–30\. Die Seiten 1–17 prüft/);
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
	it('Aufgaben mit Kinderaugen, Schauseiten mit dem zweiten Blick, Hinweise nur mit dem Fachblick', () => {
		assert.deepEqual(pruefWeise('arbeitsblatt', false), { kind: true, blick: false, fach: true });
		assert.deepEqual(pruefWeise('lernspiel', false), { kind: true, blick: true, fach: true });
		assert.deepEqual(pruefWeise('karten', false), { kind: false, blick: true, fach: true });
		assert.deepEqual(pruefWeise('hinweise', false), { kind: false, blick: false, fach: true });
		assert.deepEqual(pruefWeise('hinweise', true), { kind: false, blick: true, fach: true });
		assert.equal(
			gepruefteZahl([dok('a'), dok('b', 'unterrichtsplanung'), dok('deckblatt'), dok('c', 'karten')]),
			4,
		);
	});

	it('Fachblick für Hinweise, Vorleseheft, Karten und Auftakt, nicht für Deckblatt, Angebot und Quellen (244)', () => {
		for (const rolle of ['hinweise', 'vorleseheft', 'karten', 'praesentation', 'lernzielkontrolle', 'sonstiges']) {
			assert.equal(pruefWeise(rolle, false).fach, true, rolle);
		}
		for (const rolle of ['deckblatt', 'angebot', 'quellen']) {
			assert.equal(pruefWeise(rolle, true).fach, false, rolle);
		}
		assert.equal(gepruefteZahl([dok('vorleseheft', 'lesetext'), dok('quellen'), dok('eduki-angebot')]), 1);
	});

	it('Dauer vor der Freigabe deckt den Lauf vom 2026-11-18 (14 Materialien, 10 geprüft, Bilder, 6,3 h)', () => {
		assert.equal(einheitBauDauer(14, true, 10), 'etwa 6 bis 8 Stunden');
		assert.equal(einheitBauDauer(15, true, 15), 'etwa 8 bis 10 Stunden');
	});

	it('jede Regeldatei des zweiten Blicks existiert; SKILL.md steht im Protokoll als skill:', () => {
		const alle = ['karten', 'lernspiel', 'praesentation', 'lernplakat', 'deckblatt'].flatMap((r) =>
			blickRegeln(r, true),
		);
		assert.deepEqual(
			alle.filter((r) => !existsSync(path.join(WURZEL, 'skills', r))),
			[],
		);
		assert.ok(blickRegeln('lernspiel', false).includes('lernspiel/SKILL.md'), 'Prüffragen zur Spielidee (250)');
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
		assert.match(
			falsch[0] ?? '',
			/nennt 51 Seiten\. Die Schoolbox zählt 74 Seiten A4 und 30 Folien \(mit Lösungen 81 Seiten A4 und 30 Folien\)/,
		);
		assert.equal(befunde('31 Folien').length, 1);
		const umgestellt = zahlenBefunde(paket, zaehlung, angebot('72 Seiten'), { auftakt: 'a4-quer' });
		assert.equal(umgestellt.length, 1, 'das Format aus meta.json gilt vor dem des Plans');
		const text = zahlenText(paket, zaehlung);
		assert.match(
			text,
			/- Seiten A4: 74 gesamt, dazu 7 Lösungsseiten; ohne Deckblatt, Quellen, Angebot und Hinweise 71\./,
		);
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

describe('Verkauf gegen das Paket (250)', () => {
	const plan: EinheitPlan = {
		titel: 'Strom',
		annahmen: [],
		dokumente: [dok('kapitel-1'), dok('auftakt', 'praesentation', 'folie'), dok('quellen', 'sonstiges')],
	};
	const briefe = { 'kapitel-1': brief(3, 2), 'auftakt': brief(12), 'quellen': brief(1) };

	it('Bestandteile: Art, Seiten, Folien, Lösungen und Druckprofil je Dokument, Strichfassungen nur, wo es sie gibt', () => {
		const text = bestandteileText(plan, briefe, {
			profile: { 'kapitel-1': 'farbe', 'auftakt': null },
			bilder: [
				{ datei: 'fall-1.jpg', strich: false },
				{ datei: 'luna.png', strich: true },
			],
		});
		assert.match(text, /„kapitel-1“ \(dokumente\/kapitel-1\): Arbeitsblatt, 3 Seiten, 2 Lösungsseiten, in Farbe/);
		assert.match(text, /„auftakt“ \(dokumente\/auftakt\): Präsentation, 12 Folien, ohne Lösungsseiten$/m);
		assert.match(text, /- Bilder unter bilder\/: 2 Dateien \(fall-1\.jpg, luna\.png\)\./);
		assert.match(text, /Strichfassung für den s\/w-Druck \(`-strich`\) gibt es nur zu: luna\.png\./);
		const ohne = bestandteileText(plan, briefe, { profile: {}, bilder: [{ datei: 'luna.png', strich: false }] });
		assert.match(ohne, /Strichfassungen der Bilder gibt es keine: Nenne keine Strichzeichnungen\./);
		const mitListe = bestandteileText(plan, briefe, {
			profile: {},
			bilder: [{ datei: 'luna.png', strich: true }],
			bildliste: true,
		});
		assert.match(mitListe, /- Bilder: nur nach der Bildliste der Schoolbox/);
		assert.doesNotMatch(mitListe, /bilder\/:|luna\.png|-strich/);
	});

	const seite = (klassen: string, inhalt: string) => `<section class="${klassen}">${inhalt}</section>`;
	const AUFGABE = '<div class="aufgabe" data-min="4"><span class="nr">1</span></div>';

	it('Vorschau: keine Seite mit gelöstem Beispiel oder Rückseiten mit Lösung', () => {
		const html = [
			seite('seite fall', '<h1>Fall</h1>'),
			seite('seite', `${AUFGABE}<div class="zelle beispiel">gelöst</div>`),
			seite('seite', AUFGABE),
			seite('seite', '<div class="karten rueckseiten"><div class="karte rueckseite">7</div></div>'),
			seite('seite nur-loesung', 'Lösung'),
		].join('');
		assert.deepEqual(vorschauSeiten(dok('kapitel-1'), html, [1, 2, 3, 4]), [1, 3]);
	});

	it('Vorschau: Lernzielkontrolle nur Seiten mit Aufgaben, also ohne Fall-Karte und Auflösung', () => {
		const html = [
			seite('seite fall', '<h1>Fall</h1>'),
			seite('seite', AUFGABE),
			seite('seite fall', '<div class="fall-band">Auflösung</div>'),
		].join('');
		assert.deepEqual(vorschauSeiten(dok('kapitel-6', 'lernzielkontrolle'), html, [1, 2, 3]), [2]);
	});

	it('Vorschau: Nummern der Seiten im HTML, auch hinter einer ausgeblendeten Auflösung (256)', () => {
		const html = [
			seite('seite fall', '<h1>Fall</h1>'),
			seite('seite fall aufloesung nur-loesung', '<h1>Auflösung</h1>'),
			seite('seite', AUFGABE),
		].join('');
		assert.deepEqual(vorschauSeiten(dok('kapitel-6', 'lernzielkontrolle'), html, [1, 3]), [3]);
		assert.deepEqual(vorschauSeiten(dok('kapitel-1'), html, [1, 3]), [1, 3]);
		assert.deepEqual(
			vorschauSeiten(dok('kapitel-1'), html, [1, 2]),
			[1, 2],
			'gleich viele Bilder wie sichtbare Seiten: gepaart über die Reihenfolge, beide Seiten erlaubt',
		);
	});

	it('Vorschau: ausgeblendete Seite 1, Bilder nach der Seite im PDF (256): gepaart über die Reihenfolge', () => {
		const html = [
			seite('seite fall aufloesung nur-loesung', '<h1>Auflösung</h1>'),
			seite('seite', `${AUFGABE}<div class="zelle beispiel">gelöst</div>`),
			seite('seite', AUFGABE),
		].join('');
		assert.deepEqual(vorschauSeiten(dok('kapitel-1'), html, [1, 2]), [2]);
	});

	it('Vorschau: Hinweise, Vorleseheft, Rahmen und Lösungsmaterial nie; Zählung passt nicht: alle Seiten', () => {
		const html = seite('seite', AUFGABE);
		assert.deepEqual(vorschauSeiten(dok('hinweise', 'unterrichtsplanung'), html, [1]), []);
		assert.deepEqual(vorschauSeiten(dok('vorleseheft', 'lesetext'), html, [1]), []);
		assert.deepEqual(vorschauSeiten(dok('deckblatt', 'sonstiges'), html, [1]), []);
		assert.deepEqual(vorschauSeiten(dok('kapitel-1-loesung'), html, [1]), []);
		assert.deepEqual(vorschauSeiten(dok('kapitel-1'), html, [1, 2]), [1, 2]);
	});
});

describe('Fachblick (244)', () => {
	it('rollenErgebnis: jede Rolle zählt für sich, gescheitert nur, wenn alle scheitern', () => {
		const b = { seite: 1, aufgabe: '1', art: 'unklar' as const, text: 'Unklar.' };
		const gut = { befunde: [b], lesbar: true, fehler: null };
		const schlecht = { befunde: [], lesbar: true, fehler: 'Die Einheit hat die Zahl der Schritte ausgeschöpft.' };
		const eine = rollenErgebnis([
			{ rolle: 'kind', teile: [gut] },
			{ rolle: 'fach', teile: [schlecht] },
		]);
		assert.deepEqual(eine.befunde, [b]);
		assert.equal(eine.fehler, null);
		assert.equal(eine.luecke, 'Fachblick gescheitert: Die Einheit hat die Zahl der Schritte ausgeschöpft.');
		const alle = rollenErgebnis([
			{ rolle: 'kind', teile: [gut, schlecht] },
			{ rolle: 'fach', teile: [schlecht] },
		]);
		assert.equal(alle.fehler, schlecht.fehler);
		assert.equal(alle.luecke, null);
		assert.deepEqual(alle.befunde, [b]);
		const ohneFach = rollenErgebnis([
			{ rolle: 'kind', teile: [gut] },
			{ rolle: 'fach', teile: [] },
		]);
		assert.deepEqual([ohneFach.fehler, ohneFach.luecke], [null, null]);
	});

	const FACH = {
		titel: 'Kapitel 4',
		artName: 'Arbeitsblatt',
		klasse: 'Klasse 2',
		fach: 'Mathematik',
		seiten: ['seite-1.png', 'seite-2.png'],
		ausschnitte: [],
		loesungen: ['loesung/loesung-seite-1.png'],
		auftrag: 'Erstelle eine Einheit zur Achsensymmetrie.',
		pruefpunkte: 'Fachliche Prüfpunkte aus der Recherche: …\n- Wahr: Jede Achse zählt.',
		fachSkill: null,
		ziele: ['Ich kann Achsen finden.'],
		stunden: null,
		berechnet: [],
		andere: [],
	};

	it('nennt Auftrag, Ich-kann-Ziele, Prüfpunkte, Seiten und Lösungsseiten von Anfang an', () => {
		const text = fachblickText(FACH);
		assert.match(text, /^Fachblick auf „Kapitel 4“ \(Arbeitsblatt\), Klasse 2, Mathematik\./);
		assert.match(text, /Auftrag der Lehrkraft \(aus dem Assistenten\):\nErstelle eine Einheit/);
		assert.match(text, /Ich-kann-Ziele der Lehrkraft: „Ich kann Achsen finden\.“/);
		assert.match(text, /- Wahr: Jede Achse zählt\./);
		assert.match(text, /- seite-2\.png/);
		assert.match(text, /gleich mit den Seiten anzusehen:\n- loesung\/loesung-seite-1\.png/);
		assert.doesNotMatch(text, /Fach-Skill|Kinderaugen|erst nach/);
	});

	it('ohne Prüfpunkte liest er den Fach-Skill; ohne beides die Definition; ohne Ziele das Ziel der Seite', () => {
		const mitSkill = fachblickText({
			...FACH,
			pruefpunkte: null,
			fachSkill: '/ablage/fach-mathematik/SKILL.md',
			ziele: [],
		});
		assert.match(
			mitSkill,
			/Lies zuerst den Fach-Skill ganz mit Read[^\n]*\n- \/ablage\/fach-mathematik\/SKILL\.md/,
		);
		assert.match(mitSkill, /Ich-kann-Ziele: Die Lehrkraft hat keine genannt/);
		assert.match(fachblickText({ ...FACH, pruefpunkte: null }), /gegen die fachliche Definition/);
	});

	it('Vorlage: Prüfpunkte, Auftrag, Fach-Skill, berechnete Elemente, Art `fach` vor dem JSON-Block', () => {
		const vorlage = readFileSync(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-fachblick.md'), 'utf8');
		for (const wort of [
			'Prüfpunkte',
			'Auftrag der Lehrkraft',
			'Fach-Skill',
			'berechnen ihre Lösung selbst',
			'"art": "fach"',
		]) {
			assert.ok(vorlage.includes(wort), wort);
		}
		const schluss = readFileSync(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'einheit-schluss.md'), 'utf8');
		assert.match(schluss, /ein fachlicher Fehler ist `fach`/);
	});

	it('Art `fach` mit Synonymen; die Korrektur bekommt den Satz zur Sache (243, Punkt 4)', () => {
		const { befunde } = lesePruefung(
			'{"befunde": [{"seite": 4, "art": "Fachlich falsch", "text": "Das Dreieck hat eine waagerechte Achse."}, {"art": "fachlich", "text": "B ist symmetrisch."}]}',
		);
		assert.deepEqual(
			befunde.map((b) => b.art),
			['fach', 'fach'],
		);
		const text = pruefKorrektur(befunde, []);
		assert.match(text, /Seite 4, Fachlich falsch: Das Dreieck/);
		assert.match(text, /der Fachblick, hat jede Aussage/);
		assert.match(text, /Ein fachlicher Befund wird an der Sache behoben/);
		assert.doesNotMatch(pruefKorrektur([{ seite: 1, aufgabe: '', art: 'unklar', text: 'x' }], []), /Fachblick/);
	});

	it('offen nach der letzten Runde: nur `fach`, und erst, wenn die Prüfung nicht mehr läuft', () => {
		const offen = [
			{ seite: 3, aufgabe: '', art: 'fach' as const, text: 'B gilt als nicht symmetrisch.' },
			{ seite: 1, aufgabe: '', art: 'unklar' as const, text: 'x' },
		];
		assert.deepEqual(
			fachlichOffen({ status: 'fertig', offen }).map((b) => b.seite),
			[3],
		);
		assert.deepEqual(fachlichOffen({ status: 'laeuft', offen }), []);
	});

	it('Lösungsseiten anderer Materialien reihum, gekappt; mit den eigenen nie mehr als 48 Bilder', () => {
		const liste = verteileLoesungen(
			[
				{ slug: 'k1', titel: 'K1', dateien: ['a1', 'a2', 'a3'] },
				{ slug: 'k2', titel: 'K2', dateien: ['b1'] },
				{ slug: 'k3', titel: 'K3', dateien: ['c1', 'c2'] },
			],
			4,
		);
		assert.deepEqual(
			liste.map((l) => l.datei),
			['a1', 'b1', 'c1', 'a2'],
		);
		assert.equal(fremdeGrenze({ seiten: Array.from({ length: 6 }, () => 's'), loesungen: [] }), 24);
		assert.equal(
			fremdeGrenze({
				seiten: Array.from({ length: 16 }, () => 's'),
				loesungen: Array.from({ length: 16 }, () => 'l'),
			}),
			16,
		);
		const andere = verteileLoesungen([
			{ slug: 'k1', titel: 'K1', dateien: Array.from({ length: 30 }, (_, i) => `l${i}`) },
		]);
		assert.equal(andere.length, 24);
		const text = fachblickText({
			...FACH,
			seiten: Array.from({ length: 16 }, (_, i) => `seite-${i + 1}.png`),
			loesungen: Array.from({ length: 16 }, (_, i) => `loesung/loesung-seite-${i + 1}.png`),
			andere: andere.map((a) => ({ ...a, datei: `andere/k1/${a.datei}` })),
		});
		assert.match(text, /Lösungsseiten der fertigen Materialien, auf die die Hinweise zeigen/);
		assert.match(text, /„K1“ \(dokumente\/k1\): andere\/k1\/l0, /);
		assert.match(text, /andere\/k1\/l15\n|andere\/k1\/l15$/);
		assert.doesNotMatch(text, /andere\/k1\/l16/);
	});

	it('Befund ohne oder mit unbekannter Art: im Fachblick fach, mit Kinderaugen unklar, im Schlusslauf verworfen', () => {
		const antwort =
			'{"befunde": [{"seite": 3, "aufgabe": "Differenzierung", "text": "Die Lösung nennt 0 als ungerade."}]}';
		assert.deepEqual(
			lesePruefung(antwort, PRUEF_VORGABE_ART.fach).befunde.map((b) => [b.seite, b.aufgabe, b.art]),
			[[3, 'Differenzierung', 'fach']],
		);
		assert.equal(lesePruefung(antwort, PRUEF_VORGABE_ART.kind).befunde[0]?.art, 'unklar');
		assert.deepEqual(lesePruefung(antwort).befunde, []);
		const unbekannt = '{"befunde": [{"seite": 1, "art": "sonstwas", "text": "x"}]}';
		assert.equal(lesePruefung(unbekannt, PRUEF_VORGABE_ART.fach).befunde[0]?.art, 'fach');
	});

	it('Berechnete Elemente mit ihrer Frage, ohne Rahmen und Schreibplatz', () => {
		assert.doesNotMatch(fachblickText(FACH), /Messung/);
		assert.deepEqual(
			berechneteElemente(
				'<x-gitter aufgabe="pruefen" frage="ja-nein" figur="1,1"></x-gitter><x-gitter aufgabe="pruefen" frage="ja-nein" figur="2,2"></x-gitter><x-symmetrie-sortieren zeichen="B D"></x-symmetrie-sortieren><x-lineatur></x-lineatur>',
			),
			['<x-gitter aufgabe="pruefen" frage="ja-nein"> (2-mal)', '<x-symmetrie-sortieren>'],
		);
	});

	it('Stunden: mit Aufgaben des Materials und Anforderungsbereich, sonst jede Stunde in einer Zeile', () => {
		const plan = {
			stunden: [
				{
					nr: 4,
					handlung: 'Am Geobrett spannen.',
					begriffe: ['gleich weit'],
					kontrolle: false,
					aufgaben: [
						{
							dokument: 'k4',
							format: 'malen-nach-ergebnis',
							inhalt: 'Symmetrische Felder ausmalen',
							bereich: 'I' as const,
							zweitesMal: false,
						},
						{
							dokument: 'k5',
							format: 'ins-heft',
							inhalt: 'anderes',
							bereich: 'II' as const,
							zweitesMal: false,
						},
					],
				},
				{ nr: 5, handlung: 'Lernspiel.', begriffe: [], kontrolle: false, aufgaben: [] },
			],
		};
		const eigen = fachblickStunden(plan, 'k4') ?? '';
		assert.match(
			eigen,
			/- Stunde 4: Am Geobrett spannen\. Fachwörter: gleich weit\.\n {2}- malen-nach-ergebnis \(AB I\): Symmetrische Felder ausmalen/,
		);
		assert.doesNotMatch(eigen, /anderes|Stunde 5/);
		assert.match(fachblickStunden(plan, 'hinweise') ?? '', /- Stunde 4: .*\n- Stunde 5: Lernspiel\./);
		assert.equal(fachblickStunden({}, 'k4'), null);
	});

	it('Stunden mit den geplanten Minuten und dem Ablauf, wenn der Plan sie hat (272)', () => {
		const plan = {
			stunden: [
				{
					nr: 1,
					handlung: 'Falten.',
					begriffe: [],
					kontrolle: false,
					aufgaben: [],
					minuten: 45,
					phasen: [
						{ was: 'Auftakt, zwei Vermutungsfragen', minuten: 10, arbeit: false },
						{ was: 'Lernaufgaben', minuten: 30, arbeit: true },
					],
				},
				{ nr: 2, handlung: 'Spiegeln.', begriffe: [], kontrolle: false, aufgaben: [], minuten: 45 },
			],
		};
		const text = fachblickStunden(plan, 'auftakt') ?? '';
		assert.match(
			text,
			/- Stunde 1: Falten\. Geplant: 45 min: Auftakt, zwei Vermutungsfragen 10 min; Lernaufgaben 30 min\.\n- Stunde 2: Spiegeln\. Geplant: 45 min\./,
		);
	});

	const FOLIEN = [
		'<body class="kl2 folie">',
		'<section class="seite"><h1>Wald</h1><aside class="notiz"><p>2 min. Stille.</p><p>Alle stehen auf.</p></aside></section>',
		'<section class="seite"><h1>Kiste</h1></section>',
		'<section class="seite"><h1>Stern</h1><aside class="notiz">Wette: Daumen hoch.</aside></section>',
		'</body>',
	].join('');

	it('liest die Notizen der Folien mit der Nummer ihres Seitenbilds', () => {
		assert.deepEqual(folienNotizen(FOLIEN), [
			{ seite: 1, text: '2 min. Stille. Alle stehen auf.' },
			{ seite: 3, text: 'Wette: Daumen hoch.' },
		]);
		assert.deepEqual(folienNotizen('<body><section class="seite"><p>A</p></section></body>'), []);
	});

	it('nennt die Notizen der Folien seines Laufs, ohne die Notizen fehlt der Absatz', () => {
		const notizen = folienNotizen(FOLIEN);
		const text = fachblickText({ ...FACH, seiten: ['seite-1.png', 'seite-2.png'], notizen });
		assert.match(text, /Notizen der Lehrkraft zu den Folien[^\n]*\n- Folie 1: 2 min\. Stille\. Alle stehen auf\./);
		assert.doesNotMatch(text, /Folie 3/);
		assert.match(fachblickText({ ...FACH, seiten: ['seite-3.png'], notizen }), /- Folie 3: Wette/);
		assert.doesNotMatch(fachblickText(FACH), /Notizen der Lehrkraft/);
		const lang = fachblickText({
			...FACH,
			seiten: ['seite-1.png'],
			notizen: [{ seite: 1, text: 'x'.repeat(900) }],
		});
		assert.match(lang, new RegExp(`- Folie 1: x{${PRUEF_GRENZEN.notiz}}$`, 'm'));
	});

	it('Korrekturrunde zu einem Befund zur Zeit: die Minuten des Plans gelten', () => {
		const text = pruefKorrektur(
			[
				{
					seite: null,
					aufgabe: 'Stunde 1',
					art: 'zeit',
					text: 'Die Folien 1 bis 12 dauern etwa 17 min, geplant sind 10.',
				},
			],
			[],
		);
		assert.match(text, /Zu „Zeit der Stunde“: Die Minuten des Plans gelten\./);
		assert.equal(
			lesePruefung('{"befunde":[{"art":"länger als geplant","text":"zu lang"}]}', 'fach').befunde[0]?.art,
			'zeit',
		);
	});
});

describe('Bildprüfung mit frischem Blick (268)', () => {
	const bild = {
		datei: 'fall-1.jpg',
		motiv: 'Luna am Fenster',
		vertrag: '{"vertrag":{"pflicht":["Luna"]}}',
		pruefbilder: ['bilder/fall-1-platz.png', 'bilder/fall-1-v1.png'],
		vorschlag: { pflicht: ['Die Uhr hat zwei Zeiger.'], verboten: [] },
	};

	it('nennt Kapitel, Kanon, Vertrag, Vorschlag und Prüfbilder je Bild', () => {
		const text = bildPruefText({
			kapitel: 2,
			klasse: 'Klasse 2',
			fach: 'Mathematik',
			kanon: 'KANON',
			bilder: [bild],
			runde: 1,
			teil: { nr: 1, von: 2 },
		});
		assert.ok(text.startsWith(`${BILDPRUEFUNG_ANFANG} von Kapitel 2, Klasse 2, Mathematik. Lauf 1 von 2`));
		assert.ok(text.includes('\n\nKANON\n\n'));
		assert.match(text, /- fall-1\.jpg: Luna am Fenster\. Vertrag: \{.*\}\. Vorschlag aus dem Kanon: pflicht „Die Uhr hat zwei Zeiger\.“\. Prüfbilder: bilder\/fall-1-platz\.png, bilder\/fall-1-v1\.png\./);
		assert.doesNotMatch(text, /Zweite Bildprüfung/);
	});

	it('ohne Kapitel und in der zweiten Runde', () => {
		const text = bildPruefText({ kapitel: null, klasse: 'Klasse 2', fach: 'Mathematik', bilder: [{ ...bild, pruefbilder: [], vorschlag: null }], runde: 2 });
		assert.ok(text.startsWith(`${BILDPRUEFUNG_ANFANG} der Bilder ohne Kapitel`));
		assert.match(text, /Zweite Bildprüfung/);
		assert.match(text, /Keine Prüfbilder\./);
		assert.doesNotMatch(text, /Vorschlag aus dem Kanon/);
	});
});
