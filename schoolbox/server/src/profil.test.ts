/** Die Ansichten Farbe und s/w (042): beide PDFs nebeneinander, die Wahl als reiner Ansichtszustand. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { dokumentDir, fertigstellen, legeFreigabeAn, leseMeta } from '@schoolbox/kern';
import { browserSkip } from '@schoolbox/kern/src/browsertest';

import type { TestServer } from './testhilfe';
import { legeDokumentAn, leseAblage, sammleEreignisse, schreibKoepfe, starteTestServer, warte } from './testhilfe';

interface Vorbereitet {
	adresse: string;
	dateiname: string;
	meldungen: { code?: string; stufe: string }[];
}

const FARBIG = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Bunt</title><link rel="stylesheet" href="blatt.css"></head>
<body class="kl2 farbe"><section class="seite">
<h1 style="color:#c62828">Rote Überschrift</h1><p style="background:#fff59d">Die rote Zahl zählt.</p>
</section></body></html>
`;

const FARBIGER_PDF_BAU = 180_000;

describe('Ansichten Farbe und s/w', { skip: browserSkip() }, () => {
	let s: TestServer;
	let strom: ReturnType<typeof sammleEreignisse>;
	let mappe = '';
	let dok = '';
	let dir = '';
	const pdf = () => `/api/dokumente/${mappe}/${dok}/pdf`;
	const bereite = async (profil?: string, variante = 'arbeitsblatt') => {
		const antwort = await s.holen(`${s.url}${pdf()}`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ variante, profil }),
		});
		return { status: antwort.status, daten: (await antwort.json()) as Vorbereitet };
	};

	before(async () => {
		s = await starteTestServer({ ueberwachung: true, ruheMs: 20 });
		({ dok, mappe } = await legeDokumentAn(s.materialDir));
		dir = dokumentDir(s.materialDir, mappe, dok);
		await writeFile(path.join(dir, 'material.html'), FARBIG);
		strom = sammleEreignisse(s.url, s.cookie);
		await strom.bereit;
	});
	after(async () => {
		strom.stop();
		await s.stop();
	});

	it('baut beide PDFs nebeneinander, jedes genau einmal', { timeout: FARBIGER_PDF_BAU }, async () => {
		const farbe = await bereite('farbe');
		const sw = await bereite('sw');
		assert.equal(farbe.status, 200);
		assert.equal(sw.status, 200);
		assert.match(sw.daten.dateiname, / \(schwarz-weiß\)\.pdf$/);
		assert.doesNotMatch(farbe.daten.dateiname, /schwarz/);
		assert.match(sw.daten.adresse, /\?profil=sw$/);

		const inhalt = async (adresse: string) =>
			Buffer.from(await (await s.holen(`${s.url}${adresse}`)).arrayBuffer());
		const [dateiFarbe, dateiSw] = await Promise.all([inhalt(farbe.daten.adresse), inhalt(sw.daten.adresse)]);
		assert.equal(dateiFarbe.subarray(0, 4).toString(), '%PDF');
		assert.notDeepEqual(dateiFarbe, dateiSw);
		assert.ok(existsSync(path.join(dir, 'ausgabe', 'material.pdf')));
		assert.ok(existsSync(path.join(dir, 'ausgabe', 'sw', 'material.pdf')));

		// Zwischenspeicher: Ein zweiter Abruf baut keine der beiden neu, auch im Wechsel nicht.
		const zeiten = async () =>
			Promise.all(
				['material.pdf', 'sw/material.pdf'].map(
					async (d) => (await stat(path.join(dir, 'ausgabe', d))).mtimeMs,
				),
			);
		const vorher = await zeiten();
		await bereite('sw');
		await bereite('farbe');
		await bereite('sw');
		assert.deepEqual(await zeiten(), vorher);
	});

	it(
		'baut die Ansicht neu, wenn sich die Quelle ändert, ohne die andere zu verlieren',
		{ timeout: FARBIGER_PDF_BAU },
		async () => {
			await bereite('sw');
			const quelle = await readFile(path.join(dir, 'material.html'), 'utf8');
			const stand = (await stat(path.join(dir, 'ausgabe', 'sw', 'material.pdf'))).mtimeMs;
			await writeFile(path.join(dir, 'material.html'), quelle.replace('Rote Überschrift', 'Blaue Überschrift'));
			await bereite('sw');
			assert.notEqual((await stat(path.join(dir, 'ausgabe', 'sw', 'material.pdf'))).mtimeMs, stand);
			assert.ok(existsSync(path.join(dir, 'ausgabe', 'material.pdf')));
			await writeFile(path.join(dir, 'material.html'), quelle);
			await warte(100);
		},
	);

	it('meldet die s/w-Hinweise nur im s/w-PDF', { timeout: FARBIGER_PDF_BAU }, async () => {
		const bericht = async (datei: string) =>
			JSON.parse(await readFile(path.join(dir, 'ausgabe', datei), 'utf8')) as {
				meldungen: { code: string; stufe: string }[];
			};
		await bereite('farbe');
		await bereite('sw');
		const sw = await bericht('sw/pruefbericht.json');
		const farbe = await bericht('pruefbericht.json');
		assert.ok(sw.meldungen.some((m) => m.code === 'farbwort-sw' && m.stufe === 'HINWEIS'));
		assert.ok(!farbe.meldungen.some((m) => /-sw$/.test(m.code)));
	});

	it(
		'merkt die Wahl ohne Version, ohne Änderung an der Quelle und ohne Meldung',
		{ timeout: FARBIGER_PDF_BAU },
		async () => {
			// Ein eigenes Dokument: Nach dem ersten atomaren Schreiben sieht die Überwachung meta.json nicht mehr
			// (offener Punkt), die Gegenprobe wäre dann wertlos. Es startet mit „sw“, gewählt wird „farbe“.
			const neu = await legeDokumentAn(s.materialDir);
			await writeFile(path.join(neu.dir, 'material.html'), FARBIG);
			await warte(800);
			const anAnsicht = (profil: string) =>
				s.holen(`${s.url}/api/dokumente/${neu.mappe}/${neu.dok}/ansicht`, {
					method: 'PUT',
					headers: schreibKoepfe,
					body: JSON.stringify({ profil }),
				});
			const quelle = await readFile(path.join(neu.dir, 'material.html'));
			const metaVorher = await leseMeta(s.materialDir, neu.mappe, neu.dok);
			const versionen = await readdir(path.join(neu.dir, 'versionen')).catch(() => []);
			assert.equal(metaVorher.druckprofil, 'sw');
			strom.ereignisse.length = 0;

			assert.equal((await anAnsicht('farbe')).status, 200);
			await warte(800);
			const meta = await leseMeta(s.materialDir, neu.mappe, neu.dok);
			assert.equal(meta.druckprofil, 'farbe');
			assert.equal(meta.geaendert, metaVorher.geaendert);
			assert.deepEqual(await readFile(path.join(neu.dir, 'material.html')), quelle);
			assert.deepEqual(await readdir(path.join(neu.dir, 'versionen')).catch(() => []), versionen);
			assert.deepEqual(
				strom.ereignisse.filter((e) => e.typ === 'dokument-geaendert'),
				[],
			);
			assert.equal((await anAnsicht('lila')).status, 400);

			// Die Wahl überlebt einen neuen Bau, auch wenn Claude das Dokument fertigstellt.
			assert.equal((await anAnsicht('sw')).status, 200);
			await fertigstellen(s.kontext.konfig, { mappe: neu.mappe, dok: neu.dok });
			assert.equal((await leseMeta(s.materialDir, neu.mappe, neu.dok)).druckprofil, 'sw');
		},
	);

	it(
		'zeigt und liefert beide Fassungen hinter einem Teilen-Link, ohne die Quelle zu ändern',
		{ timeout: FARBIGER_PDF_BAU },
		async () => {
			const quelle = await readFile(path.join(dir, 'material.html'));
			const link = await legeFreigabeAn(s.materialDir, { mappe, dok });
			const antwort = await fetch(`${s.url}/f/${link.token}/api/pdf/${dok}/arbeitsblatt?profil=sw`);
			assert.equal(antwort.status, 200);
			const { adresse, dateiname } = (await antwort.json()) as Vorbereitet;
			assert.match(dateiname, /schwarz-weiß/);
			const datei = await fetch(`${s.url}${adresse}`);
			assert.equal(datei.headers.get('content-type'), 'application/pdf');
			const farbig = await (await fetch(`${s.url}/f/${link.token}/ansicht/${mappe}/dokumente/${dok}/`)).text();
			const grau = await (
				await fetch(`${s.url}/f/${link.token}/ansicht/${mappe}/dokumente/${dok}/?profil=sw`)
			).text();
			assert.doesNotMatch(/<body[^>]*>/.exec(farbig)?.[0] ?? '', /\bsw\b/);
			assert.match(/<body[^>]*>/.exec(grau)?.[0] ?? '', /\bsw\b/);
			assert.match(grau, /graustufen\.js/);
			assert.deepEqual(await readFile(path.join(dir, 'material.html')), quelle);
			// Ein Teilen-Link merkt sich nichts auf dem Server: Die Route gibt es nur mit Anmeldung.
			const fremd = await fetch(`${s.url}/api/dokumente/${mappe}/${dok}/ansicht`, {
				method: 'PUT',
				headers: schreibKoepfe,
				body: JSON.stringify({ profil: 'sw' }),
			});
			assert.equal(fremd.status, 401);
		},
	);

	it('baut „Alles als PDF“ je Ansicht in eine eigene Datei', { timeout: FARBIGER_PDF_BAU }, async () => {
		const hole = async (profil: string) => {
			const { dokumente } = await leseAblage(s);
			const teile = dokumente.filter((d) => d.mappe === mappe).map((d) => ({ mappe: d.mappe, dok: d.id }));
			const antwort = await s.holen(`${s.url}/api/ordner/pdf`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ teile, name: 'Zehner und Einer', variante: 'alles', profil }),
			});
			assert.equal(antwort.status, 200);
			return (await antwort.json()) as Vorbereitet;
		};
		const farbe = await hole('farbe');
		const sw = await hole('sw');
		assert.notEqual(farbe.adresse, sw.adresse);
		assert.match(sw.dateiname, /schwarz-weiß/);
		const lade = async (a: string) => Buffer.from(await (await s.holen(`${s.url}${a}`)).arrayBuffer());
		assert.notDeepEqual(await lade(farbe.adresse), await lade(sw.adresse));
	});

	it('sagt dem Bildpanel, welche Fassung gedruckt wird', { timeout: 30_000 }, async () => {
		const PNG_1X1 = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
			'base64',
		);
		await mkdir(path.join(dir, 'bilder'), { recursive: true });
		await writeFile(path.join(dir, 'bilder', 'igel.png'), PNG_1X1);
		await writeFile(path.join(dir, 'bilder', 'igel-strich.png'), PNG_1X1);
		await writeFile(path.join(dir, 'bilder', 'maus.png'), PNG_1X1);
		const frage = async (src: string) =>
			(await (
				await s.holen(`${s.url}/api/dokumente/${mappe}/${dok}/bilder/fassung?src=${encodeURIComponent(src)}`)
			).json()) as { strich: string | null };
		assert.deepEqual(await frage('bilder/igel.png'), { strich: 'igel-strich.png' });
		assert.deepEqual(await frage('bilder/maus.png'), { strich: null });
		assert.deepEqual(await frage('bilder/igel-strich.png'), { strich: null });
		assert.deepEqual(await frage('../../../meta.json'), { strich: null });
	});
});
