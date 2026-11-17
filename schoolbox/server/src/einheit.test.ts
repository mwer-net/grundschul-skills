import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { EinheitStand, Pruefbericht } from '@schoolbox/kern';
import {
	bausteinVerstoesse,
	einheitAuftragAus,
	lesePlan,
	mappenDir,
	pruefeEinheitAngaben,
	themaBefund,
} from '@schoolbox/kern';

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
	it('Angaben: Titel aus dem Thema, Unbekanntes abgelehnt, alte Felder still übergangen', () => {
		const a = pruefeEinheitAngaben({ ...ANGABEN, rahmen: false, menge: 'etwa 6', leitfigur: 'keine' });
		assert.equal(a.leitfigur, 'keine');
		assert.equal('rahmen' in a || 'menge' in a, false);
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

	it('Plan: Geschichte mit Verdächtigen, falscher Fährte, Kapiteln und Auflösung; ohne Angaben keine (216)', () => {
		const plan = lesePlan({
			geschichte: ' Im Werkraum wandern Nägel. ',
			verdaechtige: ['Herr Brandt: Schlüssel', '', 7],
			falscheFaehrte: 'Alufolie unter dem Tisch',
			aufloesung: 'Herr Brandt testet nachts eine Magnetbahn.',
			kapitel: [
				{ nr: 0, titel: 'Auftakt', offenesEnde: 'Seid ihr dabei?', bildfolien: ['0.1 Flur', '0.2 Spur'] },
				{ nr: 1.5, titel: 'kaputt' },
				{ nr: 1, titel: 'Was der Spuk mag' },
			],
			dokumente: [],
		});
		assert.deepEqual(plan?.geschichte, {
			kurz: 'Im Werkraum wandern Nägel.',
			verdaechtige: ['Herr Brandt: Schlüssel'],
			falscheFaehrte: 'Alufolie unter dem Tisch',
			aufloesung: 'Herr Brandt testet nachts eine Magnetbahn.',
			kapitel: [
				{ nr: 0, titel: 'Auftakt', offenesEnde: 'Seid ihr dabei?', bildfolien: ['0.1 Flur', '0.2 Spur'] },
				{ nr: 1, titel: 'Was der Spuk mag', offenesEnde: '', bildfolien: [] },
			],
		});
		assert.equal('geschichte' in (lesePlan({ dokumente: [] }) ?? {}), false);
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

describe('Wächter: Abgewähltes im Material (210)', () => {
	const AUS = { selbsteinschaetzung: false, niveaus: false, sternchen: false };
	const AN = { selbsteinschaetzung: true, niveaus: true, sternchen: true };
	const blatt = (inhalt: string) => `<body class="kl2 a4-hoch"><section class="seite">${inhalt}</section></body>`;
	const NIVEAU = '<div class="namenszeile"><span class="name">Name:</span><span class="niveau"><i></i></span></div>';
	const WAHLHILFE = '<div class="wahlhilfe">Wähle deine Aufgaben.</div>';
	const WACHSTUM =
		'<div class="fuss"><div class="wachstum"><img src="bilder/wachstum.png" alt=""><i></i></div></div>';
	// Einfache Anführungszeichen im Attribut: Der Wächter muss auch diese Schreibweise finden.
	const BILD = '<img src="../../bilder/wachstum-strich.png" alt="">'.replaceAll('"', String.fromCharCode(39));
	const KARTE = '<x-spielplan art="lernlandkarte" inhalt="Ich kann …"></x-spielplan>';
	const STERN = '<div class="aufgabe"><span class="nr stern">★</span><div class="anw">Knobel</div></div>';
	const SAUBER = blatt(
		'<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Rechne.</span></div></div>',
	);

	it('schlägt an, wenn ein abgewählter Baustein im Material steht', () => {
		const befund = (inhalt: string, aus: Partial<typeof AUS>) => bausteinVerstoesse(blatt(inhalt), aus);
		assert.match(befund(NIVEAU, { niveaus: false }).join(), /ohne drei Niveaus.*eine Stelle mit \.niveau/);
		assert.match(befund(NIVEAU + WAHLHILFE, { niveaus: false }).join(), /2 Stellen/);
		assert.match(
			befund(WACHSTUM, { selbsteinschaetzung: false }).join(),
			/ohne Selbsteinschätzung.*Wachstumsgrafik/,
		);
		assert.match(befund(BILD, { selbsteinschaetzung: false }).join(), /Wachstumsgrafik/);
		assert.match(befund(KARTE, { selbsteinschaetzung: false }).join(), /Lernlandkarte/);
		assert.match(befund(STERN, { sternchen: false }).join(), /ohne Sternchenaufgabe.*Entferne sie/);
		assert.equal(befund(NIVEAU + WACHSTUM + STERN, AUS).length, 3);
	});

	it('Gegenprobe: schweigt bei gewählten Bausteinen, ohne Angabe und bei sauberem Material', () => {
		const alles = blatt(NIVEAU + WAHLHILFE + WACHSTUM + KARTE + STERN);
		assert.deepEqual(bausteinVerstoesse(alles, AN), []);
		// Fragt der Assistent einen Baustein bei der Art nicht ab, fehlt er: Dann gilt der Skill.
		assert.deepEqual(bausteinVerstoesse(alles, {}), []);
		assert.deepEqual(bausteinVerstoesse(SAUBER, AUS), []);
		// Kommentare, Wörter im Text und ähnliche Klassen zählen nicht.
		const aehnlich = blatt(
			'<!-- <span class="niveau"></span> --><p>Ein Stern und eine Pflanze im Wachstum.</p><span class="nr">2</span><svg class="form" data-form="stern"></svg><span class="niveau-text">x</span><x-beschriften bild="bilder/wachstum.png"></x-beschriften>',
		);
		assert.deepEqual(bausteinVerstoesse(aehnlich, AUS), []);
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

	it('Material ohne data-satz (212): nicht übernommen, eine Korrekturrunde nennt die Angabe', async () => {
		await fall('einheit-altsatz');
		const { id } = await starte();
		const s = await bis(id, 'fertig');
		assert.equal(s.korrigiert, true);
		assert.deepEqual(s.befunde, []);
		assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
		const prompts = (await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8')).split('\n---\n');
		assert.match(prompts.filter((p) => p.includes('Korrekturrunde')).at(-1) ?? '', /data-satz="2"/);
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

	it('Niveau-Punkte, obwohl der Auftrag ohne Niveaus ist: eine Korrekturrunde, die sagt, was weg muss (210)', async () => {
		await fall('einheit-niveau');
		const { id } = await starte();
		const s = await bis(id, 'fertig');
		assert.deepEqual(s.bausteine, { selbsteinschaetzung: false, niveaus: false, sternchen: false });
		assert.equal(s.korrigiert, true);
		assert.deepEqual(s.befunde, []);
		const prompts = (await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8')).split('\n---\n');
		const korrektur = prompts.filter((p) => p.includes('Korrekturrunde')).at(-1) ?? '';
		assert.match(korrektur, /dokumente\/fall-2\/material\.html: Laut Auftrag ohne drei Niveaus/);
		// Gegenprobe: Mit Niveaus ist dasselbe Material richtig.
		const mit = await starte({ ...ANGABEN, bausteine: { niveaus: true } });
		const t = await bis(mit.id, 'fertig');
		assert.equal(t.korrigiert, false);
		assert.deepEqual(t.befunde, []);
	});

	it('Nur eine Einheit zur Zeit; Abbrechen lässt das Fertige stehen, Weiterbauen setzt fort', async () => {
		await fall('einheit-haenger');
		const { id } = await starte();
		// In Arbeit ist das zuletzt geschriebene Material, nicht das erste offene im Plan.
		await warte(async () => (await stand(id)).inArbeit === 'fall-2');
		assert.deepEqual((await stand(id)).importiert, {});
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

	it('Verwerfen legt den Ordner in den Papierkorb; „Rückgängig“ holt Ordner und Stand zurück (190-30)', async () => {
		await fall('einheit-haenger');
		const { id, ordner } = await starte();
		await warte(async () => Object.keys((await stand(id)).importiert).length === 1);
		const weg = await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		assert.equal(weg.status, 200);
		assert.deepEqual(await weg.json(), { ok: true, rueckgaengig: true });
		const geloescht = () => server.kontext.ordner.baum().ordner.find((o) => o.id === ordner)?.geloescht ?? null;
		assert.notEqual(geloescht(), null);
		assert.equal((await api(`/einheiten/${id}`)).status, 404);
		assert.equal((await api(`/einheiten/${id}/zurueckholen`, { method: 'POST' })).status, 200);
		assert.equal(geloescht(), null);
		const s = await stand(id);
		assert.equal(s.status, 'unvollstaendig');
		assert.deepEqual(Object.keys(s.importiert), ['fall-1']);
		assert.equal((await api(`/einheiten/${id}/zurueckholen`, { method: 'POST' })).status, 404);
		assert.equal((await api(`/einheiten/${id}/verwerfen`, { method: 'POST' })).status, 200);
		assert.ok((await readdir(einheitenWurzel(server.materialDir))).includes(`einheit-${id}`));
	});

	it('Fertig: Das Band lässt sich schließen, danach liefert der Server den Stand nicht mehr (190-42)', async () => {
		await fall('einheit');
		const { id } = await starte();
		await bis(id, 'fertig');
		assert.equal((await api(`/einheiten/${id}/schliessen`, { method: 'POST' })).status, 200);
		assert.equal((await api(`/einheiten/${id}`)).status, 404);
	});

	it('Doppelklick auf „So bauen“: ein Bau, die zweite Freigabe bekommt 409 (190-32)', async () => {
		await fall('einheit');
		const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) });
		const { id } = (await antwort.json()) as { id: string };
		await bis(id, 'plan');
		const frei = () => api(`/einheiten/${id}/freigeben`, { method: 'POST', body: '{}' });
		const status = (await Promise.all([frei(), frei()])).map((r) => r.status).sort();
		assert.deepEqual(status, [200, 409]);
		await bis(id, 'fertig');
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
