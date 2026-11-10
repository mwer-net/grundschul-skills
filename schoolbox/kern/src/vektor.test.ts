import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Punkt, Zug } from './formen-geometrie';
import { lesePfadForm, skalierePfad } from './formen-pfad';
import { leseLage } from './gestaltung';
import { legePfad, loeschePfadPunkt, setzePfadPunkt } from './pfad-aendern';
import { zerlege } from './quelltext';
import {
	ankerVon,
	glaette,
	liesPfad,
	loescheAnker,
	normalisiere,
	schreibePfad,
	setzeAnker,
	umschliessendesRechteck,
	zerlegePfad,
} from './vektor';

/** Punkte entlang der Züge, je Segment `n` Proben (zum Vergleich zweier Pfade). */
const proben = (zuege: readonly Zug[], n = 8): Punkt[] => {
	const liste: Punkt[] = [];
	for (const z of zuege) {
		let von = z.start;
		liste.push(von);
		for (const s of z.segmente) {
			for (let i = 1; i <= n; i += 1) {
				const t = i / n;
				const u = 1 - t;
				if (s.art === 'C') {
					liste.push({
						x: u * u * u * von.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p.x,
						y: u * u * u * von.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p.y,
					});
				} else if (s.art === 'L') {
					liste.push({ x: von.x + (s.p.x - von.x) * t, y: von.y + (s.p.y - von.y) * t });
				}
			}
			von = s.p;
		}
	}
	return liste;
};

const nah = (a: Punkt, b: Punkt, toleranz = 0.02) =>
	assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= toleranz, `${a.x},${a.y} ≠ ${b.x},${b.y}`);

const gelesen = (d: string) => {
	const z = liesPfad(d);
	assert.ok(z, `unlesbar: ${d}`);
	return z;
};

describe('zerlegePfad und normalisiere', () => {
	it('liest absolute und relative Befehle gleich', () => {
		const abs = gelesen('M10 10 L60 10 H80 V40 C80 60 60 70 40 70 S10 50 10 40 Q10 20 20 15 T40 10 Z');
		const rel = gelesen('m10 10 l50 0 h20 v30 c0 20 -20 30 -40 30 s-30 -20 -30 -30 q0 -20 10 -25 t20 -5 z');
		assert.equal(schreibePfad(rel), schreibePfad(abs));
	});

	it('wiederholte Zahlen nach M sind L, Flags von A ohne Trenner', () => {
		assert.deepEqual(
			zerlegePfad('M0 0 10 0 10 10a5 5 0 011 1')?.map((b) => b.art),
			['M', 'L', 'L', 'a'],
		);
	});

	it('nur noch M L C Z, absolut', () => {
		const d = schreibePfad(gelesen('m0 0 h10 v10 q5 5 0 10 t-10 0 a5 5 0 0 1 -5 -5 z'));
		assert.match(d, /^[MLCZ0-9 .-]+$/);
		assert.ok(!/[HVQTSA]/.test(d));
	});

	it('ein Halbkreis mit A wird zu Kurven, die auf dem Kreis liegen', () => {
		const z = gelesen('M10 50 A40 40 0 0 1 90 50');
		for (const p of proben(z, 16)) {
			assert.ok(Math.abs(Math.hypot(p.x - 50, p.y - 50) - 40) < 0.05, `${p.x},${p.y} liegt nicht auf dem Kreis`);
		}
		const r = umschliessendesRechteck(z);
		nah({ x: r.x, y: r.y }, { x: 10, y: 10 }, 0.05);
		nah({ x: r.b, y: r.h }, { x: 80, y: 40 }, 0.05);
	});

	it('zu kleine Radien von A wachsen (SVG F.6.6)', () => {
		const z = gelesen('M0 0 A1 1 0 0 1 20 0');
		const r = umschliessendesRechteck(z);
		assert.ok(Math.abs(r.h - 10) < 0.05, `Höhe ${r.h}`);
	});

	it('hin und zurück ändert die Form nicht', () => {
		for (const d of [
			'M10 50 a40 20 30 1 0 60 10 z',
			'M0 0 C10 20 30 20 40 0 S70 -20 80 0',
			'M5 5 h20 v20 h-20 z',
		]) {
			const einmal = gelesen(d);
			const zweimal = gelesen(schreibePfad(einmal));
			const a = proben(einmal);
			const b = proben(zweimal);
			assert.equal(a.length, b.length);
			a.forEach((p, i) => nah(p, b[i] ?? p));
		}
	});

	it('unlesbar ist null', () => {
		assert.equal(liesPfad('M0 0 X5'), null);
		assert.equal(normalisiere([]).length, 0);
	});
});

describe('umschliessendesRechteck', () => {
	it('misst die Kurve, nicht ihre Kontrollpunkte', () => {
		const r = umschliessendesRechteck(gelesen('M0 0 C0 -40 100 -40 100 0'));
		assert.ok(r.y > -31 && r.y < -29, `oben ${r.y}`);
		assert.equal(r.b, 100);
	});
});

describe('glaette', () => {
	const kreis = (n: number, r: number, rauschen = 0) =>
		Array.from({ length: n + 1 }, (_, i) => {
			const w = (i / n) * 2 * Math.PI;
			return { x: 100 + r * Math.cos(w) + Math.sin(i * 7) * rauschen, y: 100 + r * Math.sin(w) };
		});

	it('ein Kreis aus 200 Punkten: höchstens 12 Kurven, Fehler unter 2 px', () => {
		const punkte = kreis(200, 80, 0.5);
		const z = glaette(punkte, 2, true);
		assert.ok(z.zu);
		assert.ok(z.segmente.length <= 12, `${z.segmente.length} Segmente`);
		// Fein genug abgetastet, dass der Abstand der Proben den Fehler nicht aufbläht.
		const kurve = proben([z], 400);
		for (const p of punkte) {
			const best = Math.min(...kurve.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
			assert.ok(best < 2, `Fehler ${best}`);
		}
	});

	it('ein Quadrat behält vier Ecken', () => {
		const ecken = [
			[0, 0],
			[100, 0],
			[100, 100],
			[0, 100],
			[0, 0],
		] as const;
		const punkte: Punkt[] = [];
		for (let e = 0; e < 4; e += 1) {
			const [ax, ay] = ecken[e] ?? [0, 0];
			const [bx, by] = ecken[e + 1] ?? [0, 0];
			for (let t = 0; t < 50; t += 1) {
				punkte.push({ x: ax + ((bx - ax) * t) / 50, y: ay + ((by - ay) * t) / 50 });
			}
		}
		punkte.push({ x: 0, y: 0 });
		const z = glaette(punkte, 2, true);
		assert.equal(z.segmente.length, 4);
		assert.ok(z.segmente.every((s) => s.art === 'L'));
	});

	it('2000 Punkte in unter 50 ms', () => {
		const lang = Array.from({ length: 2000 }, (_, i) => ({
			x: i * 0.5 + Math.sin(i / 30) * 40,
			y: Math.cos(i / 17) * 60,
		}));
		glaette(lang, 2);
		const start = performance.now();
		glaette(lang, 2);
		const dauer = performance.now() - start;
		assert.ok(dauer < 50, `${dauer} ms`);
	});
});

describe('Punkte bearbeiten (rein)', () => {
	const QUADRAT = gelesen('M0 0 L10 0 L10 10 L0 10 Z');

	it('ein geschlossener Zug, der auf dem Start endet, hat keinen doppelten Punkt', () => {
		assert.equal(ankerVon(gelesen('M0 0 L10 0 L10 10 L0 0 Z')).length, 3);
		assert.equal(ankerVon(QUADRAT).length, 4);
	});

	it('setzeAnker schiebt die Griffe mit, mit Griffen stehen sie dort', () => {
		const z = gelesen('M0 0 C5 0 10 5 10 10 C10 15 5 20 0 20');
		assert.equal(schreibePfad(setzeAnker(z, 1, { x: 20, y: 10 })), 'M0 0 C5 0 20 5 20 10 C20 15 5 20 0 20');
		assert.equal(
			schreibePfad(setzeAnker(z, 1, { x: 10, y: 10 }, { ein: { x: 0, y: 10 }, aus: { x: 20, y: 10 } })),
			'M0 0 C5 0 0 10 10 10 C20 10 5 20 0 20',
		);
	});

	it('loescheAnker verbindet die Nachbarn, zwei Punkte bleiben immer', () => {
		assert.equal(schreibePfad(loescheAnker(QUADRAT, 0)), 'M10 0 L10 10 L0 10 Z');
		assert.equal(schreibePfad(loescheAnker(QUADRAT, 2)), 'M0 0 L10 0 L0 10 Z');
		const zwei = gelesen('M0 0 L10 0');
		assert.equal(schreibePfad(loescheAnker(zwei, 0)), 'M0 0 L10 0');
	});
});

describe('Pfad in der Quelle', () => {
	const blatt = () =>
		[
			'<body>',
			'<section class="seite">',
			'  <div class="aufgabe"><span class="nr">1</span></div>',
			'</section>',
			'</body>',
			'',
		].join('\n');
	const seite = (q: string) => zerlege(q).knoten.find((k) => k.tag === 'section')?.nr ?? -1;

	const abgelegt = (geschlossen: boolean) => {
		const vorher = blatt();
		const zuege = gelesen(geschlossen ? 'M100 100 L200 100 L150 180 Z' : 'M100 100 C150 50 200 150 250 100');
		const r = legePfad(vorher, { seite: seite(vorher), zuege, geschlossen });
		assert.ok(r.nr !== null);
		return { quelle: r.quelle, nr: r.nr };
	};

	it('legePfad: Lage ist das Rechteck plus halbe Strichstärke, `d` relativ dazu', () => {
		const { nr, quelle } = abgelegt(true);
		const lage = leseLage(quelle, nr);
		assert.deepEqual([lage.x, lage.y, lage.b, lage.h], [98, 98, 104, 84]);
		assert.match(quelle, /data-form="pfad" viewBox="0 0 104 84"/);
		assert.match(quelle, /d="M2 2 L102 2 L52 82 Z"/);
		assert.match(quelle, /fill:var\(--akzent\)/);
	});

	it('offen nur Kontur mit runden Enden', () => {
		const { quelle } = abgelegt(false);
		assert.match(quelle, /fill:none;stroke:var\(--dunkel\);stroke-width:3px/);
		assert.match(quelle, /stroke-linecap:round/);
	});

	it('Größe ändern streckt die Punkte, der Strich bleibt', () => {
		const { nr, quelle } = abgelegt(true);
		const breit = skalierePfad(quelle.replace('--b:104px', '--b:204px'), nr);
		const a = lesePfadForm(breit, nr);
		assert.deepEqual(a?.viewBox, { b: 204, h: 84 });
		assert.match(breit, /stroke-width:3px/);
		const r = umschliessendesRechteck(a?.zuege ?? []);
		nah({ x: r.x, y: r.x + r.b }, { x: 2, y: 202 });
	});

	it('setzePfadPunkt: das Element wächst mit, die anderen Punkte bleiben auf dem Blatt', () => {
		const { nr, quelle } = abgelegt(true);
		const neu = setzePfadPunkt(quelle, nr, 1, { x: 152, y: 2 });
		const lage = leseLage(neu, nr);
		assert.deepEqual([lage.x, lage.y, lage.b, lage.h], [98, 98, 154, 84]);
		assert.match(neu, /d="M2 2 L152 2 L52 82 Z"/);
	});

	it('gedreht bleibt ein fester Punkt auf dem Blatt stehen', () => {
		const { nr, quelle } = abgelegt(true);
		const gedreht = quelle.replace('--h:84px', '--h:84px;--drehen:90deg');
		const vorher = leseLage(gedreht, nr);
		const neu = setzePfadPunkt(gedreht, nr, 1, { x: 152, y: 2 });
		const lage = leseLage(neu, nr);
		// Der Start (2,2) im Element liegt auf dem Blatt bei Mitte + Drehung um 90°.
		const aufBlatt = (l: typeof lage, p: Punkt) => {
			const m = { x: (l.b ?? 0) / 2, y: (l.h ?? 0) / 2 };
			return { x: (l.x ?? 0) + m.x - (p.y - m.y), y: (l.y ?? 0) + m.y + (p.x - m.x) };
		};
		nah(aufBlatt(lage, { x: 2, y: 2 }), aufBlatt(vorher, { x: 2, y: 2 }), 1);
	});

	it('loeschePfadPunkt und ein Pfad von Claude mit A wird normalisiert geschrieben', () => {
		const q = blatt().replace(
			'</section>',
			'  <div class="ebene vorne"><svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 100 60" style="--x:10px;--y:10px;--b:100px;--h:60px"><path d="m10 50 a40 40 0 0 1 80 0 z" style="fill:var(--akzent);stroke:none"/></svg></div>\n</section>',
		);
		const nr = zerlege(q).knoten.find((k) => k.tag === 'svg')?.nr ?? -1;
		assert.equal(ankerVon(lesePfadForm(q, nr)?.zuege ?? []).length, 3);
		const neu = loeschePfadPunkt(q, nr, 1);
		assert.match(neu, /d="M[-\d. LCZ]+"/);
		assert.ok(!/ a40/.test(neu));
	});
});
