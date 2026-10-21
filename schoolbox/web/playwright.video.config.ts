import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig } from '@playwright/test';

const PORT = 4049;
const MATERIAL_DIR = path.join(tmpdir(), 'schoolbox-video');

process.env.E2E_MATERIAL_DIR = MATERIAL_DIR;
process.env.VIDEO_PORT = String(PORT);

/**
 * Demo-Video der Schoolbox (`pnpm run video`): legt Testmaterial an, nimmt jedes Kapitel in Chromium auf und schneidet
 * daraus ein MP4 (braucht `ffmpeg` mit libx264). Nur Testdaten. Die volle Chromium-Fassung statt der schlanken, weil
 * nur sie PDFs anzeigt (Drucken). `schoolbox.example` zeigt auf den Testserver, damit Links neutral aussehen.
 * Läuft schon ein Testserver auf dem Port, nutzt die Aufnahme ihn samt seiner Ablage (zum Wiederholen einzelner
 * Kapitel mit `--grep`).
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: 'video/drehbuch.ts',
	outputDir: 'test-results/video',
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	timeout: 600_000,
	use: {
		baseURL: 'http://schoolbox.example',
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
		channel: 'chromium',
		launchOptions: {
			args: [
				`--host-resolver-rules=MAP schoolbox.example:80 127.0.0.1:${PORT}`,
				// Die Zwischenablage gibt es nur in sicheren Kontexten; echt läuft die Schoolbox über HTTPS.
				'--unsafely-treat-insecure-origin-as-secure=http://schoolbox.example',
			],
		},
	},
	webServer: {
		command: 'pnpm --filter @schoolbox/server run testserver',
		url: `http://127.0.0.1:${PORT}/healthz`,
		reuseExistingServer: true,
		env: { E2E_PORT: String(PORT), E2E_MATERIAL_DIR: MATERIAL_DIR, E2E_ECHT: '1' },
	},
});
