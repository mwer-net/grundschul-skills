import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PORT = 4039;
const MATERIAL_DIR = path.join(tmpdir(), 'schoolbox-hilfe-bilder');

process.env.E2E_MATERIAL_DIR = MATERIAL_DIR;

/**
 * Bildschirmfotos für die Hilfeseite (`pnpm run hilfe:bilder`), nach `public/hilfe-bilder/`. Wie die Browser-Tests,
 * aber mit echten Vorschauen aus blatt.py und nur Mac und iPad quer. Die Fotos zeigen nur Testdaten.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: 'hilfe-bilder.ts',
	outputDir: 'test-results/hilfe-bilder',
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	timeout: 120_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
	},
	projects: [
		{ name: 'mac', use: { ...devices['Desktop Safari'] } },
		{ name: 'ipad', use: { ...devices['iPad (gen 7) landscape'] } },
	],
	webServer: {
		command: 'pnpm --filter @schoolbox/server run testserver',
		url: `http://127.0.0.1:${PORT}/healthz`,
		reuseExistingServer: false,
		env: { E2E_PORT: String(PORT), E2E_MATERIAL_DIR: MATERIAL_DIR, E2E_ECHT: '1' },
	},
});
