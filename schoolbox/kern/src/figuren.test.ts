import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { blattMit } from '../../web/e2e/gestaltung-daten';
import { KIT_KATALOG } from './bausteine';
import { druckfassung } from './bilder';
import type { BibliotheksFigur, Pose } from './figuren';
import { EINGEBAUTE, figurAn, FIGUREN, figurHtml, figurNach, tauscheFigur } from './figuren';
import { legeGestaltungAb, leseLage } from './gestaltung';
import { leseStarter } from './katalog-starter';
import { ASSETS, WURZEL } from './konfig';
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

const grundpose = (f: BibliotheksFigur | undefined) => {
	const pose = f?.posen[0];
	assert.ok(f && pose);
	return { figur: f, pose };
};

describe('Figur frei (102, 177)', () => {
	const { figur: wilma, pose: wilmaPose } = grundpose(EINGEBAUTE.find((f) => f.id === 'wilma'));
	const { figur: willi } = grundpose(EINGEBAUTE.find((f) => f.id === 'willi'));
	const lupe: Pose = { id: 'willi-lupe', schluessel: '_figuren/willi-lupe.png', strich: false };
	const mitLupe: BibliotheksFigur = { ...willi, posen: [...willi.posen, lupe] };
	const kobi: BibliotheksFigur = {
		id: 'kobi',
		name: 'Kobi',
		eingebaut: false,
		suchwoerter: [],
		posen: [{ id: 'kobi', schluessel: '_figuren/kobi.png', strich: false }],
	};
	const figuren = [mitLupe, wilma, kobi];
	const kurz = (an: ReturnType<typeof figurAn>) => an && { figur: an.figur.id, pose: an.pose?.id };

	it('figurHtml: nur figur-frei, data-figur, ohne Spiegeln', () => {
		assert.equal(
			figurHtml(wilma, wilmaPose, 'bilder/wilma.png'),
			'<img class="figur-frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma">',
		);
		assert.equal(
			figurHtml(mitLupe, lupe, 'bilder/willi-lupe.png'),
			'<img class="figur-frei" data-figur="willi-lupe" src="bilder/willi-lupe.png" alt="Willi">',
		);
		for (const f of figuren) {
			for (const p of f.posen) {
				assert.doesNotMatch(figurHtml(f, p, 'bilder/x.png'), /--spiegeln|style=/);
			}
		}
	});

	it('abgelegt mit 150 px Breite; Spiegeln bleibt im style, die Lage kommt dazu', () => {
		const quelle = blattMit({});
		// So setzt es ⇧H; figurHtml selbst spiegelt nie.
		const html = figurHtml(wilma, wilmaPose, 'bilder/wilma.png');
		const gespiegelt = html.replace('<img ', '<img style="--spiegeln:-1" ');
		const { nr, quelle: neu } = legeGestaltungAb(quelle, {
			seite: ersteSeite(quelle),
			html: gespiegelt,
			lage: { x: 100, y: 200, b: 150 },
		});
		assert.ok(nr !== null);
		const lage = leseLage(neu, nr);
		assert.deepEqual(
			{ x: lage.x, y: lage.y, b: lage.b, spiegeln: lage.spiegeln },
			{ x: 100, y: 200, b: 150, spiegeln: -1 },
		);
		const k = figurIn(neu);
		assert.deepEqual(klassenVon(k), ['figur-frei']);
		assert.equal(attribut(k, 'data-lage')?.wert, 'frei');
		assert.match(neu, /<div class="ebene vorne">[\s\S]*figur-frei/);
	});

	it('figurAn: die Pose zu data-figur, sonst die Figur davor, sonst die Datei einer Grundpose', () => {
		const quelle = [
			'<img class="figur-frei" data-figur="willi-lupe" src="bilder/willi-lupe.png" alt="Willi">',
			'<img class="figur-frei" data-figur="kobi-tanzt" src="bilder/kobi-tanzt.png" alt="Kobi">',
			'<img class="figur-frei" src="bilder/wilma.png" alt="Wilma">',
			'<img class="figur-frei" data-figur="zebra" src="bilder/zebra.png" alt="Zebra">',
		].join('');
		const nrn = zerlege(quelle)
			.knoten.filter((k) => k.tag === 'img')
			.map((k) => k.nr);
		const an = (i: number) => kurz(figurAn(quelle, nrn[i] ?? -1, figuren));
		assert.deepEqual(an(0), { figur: 'willi', pose: 'willi-lupe' });
		assert.deepEqual(an(1), { figur: 'kobi', pose: undefined });
		assert.deepEqual(an(2), { figur: 'wilma', pose: 'wilma' });
		assert.equal(an(3), undefined);
	});

	it('tauscheFigur: andere Figur oder Pose; Lage, Größe und style bleiben', () => {
		const quelle = blattMit({});
		const abgelegt = legeGestaltungAb(quelle, {
			seite: ersteSeite(quelle),
			html: figurHtml(wilma, wilmaPose, 'bilder/wilma.png'),
			lage: { x: 40, y: 60, b: 150, drehen: 12 },
		});
		assert.ok(abgelegt.nr !== null);
		assert.deepEqual(kurz(figurAn(abgelegt.quelle, abgelegt.nr, figuren)), { figur: 'wilma', pose: 'wilma' });
		const stil = attribut(figurIn(abgelegt.quelle), 'style')?.wert;
		assert.ok(stil);
		const { nr, quelle: neu } = tauscheFigur(abgelegt.quelle, abgelegt.nr, mitLupe, lupe, 'bilder/willi-lupe.png');
		assert.equal(nr, abgelegt.nr);
		assert.deepEqual(kurz(figurAn(neu, abgelegt.nr, figuren)), { figur: 'willi', pose: 'willi-lupe' });
		assert.deepEqual(leseLage(neu, abgelegt.nr), leseLage(abgelegt.quelle, abgelegt.nr));
		const k = figurIn(neu);
		assert.equal(attribut(k, 'style')?.wert, stil);
		assert.equal(attribut(k, 'data-figur')?.wert, 'willi-lupe');
		assert.equal(attribut(k, 'src')?.wert, 'bilder/willi-lupe.png');
		assert.equal(attribut(k, 'alt')?.wert, 'Willi');
	});
});

/** Der Wert der Spalte `kopf` in der Tabellenzeile, deren erste Zelle `erste` ist; ohne Backticks. */
const tabellenwert = (md: string, kopf: string, erste: string) => {
	const zeilen = md
		.split('\n')
		.map((z) => z.trim())
		.filter((z) => z.startsWith('|'))
		.map((z) =>
			z
				.split('|')
				.slice(1, -1)
				.map((zelle) => zelle.trim()),
		);
	const spalte = zeilen.find((z) => z.includes(kopf))?.indexOf(kopf) ?? -1;
	return zeilen.find((z) => z[0] === erste)?.[spalte]?.replace(/^`|`$/g, '');
};

describe('Steckbrief und Canva-Referenz (177)', () => {
	const lies = (...teile: string[]) => readFileSync(path.join(WURZEL, 'skills', ...teile), 'utf8');

	it('Willi und Wilma gleichen den Skill-Dateien: „Aussehen“ und die Media-ID ihrer Datei', () => {
		const aussehen = lies('grundschul-didaktik', 'references', 'kindgerecht-gestalten.md');
		const bilder = lies('html-materialerstellung', 'references', 'bilder.md');
		for (const f of FIGUREN) {
			assert.ok(f.steckbrief && f.canva, f.id);
			assert.equal(f.steckbrief, tabellenwert(aussehen, 'Aussehen', `${f.name} Waschbär`), f.id);
			assert.equal(f.canva, tabellenwert(bilder, 'Canva-Media-ID', `\`${f.datei}\``), f.id);
		}
	});

	it('Gegenprobe: ein geänderter Text ergibt einen anderen Wert', () => {
		const md = '| Grafik | Aussehen |\n|---|---|\n| Willi Waschbär | blauer Waschbär mit Hut |\n';
		assert.equal(tabellenwert(md, 'Aussehen', 'Willi Waschbär'), 'blauer Waschbär mit Hut');
		assert.notEqual(tabellenwert(md, 'Aussehen', 'Willi Waschbär'), figurNach('willi')?.steckbrief);
		assert.equal(tabellenwert(md, 'Aussehen', 'Wilma Waschbär'), undefined);
	});
});
