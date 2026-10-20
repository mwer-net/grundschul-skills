import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS } from './konfig';
import type { Knoten, Zerlegung } from './quelltext';
import { klassenVon, zerlege } from './quelltext';
import type { Ort } from './referenz';
import {
	erzeugeReferenz,
	liesReferenzen,
	loeseReferenz,
	passt,
	pfadText,
	pfadVon,
	probeVon,
	textVon,
} from './referenz';
import { dupliziereBaustein, loescheBaustein, verschiebeBaustein } from './struktur';

const BEISPIEL = readFileSync(path.join(ASSETS, 'beispiel-zehner-einer-kl2.html'), 'utf8');
const BLATT = { jeSeite: false };

const ORT: Ort = {
	mappe: { id: '2026-10-08-zehner-ma-kl2', titel: 'Zehner und Einer', fach: 'mathematik', klasse: 2 },
	dokument: { id: 'arbeitsblatt', titel: 'Bündeln' },
};

const mitKlasse = (z: Zerlegung, klasse: string) => z.knoten.filter((k) => klassenVon(k).includes(klasse));
const aufgabe = (quelle: string, i: number) => mitKlasse(zerlege(quelle), 'aufgabe')[i] as Knoten;

/** Erzeugen, dann die Quelle ändern, dann auflösen: wie Claude es mit dem Text aus dem Chat tut. */
const ueber = (quelle: string, nr: number, danach: string, loesung = false) => {
	const text = erzeugeReferenz(zerlege(quelle), nr, ORT, loesung);
	const [ref] = liesReferenzen(`Bitte ändern:\n${text}\nMach sie schwerer.`);
	assert.ok(ref, text);
	const z = zerlege(danach);
	return { text, ref, z, ergebnis: loeseReferenz(z, ref) };
};

describe('Selektoren ohne Browser', () => {
	const z = zerlege(BEISPIEL);
	const erstes = (art: (k: Knoten) => boolean) => z.knoten.find(art) as Knoten;

	it('versteht Klassen, Tags, Kind- und Nachfahren-Kombinatoren und :has', () => {
		const zelle = erstes((k) => klassenVon(k).includes('zelle'));
		const stern = mitKlasse(z, 'aufgabe')[3] as Knoten;
		const text = erstes((k) => klassenVon(k).includes('text'));
		assert.ok(passt(zelle, '.reihe > .zelle', false));
		assert.ok(!passt(zelle, '.karten > .zelle', false));
		assert.ok(passt(stern, '.aufgabe:has(> .nr.stern)', false));
		assert.ok(!passt(mitKlasse(z, 'aufgabe')[0] as Knoten, '.aufgabe:has(> .nr.stern)', false));
		assert.ok(passt(text, '.anw .text', false));
		assert.ok(passt(text, 'p, .anw .text', false));
		assert.ok(
			passt(
				erstes((k) => k.tag === 'h1'),
				'h1, h2, h3',
				false,
			),
		);
	});

	it('kennt die Klasse loesung am body nur in der Lösungsansicht', () => {
		const antwort = erstes((k) => klassenVon(k).includes('antwort'));
		assert.ok(!passt(antwort, 'body.loesung .antwort', false));
		assert.ok(passt(antwort, 'body.loesung .antwort', true));
	});
});

describe('Pfad und Probe', () => {
	it('benennt wie die Breadcrumb des Editors', () => {
		const z = zerlege(BEISPIEL);
		const zelle = mitKlasse(z, 'zelle')[5] as Knoten;
		assert.equal(pfadText(pfadVon(z, zelle.nr, false)), 'Seite 1 › Aufgabe 2 › Reihe › Item 3');
		const uhr = z.knoten.find((k) => k.tag === 'x-stellentafel') as Knoten;
		assert.equal(pfadVon(z, uhr.nr, false).at(-1)?.name, 'Stellentafel');
		const stern = mitKlasse(z, 'aufgabe')[3] as Knoten;
		assert.deepEqual(
			pfadVon(z, stern.nr, false).map((s) => `${s.art}${s.index}`),
			['seite1', 'sternchenaufgabe1'],
		);
	});

	it('nimmt den Text ohne Nummer und kürzt am Wortende', () => {
		const z = zerlege(BEISPIEL);
		assert.equal(
			textVon(z, mitKlasse(z, 'aufgabe')[2] as Knoten, false),
			'Schreibe die Zahl. 4 Z 6 E = 8 E 2 Z = dreiundfünfzig = neunzig =',
		);
		assert.equal(probeVon('Kurz.'), 'Kurz.');
		assert.equal(
			probeVon('Kreise immer 10 ein. Schreibe Z, E und die Zahl.'),
			'Kreise immer 10 ein. Schreibe Z, E …',
		);
		const bild = z.knoten.find((k) => k.tag === 'img') as Knoten;
		assert.equal(textVon(z, bild, false), 'Willi');
	});

	it('lässt Lösungstext auf dem Arbeitsblatt aus', () => {
		const z = zerlege(BEISPIEL);
		const stern = mitKlasse(z, 'aufgabe')[3] as Knoten;
		assert.ok(!textVon(z, stern, false).includes('13'));
		assert.ok(textVon(z, stern, true).includes('4 · 13'));
	});
});

describe('Referenz erzeugen und lesen', () => {
	it('hat einen lesbaren und einen maschinenlesbaren Teil', () => {
		const z = zerlege(BEISPIEL);
		assert.equal(
			erzeugeReferenz(z, aufgabe(BEISPIEL, 2).nr, ORT, false),
			[
				'Schoolbox · „Zehner und Einer“ (Mathematik Kl. 2) · Bündeln · Seite 1 › Aufgabe 3 („Schreibe die Zahl. 4 Z 6 E = 8 E 2 Z …“)',
				'[sb:2026-10-08-zehner-ma-kl2/arbeitsblatt#seite1/aufgabe3]',
			].join('\n'),
		);
	});

	it('ohne Auswahl meint sie das ganze Dokument, in der Lösung mit #loesung', () => {
		const z = zerlege(BEISPIEL);
		assert.equal(
			erzeugeReferenz(z, null, ORT, true),
			'Schoolbox · „Zehner und Einer“ (Mathematik Kl. 2) · Bündeln · Lösung\n[sb:2026-10-08-zehner-ma-kl2/arbeitsblatt#loesung]',
		);
		const [ref] = liesReferenzen(erzeugeReferenz(z, null, ORT, true));
		assert.deepEqual(ref && { ...ref, text: '' }, {
			mappe: '2026-10-08-zehner-ma-kl2',
			dok: 'arbeitsblatt',
			loesung: true,
			schritte: [],
			probe: null,
			text: '',
		});
		assert.equal(ref && loeseReferenz(z, ref).befund, 'dokument');
	});

	it('findet mehrere Referenzen in einer Nachricht und übergeht kaputte', () => {
		const refs = liesReferenzen(
			[
				'Erst das: … · Seite 1 › Aufgabe 1 („Kreise …“)',
				'[sb:m-1/dok#seite1/aufgabe1]',
				'und das [sb:m-1/dok#seite1/aufgabe] und [sb:m-1/dok#seite2/item3] bitte.',
			].join('\n'),
		);
		assert.deepEqual(
			refs.map((r) => [r.schritte.map((s) => `${s.art}${s.index}`).join('/'), r.probe]),
			[
				['seite1/aufgabe1', 'Kreise'],
				['seite2/item3', null],
			],
		);
	});
});

describe('Referenz auflösen', () => {
	it('trifft das Element über den Pfad', () => {
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 1).nr, BEISPIEL);
		assert.equal(ergebnis.befund, 'pfad');
		assert.equal(ergebnis.ziel?.k.nr, aufgabe(BEISPIEL, 1).nr);
	});

	it('findet die Aufgabe über den Text, nachdem davor eine eingefügt wurde', () => {
		const danach = dupliziereBaustein(BEISPIEL, aufgabe(BEISPIEL, 0).nr, BLATT).quelle;
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, danach);
		assert.equal(ergebnis.befund, 'verschoben');
		assert.equal(ergebnis.ziel?.k.nr, aufgabe(danach, 3).nr);
		assert.equal(pfadText(ergebnis.ziel?.pfad ?? []), 'Seite 1 › Aufgabe 4');
	});

	it('findet sie auch nach dem Verschieben und Löschen', () => {
		const verschoben = verschiebeBaustein(
			BEISPIEL,
			aufgabe(BEISPIEL, 2).nr,
			{ nr: aufgabe(BEISPIEL, 0).nr, wo: 'vor' },
			BLATT,
		).quelle;
		assert.equal(
			ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, verschoben).ergebnis.ziel?.k.nr,
			aufgabe(verschoben, 0).nr,
		);
		const geloescht = loescheBaustein(BEISPIEL, aufgabe(BEISPIEL, 0).nr, BLATT).quelle;
		assert.equal(ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, geloescht).ergebnis.ziel?.k.nr, aufgabe(geloescht, 1).nr);
	});

	it('meldet Mehrdeutigkeit, wenn der Text mehrfach und nicht am alten Platz steht', () => {
		const kopie = dupliziereBaustein(BEISPIEL, aufgabe(BEISPIEL, 2).nr, BLATT).quelle;
		const davor = dupliziereBaustein(kopie, aufgabe(kopie, 0).nr, BLATT).quelle;
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, davor);
		assert.equal(ergebnis.befund, 'mehrdeutig');
		assert.deepEqual(
			ergebnis.andere.map((a) => pfadText(a.pfad)),
			['Seite 1 › Aufgabe 4', 'Seite 1 › Aufgabe 5'],
		);
	});

	it('nennt bei einem Treffer am Platz auch gleiche Texte anderswo', () => {
		const kopie = dupliziereBaustein(BEISPIEL, aufgabe(BEISPIEL, 2).nr, BLATT).quelle;
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, kopie);
		assert.equal(ergebnis.befund, 'pfad');
		assert.deepEqual(
			ergebnis.andere.map((a) => pfadText(a.pfad)),
			['Seite 1 › Aufgabe 4'],
		);
	});

	it('findet sie über den ähnlichsten Textanfang, wenn Claude sie schon geändert hat', () => {
		const davor = dupliziereBaustein(BEISPIEL, aufgabe(BEISPIEL, 0).nr, BLATT).quelle;
		const geaendert = davor.replace('4 Z 6 E', '7 Z 1 E');
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, geaendert);
		assert.equal(ergebnis.befund, 'aehnlich');
		assert.equal(ergebnis.ziel?.k.nr, aufgabe(geaendert, 3).nr);
	});

	it('fragt nach, wenn am Platz ein ganz anderer Text steht', () => {
		const anders = BEISPIEL.replace('Schreibe die Zahl.', 'Wie heißt die Zahl?');
		const { ergebnis } = ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, anders);
		assert.equal(ergebnis.befund, 'nur-pfad');
		assert.equal(ergebnis.ziel?.k.nr, aufgabe(anders, 2).nr);
	});

	it('meldet fehlt, wenn es das Element nicht mehr gibt', () => {
		const geloescht = loescheBaustein(BEISPIEL, aufgabe(BEISPIEL, 2).nr, BLATT).quelle;
		const ohne = geloescht.replace(
			/<div class="aufgabe">\s*<span class="nr stern">[\s\S]*?<\/section>/,
			'</section>',
		);
		assert.equal(ueber(BEISPIEL, aufgabe(BEISPIEL, 2).nr, ohne).ergebnis.befund, 'fehlt');
	});

	it('löst Antwortlinien in der Lösungsansicht auf', () => {
		const z = zerlege(BEISPIEL);
		const linie = mitKlasse(z, 'antwort')[4] as Knoten;
		const { ergebnis, text } = ueber(BEISPIEL, linie.nr, BEISPIEL, true);
		assert.match(text, /#loesung\/seite1\/aufgabe1\/reihe1\/item2\/antwort2\]$/);
		assert.equal(ergebnis.befund, 'pfad');
		assert.equal(ergebnis.ziel?.k.nr, linie.nr);
	});
});
