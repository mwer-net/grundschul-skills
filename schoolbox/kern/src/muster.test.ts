/**
 * Musterblätter (023): Jedes Blatt in `assets/muster/` wird in s/w, Farbe und als Lösung gebaut und muss die Prüfung
 * ohne FEHLER bestehen. So fällt ein Element auf, das über den Rand läuft oder sich mit Standardwerten nicht zeichnet.
 * Ein gewollter Fehler steht als `data-erwarteter-fehler="Text"` am Element.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { Pruefmeldung } from './browsertest';
import { browserSkip, pruefeStapel } from './browsertest';
import { ASSETS, BLATT_PY } from './konfig';
import type { Meldung } from './meldungen';

const MUSTER = path.join(ASSETS, 'muster');

const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-muster-'));
after(() => rmSync(ordner, { force: true, recursive: true }));

const pruefe = (html: string, name: string): Meldung[] => {
	const datei = path.join(ordner, `${name}.html`);
	const bericht = path.join(ordner, `${name}.json`);
	writeFileSync(datei, html);
	try {
		execFileSync('python3', [BLATT_PY, 'bauen', datei, '--nur-pruefen', '--bericht', bericht], { stdio: 'ignore' });
	} catch {
		// Exit-Code 1 bei FEHLER; der Bericht steht trotzdem da.
	}
	return (JSON.parse(readFileSync(bericht, 'utf8')) as { meldungen: Meldung[] }).meldungen;
};

const fassungen = (html: string): Record<string, string> => {
	const farbe = html.replace(/(<body class="[^"]*)\bsw\b/, '$1farbe palette-himmel');
	const mitLoesung = (quelle: string) => quelle.replace(/<body class="/, '<body class="loesung ');
	return { 'sw': html, farbe, 'sw-loesung': mitLoesung(html), 'farbe-loesung': mitLoesung(farbe) };
};

const erwarteteFehler = (html: string) =>
	[...html.matchAll(/data-erwarteter-fehler="([^"]+)"/g)].map((t) => t[1] ?? '').sort();

const dateien = readdirSync(MUSTER).filter((d) => d.endsWith('.html'));
const VORLAGEN_036 = ['vorlage-minibuch.html', 'vorlage-forscherbogen-12.html', 'vorlage-forscherbogen-34.html'];
const pfade = [...dateien.map((d) => path.join(MUSTER, d)), ...VORLAGEN_036.map((d) => path.join(ASSETS, d))];

describe('Musterblätter', { skip: browserSkip() }, () => {
	it('gibt es', () => {
		assert.ok(dateien.length > 0);
	});

	const faelle = pfade.flatMap((pfad) => {
		const html = readFileSync(pfad, 'utf8');
		return Object.entries(fassungen(html)).map(([fassung, quelle]) => ({
			datei: path.basename(pfad),
			fassung,
			html,
			quelle,
		}));
	});
	let berichte: Pruefmeldung[][] = [];
	before(() => {
		berichte = pruefeStapel(
			faelle.map((f) => {
				const datei = path.join(ordner, `${f.datei}-${f.fassung}.html`);
				writeFileSync(datei, f.quelle);
				return datei;
			}),
		);
	});
	faelle.forEach((f, i) => {
		it(`${f.datei} (${f.fassung}) besteht die Prüfung`, () => {
			const fehler = (berichte[i] ?? [])
				.filter((m) => m.stufe === 'FEHLER')
				.map((m) => m.text)
				.sort();
			assert.deepEqual(fehler, erwarteteFehler(f.html));
		});
	});

	it('schlägt bei einem FEHLER im Musterblatt an', () => {
		const html = readFileSync(path.join(MUSTER, dateien[0] ?? ''), 'utf8');
		const kaputt = html.replace('</section>', '<x-zahlenstrahl von="5" bis="5"></x-zahlenstrahl></section>');
		const fehler = pruefe(kaputt, 'kaputt').filter((m) => m.stufe === 'FEHLER');
		assert.ok(fehler.some((m) => m.text.includes('Zahlenstrahl')));
	});
});

const feld = (nr: number, inhalt = `<p>kopf${nr}</p><p style="margin-top:auto">fuss${nr}</p>`) =>
	`<section class="seite">${inhalt}</section>`;
const miniBook = (felder: string[]) =>
	`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Test</title><link rel="stylesheet" href="blatt.css"></head><body class="kl3 sw minibuch">${felder.join('')}</body></html>`;
const ACHT = [1, 2, 3, 4, 5, 6, 7, 8];

const bauePdf = (html: string, name: string) => {
	const datei = path.join(ordner, `${name}.html`);
	const aus = path.join(ordner, `${name}-aus`);
	writeFileSync(datei, html);
	execFileSync('python3', [BLATT_PY, 'bauen', datei, '-o', aus], { stdio: 'ignore' });
	return path.join(aus, `${name}.pdf`);
};

const text = (pdf: string) => execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });

describe('Mini-Book und Forscherbogen (036)', { skip: browserSkip() }, () => {
	it('schießt acht Felder auf eine A4-Seite quer aus: 5-4-3-2 kopfstehend, 6-7-8-1 aufrecht', () => {
		const pdf = bauePdf(miniBook(ACHT.map((n) => feld(n))), 'schema');
		const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
		assert.match(info, /Pages:\s+1\n/);
		assert.match(info, /Page size:\s+841\.\d+ x 59\d\.\d+ pts/);
		const bbox = execFileSync('pdftotext', ['-bbox', pdf, '-'], { encoding: 'utf8' });
		const woerter = new Map(
			[...bbox.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">(kopf|fuss)(\d)</g)].map(
				(t) => [`${t[3]}${t[4]}`, { x: Number(t[1]), y: Number(t[2]) }],
			),
		);
		const ort = (wort: string) => {
			const stelle = woerter.get(wort);
			assert.ok(stelle, wort);
			return stelle;
		};
		const breite = 841.89 / 4;
		const hoehe = 595.28 / 2;
		[
			[5, 4, 3, 2],
			[6, 7, 8, 1],
		].forEach((reihe, r) => {
			reihe.forEach((nr, spalte) => {
				const kopf = ort(`kopf${nr}`);
				const fuss = ort(`fuss${nr}`);
				assert.equal(Math.floor(kopf.x / breite), spalte, `Seite ${nr}: Spalte`);
				assert.equal(Math.floor(kopf.y / hoehe), r, `Seite ${nr}: Reihe`);
				assert.equal(kopf.y > fuss.y, r === 0, `Seite ${nr}: ${r === 0 ? 'kopfstehend' : 'aufrecht'}`);
			});
		});
	});

	it('meldet Inhalt an der Falz und eine falsche Seitenzahl als FEHLER', () => {
		const breit = feld(1, '<p style="width:260px">zu nah an der Falz</p>');
		const codes = (html: string, name: string) =>
			pruefe(html, name)
				.filter((m) => m.stufe === 'FEHLER')
				.map((m) => m.code);
		assert.deepEqual(codes(miniBook([breit, ...ACHT.slice(1).map((n) => feld(n))]), 'falz'), ['rand']);
		assert.deepEqual(codes(miniBook(ACHT.slice(1).map((n) => feld(n))), 'sieben'), ['minibuch-seiten']);
	});

	it('zeigt die Faltanleitung und die Sicherheitshinweise nur auf dem Lösungsblatt', () => {
		for (const [name, satz] of [
			['minibuch', 'So entsteht das Büchlein'],
			['forscherbogen-12', 'Für die Lehrkraft'],
			['forscherbogen-34', 'Für die Lehrkraft'],
		] as const) {
			const pdf = bauePdf(readFileSync(path.join(ASSETS, `vorlage-${name}.html`), 'utf8'), `nur-${name}`);
			assert.ok(!text(pdf).includes(satz), `${name}: Arbeitsblatt`);
			assert.ok(text(pdf.replace(/\.pdf$/, '-loesung.pdf')).includes(satz), `${name}: Lösung`);
		}
	});
});

describe('Spiele (037)', { skip: browserSkip() }, () => {
	it('Erzeugte Seiten stehen im PDF, die Rufliste nur im Lösungsblatt', () => {
		const eintraege = Array.from({ length: 24 }, (_, i) => `${i + 3}·2: ${(i + 3) * 2}`).join('; ');
		const html =
			'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Test</title><link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>' +
			`<body class="kl3 sw"><section class="seite"><x-bingo felder="4" karten="28" je-seite="2" seed="s" eintraege="${eintraege}"></x-bingo></section></body></html>`;
		const pdf = bauePdf(html, 'bingo');
		const seiten = (datei: string) =>
			Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [datei], { encoding: 'utf8' }))?.[1]);
		assert.equal(seiten(pdf), 14);
		const loesung = pdf.replace(/\.pdf$/, '-loesung.pdf');
		assert.equal(seiten(loesung), 15);
		assert.ok(!text(pdf).includes('Rufliste'));
		assert.ok(text(loesung).includes('Rufliste'));
		// Gleicher seed: dieselben Karten im Arbeits- und im Lösungsblatt
		const karten = (datei: string) => text(datei).split('Rufliste')[0]?.replace(/\s+/g, ' ');
		assert.equal(karten(pdf)?.trim(), karten(loesung)?.trim());
	});
});

describe('Rätsel (038)', { skip: browserSkip() }, () => {
	const blatt = (loesungen: string[], inhalt: string) =>
		'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Test</title>' +
		'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head><body class="kl3 sw">' +
		'<section class="seite"><div class="kopf"><div class="titel"><h1>Test</h1></div></div>' +
		'<div class="aufgabe"><span class="nr">3</span><div class="anw"><span class="text">Rechne.</span></div>' +
		`<div class="koerper"><div class="reihe" style="--spalten:5">${loesungen
			.map((l) => `<div class="zelle"><span class="antwort" data-l="${l}"></span></div>`)
			.join('')}</div>${inhalt}</div></div></section></body></html>`;
	const sonne =
		'<x-loesungswort wort="SONNE" bezug="3" zuordnung="42: S; 64: O; 27: N; 28: N; 45: E" ablenker="24: U"></x-loesungswort>';

	it('Lösungsblatt zeigt SONNE; eine geänderte Lösung ist ein FEHLER', () => {
		const richtig = ['42', '64', '27', '28', '45'];
		const pdf = bauePdf(blatt(richtig, sonne), 'sonne');
		const buchstaben = (datei: string) => text(datei).replace(/[^A-Z]/g, '');
		assert.ok(!buchstaben(pdf).includes('SONNE'), 'auf dem Arbeitsblatt noch nicht');
		assert.ok(buchstaben(pdf.replace(/\.pdf$/, '-loesung.pdf')).includes('SONNE'));
		const falsch = pruefe(blatt(['42', '48', '27', '28', '45'], sonne), 'sonne-falsch');
		assert.ok(
			falsch.some((m) => /Aufgabe 3, Eintrag 2 hat jetzt die Lösung 48/.test(m.text)),
			JSON.stringify(falsch),
		);
	});

	it('Ohne gespeicherte Legende nennt das Element, was einzutragen ist', () => {
		const meldungen = pruefe(
			blatt(['42', '64'], '<x-loesungswort wort="SO" bezug="3"></x-loesungswort>'),
			'sonne-leer',
		);
		assert.ok(
			meldungen.some((m) => m.text.includes('42: S; 64: O')),
			JSON.stringify(meldungen),
		);
	});
});
