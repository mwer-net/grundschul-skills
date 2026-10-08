import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const WURZEL = path.resolve(import.meta.dirname, '..', '..');

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, WURZEL, '');
	const server = `http://${env.HOST || '127.0.0.1'}:${env.PORT || '4009'}`;
	return {
		plugins: [react()],
		server: {
			proxy: {
				'/api': server,
				'/ansicht': server,
				'/healthz': server,
			},
		},
	};
});
