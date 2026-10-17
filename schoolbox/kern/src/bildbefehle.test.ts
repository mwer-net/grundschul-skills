import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bildBreite, entferneBild, setzeBeschreibung, setzeBildBreite, setzeBildEin, tauscheBild } from './bildbefehle';
import { macheRueckgaengig, neuerVerlauf, nimmAuf, zerlege } from './quelltext';

const QUELLE = `<body>
<section class="seite">
  <!-- Leitfigur -->
  <div class="tipp"><img class="figur" style="--figur:70px" src="bilder/willi.png" alt="Willi"><div class="blase">Hallo</div></div>
  <div class="aufgabe">
    <img src="bilder/wachstum.png" alt="Wachstum" width="400" height="200" style="height:200px;border:0">
  </div>
  <div class="platzhalter" style="--h:120px">Kartoffelpflanze mit Knollen</div>
</section>
</body>
`;

const nrVon = (quelle: string, alt: string) => {
	const k = zerlege(quelle).knoten.find((n) => n.attribute.some((a) => a.name === 'alt' && a.wert === alt));
	assert.ok(k, alt);
	return k.nr;
};

const nurZeile = (alt: string, neu: string) => {
	const a = alt.split('\n');
	const b = neu.split('\n');
	return b.filter((z, i) => z !== a[i]);
};

describe('Bild-Befehle', () => {
	it('tauscht nur src (und auf Wunsch alt), die Größe bleibt', () => {
		const nr = nrVon(QUELLE, 'Willi');
		const { quelle } = tauscheBild(QUELLE, nr, 'bilder/foto.jpg');
		assert.deepEqual(nurZeile(QUELLE, quelle), [
			'  <div class="tipp"><img class="figur" style="--figur:70px" src="bilder/foto.jpg" alt="Willi"><div class="blase">Hallo</div></div>',
		]);
		const mitAlt = tauscheBild(QUELLE, nr, 'bilder/wilma.png', 'Wilma & „Freund“').quelle;
		assert.match(mitAlt, /src="bilder\/wilma.png" alt="Wilma &amp; „Freund“"/);
	});

	it('setzt die Breite als --figur bzw. width, ohne feste Höhe, in Grenzen', () => {
		const figur = nrVon(QUELLE, 'Willi');
		assert.equal(bildBreite(zerlege(QUELLE), figur), 70);
		const a = setzeBildBreite(QUELLE, figur, 101.6).quelle;
		assert.match(a, /<img class="figur" style="--figur:102px" src/);
		assert.equal(bildBreite(zerlege(a), figur), 102);

		const grafik = nrVon(QUELLE, 'Wachstum');
		assert.equal(bildBreite(zerlege(QUELLE), grafik), null);
		const b = setzeBildBreite(QUELLE, grafik, 900, 640).quelle;
		assert.match(b, /<img src="bilder\/wachstum.png" alt="Wachstum" width="400" style="width:640px;border:0">/);
		assert.equal(bildBreite(zerlege(b), grafik), 640);
		assert.match(setzeBildBreite(QUELLE, grafik, 3).quelle, /style="width:24px;border:0"/);
	});

	it('ändert die Beschreibung und entfernt ein Bild samt seiner Zeile', () => {
		const grafik = nrVon(QUELLE, 'Wachstum');
		assert.match(setzeBeschreibung(QUELLE, grafik, '  Samen, Keimling  ').quelle, /alt="Samen, Keimling"/);
		const ohne = entferneBild(QUELLE, grafik);
		assert.equal(ohne.nr, null);
		assert.ok(!ohne.quelle.includes('wachstum'));
		assert.match(ohne.quelle, /<div class="aufgabe">\n {2}<\/div>/);
	});

	it('ersetzt einen Platzhalter durch ein Bild und wählt es', () => {
		const platzhalter = zerlege(QUELLE).knoten.find((k) => k.attribute.some((a) => a.wert === 'platzhalter'));
		assert.ok(platzhalter);
		const { nr, quelle } = setzeBildEin(QUELLE, platzhalter.nr, {
			src: 'bilder/kartoffel.jpg',
			alt: 'Kartoffelpflanze mit Knollen',
			breite: 180.4,
		});
		assert.match(
			quelle,
			/\n {2}<img src="bilder\/kartoffel.jpg" alt="Kartoffelpflanze mit Knollen" style="width:180px">\n<\/section>/,
		);
		assert.equal(nr, nrVon(quelle, 'Kartoffelpflanze mit Knollen'));
		assert.throws(() => setzeBildEin(QUELLE, nrVon(QUELLE, 'Willi'), { src: 'a.png', alt: '', breite: 50 }));
		assert.throws(() => tauscheBild(QUELLE, 0, 'a.png'));
	});

	it('ist jeweils ein Schritt, der sich exakt zurücknehmen lässt', () => {
		let v = neuerVerlauf(QUELLE);
		const figur = nrVon(QUELLE, 'Willi');
		v = nimmAuf(v, tauscheBild(v.quelle, figur, 'bilder/x.png', 'X').quelle, 'Bild getauscht');
		v = nimmAuf(v, setzeBildBreite(v.quelle, figur, 120).quelle, 'Größe');
		v = nimmAuf(v, entferneBild(v.quelle, nrVon(v.quelle, 'Wachstum')).quelle, 'Bild entfernt');
		assert.equal(v.zurueck.length, 3);
		v = macheRueckgaengig(macheRueckgaengig(macheRueckgaengig(v)));
		assert.equal(v.quelle, QUELLE);
	});
});
