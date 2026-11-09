import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BILD_FREI, blattMit, FORM, FORM_TEXT } from '../../web/e2e/gestaltung-daten';
import {
	bildInForm,
	bildrahmenHtml,
	fuelleBildrahmen,
	legeBildrahmen,
	leseBildrahmen,
	setzeAusschnitt,
	setzeMaske,
	setzeRahmenstil,
	setzeZuschnittZurueck,
} from './bildrahmen';
import { pruefeFreiesHtml } from './frei';
import { leseLage } from './gestaltung';
import type { Knoten } from './quelltext';
import { attribut, klassenVon, zerlege } from './quelltext';
import { bausteinVonKnoten } from './referenz';

const BILD = { src: 'bilder/marktplatz.jpg', alt: 'Marktplatz' };

const RAHMEN =
	'<div class="bildrahmen platzhalter" data-lage="frei" data-maske="stern" data-zacken="5" data-innen="0.45" data-name="Foto" style="--x:500px;--y:300px;--b:220px;--h:220px;--drehen:8deg;clip-path:polygon(50% 0%, 100% 100%, 0% 100%)"></div>';
const DAVOR = '<svg class="form" data-lage="frei" data-form="ellipse" viewBox="0 0 80 80" style="--x:10px;--y:10px;--b:80px;--h:80px"><path d="M40 0 Z"/></svg>';
const DAHINTER = '<div class="schmuck" data-lage="frei" style="--x:40px;--y:40px">Hallo</div>';

const finde = (quelle: string, passt: (k: Knoten) => boolean) => {
	const k = zerlege(quelle).knoten.find(passt);
	assert.ok(k, 'Element nicht gefunden');
	return k;
};

const mitKlasse = (klasse: string) => (k: Knoten) => klassenVon(k).includes(klasse);

/** Die Gestaltung der vorderen Ebene in ihrer Reihenfolge, als Tag und erste Klasse. */
const vorneListe = (quelle: string) => {
	const ebene = finde(quelle, (k) => klassenVon(k).includes('ebene') && klassenVon(k).includes('vorne'));
	return ebene.kinder.map((k) => `${k.tag}.${klassenVon(k)[0] ?? ''}`);
};

const element = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return quelle.slice(k.start, k.ende);
};

describe('Bildrahmen (111)', () => {
	it('fuelleBildrahmen: Der Rahmen wird zum Bild, Lage, Drehung, Maske, Ebene und Reihenfolge bleiben', () => {
		const vorher = blattMit({ vorne: [DAVOR, RAHMEN, DAHINTER] });
		const rahmen = finde(vorher, mitKlasse('bildrahmen'));
		const r = fuelleBildrahmen(vorher, rahmen.nr, BILD);
		assert.equal(r.nr, rahmen.nr);
		const html = element(r.quelle, r.nr ?? -1);
		assert.match(html, /^<img class="bild-frei" data-lage="frei"/);
		assert.match(html, /data-maske="stern"/);
		assert.match(html, /data-zacken="5"/);
		assert.match(html, /data-name="Foto"/);
		assert.match(html, /src="bilder\/marktplatz\.jpg" alt="Marktplatz"/);
		assert.match(html, /clip-path:polygon\(/);
		assert.ok(!html.includes('platzhalter'));
		assert.deepEqual(leseLage(r.quelle, r.nr ?? -1), { x: 500, y: 300, b: 220, h: 220, drehen: 8 });
		assert.deepEqual(vorneListe(r.quelle), ['svg.form', 'img.bild-frei', 'div.schmuck']);
		assert.deepEqual(pruefeFreiesHtml(html), []);
	});

	it('bildInForm: Die Form verschwindet, das Bild liegt mit ihrer Lage und Form an ihrer Stelle', () => {
		const vorher = blattMit({ vorne: [DAVOR, FORM, DAHINTER] });
		const form = finde(vorher, (k) => k.tag === 'svg' && attribut(k, 'data-form')?.wert === 'stern');
		const r = bildInForm(vorher, form.nr, BILD);
		const html = element(r.quelle, r.nr ?? -1);
		assert.match(html, /^<img class="bild-frei" data-lage="frei" data-zacken="5" data-innen="0\.45" data-maske="stern"/);
		assert.ok(!html.includes('viewBox') && !html.includes('<path'));
		assert.deepEqual(leseLage(r.quelle, r.nr ?? -1), { x: 610, y: 84, b: 120, h: 120, drehen: 12 });
		assert.deepEqual(vorneListe(r.quelle), ['svg.form', 'img.bild-frei', 'div.schmuck']);
		assert.ok(!r.quelle.includes('data-form="stern"'));
		assert.deepEqual(pruefeFreiesHtml(html), []);
	});

	it('bildInForm: der Kreis wird ellipse(), Formen mit Text gehen nicht', () => {
		const kreis = '<svg class="form" data-lage="frei" data-form="ellipse" viewBox="0 0 100 100" style="--x:20px;--y:20px;--b:100px;--h:100px"><path d="M50 0 Z"/></svg>';
		const vorher = blattMit({ vorne: [kreis, FORM_TEXT] });
		const r = bildInForm(vorher, finde(vorher, mitKlasse('form')).nr, BILD);
		assert.match(element(r.quelle, r.nr ?? -1), /clip-path:ellipse\(50% 50% at 50% 50%\)/);
		assert.throws(() => bildInForm(vorher, finde(vorher, mitKlasse('form-text')).nr, BILD));
	});

	it('Maske und Rahmen-Stil schließen sich aus', () => {
		const vorher = blattMit({ vorne: [BILD_FREI] });
		const nr = finde(vorher, mitKlasse('bild-frei')).nr;
		const mitStil = setzeRahmenstil(vorher, nr, 'polaroid');
		assert.equal(leseBildrahmen(mitStil, nr)?.rahmenstil, 'polaroid');
		const mitMaske = setzeMaske(mitStil, nr, 'herz');
		assert.deepEqual(
			[leseBildrahmen(mitMaske, nr)?.rahmenstil, leseBildrahmen(mitMaske, nr)?.maske],
			[null, 'herz'],
		);
		assert.match(element(mitMaske, nr), /clip-path:polygon\(/);
		const wieder = setzeRahmenstil(mitMaske, nr, 'kontur');
		const html = element(wieder, nr);
		assert.ok(!html.includes('data-maske') && !html.includes('clip-path'), html);
		assert.equal(leseBildrahmen(wieder, nr)?.rahmenstil, 'kontur');
		// Gerade nimmt den Stil weg; das Bild ist dann wie vorher.
		assert.equal(setzeRahmenstil(setzeRahmenstil(vorher, nr, 'polaroid'), nr, null), vorher);
		assert.equal(setzeMaske(setzeMaske(vorher, nr, 'stern'), nr, null), vorher);
	});

	it('Wechsel der Maske nimmt die Parameter der alten mit', () => {
		const vorher = blattMit({ vorne: [BILD_FREI] });
		const nr = finde(vorher, mitKlasse('bild-frei')).nr;
		const stern = setzeMaske(vorher, nr, 'stern', { 'data-zacken': 7 });
		assert.match(element(stern, nr), /data-zacken="7"/);
		const wolke = setzeMaske(stern, nr, 'wolke');
		assert.ok(!element(wolke, nr).includes('data-zacken'));
		assert.match(element(wolke, nr), /data-bogen="6"/);
	});

	it('„schräg“ dreht ein gerade liegendes Bild um −3°, ein gedrehtes bleibt', () => {
		const gerade = blattMit({ vorne: [BILD_FREI.replace(';--drehen:-3deg', '')] });
		const nr = finde(gerade, mitKlasse('bild-frei')).nr;
		assert.equal(leseLage(setzeRahmenstil(gerade, nr, 'schraeg'), nr).drehen, -3);
		const gedreht = blattMit({ vorne: [BILD_FREI.replace('-3deg', '10deg')] });
		assert.equal(leseLage(setzeRahmenstil(gedreht, nr, 'schraeg'), nr).drehen, 10);
		assert.throws(() => setzeRahmenstil(blattMit({ vorne: [RAHMEN] }), nr, 'rund'));
	});

	it('Ausschnitt in Prozent 0–100, Zuschnitt zurücksetzen nimmt --h, --bx, --by weg', () => {
		const vorher = blattMit({ vorne: [BILD_FREI.replace('--b:420px', '--b:420px;--h:200px')] });
		const nr = finde(vorher, mitKlasse('bild-frei')).nr;
		const mit = setzeAusschnitt(vorher, nr, 130, 24.4);
		assert.match(element(mit, nr), /--bx:100%;--by:24%/);
		assert.equal(leseBildrahmen(mit, nr)?.zuschnitt, true);
		const zurueck = setzeZuschnittZurueck(mit, nr);
		assert.ok(!/--h:|--bx|--by/.test(element(zurueck, nr)));
		assert.equal(leseBildrahmen(zurueck, nr)?.zuschnitt, false);
	});

	it('legeBildrahmen legt einen grauen Rahmen vorne ab; der Baustein „platzhalter“ erkennt ihn nicht', () => {
		const vorher = blattMit();
		const seite = finde(vorher, mitKlasse('seite')).nr;
		const r = legeBildrahmen(vorher, { seite, form: 'ellipse', lage: { x: 100, y: 200 } });
		const html = element(r.quelle, r.nr ?? -1);
		assert.match(html, /^<div class="bildrahmen platzhalter" data-lage="frei" data-maske="ellipse"/);
		assert.match(html, /clip-path:ellipse\(50% 50% at 50% 50%\)/);
		assert.deepEqual(vorneListe(r.quelle), ['div.bildrahmen']);
		const k = zerlege(r.quelle).knoten[r.nr ?? -1];
		assert.ok(k);
		assert.equal(bausteinVonKnoten(k, false)?.art, 'bildrahmen');
		// Ein Bildplatzhalter im Stapel bleibt, was er war.
		const stapel = blattMit({ stapel: ['<div class="platzhalter" style="--h:120px">Bild: Blume</div>'] });
		assert.equal(bausteinVonKnoten(finde(stapel, mitKlasse('platzhalter')), false)?.art, 'platzhalter');
		assert.deepEqual(pruefeFreiesHtml(bildrahmenHtml({ form: 'stern', b: 200, h: 200 })), []);
	});

	it('ein leerer Rahmen braucht eine Form', () => {
		const vorher = blattMit({ vorne: [RAHMEN] });
		const nr = finde(vorher, mitKlasse('bildrahmen')).nr;
		assert.throws(() => setzeMaske(vorher, nr, null));
		const wolke = setzeMaske(vorher, nr, 'wolke');
		assert.equal(leseBildrahmen(wolke, nr)?.maske, 'wolke');
		assert.equal(leseBildrahmen(wolke, nr)?.leer, true);
	});
});
