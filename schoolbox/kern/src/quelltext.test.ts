import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ABBILDUNGEN, BAUSTEINE } from './bausteine';
import { ASSETS } from './konfig';
import type { Knoten, Zerlegung } from './quelltext';
import {
	dupliziere,
	entferne,
	fuegeEin,
	innenVon,
	klassenVon,
	macheRueckgaengig,
	markiere,
	neuerVerlauf,
	nimmAuf,
	quelleVon,
	setzeAttribut,
	unterschied,
	verschiebe,
	wendeAn,
	wiederhole,
	zerlege,
} from './quelltext';

const BEISPIELE = readdirSync(ASSETS)
	.filter((n) => n.endsWith('.html'))
	.map((name) => ({ name, quelle: readFileSync(path.join(ASSETS, name), 'utf8') }));

const mitKlasse = (z: Zerlegung, klasse: string) => z.knoten.filter((k) => klassenVon(k).includes(klasse));

/** Ein einfacher Zufall mit Startwert, damit ein Fehlschlag sich wiederholen lässt. */
const zufall = (start: number) => {
	let s = start;
	return (n: number) => {
		s = (s * 1103515245 + 12345) % 2147483648;
		return s % n;
	};
};

describe('zerlege', () => {
	it('findet in allen Vorlagen und Beispielen jedes Element mit passenden Tags', () => {
		assert.ok(BEISPIELE.length >= 3);
		for (const { name, quelle } of BEISPIELE) {
			const z = zerlege(quelle);
			assert.ok(z.knoten.length > 20, name);
			for (const k of z.knoten) {
				assert.equal(z.knoten[k.nr], k);
				const text = quelleVon(z, k);
				assert.match(text, new RegExp(`^<${k.tag}[\\s>/]`, 'i'), `${name}: Start von <${k.tag}>`);
				if (k.schliesserStart !== k.ende) {
					assert.match(text, new RegExp(`</${k.tag}>$`, 'i'), `${name}: Ende von <${k.tag}> (${k.nr})`);
				}
				for (const kind of k.kinder) {
					assert.ok(
						kind.start >= k.oeffnerEnde && kind.ende <= k.schliesserStart,
						`${name}: Kind in <${k.tag}>`,
					);
				}
			}
		}
	});

	it('liest Attribute mit Entitäten und Größer-Zeichen in Anführungszeichen', () => {
		const z = zerlege('<div class="a b" data-l="2 &gt; 1" title=\'x>y\' hidden><img src=bild.png alt=""></div>');
		const [div, img] = z.knoten;
		assert.equal(div?.tag, 'div');
		assert.deepEqual(
			div?.attribute.map((a) => [a.name, a.wert]),
			[
				['class', 'a b'],
				['data-l', '2 > 1'],
				['title', 'x>y'],
				['hidden', null],
			],
		);
		assert.equal(img?.eltern, div);
		assert.equal(img?.ende, img?.oeffnerEnde);
	});

	it('überspringt Kommentare, Skripte und Stile', () => {
		const z = zerlege('<!-- <div> --><script>if (a < b) { x("</div>"); }</script><style>p>b{}</style><p>Text</p>');
		assert.deepEqual(
			z.knoten.map((k) => k.tag),
			['script', 'style', 'p'],
		);
		assert.equal(innenVon(z, z.knoten[2] as Knoten), 'Text');
	});

	it('schließt Elemente ohne End-Tag wie der Browser', () => {
		const z = zerlege('<ul><li>eins<li>zwei</ul><p>a<div>b</div><p>c<p>d</body>');
		const namen = z.knoten.map((k) => `${k.tag}<${k.eltern?.tag ?? '-'}`);
		assert.deepEqual(namen, ['ul<-', 'li<ul', 'li<ul', 'p<-', 'div<-', 'p<-', 'p<-']);
		const [, eins] = z.knoten;
		assert.equal(quelleVon(z, eins as Knoten), '<li>eins');
	});

	it('kennt selbstschließende Elemente nur in SVG', () => {
		const z = zerlege('<svg><circle r="1"/><path d=""/></svg><div/>Text</div>');
		assert.deepEqual(
			z.knoten.map((k) => `${k.tag}<${k.eltern?.tag ?? '-'}`),
			['svg<-', 'circle<svg', 'path<svg', 'div<-'],
		);
		assert.equal(innenVon(z, z.knoten[3] as Knoten), 'Text');
	});
});

describe('markiere', () => {
	it('setzt eine Kennung in jedes Start-Tag und ändert sonst nichts', () => {
		for (const { name, quelle } of BEISPIELE) {
			const z = zerlege(quelle);
			const markiert = markiere(z);
			assert.equal((markiert.match(/ data-sb="\d+"/g) ?? []).length, z.knoten.length, name);
			assert.equal(markiert.replace(/ data-sb="\d+"/g, ''), quelle, name);
			const neu = zerlege(markiert);
			assert.deepEqual(
				neu.knoten.map((k) => k.attribute.find((a) => a.name === 'data-sb')?.wert),
				z.knoten.map((k) => String(k.nr)),
			);
		}
	});
});

describe('Änderungen', () => {
	it('eine Textänderung betrifft nur diese Stelle', () => {
		for (const { name, quelle } of BEISPIELE) {
			const z = zerlege(quelle);
			const h1 = z.knoten.find((k) => k.tag === 'h1');
			assert.ok(h1, name);
			const neu = wendeAn(quelle, [{ von: h1.oeffnerEnde, bis: h1.schliesserStart, text: 'Neuer Titel' }]);
			const diff = unterschied(quelle, neu, 'Text');
			assert.ok(diff && diff.von >= h1.oeffnerEnde && diff.von + diff.alt.length <= h1.schliesserStart, name);
			assert.equal(neu.split('\n').length, quelle.split('\n').length);
			assert.doesNotMatch(neu, /data-sb|<svg/);
		}
	});

	it('löscht eine Aufgabe samt ihrer Zeilen und fügt sie an anderer Stelle wieder ein', () => {
		const { quelle } = BEISPIELE.find((b) => b.name === 'vorlage-arbeitsblatt.html') ?? { quelle: '' };
		const z = zerlege(quelle);
		const [a1, , a3] = mitKlasse(z, 'aufgabe');
		assert.ok(a1 && a3);
		const ohne = wendeAn(quelle, entferne(z, a3));
		assert.ok(!ohne.includes('Stimmt das?'));
		assert.equal(ohne.split('\n').length, quelle.split('\n').length - quelleVon(z, a3).split('\n').length);

		const verschoben = wendeAn(quelle, verschiebe(z, a3, a1, 'vor'));
		assert.equal(verschoben.length, quelle.length);
		assert.deepEqual(verschoben.split('\n').sort(), quelle.split('\n').sort());
		const nummern = mitKlasse(zerlege(verschoben), 'nr').map((k) => innenVon(zerlege(verschoben), k));
		assert.deepEqual(nummern, ['3', '1', '2', '★']);
	});

	it('dupliziert ein Item mit seiner Lösung auf eine eigene Zeile', () => {
		const { quelle } = BEISPIELE.find((b) => b.name === 'vorlage-arbeitsblatt.html') ?? { quelle: '' };
		const z = zerlege(quelle);
		const zelle = mitKlasse(z, 'zelle')[1];
		assert.ok(zelle);
		const neu = wendeAn(quelle, dupliziere(z, zelle));
		assert.equal((neu.match(/data-l="halb 5"/g) ?? []).length, 2);
		assert.equal(neu.split('\n').length, quelle.split('\n').length + 1);
	});

	it('setzt und entfernt Attribute, ohne die anderen anzufassen', () => {
		const quelle = '<div class="reihe" style="--spalten:4">\n  <x-uhr zeit="3:00"></x-uhr>\n</div>';
		const z = zerlege(quelle);
		const [reihe, uhr] = z.knoten as [Knoten, Knoten];
		assert.equal(
			wendeAn(quelle, setzeAttribut(z, reihe, 'style', '--spalten:3')),
			quelle.replace('--spalten:4', '--spalten:3'),
		);
		assert.equal(
			wendeAn(quelle, setzeAttribut(z, uhr, 'loesung', '4:30 "x"')),
			quelle.replace('<x-uhr', '<x-uhr loesung="4:30 &quot;x&quot;"'),
		);
		assert.equal(wendeAn(quelle, setzeAttribut(z, uhr, 'zeit', null)), quelle.replace(' zeit="3:00"', ''));
	});

	it('fügt hinter das letzte Element ein, auch ohne Zeilenumbruch am Ende', () => {
		const quelle = '<div>\n  <p>a</p>\n  <p>b</p></div>';
		const z = zerlege(quelle);
		const b = z.knoten[2] as Knoten;
		assert.equal(wendeAn(quelle, fuegeEin(z, b, 'nach', '<p>c</p>')), `${quelle.slice(0, -6)}<p>c</p></div>`);
		const einzeln = '<p>a</p>';
		const z2 = zerlege(einzeln);
		assert.equal(wendeAn(einzeln, fuegeEin(z2, z2.knoten[0] as Knoten, 'nach', '<p>b</p>')), '<p>a</p>\n<p>b</p>');
	});

	it('lehnt sich überschneidende Änderungen ab', () => {
		assert.throws(() =>
			wendeAn('abcdef', [
				{ von: 1, bis: 4, text: '' },
				{ von: 3, bis: 5, text: '' },
			]),
		);
	});
});

describe('Verlauf', () => {
	it('stellt nach 60 Schritten mit Rückgängig exakt den Ausgangszustand her und mit Wiederholen das Ende', () => {
		for (const [nr, { name, quelle }] of BEISPIELE.entries()) {
			const wuerfel = zufall(nr + 7);
			let verlauf = neuerVerlauf(quelle);
			const staende = [quelle];
			for (let i = 0; i < 60; i += 1) {
				const z = zerlege(verlauf.quelle);
				const kandidaten = z.knoten.filter((k) =>
					['aufgabe', 'zelle', 'blase', 'ziel', 'seite', 'reihe'].some((c) => klassenVon(k).includes(c)),
				);
				const k = kandidaten[wuerfel(kandidaten.length)] as Knoten;
				const ziel = kandidaten[wuerfel(kandidaten.length)] as Knoten;
				const enthaelt = (a: Knoten, b: Knoten) => b.start >= a.start && b.ende <= a.ende;
				const art = wuerfel(5);
				let aenderungen = setzeAttribut(z, k, 'data-test', String(i));
				if (art === 0 && !enthaelt(k, ziel) && !enthaelt(ziel, k)) {
					aenderungen = verschiebe(z, k, ziel, i % 2 ? 'vor' : 'nach');
				} else if (art === 1 && z.quelle.length < quelle.length * 2) {
					aenderungen = dupliziere(z, k);
				} else if (art === 2 && kandidaten.length > 10 && !klassenVon(k).includes('seite')) {
					aenderungen = entferne(z, k);
				} else if (art === 3 && k.kinder.length === 0) {
					aenderungen = [{ von: k.oeffnerEnde, bis: k.schliesserStart, text: `Text ${i} mit „ß“` }];
				}
				verlauf = nimmAuf(verlauf, wendeAn(verlauf.quelle, aenderungen), `Schritt ${i}`);
				if (verlauf.quelle !== staende.at(-1)) {
					staende.push(verlauf.quelle);
				}
			}
			assert.ok(verlauf.zurueck.length >= 50, `${name}: ${verlauf.zurueck.length} Schritte`);
			const ende = verlauf.quelle;
			for (let i = staende.length - 2; i >= 0; i -= 1) {
				verlauf = macheRueckgaengig(verlauf);
				assert.equal(verlauf.quelle, staende[i], `${name}: Rückgängig bis Stand ${i}`);
			}
			assert.equal(macheRueckgaengig(verlauf), verlauf);
			while (verlauf.vor.length > 0) {
				verlauf = wiederhole(verlauf);
			}
			assert.equal(verlauf.quelle, ende);
		}
	});

	it('nimmt unveränderte Fassungen nicht auf und verwirft Wiederholen nach einem neuen Befehl', () => {
		let v = neuerVerlauf('<p>a</p>');
		assert.equal(nimmAuf(v, '<p>a</p>', 'nichts'), v);
		v = nimmAuf(v, '<p>b</p>', 'b');
		v = macheRueckgaengig(v);
		assert.equal(v.vor.length, 1);
		v = nimmAuf(v, '<p>c</p>', 'c');
		assert.equal(v.vor.length, 0);
		assert.equal(macheRueckgaengig(v).quelle, '<p>a</p>');
	});
});

describe('Baustein-Register', () => {
	it('kennt jede Abbildung aus abbildungen.js', () => {
		const js = readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8');
		const arten = /const ARTEN = \{([^}]*)\}/.exec(js)?.[1] ?? '';
		const namen = [...arten.matchAll(/"(x-[a-z]+)"/g)].map((t) => t[1]);
		assert.deepEqual([...namen].sort(), [...ABBILDUNGEN].sort());
	});

	it('hat eindeutige Arten', () => {
		const arten = BAUSTEINE.map((b) => b.art);
		assert.equal(new Set(arten).size, arten.length);
	});
});
