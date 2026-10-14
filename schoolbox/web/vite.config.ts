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
		server: {
			// Die Schriften liegen beim Skill, außerhalb dieses Pakets.
			fs: { allow: [WURZEL] },
			proxy: {
				'/api': server,
				'/ansicht': server,
				'/healthz': server,
				'/robots.txt': server,
				'^/f/[^/]+/(api|ansicht)(/|$)': server,
			},
		},
	};
});
