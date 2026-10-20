import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FolienZusatz } from '@schoolbox/kern';
import { baueVorschau, VORSCHAU_DATEI } from '@schoolbox/kern';

import { WEB_DIST } from './app';
import { baueErsatzAusgabe, baueErsatzFolien, starteTestServer, TEST_PASSWORT } from './testhilfe';

/**
 * Server für die Browser-Tests der Oberfläche (`pnpm --filter @schoolbox/web run e2e`): die gebaute Oberfläche, eine
 * eigene, leere Ablage, das Passwort der Tests. Vorschauen und PDFs entstehen ohne Chromium, damit die Tests schnell
 * bleiben. Mit `E2E_ECHT=1` baut blatt.py sie wirklich (Bildschirmfotos für die Hilfeseite).
 */
const PORT = Number(process.env.E2E_PORT);
const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? '';
const ECHT = process.env.E2E_ECHT === '1';
const VORSCHAU_MS = 1200;
/** Lang genug, dass „PDF wird erstellt …“ zu sehen ist. */
const PDF_MS = 800;
const WEISSES_BILD = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAB4AAAAqCAIAAAAruXxOAAAAKElEQVR42u3MQREAAAwCIPuX1hS7fSAA6Zmo1Wq1Wq1Wq9VqtVr9Uw9hEbYPF9a3kwAAAABJRU5ErkJggg==',
	'base64',
);

const vorschauBauer = async (dokDir: string) => {
	await new Promise((resolve) => setTimeout(resolve, VORSCHAU_MS));
	await writeFile(path.join(dokDir, 'ausgabe', VORSCHAU_DATEI), WEISSES_BILD);
};

const pdfBauer = async (dokDir: string) => {
	await new Promise((resolve) => setTimeout(resolve, PDF_MS));
	await baueErsatzAusgabe(dokDir);
};

const folienBauer = async (dokDir: string, art: FolienZusatz) => {
	await new Promise((resolve) => setTimeout(resolve, PDF_MS));
	await baueErsatzFolien(dokDir, art);
};

const starte = async () => {
	if (!Number.isInteger(PORT) || !path.isAbsolute(MATERIAL_DIR)) {
		throw new Error('E2E_PORT und E2E_MATERIAL_DIR (absoluter Pfad) müssen gesetzt sein.');
	}
	await rm(MATERIAL_DIR, { recursive: true, force: true });
	await mkdir(MATERIAL_DIR, { recursive: true });
	const server = await starteTestServer({
		port: PORT,
		materialDir: MATERIAL_DIR,
		webDist: WEB_DIST,
		ueberwachung: true,
		ruheMs: 300,
		...(ECHT
			? { vorschauBauer: (dokDir: string) => baueVorschau({ pythonBin: 'python3' }, dokDir) }
			: { vorschauBauer, pdfBauer, folienBauer }),
	});
	console.log(`Testserver läuft auf ${server.url}, Ablage ${MATERIAL_DIR}, Passwort „${TEST_PASSWORT}“`);
	const beenden = () => {
		void server.stop().finally(() => process.exit(0));
	};
	process.on('SIGINT', beenden);
	process.on('SIGTERM', beenden);
};

starte().catch((fehler: unknown) => {
	console.error(fehler);
	process.exit(1);
});
