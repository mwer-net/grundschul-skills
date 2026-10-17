import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { erklaere, verstaendlich } from './meldungen';
import { ausgabeDateiname, mappenPdfDateiname, pdfDateiname } from './namen';

describe('pdfDateiname', () => {
	const mathe = { fach: 'mathematik', klasse: 2 } as const;

	it('nennt Klasse, Fach, Titel und Fassung', () => {
		const blatt = { titel: 'Uhrzeit', art: 'arbeitsblatt' } as const;
		assert.equal(pdfDateiname(mathe, blatt, 'arbeitsblatt'), 'Kl2 Mathe Uhrzeit – Arbeitsblatt.pdf');
		assert.equal(pdfDateiname(mathe, blatt, 'loesung'), 'Kl2 Mathe Uhrzeit – Lösung.pdf');
		assert.equal(pdfDateiname(mathe, blatt, 'beides'), 'Kl2 Mathe Uhrzeit – Arbeitsblatt mit Lösung.pdf');
		const text = { titel: 'Größen: Meter / Zentimeter?', art: 'lesetext' } as const;
		assert.equal(
			pdfDateiname({ fach: 'faecheruebergreifend', klasse: 'gemischt' }, text, 'arbeitsblatt'),
			'Größen Meter Zentimeter – Lesetext.pdf',
		);
		assert.equal(pdfDateiname(mathe, { titel: 'Rest', art: 'sonstiges' }, 'arbeitsblatt'), 'Kl2 Mathe Rest.pdf');
	});

	it('benennt die Ausgaben für Folien', () => {
		const sache = { fach: 'sachunterricht', klasse: 3 } as const;
		const folien = { titel: 'Die Kartoffel', art: 'praesentation' } as const;
		assert.equal(
			ausgabeDateiname(sache, folien, 'arbeitsblatt'),
			'Kl3 Sachunterricht Die Kartoffel – Präsentation.pdf',
		);
		assert.equal(
			ausgabeDateiname(sache, folien, 'schritte'),
			'Kl3 Sachunterricht Die Kartoffel – Präsentation mit Schritten.pdf',
		);
		assert.equal(
			ausgabeDateiname(sache, folien, 'notizen'),
			'Kl3 Sachunterricht Die Kartoffel – Folien mit Notizen.pdf',
		);
		assert.equal(
			ausgabeDateiname(sache, folien, 'praesentation'),
			'Kl3 Sachunterricht Die Kartoffel – Präsentation.html',
		);
	});

	it('benennt „Alles als PDF“ nach der Mappe', () => {
		const mappe = { titel: 'Die Kartoffel', fach: 'sachunterricht', klasse: 3 } as const;
		assert.equal(mappenPdfDateiname(mappe, 'alles'), 'Kl3 Sachunterricht Die Kartoffel – Alles.pdf');
		assert.equal(
			mappenPdfDateiname(mappe, 'alles-mit-loesungen'),
			'Kl3 Sachunterricht Die Kartoffel – Alles mit Lösungen.pdf',
		);
	});
});

describe('verstaendlich', () => {
	it('übersetzt die Fehler aus pruefung.js', () => {
		const faelle: [number, string, string][] = [
			[
				4,
				'„Kreuze an: Wie spät ist es?“ ragt aus der Seite (31 px) → kürzen, Item streichen oder zweite Seite',
				'Seite 4: „Kreuze an: Wie spät ist es?“ ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.',
			],
			[
				1,
				'„Antwortlinie“ ragt in den Seitenrand (6 px) → kürzen, Item streichen oder zweite Seite',
				'Seite 1: „Antwortlinie“ ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.',
			],
			[
				2,
				'„1234567890123456789012345678901234567890“ ist abgeschnitten',
				'Seite 2: Von „1234567890123456789012345678901234567890…“ ist ein Teil nicht zu sehen.',
			],
			[1, '„Willi“ überlappt „Aufgabe 2“ (40 × 12 px)', 'Seite 1: „Willi“ und „Aufgabe 2“ liegen übereinander.'],
			[3, 'Bild fehlt: bilder/uhr.png', 'Seite 3: Ein Bild fehlt.'],
			[
				0,
				'Schrift Andika nicht geladen (fonts/ fehlt?)',
				'Die Schrift Andika fehlt, das Blatt sieht dadurch anders aus.',
			],
			[
				0,
				'Prüfung lief nicht durch (Skriptfehler?)',
				'Die automatische Prüfung ist nicht durchgelaufen. Bitte das PDF genau ansehen.',
			],
			[
				1,
				'Lösungsblatt: „Lösung“ ragt in den Seitenrand (3 px) → kürzen',
				'Im Lösungsblatt, Seite 1: „Lösung“ ragt in den Rand und wird beim Drucken vielleicht abgeschnitten.',
			],
			[2, 'Etwas Neues → so beheben', 'Seite 2: Etwas Neues'],
		];
		for (const [seite, text, erwartet] of faelle) {
			assert.equal(verstaendlich({ stufe: 'FEHLER', seite, text }), erwartet);
		}
	});

	it('übersetzt nach Code, mit den Namen aus dem Bericht oder eigenen', () => {
		const ziel = (name: string) => ({ sb: 3, name, rechteck: [0, 0, 10, 10] });
		const ueberlauf = {
			stufe: 'FEHLER' as const,
			seite: 2,
			code: 'ueberlauf' as const,
			text: '„4 Rechne“ ragt aus der Seite (40 px) → kürzen, Item streichen oder zweite Seite',
			ziele: [ziel('4 Rechne')],
		};
		assert.equal(
			verstaendlich(ueberlauf),
			'Seite 2: „4 Rechne“ ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.',
		);
		const imEditor = erklaere(ueberlauf, ['Aufgabe 4']);
		assert.equal(imEditor.satz, 'Aufgabe 4 ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.');
		assert.match(imEditor.tipp ?? '', /Spalten erhöhen/);
		assert.equal(
			verstaendlich({ ...ueberlauf, text: `Lösungsblatt: ${ueberlauf.text}` }),
			'Im Lösungsblatt, Seite 2: „4 Rechne“ ragt über das Blatt hinaus und wird beim Drucken abgeschnitten.',
		);
		assert.equal(
			erklaere({
				stufe: 'WARNUNG',
				seite: 1,
				code: 'aufgaben-viele',
				text: '6 Aufgaben (+★): Richtwert Klasse 2 sind höchstens 4 → Übersicht vor Menge',
			}).satz,
			'Auf der Seite stehen 6 Aufgaben. Für Klasse 2 sind höchstens 4 übersichtlich.',
		);
		assert.equal(
			erklaere({ stufe: 'WARNUNG', seite: 1, code: 'schrift-klein', text: '…' }, ['Absatz 1', 'Item 2', 'Item 3'])
				.satz,
			'Die Schrift bei Absatz 1, Item 2 und Item 3 ist sehr klein.',
		);
		assert.match(
			erklaere({
				stufe: 'HINWEIS',
				seite: 1,
				code: 'platz-frei',
				text: '300 px frei unten → Abstand … (--abstand)',
			}).tipp ?? '',
			/Abstand vergrößern/,
		);
	});
});
