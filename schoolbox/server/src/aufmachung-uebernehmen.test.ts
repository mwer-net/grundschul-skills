import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { dokumentDir, legeVersionAn, listeVersionen, versionsPfad } from '@schoolbox/kern';
import { leseAufmachung, wendeAufmachungAn, wuerfleAufmachung } from '@schoolbox/kern/src/aufmachungen';

import type { TestServer } from './testhilfe';
import { fuehreAus, legeDokumentAn, ordnerVon, schreibKoepfe, starteTestServer } from './testhilfe';

interface Vorschau {
	rezept: string;
	ordner: string;
	werte: { id: string };
	aendern: number;
	minibuch: string[];
	anderesRezept: string[];
	gestaltungHinten: string[];
}

describe('Rezept auf alle Blätter im Ordner übernehmen (122)', () => {
	let s: TestServer;
	let mappe: string;
	let dok: string;
	const neu: Record<string, string> = {};
	const url = (d = dok, m = mappe) => `${s.url}/api/dokumente/${m}/${d}/aufmachung-uebernehmen`;
	const quelle = (d: string, m = mappe) =>
		readFile(path.join(dokumentDir(s.materialDir, m, d), 'material.html'), 'utf8');
	const setze = async (d: string, rechne: (q: string) => string) => {
		const datei = path.join(dokumentDir(s.materialDir, mappe, d), 'material.html');
		await writeFile(datei, rechne(await readFile(datei, 'utf8')));
	};

	before(async () => {
		s = await starteTestServer();
		({ dok, mappe } = await legeDokumentAn(s.materialDir));
		const ordner = await ordnerVon(s, mappe);
		for (const [titel, format, vorlage] of [
			['Zwei', 'a4-hoch', undefined],
			['Drei', 'a4-quer', undefined],
			['Heft', 'minibuch', 'minibuch'],
		] as const) {
			const a = await s.holen(`${s.url}/api/ordner/material`, {
				method: 'POST',
				headers: schreibKoepfe,
				body: JSON.stringify({ titel, art: 'arbeitsblatt', format, vorlage, ordner }),
			});
			assert.equal(a.status, 201, await a.clone().text());
			neu[titel] = ((await a.json()) as { id: string }).id;
		}
		// Ein Material im Unterordner zählt nicht mit.
		const u = await fuehreAus(s, { art: 'neu', eltern: ordner, name: 'Unter' });
		const unter = ((await u.json()) as { ergebnis: { neu: string } }).ergebnis.neu;
		const a = await s.holen(`${s.url}/api/ordner/material`, {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({
				titel: 'Tief',
				art: 'arbeitsblatt',
				format: 'a4-hoch',
				ordner: unter,
				fach: 'mathematik',
				klasse: 2,
			}),
		});
		assert.equal(a.status, 201, await a.clone().text());
		const tief = (await a.json()) as { mappe: string; id: string };
		neu.Tief = tief.id;
		neu.TiefMappe = tief.mappe;
		await setze(dok, (q) => wendeAufmachungAn(q, 'zirkus', { saat: 7 }));
		await setze(neu.Drei ?? '', (q) => wendeAufmachungAn(q, 'detektiv'));
	});
	after(() => s.stop());

	it('Vorschau: Rezept, Ordner, Zahl, Minibuch und anderes Rezept, ohne etwas zu ändern', async () => {
		const vorher = await quelle(neu.Zwei ?? '');
		const a = await s.holen(url());
		assert.equal(a.status, 200, await a.clone().text());
		const v = (await a.json()) as Vorschau;
		assert.equal(v.werte.id, 'zirkus');
		assert.equal(v.ordner, 'Zehner und Einer');
		assert.equal(v.aendern, 2);
		assert.deepEqual(v.minibuch, ['Heft']);
		assert.deepEqual(v.anderesRezept, ['Drei']);
		assert.equal(await quelle(neu.Zwei ?? ''), vorher);
	});

	it('Übernehmen: jedes Blatt bekommt die Werte und vorher eine Version, das Minibuch bleibt', async () => {
		const v = (await (await s.holen(url())).json()) as Vorschau;
		const heftVorher = await quelle(neu.Heft ?? '');
		const zweiDir = dokumentDir(s.materialDir, mappe, neu.Zwei ?? '');
		// Eine junge Version der Lehrkraft: Ohne `zusammenfassen: false` würde sie überschrieben.
		await legeVersionAn(zweiDir, 'lehrkraft', new Date(Date.now() - 60_000));
		const zweiVorher = await quelle(neu.Zwei ?? '');
		const offenVorher = await quelle(dok);
		const tiefVorher = await quelle(neu.Tief ?? '', neu.TiefMappe);
		const versionenVorher = (await listeVersionen(zweiDir)).length;
		const a = await s.holen(url(), {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ werte: v.werte }),
		});
		assert.equal(a.status, 200, await a.clone().text());
		const e = (await a.json()) as { geaendert: string[]; uebersprungen: string[]; fehlgeschlagen: string[] };
		assert.deepEqual(e.geaendert.sort(), ['Drei', 'Zwei']);
		assert.deepEqual(e.uebersprungen, ['Heft']);
		assert.deepEqual(e.fehlgeschlagen, []);
		const quellWerte = leseAufmachung(await quelle(dok));
		for (const d of [neu.Zwei, neu.Drei]) {
			assert.deepEqual(leseAufmachung(await quelle(d ?? '')), quellWerte);
		}
		assert.equal(await quelle(neu.Heft ?? ''), heftVorher);
		assert.equal(await quelle(dok), offenVorher, 'das offene Material bleibt');
		assert.equal(await quelle(neu.Tief ?? '', neu.TiefMappe), tiefVorher, 'der Unterordner bleibt');
		const versionen = await listeVersionen(zweiDir);
		assert.ok(versionen.length > versionenVorher, 'Version vor dem Übernehmen');
		const inhalte = await Promise.all(versionen.map((version) => readFile(versionsPfad(zweiDir, version), 'utf8')));
		assert.ok(inhalte.includes(zweiVorher), 'der Stand vor dem Rezept liegt als Version vor');
		// Danach keine Verbindung: Würfeln auf einem ändert das andere nicht.
		const drei = await quelle(neu.Drei ?? '');
		const gewuerfelt = wuerfleAufmachung(await quelle(neu.Zwei ?? ''), 4242);
		assert.notDeepEqual(leseAufmachung(gewuerfelt), leseAufmachung(drei));
		assert.equal(await quelle(neu.Drei ?? ''), drei);
	});

	it('Ohne Rezept oder ohne Ordner: 400 mit Grund', async () => {
		const ohne = await s.holen(url(neu.Heft ?? ''));
		assert.equal(ohne.status, 400);
		assert.match(((await ohne.json()) as { fehler: string }).fehler, /kein Rezept/);
		const fremd = await legeDokumentAn(s.materialDir);
		const f = path.join(fremd.dir, 'material.html');
		await writeFile(f, wendeAufmachungAn(await readFile(f, 'utf8'), 'ruhig'));
		const b = await fuehreAus(s, { art: 'bewegen', knoten: [{ mappe: fremd.mappe, dok: fremd.dok }], ziel: null });
		assert.equal(b.status, 200, await b.clone().text());
		const lose = await s.holen(url(fremd.dok, fremd.mappe));
		assert.equal(lose.status, 400);
		assert.match(((await lose.json()) as { fehler: string }).fehler, /in einem Ordner/);
	});

	it('Unbekannte Werte: 400', async () => {
		const a = await s.holen(url(), {
			method: 'POST',
			headers: schreibKoepfe,
			body: JSON.stringify({ werte: { id: 'gibt-es-nicht' } }),
		});
		assert.equal(a.status, 400);
	});
});
