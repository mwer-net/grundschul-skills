import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Druckprofil, FolienZusatz, Format, Meldung } from '@schoolbox/kern';
import {
	ASSETS,
	ausgabeOrdner,
	ausgabeSchluessel,
	dokumentDir,
	erzeugePasswortHash,
	formatAusHtml,
	HTML_DATEI,
	ladeKonfig,
	LOESUNG_PDF_DATEI,
	neueMappe,
	neuesDokument,
	PDF_DATEI,
	schreibeStand,
	uebernehmeAusgabe,
	zusatzBerichtDatei,
	zusatzPdfDatei,
	zusatzStandDatei,
} from '@schoolbox/kern';
import { A4, FOLIE, testPdf } from '@schoolbox/kern/src/testpdf';

import { erstelleApp } from './app';
import type { KiPruefer } from './ki';
import type { ServerKonfig } from './konfig';
import { pruefeServerKonfig } from './konfig';
import type { Kontext } from './kontext';
import { erstelleKontext } from './kontext';
import type { FolienBauer, PdfBauer } from './pdf';
import { CSRF_HEADER } from './schutz';
import type { Sitzung } from './sitzung';
import { signiereSitzung, SITZUNG_COOKIE } from './sitzung';
import type { Ueberwachung } from './ueberwachung';
import { starteUeberwachung } from './ueberwachung';
import type { VorschauBauer } from './vorschau';

type Init = NonNullable<Parameters<typeof fetch>[1]>;

/** Spielt `claude` nach (Issue 057): Kein Test verbraucht Limit. Das Verhalten steht in `fall.txt` daneben. */
export const KI_ATTRAPPE = String.raw`#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const fall = fs.readFileSync(path.join(__dirname, 'fall.txt'), 'utf8').trim();
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, 'aufrufe.jsonl'), JSON.stringify({ args, cwd: process.cwd(), env: Object.keys(process.env) }) + '\n');
if (args[0] === 'auth') {
	if (fall === 'abgemeldet') { console.log('{"loggedIn":false}'); process.exit(1); }
	console.log('{"loggedIn":true}'); process.exit(0);
}
fs.writeFileSync(path.join(__dirname, 'pid'), String(process.pid));
const sag = (o) => console.log(JSON.stringify(o));
const projekt = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^a-zA-Z0-9]/g, '-'));
fs.mkdirSync(projekt, { recursive: true });
fs.writeFileSync(path.join(projekt, 'sitzung.jsonl'), 'materialtext');
let eingabe = '';
process.stdin.on('data', (d) => { eingabe += d; });
process.stdin.on('end', () => {
	fs.appendFileSync(path.join(__dirname, 'prompts.txt'), eingabe + '\n---\n');
	if (args.includes('--json-schema')) {
		if (fall === 'einordnen-fehler') { process.exit(1); }
		const inMappe = /Aktuelle Mappe: (.+)/.exec(eingabe);
		const art = fall === 'einordnen-film' ? 'unbekannt' : 'arbeitsblatt';
		sag({ type: 'result', subtype: 'success', is_error: false, num_turns: 1, total_cost_usd: 0.001, structured_output: { titel: 'Uhrzeiten üben', fach: 'mathematik', klasse: 2, art, format: 'a4-hoch', mappeId: inMappe ? inMappe[1] : null, neueMappe: inMappe ? null : 'Uhrzeit aus dem Chat' } });
		return;
	}
	sag({ type: 'system', subtype: 'init', session_id: 's1' });
	sag({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', resetsAt: 1900000000, unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: 1900000000 }, seven_day: { utilization: 0.2, resetsAt: 1900000000 } } } });
	sag({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'fach-mathematik' } }, { type: 'tool_use', name: 'Edit', input: {} }] } });
	const ende = (extra) => sag({ type: 'result', subtype: 'success', is_error: false, result: 'Annahme: Klasse 2', num_turns: 2, total_cost_usd: 0.01, usage: { output_tokens: 5 }, permission_denials: [], ...extra });
	const aendere = () => { const d = 'material.html'; const alt = fs.readFileSync(d, 'utf8'); fs.writeFileSync(d, alt.includes('</h1>') ? alt.replace('</h1>', ' von Claude</h1>') : alt.includes('</section>') ? alt.replace('</section>', '<p>von Claude</p></section>') : alt.replace(/^\s*<[a-z-]+/, '$& data-von-claude')); };
	if (fall === 'haenger') { setInterval(() => {}, 1000); return; }
	if (fall === 'fehler') { sag({ type: 'assistant', error: 'rate_limit', message: { content: [] } }); ende({ is_error: true, result: 'limit' }); process.exit(1); }
	if (fall === 'abmeldung') { sag({ type: 'assistant', error: 'authentication_failed', message: { content: [] } }); ende({ is_error: true, result: 'Not logged in' }); process.exit(1); }
	if (fall === 'nichts') { ende({}); return; }
	if (fall === 'leer') { ende({ result: '' }); return; }
	if (eingabe.includes('FRAGE')) { ende({ result: 'Das Blatt hat vier Uhren.' }); return; }
	if (fall === 'gross') { fs.writeFileSync('material.html', 'x'.repeat(6 * 1024 * 1024)); ende({}); return; }
	if (fall === 'aussen') { aendere(); fs.writeFileSync('andere.txt', 'boese'); fs.writeFileSync(path.join(__dirname, 'aussen.txt'), 'gelaufen'); ende({}); return; }
	aendere(); ende({});
});
`;

export const BEISPIEL = path.join(ASSETS, 'beispiel-zehner-einer-kl2.html');
export const TEST_PASSWORT = 'drei-kleine-woerter';
export const TEST_GEHEIMNIS = 'g'.repeat(64);

export interface TestServer {
	url: string;
	kontext: Kontext;
	materialDir: string;
	webDist: string;
	/** Cookie-Kopf einer gültigen Sitzung. */
	cookie: string;
	/** `fetch` mit dieser Sitzung. */
	holen: (url: string | URL, init?: Init) => Promise<Response>;
	stop: () => Promise<void>;
}

export const sitzungsCookie = (konfig: ServerKonfig, sitzung: Partial<Sitzung> = {}) =>
	`${SITZUNG_COOKIE}=${signiereSitzung(konfig, { ausgestellt: Date.now(), dauerhaft: true, ...sitzung })}`;

export interface TestServerOptionen {
	ueberwachung?: boolean;
	ruheMs?: number;
	/** `true`: leerer Ordner für eine eigene index.html. Ein Pfad: diese gebaute Oberfläche. */
	webDist?: boolean | string;
	vorschauBauer?: VorschauBauer;
	/** Ohne baut blatt.py die PDFs. */
	pdfBauer?: PdfBauer;
	/** Ohne baut blatt.py die Zusätze für Folien. */
	folienBauer?: FolienBauer;
	/** Fester Port und feste Ablage für die Browser-Tests; sonst ein freier Port und ein neuer Ordner in /tmp. */
	port?: number;
	materialDir?: string;
	/** Zusätzliche Konfiguration, z. B. `CLAUDE_BIN` für die Attrappe. */
	env?: Record<string, string>;
	kiPruefer?: KiPruefer;
}

export const starteTestServer = async (optionen: TestServerOptionen = {}) => {
	const materialDir = optionen.materialDir ?? (await mkdtemp(path.join(tmpdir(), 'schoolbox-server-')));
	const env = {
		MATERIAL_DIR: materialDir,
		PORT: '4999',
		PASSWORT_HASH: await erzeugePasswortHash(TEST_PASSWORT, 10),
		SITZUNG_GEHEIMNIS: TEST_GEHEIMNIS,
		...optionen.env,
	};
	const konfig = pruefeServerKonfig(ladeKonfig(env, materialDir));
	const kontext = erstelleKontext(konfig, 'test', {
		vorschau: optionen.vorschauBauer,
		pdf: optionen.pdfBauer,
		folien: optionen.folienBauer,
		kiPruefer: optionen.kiPruefer,
	});
	const ueberwachung: Ueberwachung | null = optionen.ueberwachung
		? await starteUeberwachung(kontext, optionen.ruheMs)
		: null;
	const webDist =
		typeof optionen.webDist === 'string'
			? optionen.webDist
			: await mkdtemp(path.join(tmpdir(), optionen.webDist ? 'schoolbox-web-' : 'schoolbox-kein-web-'));
	if (!optionen.webDist) {
		await rm(webDist, { recursive: true });
	}
	const server = erstelleApp(kontext, webDist).listen(optionen.port ?? 0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const { port } = server.address() as AddressInfo;
	const stop = async () => {
		ueberwachung?.stop();
		kontext.ki.stop();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	};
	const cookie = sitzungsCookie(konfig);
	const holen = (url: string | URL, init: Init = {}) =>
		fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), cookie } });
	const ergebnis: TestServer = {
		url: `http://127.0.0.1:${port}`,
		kontext,
		materialDir,
		webDist,
		cookie,
		holen,
		stop,
	};
	return ergebnis;
};

/** Legt eine Mappe mit einem Dokument an; optional mit dem Beispielblatt aus assets/ als material.html. */
export const legeDokumentAn = async (
	materialDir: string,
	optionen: { beispiel?: boolean; format?: Format; jetzt?: Date } = {},
) => {
	const jetzt = optionen.jetzt ?? new Date();
	const { mappe } = await neueMappe(materialDir, { titel: 'Zehner und Einer', fach: 'mathematik', klasse: 2 }, jetzt);
	const angaben = { titel: 'Blatt', art: 'arbeitsblatt', druckprofil: 'sw', druckhinweise: [] } as const;
	const { id } = await neuesDokument(
		materialDir,
		mappe.id,
		{ ...angaben, format: optionen.format ?? 'a4-hoch' },
		jetzt,
	);
	const dir = dokumentDir(materialDir, mappe.id, id);
	if (optionen.beispiel) {
		await copyFile(BEISPIEL, path.join(dir, 'material.html'));
	}
	return { mappe: mappe.id, dok: id, dir };
};

export const schreibKoepfe = { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' };

/** Anfrage mit genau diesem Pfad. `fetch` würde `..` vorher auflösen, ein Angreifer tut das nicht. */
export const rohAnfrage = (url: string, pfad: string, cookie?: string) =>
	new Promise<{ status: number; text: string }>((resolve, reject) => {
		const { hostname, port } = new URL(url);
		const headers = cookie ? { cookie } : {};
		const anfrage = http.get({ hostname, port, path: pfad, headers }, (antwort) => {
			let text = '';
			antwort.on('data', (teil: Buffer) => {
				text += teil.toString();
			});
			antwort.on('end', () => resolve({ status: antwort.statusCode ?? 0, text }));
		});
		anfrage.on('error', reject);
	});

/** Liest Server-Sent Events, bis `bedingung` erfüllt ist oder die Zeit abläuft. */
export const sammleEreignisse = (url: string, cookie: string) => {
	const ereignisse: { typ: string; daten: unknown; zeit: number }[] = [];
	const steuerung = new AbortController();
	const bereit = fetch(`${url}/api/ereignisse`, { signal: steuerung.signal, headers: { cookie } }).then((antwort) => {
		const leser = antwort.body?.getReader();
		const dekoder = new TextDecoder();
		let puffer = '';
		void (async () => {
			try {
				for (;;) {
					const teil = await leser?.read();
					if (!teil || teil.done) {
						return;
					}
					puffer += dekoder.decode(teil.value as Uint8Array, { stream: true });
					const bloecke = puffer.split('\n\n');
					puffer = bloecke.pop() ?? '';
					for (const block of bloecke) {
						const typ = /^event: (.+)$/m.exec(block)?.[1];
						const daten = /^data: (.+)$/m.exec(block)?.[1];
						if (typ && daten) {
							ereignisse.push({ typ, daten: JSON.parse(daten) as unknown, zeit: Date.now() });
						}
					}
				}
			} catch {
				// Abbruch durch stop()
			}
		})();
	});
	return { bereit, ereignisse, stop: () => steuerung.abort() };
};

export const warte = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const UEBERLAUF = '„Aufgabe 4“ ragt aus der Seite (31 px) → kürzen, Item streichen oder zweite Seite';

/**
 * Ersatz für blatt.py, ohne Chromium und in Millisekunden: je eine leere Seite im Format des Dokuments, eine Lösung,
 * wenn die Quelle `data-l` enthält, und ein Prüffehler, wenn sie `data-test-ueberlauf` enthält.
 */
export const baueErsatzAusgabe = async (dokDir: string, profil?: Druckprofil) => {
	const schluessel = await ausgabeSchluessel(dokDir, profil);
	const html = await readFile(path.join(dokDir, 'material.html'), 'utf8');
	const seite = ['folie', 'a4-quer'].includes(formatAusHtml(html)) ? FOLIE : A4;
	const meldungen: Meldung[] = html.includes('data-test-ueberlauf')
		? [{ stufe: 'FEHLER', seite: 1, text: UEBERLAUF }]
		: [];
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-ersatz-'));
	try {
		await writeFile(path.join(tmp, PDF_DATEI), testPdf([seite]));
		if (html.includes('data-l=')) {
			await writeFile(path.join(tmp, LOESUNG_PDF_DATEI), testPdf([seite]));
		}
		const bericht = { seiten: [], meldungen, fehler: meldungen.length };
		await writeFile(path.join(tmp, 'pruefbericht.json'), JSON.stringify(bericht));
		await writeFile(path.join(tmp, HTML_DATEI), html);
		await uebernehmeAusgabe(tmp, dokDir, schluessel, await ausgabeOrdner(dokDir, profil));
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

export const NOTIZ_ZU_LANG = 'Folien mit Notizen: „Folie 1 mit Notiz“ ragt aus der Seite (62 px) → Notiz kürzen';

/**
 * Ersatz für `blatt.py --nur-zusatz`: zwei Folienseiten mit Schritten bzw. ein A4-Blatt mit Notizen, ein Prüffehler
 * der Notizen, wenn die Quelle `data-test-notiz-lang` enthält. Erwartet wie das Original einen fertigen Bau.
 */
export const baueErsatzFolien = async (dokDir: string, art: FolienZusatz) => {
	const schluessel = await ausgabeSchluessel(dokDir);
	const html = await readFile(path.join(dokDir, 'material.html'), 'utf8');
	const ausgabe = path.join(dokDir, 'ausgabe');
	const meldungen: Meldung[] =
		art === 'notizen' && html.includes('data-test-notiz-lang')
			? [{ stufe: 'FEHLER', seite: 1, text: NOTIZ_ZU_LANG }]
			: [];
	await writeFile(path.join(ausgabe, zusatzPdfDatei(art)), testPdf(art === 'notizen' ? [A4] : [FOLIE, FOLIE]));
	const bericht = { seiten: [], meldungen, fehler: meldungen.length };
	await writeFile(path.join(ausgabe, zusatzBerichtDatei(art)), JSON.stringify(bericht));
	await schreibeStand(ausgabe, schluessel, zusatzStandDatei(art));
};
