import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { KIT_KATALOG } from './bausteine';
import { druckfassung } from './bilder';
import { FIGUREN, figurAn, figurHtml, figurNach, spiegelnFuer, tauscheFigur } from './figuren';
import { legeGestaltungAb, leseLage } from './gestaltung';
import { leseStarter } from './katalog-starter';
import { ASSETS } from './konfig';
import { attribut, klassenVon, zerlege } from './quelltext';

const BILDER = path.join(ASSETS, 'bilder');

const ersteSeite = (quelle: string) => {
	const seite = zerlege(quelle).knoten.find((k) => klassenVon(k).includes('seite'));
	if (!seite) {
		throw new Error('keine Seite');
	}
	return seite.nr;
};

const figurIn = (quelle: string) => {
	const k = zerlege(quelle).knoten.find((x) => klassenVon(x).includes('figur-frei'));
	if (!k) {
		throw new Error('keine Figur');
	}
	return k;
};

describe('Liste der Figuren (102)', () => {
	it('die Katalog-Einträge der Leitfigur kommen aus FIGUREN: Name, Suchwörter, Reihenfolge', () => {
		const leitfiguren = KIT_KATALOG.filter((e) => FIGUREN.some((f) => f.id === e.id));
		assert.deepEqual(
			leitfiguren.map((e) => ({ id: e.id, name: e.name, suchbegriffe: [...e.suchbegriffe], ort: e.ort })),
			FIGUREN.map((f) => ({ id: f.id, name: f.name, suchbegriffe: [...f.suchwoerter], ort: 'zeile' })),
		);
	});

	it('der Starter jeder Leitfigur zeigt die Datei aus FIGUREN, als img.figur', () => {
		const starter = leseStarter();
		for (const f of FIGUREN) {
			const html = starter.get(f.id);
			assert.ok(html, f.id);
			const k = zerlege(html).knoten[0];
			assert.ok(k);
			assert.deepEqual(klassenVon(k), ['figur'], f.id);
			assert.equal(attribut(k, 'src')?.wert, `bilder/${f.datei}`, f.id);
		}
	});

	it('jede Datei existiert, die Strichfassung genau dort, wo FIGUREN sie nennt', () => {
		for (const f of FIGUREN) {
			assert.ok(existsSync(path.join(BILDER, f.datei)), f.datei);
			const stamm = path.basename(f.datei, path.extname(f.datei));
			const vermutet = path.join(BILDER, `${stamm}-strich${path.extname(f.datei)}`);
			if (f.strich) {
				assert.equal(f.strich, path.basename(vermutet), f.id);
				assert.ok(existsSync(vermutet), f.strich);
			} else {
				assert.ok(!existsSync(vermutet), `${f.id}: Strichfassung fehlt in FIGUREN`);
			}
		}
	});

	it('s/w: blatt.py nimmt die Strichfassung nach dem Dateinamen, also auch für img.figur-frei', async () => {
		for (const f of FIGUREN) {
			const { strich } = await druckfassung({ pythonBin: 'python3' }, ASSETS, `bilder/${f.datei}`);
			assert.equal(strich, f.strich ?? null, f.id);
		}
	});

	it('Ids sind eindeutig und taugen als data-figur', () => {
		const ids = FIGUREN.map((f) => f.id);
		assert.equal(new Set(ids).size, ids.length);
		for (const id of ids) {
			assert.match(id, /^[a-z][a-z0-9-]*$/);
		}
	});
});

describe('Figur frei (102)', () => {
	const wilma = figurNach('wilma');
	assert.ok(wilma);

	it('figurHtml: nur figur-frei, data-figur, Spiegeln nur gegen die Blickrichtung der Datei', () => {
		const gleich = figurHtml(wilma, 'bilder/wilma.png', wilma.blickt);
		assert.equal(gleich, '<img class="figur-frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma">');
		const anders = wilma.blickt === 'rechts' ? 'links' : 'rechts';
		assert.ok(spiegelnFuer(wilma, anders));
		assert.match(figurHtml(wilma, 'bilder/wilma.png', anders), /style="--spiegeln:-1"/);
	});

	it('abgelegt mit 150 px Breite; Spiegeln bleibt im style, die Lage kommt dazu', () => {
		const quelle = blattMit({});
		const anders = wilma.blickt === 'rechts' ? 'links' : 'rechts';
		const { nr, quelle: neu } = legeGestaltungAb(quelle, {
			seite: ersteSeite(quelle),
			html: figurHtml(wilma, 'bilder/wilma.png', anders),
			lage: { x: 100, y: 200, b: 150 },
		});
		assert.ok(nr !== null);
		const lage = leseLage(neu, nr);
		assert.deepEqual({ x: lage.x, y: lage.y, b: lage.b, spiegeln: lage.spiegeln }, { x: 100, y: 200, b: 150, spiegeln: -1 });
		const k = figurIn(neu);
		assert.deepEqual(klassenVon(k), ['figur-frei']);
		assert.equal(attribut(k, 'data-lage')?.wert, 'frei');
		assert.match(neu, /<div class="ebene vorne">[\s\S]*figur-frei/);
	});

	it('tauscheFigur: andere Figur, Lage und Größe bleiben', () => {
		const willi = figurNach('willi');
		assert.ok(willi);
		const quelle = blattMit({});
		const abgelegt = legeGestaltungAb(quelle, {
			seite: ersteSeite(quelle),
			html: figurHtml(wilma, 'bilder/wilma.png'),
			lage: { x: 40, y: 60, b: 150, drehen: 12 },
		});
		assert.ok(abgelegt.nr !== null);
		assert.equal(figurAn(abgelegt.quelle, abgelegt.nr)?.id, 'wilma');
		const { nr, quelle: neu } = tauscheFigur(abgelegt.quelle, abgelegt.nr, willi, 'bilder/willi.png');
		assert.equal(nr, abgelegt.nr);
		assert.equal(figurAn(neu, abgelegt.nr)?.id, 'willi');
		assert.deepEqual(leseLage(neu, abgelegt.nr), leseLage(abgelegt.quelle, abgelegt.nr));
		const k = figurIn(neu);
		assert.equal(attribut(k, 'src')?.wert, 'bilder/willi.png');
		assert.equal(attribut(k, 'alt')?.wert, 'Willi');
	});
});
