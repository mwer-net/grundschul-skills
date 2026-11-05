import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const WURZEL = path.resolve(import.meta.dirname, '..', '..');

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, WURZEL, '');
	const server = `http://${env.HOST || '127.0.0.1'}:${env.PORT || '4009'}`;
	return {
		plugins: [react(), tailwindcss()],
		build: {
			// Die Produktion liegt auf einem Bindfs-Mount mit 1024 offenen Dateien für alle Sites. Der Standardwert 1000
			// reißt das zeitweise: Rollup meldet dann „failed to resolve“ für vorhandene Pakete.
			rollupOptions: { maxParallelFileOps: 32 },
		},
		server: {
			// Die Schriften liegen beim Skill, außerhalb dieses Pakets.
			fs: { allow: [WURZEL] },
			proxy: {
				'/api': server,
				'/ansicht': server,
				'/healthz': server,
				'/robots.txt': server,
				'^/f/[^/]+/(api|ansicht|pdf|alles)(/|$)': server,
			},
		},
	};
});
