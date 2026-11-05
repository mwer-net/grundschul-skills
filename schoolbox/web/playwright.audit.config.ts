import { tmpdir } from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4184);
const MATERIAL_DIR = process.env.E2E_MATERIAL_DIR ?? path.join(tmpdir(), 'schoolbox-audit');

process.env.E2E_MATERIAL_DIR = MATERIAL_DIR;

/**
 * Die Prüfmaschine aus Ticket 084 (`pnpm test:audit`): jeder Katalogeintrag und jede Option, nur in Chromium, nicht in
 * jedem Lauf. Eigener Port und eigene Ablage, damit sie neben den anderen Servern laufen kann. Der Bericht entsteht in
 * `AUDIT_BERICHT` (sonst `lokal/` neben `schoolbox/`) und kommt nie ins Repo.
 */
export default defineConfig({
	testDir: 'e2e',
	testMatch: 'baustein-audit.spec.ts',
	outputDir: 'test-results/audit',
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	timeout: 120_000,
	use: {
		...devices['Desktop Chrome'],
		baseURL: `http://127.0.0.1:${PORT}`,
		viewport: { width: 1512, height: 860 },
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
	},
	webServer: {
		command: 'pnpm --filter @schoolbox/server run testserver',
		url: `http://127.0.0.1:${PORT}/healthz`,
		reuseExistingServer: Boolean(process.env.AUDIT_SERVER_DA),
		env: { E2E_PORT: String(PORT), E2E_MATERIAL_DIR: MATERIAL_DIR },
	},
});
