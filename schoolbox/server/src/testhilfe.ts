import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Format, Meldung } from '@schoolbox/kern';
import {
	ASSETS,
	ausgabeSchluessel,
	dokumentDir,
	erzeugePasswortHash,
	formatAusHtml,
	ladeKonfig,
	LOESUNG_PDF_DATEI,
	neueMappe,
	neuesDokument,
	PDF_DATEI,
	uebernehmeAusgabe,
} from '@schoolbox/kern';
import { A4, FOLIE, testPdf } from '@schoolbox/kern/src/testpdf';

import { erstelleApp } from './app';
import type { ServerKonfig } from './konfig';
import { pruefeServerKonfig } from './konfig';
import type { Kontext } from './kontext';
import { erstelleKontext } from './kontext';
import type { PdfBauer } from './pdf';
import { CSRF_HEADER } from './schutz';
import type { Sitzung } from './sitzung';
import { signiereSitzung, SITZUNG_COOKIE } from './sitzung';
import type { Ueberwachung } from './ueberwachung';
import { starteUeberwachung } from './ueberwachung';
import type { VorschauBauer } from './vorschau';

type Init = NonNullable<Parameters<typeof fetch>[1]>;

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
	/** Fester Port und feste Ablage für die Browser-Tests; sonst ein freier Port und ein neuer Ordner in /tmp. */
	port?: number;
	materialDir?: string;
}

export const starteTestServer = async (optionen: TestServerOptionen = {}) => {
	const materialDir = optionen.materialDir ?? (await mkdtemp(path.join(tmpdir(), 'schoolbox-server-')));
	const env = {
		MATERIAL_DIR: materialDir,
		PORT: '4999',
		PASSWORT_HASH: await erzeugePasswortHash(TEST_PASSWORT, 10),
		SITZUNG_GEHEIMNIS: TEST_GEHEIMNIS,
	};
	const konfig = pruefeServerKonfig(ladeKonfig(env, materialDir));
	const kontext = erstelleKontext(konfig, 'test', { vorschau: optionen.vorschauBauer, pdf: optionen.pdfBauer });
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
export const baueErsatzAusgabe = async (dokDir: string) => {
	const schluessel = await ausgabeSchluessel(dokDir);
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
		await uebernehmeAusgabe(tmp, dokDir, schluessel);
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};
