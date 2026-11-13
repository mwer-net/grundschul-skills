import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { EinheitStand, Pruefbericht } from '@schoolbox/kern';
import { einheitAuftragAus, lesePlan, mappenDir, pruefeEinheitAngaben, themaBefund } from '@schoolbox/kern';

import { einheitenWurzel } from './einheit';
import { CANVA_MCP, VERBRAUCH_DATEI } from './ki';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { KI_ATTRAPPE, starteTestServer } from './testhilfe';

const warte = async (bedingung: () => Promise<boolean> | boolean, ms = 20_000) => {
	const ende = Date.now() + ms;
	while (Date.now() < ende) {
		if (await bedingung()) {
			return;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	assert.fail('Zeit abgelaufen');
};

const ANGABEN = { thema: 'Uhrzeit', fach: 'mathematik', klasse: 2, bilder: false, aussehen: 'eigen' };

describe('Plan und Thema der Einheit (139)', () => {
	it('Angaben: Rahmen in Klasse 1–2 voreingestellt, Unbekanntes abgelehnt', () => {
		const a = pruefeEinheitAngaben(ANGABEN);
		assert.equal(a.rahmen, true);
		assert.equal(a.titel, 'Uhrzeit');
		assert.throws(() => pruefeEinheitAngaben({ ...ANGABEN, aussehen: 'neon' }));
		assert.throws(() => pruefeEinheitAngaben({ ...ANGABEN, thema: '' }));
	});

	it('Aussehen: nur eigenes Thema oder schlicht, kein Rezept im Auftrag (180)', () => {
		assert.throws(() => pruefeEinheitAngaben({ ...ANGABEN, aussehen: 'detektiv' }), /Aussehen ist ungültig/);
		for (const aussehen of ['eigen', 'schlicht']) {
			const text = einheitAuftragAus(pruefeEinheitAngaben({ ...ANGABEN, aussehen }));
			assert.doesNotMatch(text, /rezept|data-aufmachung/i);
		}
		const schlicht = einheitAuftragAus(pruefeEinheitAngaben({ ...ANGABEN, aussehen: 'schlicht' }));
		assert.match(schlicht, /schlicht, ohne thema\.css\./);
	});

	it('Plan: ungültige Slugs, doppelte und fremde Formate fallen heraus, höchstens max; fremde Arten bleiben', () => {
		const plan = lesePlan(
			{
				titel: 'Uhrzeit',
				dokumente: [
					{ slug: 'fall-1', art: 'arbeitsblatt', format: 'a4-hoch', fertig: true },
					{ slug: 'fall-1', art: 'arbeitsblatt', format: 'a4-hoch' },
					{ slug: '../boese', art: 'arbeitsblatt', format: 'a4-hoch' },
					{ slug: 'fall-2', art: 'arbeitsblatt', format: 'riesig' },
					{ slug: 'fall-3', art: 'arbeitsblatt', format: 'a4-hoch' },
					{ slug: 'fall-4', art: 'arbeitsblatt', format: 'a4-hoch' },
				],
			},
			2,
		);
		assert.deepEqual(
			plan?.dokumente.map((d) => [d.slug, d.fertig]),
			[
				['fall-1', true],
				['fall-3', false],
			],
		);
		assert.equal(lesePlan('kaputt'), null);
		const arten = lesePlan({
			dokumente: [
				{ slug: 'wortkarten', art: 'bild-und-wortkarten', format: 'a4-hoch', fertig: true },
				{ slug: 'theke', art: 'stationenlernen', format: 'a4-hoch' },
				{ slug: 'zauber', art: 'zauberei', format: 'a4-hoch' },
			],
		});
		assert.deepEqual(
			arten?.dokumente.map((d) => [d.slug, d.art, d.fertig]),
			[
				['wortkarten', 'karten', true],
				['theke', 'stationen', false],
				['zauber', 'sonstiges', false],
			],
		);
	});

	it('Thema: kein @import, kein url(), keine Skripte', () => {
		assert.equal(themaBefund(':root { --akzent: #c33; }'), null);
		for (const css of [
			'@import "x.css";',
			'body { background: url(x.png) }',
			'</style><script>',
			'a{b:expression(1)}',
		]) {
			assert.ok(themaBefund(css), css);
		}
	});
});

describe('Lauf einer Einheit (139)', () => {
	let server: TestServer;
	let bin: string;
	const altHome = process.env.HOME;
	let pruefbericht: Pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
	const fall = (name: string) => writeFile(path.join(path.dirname(bin), 'fall.txt'), name);
	const api = (pfad: string, init: { method?: string; body?: string } = {}) =>
		server.holen(`${server.url}/api${pfad}`, {
			...init,
			headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
		});
	const stand = async (id: string) => (await (await api(`/einheiten/${id}`)).json()) as EinheitStand;
	const starte = async (angaben: object = ANGABEN) => {
		const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben, ordner: null }) });
		assert.equal(antwort.status, 201, await antwort.clone().text());
		const einheit = (await antwort.json()) as { id: string; ordner: string; mappe: string };
		// Erst der Plan, dann die Freigabe: Gebaut wird nicht ungefragt.
		const plan = await bis(einheit.id, 'plan');
		assert.match(plan.planText ?? '', /Zwei Fälle/);
		assert.deepEqual(plan.importiert, {});
		assert.equal((await api(`/einheiten/${einheit.id}/freigeben`, { method: 'POST', body: '{}' })).status, 200);
		return einheit;
	};
	const bis = async (id: string, status: EinheitStand['status']) => {
		await warte(async () => (await stand(id)).status === status);
		return stand(id);
	};

	before(async () => {
		process.env.HOME = await mkdtemp(path.join(tmpdir(), 'einheit-home-'));
		const ordner = await mkdtemp(path.join(tmpdir(), 'einheit-bin-'));
		bin = path.join(ordner, 'claude');
		await writeFile(bin, KI_ATTRAPPE);
		await chmod(bin, 0o755);
		await fall('einheit');
		server = await starteTestServer({ env: { CLAUDE_BIN: bin }, kiPruefer: () => Promise.resolve(pruefbericht) });
	});

	after(async () => {
		process.env.HOME = altHome;
		await server.stop();
	});

	afterEach(async () => {
		pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
		await fall('einheit');
	});

	it('Ordner mit Behälter entsteht sofort, die Materialien kommen nacheinander, Thema und Bild in der Mappe', async () => {
		const { id, mappe, ordner } = await starte();
		const baum = server.kontext.ordner.baum();
		assert.equal(baum.ordner.find((o) => o.id === ordner)?.behaelter, mappe);
		await warte(async () => Object.keys((await stand(id)).importiert).length === 1);
		const s = await bis(id, 'fertig');
		assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
		const mappeDir = mappenDir(server.materialDir, mappe);
		assert.equal(await readFile(path.join(mappeDir, 'thema.css'), 'utf8'), ':root { --akzent: #c33; }');
		assert.ok(existsSync(path.join(mappeDir, 'bilder', 'uhr.png')));
		const dokumente = Object.entries(server.kontext.ordner.baum().dokumente).filter(([, d]) => d.ordner === ordner);
		assert.equal(dokumente.length, 2);
		const verbrauch = (await readFile(path.join(server.materialDir, VERBRAUCH_DATEI), 'utf8')).trim().split('\n');
		assert.match(verbrauch.at(-1) ?? '', /"umfang":"einheit"/);
	});

	it('Ohne Bilder lädt der Lauf keinen Konnektor; mit Bildern nur Canva', async () => {
		const aufrufe = async () =>
			(await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8'))
				.trim()
				.split('\n')
				.map((z) => (JSON.parse(z) as { args: string[] }).args)
				.filter((a) => a.includes('--append-system-prompt-file') && a.join(' ').includes('einheit.md'));
		const ohne = (await aufrufe()).at(-1) ?? [];
		assert.ok(ohne.includes('--strict-mcp-config'));
		const { id } = await starte({ ...ANGABEN, bilder: true });
		await bis(id, 'fertig');
		const mit = (await aufrufe()).at(-1) ?? [];
		assert.ok(mit.includes('--settings'));
		assert.ok(mit.includes('--strict-mcp-config'));
		assert.ok(mit.includes(CANVA_MCP));
	});

	it('Skript im Material: nicht übernommen, eine Korrekturrunde, danach sauber', async () => {
		await fall('einheit-skript');
		const { id, mappe } = await starte();
		const s = await bis(id, 'fertig');
		assert.equal(s.korrigiert, true);
		assert.deepEqual(s.befunde, []);
		const quelle = await readFile(
			path.join(
				mappenDir(server.materialDir, mappe),
				'dokumente',
				s.importiert['fall-2']?.dok ?? '',
				'material.html',
			),
			'utf8',
		);
		assert.doesNotMatch(quelle, /<script/);
	});

	it('Nur eine Einheit zur Zeit; Abbrechen lässt das Fertige stehen, Weiterbauen setzt fort', async () => {
		await fall('einheit-haenger');
		const { id } = await starte();
		await warte(async () => Object.keys((await stand(id)).importiert).length === 1);
		assert.equal(
			(await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) })).status,
			409,
		);
		await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
		const s = await bis(id, 'unvollstaendig');
		assert.deepEqual(Object.keys(s.importiert), ['fall-1']);
		await fall('einheit');
		await api(`/einheiten/${id}/weiter`, { method: 'POST' });
		assert.deepEqual(Object.keys((await bis(id, 'fertig')).importiert).sort(), ['fall-1', 'fall-2']);
	});

	it('Verwerfen legt den Ordner in den Papierkorb und räumt den Arbeitsordner ab', async () => {
		await fall('einheit-haenger');
		const { id, ordner } = await starte();
		await warte(async () => Object.keys((await stand(id)).importiert).length === 1);
		assert.equal((await api(`/einheiten/${id}/verwerfen`, { method: 'POST' })).status, 200);
		assert.equal(server.kontext.ordner.baum().ordner.find((o) => o.id === ordner)?.geloescht !== null, true);
		assert.ok(!(await readdir(einheitenWurzel(server.materialDir))).includes(`einheit-${id}`));
		assert.equal((await api(`/einheiten/${id}`)).status, 404);
	});

	it('Plan ändern: Claude zeigt ihn neu, gebaut wird erst nach der Freigabe; das Werkzeug „bauen“ ist erlaubt', async () => {
		const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) });
		const { id } = (await antwort.json()) as { id: string };
		await bis(id, 'plan');
		const wunsch = JSON.stringify({ aenderung: 'Lieber eine Schatzsuche.' });
		assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: wunsch })).status, 200);
		await warte(async () => /Geänderter Plan/.test((await stand(id)).planText ?? ''));
		const s = await bis(id, 'plan');
		assert.deepEqual(s.importiert, {});
		assert.equal((await api(`/einheiten/${id}/weiter`, { method: 'POST' })).status, 409);
		assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: '{}' })).status, 200);
		await bis(id, 'fertig');
		const aufrufe = (await readFile(path.join(path.dirname(bin), 'aufrufe.jsonl'), 'utf8')).trim().split('\n');
		const args = (JSON.parse(aufrufe.at(-1) ?? '{}') as { args: string[] }).args;
		assert.ok(args.includes('--mcp-config'));
		assert.ok(args.includes('mcp__schoolbox__bauen'));
	});

	it('Fremde IDs gibt es nicht', async () => {
		assert.equal((await api('/einheiten/..%2F..%2Fetc')).status, 404);
		assert.equal((await api('/einheiten/abcdefabcdef')).status, 404);
	});
});
