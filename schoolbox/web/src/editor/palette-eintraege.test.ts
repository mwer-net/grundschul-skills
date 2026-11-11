import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { bausteinNach } from '@schoolbox/kern/src/bausteine';
import { KATALOG } from '@schoolbox/kern/src/katalog';

import type { Aktionen, Kontext } from './befehle';
import { BEFEHLE, kuerzelText, titelVon } from './befehle';
import type { Posten } from './einfuegen';
import type { PalettenZiele } from './palette-eintraege';
import { BAUSTEIN_EINFUEGEN, eintraegeImEditor } from './palette-eintraege';
import { suchePalette } from './palette-suche';

const tu = new Proxy({}, { get: () => () => undefined }) as Aktionen;

const kontext = (mehr: Partial<Kontext> = {}): Kontext => ({
	pfad: [],
	format: 'a4-hoch',
	aktiv: true,
	frei: true,
	textsitzung: false,
	quelle: '',
	werte: { nach: null, spalten: { nr: 7, wert: 4 } as never, abstand: 10, abstandVorgabe: 28, seite: 1, seiten: 3 },
	mitLoesung: true,
	loesung: false,
	profil: 'farbe',
	hatAblage: true,
	hatNeueZahlen: true,
	kiVerfuegbar: true,
	claudeGrund: null,
	namenszeile: true,
	festeSeiten: false,
	hatBild: true,
	linksOffen: [],
	davor: 3,
	textMarkiert: () => false,
	feldBehaeltUndo: () => false,
	gestaltung: null,
	tu,
	...mehr,
});

const gewaehlt = (art: string, name = 'Uhr'): Kontext['pfad'] =>
	[{ nr: 9, name, baustein: bausteinNach(art) as Baustein }] as never;

const ziele = (mehr: Partial<PalettenZiele> = {}): PalettenZiele => ({
	posten: KATALOG.map((e): Posten => ({ ...e, einfuegbar: {} as never })),
	fuegeEin: () => undefined,
	zeigeSeite: () => undefined,
	zeigeEinstellung: () => undefined,
	fuehreAus: () => undefined,
	...mehr,
});

describe('Inhalt der Palette im Editor', () => {
	it('zeigt jeden Befehl mit Ort „palette“, sobald er verfügbar ist, und keinen anderen', () => {
		for (const k of [kontext(), kontext({ pfad: gewaehlt('aufgabe') }), kontext({ aktiv: false, frei: false })]) {
			const ids = new Set(eintraegeImEditor(k, ziele()).map((e) => e.id));
			for (const b of BEFEHLE) {
				assert.equal(ids.has(b.id), b.orte.includes('palette') && b.verfuegbar(k), b.id);
			}
		}
	});

	it('fügt jeden Katalogeintrag ein, auch die eigene Sammlung', () => {
		const eingefuegt: string[] = [];
		const eigen: Posten = {
			...(KATALOG[0] as (typeof KATALOG)[number]),
			id: 'eigen-1',
			name: 'Mein Kasten',
			eigen: 'x',
			einfuegbar: {} as never,
		};
		const z = ziele({ fuegeEin: (p) => eingefuegt.push(p.id) });
		const liste = eintraegeImEditor(kontext({ pfad: gewaehlt('aufgabe') }), { ...z, posten: [...z.posten, eigen] });
		const einfuegen = liste.filter((e) => e.gruppe === BAUSTEIN_EINFUEGEN);
		assert.equal(einfuegen.length, KATALOG.length + 1);
		for (const e of einfuegen) {
			e.aus();
			assert.ok(
				suchePalette(e.titel, liste).some((t) => t.id === e.id),
				e.titel,
			);
		}
		assert.deepEqual(eingefuegt, [...KATALOG.map((e) => e.id), 'eigen-1']);
	});

	it('bietet nichts zum Einfügen an, wenn das Blatt gesperrt ist', () => {
		const liste = eintraegeImEditor(kontext({ aktiv: false }), ziele());
		assert.equal(liste.filter((e) => e.gruppe === BAUSTEIN_EINFUEGEN).length, 0);
		assert.ok(!liste.some((e) => e.id === 'einstellung:abstand'));
	});

	it('zeigt zu jedem Befehl das erste Kürzel', () => {
		const liste = eintraegeImEditor(kontext({ pfad: gewaehlt('aufgabe') }), ziele());
		for (const e of liste) {
			const b = BEFEHLE.find((x) => x.id === e.id);
			const [erstes] = b?.kuerzel ?? [];
			if (erstes) {
				assert.equal(e.kuerzel, kuerzelText(erstes), e.id);
			}
		}
	});

	it('nennt die Auswahl als Gruppe und die Wirkung bei den Spalten', () => {
		const k = kontext({ pfad: gewaehlt('aufgabe') });
		const liste = eintraegeImEditor(k, ziele());
		const spalten = liste.find((e) => e.id === 'auswahl.spalten-mehr');
		assert.equal(spalten?.gruppe, 'Auswahl: Uhr');
		assert.equal(spalten?.notiz, '4 → 5');
		assert.equal(liste[0]?.gruppe, 'Auswahl: Uhr');
		assert.equal(suchePalette('spal', liste)[0]?.id, 'auswahl.spalten-mehr');
	});

	it('springt zu Seiten und Einstellungen', () => {
		const orte: string[] = [];
		const seiten: number[] = [];
		const liste = eintraegeImEditor(
			kontext(),
			ziele({ zeigeEinstellung: (o) => orte.push(o), zeigeSeite: (n) => seiten.push(n) }),
		);
		liste.find((e) => e.id === 'einstellung:abstand')?.aus();
		suchePalette('seite 3', liste)[0]?.aus();
		assert.deepEqual(orte, ['abstand']);
		assert.deepEqual(seiten, [3]);
	});

	it('bietet „Punkte zeigen“ nur an, wenn der Schalter wirkt, und keine Trennlinien', () => {
		const orte = (quelle: string) =>
			eintraegeImEditor(kontext({ quelle }), ziele())
				.map((e) => e.id)
				.filter((id) => id === 'einstellung:punkte' || id === 'einstellung:trennlinien');
		assert.deepEqual(orte(''), []);
		assert.deepEqual(orte('<body class="kl2"><span class="niveau"><i></i></span></body>'), []);
		assert.deepEqual(orte('<body class="kl2"><span class="punkte">(2 P.)</span></body>'), ['einstellung:punkte']);
		assert.deepEqual(orte('<body class="kl2 ohne-punkte"></body>'), ['einstellung:punkte']);
	});

	it('hat die Synonyme aus dem Ticket', () => {
		const liste = eintraegeImEditor(kontext({ pfad: gewaehlt('aufgabe') }), ziele());
		for (const [wort, id] of [
			['entfernen', 'auswahl.loeschen'],
			['verdoppeln', 'auswahl.duplizieren'],
			['hinzufügen', 'auswahl.einfuegen-danach'],
			['verstecken', 'auswahl.sichtbarkeit.beide'],
			['herunterladen', 'dokument.pdf'],
			['ki', 'ansicht.claude'],
		] as const) {
			assert.ok(
				suchePalette(wort, liste).some((e) => e.id === id),
				`${wort} → ${id}`,
			);
		}
	});

	it('titelVon liefert für jeden Palettenbefehl einen Text', () => {
		const k = kontext({ pfad: gewaehlt('aufgabe') });
		for (const b of BEFEHLE.filter((x) => x.orte.includes('palette'))) {
			assert.ok(titelVon(b, k).length > 0, b.id);
		}
	});
});
