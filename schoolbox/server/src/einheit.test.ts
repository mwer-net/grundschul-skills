import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';

import type { Art, EinheitStand, LaufProtokoll, Pruefbericht } from '@schoolbox/kern';
import {
	aufgabenFuerBau,
	bausteinVerstoesse,
	BILDER_SCHRITT,
	einheitAuftragAus,
	fachlichOffen,
	LAUF_DATEI,
	laufMeldungen,
	lektuereZeile,
	leseBibliothek,
	lesePlan,
	mappenDir,
	pruefeEinheitAngaben,
	referenzFiguren,
	themaBefund,
	VERMERK_GEGENSTAND,
} from '@schoolbox/kern';
import { KANON_GRENZEN } from '@schoolbox/kern/src/einheit-kanon';
import type { BibliotheksFigur } from '@schoolbox/kern/src/figuren';
import { EINGEBAUTE } from '@schoolbox/kern/src/figuren';

import { BILD_HERKUNFT } from './bild-werkzeug';
import { BILDER_GESPERRT, grundposeReferenz } from './bild-zugang';
import { einheitenWurzel } from './einheit';
import { CACHE_TTL_VARIABLE, KI_GRENZEN, VERBRAUCH_DATEI } from './ki';
import { WERKZEUG_BILD_BEARBEITEN, WERKZEUG_BILD_ERZEUGEN } from './ki-werkzeug';
import { leseMitschrift, MITSCHRIFT_ORDNER } from './mitschrift';
import { CSRF_HEADER } from './schutz';
import type { TestServer } from './testhilfe';
import { KI_ATTRAPPE, legeTestfigurenAn, starteTestServer, TEST_PNG } from './testhilfe';

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
		assert.deepEqual(a.leitfigur, { art: 'keine' });
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

	it('Plan (242): Figuren mit Herkunft; alte Texte und unbekannte Herkunft gelten als neu', () => {
		const plan = lesePlan({
			dokumente: [],
			figuren: [
				{ name: 'Luna', rolle: 'Leitfigur', aussehen: 'braune Eule', herkunft: 'neu' },
				{ name: 'Pelle', rolle: 'Postbote', aussehen: '', herkunft: 'bibliothek:pelle' },
				{ name: 'Fridolin', rolle: 'Fuchs', aussehen: 'rotes Fell', herkunft: 'bibliothek:../x' },
				{ name: 'Ella', herkunft: 'irgendwo' },
				'Fuchs Fridolin, Postbote des Winterwalds: rotes Fell',
				{ rolle: 'ohne Name und Aussehen' },
				7,
			],
		});
		assert.deepEqual(plan?.figuren, [
			{ name: 'Luna', rolle: 'Leitfigur', aussehen: 'braune Eule', herkunft: 'neu' },
			{ name: 'Pelle', rolle: 'Postbote', aussehen: '', herkunft: 'bibliothek:pelle' },
			{ name: 'Fridolin', rolle: 'Fuchs', aussehen: 'rotes Fell', herkunft: 'neu' },
			{ name: 'Ella', rolle: '', aussehen: '', herkunft: 'neu' },
			{ name: '', rolle: '', aussehen: 'Fuchs Fridolin, Postbote des Winterwalds: rotes Fell', herkunft: 'neu' },
		]);
	});

	it('Referenzen (242): nur Figuren mit bibliothek:<id> und die Leitfigur, kein gleicher Name', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'sb-referenz-'));
		await mkdir(path.join(dir, '_figuren'));
		const figur = (id: string, name: string): BibliotheksFigur => ({
			id,
			name,
			eingebaut: false,
			suchwoerter: [],
			posen: [{ id, schluessel: `_figuren/${id}.png`, strich: false }],
		});
		const bibliothek = [...EINGEBAUTE, figur('fridolin', 'Fridolin'), figur('pelle', 'Pelle')];
		for (const id of ['fridolin', 'pelle']) {
			await writeFile(path.join(dir, '_figuren', `${id}.png`), TEST_PNG);
		}
		const fridolin = { name: 'Fridolin', rolle: 'Fuchs', aussehen: '', herkunft: 'neu' as const };
		assert.deepEqual(referenzFiguren([fridolin], [], bibliothek), []);
		const pelle = { ...fridolin, name: 'Pelle', herkunft: 'bibliothek:pelle' as const };
		const genannt = referenzFiguren([fridolin, pelle], [], bibliothek);
		assert.deepEqual(
			genannt.map((f) => f.id),
			['pelle'],
		);
		const [erste] = genannt;
		assert.ok(erste);
		const referenz = await grundposeReferenz(dir, erste);
		assert.equal(referenz?.datei, path.join(dir, '_figuren', 'pelle.png'));
		assert.deepEqual(
			referenzFiguren([pelle], ['willi'], bibliothek).map((f) => f.id),
			['willi', 'pelle'],
		);
		assert.deepEqual(referenzFiguren([{ herkunft: 'bibliothek:gibt-es-nicht' }], [], bibliothek), []);
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
				{
					seite: 1,
					stufe: 'WARNUNG',
					text: 'Aufgabe 2 hat keine Lösung → data-l, loesung= oder, bei offener Aufgabe, ein Satz als .nur-loesung',
				},
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
	/** So viele Seitenbilder baut die Ersatz-Ansicht; über 24 prüfen getrennte Läufe (241). */
	let ansichtSeiten = 1;
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
	/** Je Lauf der Mappe: Art und `cacheTtl` aus dem Kopf der Mitschrift, dazu ob die Umgebung die Variable hatte (265). */
	const cacheJeLauf = async (mappe: string) => {
		const ordner = path.join(server.materialDir, MITSCHRIFT_ORDNER, mappe);
		const roh = await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8');
		const zahl = (JSON.parse(roh) as LaufProtokoll).laeufe.length;
		let dateien: string[] = [];
		await warte(async () => {
			dateien = await readdir(ordner).catch(() => []);
			return dateien.length === zahl && dateien.every((n) => n.endsWith('.jsonl.gz'));
		});
		const aufrufe = await jsonl<{ args: string[]; env: string[] }>('aufrufe.jsonl');
		return Promise.all(
			dateien.map(async (n) => {
				const kopf = (await leseMitschrift(path.join(ordner, n)))[0] ?? {};
				const args = JSON.stringify(kopf.argumente);
				const env = aufrufe
					.filter((a) => JSON.stringify(a.args) === args)
					.map((a) => a.env.includes(CACHE_TTL_VARIABLE));
				return { art: String(kopf.art), cacheTtl: kopf.cacheTtl, env: [...new Set(env)] };
			}),
		);
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
				// 244: dazu eine Lösungsseite; nur der Fachblick (und Rollen mit Kind) bekommt sie in seinen Ordner.
				const bilder = [
					...Array.from({ length: ansichtSeiten }, (_, i) => `seite-${i + 1}.png`),
					'loesung-seite-1.png',
				];
				for (const b of bilder) {
					await writeFile(path.join(ziel, b), await readFile(quelle));
				}
				return { bericht: pruefbericht, bilder };
			},
		});
	});

	after(async () => {
		process.env.HOME = altHome;
		await server.stop();
	});

	afterEach(async () => {
		pruefbericht = { seiten: [], meldungen: [], fehler: 0 };
		ansichtSeiten = 1;
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

	it('Ohne Bilder keine Bildwerkzeuge; mit Bildern die eigenen, Konnektoren gesperrt (237)', async () => {
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
		assert.ok(!ohne.join(' ').includes(WERKZEUG_BILD_ERZEUGEN));
		assert.ok(!ohne.includes('--settings'));
		const { id } = await starte({ ...ANGABEN, bilder: true });
		await bis(id, 'fertig');
		const mit = (await aufrufe()).at(-1) ?? [];
		const erlaubt = mit.slice(mit.indexOf('--allowedTools') + 1, mit.indexOf('--disallowedTools'));
		assert.ok(mit.includes('--settings'));
		assert.ok(mit.includes('--strict-mcp-config'));
		assert.ok(erlaubt.includes(WERKZEUG_BILD_ERZEUGEN), erlaubt.join(' '));
		assert.ok(erlaubt.includes(WERKZEUG_BILD_BEARBEITEN), erlaubt.join(' '));
		// Canva steht nur in der Sperre, nie unter den erlaubten Werkzeugen.
		assert.ok(!erlaubt.some((w) => /canva/i.test(w)), erlaubt.join(' '));
		const sperre = JSON.parse(mit[mit.indexOf('--settings') + 1] ?? '{}') as {
			allowedMcpServers?: unknown[];
			deniedMcpServers?: unknown[];
		};
		assert.deepEqual(sperre.allowedMcpServers, [{ serverName: 'schoolbox' }]);
		assert.ok((sperre.deniedMcpServers ?? []).length > 0);
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

	describe('Plan-Prüfung vor der Freigabe (247)', () => {
		const planen = async () => {
			const vorher = (await prompts()).length;
			const pruefVorher = (await jsonl('plan-pruefungen.jsonl')).length;
			const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) });
			const { id, mappe } = (await antwort.json()) as { id: string; mappe: string };
			const s = await bis(id, 'plan');
			const laeufe = await jsonl<{ dateien: string[]; auftrag: string; eingabe: string }>(
				'plan-pruefungen.jsonl',
			);
			return { id, mappe, s, neu: (await prompts()).slice(vorher), pruefungen: laeufe.slice(pruefVorher) };
		};
		const rueckrunden = (neu: string[]) => neu.filter((p) => p.startsWith('Korrekturrunde zum Plan'));
		const protokoll = async (mappe: string) =>
			JSON.parse(
				await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8'),
			) as LaufProtokoll;
		const pruefOrdner = (id: string) =>
			path.join(einheitenWurzel(server.materialDir), `einheit-${id}`, 'pruefung-plan');

		it('Ohne Befund: ein Prüflauf mit Plan und Recherche, keine Rückrunde, der Stand ohne Punkte', async () => {
			await fall('einheit');
			const { id, mappe, neu, pruefungen, s } = await planen();
			assert.equal(pruefungen.length, 1);
			assert.deepEqual(pruefungen[0]?.dateien, ['einheit.json', 'recherche.md']);
			assert.equal(pruefungen[0]?.auftrag, 'einheit-plan-pruefung.md');
			assert.match(pruefungen[0]?.eingabe ?? '', /^Plan-Prüfung der Einheit/);
			assert.match(pruefungen[0]?.eingabe ?? '', /unterrichtsplanung\/SKILL\.md$/m);
			assert.deepEqual(rueckrunden(neu), []);
			assert.deepEqual(s.planPruefung, { pruefung: 'fertig', grund: null, punkte: [], geaendert: false });
			assert.equal(s.planSchritt, undefined);
			assert.ok(!existsSync(pruefOrdner(id)));
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung');
			assert.deepEqual(
				e.map((x) => [x.material, x.hinweis, x.ergebnis]),
				[[null, 'Plan-Prüfung.', 'fertig']],
			);
			const verbrauch = (await readFile(path.join(server.materialDir, VERBRAUCH_DATEI), 'utf8'))
				.trim()
				.split('\n');
			assert.ok(verbrauch.some((z) => (JSON.parse(z) as { lauf?: string }).lauf === 'plan-pruefung'));
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Befunde gehen in genau eine Rückrunde; behoben und offen stehen im Stand, der Block nicht im Plan', async () => {
			await fall('einheit-plan-befund');
			const { id, neu, s } = await planen();
			const runde = rueckrunden(neu);
			assert.equal(runde.length, 1);
			assert.match(runde[0] ?? '', /^1\. Stunde 2, Aufbau der Reihe: Die Lernzielkontrolle prüft/m);
			assert.match(runde[0] ?? '', /^2\. Figuren, Aufbau der Reihe: Die Leitfigur fehlt\.$/m);
			assert.match(runde[0] ?? '', /"geprueft"/);
			assert.equal(s.status, 'plan');
			assert.match(s.planText ?? '', /Korrigierter Plan/);
			assert.doesNotMatch(s.planText ?? '', /geprueft/);
			assert.deepEqual(
				s.planPruefung?.punkte.map((p) => [p.von, p.stand, p.wo, p.antwort]),
				[
					['pruefung', 'behoben', 'Stunde 2', 'Aufgabe ergänzt.'],
					['pruefung', 'offen', 'Figuren', 'Bleibt so, der Auftrag will es.'],
				],
			);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Nach „Ändern …“ keine neue Prüfung: die Befunde bleiben, als vor der Änderung markiert; Freigabe baut', async () => {
			await fall('einheit-plan-befund');
			const { id } = await planen();
			const vorher = (await jsonl('plan-pruefungen.jsonl')).length;
			const wunsch = JSON.stringify({ aenderung: 'Lieber eine Schatzsuche.' });
			assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: wunsch })).status, 200);
			await warte(async () => /Geänderter Plan/.test((await stand(id)).planText ?? ''));
			const s = await bis(id, 'plan');
			assert.equal((await jsonl('plan-pruefungen.jsonl')).length, vorher);
			assert.equal(s.planPruefung?.geaendert, true);
			assert.equal(s.planPruefung?.punkte.filter((p) => p.von === 'pruefung').length, 2);
			assert.equal((await api(`/einheiten/${id}/freigeben`, { method: 'POST', body: '{}' })).status, 200);
			await bis(id, 'fertig');
		});

		it('Scheitert die Prüfung, kommt der Plan trotzdem, mit Hinweis; keine Rückrunde', async () => {
			await fall('einheit-plan-scheitert');
			const { id, neu, s } = await planen();
			assert.equal(s.status, 'plan');
			assert.match(s.planText ?? '', /Zwei Fälle/);
			assert.deepEqual(rueckrunden(neu), []);
			assert.equal(s.planPruefung?.pruefung, 'gescheitert');
			assert.ok(s.planPruefung?.grund);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Scheitert die Rückrunde, bleibt der erste Plan, die Befunde offen', async () => {
			await fall('einheit-plan-befund-rueckrunde-scheitert');
			const { id, s } = await planen();
			assert.equal(s.status, 'plan');
			assert.match(s.planText ?? '', /Zwei Fälle/);
			assert.doesNotMatch(s.planText ?? '', /Korrigierter/);
			assert.deepEqual(
				s.planPruefung?.punkte.map((p) => p.stand),
				['offen', 'offen'],
			);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Regel mit 263 Zeichen: Meldung in der Rückrunde, danach ist die Regel geteilt und kurz genug (263)', async () => {
			await fall('einheit-kanon-lang');
			const { id, neu, s } = await planen();
			const runde = rueckrunden(neu);
			assert.equal(runde.length, 1);
			assert.match(runde[0] ?? '', /Kanon, Regel 1 \(„Die Uhr im Rathaus hat ein rundes…“\) hat 263 Zeichen, höchstens 200: teile sie/);
			assert.deepEqual(neu.filter((p) => p.startsWith('Korrekturrunde zum Kanon')), []);
			assert.equal(s.status, 'plan');
			assert.equal(s.plan?.kanon?.regeln.length, 2);
			assert.ok(s.plan?.kanon?.regeln.every((r) => r.length <= KANON_GRENZEN.regel && !r.endsWith('…')));
			assert.deepEqual(s.planBefunde, []);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Bleibt die Regel zu lang: eine kurze Kanon-Runde, dann gekürzt mit „…“ und als Befund im Stand (263)', async () => {
			await fall('einheit-kanon-stur');
			const { id, neu, s } = await planen();
			assert.equal(rueckrunden(neu).length, 1);
			const kanon = neu.filter((p) => p.startsWith('Korrekturrunde zum Kanon'));
			assert.equal(kanon.length, 1);
			assert.match(kanon[0] ?? '', /^- Kanon, Regel 1 .* hat 263 Zeichen/m);
			assert.doesNotMatch(kanon[0] ?? '', /Stunde|"geprueft"/);
			assert.equal(s.status, 'plan');
			assert.match(s.planText ?? '', /Korrigierter Plan/);
			const regel = s.plan?.kanon?.regeln[0] ?? '';
			assert.ok(regel.length <= KANON_GRENZEN.regel && regel.endsWith('…'), regel);
			assert.equal(s.planBefunde?.length, 1);
			assert.match(s.planBefunde?.[0] ?? '', /hat 263 Zeichen/);
			await api(`/einheiten/${id}/verwerfen`, { method: 'POST' });
		});

		it('Abbrechen beendet die Prüfung; ohne Stand der Prüfung, der Ordner ist weg', async () => {
			await fall('einheit-plan-haenger');
			const antwort = await api('/einheiten', { method: 'POST', body: JSON.stringify({ angaben: ANGABEN }) });
			const { id } = (await antwort.json()) as { id: string };
			await warte(async () => (await stand(id)).planSchritt === 'pruefung');
			await warte(() => existsSync(path.join(pruefOrdner(id), 'einheit.json')));
			await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
			const s = await bis(id, 'unvollstaendig');
			assert.equal(s.planPruefung, undefined);
			assert.equal(s.planSchritt, undefined);
			await warte(() => !existsSync(pruefOrdner(id)));
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
			// 246: Ein Plan ohne Kanon (Einheiten davor) bekommt keinen und führt nichts nach.
			assert.equal(s.plan.kanon, undefined);
			assert.ok(neu.every((p) => !p.includes('Kanon')));
			assert.equal(s.kanonNachtrag, undefined);
			assert.equal(s.steckbriefe?.['fall-2']?.widerspruch, undefined);
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
				['plan', 'pruefung', 'bau', 'pruefung', 'pruefung', 'bau', 'pruefung', 'pruefung', 'schluss'],
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
			assert.deepEqual(
				p.laeufe.filter((e) => e.art === 'pruefung').map((e) => e.rolle ?? e.hinweis),
				['Plan-Prüfung.', 'kind', 'fach', 'kind', 'fach'],
			);
			assert.doesNotMatch(roh, /Auftrag der Lehrkraft|Schritt 2|Uhrzeit|Zur Klasse/);
		});

		it('Mitschrift: je Lauf eine gepackte Datei mit dem Auftrag, in der Ablage statt im Temp-Ordner (233)', async () => {
			await fall('einheit');
			const { id, mappe } = await starte();
			await bis(id, 'fertig');
			const p = await protokoll(mappe);
			const ordner = path.join(server.materialDir, MITSCHRIFT_ORDNER, mappe);
			let dateien: string[] = [];
			for (let i = 0; i < 250; i += 1) {
				dateien = await readdir(ordner).catch(() => []);
				if (dateien.length === p.laeufe.length && dateien.every((n) => n.endsWith('.jsonl.gz'))) {
					break;
				}
				await new Promise((r) => setTimeout(r, 20));
			}
			assert.equal(dateien.length, p.laeufe.length);
			const arten = dateien.map((n) => n.replace(/^[\dT-]+Z-/, '').replace(/\.jsonl\.gz$/, ''));
			const slugs = (await baulaeufe(mappe)).map((e) => e.material);
			for (const art of [
				'einheit-plan',
				'einheit-plan-pruefung',
				'einheit-schluss',
				...slugs.map((s) => `einheit-bau-${s ?? ''}`),
			]) {
				assert.ok(arten.includes(art), `${art} fehlt in ${arten.join(', ')}`);
			}
			const plan = dateien.find((n) => n.endsWith('-einheit-plan.jsonl.gz')) ?? '';
			const zeilen = await leseMitschrift(path.join(ordner, plan));
			assert.match(String(zeilen[0]?.auftrag), /Auftrag der Lehrkraft/);
			assert.equal(zeilen.at(-1)?.typ, 'ende');
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

		it('Prompt-Cache 5 min nur für Kinderaugen, Fachblick und Plan-Prüfung, nicht für Bau und Korrektur (265)', async () => {
			await fall('einheit-unklar');
			const { id, mappe } = await starte();
			await bis(id, 'fertig');
			const laeufe = await cacheJeLauf(mappe);
			const kurz = ['einheit-pruefung', 'einheit-fachblick', 'einheit-plan-pruefung'];
			for (const art of [...kurz, 'einheit-plan', 'einheit-bau', 'einheit-korrektur', 'einheit-schluss']) {
				assert.ok(
					laeufe.some((l) => l.art === art),
					`${art} fehlt in ${laeufe.map((l) => l.art).join(', ')}`,
				);
			}
			for (const l of laeufe) {
				const mit = kurz.includes(l.art);
				assert.equal(l.cacheTtl, mit ? '5m' : null, l.art);
				assert.deepEqual(l.env, [mit], l.art);
			}
		});

		it('Abweichung vom Kanon im Steckbrief: einmal ein Befund kanon in der Korrekturrunde, der Rest an den Schluss (264)', async () => {
			await fall('einheit-kanon-widerspruch');
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.ok(s.plan?.kanon);
			assert.deepEqual(await arten(mappe), [
				'plan:',
				'pruefung:',
				'bau:fall-1',
				'pruefung:fall-1',
				'pruefung:fall-1',
				'korrektur:fall-1',
				'pruefung:fall-1',
				'pruefung:fall-1',
				'bau:fall-2',
				'pruefung:fall-2',
				'pruefung:fall-2',
				'schluss:_schluss',
			]);
			const satz = 'Kapitel 1: Willi trägt die Uhr nach Hause, laut Kanon hängt sie bis Kapitel 2 im Rathaus.';
			const neu = (await prompts()).slice(vorher);
			const runde = nachPruefung(neu);
			assert.equal(runde.length, 1);
			assert.ok(runde[0]?.includes(`- Widerspricht der Geschichte: Dein Steckbrief meldet: ${satz}`));
			assert.match(runde[0] ?? '', /Es gilt der Kanon aus deinem Auftrag/);
			assert.equal(s.pruefung?.['fall-1']?.korrekturen, 1);
			assert.equal(s.pruefung?.['fall-2']?.korrekturen, 0);
			// Die Korrektur behält die Abweichung: Sie kommt nicht noch einmal, der Schlusslauf sieht sie.
			assert.deepEqual(s.steckbriefe?.['fall-1']?.widerspruch, [satz]);
			const schluss = neu.find((p) => p.startsWith('Schritt 3: der Schlusslauf')) ?? '';
			assert.ok(schluss.includes(`- dokumente/fall-1: ${satz}`));
		});

		it('Unklare Anweisung: der Prüflauf meldet sie, eine Korrekturrunde in der Sitzung des Baus, dann sauber', async () => {
			await fall('einheit-unklar');
			const vorher = (await prompts()).length;
			const laeufeVorher = (await jsonl('laeufe.jsonl')).length;
			const pruefVorher = (await jsonl('pruefungen.jsonl')).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(await arten(mappe), [
				'plan:',
				'pruefung:',
				'bau:fall-1',
				'pruefung:fall-1',
				'pruefung:fall-1',
				'korrektur:fall-1',
				'pruefung:fall-1',
				'pruefung:fall-1',
				'bau:fall-2',
				'pruefung:fall-2',
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
			// Der Prüflauf sieht den Bau nicht: nur die Seiten, Klasse, Fach und den Auftrag (241), beim Arbeitsblatt die
			// Lösung nach Teil 1 (229). Der Fachblick daneben sieht die Lösung, in seinem eigenen Ordner (244).
			// Lösungsseiten nie lose im Ordner, nur unter loesung/ (229).
			const pruefungen = (
				await jsonl<{
					titel: string;
					rolle: string;
					loesungLose: boolean;
					loesungOrdner: boolean;
					kind: boolean;
				}>('pruefungen.jsonl')
			).slice(pruefVorher);
			assert.deepEqual(
				pruefungen
					.filter((x) => x.rolle === 'kind')
					.map((x) => [x.titel, x.loesungLose, x.loesungOrdner, x.kind]),
				[
					['Fall 1', false, true, true],
					['Fall 1', false, true, true],
					['Fall 2', false, true, true],
				],
			);
			assert.deepEqual(
				pruefungen.filter((x) => x.rolle === 'fach').map((x) => [x.titel, x.loesungLose, x.loesungOrdner]),
				[
					['Fall 1', false, true],
					['Fall 1', false, true],
					['Fall 2', false, true],
				],
			);
			const fachPrompt = neu.find((x) => x.startsWith('Fachblick auf „Fall 1“')) ?? '';
			assert.match(fachPrompt, /Klasse 2, Mathematik/);
			assert.match(fachPrompt, /- loesung\/loesung-seite-1\.png/);
			assert.match(fachPrompt, /Ich-kann-Ziele/);
			const pruefPrompt = neu.find((x) => x.startsWith('Prüfung von „Fall 1“')) ?? '';
			assert.match(pruefPrompt, /Klasse 2, Mathematik/);
			assert.match(
				pruefPrompt,
				/Auftrag der Lehrkraft \(aus dem Assistenten\):\nErstelle eine Unterrichtseinheit/,
			);
			assert.doesNotMatch(pruefPrompt, /Rätselkette|Schritt 2|Prüflauf 1 von/);
			assert.doesNotMatch(await quelle(s, mappe, 'fall-1'), /Mach was mit den Uhren/);
			const e = (await protokoll(mappe)).laeufe.find((x) => x.art === 'pruefung' && x.material !== null);
			assert.match(e?.befunde[0] ?? '', /Was mit den Uhren/);
		});

		it('Maße aus dem Bau gehen an den Prüflauf mit Kinderaugen, nicht an den Fachblick (249)', async () => {
			pruefbericht = {
				seiten: [],
				meldungen: [],
				fehler: 0,
				felder: [{ seite: 1, aufgabe: 'A3', art: 'leer', anzahl: 3, breite: 11, hoehe: 24 }],
			};
			const vorher = (await prompts()).length;
			const { id } = await starte();
			await bis(id, 'fertig');
			const neu = (await prompts()).slice(vorher);
			const kind = neu.find((x) => x.startsWith('Prüfung von „Fall 1“')) ?? '';
			assert.match(
				kind,
				/\n\nGemessen beim Bau \(Breite × Höhe\): [^\n]+\n- S\. 1, A3: drei leere Felder je 1,1 × 2,4 cm\n\n/,
			);
			const fach = neu.find((x) => x.startsWith('Fachblick auf „Fall 1“')) ?? '';
			assert.ok(fach);
			assert.doesNotMatch(fach, /Gemessen beim Bau/);
		});

		it('Ein Material über 24 Seiten prüfen zwei Läufe nacheinander, je mit Eintrag im Protokoll (241)', async () => {
			ansichtSeiten = 30;
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.equal(s.pruefung?.['fall-1']?.status, 'fertig');
			assert.equal(s.pruefung?.['fall-1']?.runden, 1);
			const neu = (await prompts()).slice(vorher).filter((x) => x.startsWith('Prüfung von „Fall 1“'));
			assert.equal(neu.length, 2);
			assert.match(neu[0] ?? '', /Prüflauf 1 von 2: Das Material hat 30 Seiten, du prüfst die Seiten 1–16\./);
			assert.match(neu[1] ?? '', /Prüflauf 2 von 2: .*Seiten 17–30\. Die Seiten 1–16 prüft ein anderer Lauf/);
			assert.match(neu[1] ?? '', /- seite-30\.png/);
			assert.doesNotMatch(neu[1] ?? '', /- seite-16\.png/);
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung' && x.material === 'fall-1');
			assert.deepEqual(
				e.filter((x) => x.rolle === 'kind').map((x) => x.hinweis),
				['Prüflauf 1 von 2, Seiten 1–16 von 30.', 'Prüflauf 2 von 2, Seiten 17–30 von 30.'],
			);
			assert.ok(e.filter((x) => x.rolle === 'fach').length >= 2);
			assert.ok(e.every((x) => x.ergebnis === 'fertig' && x.kostenUsd !== null));
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
			assert.equal((await arten(mappe)).filter((a) => a === 'pruefung:fall-1').length, 6);
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
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung' && x.material !== null);
			assert.equal(e.length, 4);
			assert.ok(e.every((x) => /keinen lesbaren Block/.test(x.hinweis ?? '')));
		});

		it('Scheitert der Prüflauf, bleibt das Material und der Bau geht weiter', async () => {
			await fall('einheit-pruefung-scheitert');
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			assert.deepEqual(Object.keys(s.importiert).sort(), ['fall-1', 'fall-2']);
			assert.equal(s.pruefung?.['fall-1']?.status, 'gescheitert');
			assert.ok(s.pruefung?.['fall-1']?.grund);
			assert.equal(s.schluss?.status, 'fertig');
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung' && x.material !== null);
			assert.equal(e.length, 4);
			assert.ok(e.every((x) => x.ergebnis !== 'fertig'));
		});

		it('Doppelte Abbildung: der Server meldet sie dem zweiten Material und dem Schlusslauf', async () => {
			await fall('einheit-dopplung');
			const vorher = (await prompts()).length;
			const gebaut = (await jsonl('bauen.jsonl')).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			// 226: Das Gitter verlangt seine Teil-Datei; die Attrappe liest sie nach der Abweisung und baut dann.
			const antworten = (await jsonl<{ slug: string; text?: string; fehler?: boolean }>('bauen.jsonl')).slice(
				gebaut,
			);
			assert.equal(antworten[0]?.slug, 'fall-1');
			assert.equal(antworten[0]?.fehler, true);
			assert.match(antworten[0]?.text ?? '', /^Nicht gebaut: Du verwendest <x-gitter>\./);
			assert.match(
				antworten[0]?.text ?? '',
				/^- Read html-materialerstellung\/references\/abbildungen\/mathe-geometrie\.md$/m,
			);
			assert.equal(antworten[1]?.slug, 'fall-1');
			assert.notEqual(antworten[1]?.fehler, true);
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
			// 272: Der Schlusslauf nennt für ein Material mit <x-gitter> dieselbe Datei, die bauen verlangt.
			assert.match(schluss, /^- fall-1: .*Read html-materialerstellung\/references\/abbildungen\/mathe-geometrie\.md/m);
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

		it('271: Quellen bekommen die Bildliste; eine fremde Datei und eine falsche Herkunft meldet der Server', async () => {
			await fall('einheit-quellen');
			const vorher = (await prompts()).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			const neu = (await prompts()).slice(vorher);
			const bau = neu.find((p) => p.startsWith('Schritt 2: der Bau von dokumente/quellen/')) ?? '';
			assert.match(bau, /Bildliste der Schoolbox/);
			assert.match(bau, /^- uhr\.png: Herkunft unbekannt; in fall-1 S\. 1$/m);
			const fall1 = neu.find((p) => p.startsWith('Schritt 2: der Bau von dokumente/fall-1/')) ?? '';
			assert.doesNotMatch(fall1, /Bildliste der Schoolbox/);
			const server = s.pruefung?.quellen?.server ?? [];
			assert.match(server.join(' '), /„Quellen“ nennt für uhr\.png eine andere Herkunft/);
			assert.match(server.join(' '), /„Quellen“ nennt fremd\.png; diese Datei verwendet kein Material/);
			const schluss = neu.find((p) => p.startsWith('Schritt 3: der Schlusslauf')) ?? '';
			assert.match(schluss, /Bildliste der Schoolbox/);
			assert.match(schluss, /^- Bilder: nur nach der Bildliste der Schoolbox/m);
			assert.doesNotMatch(schluss, /Bilder unter bilder\//);
			assert.match(s.schluss?.server.join(' ') ?? '', /„Quellen“ nennt fremd\.png/);
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

		it('Scheitert nur der Fachblick, zählen die Befunde mit Kinderaugen; das Scheitern steht im Stand (244)', async () => {
			await fall('einheit-fachblick-scheitert');
			const vorher = (await prompts()).length;
			const { id, mappe } = await starte();
			const s = await bis(id, 'fertig');
			const p = s.pruefung?.['fall-1'];
			assert.equal(p?.status, 'fertig');
			assert.equal(p?.korrekturen, 1);
			assert.deepEqual(
				p?.gefunden.map((b) => b.art),
				['unklar'],
			);
			assert.match(p?.luecke ?? '', /^Fachblick gescheitert: /);
			assert.match(nachPruefung((await prompts()).slice(vorher))[0] ?? '', /Was mit den Uhren zu tun ist/);
			const e = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'pruefung' && x.material === 'fall-1');
			assert.ok(e.some((x) => x.rolle === 'fach' && x.ergebnis !== 'fertig'));
			assert.ok(e.some((x) => x.rolle === 'kind' && x.ergebnis === 'fertig'));
		});

		it('Befund des Fachblicks ohne art zählt als fachlich und bleibt als „fachlich prüfen“ offen (244)', async () => {
			await fall('einheit-fachfehler');
			const vorher = (await prompts()).length;
			const { id } = await starte();
			const s = await bis(id, 'fertig');
			const p = s.pruefung?.['fall-1'];
			assert.deepEqual(
				p?.gefunden.map((b) => [b.aufgabe, b.art]),
				[['Differenzierung', 'fach']],
			);
			assert.match(
				nachPruefung((await prompts()).slice(vorher))[0] ?? '',
				/Fachlich falsch: Die Uhr zeigt nicht/,
			);
			assert.ok(p && fachlichOffen(p).length === 1);
		});

		it('Reicht das Budget nur für einen Prüflauf, startet der zweite nicht und nur er scheitert (244)', async () => {
			const runden = KI_GRENZEN.einheit.pruefung.runden;
			// Der erste Lauf reserviert alle übrigen Runden der Einheit.
			KI_GRENZEN.einheit.pruefung.runden = KI_GRENZEN.einheit.runden;
			try {
				const pruefVorher = (await jsonl('pruefungen.jsonl')).length;
				const { id } = await starte();
				const s = await bis(id, 'fertig');
				const pruefungen = (await jsonl<{ rolle: string }>('pruefungen.jsonl')).slice(pruefVorher);
				assert.deepEqual(
					pruefungen.map((x) => x.rolle),
					['kind', 'kind'],
				);
				assert.equal(s.pruefung?.['fall-1']?.status, 'fertig');
				assert.match(s.pruefung?.['fall-1']?.luecke ?? '', /^Fachblick gescheitert: .*Schritte ausgeschöpft/);
			} finally {
				KI_GRENZEN.einheit.pruefung.runden = runden;
			}
		});

		/** Je Lauf mit dieser Auftragsdatei das Budget, das er per `--max-budget-usd` bekam. */
		const budgets = async (auftrag: string, vorher: number) =>
			(await jsonl<{ args: string[] }>('aufrufe.jsonl'))
				.slice(vorher)
				.map((a) => a.args)
				.filter((a) => path.basename(a[a.indexOf('--append-system-prompt-file') + 1] ?? '') === auftrag)
				.map((a) => Number(a[a.indexOf('--max-budget-usd') + 1]));

		it('Knappes Budget: der Schluss startet mit mindestens der Reserve, der Bau davor bekommt sie weniger (262)', async () => {
			const e = KI_GRENZEN.einheit;
			const alt = { budget: e.budgetUsd, reserve: e.schluss.reserveUsd };
			e.budgetUsd = 10;
			e.schluss.reserveUsd = 4;
			try {
				const vorher = (await jsonl('aufrufe.jsonl')).length;
				const { id } = await starte();
				const s = await bis(id, 'fertig');
				assert.equal(s.schluss?.status, 'fertig');
				const bau = await budgets('einheit-material.md', vorher);
				const schluss = await budgets('einheit-schluss.md', vorher);
				assert.ok(bau.length >= 2, bau.join(', '));
				assert.ok(
					bau.every((b) => b > 5 && b <= 6),
					`Bau ohne die Reserve: ${bau.join(', ')}`,
				);
				assert.equal(schluss.length, 1);
				assert.ok((schluss[0] ?? 0) >= 9, `Schluss mit der Reserve: ${schluss.join(', ')}`);
			} finally {
				e.budgetUsd = alt.budget;
				e.schluss.reserveUsd = alt.reserve;
			}
		});

		it('Restbudget unter einer Prüfrunde: die letzte entfällt, die Befunde der Runde davor im Schlussauftrag (262)', async () => {
			const k = KI_GRENZEN.einheit.pruefung;
			const alt = k.rundeUsd;
			k.rundeUsd = { kind: 1000, fach: 1000 };
			try {
				await fall('einheit-stur');
				const vorher = (await prompts()).length;
				const { id, mappe } = await starte();
				const s = await bis(id, 'fertig');
				const p = s.pruefung?.['fall-1'];
				assert.equal(p?.runden, 2);
				assert.equal(p?.korrekturen, 2);
				assert.equal(p?.ohneLetzteRunde, true);
				assert.equal(p?.offen[0]?.art, 'unklar');
				assert.equal((await arten(mappe)).filter((a) => a === 'pruefung:fall-1').length, 4);
				const korrektur = (await protokoll(mappe)).laeufe.filter((x) => x.art === 'korrektur').at(-1);
				assert.match(korrektur?.hinweis ?? '', /letzte Prüfrunde entfiel/);
				const schluss = (await prompts()).slice(vorher).find((t) => t.startsWith('Schritt 3: der Schlusslauf'));
				assert.match(
					schluss ?? '',
					/Was die Prüfläufe offen ließen:\n- fall-1 \(vor der letzten Korrektur gefunden, nicht mehr geprüft\): Seite 1, Aufgabe 1/,
				);
			} finally {
				k.rundeUsd = alt;
			}
		});

		it('Am Budget des Durchgangs: der Hinweis nennt, was fehlt, ohne Beträge; Weiterbauen baut es (262)', async () => {
			const e = KI_GRENZEN.einheit;
			const alt = { budget: e.budgetUsd, reserve: e.schluss.reserveUsd };
			e.budgetUsd = 3.4;
			e.schluss.reserveUsd = 3;
			let id = '';
			try {
				id = (await starte()).id;
				const s = await bis(id, 'unvollstaendig');
				assert.deepEqual(s.importiert, {});
				assert.equal(
					s.grund,
					'Das Budget der Einheit ist aufgebraucht. Noch offen: 2 Materialien und der Abgleich der ganzen Einheit. ‚Weiterbauen‘ startet einen neuen Durchgang mit eigenem Budget.',
				);
				assert.doesNotMatch(s.grund ?? '', /USD|\$|\d+,\d/);
			} finally {
				e.budgetUsd = alt.budget;
				e.schluss.reserveUsd = alt.reserve;
			}
			assert.equal((await api(`/einheiten/${id}/weiter`, { method: 'POST' })).status, 200);
			const t = await bis(id, 'fertig');
			assert.equal(t.grund, null);
			assert.equal(t.schluss?.status, 'fertig');
		});

		const lebt = (pid: number) =>
			existsSync(`/proc/${pid}`) && !/^State:\s+Z/m.test(readFileSync(`/proc/${pid}/status`, 'utf8'));

		it('Kinderaugen und Fachblick gleichzeitig: Abbrechen beendet beide, beide Prüfordner sind weg (244)', async () => {
			await fall('einheit-pruefung-haenger');
			const { id } = await starte();
			const einheit = path.join(einheitenWurzel(server.materialDir), `einheit-${id}`);
			const pidDatei = path.join(einheit, 'pid');
			let pids: number[] = [];
			await warte(() => {
				pids = existsSync(pidDatei)
					? readFileSync(pidDatei, 'utf8').split('\n').filter(Boolean).map(Number)
					: [];
				return pids.length === 2;
			});
			assert.ok(pids.every(lebt));
			assert.ok(existsSync(path.join(einheit, 'pruefung')));
			assert.ok(existsSync(path.join(einheit, 'pruefung-fach', 'loesung')));
			await api(`/einheiten/${id}/abbrechen`, { method: 'POST' });
			const s = await bis(id, 'unvollstaendig');
			await warte(() => !pids.some(lebt));
			assert.ok(!existsSync(path.join(einheit, 'pruefung')));
			assert.ok(!existsSync(path.join(einheit, 'pruefung-fach')));
			assert.equal(s.pruefung?.['fall-1']?.status, 'abgebrochen');
		});

		it('Beim Start: beide verwaisten Prüfläufe aus der PID-Datei werden beendet (244)', async () => {
			const einheit = path.join(einheitenWurzel(server.materialDir), 'einheit-verwaist244');
			await mkdir(einheit, { recursive: true });
			const kinder = [0, 1].map(() =>
				spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', einheit], { stdio: 'ignore' }),
			);
			const pids = kinder.map((k) => k.pid ?? 0);
			await writeFile(path.join(einheit, 'pid'), `${pids.join('\n')}\n`);
			assert.ok(pids.every(lebt));
			await server.kontext.einheiten.beendeReste();
			await warte(() => kinder.every((k) => k.exitCode !== null || k.signalCode !== null));
			assert.deepEqual(
				kinder.map((k) => k.signalCode),
				['SIGTERM', 'SIGTERM'],
			);
			await rm(einheit, { recursive: true, force: true });
		});
	});

	describe('Neue KI-Bilder der Einheit (237)', () => {
		const MIT_BILDERN = { ...ANGABEN, bilder: true };
		const bilderLaeufe = async (mappe: string) => {
			const roh = await readFile(path.join(mappenDir(server.materialDir, mappe), LAUF_DATEI), 'utf8');
			return (JSON.parse(roh) as LaufProtokoll).laeufe.filter((e) => e.art === 'bilder');
		};
		const bildAufrufe = () => jsonl<{ argumente: { datei: string }; fehler?: boolean }>('bild.jsonl');

		it('Bilder-Lauf erzeugt ein Bild zweimal: einmal geladen, auch mit einem Takt mitten im Lauf; Kosten in der Mitschrift', async () => {
			await fall('einheit-bild');
			const vorher = (await bildAufrufe()).length;
			const { id, mappe } = await starte(MIT_BILDERN);
			const s = await bis(id, 'fertig');
			assert.equal(s.bilderFertig, true);
			assert.equal(s.geladeneBilder, 1, 'dieselbe Datei zählt einmal, der Takt zählt nichts doppelt');
			assert.equal(s.fehlgeschlageneBilder, 0);
			const aufrufe = (await bildAufrufe()).slice(vorher);
			assert.equal(aufrufe.length, 2);
			assert.ok(aufrufe.every((a) => a.fehler !== true && a.argumente.datei === 'uhr-gross.png'));
			assert.ok(
				existsSync(
					path.join(
						einheitenWurzel(server.materialDir),
						`einheit-${id}`,
						'arbeit',
						'bilder',
						'uhr-gross.png',
					),
				),
			);
			assert.deepEqual(
				(await bilderLaeufe(mappe)).map((e) => e.ergebnis),
				['fertig'],
			);
			// Die Mitschrift des Bilder-Laufs: Ihre Ende-Zeile nennt Aufrufe und Kosten der Bild-API dieses Laufs.
			const ordner = path.join(server.materialDir, MITSCHRIFT_ORDNER, mappe);
			let bilderZeile: Record<string, unknown> | undefined;
			await warte(async () => {
				for (const n of (await readdir(ordner).catch(() => [])).filter((d) => d.endsWith('.jsonl.gz'))) {
					const ende = (await leseMitschrift(path.join(ordner, n))).at(-1);
					if (ende?.typ === 'ende' && (ende.bilder as { aufrufe?: number } | undefined)?.aufrufe) {
						bilderZeile = ende;
						return true;
					}
				}
				return false;
			});
			assert.deepEqual(bilderZeile?.bilder, { aufrufe: 2, kostenUsd: 0.02, gesperrt: false });
			// 265: Der Bilder-Lauf schreibt den Prompt-Cache mit 5 min, der Bau danach nicht.
			const laeufe = await cacheJeLauf(mappe);
			assert.deepEqual(
				laeufe.filter((l) => l.art === 'einheit-bilder').map((l) => [l.cacheTtl, l.env]),
				[['5m', [true]]],
			);
			assert.ok(laeufe.some((l) => l.art === 'einheit-bau' && l.cacheTtl === null && l.env.join() === 'false'));
		});

		it('Nach zwei neuen Bildern für denselben Befund: kein dritter, der Hinweis steht im Stand (248)', async () => {
			await fall('einheit-bild-offen');
			const vorher = (await bildAufrufe()).length;
			const { id } = await starte(MIT_BILDERN);
			const s = await bis(id, 'fertig');
			const aufrufe = (await bildAufrufe()).slice(vorher);
			assert.deepEqual(
				aufrufe.map((a) => a.fehler === true),
				[false, false, false, true],
			);
			assert.deepEqual(s.bildHinweise, [
				{ datei: 'uhr-gross.png', text: 'Die Zeiger fehlen.', von: BILDER_SCHRITT },
			]);
			const herkunft = await readFile(
				path.join(einheitenWurzel(server.materialDir), `einheit-${id}`, 'arbeit', 'bilder', BILD_HERKUNFT),
				'utf8',
			);
			assert.match(herkunft, /\toffen\tDie Zeiger fehlen\.\t[0-9a-f]{16}\n$/);
		});

		it('Sperrt OpenAI im Bilder-Lauf: unvollständig mit dem Satz, ohne Pause, ohne Material; Weiterbauen geht dort weiter', async () => {
			await fall('einheit-bild-gesperrt');
			const vorher = (await jsonl<{ erste: string }>('laeufe.jsonl')).length;
			const { id, mappe } = await starte(MIT_BILDERN);
			const s = await bis(id, 'unvollstaendig');
			assert.equal(s.grund, `${BILDER_GESPERRT} ‚Weiterbauen‘ macht bei den Bildern weiter.`);
			assert.notEqual(s.bilderFertig, true);
			assert.deepEqual(s.importiert, {});
			assert.equal((await bilderLaeufe(mappe)).length, 1, 'kein zweiter Versuch, keine Pause');
			const laeufe = (await jsonl<{ erste: string }>('laeufe.jsonl')).slice(vorher);
			assert.ok(!laeufe.some((l) => /wieder bereit/.test(l.erste)));

			await fall('einheit');
			await api(`/einheiten/${id}/weiter`, { method: 'POST' });
			const t = await bis(id, 'fertig');
			assert.equal(t.bilderFertig, true);
			assert.deepEqual(Object.keys(t.importiert).sort(), ['fall-1', 'fall-2']);
		});

		it('Figuren in die Bibliothek (253): Grundpose nach dem Bilderlauf, nur die eingebundene Pose, keine Grundpose für Kiki', async () => {
			await legeTestfigurenAn(server.materialDir);
			await fall('einheit-figur');
			const vorher = (await bildAufrufe()).length;
			const promptsVorher = (await prompts()).length;
			const { id, mappe } = await starte(MIT_BILDERN);
			const s = await bis(id, 'fertig');
			const aufrufe = (await bildAufrufe()).slice(vorher) as {
				argumente: { datei: string };
				fehler?: boolean;
				text?: string;
			}[];
			const kiki = aufrufe.find((a) => a.argumente.datei === 'kiki.png');
			assert.equal(kiki?.fehler, true);
			assert.match(JSON.stringify(kiki), /Figurenbibliothek/);
			assert.ok(aufrufe.filter((a) => a.argumente.datei !== 'kiki.png').every((a) => a.fehler !== true));
			const bilderLauf =
				(await prompts()).slice(promptsVorher).find((p) => p.includes('die Bilder der Einheit')) ?? '';
			assert.match(bilderLauf, /Posen der Figuren aus der Bibliothek/);
			assert.match(bilderLauf, /data-figur="kiki-winkt" src="\.\.\/\.\.\/bilder\/bib-kiki-winkt\.png"/);

			const figuren = await leseBibliothek({ pythonBin: 'python3' }, server.materialDir);
			const luna = figuren.find((f) => f.id === 'luna');
			assert.deepEqual(
				luna?.posen.map((p) => p.id),
				['luna', 'luna-faltet'],
			);
			assert.equal(luna?.name, 'Luna');
			assert.equal(luna?.steckbrief, 'Eule mit roter Brille');
			assert.equal(luna?.vermerk, VERMERK_GEGENSTAND, 'ohne Kanon: Lunas Laterne trägt in einer Szene Kiki');
			assert.equal(luna?.aus, s.titel);
			assert.deepEqual(
				figuren.find((f) => f.id === 'kiki')?.posen.map((p) => p.id),
				['kiki', 'kiki-winkt'],
			);
			const bilder = path.join(mappenDir(server.materialDir, mappe), 'bilder');
			assert.ok(existsSync(path.join(bilder, 'luna.png')), 'Grundpose in der Mappe, auch ohne Material');
			const bibliothek = path.join(server.materialDir, '_figuren');
			assert.deepEqual(
				await readFile(path.join(bibliothek, 'luna-faltet.png')),
				await readFile(path.join(bilder, 'luna-faltet-2.png')),
				'die eingebundene Fassung, nicht luna-faltet.png',
			);
			assert.deepEqual(s.bibliothekNeu, [
				{ id: 'luna', name: 'Luna', plan: 'Luna', figur: true, posen: ['faltet'] },
			]);
		});
	});

	it('Ohne Schlüssel für OpenAI startet eine Einheit mit Bildern ohne sie (237)', async () => {
		const ohne = await starteTestServer({ env: { CLAUDE_BIN: bin, OPENAI_API_KEY: '' } });
		try {
			const antwort = await ohne.holen(`${ohne.url}/api/einheiten`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
				body: JSON.stringify({ angaben: { ...ANGABEN, bilder: true }, ordner: null }),
			});
			assert.equal(antwort.status, 201, await antwort.clone().text());
			const { id } = (await antwort.json()) as { id: string };
			const s = (await (await ohne.holen(`${ohne.url}/api/einheiten/${id}`)).json()) as EinheitStand;
			assert.equal(s.bilder, false);
			await ohne.holen(`${ohne.url}/api/einheiten/${id}/abbrechen`, {
				method: 'POST',
				headers: { [CSRF_HEADER]: '1' },
			});
		} finally {
			await ohne.stop();
		}
	});

	it('Fremde IDs gibt es nicht', async () => {
		assert.equal((await api('/einheiten/..%2F..%2Fetc')).status, 404);
		assert.equal((await api('/einheiten/abcdefabcdef')).status, 404);
	});
});
