/* eslint-disable */

// PM2: pm2 start schoolbox/ecosystem.config.cjs. Node kommt aus NODE_BIN in der .env im Repo-Hauptordner,
// TypeScript läuft wie beim CLI über tsx, ohne Build-Schritt.
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const envDatei = path.join(__dirname, '..', '.env');
const env = existsSync(envDatei) ? parseEnv(readFileSync(envDatei, 'utf8')) : {};

module.exports = {
	apps: [
		{
			name: 'schoolbox',
			cwd: path.join(__dirname, 'server'),
			script: 'src/start.ts',
			interpreter: env.NODE_BIN || 'node',
			node_args: '--import tsx',
			time: true,
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			watch: false,
			instances: 1,
			exec_mode: 'fork',
			kill_timeout: 5000,
			output: path.join(__dirname, 'logs', 'pm2.log'),
			error: path.join(__dirname, 'logs', 'error.log'),
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};
