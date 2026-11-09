import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FIGUR_ANKER, FIGUR_FREI, FLAECHE, FORM } from '../../web/e2e/gestaltung-daten';
import { ankerVon, istAnkerbar } from './anker';
import { KIT_KATALOG } from './bausteine';
import {
	ausFlaeche,
	FLAECHE_MIN,
	flaecheVon,
	hoeheUm,
	inFlaeche,
	inNeueFlaeche,
	istFlaeche,
	legeFlaeche,
	leseFlaechenHoehe,
	setzeFlaechenHoehe,
} from './flaeche';
import { leseLage } from './gestaltung';
import { gestaltungArtNach } from './gestaltung-arten';
import { klassenVon, zerlege } from './quelltext';

const N = { jeSeite: false };
const LEER = '<div class="flaeche" style="--h:280px"></div>';

const nrMit = (quelle: string, klasse: string, i = 0) => {
	const k = zerlege(quelle).knoten.filter((e) => klassenVon(e).includes(klasse))[i];
	assert.ok(k, `.${klasse} fehlt`);
	return k.nr;
};

const wo = (r: { nr: number | null }) => {
	assert.ok(r.nr !== null, 'Ergebnis ohne Element');
	return r.nr;
};

const aufgaben = (quelle: string) =>
	zerlege(quelle).knoten.filter((e) => klassenVon(e).includes('aufgabe') && !klassenVon(e).includes('koerper')).length;

describe('Fläche im Stapel (115)', () => {
	it('legt eine Fläche zwischen zwei Aufgaben an, ohne Nummern zu ändern', () => {
		const quelle = blattMit({ vorne: [FORM] });
		const nr = nrMit(quelle, 'aufgabe', 1);
		const r = legeFlaeche(quelle, { nr, wo: 'vor' }, 200, N);
		assert.ok(istFlaeche(r.quelle, wo(r)));
		assert.match(r.quelle, /<div class="flaeche" style="--h:200px">/);
		assert.equal(aufgaben(r.quelle), aufgaben(quelle));
		assert.equal(leseFlaechenHoehe(r.quelle, wo(r)), 200);
	});

	it('hoeheUm: Elementhöhe plus Rand oben und unten, mindestens FLAECHE_MIN', () => {
		assert.equal(hoeheUm(120), 152);
		assert.equal(hoeheUm(2), FLAECHE_MIN);
	});

	it('Hinein: Element wandert aus der Ebene in die Fläche, Lage in Koordinaten der Fläche', () => {
		const quelle = blattMit({ vorne: [FORM], stapel: [LEER] });
		const form = nrMit(quelle, 'form');
		const flaeche = nrMit(quelle, 'flaeche');
		const r = inFlaeche(quelle, form, flaeche, { x: 40, y: 30 });
		assert.equal(flaecheVon(r.quelle, wo(r)), flaeche);
		const lage = leseLage(r.quelle, wo(r));
		assert.equal(lage.x, 40);
		assert.equal(lage.y, 30);
	});

	it('Hinein und wieder heraus ändert das Element nicht, nur die Lage', () => {
		const quelle = blattMit({ vorne: [FORM], stapel: [LEER] });
		const form = nrMit(quelle, 'form');
		const hinein = inFlaeche(quelle, form, nrMit(quelle, 'flaeche'), { x: 40, y: 30 });
		const heraus = ausFlaeche(hinein.quelle, wo(hinein), { x: 610, y: 84 });
		assert.equal(flaecheVon(heraus.quelle, wo(heraus)), null);
		const lage = leseLage(heraus.quelle, wo(heraus));
		assert.equal(lage.x, 610);
		assert.equal(lage.y, 84);
	});

	it('Ein Element mit Anker verliert ihn, wenn es in die Fläche geht', () => {
		const quelle = blattMit({ anker: [FIGUR_ANKER], stapel: [LEER] });
		const figur = nrMit(quelle, 'figur-frei');
		assert.ok(ankerVon(quelle, figur));
		const r = inFlaeche(quelle, figur, nrMit(quelle, 'flaeche'), { x: 10, y: 10 });
		assert.equal(ankerVon(r.quelle, wo(r)), null);
	});

	it('Liegt das Element schon in der Fläche, ändert sich nur die Lage', () => {
		const quelle = blattMit({ stapel: [FLAECHE] });
		const form = nrMit(quelle, 'form');
		const r = inFlaeche(quelle, form, nrMit(quelle, 'flaeche'), { x: 50, y: 60 });
		assert.equal(leseLage(r.quelle, wo(r)).x, 50);
		assert.equal(zerlege(r.quelle).knoten.length, zerlege(quelle).knoten.length);
	});

	it('Neue Fläche mit Element: ein Ergebnis, Element liegt FLAECHE_RAND unter dem oberen Rand', () => {
		const quelle = blattMit({ vorne: [FIGUR_FREI] });
		const figur = nrMit(quelle, 'figur-frei');
		const ziel = nrMit(quelle, 'aufgabe', 1);
		const r = inNeueFlaeche(quelle, figur, { nr: ziel, wo: 'vor' }, N, { hoehe: 182, x: 30 });
		assert.ok(flaecheVon(r.quelle, wo(r)) !== null);
		assert.equal(leseLage(r.quelle, wo(r)).x, 30);
		assert.equal(leseLage(r.quelle, wo(r)).y, 16);
		assert.equal(aufgaben(r.quelle), aufgaben(quelle));
		assert.equal(zerlege(r.quelle).knoten.filter((k) => klassenVon(k).includes('figur-frei')).length, 1);
	});

	it('Höhe setzen: mindestens FLAECHE_MIN', () => {
		const quelle = blattMit({ stapel: [FLAECHE] });
		const f = nrMit(quelle, 'flaeche');
		assert.equal(leseFlaechenHoehe(setzeFlaechenHoehe(quelle, f, 333.4), f), 333);
		assert.equal(leseFlaechenHoehe(setzeFlaechenHoehe(quelle, f, 5), f), FLAECHE_MIN);
	});

	it('Die Fläche steht im Katalog und ordnet sich als Block zwischen die Bausteine', () => {
		const eintrag = KIT_KATALOG.find((e) => e.id === 'flaeche');
		assert.equal(eintrag?.kategorie, 'Ordnen');
		assert.equal(eintrag?.ort, 'seite');
		assert.equal(gestaltungArtNach('flaeche')?.ordnenIn, undefined);
	});

	it('An einer Fläche hängt nichts: sie ist kein Ziel für Anker', () => {
		const quelle = blattMit({ stapel: [LEER] });
		assert.equal(istAnkerbar(quelle, nrMit(quelle, 'flaeche')), false);
	});
});
