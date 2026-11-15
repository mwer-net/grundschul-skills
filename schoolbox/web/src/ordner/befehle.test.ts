import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { suchePalette } from '../editor/palette-suche';
import type { Lage } from './befehle';
import { BEFEHLE, ERST_WAEHLEN, gilt, kuerzelVon, leistenKnoepfe, MENUE, menueVon, paletteVon, tastenAbschnitte } from './befehle';
import { dokObjekt, ordnerObjekt } from './objekte';
import type { AblageDok, AblageStand } from './typen';

const zeit = '2026-11-01T08:00:00.000Z';
const blatt = (id: string, format: 'a4-hoch' | 'folie', entwuerfe = 0, wuerfelbar = false): AblageDok => ({
	id,
	mappe: 'mappe',
	fach: 'mathematik',
	klasse: 3,
	ordner: null,
	vorschau: null,
	wuerfelbar,
	meta: {
		titel: id,
		art: 'arbeitsblatt',
		format,
		druckprofil: 'sw',
		hatLoesung: false,
		druckhinweise: [],
		status: 'fertig',
		seiten: 1,
		pruefung: null,
		entwuerfe: Array.from({ length: entwuerfe }, (_, i) => ({ name: String.fromCharCode(65 + i), titel: '', idee: '' })),
		erstellt: zeit,
		geaendert: zeit,
	},
});
const ordner = { id: 'o1', name: 'Klasse 3', eltern: null, behaelter: null, erstellt: zeit, geaendert: zeit };
const stand = (...dokumente: AblageDok[]) =>
	({ rev: 1, ordner: [ordner], dokumente, defekt: [], geteilt: { ordner: [], dokumente: [] } }) as AblageStand;
const lage = (teil: Partial<Lage>): Lage => ({
	art: 'leer',
	objekte: [],
	ort: null,
	fremd: false,
	merkzettel: null,
	quelle: 'inhalt',
	anzahl: 3,
	...teil,
});
const material = (d: AblageDok): Lage => lage({ art: 'material', objekte: [dokObjekt(stand(d), d)] });
const titel = (l: Lage, ohne: string[] = []) =>
	menueVon(l, { fuehreAus: () => undefined, untermenue: () => null }, undefined, ohne).map((e) => e.titel);

describe('Befehle der Ablage', () => {
	it('jeder Befehl mit Taste steht in der Tastenliste (Entscheidung 30)', () => {
		const inListe = new Set(tastenAbschnitte().flatMap((a) => a.zeilen.map((z) => z.id)));
		for (const b of BEFEHLE) {
			if (b.kuerzel?.length) {
				assert.ok(inListe.has(b.id), `${b.id} fehlt in der Tastenliste`);
			}
		}
	});

	it('Menüs nennen nur vorhandene Befehle, jede Art hat ihre Liste', () => {
		const ids = new Set(BEFEHLE.map((b) => b.id));
		for (const [art, gruppen] of Object.entries(MENUE)) {
			assert.ok(gruppen.length > 0, art);
			for (const id of gruppen.flat()) {
				assert.ok(ids.has(id), `${art}: ${id} gibt es nicht`);
			}
		}
	});

	it('jeder Befehl ohne Taste steht in mindestens einem Menü oder hat eine eigene Oberfläche', () => {
		const imMenue = new Set(Object.values(MENUE).flatMap((g) => g.flat()));
		for (const b of BEFEHLE) {
			if (!b.kuerzel?.length) {
				assert.ok(imMenue.has(b.id), `${b.id} ist nirgends zu erreichen`);
			}
		}
	});

	it('Kürzel kommen aus dem Register, die Leertaste heißt so (166)', () => {
		assert.equal(kuerzelVon('seitenleiste', true), '⌥S');
		assert.throws(() => kuerzelVon('gibt-es-nicht'), /gibt-es-nicht/);
		const uebersicht = tastenAbschnitte(true)
			.flatMap((a) => a.zeilen)
			.find((z) => z.id === 'uebersicht');
		assert.deepEqual(uebersicht?.tasten, ['Leertaste']);
	});

	it('Leiste: Bei offenen Entwürfen „Entwürfe vergleichen“ statt „Bearbeiten“ und „PDF“ (188-02)', () => {
		assert.deepEqual(leistenKnoepfe(material(blatt('a', 'a4-hoch', 3))), ['entwuerfe', 'teilen']);
		assert.deepEqual(leistenKnoepfe(material(blatt('b', 'a4-hoch'))), ['bearbeiten', 'pdf', 'teilen']);
		// Bei der Folie ist „Präsentieren“ der Knopf, „Bearbeiten“ steht im ⋯.
		assert.deepEqual(leistenKnoepfe(material(blatt('c', 'folie'))), ['praesentieren', 'pdf', 'teilen']);
		// Was die Leiste zeigt, bietet das Menü auch an.
		for (const d of [blatt('a', 'a4-hoch', 3), blatt('b', 'a4-hoch'), blatt('c', 'folie')]) {
			for (const id of leistenKnoepfe(material(d))) {
				assert.ok(gilt(id, material(d)), `${d.id}: ${id}`);
			}
		}
	});

	it('⋯ der Leiste ohne die Knöpfe daneben, das Kontextmenü vollständig (188-31)', () => {
		const l = material(blatt('b', 'a4-hoch'));
		const voll = titel(l);
		const ohne = titel(l, leistenKnoepfe(l));
		assert.ok(voll.includes('Bearbeiten') && !ohne.includes('Bearbeiten'));
		assert.ok(ohne.every((t) => voll.includes(t)));
	});

	it('„Mein Material“ im Baum: nur, was die Wurzel betrifft (188-36, 189-01)', () => {
		const imBaum = titel(lage({ quelle: 'baum' }));
		for (const weg of ['Darstellung', 'Sortieren', 'Alles auswählen']) {
			assert.ok(!imBaum.includes(weg), weg);
		}
		assert.ok(imBaum.includes('Neuer Ordner'));
		// Gegenprobe: Auf der Fläche steht alles.
		const flaeche = titel(lage({}));
		assert.ok(flaeche.includes('Darstellung') && flaeche.includes('Alles auswählen'));
	});

	it('Fehlt der Ordner, gilt kein Befehl der Ablage (189-02)', () => {
		const l = lage({ ort: 'gibt-es-nicht', gesperrt: true });
		assert.deepEqual(titel(l), []);
		assert.equal(gilt('neuerOrdner', l), false);
		assert.equal(gilt('neuerOrdner', lage({})), true);
	});

	it('„Alles auswählen“ nur mit Inhalt, „Ausschneiden“ in keinem Menü, Übersicht nur für Material', () => {
		assert.ok(!titel(lage({ anzahl: 0 })).includes('Alles auswählen'));
		assert.ok(!Object.values(MENUE).some((g) => g.flat().includes('ausschneiden')));
		const ord = lage({ art: 'ordner', objekte: [ordnerObjekt(stand(), ordner)] });
		assert.equal(gilt('uebersicht', ord), false);
		assert.equal(gilt('uebersicht', material(blatt('b', 'a4-hoch'))), true);
	});

	it('„Variante mit neuen Zahlen“ nur, wo sie etwas ändert (188-33)', () => {
		assert.equal(gilt('variante', material(blatt('b', 'a4-hoch'))), false);
		assert.equal(gilt('variante', material(blatt('w', 'a4-hoch', 0, true))), true);
		assert.ok(titel(material(blatt('w', 'a4-hoch', 0, true))).includes('Variante mit neuen Zahlen'));
	});

	it('⌘K: dieselben Befehle wie das Menü an der Auswahl, ohne Auswahl gesperrt mit Grund (S-02)', () => {
		const quellen = { fuehreAus: () => undefined, untermenue: () => null };
		const l = material(blatt('b', 'a4-hoch'));
		const zeilen = paletteVon(l, quellen, 'b');
		assert.deepEqual(
			zeilen.map((z) => z.titel),
			titel(l),
		);
		assert.ok(zeilen.every((z) => z.gruppe === 'Auswahl: b' && !z.gesperrt));
		assert.equal(suchePalette('löschen', zeilen)[0]?.titel, 'In den Papierkorb');
		assert.equal(suchePalette('umbenennen', zeilen)[0]?.titel, 'Umbenennen');
		const ohne = paletteVon(lage({}), quellen, '');
		const papierkorb = suchePalette('löschen', ohne)[0];
		assert.equal(papierkorb?.gesperrt, true);
		assert.equal(papierkorb?.notiz, ERST_WAEHLEN);
		assert.ok(!ohne.some((z) => z.titel === 'Neuer Unterordner'));
	});
});
