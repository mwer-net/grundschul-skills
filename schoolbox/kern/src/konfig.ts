import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const WURZEL = path.resolve(__dirname, '..', '..', '..');
export const SKILL_DIR = path.join(WURZEL, 'skills', 'html-materialerstellung');
export const ASSETS = path.join(SKILL_DIR, 'assets');
export const BLATT_PY = path.join(SKILL_DIR, 'scripts', 'blatt.py');

export interface Konfig {
	wurzel: string;
	materialDir: string;
	schoolboxUrl: string | null;
	pythonBin: string;
}

type Umgebung = Record<string, string | undefined>;

const leseEnvDatei = (wurzel: string): Umgebung => {
	const datei = path.join(wurzel, '.env');
	return existsSync(datei) ? parseEnv(readFileSync(datei, 'utf8')) : {};
};

export const ladeKonfig = (env: Umgebung = process.env, wurzel = WURZEL): Konfig => {
	const datei = leseEnvDatei(wurzel);
	const wert = (schluessel: string) => (env[schluessel] ?? datei[schluessel])?.trim() || undefined;
	return {
		wurzel,
		materialDir: path.resolve(wurzel, wert('MATERIAL_DIR') ?? 'materialien'),
		schoolboxUrl: wert('SCHOOLBOX_URL')?.replace(/\/+$/, '') ?? null,
		pythonBin: wert('PYTHON_BIN') ?? 'python3',
	};
};
