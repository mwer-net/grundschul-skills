import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit, FORM, KOPFBAND, SEITENFLAECHE, SEITENRAHMEN, STREUUNG } from '../../web/e2e/gestaltung-daten';
import { klassenVon, zerlege } from './quelltext';
import type { Kopfband } from './seitengestaltung';
import {
	bleibtNummer,
	istFarbe,
	KOPFBAND_FORMEN,
	leseSeitengestaltung,
	setzeKopfband,
	setzeSeitenflaeche,
	setzeSeitenrahmen,
} from './seitengestaltung';
import { fuegeSeiteEin } from './struktur';

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
		});
		assert.equal(g.rahmen?.art, 'gestrichelt');
		assert.equal(g.rahmen?.farbe, 'var(--dunkel)');
		assert.equal(g.rahmen?.abstand, 24);
		assert.deepEqual(leseSeitengestaltung(blattMit(), seitenNr(blattMit())[0] ?? 0), {
			flaeche: null,
			rahmen: null,
			kopfband: null,
		});
	});

	it('ändert die Werte am Ort und lässt fremde Attribute stehen', () => {
		const quelle = blattMit({
			hinten: [SEITENFLAECHE.replace('class="seitenflaeche" ', 'class="seitenflaeche" data-name="Grund" ')],
		});
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

/** Die eingefrorene Probe eines Blatts mit Rezept (180): Kopfband Welle am `.kopf`, Farben `--a1` und `--a2`. */
const PROBE = readFileSync(path.join(__dirname, 'testdaten', 'bestand-aufmachung.html'), 'utf8');
const bodyTag = (quelle: string) => /<body[^>]*>/.exec(quelle)?.[0] ?? '';

const ROT: Kopfband = { form: 'gerade', art: 'farbe', f1: '#ff0000', hoehe: 200 };
const WELLE: Kopfband = { form: 'welle', art: 'verlauf', f1: '#ffe0b8', f2: '#fff7e6', winkel: 90, hoehe: 200 };

describe('Kopfband (181)', () => {
	it('schreibt das Band nach Fläche und Rahmen, ohne Standardwerte', () => {
		const leer = blattMit();
		const [seite = 0] = seitenNr(leer);
		const mitFlaeche = setzeKopfband(setzeSeitenflaeche(leer, [seite], VERLAUF), [seite], ROT);
		assert.deepEqual(hinten(mitFlaeche), [['seitenflaeche', 'kopfband']]);
		const erwartet = `    ${SEITENFLAECHE}\n    <div class="kopfband" style="--f1:#ff0000;--h:200px"></div>`;
		assert.ok(mitFlaeche.includes(erwartet));
		// Gegenprobe: Ein Rahmen, den man danach setzt, steht zwischen Fläche und Kopfband.
		const mitRahmen = setzeSeitenrahmen(mitFlaeche, [seite], GESTRICHELT);
		assert.deepEqual(hinten(mitRahmen), [['seitenflaeche', 'seitenrahmen', 'kopfband']]);
		// Verlauf: Formen und Fläche als Attribut, der Winkel 90 nicht.
		const welle = setzeKopfband(leer, [seite], WELLE);
		assert.ok(
			welle.includes(
				'<div class="kopfband" data-form="welle" data-flaeche="verlauf" style="--f1:#ffe0b8;--f2:#fff7e6;--h:200px"></div>',
			),
		);
		const schraeg = setzeKopfband(leer, [seite], { ...WELLE, winkel: 135, sw: 'grau' });
		assert.ok(schraeg.includes('data-sw="grau" style="--f1:#ffe0b8;--f2:#fff7e6;--winkel:135deg;--h:200px"'));
	});

	it('liegt vor Streuungen, die schon hinten liegen', () => {
		const quelle = blattMit({ hinten: [STREUUNG] });
		const neu = setzeKopfband(quelle, seitenNr(quelle), ROT);
		assert.deepEqual(hinten(neu), [['kopfband', 'streuung']]);
	});

	it('entfernt mit null das Band und die leere Ebene, mit „alle“ auf jeder Seite', () => {
		const leer = zweiSeiten(blattMit());
		const beide = setzeKopfband(leer, 'alle', ROT);
		assert.deepEqual(hinten(beide), [['kopfband'], ['kopfband']]);
		const [erste = 0] = seitenNr(beide);
		assert.deepEqual(hinten(setzeKopfband(beide, [erste], null)), [null, ['kopfband']]);
		assert.equal(setzeKopfband(beide, 'alle', null), leer);
		assert.equal(setzeKopfband(leer, 'alle', null), leer);
	});

	it('liest, was es geschrieben hat: alle Formen, Farbe und Verlauf, Grau in s/w', () => {
		const leer = blattMit();
		const [seite = 0] = seitenNr(leer);
		for (const form of KOPFBAND_FORMEN) {
			for (const wert of [
				{ ...ROT, form },
				{ ...WELLE, form, winkel: 45, sw: 'grau' as const },
			]) {
				const neu = setzeKopfband(leer, [seite], wert);
				const gelesen = leseSeitengestaltung(neu, seite).kopfband;
				assert.ok(gelesen);
				assert.equal(gelesen.form, form);
				assert.equal(gelesen.art, wert.art);
				assert.equal(gelesen.f1, wert.f1);
				assert.equal(gelesen.hoehe, 200);
				assert.equal(gelesen.sw ?? null, wert.sw ?? null);
				if (wert.art === 'verlauf') {
					assert.equal(gelesen.f2, wert.f2);
					assert.equal(gelesen.winkel, 45);
				}
				// Ein zweites Schreiben desselben Werts ändert nichts.
				assert.equal(setzeKopfband(neu, [seite], gelesen), neu);
			}
		}
		// Das Beispiel aus den Testdaten liest sich so, wie es dasteht.
		const beispiel = blattMit({ hinten: [KOPFBAND] });
		assert.deepEqual(leseSeitengestaltung(beispiel, seitenNr(beispiel)[0] ?? 0).kopfband, {
			form: 'welle',
			art: 'verlauf',
			f1: '#ffe0b8',
			f2: '#fff7e6',
			winkel: null,
			hoehe: 200,
			sw: null,
		});
	});

	it('nimmt nur Farben der Palette und Hex', () => {
		const quelle = blattMit();
		assert.throws(() => setzeKopfband(quelle, seitenNr(quelle), { ...ROT, f1: 'red;top:0' }));
	});

	it('liest das alte Band eines Rezepts, ohne `.kopf` keins', () => {
		const [seite = 0] = seitenNr(PROBE);
		assert.deepEqual(leseSeitengestaltung(PROBE, seite).kopfband, {
			form: 'welle',
			art: 'verlauf',
			f1: '#1d3557',
			f2: '#f77f00',
			winkel: 90,
			hoehe: null,
			bestand: true,
		});
		const ohneKopf = PROBE.replace('<div class="kopf">', '<div class="kopfzeile">');
		assert.notEqual(ohneKopf, PROBE);
		assert.equal(leseSeitengestaltung(ohneKopf, seitenNr(ohneKopf)[0] ?? 0).kopfband, null);
	});

	it('lässt den body der Probe mit einem Wert gleich, mit null fällt das alte Band weg', () => {
		const seiten = seitenNr(PROBE);
		const neu = setzeKopfband(PROBE, seiten, { ...WELLE, f1: '#1d3557', f2: '#f77f00', hoehe: 224.17 });
		assert.equal(bodyTag(neu), bodyTag(PROBE));
		assert.ok(neu.includes('style="--f1:#1d3557;--f2:#f77f00;--h:224.17px"'));
		// Gegenprobe: Mit null ändert sich der body.
		const ohne = setzeKopfband(neu, seiten, null);
		const body = bodyTag(ohne);
		assert.notEqual(body, bodyTag(PROBE));
		assert.ok(!ohne.includes('class="kopfband"'));
		assert.ok(!body.includes('data-aufmachung-kopfband'));
		assert.ok(!body.includes('--a-titel'));
		assert.ok(!body.includes('--kopfband-'));
		for (const bleibt of ['data-aufmachung="detektiv"', '--a1:', '--a2:', '--a3:', '--a4:', '--a-flaeche:']) {
			assert.ok(body.includes(bleibt), bleibt);
		}
		// Auch ohne neues Element: null nimmt das alte Band direkt weg.
		assert.equal(bodyTag(setzeKopfband(PROBE, seiten, null)), body);
	});

	it('eine neue Seite bekommt kein Kopfband', () => {
		const quelle = blattMit({ hinten: [KOPFBAND] });
		const neu = fuegeSeiteEin(quelle, { nach: null, mitNamenszeile: false }, { jeSeite: false }).quelle;
		assert.equal(seitenNr(neu).length, 2);
		assert.deepEqual(hinten(neu), [['kopfband'], null]);
	});
});
