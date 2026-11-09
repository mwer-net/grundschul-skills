/**
 * Aussehen (108): Verlauf, Kontur-Stil, Schatten, Deckkraft. Die s/w-Seite der Verläufe (`stop-color`) prüft
 * `graustufen.test.ts`, die Darstellung im Browser `web/e2e/gestaltung-aussehen.spec.ts`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BILD_FREI, blattMit, FIGUR_FREI, FORM_TEXT, SCHMUCK, STREUUNG } from '../../web/e2e/gestaltung-daten';
import {
	deckkraftImBereich,
	entferneVerlauf,
	kannAussehen,
	leseDeckkraft,
	leseKonturStil,
	leseSchatten,
	leseVerlauf,
	setzeDeckkraft,
	setzeKonturStil,
	setzeSchatten,
	setzeVerlauf,
} from './aussehen';
import type { Verlauf } from './aussehen';
import { legeForm, leseForm, setzeFuellung, setzeKontur } from './formen-aendern';
import { pruefeFreiesHtml } from './frei';
import { dupliziereGestaltung } from './gestaltung';
import { ASSETS } from './konfig';
import { attribut, klassenVon, zerlege } from './quelltext';

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find((k) => k.tag === 'section' && klassenVon(k).includes('seite'));
	assert.ok(seite, 'Das Blatt hat eine Seite.');
	return seite.nr;
};

/** Legt eine Form ab; `nr` ist danach sicher gesetzt. */
const lege = (quelle: string, art: string) => {
	const { nr, quelle: neu } = legeForm(quelle, { seite: seiteIn(quelle), art });
	assert.ok(nr !== null);
	return { nr, quelle: neu };
};

const stern = () => lege(blattMit(), 'stern');

const element = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	assert.ok(k);
	return quelle.slice(k.start, k.ende);
};

/** Das erste Element mit dieser Klasse und `data-lage`. */
const nrVon = (quelle: string, klasse: string) => {
	const k = zerlege(quelle).knoten.find((n) => klassenVon(n).includes(klasse) && attribut(n, 'data-lage'));
	assert.ok(k, klasse);
	return k.nr;
};

const pfadStil = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	const svg = k?.tag === 'svg' ? k : k?.kinder.find((c) => c.tag === 'svg');
	const pfad = svg?.kinder.find((c) => c.tag === 'path');
	assert.ok(pfad);
	return { stil: attribut(pfad, 'style')?.wert ?? '', fill: attribut(pfad, 'fill')?.wert ?? null };
};

const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((t) => t[1]);

const LINEAR: Verlauf = { art: 'linear', f1: 'var(--haupt)', f2: 'var(--akzent)', winkel: 90 };

/** Wie Claude oder der Editor es ablegen: Die Ebene mit dem Element muss durch die Allow-Liste. */
const ohneFund = (quelle: string, nr: number) =>
	assert.deepEqual(pruefeFreiesHtml(`<div class="ebene vorne">${element(quelle, nr)}</div>`), []);

describe('Verlauf', () => {
	it('setzt, ändert den Winkel und entfernt ohne leeres <defs>', () => {
		const { nr, quelle } = stern();
		const mit = setzeVerlauf(quelle, nr, LINEAR);
		const html = element(mit, nr);
		assert.match(html, /<defs><linearGradient id="verlauf-[a-z0-9]{4}" gradientTransform="rotate\(90 \.5 \.5\)">/);
		assert.match(html, /<stop offset="0" style="stop-color:var\(--haupt\)"\/><stop offset="1" style="stop-color:var\(--akzent\)"\/>/);
		const { fill, stil } = pfadStil(mit, nr);
		assert.match(fill ?? '', /^url\(#verlauf-[a-z0-9]{4}\)$/);
		assert.doesNotMatch(stil, /(^|;)fill:/, 'kein fill im style, sonst gewönne er gegen den Verweis');
		assert.deepEqual(leseVerlauf(mit, nr), LINEAR);
		ohneFund(mit, nr);

		const gedreht = setzeVerlauf(mit, nr, { ...LINEAR, winkel: 405 });
		assert.equal(leseVerlauf(gedreht, nr)?.winkel, 45);
		assert.deepEqual(ids(element(gedreht, nr)), ids(html), 'die Id bleibt');
		const ohneWinkel = setzeVerlauf(gedreht, nr, { ...LINEAR, winkel: 0 });
		assert.doesNotMatch(element(ohneWinkel, nr), /gradientTransform/);

		const radial = setzeVerlauf(gedreht, nr, { ...LINEAR, art: 'radial' });
		assert.match(element(radial, nr), /<radialGradient id="verlauf-[a-z0-9]{4}"><stop/);
		assert.equal(leseVerlauf(radial, nr)?.art, 'radial');
		ohneFund(radial, nr);

		const weg = setzeVerlauf(radial, nr, null);
		assert.doesNotMatch(element(weg, nr), /<defs|Gradient|url\(/);
		assert.match(pfadStil(weg, nr).stil, /fill:var\(--haupt\)/, 'die erste Farbe bleibt als Füllung');
		assert.equal(leseVerlauf(weg, nr), null);
		assert.equal(entferneVerlauf(weg, nr), weg, 'ohne Verlauf bleibt die Quelle');
	});

	it('einfarbige Füllung entfernt den Verlauf (setzeFuellung, 104)', () => {
		const { nr, quelle } = stern();
		const mit = setzeVerlauf(quelle, nr, LINEAR);
		const einfarbig = setzeFuellung(mit, nr, '#ffffff');
		assert.doesNotMatch(element(einfarbig, nr), /<defs|Gradient|url\(/);
		assert.equal(leseForm(einfarbig, nr)?.fuellung, '#ffffff');
		const keine = setzeFuellung(mit, nr, null);
		assert.doesNotMatch(element(keine, nr), /<defs|url\(/);
		assert.equal(leseForm(keine, nr)?.fuellung, null);
	});

	it('Duplizieren vergibt neue Ids, jeder Verlauf ändert sich allein', () => {
		const a = lege(blattMit(), 'stern');
		const a1 = setzeVerlauf(a.quelle, a.nr, LINEAR);
		const b = lege(a1, 'herz');
		const b1 = setzeVerlauf(b.quelle, b.nr, { ...LINEAR, art: 'radial' });
		const kopie = dupliziereGestaltung(b1, b.nr);
		assert.ok(kopie.nr !== null);
		const alle = ids(kopie.quelle).filter((id) => id?.startsWith('verlauf-'));
		assert.equal(alle.length, 3);
		assert.equal(new Set(alle).size, 3, `drei verschiedene Ids: ${alle.join(', ')}`);

		const original = zerlege(kopie.quelle).knoten.filter((k) => attribut(k, 'data-form')?.wert === 'herz');
		assert.equal(original.length, 2);
		const [erste, zweite] = original;
		assert.ok(erste && zweite);
		const geaendert = setzeVerlauf(kopie.quelle, zweite.nr, { ...LINEAR, art: 'radial', f2: '#123456' });
		assert.equal(leseVerlauf(geaendert, zweite.nr)?.f2, '#123456');
		assert.equal(leseVerlauf(geaendert, erste.nr)?.f2, 'var(--akzent)', 'die andere bleibt');
		const sternNr = nrVon(geaendert, 'form');
		assert.deepEqual(leseVerlauf(geaendert, sternNr), LINEAR);
	});

	it('gilt für Form mit Text, nicht für Schmuckschrift oder Bild', () => {
		const quelle = blattMit({ vorne: [FORM_TEXT, SCHMUCK, BILD_FREI] });
		const nr = nrVon(quelle, 'form-text');
		const mit = setzeVerlauf(quelle, nr, LINEAR);
		assert.match(pfadStil(mit, nr).fill ?? '', /^url\(#verlauf-/);
		ohneFund(mit, nr);
		assert.throws(() => setzeVerlauf(quelle, nrVon(quelle, 'schmuck'), LINEAR), /keinen Verlauf/);
		assert.throws(() => setzeVerlauf(quelle, nrVon(quelle, 'bild-frei'), LINEAR), /keinen Verlauf/);
	});
});

describe('Kontur-Stil', () => {
	it('folgt der Stärke: gestrichelt 3s 2s, gepunktet 0 2s mit runden Enden', () => {
		const { nr, quelle } = stern();
		const gestrichelt = setzeKonturStil(quelle, nr, { stil: 'gestrichelt', enden: 'eckig' });
		assert.match(element(gestrichelt, nr), /data-kontur-stil="gestrichelt"/);
		assert.match(pfadStil(gestrichelt, nr).stil, /stroke-dasharray:9 6/);
		assert.doesNotMatch(pfadStil(gestrichelt, nr).stil, /stroke-linecap/);
		ohneFund(gestrichelt, nr);

		const doppelt = setzeKontur(gestrichelt, nr, { farbe: 'var(--dunkel)', staerke: 6 });
		assert.match(pfadStil(doppelt, nr).stil, /stroke-dasharray:18 12/, 'im Verhältnis zur doppelten Stärke');

		const rund = setzeKonturStil(doppelt, nr, { stil: 'gestrichelt', enden: 'rund' });
		assert.match(element(rund, nr), /data-kontur-enden="rund"/);
		assert.match(pfadStil(rund, nr).stil, /stroke-linecap:round/);
		assert.deepEqual(leseKonturStil(rund, nr), { stil: 'gestrichelt', enden: 'rund' });

		const gepunktet = setzeKonturStil(doppelt, nr, { stil: 'gepunktet', enden: 'eckig' });
		assert.match(pfadStil(gepunktet, nr).stil, /stroke-dasharray:0 12/);
		assert.match(pfadStil(gepunktet, nr).stil, /stroke-linecap:round/, 'Punkte brauchen runde Enden');
		ohneFund(gepunktet, nr);

		const ohne = setzeKontur(gepunktet, nr, null);
		assert.doesNotMatch(pfadStil(ohne, nr).stil, /dasharray|linecap/);
		assert.match(element(ohne, nr), /data-kontur-stil="gepunktet"/, 'der Stil bleibt für die nächste Kontur');
		const wieder = setzeKontur(ohne, nr, { farbe: 'var(--dunkel)', staerke: 2 });
		assert.match(pfadStil(wieder, nr).stil, /stroke-dasharray:0 4/);

		const durch = setzeKonturStil(wieder, nr, { stil: 'durchgezogen', enden: 'eckig' });
		assert.doesNotMatch(element(durch, nr), /data-kontur|dasharray|linecap/);
	});

	it('nur bei Form und Form mit Text', () => {
		const quelle = blattMit({ vorne: [SCHMUCK] });
		assert.throws(
			() => setzeKonturStil(quelle, nrVon(quelle, 'schmuck'), { stil: 'gestrichelt', enden: 'eckig' }),
			/keinen Kontur-Stil/,
		);
	});
});

describe('Schatten und Deckkraft', () => {
	it('setzt und entfernt den Schatten bei den Arten aus der Tabelle', () => {
		const quelle = blattMit({ vorne: [FORM_TEXT, SCHMUCK, BILD_FREI, FIGUR_FREI], hinten: [STREUUNG] });
		for (const klasse of ['form-text', 'schmuck', 'bild-frei', 'figur-frei']) {
			const nr = nrVon(quelle, klasse);
			const mit = setzeSchatten(quelle, nr, 'mittel');
			assert.match(element(mit, nr), /data-schatten="mittel"/, klasse);
			assert.equal(leseSchatten(mit, nr), 'mittel');
			ohneFund(mit, nr);
			assert.equal(setzeSchatten(mit, nr, null), quelle, `${klasse}: entfernt`);
		}
		assert.throws(() => setzeSchatten(quelle, nrVon(quelle, 'streuung'), 'leicht'), /keinen Schatten/);
	});

	it('Deckkraft 10–100 %, auf 5 % gerundet, 100 % schreibt nichts, bei jeder Art mit Lage', () => {
		assert.equal(deckkraftImBereich(3), 10);
		assert.equal(deckkraftImBereich(42), 40);
		assert.equal(deckkraftImBereich(43), 45);
		assert.equal(deckkraftImBereich(140), 100);
		const quelle = blattMit({ hinten: [BILD_FREI, STREUUNG] });
		for (const klasse of ['bild-frei', 'streuung']) {
			const nr = nrVon(quelle, klasse);
			const mit = setzeDeckkraft(quelle, nr, 40);
			assert.match(element(mit, nr), /;opacity:0\.4"/, klasse);
			assert.equal(leseDeckkraft(mit, nr), 40);
			ohneFund(mit, nr);
			assert.equal(setzeDeckkraft(mit, nr, 100), quelle);
			assert.equal(setzeDeckkraft(mit, nr, null), quelle);
			assert.equal(leseDeckkraft(quelle, nr), 100);
		}
		assert.throws(() => setzeDeckkraft(quelle, seiteIn(quelle), 50), /keine Deckkraft/);
	});

	it('kannAussehen folgt der Tabelle', () => {
		assert.equal(kannAussehen('form', 'verlauf'), true);
		assert.equal(kannAussehen('schmuck', 'verlauf'), false);
		assert.equal(kannAussehen('bildfrei', 'schatten'), true);
		assert.equal(kannAussehen('streuung', 'schatten'), false);
		assert.equal(kannAussehen('streuung', 'deckkraft'), true);
		assert.equal(kannAussehen('seitenflaeche', 'deckkraft'), false);
	});
});

describe('Bestand (Entscheidung 26)', () => {
	it('die Regeln für Aussehen in blatt.css treffen nur Gestaltung mit data-schatten', () => {
		const css = readFileSync(`${ASSETS}/blatt.css`, 'utf8');
		const teil = /\/\* Aussehen \*\/[^]*?\n\n/.exec(css)?.[0] ?? '';
		const ohneKommentare = teil.replace(/\/\*[^]*?\*\//g, '');
		const selektoren = [...ohneKommentare.matchAll(/([^{}]+)\{[^{}]*\}/g)]
			.map((t) => t[1]?.trim() ?? '')
			.filter((s) => s && !s.startsWith('@'));
		assert.ok(selektoren.length >= 4);
		for (const s of selektoren) {
			assert.match(s, /\[data-lage\]\[data-schatten/, s);
		}
	});
});
