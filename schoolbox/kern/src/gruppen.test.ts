import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FIGUR_ANKER, FIGUR_FREI, FORM, PFAD, SCHMUCK } from '../../web/e2e/gestaltung-daten';
import { dupliziereGestaltung, leseLage, setzeLage } from './gestaltung';
import type { Mass } from './gruppen';
import { gruppiere, istGruppe, kinderDerGruppe, loeseGruppe, nurGleichmaessig, skaliereGruppe } from './gruppen';
import { attribut, klassenVon, quelleVon, zerlege } from './quelltext';

const LINIE =
	'<svg class="form" data-lage="frei" data-form="linie" data-punkte="10,10 100,50" viewBox="0 0 110 60" style="--x:300px;--y:900px;--b:110px;--h:60px">' +
	'<path d="M10 10 L100 50" style="fill:none;stroke:var(--dunkel);stroke-width:3px"/></svg>';

const RECHTECK =
	'<svg class="form" data-lage="frei" data-form="rechteck" viewBox="0 0 100 50" style="--x:100px;--y:200px;--b:100px;--h:50px">' +
	'<path d="M0 0H100V50H0Z" style="stroke-width:3px"/></svg>';

const gestaltung = (q: string) => zerlege(q).knoten.filter((k) => attribut(k, 'data-lage')?.wert === 'frei');
const nrMit = (q: string, teil: string) => {
	const k = zerlege(q).knoten.find((n) => q.slice(n.start, n.oeffnerEnde).includes(teil));
	assert.ok(k, `${teil} fehlt`);
	return k.nr;
};
const gruppeIn = (q: string) => {
	const k = zerlege(q).knoten.find((n) => klassenVon(n).includes('gruppe'));
	assert.ok(k, 'Gruppe fehlt');
	return k.nr;
};

/** Mitte eines Kinds im Blatt, aus der Lage der Gruppe nachgerechnet (`rotate() scaleX()` um die Mitte). */
const mitteImBlatt = (q: string, kind: number, g: number | null, m: { b: number; h: number }) => {
	const l = leseLage(q, kind);
	const b = l.b ?? m.b;
	const h = l.h ?? m.h;
	let x = (l.x ?? 0) + b / 2;
	let y = (l.y ?? 0) + h / 2;
	if (g !== null) {
		const G = leseLage(q, g);
		const gb = G.b ?? 0;
		const gh = G.h ?? 0;
		const px = (x - gb / 2) * ((G.spiegeln ?? 1) < 0 ? -1 : 1);
		const py = y - gh / 2;
		const r = ((G.drehen ?? 0) * Math.PI) / 180;
		x = (G.x ?? 0) + gb / 2 + px * Math.cos(r) - py * Math.sin(r);
		y = (G.y ?? 0) + gh / 2 + px * Math.sin(r) + py * Math.cos(r);
	}
	return { x, y };
};

const FIGUR_MASS: Mass = { x: 610, y: 520, b: 150, h: 200 };

describe('Gruppen (120)', () => {
	it('Gruppieren und Auflösen ohne Drehung ergibt die Ausgangsquelle', () => {
		const q = blattMit({ vorne: [RECHTECK, FIGUR_FREI] });
		const nrn = [nrMit(q, 'rechteck'), nrMit(q, 'figur-frei')];
		const g = gruppiere(q, nrn, [undefined, FIGUR_MASS]);
		assert.ok(g.nr !== null && istGruppe(zerlege(g.quelle).knoten[g.nr]));
		assert.deepEqual(leseLage(g.quelle, g.nr), { x: 100, y: 200, b: 660, h: 520 });
		assert.equal(kinderDerGruppe(g.quelle, g.nr).length, 2);
		const l = loeseGruppe(g.quelle, g.nr, [undefined, { b: 150, h: 200 }]);
		assert.equal(l.quelle, q);
		assert.equal(l.kinder.length, 2);
		assert.equal(l.nr, l.kinder[0]);
	});

	it('Die Gruppe steht an der Stelle des vordersten Kinds, die Kinder behalten ihre Reihenfolge', () => {
		const q = blattMit({ vorne: [RECHTECK, PFAD, FIGUR_FREI] });
		const g = gruppiere(q, [nrMit(q, 'figur-frei'), nrMit(q, 'rechteck')], [FIGUR_MASS]);
		const vorne = zerlege(g.quelle).knoten.find((k) => klassenVon(k).includes('vorne'));
		assert.ok(vorne);
		const reihe = vorne.kinder.map((k) =>
			klassenVon(k).includes('gruppe') ? 'gruppe' : attribut(k, 'data-form')?.wert,
		);
		assert.deepEqual(reihe, ['pfad', 'gruppe']);
		const kinder = kinderDerGruppe(g.quelle, gruppeIn(g.quelle)).map((nr) =>
			klassenVon(zerlege(g.quelle).knoten[nr]!),
		);
		assert.deepEqual(kinder, [['form'], ['figur-frei']]);
	});

	it('Nur Elemente desselben Elternteils', () => {
		const q = blattMit({ vorne: [RECHTECK], hinten: [PFAD] });
		assert.throws(() => gruppiere(q, [nrMit(q, 'rechteck'), nrMit(q, 'pfad')]), /derselben Ebene/);
	});

	it('Auflösen einer gedrehten und gespiegelten Gruppe: Die Kinder bleiben an ihrer Stelle im Blatt', () => {
		const q = blattMit({ vorne: [FORM, FIGUR_FREI] });
		const g = gruppiere(q, [nrMit(q, 'stern'), nrMit(q, 'figur-frei')], [undefined, FIGUR_MASS]);
		assert.ok(g.nr !== null);
		const gedreht = setzeLage(g.quelle, g.nr, { drehen: -23, spiegeln: -1 });
		const kinder = kinderDerGruppe(gedreht, g.nr);
		const masse = [
			{ b: 120, h: 120 },
			{ b: 150, h: 200 },
		];
		const vorher = kinder.map((k, i) => mitteImBlatt(gedreht, k, g.nr, masse[i]!));
		const l = loeseGruppe(gedreht, g.nr, masse);
		l.kinder.forEach((k, i) => {
			const nachher = mitteImBlatt(l.quelle, k, null, masse[i]!);
			assert.ok(Math.abs(nachher.x - vorher[i]!.x) <= 0.5, `x ${nachher.x} ≠ ${vorher[i]!.x}`);
			assert.ok(Math.abs(nachher.y - vorher[i]!.y) <= 0.5, `y ${nachher.y} ≠ ${vorher[i]!.y}`);
		});
		// Stern: 12° in einer um −23° gedrehten, gespiegelten Gruppe → −35°, gespiegelt.
		assert.deepEqual(
			[leseLage(l.quelle, l.kinder[0]!).drehen, leseLage(l.quelle, l.kinder[0]!).spiegeln],
			[-35, -1],
		);
		// Figur war gespiegelt: in der gespiegelten Gruppe nicht mehr.
		assert.equal(leseLage(l.quelle, l.kinder[1]!).spiegeln, undefined);
	});

	it('skaliereGruppe rechnet Form, Schmuckschrift, Pfad und Linie um; Strichstärken bleiben', () => {
		const q = blattMit({ vorne: [RECHTECK, SCHMUCK, PFAD, LINIE] });
		const g = gruppiere(
			q,
			['rechteck', 'schmuck', 'data-form="pfad"', 'linie'].map((t) => nrMit(q, t)),
			[undefined, { x: 64, y: 150, b: 666, h: 62 }],
		);
		assert.ok(g.nr !== null);
		const alt = leseLage(g.quelle, g.nr);
		const neu = skaliereGruppe(g.quelle, g.nr, {
			x: alt.x ?? 0,
			y: alt.y ?? 0,
			b: (alt.b ?? 0) * 2,
			h: (alt.h ?? 0) * 2,
		});
		const kinder = kinderDerGruppe(neu, g.nr);
		const vor = kinderDerGruppe(g.quelle, g.nr);
		kinder.forEach((k, i) => {
			const a = leseLage(g.quelle, vor[i]!);
			const b = leseLage(neu, k);
			assert.equal(b.x, Math.round((a.x ?? 0) * 2));
			assert.equal(b.y, Math.round((a.y ?? 0) * 2));
			if (a.b !== undefined) {
				assert.equal(b.b, a.b * 2);
			}
		});
		const z = zerlege(neu);
		const html = kinder.map((k) => quelleVon(z, z.knoten[k]!));
		assert.match(html[0]!, /viewBox="0 0 200 100"/);
		assert.match(html[1]!, /--gr:112px/);
		assert.match(html[2]!, /stroke-width:4px/);
		assert.match(html[3]!, /stroke-width:3px/);
		assert.doesNotMatch(html[3]!, /data-punkte="10,10 100,50"/);
	});

	it('Mit gedrehtem Kind oder Bild skaliert die Gruppe nur gleichmäßig', () => {
		const ohne = blattMit({ vorne: [RECHTECK, PFAD] });
		const g1 = gruppiere(ohne, [nrMit(ohne, 'rechteck'), nrMit(ohne, 'data-form="pfad"')]);
		assert.equal(nurGleichmaessig(g1.quelle, g1.nr ?? -1), false);
		const gedreht = blattMit({ vorne: [FORM, PFAD] });
		const g2 = gruppiere(gedreht, [nrMit(gedreht, 'stern'), nrMit(gedreht, 'data-form="pfad"')]);
		assert.equal(nurGleichmaessig(g2.quelle, g2.nr ?? -1), true);
		const bild = blattMit({ vorne: [RECHTECK, FIGUR_FREI] });
		const g3 = gruppiere(bild, [nrMit(bild, 'rechteck'), nrMit(bild, 'figur-frei')], [undefined, FIGUR_MASS]);
		assert.equal(nurGleichmaessig(g3.quelle, g3.nr ?? -1), true);
	});

	it('Der Anker wandert an die Gruppe und beim Auflösen zurück an die Kinder', () => {
		const zweite = FIGUR_ANKER.replace('--x:560px;--y:-40px', '--x:400px;--y:10px');
		const q = blattMit({ anker: [FIGUR_ANKER, zweite] });
		const nrn = gestaltung(q).map((k) => k.nr);
		const masse = [
			{ x: 560, y: -40, b: 110, h: 140 },
			{ x: 400, y: 10, b: 110, h: 140 },
		];
		const g = gruppiere(q, nrn, masse);
		assert.ok(g.nr !== null);
		const z = zerlege(g.quelle);
		const gruppe = z.knoten[g.nr]!;
		assert.ok(attribut(gruppe, 'data-anker'));
		assert.ok(klassenVon(gruppe.eltern!).includes('aufgabe'));
		assert.ok(gruppe.kinder.every((k) => !attribut(k, 'data-anker')));
		const l = loeseGruppe(g.quelle, g.nr, masse);
		assert.equal(l.quelle, q);
	});

	it('Verschachtelt: skalieren und auflösen über zwei Ebenen', () => {
		const q = blattMit({ vorne: [RECHTECK, PFAD, LINIE] });
		const innen = gruppiere(q, [nrMit(q, 'rechteck'), nrMit(q, 'data-form="pfad"')]);
		assert.ok(innen.nr !== null);
		const aussen = gruppiere(innen.quelle, [innen.nr, nrMit(innen.quelle, 'linie')]);
		assert.ok(aussen.nr !== null);
		const a = leseLage(aussen.quelle, aussen.nr);
		const gross = skaliereGruppe(aussen.quelle, aussen.nr, {
			x: a.x ?? 0,
			y: a.y ?? 0,
			b: (a.b ?? 0) * 2,
			h: (a.h ?? 0) * 2,
		});
		const innere = kinderDerGruppe(gross, aussen.nr).find((k) => istGruppe(zerlege(gross).knoten[k]));
		assert.ok(innere !== undefined);
		const rechteck = kinderDerGruppe(gross, innere)[0]!;
		assert.equal(leseLage(gross, rechteck).b, 200);
		const eins = loeseGruppe(aussen.quelle, aussen.nr);
		const innenWieder = eins.kinder.find((k) => istGruppe(zerlege(eins.quelle).knoten[k]));
		assert.ok(innenWieder !== undefined);
		assert.equal(loeseGruppe(eins.quelle, innenWieder).quelle, q);
	});

	it('Gruppieren ändert keine Ids, Duplizieren der Gruppe gibt allen Kindern neue', () => {
		const verlauf =
			'<svg class="form" data-lage="frei" data-form="kreis" viewBox="0 0 100 100" style="--x:300px;--y:400px;--b:100px;--h:100px">' +
			'<defs><linearGradient id="verlauf-a1b2"><stop offset="0" stop-color="#ffd166"/></linearGradient></defs>' +
			'<circle cx="50" cy="50" r="48" fill="url(#verlauf-a1b2)"/></svg>';
		const q = blattMit({ vorne: [verlauf, RECHTECK] });
		const g = gruppiere(q, [nrMit(q, 'kreis'), nrMit(q, 'rechteck')]);
		assert.ok(g.nr !== null);
		assert.match(g.quelle, /id="verlauf-a1b2"/);
		const kopie = dupliziereGestaltung(g.quelle, g.nr);
		assert.equal(kopie.quelle.match(/id="verlauf-/g)?.length, 2);
		assert.equal(kopie.quelle.match(/id="verlauf-a1b2"/g)?.length, 1);
	});
});
