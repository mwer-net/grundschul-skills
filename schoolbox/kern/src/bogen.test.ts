import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, SCHMUCK, SCHMUCK_BOGEN } from '../../web/e2e/gestaltung-daten';
import {
	ausBogen,
	bogenHtml,
	bogenPfad,
	ergaenzeBoegen,
	hatFarbigeWoerter,
	inBogen,
	kannInBogen,
	legeBogen,
	leseBogen,
	setzeBogen,
} from './bogen';
import { neueFunde } from './frei';
import { dupliziereGestaltung, leseLage } from './gestaltung';
import { attribut, klassenVon, zerlege } from './quelltext';
import { leseSchmuck, leseSchriftKontur, setzeSchmuck, setzeSchriftKontur } from './schmuck';

const seiteIn = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find((k) => k.tag === 'section' && klassenVon(k).includes('seite'));
	assert.ok(seite);
	return seite.nr;
};

const nrVon = (quelle: string, selektor: (k: ReturnType<typeof zerlege>['knoten'][number]) => boolean) => {
	const k = zerlege(quelle).knoten.find(selektor);
	assert.ok(k);
	return k.nr;
};

const bogenNr = (quelle: string) =>
	nrVon(quelle, (k) => k.tag === 'svg' && attribut(k, 'data-schmuck')?.wert === 'bogen');
const titelNr = (quelle: string) =>
	nrVon(quelle, (k) => k.tag === 'div' && attribut(k, 'data-schmuck')?.wert === 'titel');

/** Funde gegenüber einem Blatt ohne Gestaltung: Kopf, Skript und Stylesheet des Gerüsts zählen nicht. */
const pruefeFreiesHtml = (quelle: string) => neueFunde(blattMit(), quelle);

const MIT_BOGEN = blattMit({ vorne: [SCHMUCK_BOGEN] });
const MIT_TITEL = blattMit({ vorne: [SCHMUCK] });

describe('bogenPfad', () => {
	it('Schnappschuss bei −100, 0 und 100', () => {
		assert.equal(bogenPfad(-100, 600, 134, 56), 'M20 50.4 Q300 189.6 580 50.4');
		assert.equal(bogenPfad(0, 600, 134, 56), 'M20 85.2 L580 85.2');
		assert.equal(bogenPfad(100, 600, 134, 56), 'M20 120 Q300 -19.2 580 120');
	});

	it('hält die Krümmung im Bereich', () => {
		assert.equal(bogenPfad(500, 600, 134, 56), bogenPfad(100, 600, 134, 56));
		assert.equal(bogenPfad(-500, 600, 134, 56), bogenPfad(-100, 600, 134, 56));
	});
});

describe('Titel im Bogen anlegen und ändern', () => {
	it('legeBogen setzt Pfad, textPath und eine freie Id, und die Allow-Liste lässt ihn durch', () => {
		const { nr, quelle } = legeBogen(MIT_BOGEN, { seite: seiteIn(MIT_BOGEN), lage: { x: 10, y: 20 } });
		assert.ok(nr !== null);
		const stand = leseBogen(quelle, nr);
		assert.equal(stand?.text, 'Zahlenzirkus');
		assert.equal(stand?.kruemmung, 40);
		const ids = [...quelle.matchAll(/\sid="(bogen-[a-z0-9]+)"/g)].map((t) => t[1]);
		assert.equal(new Set(ids).size, ids.length, 'Jede Id kommt einmal vor.');
		assert.equal(ids.length, 2);
		assert.deepEqual(pruefeFreiesHtml(quelle), []);
	});

	it('ein Gut mit fester Id bekommt beim Ablegen eine eigene', () => {
		const a = legeBogen(MIT_BOGEN, { seite: seiteIn(MIT_BOGEN) });
		assert.ok(!a.quelle.includes('bogen-neu'));
	});

	it('setzeBogen ändert Krümmung, Text, Größe, Schrift und Farbe; der Pfad hängt nicht vom Text ab', () => {
		const nr = bogenNr(MIT_BOGEN);
		const text = setzeBogen(MIT_BOGEN, nr, { text: 'Mathe-Zirkus <3 & mehr' });
		assert.equal(leseBogen(text, nr)?.text, 'Mathe-Zirkus <3 & mehr');
		assert.equal(
			attribut(
				zerlege(text).knoten.find((k) => k.tag === 'path')!,
				'd',
			)?.wert,
			'M20 140 Q300 20 580 140',
		);
		const krumm = setzeBogen(MIT_BOGEN, nr, { kruemmung: -50 });
		assert.equal(leseBogen(krumm, nr)?.kruemmung, -50);
		assert.match(krumm, /d="M20 /);
		assert.notEqual(krumm, MIT_BOGEN);
		const schrift = setzeBogen(MIT_BOGEN, nr, { schrift: 'Andika', gr: 70, farbe: 'var(--akzent)' });
		const s = leseBogen(schrift, nr);
		assert.deepEqual([s?.schrift, s?.gr, s?.farbe], ['Andika', 70, 'var(--akzent)']);
		assert.deepEqual(pruefeFreiesHtml(schrift), []);
	});

	it('weist unbekannte Farben und Schriften ab und lässt leeren Text, wie er war', () => {
		const nr = bogenNr(MIT_BOGEN);
		assert.throws(() => setzeBogen(MIT_BOGEN, nr, { farbe: 'red' }));
		assert.throws(() => setzeBogen(MIT_BOGEN, nr, { schrift: 'Arial' as never }));
		assert.equal(setzeBogen(MIT_BOGEN, nr, { text: '  ' }), MIT_BOGEN);
	});

	it('Durchsuchen: der Text steht als Textinhalt im SVG', () => {
		assert.ok(MIT_BOGEN.includes('>Zahlenzirkus</textPath>'));
		assert.equal(leseBogen(MIT_BOGEN, bogenNr(MIT_BOGEN))?.text, 'Zahlenzirkus');
	});
});

describe('Kontur der Schmuckschrift', () => {
	it('setzen und entfernen, HTML und Bogen', () => {
		const nr = titelNr(MIT_TITEL);
		assert.deepEqual(leseSchriftKontur(MIT_TITEL, nr), { staerke: 6, farbe: '#fff' });
		const aus = setzeSchriftKontur(MIT_TITEL, nr, null);
		assert.equal(leseSchriftKontur(aus, nr), null);
		assert.ok(!aus.includes('data-kontur'));
		const an = setzeSchriftKontur(aus, nr, { staerke: 9, farbe: 'var(--haupt)' });
		assert.deepEqual(leseSchriftKontur(an, nr), { staerke: 9, farbe: 'var(--haupt)' });
		assert.deepEqual(pruefeFreiesHtml(an), []);
		const bogen = bogenNr(MIT_BOGEN);
		assert.deepEqual(leseSchriftKontur(MIT_BOGEN, bogen), { staerke: 8, farbe: '#fff' });
		const ohne = setzeSchriftKontur(MIT_BOGEN, bogen, null);
		assert.equal(leseSchriftKontur(ohne, bogen), null);
		assert.ok(!ohne.includes('paint-order'));
	});

	it('begrenzt die Stärke auf 16 px und weist fremde Farben ab', () => {
		const nr = titelNr(MIT_TITEL);
		assert.equal(
			leseSchriftKontur(setzeSchriftKontur(MIT_TITEL, nr, { staerke: 40, farbe: '#000' }), nr)?.staerke,
			16,
		);
		assert.throws(() => setzeSchriftKontur(MIT_TITEL, nr, { staerke: 4, farbe: 'url(#x)' }));
	});
});

describe('Titel ⇄ Bogen', () => {
	it('behält Lage, Farbe, Schrift, Größe und Kontur in beide Richtungen', () => {
		let q = setzeSchriftKontur(MIT_TITEL, titelNr(MIT_TITEL), { staerke: 5, farbe: '#fff' });
		const nr = titelNr(q);
		q = setzeSchmuck(q, nr, { schrift: 'Andika', farbe: 'var(--akzent)' });
		const vorher = leseSchmuck(q, nr);
		const lage = leseLage(q, nr);
		assert.ok(kannInBogen(q, nr));
		const im = inBogen(q, nr);
		const bogen = leseBogen(im, nr);
		assert.ok(bogen);
		assert.equal(bogen.text, 'Die Formen-Detektive');
		assert.equal(bogen.gr, vorher?.gr);
		assert.equal(bogen.schrift, 'Andika');
		assert.equal(bogen.farbe, vorher?.farbe);
		assert.deepEqual(bogen.kontur, { staerke: 5, farbe: '#fff' });
		assert.equal(leseLage(im, nr).x, lage.x);
		assert.equal(leseLage(im, nr).y, lage.y);
		assert.deepEqual(pruefeFreiesHtml(im), []);
		const zurueck = ausBogen(im, nr);
		const titel = leseSchmuck(zurueck, nr);
		assert.equal(titel?.art, 'titel');
		assert.equal(titel?.gr, vorher?.gr);
		assert.equal(titel?.schrift, 'Andika');
		assert.equal(titel?.farbe, vorher?.farbe);
		assert.deepEqual(leseSchriftKontur(zurueck, nr), { staerke: 5, farbe: '#fff' });
		assert.equal(leseLage(zurueck, nr).x, lage.x);
		assert.equal(leseLage(zurueck, nr).y, lage.y);
		const k = zerlege(zurueck).knoten[nr];
		assert.ok(k && !zurueck.slice(k.start, k.ende).includes('<span'), 'Farben einzelner Wörter gehen verloren.');
		assert.deepEqual(pruefeFreiesHtml(zurueck), []);
	});

	it('nur ein Titel geht in den Bogen; farbige Wörter werden gemeldet', () => {
		const stempel = blattMit({ vorne: [bogenHtml()] });
		assert.ok(!kannInBogen(stempel, bogenNr(stempel)));
		assert.throws(() => inBogen(stempel, bogenNr(stempel)));
		assert.ok(hatFarbigeWoerter(MIT_TITEL, titelNr(MIT_TITEL)));
	});
});

describe('Allow-Liste und Ids', () => {
	it('das Beispiel aus dem Briefing geht durch', () => {
		assert.deepEqual(pruefeFreiesHtml(MIT_BOGEN), []);
	});

	it('href nach außen und data: an textPath werden abgewiesen', () => {
		for (const href of ['https://beispiel.de/x', 'data:text/plain,x', '//beispiel.de/x', 'javascript:alert(1)']) {
			const q = MIT_BOGEN.replace('href="#bogen-k3f9"', `href="${href}"`);
			assert.ok(pruefeFreiesHtml(q).length > 0, href);
		}
		assert.ok(pruefeFreiesHtml(MIT_BOGEN.replace('href="#bogen-k3f9"', 'xlink:href="https://x.de/a"')).length > 0);
	});

	it('href bleibt ein Sprung: an anderen Elementen ist es weiter abgewiesen', () => {
		assert.ok(pruefeFreiesHtml(MIT_BOGEN.replace('<text ', '<text href="#bogen-k3f9" ')).length > 0);
	});

	it('paint-order, -webkit-text-stroke und text-anchor gehen im style durch', () => {
		const q = blattMit({
			vorne: [
				'<div class="schmuck" data-lage="frei" data-schmuck="titel" data-kontur="" style="--x:1px;--y:1px;-webkit-text-stroke:6px #fff;paint-order:stroke fill">Titel</div>',
			],
		});
		assert.deepEqual(pruefeFreiesHtml(q), []);
	});

	it('Duplizieren vergibt eine neue Id und schreibt den Sprung um', () => {
		const zwei = legeBogen(MIT_BOGEN, { seite: seiteIn(MIT_BOGEN) });
		assert.ok(zwei.nr !== null);
		const kopie = dupliziereGestaltung(zwei.quelle, zwei.nr);
		const ids = [...kopie.quelle.matchAll(/\sid="(bogen-[a-z0-9]+)"/g)].map((t) => t[1]);
		assert.equal(ids.length, 3);
		assert.equal(new Set(ids).size, 3, 'Drei Bögen, drei verschiedene Ids.');
		for (const id of ids) {
			assert.equal(kopie.quelle.split(`href="#${id}"`).length - 1, 1, `${id}: genau ein Sprung`);
		}
	});
});

describe('ergaenzeBoegen', () => {
	const OHNE_PFAD =
		'<svg class="schmuck" data-lage="frei" data-schmuck="bogen" data-bogen="35" style="--x:97px;--y:120px">' +
		'<text text-anchor="middle" style="font:600 40px Fredoka,sans-serif;fill:var(--haupt)"><textPath startOffset="50%">Zirkus</textPath></text></svg>';

	it('ergänzt Größe, viewBox, Pfad und Sprung', () => {
		const q = ergaenzeBoegen(blattMit({ vorne: [OHNE_PFAD] }));
		assert.match(q, /viewBox="0 0 \d+ \d+"/);
		assert.match(q, /<path id="bogen-[a-z0-9]+" d="M/);
		assert.match(q, /<textPath href="#bogen-[a-z0-9]+" startOffset/);
		assert.deepEqual(pruefeFreiesHtml(q), []);
		assert.equal(leseBogen(q, bogenNr(q))?.text, 'Zirkus');
		assert.equal(ergaenzeBoegen(q), q, 'Zweites Mal nichts mehr zu tun.');
	});

	it('Quellen ohne Bogen und vollständige Bögen bleiben, wie sie sind', () => {
		const ohne = blattMit();
		assert.equal(ergaenzeBoegen(ohne), ohne);
		assert.equal(ergaenzeBoegen(MIT_BOGEN), MIT_BOGEN);
	});
});
