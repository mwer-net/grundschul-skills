import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FlussPlan } from './fluss';
import { automatischeSeite, blaetterVon, blattZu, istAutomatisch, legeUm } from './fluss';
import { klassenVon, zerlege } from './quelltext';
import { nummeriere } from './struktur';

const BLATT = { jeSeite: false };

const aufgabe = (i: number) =>
	`<div class="aufgabe"><span class="nr">${i}</span><div class="anw"><span class="text">A${i}</span></div></div>`;

const dokument = (seiten: string[], { koerper = 'kl2 farbe palette-himmel' } = {}) => `<!DOCTYPE html>
<html lang="de">
<head><link rel="stylesheet" href="blatt.css"></head>
<body class="${koerper}">
${seiten.join('\n')}
</body>
</html>
`;

const ERSTE = `<section class="seite">
  <div class="namenszeile"><span class="name">Name</span></div>
  <div class="loesung-marke">Lösung</div>
  <header class="kopf"><div class="titel"><h1>T</h1></div></header>
  ${[1, 2, 3, 4, 5].map(aufgabe).join('\n  ')}
  <div class="fuss">F</div>
  <div class="fuss-zeile">Z</div>
  <div class="ebene hinten">
    <div class="seitenflaeche" data-flaeche="farbe"></div>
    <div class="seitenrahmen" data-rahmen="linie"></div>
    <div class="kopfband" data-form="welle"></div>
  </div>
</section>`;
const ZWEITE = `<section class="seite">
  <p>Zweites Blatt</p>
</section>`;
const QUELLE = dokument([ERSTE, ZWEITE]);

/** Teilt das erste Blatt nach `grenzen` (Anzahl Blöcke je Seite) auf. */
const plan = (quelle: string, grenzen: number[]): FlussPlan => {
	const [blatt] = blaetterVon(zerlege(quelle));
	assert.ok(blatt);
	let von = 0;
	const seiten = grenzen.map((n) => {
		const teil = blatt.folge.slice(von, von + n);
		von += n;
		return teil;
	});
	return [{ blatt: blatt.seiten[0]?.nr ?? -1, seiten }];
};

const klassenDerSeite = (quelle: string, i: number) => {
	const z = zerlege(quelle);
	const seite = blaetterVon(z).flatMap((b) => b.seiten)[i];
	return (z.knoten[seite?.nr ?? -1]?.kinder ?? []).map((k) => klassenVon(k).join(' ') || k.tag);
};

describe('Blätter erkennen (206-01)', () => {
	it('fasst eine feste Seite und die automatischen dahinter zusammen, der Fuß zuletzt', () => {
		const geteilt = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT).quelle;
		const blaetter = blaetterVon(zerlege(geteilt));
		assert.equal(blaetter.length, 2);
		assert.deepEqual(
			blaetter[0]?.seiten.map((s) => s.automatisch),
			[false, true],
		);
		assert.equal(blaetter[0]?.fliesst, true);
		const z = zerlege(geteilt);
		assert.ok(klassenVon(z.knoten[blaetter[0]?.folge.at(-1) ?? -1] ?? z.knoten[0]!).includes('fuss'));
	});

	it('data-weiter ohne Wert ist fest, ein neues Blatt', () => {
		const q = dokument([ERSTE, '<section class="seite" data-weiter>\n  <p>Weiter</p>\n</section>']);
		assert.equal(blaetterVon(zerlege(q)).length, 2);
	});

	it('Folie, Mini-Book und Seiten mit weiterer Klasse oder Karten fließen nicht', () => {
		const folie = dokument([ERSTE], { koerper: 'kl2 folie' });
		assert.equal(blaetterVon(zerlege(folie))[0]?.fliesst, false);
		const deckblatt = dokument([ERSTE.replace('class="seite"', 'class="seite deckblatt"')]);
		assert.equal(blaetterVon(zerlege(deckblatt))[0]?.fliesst, false);
		const karten = dokument(['<section class="seite">\n  <div class="karten"><div class="karte">K</div></div>\n</section>']);
		assert.equal(blaetterVon(zerlege(karten))[0]?.fliesst, false);
	});

	it('blattZu findet das Blatt auch von einem Element darin', () => {
		const geteilt = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT).quelle;
		const z = zerlege(geteilt);
		const [blatt] = blaetterVon(z);
		const letzter = blatt?.folge.at(-1) ?? -1;
		assert.deepEqual(blattZu(z, letzter), blatt);
	});
});

describe('Umlegen (206-01)', () => {
	it('legt eine automatische Seite nach Regel 12 an: Marke, Blöcke, Fuß, Fußzeile, Fläche und Rahmen', () => {
		const { quelle } = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT);
		const z = zerlege(quelle);
		const seiten = blaetterVon(z)[0]?.seiten ?? [];
		assert.equal(seiten.length, 2);
		assert.ok(istAutomatisch(z.knoten[seiten[1]?.nr ?? -1]));
		assert.deepEqual(klassenDerSeite(quelle, 1), ['loesung-marke', 'aufgabe', 'aufgabe', 'fuss', 'fuss-zeile', 'ebene hinten']);
		assert.match(quelle, /data-weiter="auto"/);
		// Kopfband und Namenszeile kommen nicht mit
		assert.equal(quelle.match(/kopfband/g)?.length, 1);
		assert.equal(quelle.match(/namenszeile/g)?.length, 1);
		assert.equal(quelle.match(/seitenflaeche/g)?.length, 2);
	});

	it('ohne Lösung-Marke und Ebene entsteht eine schlichte Folgeseite', () => {
		const schlicht = dokument([
			`<section class="seite">\n  ${[1, 2, 3].map(aufgabe).join('\n  ')}\n</section>`,
		]);
		const { quelle } = legeUm(schlicht, plan(schlicht, [2, 1]), BLATT);
		assert.deepEqual(klassenDerSeite(quelle, 1), ['aufgabe']);
	});

	it('ändert außerhalb des Blatts kein Zeichen', () => {
		const { quelle } = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT);
		assert.ok(quelle.endsWith(`${ZWEITE}\n</body>\n</html>\n`));
		assert.ok(quelle.startsWith(QUELLE.slice(0, QUELLE.indexOf('<section'))));
	});

	it('hin und zurück ergibt zeichengleich die Ausgangsquelle', () => {
		const hin = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT).quelle;
		const zurueck = legeUm(hin, plan(hin, [6]), BLATT).quelle;
		assert.equal(zurueck, QUELLE);
		const drei = legeUm(QUELLE, plan(QUELLE, [2, 2, 2]), BLATT).quelle;
		assert.equal(legeUm(drei, plan(drei, [3, 3]), BLATT).quelle, hin);
		const mitte = legeUm(hin, plan(hin, [4, 2]), BLATT).quelle;
		assert.equal(legeUm(mitte, plan(mitte, [6]), BLATT).quelle, QUELLE);
	});

	it('entfernt eine leere automatische Seite, behält eine mit freier Gestaltung', () => {
		const hin = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT).quelle;
		assert.doesNotMatch(legeUm(hin, plan(hin, [6, 0]), BLATT).quelle, /data-weiter/);
		const frei = hin.replace(
			'<div class="seitenflaeche" data-flaeche="farbe"></div>\n    <div class="seitenrahmen" data-rahmen="linie"></div>\n  </div>\n</section>',
			'<div class="seitenflaeche" data-flaeche="farbe"></div>\n    <div class="seitenrahmen" data-rahmen="linie"></div>\n    <img class="bild" src="a.png" style="left:1mm;top:1mm">\n  </div>\n</section>',
		);
		assert.notEqual(frei, hin);
		assert.match(legeUm(frei, plan(frei, [6, 0]), BLATT).quelle, /data-weiter="auto"/);
	});

	it('feste Seiten bleiben, und ein Plan, der Blöcke vertauscht, ändert nichts', () => {
		const z = zerlege(QUELLE);
		const [blatt] = blaetterVon(z);
		const folge = [...(blatt?.folge ?? [])].reverse();
		const falsch: FlussPlan = [{ blatt: blatt?.seiten[0]?.nr ?? -1, seiten: [folge] }];
		assert.equal(legeUm(QUELLE, falsch, BLATT).quelle, QUELLE);
	});

	it('nummeriert wie immer durchs Dokument und bildet die alten Nummern ab', () => {
		const u = legeUm(QUELLE, plan(QUELLE, [3, 3]), BLATT);
		assert.equal(u.quelle, nummeriere(u.quelle, BLATT));
		const alt = zerlege(QUELLE);
		const neu = zerlege(u.quelle);
		for (const nr of blaetterVon(alt)[0]?.folge ?? []) {
			const k = alt.knoten[nr];
			const n = neu.knoten[u.nummer(nr) ?? -1];
			assert.ok(k && n);
			assert.equal(n.tag, k.tag);
			assert.deepEqual(klassenVon(n), klassenVon(k));
		}
		const nr4 = neu.knoten[u.nummer(blaetterVon(alt)[0]?.folge[3] ?? -1) ?? -1];
		assert.ok(nr4 && u.quelle.slice(nr4.start, nr4.ende).includes('A4'));
	});
});

describe('automatischeSeite', () => {
	it('fest ergibt data-weiter ohne Wert', () => {
		const z = zerlege(QUELLE);
		const vorlage = z.knoten[blaetterVon(z)[0]?.seiten[0]?.nr ?? -1];
		assert.ok(vorlage);
		const html = automatischeSeite(z, vorlage, { fest: true });
		assert.match(html, /^<section class="seite" data-weiter>/);
		assert.doesNotMatch(html, /kopfband|namenszeile/);
	});
});
