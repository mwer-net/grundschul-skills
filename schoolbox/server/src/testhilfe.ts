import { copyFile, mkdtemp } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Format } from '@schoolbox/kern';
import { ASSETS, dokumentDir, ladeKonfig, neueMappe, neuesDokument } from '@schoolbox/kern';

import { CSRF_HEADER } from './api';
import { erstelleApp } from './app';
import { pruefeServerKonfig } from './konfig';
import type { Kontext } from './kontext';
import { erstelleKontext } from './kontext';
import type { Ueberwachung } from './ueberwachung';
import { starteUeberwachung } from './ueberwachung';

export const BEISPIEL = path.join(ASSETS, 'beispiel-zehner-einer-kl2.html');

export interface TestServer {
	url: string;
	kontext: Kontext;
	materialDir: string;
	stop: () => Promise<void>;
}

export const starteTestServer = async (optionen: { ueberwachung?: boolean; ruheMs?: number } = {}) => {
	const materialDir = await mkdtemp(path.join(tmpdir(), 'schoolbox-server-'));
	const konfig = pruefeServerKonfig(ladeKonfig({ MATERIAL_DIR: materialDir, PORT: '4999' }, materialDir));
	const kontext = erstelleKontext(konfig, 'test');
	const ueberwachung: Ueberwachung | null = optionen.ueberwachung
		? await starteUeberwachung(kontext, optionen.ruheMs)
		: null;
	const server = erstelleApp(kontext, path.join(materialDir, 'kein-web')).listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const { port } = server.address() as AddressInfo;
	const stop = async () => {
		ueberwachung?.stop();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	};
	const ergebnis: TestServer = { url: `http://127.0.0.1:${port}`, kontext, materialDir, stop };
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
export const rohAnfrage = (url: string, pfad: string) =>
	new Promise<{ status: number; text: string }>((resolve, reject) => {
		const { hostname, port } = new URL(url);
		const anfrage = http.get({ hostname, port, path: pfad }, (antwort) => {
			let text = '';
			antwort.on('data', (teil: Buffer) => {
				text += teil.toString();
			});
			antwort.on('end', () => resolve({ status: antwort.statusCode ?? 0, text }));
		});
		anfrage.on('error', reject);
	});

/** Liest Server-Sent Events, bis `bedingung` erfüllt ist oder die Zeit abläuft. */
export const sammleEreignisse = (url: string) => {
	const ereignisse: { typ: string; daten: unknown; zeit: number }[] = [];
	const steuerung = new AbortController();
	const bereit = fetch(`${url}/api/ereignisse`, { signal: steuerung.signal }).then((antwort) => {
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
