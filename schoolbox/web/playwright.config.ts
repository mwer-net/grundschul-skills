import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PORT = 4029;
const MATERIAL_DIR = path.join(tmpdir(), 'schoolbox-e2e');

// Die Tests legen Mappen direkt in dieser Ablage an, so wie Claude es am Server tut.
process.env.E2E_MATERIAL_DIR = MATERIAL_DIR;

/**
 * Browser-Tests der Oberfläche gegen die gebaute Fassung (`pnpm run e2e` baut vorher). Die Lehrkraft arbeitet in
 * Safari auf iPad und Mac, deshalb läuft alles in WebKit: iPad hoch und quer mit Finger, Mac mit Maus. Chromium
 * dient als Gegenprobe. Alle Projekte teilen sich einen Server und eine Ablage, darum immer nur ein Test zur Zeit.
 */
export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results',
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	reporter: 'list',
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'ipad-hoch', use: { ...devices['iPad (gen 7)'] } },
		{ name: 'ipad-quer', use: { ...devices['iPad (gen 7) landscape'] } },
		{ name: 'mac-safari', use: { ...devices['Desktop Safari'] } },
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	],
	webServer: {
		command: 'pnpm --filter @schoolbox/server run testserver',
		url: `http://127.0.0.1:${PORT}/healthz`,
		reuseExistingServer: false,
		env: { E2E_PORT: String(PORT), E2E_MATERIAL_DIR: MATERIAL_DIR },
	},
});
