import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
	dokumentDir,
	leseMappe,
	leseMappenEintrag,
	mappenDir,
	neueMappe,
	neuesDokument,
	sammleMappen,
} from './ablage';
import { FREIGABEN_SCHEMA, legeFreigabeAn, leseFreigaben } from './freigaben';
import { richteKurzanleitungEin, HILFE_MAPPE, KURZANLEITUNG } from './kurzanleitung';
import type { AblageKnoten, Aktion, Baum, Bestand, Umgebung } from './ordner';
import {
	alleOrdnerPfade,
	dokumentGeloescht,
	dokumenteVonZiel,
	faelligImPapierkorb,
	gleicheAb,
	ladeBaum,
	lebenderOrdner,
	leererBaum,
	leseAktion,
	ORDNER_DATEI,
	ORDNER_SICHERUNG,
	ordnerGeloescht,
	schreibeBaum,
	sicherungen,
	wendeAktionAn,
} from './ordner';
import { baumZumLesen, kopiereKnoten, leseBestand, loescheFaelligeAusBaum, pruefeAblagePfad } from './ordner-ablage';
import { pruefeSchema } from './schema';

const JETZT = new Date('2026-11-05T10:00:00.000Z');
const TAG_MS = 24 * 60 * 60 * 1000;

const mappeBestand = (id: string, titel: string, doks: string[] = [], ablage?: string) => ({
	id,
	titel,
	erstellt: JETZT.toISOString(),
	dokumente: doks.map((d, i) => ({ id: d, erstellt: new Date(JETZT.getTime() + i).toISOString() })),
	...(ablage ? { ablage } : {}),
});

const TITEL: Record<string, string> = {};
const u = (titel: Record<string, string> = TITEL): Umgebung => ({
	jetzt: JETZT,
	titel: (m, d) => titel[`${m}/${d}`],
});

const neuerBaum = (bestand: Bestand) => gleicheAb(null, bestand, JETZT).baum;

/** Ein Baum mit Klasse 3 / Mathe, einer Reihe und einem Blatt in „Mein Material“. */
const beispiel = () => {
	const titel = { 'reihe/a': 'Station 1', 'reihe/b': 'Station 2', 'los/x': 'Einzelblatt' };
	let baum = neuerBaum({ mappen: [mappeBestand('reihe', 'Reihe', ['a', 'b'])], unlesbar: [] });
	const umg = u(titel);
	const k3 = wendeAktionAn(baum, { art: 'neu', eltern: null, name: 'Klasse 3' }, umg);
	baum = k3.baum;
	const mathe = wendeAktionAn(baum, { art: 'neu', eltern: k3.neu ?? null, name: 'Mathe' }, umg);
	baum = mathe.baum;
	baum.dokumente['los/x'] = { ordner: null, geloescht: null };
	const reihe = baum.ordner.find((o) => o.behaelter === 'reihe')?.id ?? '';
	return { baum, titel, umg, k3: k3.neu ?? '', mathe: mathe.neu ?? '', reihe };
};

/** Ohne `rev`, `geaendert`: Das sind Stempel, keine Ordnung. */
const inhalt = (baum: Baum) => ({
	ordner: baum.ordner
		.map(({ behaelter, eltern, geloescht, id, name }) => ({ behaelter, eltern, geloescht, id, name }))
		.sort((a, b) => a.id.localeCompare(b.id)),
	dokumente: baum.dokumente,
});

const fuehreAus = (baum: Baum, aktionen: Aktion[], umg: Umgebung) =>
	aktionen.reduce((b, a) => wendeAktionAn(b, a, umg).baum, baum);

const ablage = async () => mkdtemp(path.join(tmpdir(), 'schoolbox-ordner-'));

describe('Abgleich', () => {
	it('Erststart: je Mappe ein Ordner mit ihrem Titel, Dokumente darin', () => {
		const { baum, geaendert } = gleicheAb(
			null,
			{ mappen: [mappeBestand('a', 'Kartoffeln', ['eins', 'zwei']), mappeBestand('b', 'Uhr', ['drei'])], unlesbar: [] },
			JETZT,
		);
		assert.equal(geaendert, true);
		assert.deepEqual(baum.ordner.map((o) => [o.name, o.behaelter, o.eltern]).sort(), [
			['Kartoffeln', 'a', null],
			['Uhr', 'b', null],
		]);
		const a = baum.ordner.find((o) => o.behaelter === 'a')?.id;
		assert.equal(baum.dokumente['a/eins']?.ordner, a);
		assert.equal(baum.dokumente['a/zwei']?.ordner, a);
	});

	it('zweiter Lauf schreibt nicht und lässt rev gleich', () => {
		const bestand = { mappen: [mappeBestand('a', 'Kartoffeln', ['eins'])], unlesbar: [] };
		const erst = gleicheAb(null, bestand, JETZT).baum;
		const zweit = gleicheAb(erst, bestand, JETZT);
		assert.equal(zweit.geaendert, false);
		assert.equal(zweit.baum.rev, erst.rev);
		assert.deepEqual(zweit.baum, erst);
	});

	it('eine defekte Mappe behält ihre Plätze', () => {
		const erst = neuerBaum({ mappen: [mappeBestand('a', 'A', ['eins'])], unlesbar: [] });
		const { baum, geaendert } = gleicheAb(erst, { mappen: [], unlesbar: ['a'] }, JETZT);
		assert.equal(geaendert, false);
		assert.ok(baum.dokumente['a/eins']);
		assert.equal(baum.ordner.length, 1);
	});

	it('ein Dokument, das auf der Platte fehlt, entfällt', () => {
		const erst = neuerBaum({ mappen: [mappeBestand('a', 'A', ['eins', 'zwei'])], unlesbar: [] });
		const { baum } = gleicheAb(erst, { mappen: [mappeBestand('a', 'A', ['zwei'])], unlesbar: [] }, JETZT);
		assert.equal(baum.dokumente['a/eins'], undefined);
		assert.ok(baum.dokumente['a/zwei']);
	});

	it('neue Mappe: in „Mein Material“ oder am Ziel aus mappe.json, nur einmal', () => {
		const erst = neuerBaum({ mappen: [], unlesbar: [] });
		const mit = gleicheAb(erst, { mappen: [mappeBestand('a', 'Uhr', ['d'], 'Klasse 3/Mathe')], unlesbar: [] }, JETZT).baum;
		assert.deepEqual(
			alleOrdnerPfade(mit).map((p) => p.pfad),
			['Klasse 3', 'Klasse 3/Mathe', 'Klasse 3/Mathe/Uhr'],
		);
		const uhr = mit.ordner.find((o) => o.behaelter === 'a');
		assert.equal(mit.dokumente['a/d']?.ordner, uhr?.id);
		// Die Lehrkraft räumt um: Der Abgleich legt es nicht zurück, obwohl `ablage` noch dasteht.
		const umg = u({ 'a/d': 'D' });
		const bewegt = wendeAktionAn(mit, { art: 'bewegen', knoten: [{ ordner: uhr?.id ?? '' }], ziel: null }, umg).baum;
		const danach = gleicheAb(bewegt, { mappen: [mappeBestand('a', 'Uhr', ['d'], 'Klasse 3/Mathe')], unlesbar: [] }, JETZT);
		assert.equal(danach.geaendert, false);
		assert.equal(danach.baum.ordner.find((o) => o.behaelter === 'a')?.eltern, null);
	});

	it('neues Dokument: in den Ordner mit diesem Behälter, sonst neben das jüngste Geschwister', () => {
		const { baum, reihe, umg } = beispiel();
		const bestand = (doks: string[]) => ({ mappen: [mappeBestand('reihe', 'Reihe', doks)], unlesbar: [] });
		const eins = gleicheAb(baum, bestand(['a', 'b', 'c']), JETZT).baum;
		assert.equal(eins.dokumente['reihe/c']?.ordner, reihe);
		// Ordner im Papierkorb, jüngstes Geschwister liegt woanders.
		const k = wendeAktionAn(eins, { art: 'neu', eltern: null, name: 'Anderswo' }, umg);
		const weg = fuehreAus(
			k.baum,
			[
				{ art: 'bewegen', knoten: [{ mappe: 'reihe', dok: 'c' }], ziel: k.neu ?? null },
				{ art: 'papierkorb', knoten: [{ ordner: reihe }] },
			],
			umg,
		);
		const zwei = gleicheAb(weg, bestand(['a', 'b', 'c', 'd']), JETZT).baum;
		assert.equal(zwei.dokumente['reihe/d']?.ordner, k.neu);
		// Ohne Geschwister: „Mein Material“.
		const nurWeg = wendeAktionAn(baum, { art: 'papierkorb', knoten: [{ ordner: reihe }] }, umg).baum;
		const drei = gleicheAb(nurWeg, bestand(['a', 'b', 'd']), JETZT).baum;
		assert.equal(drei.dokumente['reihe/d']?.ordner, null);
	});

	it('Verweis auf unbekannten Ordner oder Kreis: nach „Mein Material“, mit Meldung', () => {
		const { baum, k3, mathe } = beispiel();
		const kaputt = structuredClone(baum);
		const k = kaputt.ordner.find((o) => o.id === k3);
		const m = kaputt.ordner.find((o) => o.id === mathe);
		assert.ok(k && m);
		k.eltern = mathe;
		kaputt.dokumente['reihe/a'] = { ordner: 'o-00000000', geloescht: null };
		const { baum: heil, meldungen } = gleicheAb(
			kaputt,
			{ mappen: [mappeBestand('reihe', 'Reihe', ['a', 'b']), mappeBestand('los', 'Los', ['x'])], unlesbar: [] },
			JETZT,
		);
		assert.ok(meldungen.length >= 2);
		assert.equal(heil.dokumente['reihe/a']?.ordner, null);
		assert.ok(heil.ordner.some((o) => o.id === k3 && o.eltern === null) || heil.ordner.some((o) => o.id === mathe && o.eltern === null));
	});
});

describe('Bewegen', () => {
	it('lehnt sich selbst und Nachkommen ab', () => {
		const { baum, k3, mathe, umg } = beispiel();
		assert.throws(() => wendeAktionAn(baum, { art: 'bewegen', knoten: [{ ordner: k3 }], ziel: k3 }, umg), /in sich selbst/);
		assert.throws(() => wendeAktionAn(baum, { art: 'bewegen', knoten: [{ ordner: k3 }], ziel: mathe }, umg), /in sich selbst/);
	});

	it('bei gleichem Namen bleiben beide, auch bei anderer Schreibweise', () => {
		const { baum, mathe, umg, reihe } = beispiel();
		const umbenannt = wendeAktionAn(baum, { art: 'neu', eltern: mathe, name: 'REIHE' }, umg).baum;
		const r = wendeAktionAn(umbenannt, { art: 'bewegen', knoten: [{ ordner: reihe }], ziel: mathe }, umg);
		assert.equal(r.baum.ordner.find((o) => o.id === reihe)?.name, 'Reihe 2');
		assert.deepEqual(r.umbenannt[0]?.nach, 'Reihe 2');
		assert.deepEqual(r.effekte, [{ art: 'mappe-titel', mappe: 'reihe', titel: 'Reihe 2' }]);
		// Rückgängig gibt auch den Namen zurück.
		const zurueck = fuehreAus(r.baum, r.umkehr, umg);
		assert.equal(zurueck.ordner.find((o) => o.id === reihe)?.name, 'Reihe');
	});

	it('Material bekommt bei gleichem Namen einen Titel-Effekt', () => {
		const { baum, reihe, umg } = beispiel();
		const titel = { ...umg, titel: (m: string, d: string) => (d === 'x' ? 'Station 1' : umg.titel(m, d)) };
		const r = wendeAktionAn(baum, { art: 'bewegen', knoten: [{ mappe: 'los', dok: 'x' }], ziel: reihe }, titel);
		assert.deepEqual(r.effekte, [{ art: 'dokument-titel', mappe: 'los', dok: 'x', titel: 'Station 1 2' }]);
	});

	it('mehrere aus verschiedenen Ordnern: die Umkehr bringt jedes an seinen Platz', () => {
		const { baum, mathe, reihe, umg } = beispiel();
		const knoten: AblageKnoten[] = [{ mappe: 'reihe', dok: 'a' }, { mappe: 'los', dok: 'x' }, { ordner: reihe }];
		const r = wendeAktionAn(baum, { art: 'bewegen', knoten, ziel: mathe }, umg);
		assert.equal(r.baum.dokumente['reihe/a']?.ordner, mathe);
		assert.deepEqual(inhalt(fuehreAus(r.baum, r.umkehr, umg)), inhalt(baum));
	});

	it('Ein Ziel im Papierkorb gibt es nicht', () => {
		const { baum, k3, umg } = beispiel();
		const weg = wendeAktionAn(baum, { art: 'papierkorb', knoten: [{ ordner: k3 }] }, umg).baum;
		assert.throws(() => wendeAktionAn(weg, { art: 'bewegen', knoten: [{ mappe: 'los', dok: 'x' }], ziel: k3 }, umg), /gibt es nicht mehr/);
	});
});

describe('Namen', () => {
	it('Regeln: nicht leer, kein Schrägstrich, nicht zu lang, kein Doppel', () => {
		const { baum, k3, mathe, umg } = beispiel();
		const umb = (name: string) => wendeAktionAn(baum, { art: 'umbenennen', knoten: { ordner: mathe }, name }, umg);
		assert.throws(() => umb('  '), /Namen ein/);
		assert.throws(() => umb('A/B'), /Schrägstrich/);
		assert.throws(() => umb('x'.repeat(121)), /zu lang/);
		const zweiter = wendeAktionAn(baum, { art: 'neu', eltern: k3, name: 'Deutsch' }, umg).baum;
		assert.throws(
			() => wendeAktionAn(zweiter, { art: 'umbenennen', knoten: { ordner: mathe }, name: 'deutsch' }, umg),
			/gibt es hier schon/,
		);
		// Nur die Schreibweise ändern geht.
		assert.equal(umb('MATHE').baum.ordner.find((o) => o.id === mathe)?.name, 'MATHE');
	});

	it('Neuer Ordner ohne Namen: „Neuer Ordner“, dann „Neuer Ordner 2“', () => {
		const { baum, umg } = beispiel();
		const eins = wendeAktionAn(baum, { art: 'neu', eltern: null }, umg);
		const zwei = wendeAktionAn(eins.baum, { art: 'neu', eltern: null }, umg);
		assert.equal(zwei.baum.ordner.find((o) => o.id === zwei.neu)?.name, 'Neuer Ordner 2');
	});

	it('`leseAktion` weist Ungültiges ab', () => {
		assert.throws(() => leseAktion({ art: 'sprengen' }));
		assert.throws(() => leseAktion({ art: 'bewegen', knoten: [{ mappe: '../x', dok: 'a' }], ziel: null }));
		assert.throws(() => leseAktion({ art: 'bewegen', knoten: [{ ordner: 'x' }], ziel: null }));
		assert.deepEqual(leseAktion({ art: 'papierkorb', knoten: [{ ordner: 'o-12345678' }, { ordner: 'o-12345678' }] }), {
			art: 'papierkorb',
			knoten: [{ ordner: 'o-12345678' }],
		});
	});
});

describe('Aktion plus Umkehr ergibt denselben Baum', () => {
	const faelle = (b: ReturnType<typeof beispiel>): Aktion[] => [
		{ art: 'neu', eltern: b.k3, name: 'Hier' },
		{ art: 'neu', eltern: b.k3, name: 'Mit Inhalt', inhalt: [{ mappe: 'reihe', dok: 'a' }, { ordner: b.mathe }] },
		{ art: 'umbenennen', knoten: { ordner: b.mathe }, name: 'Rechnen' },
		{ art: 'umbenennen', knoten: { ordner: b.reihe }, name: 'Eine Reihe' },
		{ art: 'bewegen', knoten: [{ ordner: b.mathe }], ziel: null },
		{ art: 'bewegen', knoten: [{ mappe: 'reihe', dok: 'a' }, { mappe: 'los', dok: 'x' }], ziel: b.mathe },
		{ art: 'papierkorb', knoten: [{ ordner: b.reihe }, { mappe: 'los', dok: 'x' }] },
	];

	for (let i = 0; i < 7; i += 1) {
		it(`Fall ${i + 1}`, () => {
			const b = beispiel();
			const aktion = faelle(b)[i];
			assert.ok(aktion);
			const { umkehr, baum } = wendeAktionAn(b.baum, aktion, b.umg);
			assert.notDeepEqual(inhalt(baum), inhalt(b.baum));
			assert.deepEqual(inhalt(fuehreAus(baum, umkehr, b.umg)), inhalt(b.baum));
		});
	}

	it('die Umkehr der Umkehr wiederholt die Aktion', () => {
		const b = beispiel();
		const r = wendeAktionAn(b.baum, { art: 'neu', eltern: b.k3, name: 'Hier' }, b.umg);
		const [entfernen] = r.umkehr;
		assert.ok(entfernen);
		const u1 = wendeAktionAn(r.baum, entfernen, b.umg);
		assert.deepEqual(inhalt(fuehreAus(u1.baum, u1.umkehr, b.umg)), inhalt(r.baum));
	});
});

describe('Papierkorb', () => {
	it('vererbt sich auf alles darunter', () => {
		const { baum, k3, mathe, reihe, umg } = beispiel();
		const bewegt = wendeAktionAn(baum, { art: 'bewegen', knoten: [{ ordner: reihe }], ziel: mathe }, umg).baum;
		const weg = wendeAktionAn(bewegt, { art: 'papierkorb', knoten: [{ ordner: k3 }] }, umg).baum;
		assert.equal(ordnerGeloescht(weg, reihe), true);
		assert.equal(dokumentGeloescht(weg, 'reihe', 'a'), true);
		assert.equal(dokumentGeloescht(weg, 'los', 'x'), false);
	});

	it('Zurücklegen ohne Eltern: Der Pfad entsteht neu aus den Namen', () => {
		const { baum, k3, mathe, umg } = beispiel();
		const reinlegen = wendeAktionAn(baum, { art: 'bewegen', knoten: [{ mappe: 'los', dok: 'x' }], ziel: mathe }, umg).baum;
		const dokWeg = wendeAktionAn(reinlegen, { art: 'papierkorb', knoten: [{ mappe: 'los', dok: 'x' }] }, umg).baum;
		assert.deepEqual(dokWeg.dokumente['los/x']?.geloescht?.herkunft, ['Klasse 3', 'Mathe']);
		const allesWeg = wendeAktionAn(dokWeg, { art: 'papierkorb', knoten: [{ ordner: k3 }] }, umg).baum;
		const zurueck = wendeAktionAn(allesWeg, { art: 'zuruecklegen', knoten: [{ mappe: 'los', dok: 'x' }] }, umg);
		const ort = zurueck.baum.dokumente['los/x']?.ordner ?? '';
		assert.notEqual(ort, mathe);
		assert.deepEqual(
			alleOrdnerPfade(zurueck.baum).find((p) => p.id === ort)?.pfad,
			'Klasse 3/Mathe',
		);
		assert.equal(zurueck.baum.dokumente['los/x']?.geloescht, null);
	});

	it('Zurücklegen, wenn der Name inzwischen belegt ist: beide bleiben', () => {
		const { baum, umg } = beispiel();
		const weg = wendeAktionAn(baum, { art: 'papierkorb', knoten: [{ mappe: 'los', dok: 'x' }] }, umg);
		const belegt = wendeAktionAn(weg.baum, { art: 'neu', eltern: null, name: 'Einzelblatt' }, umg).baum;
		const zurueck = wendeAktionAn(belegt, { art: 'zuruecklegen', knoten: [{ mappe: 'los', dok: 'x' }] }, umg);
		assert.deepEqual(zurueck.effekte, [{ art: 'dokument-titel', mappe: 'los', dok: 'x', titel: 'Einzelblatt 2' }]);
	});

	it('Frist: erst nach 30 Tagen fällig, samt allem darunter, Eigenständiges mit eigener Frist', () => {
		const { baum, k3, mathe, reihe, umg } = beispiel();
		const bewegt = fuehreAus(
			baum,
			[
				{ art: 'bewegen', knoten: [{ ordner: reihe }], ziel: mathe },
				{ art: 'bewegen', knoten: [{ mappe: 'los', dok: 'x' }], ziel: mathe },
				{ art: 'papierkorb', knoten: [{ ordner: k3 }] },
			],
			umg,
		);
		assert.deepEqual(faelligImPapierkorb(bewegt, 30, new Date(JETZT.getTime() + 29 * TAG_MS)), { dokumente: [], ordner: [] });
		const faellig = faelligImPapierkorb(bewegt, 30, new Date(JETZT.getTime() + 30 * TAG_MS));
		assert.deepEqual(new Set(faellig.ordner), new Set([k3, mathe, reihe]));
		assert.equal(faellig.dokumente.length, 3);
	});

	it('Endlöschen: Dateien, leerer Behälter und Freigaben gehen, Behälter mit Resten bleibt', async () => {
		const materialDir = await ablage();
		const { mappe: leer } = await neueMappe(materialDir, { titel: 'Leer', fach: 'deutsch', klasse: 1 }, JETZT);
		const { mappe: reste } = await neueMappe(materialDir, { titel: 'Reste', fach: 'deutsch', klasse: 1 }, JETZT);
		const angaben = { art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] } as const;
		const eins = await neuesDokument(materialDir, leer.id, { ...angaben, titel: 'Eins' }, JETZT);
		const a = await neuesDokument(materialDir, reste.id, { ...angaben, titel: 'A' }, JETZT);
		const b = await neuesDokument(materialDir, reste.id, { ...angaben, titel: 'B' }, JETZT);
		const start = gleicheAb(null, await leseBestand(materialDir), JETZT).baum;
		const titel = { [`${leer.id}/${eins.id}`]: 'Eins', [`${reste.id}/${a.id}`]: 'A', [`${reste.id}/${b.id}`]: 'B' };
		const leerOrdner = start.ordner.find((o) => o.behaelter === leer.id)?.id ?? '';
		const weg = wendeAktionAn(
			start,
			{ art: 'papierkorb', knoten: [{ ordner: leerOrdner }, { mappe: reste.id, dok: a.id }] },
			u(titel),
		).baum;
		assert.equal(await loescheFaelligeAusBaum(materialDir, weg, 30, new Date(JETZT.getTime() + 29 * TAG_MS)), null);
		const r = await loescheFaelligeAusBaum(materialDir, weg, 30, new Date(JETZT.getTime() + 31 * TAG_MS));
		assert.ok(r);
		assert.equal(existsSync(mappenDir(materialDir, leer.id)), false);
		assert.deepEqual(r.mappen, [leer.id]);
		assert.equal(existsSync(dokumentDir(materialDir, reste.id, a.id)), false);
		assert.equal(existsSync(dokumentDir(materialDir, reste.id, b.id)), true);
		assert.deepEqual((await leseMappe(materialDir, reste.id)).dokumente, [b.id]);
		assert.equal(r.baum.dokumente[`${reste.id}/${a.id}`], undefined);
		assert.equal(r.baum.ordner.some((o) => o.id === leerOrdner), false);
	});

	it('`sammleMappen` zeigt Gelöschtes nicht, `mitGeloeschten` schon', async () => {
		const materialDir = await ablage();
		const { mappe } = await neueMappe(materialDir, { titel: 'M', fach: 'deutsch', klasse: 1 }, JETZT);
		const angaben = { art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] } as const;
		const a = await neuesDokument(materialDir, mappe.id, { ...angaben, titel: 'A' }, JETZT);
		const b = await neuesDokument(materialDir, mappe.id, { ...angaben, titel: 'B' }, JETZT);
		const start = gleicheAb(null, await leseBestand(materialDir), JETZT).baum;
		const titel = { [`${mappe.id}/${a.id}`]: 'A', [`${mappe.id}/${b.id}`]: 'B' };
		await schreibeBaum(
			materialDir,
			wendeAktionAn(start, { art: 'papierkorb', knoten: [{ mappe: mappe.id, dok: a.id }] }, u(titel)).baum,
			JETZT,
		);
		assert.deepEqual(
			(await sammleMappen(materialDir)).mappen[0]?.dokumente.map((d) => d.id),
			[b.id],
		);
		assert.equal((await sammleMappen(materialDir, { mitGeloeschten: true })).mappen[0]?.dokumente.length, 2);
	});

	it('eine gelöschte Kurzanleitung kommt nicht wieder', async () => {
		const materialDir = await ablage();
		await neueMappe(materialDir, { titel: 'Hilfe', fach: 'deutsch', klasse: 1, id: HILFE_MAPPE }, JETZT);
		const angaben = { art: 'sonstiges', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] } as const;
		await neuesDokument(materialDir, HILFE_MAPPE, { ...angaben, titel: 'Kurzanleitung' }, JETZT);
		const start = gleicheAb(null, await leseBestand(materialDir), JETZT).baum;
		const knoten = [{ mappe: HILFE_MAPPE, dok: KURZANLEITUNG }];
		await schreibeBaum(materialDir, wendeAktionAn(start, { art: 'papierkorb', knoten }, u()).baum, JETZT);
		const { stand } = await richteKurzanleitungEin({ materialDir, pythonBin: 'python3' }, JETZT);
		assert.equal(stand, 'im-papierkorb');
	});
});

describe('Kopie', () => {
	const aufbau = async () => {
		const materialDir = await ablage();
		const { mappe } = await neueMappe(materialDir, { titel: 'Reihe', fach: 'mathematik', klasse: 3 }, JETZT);
		const angaben = { art: 'arbeitsblatt', format: 'a4-hoch', druckprofil: 'farbe', druckhinweise: [] } as const;
		const a = await neuesDokument(materialDir, mappe.id, { ...angaben, titel: 'A' }, JETZT);
		const b = await neuesDokument(materialDir, mappe.id, { ...angaben, titel: 'B' }, JETZT);
		const dir = mappenDir(materialDir, mappe.id);
		await writeFile(path.join(dir, 'detektiv.css'), 'body{color:red}');
		await mkdir(path.join(dir, 'bilder'), { recursive: true });
		await writeFile(path.join(dir, 'bilder', 'igel.png'), 'bild');
		const baum = gleicheAb(null, await leseBestand(materialDir), JETZT).baum;
		const titel = { [`${mappe.id}/${a.id}`]: 'A', [`${mappe.id}/${b.id}`]: 'B' };
		const ordner = baum.ordner.find((o) => o.behaelter === mappe.id)?.id ?? '';
		return { a: a.id, b: b.id, baum, dir, materialDir, mappe: mappe.id, ordner, umg: u(titel) };
	};

	it('ist unabhängig: Thema im Original geändert, die Kopie bleibt; Bilder sind da', async () => {
		const k = await aufbau();
		const r = await kopiereKnoten(k.materialDir, k.baum, { knoten: [{ ordner: k.ordner }], ziel: null }, k.umg);
		const [neu] = r.knoten;
		assert.ok(neu && 'ordner' in neu);
		const eintrag = r.baum.ordner.find((o) => o.id === neu.ordner);
		assert.equal(eintrag?.name, 'Reihe (Kopie)');
		assert.ok(eintrag?.behaelter && eintrag.behaelter !== k.mappe);
		const kopie = mappenDir(k.materialDir, eintrag.behaelter);
		await writeFile(path.join(k.dir, 'detektiv.css'), 'body{color:blue}');
		assert.equal(await readFile(path.join(kopie, 'detektiv.css'), 'utf8'), 'body{color:red}');
		assert.ok(existsSync(path.join(kopie, 'bilder', 'igel.png')));
		assert.deepEqual((await leseMappe(k.materialDir, eintrag.behaelter)).dokumente, [k.a, k.b]);
	});

	it('nimmt nur die gewählten Dokumente mit und hält die Reihenfolge in `erstellt`', async () => {
		const k = await aufbau();
		const andere = wendeAktionAn(k.baum, { art: 'neu', eltern: null, name: 'Ziel' }, k.umg);
		const r = await kopiereKnoten(
			k.materialDir,
			andere.baum,
			{ knoten: [{ mappe: k.mappe, dok: k.b }], ziel: andere.neu ?? null },
			k.umg,
		);
		const [neu] = r.knoten;
		assert.ok(neu && 'dok' in neu);
		assert.equal(r.baum.dokumente[`${neu.mappe}/${neu.dok}`]?.ordner, andere.neu);
		const eintrag = await leseMappenEintrag(k.materialDir, neu.mappe);
		assert.deepEqual(eintrag.mappe.dokumente, [k.b]);
		assert.equal(existsSync(dokumentDir(k.materialDir, neu.mappe, k.b)), true);
		assert.equal(existsSync(path.join(mappenDir(k.materialDir, neu.mappe), 'dokumente', k.a)), false);
	});

	it('Rückgängig legt die Kopie in den Papierkorb, nichts geht verloren', async () => {
		const k = await aufbau();
		const r = await kopiereKnoten(k.materialDir, k.baum, { knoten: [{ ordner: k.ordner }], ziel: null }, k.umg);
		assert.equal(r.umkehr[0]?.art, 'papierkorb');
	});

	it('zweite Kopie: „(Kopie 2)“; Kopie in sich selbst geht nicht', async () => {
		const k = await aufbau();
		const r = await kopiereKnoten(k.materialDir, k.baum, { knoten: [{ ordner: k.ordner }], ziel: null }, k.umg);
		const s = await kopiereKnoten(k.materialDir, r.baum, { knoten: [{ ordner: k.ordner }], ziel: null }, k.umg);
		assert.ok(s.baum.ordner.some((o) => o.name === 'Reihe (Kopie 2)'));
		await assert.rejects(
			kopiereKnoten(k.materialDir, k.baum, { knoten: [{ ordner: k.ordner }], ziel: k.ordner }, k.umg),
			/in sich selbst/,
		);
	});
});

describe('Sicherung', () => {
	const baumMit = (rev: number): Baum => ({ ...leererBaum(), rev });

	it('höchstens stündlich, vor dem Löschen immer, die letzten 50 bleiben', async () => {
		const materialDir = await ablage();
		await schreibeBaum(materialDir, baumMit(1), JETZT);
		assert.equal(sicherungen(materialDir).length, 0);
		await schreibeBaum(materialDir, baumMit(2), JETZT);
		assert.equal(sicherungen(materialDir).length, 1);
		await schreibeBaum(materialDir, baumMit(3), new Date(JETZT.getTime() + 1000));
		assert.equal(sicherungen(materialDir).length, 1);
		await schreibeBaum(materialDir, baumMit(4), new Date(JETZT.getTime() + 2000), true);
		assert.equal(sicherungen(materialDir).length, 2);
		await schreibeBaum(materialDir, baumMit(5), new Date(JETZT.getTime() + 2 * 60 * 60 * 1000));
		assert.equal(sicherungen(materialDir).length, 3);
		for (let i = 0; i < 55; i += 1) {
			await schreibeBaum(materialDir, baumMit(i), new Date(JETZT.getTime() + 5000 + i * 2000), true);
		}
		assert.equal(sicherungen(materialDir).length, 50);
	});

	it('kaputte Datei: beiseitegelegt, neueste gültige Sicherung, sichtbare Meldung', async () => {
		const materialDir = await ablage();
		await schreibeBaum(materialDir, baumMit(1), JETZT);
		await schreibeBaum(materialDir, baumMit(2), JETZT);
		await mkdir(path.join(materialDir, ORDNER_SICHERUNG), { recursive: true });
		await writeFile(path.join(materialDir, ORDNER_SICHERUNG, '2027-01-01T00-00-00-000Z.json'), 'kaputt');
		await writeFile(path.join(materialDir, ORDNER_DATEI), '{ nicht json');
		const { baum, hinweis } = ladeBaum(materialDir, JETZT);
		assert.equal(baum?.rev, 1);
		assert.match(hinweis ?? '', /aus der Sicherung von/);
		assert.ok((await readdir(materialDir)).some((n) => n.startsWith('_ordner.defekt-')));
		assert.equal(existsSync(path.join(materialDir, ORDNER_DATEI)), false);
	});

	it('kaputt und keine Sicherung: neu aufbauen, aber sagen', async () => {
		const materialDir = await ablage();
		await writeFile(path.join(materialDir, ORDNER_DATEI), '[]');
		const { baum, hinweis } = ladeBaum(materialDir, JETZT);
		assert.equal(baum, null);
		assert.match(hinweis ?? '', /neu aufgebaut/);
	});
});

describe('Zugriff', () => {
	it('dokumenteVonZiel: Ordner mit Unterordnern, Herausbewegtes fehlt, alter Mappen-Link folgt dem Ordner', () => {
		const { baum, k3, mathe, reihe, umg } = beispiel();
		const b = fuehreAus(
			baum,
			[
				{ art: 'bewegen', knoten: [{ ordner: mathe }], ziel: k3 },
				{ art: 'bewegen', knoten: [{ ordner: reihe }], ziel: mathe },
			],
			umg,
		);
		const ids = (ziel: Parameters<typeof dokumenteVonZiel>[1], baumHier = b) =>
			dokumenteVonZiel(baumHier, ziel)
				.map((d) => d.dok)
				.sort();
		assert.deepEqual(ids({ ordner: k3 }), ['a', 'b']);
		assert.deepEqual(ids({ mappe: 'reihe', dok: null }), ['a', 'b']);
		const raus = wendeAktionAn(b, { art: 'bewegen', knoten: [{ mappe: 'reihe', dok: 'a' }], ziel: null }, umg).baum;
		assert.deepEqual(ids({ ordner: k3 }, raus), ['b']);
		assert.deepEqual(ids({ mappe: 'reihe', dok: null }, raus), ['b']);
		const weg = wendeAktionAn(b, { art: 'papierkorb', knoten: [{ ordner: k3 }] }, umg).baum;
		assert.deepEqual(ids({ ordner: k3 }, weg), []);
		assert.deepEqual(ids({ mappe: 'reihe', dok: 'a' }, weg), []);
		assert.equal(lebenderOrdner(weg, mathe), null);
	});

	it('`baumZumLesen` zeigt Neues, ohne zu schreiben', async () => {
		const materialDir = await ablage();
		await neueMappe(materialDir, { titel: 'Uhr', fach: 'mathematik', klasse: 3, ablage: 'Klasse 3' }, JETZT);
		const baum = await baumZumLesen(materialDir);
		assert.deepEqual(
			alleOrdnerPfade(baum).map((p) => p.pfad),
			['Klasse 3', 'Klasse 3/Uhr'],
		);
		assert.equal(existsSync(path.join(materialDir, ORDNER_DATEI)), false);
	});

	it('`pruefeAblagePfad` räumt auf', () => {
		assert.equal(pruefeAblagePfad(undefined), undefined);
		assert.equal(pruefeAblagePfad(' Klasse 3 / Mathe/ '), 'Klasse 3/Mathe');
		assert.throws(() => pruefeAblagePfad('x'.repeat(121)));
	});
});

describe('Freigaben auf Ordner', () => {
	it('stehen in einer zweiten Liste: `_freigaben.json` besteht das alte Schema', async () => {
		const materialDir = await ablage();
		const { mappe } = await neueMappe(materialDir, { titel: 'M', fach: 'deutsch', klasse: 1 }, JETZT);
		const start = gleicheAb(null, await leseBestand(materialDir), JETZT).baum;
		await schreibeBaum(materialDir, start, JETZT);
		const ordner = start.ordner[0]?.id ?? '';
		await legeFreigabeAn(materialDir, { mappe: mappe.id, dok: null }, JETZT);
		const link = await legeFreigabeAn(materialDir, { ordner }, JETZT);
		const roh = JSON.parse(await readFile(path.join(materialDir, '_freigaben.json'), 'utf8')) as {
			freigaben: unknown[];
			ordnerFreigaben: unknown[];
		};
		assert.equal(roh.freigaben.length, 1);
		assert.equal(roh.ordnerFreigaben.length, 1);
		assert.deepEqual(pruefeSchema(FREIGABEN_SCHEMA, roh), []);
		assert.equal((await leseFreigaben(materialDir)).find((f) => f.token === link.token)?.ziel && true, true);
		await assert.rejects(legeFreigabeAn(materialDir, { ordner: 'o-00000000' }, JETZT), /gibt es nicht/);
	});
});
