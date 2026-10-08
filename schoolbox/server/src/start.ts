import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ladeKonfig } from '@schoolbox/kern';

import { erstelleApp } from './app';
import type { ServerKonfig } from './konfig';
import { pruefeServerKonfig } from './konfig';
import { erstelleKontext } from './kontext';
import { starteUeberwachung } from './ueberwachung';

const SCHLIESSEN_MS = 3000;

/** Paketversion plus Commit, damit nach dem Ausrollen an /healthz zu sehen ist, welcher Stand läuft. */
const leseVersion = (wurzel: string): string => {
	const paket = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
	try {
		const commit = execFileSync('git', ['-C', wurzel, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
		return `${paket.version}+${commit.trim()}`;
	} catch {
		return paket.version;
	}
};

const ladeServerKonfig = (): ServerKonfig => {
	try {
		return pruefeServerKonfig(ladeKonfig());
	} catch (fehler) {
		console.error(fehler instanceof Error ? fehler.message : fehler);
		process.exit(1);
	}
};

const starte = async () => {
	const konfig = ladeServerKonfig();
	const kontext = erstelleKontext(konfig, leseVersion(konfig.wurzel));
	const ueberwachung = await starteUeberwachung(kontext);
	const server = erstelleApp(kontext).listen(konfig.portNummer, konfig.hostName, () => {
		console.log(`Schoolbox ${kontext.version} läuft auf http://${konfig.hostName}:${konfig.portNummer}`);
		console.log(`Ablage: ${konfig.materialDir}`);
	});
	server.on('error', (fehler) => {
		console.error('Server ließ sich nicht starten:', fehler.message);
		process.exit(1);
	});

	const beenden = (signal: string) => {
		console.log(`${signal} erhalten, Schoolbox wird beendet.`);
		ueberwachung.stop();
		server.close(() => process.exit(0));
		server.closeAllConnections();
		setTimeout(() => process.exit(0), SCHLIESSEN_MS).unref();
	};
	process.on('SIGINT', () => beenden('SIGINT'));
	process.on('SIGTERM', () => beenden('SIGTERM'));
};

starte().catch((fehler: unknown) => {
	console.error('Schoolbox ließ sich nicht starten:', fehler);
	process.exit(1);
});
