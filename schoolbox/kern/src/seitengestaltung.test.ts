import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FORM, SEITENFLAECHE, SEITENRAHMEN, STREUUNG } from '../../web/e2e/gestaltung-daten';
import { klassenVon, zerlege } from './quelltext';
import {
	bleibtNummer,
	istFarbe,
	leseSeitengestaltung,
	setzeSeitenflaeche,
	setzeSeitenrahmen,
} from './seitengestaltung';

const seitenNr = (quelle: string) =>
	zerlege(quelle)
		.knoten.filter((k) => klassenVon(k).includes('seite'))
		.map((k) => k.nr);

/** Zwei Seiten aus `blattMit`: die zweite ist eine Kopie der ersten. */
const zweiSeiten = (quelle: string) => {
	const anfang = quelle.indexOf('<section class="seite">');
	const ende = quelle.indexOf('</section>') + '</section>'.length;
	const seite = quelle.slice(anfang, ende);
	return `${quelle.slice(0, ende)}\n${seite}${quelle.slice(ende)}`;
};

/** Klassen der Kinder von `.ebene.hinten` je Seite, `null` ohne Ebene. */
const hinten = (quelle: string) =>
	zerlege(quelle)
		.knoten.filter((k) => klassenVon(k).includes('seite'))
		.map((s) => {
			const e = s.kinder.find((k) => klassenVon(k).includes('ebene') && klassenVon(k).includes('hinten'));
			return e ? e.kinder.map((k) => klassenVon(k)[0] ?? '') : null;
		});

const VERLAUF = { art: 'verlauf', f1: '#fff7e6', f2: '#ffe0b8', winkel: 180 } as const;
const GESTRICHELT = { art: 'gestrichelt', farbe: 'var(--dunkel)', staerke: 3, abstand: 24, ecke: 16 } as const;

describe('Seitenfläche und Seitenrahmen', () => {
	it('schreibt das Format aus 3.6 und legt die Ebene hinten an', () => {
		const leer = blattMit();
		const [seite = 0] = seitenNr(leer);
		const mitFlaeche = setzeSeitenflaeche(leer, [seite], VERLAUF);
		assert.ok(mitFlaeche.includes(`<div class="ebene hinten">\n    ${SEITENFLAECHE}\n  </div>\n</section>`));
		const mitBeiden = setzeSeitenrahmen(mitFlaeche, [seite], GESTRICHELT);
		assert.ok(mitBeiden.includes(`    ${SEITENFLAECHE}\n    ${SEITENRAHMEN}\n  </div>`));
		assert.deepEqual(hinten(mitBeiden), [['seitenflaeche', 'seitenrahmen']]);
	});

	it('liest, was es geschrieben hat', () => {
		const quelle = blattMit({ hinten: [SEITENFLAECHE, SEITENRAHMEN] });
		const [seite = 0] = seitenNr(quelle);
		const g = leseSeitengestaltung(quelle, seite);
		assert.deepEqual(g.flaeche, {
			art: 'verlauf',
			f1: '#fff7e6',
			f2: '#ffe0b8',
			winkel: 180,
			muster: null,
			musterGroesse: null,
			sw: null,
			rezept: false,
		});
		assert.equal(g.rahmen?.art, 'gestrichelt');
		assert.equal(g.rahmen?.farbe, 'var(--dunkel)');
		assert.equal(g.rahmen?.abstand, 24);
		assert.deepEqual(leseSeitengestaltung(blattMit(), seitenNr(blattMit())[0] ?? 0), { flaeche: null, rahmen: null });
	});

	it('ändert die Werte am Ort und lässt fremde Attribute stehen', () => {
		const quelle = blattMit({ hinten: [SEITENFLAECHE.replace('<div ', '<div data-name="Grund" ')] });
		const [seite = 0] = seitenNr(quelle);
		const neu = setzeSeitenflaeche(quelle, [seite], {
			art: 'muster',
			f1: '#ffffff',
			f2: 'var(--haupt)',
			muster: 'punkte',
			musterGroesse: 20,
			sw: 'grau',
		});
		assert.ok(
			neu.includes(
				'<div class="seitenflaeche" data-name="Grund" data-flaeche="muster" data-muster="punkte" data-sw="grau" style="--f1:#ffffff;--f2:var(--haupt);--muster-groesse:20px"></div>',
			),
		);
		assert.equal(setzeSeitenflaeche(neu, [seite], leseSeitengestaltung(neu, seite).flaeche), neu);
	});

	it('entfernt Fläche und Rahmen, mit dem letzten Teil die Ebene', () => {
		const leer = blattMit();
		const [seite = 0] = seitenNr(leer);
		const beide = setzeSeitenrahmen(setzeSeitenflaeche(leer, [seite], VERLAUF), [seite], GESTRICHELT);
		const ohneFlaeche = setzeSeitenflaeche(beide, [seite], null);
		assert.deepEqual(hinten(ohneFlaeche), [['seitenrahmen']]);
		assert.equal(setzeSeitenrahmen(ohneFlaeche, [seite], null), leer);
		assert.equal(setzeSeitenflaeche(leer, [seite], null), leer);
	});

	it('legt Fläche und Rahmen zuunterst, auch wenn hinten schon Gestaltung liegt', () => {
		const quelle = blattMit({ hinten: [STREUUNG], vorne: [FORM] });
		const [seite = 0] = seitenNr(quelle);
		const neu = setzeSeitenflaeche(setzeSeitenrahmen(quelle, [seite], GESTRICHELT), [seite], VERLAUF);
		assert.deepEqual(hinten(neu), [['seitenflaeche', 'seitenrahmen', 'streuung']]);
		// Ohne Ebene hinten entsteht sie vor der Ebene vorne.
		const nurVorne = blattMit({ vorne: [FORM] });
		const mit = setzeSeitenflaeche(nurVorne, seitenNr(nurVorne), VERLAUF);
		assert.ok(mit.indexOf('ebene hinten') < mit.indexOf('ebene vorne'));
		assert.equal(setzeSeitenflaeche(mit, seitenNr(mit), null), nurVorne);
	});

	it('setzt mit „alle“ jede Seite und entfernt auf jeder', () => {
		const leer = zweiSeiten(blattMit());
		const beide = setzeSeitenrahmen(setzeSeitenflaeche(leer, 'alle', VERLAUF), 'alle', GESTRICHELT);
		assert.deepEqual(hinten(beide), [
			['seitenflaeche', 'seitenrahmen'],
			['seitenflaeche', 'seitenrahmen'],
		]);
		const [, zweite = 0] = seitenNr(beide);
		const nurZweite = setzeSeitenflaeche(beide, [zweite], { ...VERLAUF, winkel: 90 });
		assert.equal(leseSeitengestaltung(nurZweite, seitenNr(nurZweite)[0] ?? 0).flaeche?.winkel, 180);
		assert.equal(leseSeitengestaltung(nurZweite, zweite).flaeche?.winkel, 90);
		assert.equal(setzeSeitenrahmen(setzeSeitenflaeche(beide, 'alle', null), 'alle', null), leer);
	});

	it('macht aus Teilen eines Rezepts beim Ändern eigene (114)', () => {
		const rezept = SEITENFLAECHE.replace('<div ', '<div data-aufmachung-teil="flaeche" data-gesperrt ');
		const quelle = blattMit({ hinten: [rezept] });
		const [seite = 0] = seitenNr(quelle);
		assert.equal(leseSeitengestaltung(quelle, seite).flaeche?.rezept, true);
		const eigen = setzeSeitenflaeche(quelle, [seite], { art: 'farbe', f1: '#000000' });
		assert.equal(leseSeitengestaltung(eigen, seite).flaeche?.rezept, false);
		assert.ok(!eigen.includes('data-gesperrt'));
		assert.deepEqual(hinten(setzeSeitenflaeche(quelle, 'alle', null)), [null]);
		// Der Rahmen kommt über die Fläche des Rezepts.
		assert.deepEqual(hinten(setzeSeitenrahmen(quelle, [seite], GESTRICHELT)), [['seitenflaeche', 'seitenrahmen']]);
	});

	it('nimmt nur Farben der Palette und Hex', () => {
		assert.ok(istFarbe('var(--fuell)'));
		assert.ok(istFarbe('#FFF7E6'));
		assert.ok(!istFarbe('red;background:url(x)'));
		const quelle = blattMit();
		assert.throws(() => setzeSeitenflaeche(quelle, seitenNr(quelle), { art: 'farbe', f1: 'url(x)' }));
		assert.throws(() => setzeSeitenflaeche(quelle, [0], { art: 'farbe', f1: '#fff' }));
	});

	it('behält die Nummer der Auswahl auf derselben Seite', () => {
		const leer = zweiSeiten(blattMit());
		const [erste = 0, zweite = 0] = seitenNr(leer);
		const neu = setzeSeitenflaeche(leer, [erste], VERLAUF);
		const aufgabe = zerlege(leer).knoten.find((k) => klassenVon(k).includes('aufgabe'));
		assert.ok(aufgabe);
		assert.ok(bleibtNummer(leer, neu, erste));
		assert.ok(bleibtNummer(leer, neu, aufgabe.nr));
		assert.ok(!bleibtNummer(leer, neu, zweite));
	});
});
