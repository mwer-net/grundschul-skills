/**
 * Das Werkzeug „bauen“ eines Claude-Laufs: Claude ruft es statt `blatt.py bauen` auf und bekommt denselben Prüfbericht
 * und dieselben Seitenbilder wie in der Claude-App. Bash bekommt der Lauf dafür nicht (Issue 056): Der Bau läuft im
 * Server, Claude erreicht ihn nur über den Unix-Socket seines eigenen Laufordners.
 */
import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:net';
import { createServer } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { Ansicht } from '@schoolbox/kern';
import { ANSICHT_ORDNER, WURZEL } from '@schoolbox/kern';

export const WERKZEUG_SERVER = 'schoolbox';
export const WERKZEUG_BAUEN = `mcp__${WERKZEUG_SERVER}__bauen`;
const MCP_SKRIPT = path.join(WURZEL, 'schoolbox', 'server', 'werkzeug', 'mcp.mjs');
const MAX_MELDUNGEN = 60;

export type Bauen = (dokument: string | undefined) => Promise<{ text: string; fehler?: boolean }>;

/** Der Text, den Claude nach einem Bau liest. `ordner`: wo die Bilder liegen, aus Sicht seines Arbeitsordners. */
export const ansichtText = ({ bericht, bilder }: Ansicht, ordner = ANSICHT_ORDNER) => {
	const meldungen = bericht.meldungen.filter((m) => m.stufe !== 'HINWEIS');
	const fehler = meldungen.filter((m) => m.stufe === 'FEHLER').length;
	const seiten = bilder.filter((b) => /^seite-\d+\.png$/.test(b));
	const ausschnitte = bilder.filter((b) => /^seite-\d+-aufgabe-\d+\.png$/.test(b));
	const loesung = bilder.filter((b) => b.startsWith('loesung-'));
	const liste = (namen: string[]) => namen.map((n) => `${ordner}/${n}`).join(', ');
	return [
		`Gebaut: ${seiten.length} ${seiten.length === 1 ? 'Seite' : 'Seiten'}. Prüfbericht: ${fehler} Fehler, ${meldungen.length - fehler} Warnungen.`,
		...meldungen.slice(0, MAX_MELDUNGEN).map((m) => `${m.stufe} Seite ${m.seite}: ${m.text}`),
		meldungen.length > MAX_MELDUNGEN ? `… und ${meldungen.length - MAX_MELDUNGEN} weitere.` : null,
		seiten.length ? `Seiten zum Ansehen mit Read: ${liste(seiten)}` : null,
		ausschnitte.length ? `Ausschnitt je Aufgabe: ${liste(ausschnitte)}` : null,
		loesung.length ? `Lösung: ${liste(loesung)}` : null,
		'Sieh dir die Seiten jetzt an (visuelle Endkontrolle). Jeder FEHLER und jeder sichtbare Mangel wird behoben, danach baust du neu.',
	]
		.filter(Boolean)
		.join('\n');
};

/**
 * Öffnet den Socket in `dir` und schreibt die MCP-Konfiguration daneben. `dir` gehört der Schoolbox und hat Modus
 * 0700; mehr Schutz braucht der Socket nicht. Der Name ist kurz und zufällig: Ein Socket-Pfad fasst nur 108 Zeichen.
 */
export const starteWerkzeug = async (dir: string, bauen: Bauen, art: 'blatt' | 'einheit' = 'blatt') => {
	const name = `w-${randomBytes(4).toString('hex')}`;
	const socket = path.join(dir, `${name}.sock`);
	const mcpDatei = path.join(dir, `${name}.json`);
	/** Ein Bau zur Zeit: Zwei Aufrufe schrieben sonst in denselben Ordner. */
	let reihe: Promise<unknown> = Promise.resolve();
	const server: Server = createServer((verbindung) => {
		verbindung.on('error', () => undefined);
		createInterface({ input: verbindung }).once('line', (zeile) => {
			const antworte = (ergebnis: { text: string; fehler?: boolean }) => verbindung.end(JSON.stringify(ergebnis));
			let dokument: string | undefined;
			try {
				const wert = (JSON.parse(zeile) as { dokument?: unknown }).dokument;
				dokument = typeof wert === 'string' ? wert : undefined;
			} catch {
				antworte({ text: 'Die Anfrage war ungültig.', fehler: true });
				return;
			}
			reihe = reihe
				.then(() => bauen(dokument))
				.then(antworte, (fehler: unknown) => {
					console.error('Bau für Claude:', fehler);
					antworte({
						text: 'Der Bau ist gescheitert. Prüfe das HTML auf offene Tags und baue noch einmal.',
						fehler: true,
					});
				});
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(socket, resolve);
	});
	await writeFile(
		mcpDatei,
		JSON.stringify({
			mcpServers: { [WERKZEUG_SERVER]: { command: process.execPath, args: [MCP_SKRIPT, socket, art] } },
		}),
	);
	return {
		mcpDatei,
		ende: async () => {
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
			await Promise.all([socket, mcpDatei].map((datei) => rm(datei, { force: true })));
		},
	};
};

export type Werkzeug = Awaited<ReturnType<typeof starteWerkzeug>>;
