import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { verstaendlich } from './meldungen';
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
});
