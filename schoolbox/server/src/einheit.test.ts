import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { Art, EinheitStand, LaufProtokoll, Pruefbericht } from '@schoolbox/kern';
import {
	aufgabenFuerBau,
	bausteinVerstoesse,
	einheitAuftragAus,
	LAUF_DATEI,
	laufMeldungen,
	lektuereZeile,
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

describe('Prüfungen im Lauf (225)', () => {
	const AUFGABE = '<div class="aufgabe" data-min="5"><span class="nr">1</span><div class="anw">Rechne.</div></div>';
	const blatt = (body: string, inhalt = AUFGABE) =>
		`<html><body class="kl2 a4-hoch farbe"${body}><section class="seite">${inhalt}</section></body></html>`;
	const codes = (html: string, art: Art) => laufMeldungen(html, art).map((m) => `${m.stufe} ${m.code ?? ''}`);

	it('Zeitziel fehlt: nur neues Arbeitsmaterial mit Aufgaben', () => {
		const ohne = blatt(' data-satz="2"');
		assert.deepEqual(laufMeldungen(ohne, 'arbeitsblatt'), [
			{
				stufe: 'WARNUNG',
				seite: 0,
				code: 'zeitziel-fehlt',
				text: 'Am <body> fehlt data-zeit. Ohne Zeitziel prüft der Bau die Menge nicht → ergänzen und je Aufgabe data-min setzen.',
			},
		]);
		for (const art of ['stationen', 'lernzielkontrolle', 'klassenarbeit'] as const) {
			assert.deepEqual(codes(ohne, art), ['WARNUNG zeitziel-fehlt'], art);
		}
		assert.deepEqual(codes(blatt(' data-satz="2" data-zeit="20"'), 'arbeitsblatt'), []);
		assert.deepEqual(codes(ohne, 'lernplakat'), [], 'andere Art');
		assert.deepEqual(codes(blatt(''), 'arbeitsblatt'), [], 'älteres Blatt ohne data-satz');
		assert.deepEqual(codes(blatt(' data-satz="2"', '<p>Male.</p><!-- class="aufgabe" -->'), 'arbeitsblatt'), []);
	});

	it('Lösung fehlt: je Aufgabe eine WARNUNG mit Seite', () => {
		const html = blatt(
			' data-satz="2" data-zeit="20"',
			`${AUFGABE}<div class="aufgabe"><span class="antwort"></span></div><div class="aufgabe"><span class="antwort" data-l="3"></span><span class="antwort"></span></div>`,
		);
		assert.deepEqual(
			laufMeldungen(html, 'arbeitsblatt').map(({ seite, stufe, text }) => ({ seite, stufe, text })),
			[
				{ seite: 1, stufe: 'WARNUNG', text: 'Aufgabe 2 hat keine Lösung → data-l, loesung= oder, bei offener Aufgabe, ein Satz als .nur-loesung' },
				{ seite: 1, stufe: 'WARNUNG', text: 'Aufgabe 3: 1 von 2 Antwortlinien ohne Lösung → data-l ergänzen' },
			],
		);
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
	const prompts = async () =>
		(await readFile(path.join(path.dirname(bin), 'prompts.txt'), 'utf8').catch(() => ''))
			.split('\n---\n')
			.filter(Boolean);
	const jsonl = async <T>(name: string) =>
		(await readFile(path.join(path.dirname(bin), name), 'utf8').catch(() => ''))
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((z) => JSON.parse(z) as T);
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
		// `bauen` ohne Browser: eine Seite, derselbe Prüfbericht wie bei der Übernahme.
		server = await starteTestServer({
			env: { CLAUDE_BIN: bin },
			kiPruefer: () => Promise.resolve(pruefbericht),
			einheitAnsicht: async (quelle, ziel) => {
				await mkdir(ziel, { recursive: true });
				// Die Quelle als „Seitenbild“: So sieht der Prüflauf der Attrappe, was auf der Seite steht.
				await writeFile(path.join(ziel, 'seite-1.png'), await readFile(quelle));
				return { bericht: pruefbericht, bilder: ['seite-1.png'] };
			},
		});
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
				.filter(
					(a) => a.includes('--append-system-prompt-file') && a.join(' ').includes('einheit-material.md'),
				);
		const ohne = (await aufrufe()).at(-1) ?? [];
		assert.ok(ohne.includes('--strict-mcp-config'));
		assert.ok(!ohne.includes(CANVA_MCP));
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
		assert.match((await prompts()).filter((p) => p.includes('Korrekturrunde')).at(-1) ?? '', /data-satz="2"/);
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
		const korrektur = (await prompts()).filter((p) => p.includes('Korrekturrunde')).at(-1) ?? '';
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
		// Je Material ein Lauf: fall-1 ist übernommen, während fall-2 in Arbeit ist.
		await warte(async () => (await stand(id)).inArbeit === 'fall-2');
		assert.deepEqual(Object.keys((await stand(id)).importiert), ['fall-1']);
		const angefangen = path.join(
			einheitenWurzel(server.materialDir),
			`einheit-${id}`,
			'arbeit',
			'dokumente',
			'fall-2',
		);
		await warte(() => existsSync(path.join(angefangen, 'material.html')));
		assert.equal(
			(await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) })).status,
			409,
		);
		await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
		const s = await bis(id, 'unvollstaendig');
		assert.deepEqual(Object.keys(s.importiert), ['fall-1']);
		assert.equal(s.inArbeit, 'fall-2');
		await fall('einheit');
		const vorher = (await prompts()).length;
		await api(`/einheiten/${id}/weiter`, { method: 'POST' });
		assert.deepEqual(Object.keys((await bis(id, 'fertig')).importiert).sort(), ['fall-1', 'fall-2']);
		// Weiterbauen setzt am angefangenen Material an, in einer neuen Sitzung.
		const neu = (await prompts()).slice(vorher).filter((p) => p.startsWith('Schritt 2: der Bau'));
		assert.equal(neu.length, 1);
		assert.match(neu[0] ?? '', /der Bau von dokumente\/fall-2\//);
		assert.match(neu[0] ?? '', /Ein früherer Durchgang hat dieses Material angefangen/);
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

	describe('Aufgaben-Übersicht im Plan (221)', () => {
		const planen = async () => {
			const vorher = (await prompts()).length;
			const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) });
			const { id } = (await antwort.json()) as { id: string };
			const s = await bis(id, 'plan');
			return { id, s, neu: (await prompts()).slice(vorher) };
		};
		const korrekturen = (neu: string[]) => neu.filter((p) => p.startsWith('Korrekturrunde zum Plan'));

		it('Plan mit Übersicht wird gelesen; ohne Verstoß keine Korrekturrunde', async () => {
			await fall('einheit-uebersicht');
			const { id, neu, s } = await planen();
			assert.deepEqual(
				s.plan?.stunden?.map((t) => [
					t.nr,
					t.handlung,
					t.aufgaben.map((a) => [a.format, a.bereich, a.zweitesMal]),
				]),
				[
					[
						1,
						'Uhr aus Pappe stellen',
						[
							['legen-bauen-falten', 'I', false],
							['lueckentext', 'I', false],
						],
					],
					[
						2,
						'Zu zweit Uhrzeiten zeigen',
						[
							['lueckentext', 'II', true],
							['erklaeren', 'III', false],
						],
					],
				],
			);
			assert.equal(s.plan?.recherche, 'Der Bildungsplan nennt volle und halbe Stunden.');
			assert.deepEqual(korrekturen(neu), []);
			assert.deepEqual(s.planBefunde, []);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Ein Format dreimal: genau eine Korrekturrunde mit dem Befund, danach der korrigierte Plan', async () => {
			await fall('einheit-dreifach');
			const { id, neu, s } = await planen();
			const runde = korrekturen(neu);
			assert.equal(runde.length, 1);
			assert.match(
				runde[0] ?? '',
				/„Lückentext mit Wortauswahl“ \(lueckentext\) kommt 3-mal vor \(Stunde 1, 2\)/,
			);
			assert.match(s.planText ?? '', /Korrigierter Plan/);
			assert.deepEqual(s.planBefunde, []);
			assert.deepEqual(
				s.plan?.stunden?.flatMap((t) => t.aufgaben.map((a) => a.format)),
				['legen-bauen-falten', 'lueckentext', 'lueckentext', 'erklaeren'],
			);
			// Gebaut wird wie immer erst nach der Freigabe.
			assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: '{}' })).status, 200);
			await bis(id, 'fertig');
		});

		it('Behebt Claude den Verstoß nicht, bleibt es bei einer Runde; der Befund steht im Stand', async () => {
			await fall('einheit-dreifach-stur');
			const { id, neu, s } = await planen();
			assert.equal(korrekturen(neu).length, 1);
			assert.equal(s.status, 'plan');
			assert.equal(s.planBefunde?.length, 1);
			assert.match(s.planBefunde?.[0] ?? '', /kommt 3-mal vor/);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Alter Plan ohne Übersicht: keine Korrekturrunde, kein Feld', async () => {
			await fall('einheit');
			const { id, neu, s } = await planen();
			assert.deepEqual(korrekturen(neu), []);
			assert.equal(neu.filter((p) => p.startsWith('Schritt 1')).length, 1);
			assert.equal(s.plan?.stunden, undefined);
			assert.deepEqual(s.planBefunde, []);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});
	});

	describe('Ein Lauf je Material (220)', () => {
		const protokoll = async (mappe: string) =>
			JSON.parse(
				await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8'),
			) as LaufProtokoll;
		const baulaeufe = async (mappe: string) => (await protokoll(mappe)).laeufe.filter((e) => e.art === 'bau');

		it('Jedes Material in einer neuen Sitzung; der Auftrag nennt Aufgaben und fertige Materialien', async () => {
			await fall('einheit-uebersicht');
			const laeufeVorher = (await jsonl('laeufe.jsonl')).length;
			const vorher = (await prompts()).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			const laeufe = (await jsonl<{ erste: string; resume: boolean; auftrag: string }>('laeufe.jsonl')).slice(
				laeufeVorher,
			);
			const bau = laeufe.filter((l) => l.erste.startsWith('Schritt 2: der Bau'));
			assert.deepEqual(
				bau.map((l) => [/dokumente\/([a-z0-9-]+)\//.exec(l.erste)?.[1], l.resume, l.auftrag]),
				[
					['fall-1', false, 'einheit-material.md'],
					['fall-2', false, 'einheit-material.md'],
				],
			);
			const neu = (await prompts()).slice(vorher).filter((p) => p.startsWith('Schritt 2: der Bau'));
			assert.ok(s.plan);
			assert.match(neu[0] ?? '', /Aufgaben-Übersicht aus dem freigegebenen Plan, für dokumente\/fall-1:/);
			assert.ok(neu[0]?.includes(aufgabenFuerBau(s.plan, 'fall-1')));
			assert.ok(neu[1]?.includes(aufgabenFuerBau(s.plan, 'fall-2')));
			assert.match(neu[0] ?? '', /Schon fertig: noch nichts\./);
			assert.match(neu[1] ?? '', /- dokumente\/fall-1 „Fall 1“: 1 Seite\. Formate: .*Rätselkette: liefert das U/);
			assert.match(neu[0] ?? '', /Lege zuerst thema\.css an/);
			assert.doesNotMatch(neu[1] ?? '', /Lege zuerst thema\.css an/);
			assert.deepEqual(s.steckbriefe?.['fall-2']?.figuren, ['Willi mit Uhr']);
		});

		it('_lauf.json: je Lauf Skills und gelesene Dateien, alle Pflichtdateien gelesen, keine Prompts', async () => {
			await fall('einheit');
			const { id, mappe } = await starte();
			await bis(id, 'fertig');
			const roh = await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8');
			const p = await protokoll(mappe);
			assert.equal(p.einheit, id);
			assert.deepEqual(
				p.laeufe.map((e) => e.art).filter((a) => a !== 'recherche'),
				['plan', 'bau', 'pruefung', 'bau', 'pruefung', 'schluss'],
			);
			for (const e of await baulaeufe(mappe)) {
				assert.equal(e.ergebnis, 'fertig');
				assert.ok(e.pflicht.length > 2);
				const gelesen = new Set([...e.skills.map((x) => `skill:${x}`), ...e.gelesen]);
				assert.deepEqual(
					e.pflicht.filter((x) => !gelesen.has(x)),
					[],
				);
				assert.deepEqual(e.bauen.at(-1)?.fehlend, []);
				assert.equal(e.bauen.at(-1)?.seiten, 1);
				assert.equal(typeof e.sekunden, 'number');
			}
			assert.doesNotMatch(roh, /Auftrag der Lehrkraft|Schritt 2|Uhrzeit|Zur Klasse/);
		});

		it('bauen vor der ganzen Pflichtlektüre: abgewiesen mit der fehlenden Datei, danach gebaut', async () => {
			await fall('einheit-ungelesen');
			const vorher = (await jsonl('bauen.jsonl')).length;
			const { id, mappe } = await starte();
			await bis(id, 'fertig');
			const antworten = (await jsonl<{ slug: string; text?: string; fehler?: boolean }>('bauen.jsonl')).slice(
				vorher,
			);
			const [erster] = await baulaeufe(mappe);
			const fehlend = erster?.pflicht.at(-1) ?? '';
			assert.ok(fehlend);
			assert.equal(antworten[0]?.slug, 'fall-1');
			assert.equal(antworten[0]?.fehler, true);
			assert.match(antworten[0]?.text ?? '', /Pflichtlektüre fehlt noch/);
			assert.ok(antworten[0]?.text?.includes(`- ${lektuereZeile(fehlend)}`));
			assert.notEqual(antworten[1]?.fehler, true);
			assert.match(antworten[1]?.text ?? '', /Gebaut: 1 Seite/);
			assert.deepEqual(
				erster?.bauen.map((b) => b.fehlend),
				[[fehlend], []],
			);
		});

		it('Der Plan lässt sich im Bau nicht überschreiben', async () => {
			await fall('einheit-ueberschreiben');
			const vorher = (await prompts()).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			assert.equal(s.plan?.titel, 'Uhrzeit');
			assert.deepEqual(
				s.plan?.dokumente.map((d) => d.slug),
				['fall-1', 'fall-2'],
			);
			assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
			const zweiter = (await prompts()).slice(vorher).find((p) => p.includes('der Bau von dokumente/fall-2/'));
			assert.match(zweiter ?? '', /Titel: Uhrzeit/);
		});
	});

	describe('Prüflauf mit Kinderaugen und Schlusslauf (220, Teil 2)', () => {
		const protokoll = async (mappe: string) =>
			JSON.parse(
				await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8'),
			) as LaufProtokoll;
		const arten = async (mappe: string) =>
			(await protokoll(mappe)).laeufe
				.map((e) => `${e.art}:${e.material ?? ''}`)
				.filter((a) => !a.startsWith('recherche'));
		const nachPruefung = (neu: string[]) => neu.filter((p) => p.startsWith('Korrekturrunde nach der Prüfung.'));
		const quelle = async (s: EinheitStand, mappe: string, slug: string) =>
			readFile(
				path.join(
					mappenDir(server.materialDir, mappe),
					'dokumente',
					s.importiert[slug]?.dok ?? '',
					'material.html',
				),
				'utf8',
			);

		it('Unklare Anweisung: der Prüflauf meldet sie, eine Korrekturrunde in der Sitzung des Baus, dann sauber', async () => {
			await fall('einheit-unklar');
			const vorher = (await prompts()).length;
			const laeufeVorher = (await jsonl('laeufe.jsonl')).length;
			const pruefVorher = (await jsonl('pruefungen.jsonl')).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(await arten(mappe), [
				'plan:',
				'bau:fall-1',
				'pruefung:fall-1',
				'korrektur:fall-1',
				'pruefung:fall-1',
				'bau:fall-2',
				'pruefung:fall-2',
				'schluss:_schluss',
			]);
			const p = s.pruefung?.['fall-1'];
			assert.equal(p?.status, 'fertig');
			assert.equal(p?.runden, 2);
			assert.equal(p?.korrekturen, 1);
			assert.deepEqual(
				p?.gefunden.map((b) => [b.seite, b.aufgabe, b.art]),
				[[1, '1', 'unklar']],
			);
			assert.deepEqual(p?.offen, []);
			assert.deepEqual(s.pruefung?.['fall-2']?.gefunden, []);
			const neu = (await prompts()).slice(vorher);
			const runde = nachPruefung(neu);
			assert.equal(runde.length, 1);
			assert.match(runde[0] ?? '', /- Seite 1, Aufgabe 1, [^:]+: Was mit den Uhren zu tun ist, steht nicht da\./);
			const laeufe = (await jsonl<{ erste: string; resume: boolean }>('laeufe.jsonl')).slice(laeufeVorher);
			assert.equal(laeufe.find((l) => l.erste.startsWith('Korrekturrunde nach der Prüfung.'))?.resume, true);
			// Der Prüflauf sieht weder Lösung noch Bau: nur die Seiten, Klasse und Fach.
			const pruefungen = (
				await jsonl<{ titel: string; loesung: boolean; kind: boolean }>('pruefungen.jsonl')
			).slice(pruefVorher);
			assert.deepEqual(
				pruefungen.map((x) => [x.titel, x.loesung, x.kind]),
				[
					['Fall 1', false, true],
					['Fall 1', false, true],
					['Fall 2', false, true],
				],
			);
			const pruefPrompt = neu.find((x) => x.startsWith('Prüfung von „Fall 1“')) ?? '';
			assert.match(pruefPrompt, /Klasse 2, Mathematik/);
			assert.doesNotMatch(pruefPrompt, /Auftrag der Lehrkraft|Rätselkette|Schritt 2/);
			assert.doesNotMatch(await quelle(s, mappe, 'fall-1'), /Mach was mit den Uhren/);
			const e = (await protokoll(mappe)).laeufe.find((x) => x.art === 'pruefung');
			assert.match(e?.befunde[0] ?? '', /Was mit den Uhren/);
		});

		it('Stur: nach zwei Korrekturrunden bleibt der Befund offen, die Einheit ist trotzdem fertig', async () => {
			await fall('einheit-stur');
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			const p = s.pruefung?.['fall-1'];
			assert.equal(p?.runden, 3);
			assert.equal(p?.korrekturen, 2);
			assert.equal(p?.offen.length, 1);
			assert.equal(p?.offen[0]?.art, 'unklar');
			assert.equal(nachPruefung((await prompts()).slice(vorher)).length, 2);
			assert.equal((await arten(mappe)).filter((a) => a === 'pruefung:fall-1').length, 3);
			assert.match(await quelle(s, mappe, 'fall-1'), /Mach was mit den Uhren/);
		});

		it('Unlesbare Antwort: keine Befunde, keine Korrekturrunde, im Protokoll vermerkt', async () => {
			await fall('einheit-pruefung-unlesbar');
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.equal(s.pruefung?.['fall-1']?.status, 'fertig');
			assert.deepEqual(s.pruefung?.['fall-1']?.offen, []);
			assert.deepEqual(nachPruefung((await prompts()).slice(vorher)), []);
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung');
			assert.equal(e.length, 2);
			assert.match(e[0]?.hinweis ?? '', /keinen lesbaren Block/);
		});

		it('Scheitert der Prüflauf, bleibt das Material und der Bau geht weiter', async () => {
			await fall('einheit-pruefung-scheitert');
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
			assert.equal(s.pruefung?.['fall-1']?.status, 'gescheitert');
			assert.ok(s.pruefung?.['fall-1']?.grund);
			assert.equal(s.schluss?.status, 'fertig');
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung');
			assert.equal(e.length, 2);
			assert.notEqual(e[0]?.ergebnis, 'fertig');
		});

		it('Doppelte Abbildung: der Server meldet sie dem zweiten Material und dem Schlusslauf', async () => {
			await fall('einheit-dopplung');
			const vorher = (await prompts()).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(s.pruefung?.['fall-1']?.server ?? [], []);
			assert.match(s.pruefung?.['fall-2']?.server[0] ?? '', /Dieselbe Abbildung steht schon in „Fall 1“/);
			assert.equal(s.pruefung?.['fall-2']?.korrekturen, 2);
			const neu = (await prompts()).slice(vorher);
			assert.match(nachPruefung(neu)[0] ?? '', /Die Schoolbox meldet:\n- Dieselbe Abbildung/);
			const schluss = neu.find((p) => p.startsWith('Schritt 3: der Schlusslauf')) ?? '';
			assert.match(
				schluss,
				/Doppelte Abbildungen, die der Server gefunden hat:\n- Dieselbe Abbildung in „Fall 1“ und „Fall 2“: <x-gitter/,
			);
			assert.match(s.schluss?.server[0] ?? '', /Dieselbe Abbildung in „Fall 1“ und „Fall 2“/);
		});

		it('Schlusslauf mit falscher Seitenzahl: ungebaute Änderung zurückgesetzt, der Server nennt die Zahl', async () => {
			await fall('einheit-seitenzahl');
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			const schluss =
				(await prompts()).slice(vorher).find((p) => p.startsWith('Schritt 3: der Schlusslauf')) ?? '';
			assert.match(schluss, /Die Zahlen der Schoolbox/);
			assert.match(schluss, /- deckblatt: /);
			assert.equal(s.schluss?.status, 'fertig');
			assert.deepEqual(s.schluss?.neuGebaut, []);
			assert.deepEqual(s.schluss?.offen, []);
			assert.match(
				s.schluss?.server.join(' ') ?? '',
				/„Deckblatt“ nennt 12 Seiten\. Die Schoolbox zählt 2 Seiten/,
			);
			assert.match(await quelle(s, mappe, 'deckblatt'), /12 Seiten/);
			const e = (await protokoll(mappe)).laeufe.find((x) => x.art === 'schluss');
			assert.match(e?.hinweis ?? '', /nicht mit bauen gebaut, zurückgesetzt: deckblatt/);
			assert.ok(e?.befunde.some((b) => b.includes('nennt 12 Seiten')));
		});

		it('Schlusslauf baut nach der Pflichtlektüre neu: übernommen, die Zahl stimmt', async () => {
			await fall('einheit-seitenzahl-gebaut');
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(s.schluss?.neuGebaut, ['deckblatt']);
			assert.deepEqual(s.schluss?.server, []);
			assert.match(await quelle(s, mappe, 'deckblatt'), /2 Seiten/);
			const e = (await protokoll(mappe)).laeufe.find((x) => x.art === 'schluss');
			assert.deepEqual(
				e?.bauen.map((b) => [b.material, b.fehlend]),
				[['deckblatt', []]],
			);
		});

		it('Abgebrochener Schlusslauf: Weiterbauen wiederholt nur ihn', async () => {
			await fall('einheit-schluss-haenger');
			const { id } = await starte();
			await warte(async () => (await stand(id)).inArbeit === '_schluss');
			await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
			const s = await bis(id, 'unvollstaendig');
			assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
			assert.equal(s.schluss?.status, 'abgebrochen');
			await fall('einheit');
			const vorher = (await prompts()).length;
			await api(`/einheiten/${id}/weiter`, { method: 'POST' });
			const t = await bis(id, 'fertig');
			assert.equal(t.schluss?.status, 'fertig');
			const neu = (await prompts()).slice(vorher);
			assert.equal(neu.length, 1);
			assert.match(neu[0] ?? '', /^Schritt 3: der Schlusslauf/);
		});
	});

	it('Fremde IDs gibt es nicht', async () => {
		assert.equal((await api('/einheiten/..%2F..%2Fetc')).status, 404);
		assert.equal((await api('/einheiten/abcdefabcdef')).status, 404);
	});
});
