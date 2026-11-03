/**
 * s/w als Darstellung (040). Echte Läufe mit blatt.py: Umrechnung im Browser, Layout gegen Farbe, keine bunten Pixel.
 * Gegenproben stehen als eigene Fälle hier: Die Messungen müssen bei einem Blatt ohne Pass anschlagen.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { darstellungsHtml, druckprofilAusHtml } from './html';
import { ASSETS, BLATT_PY } from './konfig';

const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';
const hatBrowser = () => {
	try {
		execFileSync('python3', ['-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-grau-'));
after(() => rmSync(ordner, { force: true, recursive: true }));

/** Lädt die Datei in Chromium und gibt den Inhalt von `<pre id="ergebnis">` als JSON zurück. */
const imBrowser = <T>(html: string, name: string): T => {
	const datei = path.join(ordner, `${name}.html`);
	writeFileSync(datei, html);
	const skript = [
		'import sys, re, html, json',
		'sys.path.insert(0, sys.argv[1])',
		'import blatt',
		'from pathlib import Path',
		'q = Path(sys.argv[2])',
		'd = q.with_suffix(".eingebettet.html")',
		'd.write_text(blatt.einbetten(q.read_text(encoding="utf-8"), q.parent), encoding="utf-8")',
		'dom = blatt.chromium(["--dump-dom"], d.resolve().as_uri())',
		'print(html.unescape(re.search(r"<pre id=\\"ergebnis\\">(.*?)</pre>", dom, re.S).group(1)))',
	].join('\n');
	const aus = execFileSync('python3', ['-c', skript, path.dirname(BLATT_PY), datei], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	});
	return JSON.parse(aus) as T;
};

const ausgeben = (ausdruck: string) => `<script>
addEventListener('load', async () => {
	await (window.grauBereit ?? 0);
	await new Promise((r) => setTimeout(r, 50));
	const pre = document.createElement('pre');
	pre.id = 'ergebnis';
	pre.textContent = JSON.stringify(await (${ausdruck})());
	document.body.appendChild(pre);
});
</script>`;

const BOXEN = `() => [...document.querySelectorAll('.seite, .seite *')].filter((e) => e.getClientRects().length && (!e.closest('svg') || e.localName === 'svg'))
	.map((e) => { const r = e.getBoundingClientRect(); return [e.localName, Math.round(r.top), Math.round(r.height), Math.round(r.width)].join(':'); })`;

const buntePixel = (pdf: string): number => {
	const praefix = `${pdf}.seite`;
	execFileSync('pdftoppm', ['-r', '50', pdf, praefix]);
	let bunt = 0;
	const dir = path.dirname(pdf);
	const seiten = readdirSync(dir).filter((d) => path.join(dir, d).startsWith(praefix));
	assert.ok(seiten.length > 0, `keine Seiten aus ${pdf}`);
	for (const datei of seiten) {
		const inhalt = readFileSync(path.join(dir, datei));
		// PPM (P6): drei Kopfzeilen, dann RGB je Pixel
		let start = 0;
		for (let zeilen = 0; zeilen < 3; start++) {
			if (inhalt[start] === 10) {
				zeilen++;
			}
		}
		for (let i = start; i + 2 < inhalt.length; i += 3) {
			const r = inhalt[i] ?? 0;
			const g = inhalt[i + 1] ?? 0;
			const b = inhalt[i + 2] ?? 0;
			if (Math.max(r, g, b) - Math.min(r, g, b) > 25) {
				bunt++;
			}
		}
	}
	return bunt;
};

const pdfInfo = (pdf: string) => ({
	seiten: /Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))?.[1],
	schriften: execFileSync('pdffonts', [pdf], { encoding: 'utf8' }).split('\n').length,
	text: execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' }).length,
});

const ganzseitigeRaster = (pdf: string) =>
	execFileSync('pdfimages', ['-list', pdf], { encoding: 'utf8' })
		.split('\n')
		.slice(2)
		.filter((z) => {
			const spalten = z.trim().split(/\s+/);
			return Number(spalten[3]) > 2000 && Number(spalten[4]) > 2000;
		}).length;

const baue = (datei: string, unter: string, ...weitere: string[]) => {
	const aus = path.join(ordner, unter);
	try {
		execFileSync('python3', [BLATT_PY, 'bauen', datei, '-o', aus, '--ohne-loesung', ...weitere], {
			stdio: 'ignore',
		});
	} catch {
		// Exit-Code 1 bei FEHLER; das PDF steht trotzdem da.
	}
	return path.join(aus, `${path.basename(datei, '.html')}.pdf`);
};

const EIGENES_CSS = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Eigen</title>
<link rel="stylesheet" href="blatt.css">
<style>:root{--eigen:#c2185b}.kopf{background:linear-gradient(90deg,#ffe082,#ff5722);color:var(--eigen);padding:10px}
.karte{background:#fff3e0;border:3px solid tomato;padding:12px}.karte::before{content:"★ ";color:#00897b}</style></head>
<body class="kl3 farbe palette-sonnig"><div class="seite"><h1 class="kopf">Überschrift</h1>
<div class="karte" style="color:#2e7d32">Karte mit <b style="background:#ffeb3b">Marker</b></div>
<svg width="200" height="60"><rect width="90" height="50" fill="#1e88e5"/><circle cx="140" cy="25" r="20" fill="orange" stroke="red"/></svg>
</div></body></html>`;

describe('darstellungsHtml mit Profil', () => {
	const QUELLE = '<html><head></head><body class="kl2 farbe palette-wiese a4-quer"><p>x</p></body></html>';

	it('setzt s/w statt farbe palette-* und bindet den Pass ein', () => {
		const html = darstellungsHtml(QUELLE, { loesung: false, profil: 'sw' });
		assert.match(html, /<body class="sw kl2 a4-quer"/);
		assert.match(html, /<script src="graustufen\.js"><\/script>\n<\/body>/);
	});

	it('lässt Farbe und die Quelle ohne Profil unberührt', () => {
		for (const profil of ['farbe', undefined] as const) {
			const html = darstellungsHtml(QUELLE, { loesung: false, profil });
			assert.ok(html.includes('class="kl2 farbe palette-wiese a4-quer"'));
			assert.ok(!html.includes('graustufen'));
		}
	});

	it('gibt einer s/w-Quelle in der Farbansicht die Standardpalette', () => {
		const html = darstellungsHtml('<body class="kl1 sw"></body>', { loesung: false, profil: 'farbe' });
		assert.match(html, /<body class="farbe palette-himmel kl1"/);
		assert.equal(druckprofilAusHtml(html), 'farbe');
	});

	it('nimmt ohne Angabe das Profil der Quelle', () => {
		assert.match(darstellungsHtml('<body class="sw"></body>', { loesung: false }), /graustufen\.js/);
	});

	it('behält die Lösungsklasse', () => {
		assert.match(darstellungsHtml(QUELLE, { loesung: true, profil: 'sw' }), /<body class="sw kl2 a4-quer loesung"/);
	});
});

describe('graustufen.js', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	it('rechnet Werte um: Luminanz, helle Flächen, Alpha, var() und Wörter bleiben', () => {
		const html = `<!doctype html><html><head><meta charset="utf-8"></head><body class="sw"><div class="seite"></div>
<script src="graustufen.js"></script>${ausgeben(`() => {
	const f = window.grauWert;
	return {
		rot: f('#ff0000', false),
		hellText: f('#fff3e0', false),
		hellFlaeche: f('#fff3e0', true),
		grauBleibt: f('#d0d0d0', true),
		alpha: f('rgba(255,0,0,.5)', false),
		name: f('1px solid tomato', false),
		variable: f('color-mix(in srgb,var(--haupt) 45%,#ff0000)', false),
		url: f('url(red.png)', false),
	};
}`)}</body></html>`;
		const w = imBrowser<Record<string, string>>(html, 'werte');
		assert.equal(w.rot, 'rgb(76,76,76)');
		assert.equal(w.hellText, 'rgb(244,244,244)');
		assert.equal(w.hellFlaeche, 'rgb(255,255,255)');
		assert.equal(w.grauBleibt, 'rgb(208,208,208)');
		assert.match(w.alpha ?? '', /^rgba\(7\d,7\d,7\d,0\.50\d?\)$/);
		assert.equal(w.name, '1px solid rgb(142,142,142)');
		assert.equal(w.variable, 'color-mix(in srgb,var(--haupt) 45%,rgb(76,76,76))');
		assert.equal(w.url, 'url(red.png)');
	});

	it('färbt Pseudo-Elemente, Inline-Stile, SVG und Verläufe um', () => {
		const html = `${EIGENES_CSS.replace(
			'</body>',
			`<script src="graustufen.js"></script>${ausgeben(`() => {
	const bunt = (w) => { const m = w.match(/[\\d.]+/g) || []; return Math.max(+m[0], +m[1], +m[2]) - Math.min(+m[0], +m[1], +m[2]) > 6; };
	const k = document.querySelector('.karte');
	return {
		vor: getComputedStyle(k, '::before').color,
		inline: getComputedStyle(k).color,
		rand: getComputedStyle(k).borderTopColor,
		flaeche: getComputedStyle(k).backgroundColor,
		marker: getComputedStyle(k.querySelector('b')).backgroundColor,
		kreis: getComputedStyle(document.querySelector('circle')).fill,
		strich: getComputedStyle(document.querySelector('circle')).stroke,
		verlauf: getComputedStyle(document.querySelector('.kopf')).backgroundImage,
		buntErkannt: bunt('rgb(255, 0, 0)'),
	};
}`)}</body>`,
		)}`.replace('class="kl3 farbe palette-sonnig"', 'class="kl3 sw"');
		const w = imBrowser<Record<string, string | boolean>>(html, 'elemente');
		assert.equal(w.buntErkannt, true, 'Gegenprobe des Prüfers');
		for (const [name, wert] of Object.entries(w)) {
			if (typeof wert !== 'string') {
				continue;
			}
			for (const m of wert.matchAll(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/g)) {
				assert.ok(m[1] === m[2] && m[2] === m[3], `${name}: ${wert}`);
			}
		}
		assert.equal(w.flaeche, 'rgb(255, 255, 255)', 'helle bunte Fläche wird weiß');
	});
});

describe('Eigene Klasse .sw im Material', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Schlüsselwort</title>
<link rel="stylesheet" href="blatt.css"><style>.sw{white-space:nowrap;color:#c62828}.sw.nomen{letter-spacing:2px}.sw-wert{color:#1565c0}</style></head>
<body class="kl3 farbe palette-sonne"><section class="seite"><p>${'Ein langer Satz, der umbrechen muss. '.repeat(12)}
<span class="sw nomen">Wort</span></p></section></body></html>`;
	const ausgabe = (profil: 'farbe' | 'sw') =>
		imBrowser<{ boxen: string[]; farbe: string }>(
			darstellungsHtml(html, { loesung: false, profil }).replace(
				'</body>',
				`${ausgeben(`() => ({ boxen: (${BOXEN})(), farbe: getComputedStyle(document.querySelector('.sw.nomen')).color })`)}</body>`,
			),
			`eigene-sw-${profil}`,
		);

	it('trifft den body nicht: Das Blatt bricht wie in Farbe um, das Wort bleibt ohne Umbruch und wird grau', () => {
		const farbe = ausgabe('farbe');
		const sw = ausgabe('sw');
		assert.deepEqual(sw.boxen, farbe.boxen);
		assert.equal(farbe.farbe, 'rgb(198, 40, 40)');
		assert.equal(sw.farbe, 'rgb(87, 87, 87)');
	});
});

describe('s/w-PDF', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	it('Eigenes CSS: keine bunten Pixel, gleiche Seiten, Schriften und Text, kein ganzseitiges Raster', () => {
		const datei = path.join(ordner, 'eigen.html');
		writeFileSync(datei, EIGENES_CSS);
		const vorher = readFileSync(datei);
		const farbe = baue(datei, 'farbe');
		const sw = baue(datei, 'sw', '--profil', 'sw');
		assert.deepEqual(pdfInfo(sw), pdfInfo(farbe));
		assert.ok(buntePixel(farbe) > 100, 'Gegenprobe: In Farbe schlägt die Messung an');
		assert.equal(buntePixel(sw), 0);
		assert.equal(ganzseitigeRaster(sw), 0);
		assert.deepEqual(readFileSync(datei), vorher, 'Die Quelle bleibt byteidentisch');
		assert.equal(existsSync(path.join(ordner, 'sw', 'eigen.pdf')), true);
	});

	const inFarbe = (html: string) => html.replace(/(<body class="[^"]*)\bsw\b/, '$1farbe palette-himmel');
	const muster = readdirSync(path.join(ASSETS, 'muster')).filter((d) => d.endsWith('.html'));
	const blaetter = [
		...muster.map((d) => path.join(ASSETS, 'muster', d)),
		path.join(ASSETS, 'beispiel-zehner-einer-kl2.html'),
		path.join(ASSETS, 'vorlage-arbeitsblatt.html'),
	];
	for (const pfad of blaetter) {
		const name = path.basename(pfad, '.html');
		it(`${name}: Layout wie in Farbe, keine bunten Pixel`, () => {
			const roh = inFarbe(readFileSync(pfad, 'utf8'));
			const quelle = path.join(ordner, `${name}.html`);
			writeFileSync(quelle, roh);
			const mitMessung = (html: string) => html.replace('</body>', `${ausgeben(BOXEN)}</body>`);
			const farbeBoxen = imBrowser<string[]>(mitMessung(roh), `${name}-boxen-f`);
			const swBoxen = imBrowser<string[]>(
				mitMessung(darstellungsHtml(roh, { loesung: false, profil: 'sw' })),
				`${name}-boxen-s`,
			);
			assert.ok(farbeBoxen.length > 0, 'Gegenprobe: Es wurde etwas gemessen');
			assert.deepEqual(swBoxen, farbeBoxen);
			const pdf = baue(quelle, `aus-${name}`, '--profil', 'sw');
			assert.equal(buntePixel(pdf), 0);
			assert.equal(ganzseitigeRaster(pdf), 0);
		});
	}
});

/** Testmappe aus einem bunten JPG und einem PNG mit Alpha, wie die Reihen der Lehrkraft. */
const baueBilder = (dir: string) => {
	mkdirSync(path.join(dir, 'bilder'), { recursive: true });
	const skript = `
import sys
from PIL import Image
d = sys.argv[1]
v = Image.linear_gradient('L').resize((600, 400))
Image.merge('RGB', (v, v.point(lambda w: w // 3), v.point(lambda w: 255 - w))).save(d + '/szene.jpg', quality=95)
p = Image.new('RGBA', (300, 300), (0, 0, 0, 0))
p.paste((230, 60, 40, 255), (50, 50, 250, 250))
p.save(d + '/figur.png')
p.resize((600, 600)).convert('LA').save(d + '/figur-strich.png')
Image.new('RGB', (300, 200), (20, 120, 220)).save(d + '/quer.png')
Image.new('RGB', (200, 200), (0, 0, 0)).save(d + '/quer-strich.png')
Image.new('RGB', (64, 64), (120, 120, 120)).save(d + '/flau.png')
`;
	execFileSync('python3', ['-c', skript, path.join(dir, 'bilder')]);
};

const BILDER_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bilder</title>
<link rel="stylesheet" href="blatt.css"></head>
<body class="kl3 farbe palette-himmel"><div class="seite">
<img id="a" src="bilder/szene.jpg" alt="Szene" style="width:400px"><img id="b" src="bilder/figur.png" alt="Figur" style="width:150px">
<img id="c" src="bilder/quer.png" alt="Quer" style="width:150px"><img id="d" src="bilder/flau.png" alt="Flau" style="width:64px">
</div></body></html>`;

const pdfBilder = (pdf: string) =>
	execFileSync('pdfimages', ['-list', pdf], { encoding: 'utf8' })
		.split('\n')
		.slice(2)
		.filter((z) => z.includes('image'))
		.map((z) => z.trim().split(/\s+/))
		.map((sp) => ({ breite: Number(sp[3]), hoehe: Number(sp[4]), farbe: sp[5] }));

describe('Bilder in s/w', { skip: hatBrowser() ? false : 'Kein Chromium für blatt.py' }, () => {
	const dir = path.join(ordner, 'bilder-mappe');
	const quelle = path.join(dir, 'material.html');
	const dateienVon = (wurzel: string): string[] =>
		readdirSync(wurzel, { withFileTypes: true }).flatMap((e) =>
			e.isDirectory() ? dateienVon(path.join(wurzel, e.name)) : [path.join(wurzel, e.name)],
		);

	it('wandelt beim Bau um, behält die Pixelmaße, und der Materialordner bleibt sauber', () => {
		mkdirSync(dir, { recursive: true });
		baueBilder(dir);
		writeFileSync(quelle, BILDER_HTML);
		const vorher = dateienVon(dir).sort();
		const farbe = baue(quelle, 'bilder-farbe');
		const sw = baue(quelle, 'bilder-sw', '--profil', 'sw');
		assert.ok(buntePixel(farbe) > 1000, 'Gegenprobe: In Farbe schlägt die Messung an');
		assert.equal(buntePixel(sw), 0);
		assert.deepEqual(dateienVon(dir).sort(), vorher, 'Im Materialordner entsteht nichts neu');
		const f = pdfBilder(farbe);
		const s = pdfBilder(sw);
		assert.ok(f.length >= 4, 'Gegenprobe: Es gibt Bilder im PDF');
		const groessen = (l: typeof f) => l.filter((b) => b.farbe !== undefined).map((b) => [b.breite, b.hoehe]);
		assert.deepEqual(groessen(s), groessen(f), 'Pixelmaße wie in Farbe');
		assert.equal(s[0]?.farbe, 'gray', 'Das JPEG ist wirklich einkanalig');
		assert.notEqual(f[0]?.farbe, 'gray', 'Gegenprobe Farbe');
		assert.ok(statSync(sw).size <= statSync(farbe).size, 's/w ist nicht größer als Farbe');
		assert.deepEqual(pdfInfo(sw), pdfInfo(farbe));
	});

	it('nimmt ein -strich gleichen Seitenverhältnisses, sonst Grau', () => {
		const skript = [
			'import sys, json',
			'sys.path.insert(0, sys.argv[1])',
			'import blatt',
			'from pathlib import Path',
			'd = Path(sys.argv[2]) / "bilder"',
			'print(json.dumps({n: (lambda s: s.name if s else None)(blatt.strich_fassung(d / n)) for n in ["figur.png", "quer.png", "szene.jpg", "figur-strich.png"]}))',
		].join('\n');
		const wahl = JSON.parse(
			execFileSync('python3', ['-c', skript, path.dirname(BLATT_PY), dir], { encoding: 'utf8' }),
		) as Record<string, string | null>;
		assert.deepEqual(wahl, {
			'figur.png': 'figur-strich.png',
			'quer.png': null,
			'szene.jpg': null,
			'figur-strich.png': null,
		});
	});

	it('hält Format und Alpha und schreibt den Zwischenspeicher nur unter ausgabe/', () => {
		const skript = [
			'import sys, json, base64, io',
			'sys.path.insert(0, sys.argv[1])',
			'import blatt',
			'from pathlib import Path',
			'from PIL import Image',
			'd = Path(sys.argv[2])',
			'g = blatt.Graufassungen(d / "ausgabe" / "grau-cache")',
			'(d / "ausgabe").mkdir(exist_ok=True)',
			'def lies(n):',
			'    u = g.uri(d / "bilder" / n)',
			'    b = Image.open(io.BytesIO(base64.b64decode(u.split(",")[1])))',
			'    return [u.split(";")[0], b.mode, list(b.size)]',
			'print(json.dumps({n: lies(n) for n in ["szene.jpg", "figur.png", "quer.png"]}))',
		].join('\n');
		const lauf = () =>
			JSON.parse(
				execFileSync('python3', ['-c', skript, path.dirname(BLATT_PY), dir], { encoding: 'utf8' }),
			) as Record<string, unknown[]>;
		const w = lauf();
		assert.deepEqual(w['szene.jpg'], ['data:image/jpeg', 'L', [600, 400]]);
		assert.deepEqual(w['figur.png'], ['data:image/png', 'LA', [300, 300]]);
		assert.deepEqual(w['quer.png'], ['data:image/png', 'L', [300, 200]]);
		const cache = readdirSync(path.join(dir, 'ausgabe', 'grau-cache'));
		assert.equal(cache.length, 3);
		const zeiten = cache.map((d) => statSync(path.join(dir, 'ausgabe', 'grau-cache', d)).mtimeMs);
		lauf();
		assert.deepEqual(
			cache.map((d) => statSync(path.join(dir, 'ausgabe', 'grau-cache', d)).mtimeMs),
			zeiten,
			'Zweiter Lauf rechnet nicht neu',
		);
		rmSync(path.join(dir, 'ausgabe'), { force: true, recursive: true });
	});

	it('nimmt ein schon graues Bild unverändert und meldet eine Strichzeichnung nicht als kontrastarm', () => {
		const strichOrdner = path.join(ordner, 'strich-unveraendert');
		mkdirSync(path.join(strichOrdner, 'bilder'), { recursive: true });
		const willi = path.join(ASSETS, 'bilder', 'willi-strich.png');
		writeFileSync(path.join(strichOrdner, 'bilder', 'willi-strich.png'), readFileSync(willi));
		const strichQuelle = path.join(strichOrdner, 'blatt.html');
		const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Strich</title><link rel="stylesheet" href="blatt.css"></head>
<body class="kl2 sw"><section class="seite"><img class="figur" src="bilder/willi-strich.png" alt="Willi"></section></body></html>`;
		writeFileSync(strichQuelle, html);
		const eingebettet = execFileSync(
			'python3',
			[
				'-c',
				'import sys;sys.path.insert(0,sys.argv[1]);import blatt;from pathlib import Path;q=Path(sys.argv[2]);print(blatt.einbetten(q.read_text(encoding="utf-8"),q.parent))',
				path.dirname(BLATT_PY),
				strichQuelle,
			],
			{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
		);
		assert.ok(eingebettet.includes(readFileSync(willi).toString('base64')), 'Bytes des Originals');

		const bericht = path.join(strichOrdner, 'bericht.json');
		execFileSync('python3', [BLATT_PY, 'bauen', strichQuelle, '--nur-pruefen', '--bericht', bericht], {
			encoding: 'utf8',
		});
		const { meldungen } = JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: { code: string }[] };
		assert.deepEqual(
			meldungen.filter((m) => m.code === 'bild-kontrast-sw'),
			[],
		);
	});

	it('meldet ein Bild ohne Kontrast als Hinweis, nur in s/w', () => {
		const bericht = path.join(dir, 'b.json');
		execFileSync('python3', [BLATT_PY, 'bauen', quelle, '--nur-pruefen', '--bericht', bericht, '--profil', 'sw'], {
			stdio: 'ignore',
		});
		const sw = JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: { code: string; text: string }[] };
		assert.deepEqual(
			sw.meldungen.filter((m) => m.code === 'bild-kontrast-sw').map((m) => m.text),
			['Bild „Quer“ hat in s/w kaum Kontrast', 'Bild „Flau“ hat in s/w kaum Kontrast'],
		);
		execFileSync('python3', [BLATT_PY, 'bauen', quelle, '--nur-pruefen', '--bericht', bericht], {
			stdio: 'ignore',
		});
		const farbe = JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: { code: string }[] };
		assert.equal(farbe.meldungen.filter((m) => m.code === 'bild-kontrast-sw').length, 0, 'Gegenprobe Farbe');
		rmSync(bericht);
	});
});
