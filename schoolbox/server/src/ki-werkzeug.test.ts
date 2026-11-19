import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, describe, it } from 'node:test';

import type { Ansicht, Meldung } from '@schoolbox/kern';
import { baueAnsichtAus, BILD_FORMAT_NAMEN, laufMeldungen } from '@schoolbox/kern';
import { browserSkip } from '@schoolbox/kern/src/browsertest';

import type { BildWerkzeug } from './bild-werkzeug';
import type { Werkzeug, WerkzeugArt } from './ki-werkzeug';
import { ansichtText, starteWerkzeug } from './ki-werkzeug';

const ansicht = (meldungen: Meldung[]): Ansicht => ({
	bericht: { seiten: [{}], meldungen, fehler: meldungen.filter((m) => m.stufe === 'FEHLER').length },
	bilder: ['seite-1.png'],
});

describe('ansichtText: Hinweise kommen bei Claude an (225)', () => {
	it('Hinweise stehen im eigenen Block nach Fehlern und Warnungen, ohne ausgeblendet und kit-anteil', () => {
		const text = ansichtText(
			ansicht([
				{ stufe: 'HINWEIS', seite: 1, code: 'bild-unscharf', text: 'Bild „Hund“ hat im Druck nur 90 dpi' },
				{ stufe: 'FEHLER', seite: 1, code: 'rand', text: '„A“ ragt in den Seitenrand (3 px) → kürzen' },
				{ stufe: 'HINWEIS', seite: 0, code: 'ausgeblendet', text: '1 Element ist ausgeblendet' },
				{ stufe: 'HINWEIS', seite: 0, code: 'kit-anteil', text: 'Kit-Anteil 50 %' },
				{ stufe: 'HINWEIS', seite: 0, code: 'thema-klasse', text: 'thema.css: Klasse ohne Registereintrag: x' },
				{ stufe: 'WARNUNG', seite: 2, code: 'platz-frei', text: '120 px frei unten' },
			]),
			'ansicht',
			[{ stufe: 'WARNUNG', seite: 0, code: 'zeitziel-fehlt', text: 'Am <body> fehlt data-zeit.' }],
		);
		assert.deepEqual(text.split('\n').slice(0, 7), [
			'Gebaut: 1 Seite. Prüfbericht: 1 Fehler, 2 Warnungen, 2 Hinweise.',
			'FEHLER Seite 1: „A“ ragt in den Seitenrand (3 px) → kürzen',
			'WARNUNG Seite 2: 120 px frei unten',
			'WARNUNG: Am <body> fehlt data-zeit.',
			'Hinweise (ansehen, kein Zwang):',
			'HINWEIS Seite 1: Bild „Hund“ hat im Druck nur 90 dpi',
			'HINWEIS: thema.css: Klasse ohne Registereintrag: x',
		]);
		assert.doesNotMatch(text, /ausgeblendet|Kit-Anteil/);
	});

	it('höchstens 15 Hinweise; ohne Hinweise kein Block', () => {
		const viele = Array.from({ length: 17 }, (_, i): Meldung => ({
			stufe: 'HINWEIS',
			seite: 1,
			code: 'verdeckt',
			text: `Hinweis ${i + 1}`,
		}));
		const text = ansichtText(ansicht(viele));
		assert.match(text, /0 Fehler, 0 Warnungen, 17 Hinweise/);
		assert.match(text, /Hinweis 15\n… und 2 weitere Hinweise\./);
		assert.doesNotMatch(text, /Hinweis 16/);
		assert.doesNotMatch(ansichtText(ansicht([])), /Hinweise \(/);
	});

	it('„data-antwort setzen“ kommt hinter alle anderen Hinweise und verdrängt keinen (249)', () => {
		const menge = (seite: number): Meldung => ({
			stufe: 'HINWEIS',
			seite,
			code: 'antwort-menge',
			text: `A2: Begründen auf Seite ${seite}`,
		});
		const andere = Array.from({ length: 15 }, (_, i): Meldung => ({
			stufe: 'HINWEIS',
			seite: 1,
			code: 'verdeckt',
			text: `Hinweis ${i + 1}`,
		}));
		const text = ansichtText(ansicht([menge(1), ...andere, menge(2)]));
		assert.match(text, /Hinweis 15\n… und 2 weitere Hinweise\./);
		assert.doesNotMatch(text, /Begründen/);
	});
});

describe('bauen für Claude: Probeblatt (225, Abnahme)', { skip: browserSkip() }, () => {
	it('ohne data-zeit, mit Aufgabe ohne Lösung und hellgelbem Wort: drei Meldungen im Text', async () => {
		const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-225-'));
		try {
			const html = [
				'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Probe</title>',
				'<link rel="stylesheet" href="blatt.css"><script src="abbildungen.js"></script></head>',
				'<body class="kl2 a4-hoch farbe palette-himmel" data-satz="2"><section class="seite">',
				'<div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Lies das <b style="color:#fff59d">Wort</b>.</span></div>',
				'<div class="koerper"><span class="antwort"></span></div></div>',
				'</section></body></html>',
			].join('\n');
			const quelle = path.join(tmp, 'material.html');
			await writeFile(quelle, html);
			const gebaut = await baueAnsichtAus({ pythonBin: 'python3' }, quelle, path.join(tmp, 'ansicht'));
			const text = ansichtText(gebaut, 'ansicht', laufMeldungen(html, 'arbeitsblatt'));
			assert.match(text, /^WARNUNG: Am <body> fehlt data-zeit\./m);
			assert.match(text, /^WARNUNG Seite 1: Aufgabe 1 hat keine Lösung/m);
			assert.match(text, /^HINWEIS Seite 1: In s\/w kaum lesbar/m);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});

interface McpAntwort {
	id: number;
	result?: {
		tools?: {
			name: string;
			inputSchema: { properties: Record<string, { enum?: string[] }>; required: string[] };
		}[];
		content?: { text: string }[];
		isError?: boolean;
	};
	error?: { code: number };
}

/** Startet `mcp.mjs` wie `claude` aus der MCP-Datei und schickt die Anfragen; die Antworten nach `id`. */
const sprich = async (werkzeug: Werkzeug, anfragen: Record<string, unknown>[]): Promise<McpAntwort[]> => {
	const datei = JSON.parse(await readFile(werkzeug.mcpDatei, 'utf8')) as {
		mcpServers: Record<string, { command: string; args: string[] }>;
	};
	const { args, command } = datei.mcpServers.schoolbox ?? { command: '', args: [] };
	const kind = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
	const antworten = new Map<number, McpAntwort>();
	const fertig = new Promise<void>((resolve) => {
		createInterface({ input: kind.stdout }).on('line', (zeile) => {
			const antwort = JSON.parse(zeile) as McpAntwort;
			antworten.set(antwort.id, antwort);
			if (antworten.size === anfragen.length) {
				resolve();
			}
		});
	});
	for (const [i, anfrage] of anfragen.entries()) {
		kind.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: i + 1, ...anfrage })}\n`);
	}
	await fertig;
	kind.kill();
	return anfragen.map((_, i) => antworten.get(i + 1) ?? { id: i + 1 });
};

const namenVon = (antwort: McpAntwort | undefined) => antwort?.result?.tools?.map((t) => t.name) ?? [];

describe('mcp.mjs: mehrere Werkzeuge je Prozess (237)', () => {
	let dir: string;
	const bauen: { dokument: string | undefined }[] = [];
	const bilder: { werkzeug: string; argumente: Record<string, unknown> }[] = [];
	const bildWerkzeug = {
		referenzen: [],
		aufruf: (werkzeug: string, argumente: Record<string, unknown>) => {
			bilder.push({ werkzeug, argumente });
			return Promise.resolve({ text: `Bild ${werkzeug}` });
		},
		stand: () => ({ gesperrt: false, aufrufe: bilder.length, obergrenze: 3, bilder: [], kostenUsd: 0 }),
	} as unknown as BildWerkzeug;
	const baue = (dokument: string | undefined) => {
		bauen.push({ dokument });
		return Promise.resolve({ text: `Gebaut ${dokument ?? '-'}` });
	};
	const starte = (art: WerkzeugArt, mitBildern: boolean) =>
		starteWerkzeug(dir, art === 'bilder' ? null : baue, art, { bilder: mitBildern ? bildWerkzeug : null });

	before(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'mcp-'));
	});
	after(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('tools/list je art', async () => {
		const faelle: [WerkzeugArt, boolean, string[]][] = [
			['blatt', false, ['bauen']],
			['blatt', true, ['bauen', 'bild_erzeugen', 'bild_bearbeiten']],
			['einheit', false, ['bauen']],
			['einheit', true, ['bauen', 'bild_erzeugen', 'bild_bearbeiten']],
			['bilder', true, ['bild_erzeugen', 'bild_bearbeiten']],
			['recherche', true, ['pruefen']],
		];
		for (const [art, mitBildern, erwartet] of faelle) {
			const werkzeug = await starte(art, mitBildern);
			try {
				const [liste] = await sprich(werkzeug, [{ method: 'tools/list' }]);
				assert.deepEqual(namenVon(liste), erwartet, `${art} ${mitBildern}`);
				assert.deepEqual(
					werkzeug.werkzeuge,
					erwartet.map((n) => `mcp__schoolbox__${n}`),
				);
				const bauenSchema = liste?.result?.tools?.find((t) => t.name === 'bauen')?.inputSchema;
				if (bauenSchema) {
					assert.deepEqual(bauenSchema.required, art === 'einheit' ? ['dokument'] : []);
				}
			} finally {
				await werkzeug.ende();
			}
		}
		await assert.rejects(starteWerkzeug(dir, null, 'bilder'));
	});

	it('bild_erzeugen nennt die Formatnamen aus kern und kein Schriftverbot', async () => {
		const werkzeug = await starte('bilder', true);
		try {
			const [liste] = await sprich(werkzeug, [{ method: 'tools/list' }]);
			const erzeugen = liste?.result?.tools?.find((t) => t.name === 'bild_erzeugen');
			assert.deepEqual(erzeugen?.inputSchema.properties.format?.enum, BILD_FORMAT_NAMEN);
			assert.deepEqual(erzeugen?.inputSchema.required, ['datei', 'prompt', 'format']);
			const text = JSON.stringify(liste?.result?.tools);
			assert.match(text, /bilder\.json/);
			assert.match(text, /nur aus bilder\/, referenzen\/ und den Vorversionen in ansicht\/bilder\/versuche\//);
			assert.match(text, /Ändere nur/);
			assert.doesNotMatch(text, /keine Schrift|ohne Schrift|kein Text/i);
		} finally {
			await werkzeug.ende();
		}
	});

	it('tools/call reicht die Argumente durch, an bauen wie an die Bildwerkzeuge', async () => {
		const werkzeug = await starte('einheit', true);
		try {
			const argumente = { datei: 'luna.png', prompt: 'Eine Eule', format: 'SQUARE_1_1', transparent: true };
			const [gebaut, bild, fremd] = await sprich(werkzeug, [
				{ method: 'tools/call', params: { name: 'bauen', arguments: { dokument: 'lesen-1' } } },
				{ method: 'tools/call', params: { name: 'bild_erzeugen', arguments: argumente } },
				{ method: 'tools/call', params: { name: 'pruefen', arguments: {} } },
			]);
			assert.equal(gebaut?.result?.content?.[0]?.text, 'Gebaut lesen-1');
			assert.equal(bild?.result?.content?.[0]?.text, 'Bild bild_erzeugen');
			assert.equal(bild?.result?.isError, false);
			assert.deepEqual(bauen.at(-1), { dokument: 'lesen-1' });
			assert.deepEqual(bilder.at(-1), { werkzeug: 'bild_erzeugen', argumente });
			assert.equal(fremd?.error?.code, -32601);
		} finally {
			await werkzeug.ende();
		}
	});

	it('der Socket nimmt nur, was die Art anbietet, und prüft die Argumente von bauen', async () => {
		const werkzeug = await starte('blatt', false);
		const { args } = (
			JSON.parse(await readFile(werkzeug.mcpDatei, 'utf8')) as {
				mcpServers: { schoolbox: { args: string[] } };
			}
		).mcpServers.schoolbox;
		const frage = (zeile: string) =>
			new Promise<{ text: string; fehler?: boolean }>((resolve) => {
				const verbindung = connect(args[1] ?? '');
				let antwort = '';
				verbindung.on('connect', () => verbindung.write(`${zeile}\n`));
				verbindung.on('data', (teil) => {
					antwort += teil.toString();
				});
				verbindung.on('close', () => resolve(JSON.parse(antwort) as { text: string; fehler?: boolean }));
			});
		try {
			const vorher = bilder.length;
			const bild = await frage(JSON.stringify({ werkzeug: 'bild_erzeugen', argumente: { datei: 'a.png' } }));
			assert.equal(bild.fehler, true);
			assert.equal(bilder.length, vorher);
			assert.equal((await frage(JSON.stringify({ werkzeug: 'bauen', argumente: { dokument: 7 } }))).fehler, true);
			assert.equal((await frage('{"dokument":"alt"}')).fehler, true);
			assert.equal((await frage('kein json')).fehler, true);
			assert.equal((await frage(JSON.stringify({ werkzeug: 'bauen', argumente: {} }))).text, 'Gebaut -');
		} finally {
			await werkzeug.ende();
		}
	});
});
