/**
 * Der MCP-Server `schoolbox-bilder` für Sitzungen der Claude-App (280), über stdin und stdout. Startet aus `.mcp.json`
 * im Hauptordner über `bin/schoolbox-bilder`; die Werkzeuge macht `app-bilder.ts`. Konfiguration und Schlüssel kommen
 * aus der `.env` wie beim Server, an Claude geht davon nichts.
 */
import { createInterface } from 'node:readline';

import type { BildQualitaet } from '@schoolbox/kern';
import { BILD_QUALITAETEN, ladeKonfig, STANDARD_BILD_QUALITAET } from '@schoolbox/kern';

import { APP_BILDER_SERVER, erstelleAppBilder } from './app-bilder';

// stdout gehört dem Protokoll: Was sonst dort landen würde, geht nach stderr.
console.log = console.error;
console.info = console.error;

const konfig = ladeKonfig();
const qualitaet = (BILD_QUALITAETEN as readonly string[]).includes(konfig.bildQualitaet)
	? (konfig.bildQualitaet as BildQualitaet)
	: STANDARD_BILD_QUALITAET;
const bilder = erstelleAppBilder({ konfig: { ...konfig, bildQualitaet: qualitaet } });

interface Anfrage {
	id?: unknown;
	method?: unknown;
	params?: { protocolVersion?: unknown; name?: unknown; arguments?: unknown };
}

const sende = (nachricht: Record<string, unknown>) => {
	process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...nachricht })}\n`);
};

const bearbeite = async ({ id, method, params }: Anfrage) => {
	if (id === undefined) {
		return;
	}
	if (method === 'initialize') {
		sende({
			id,
			result: {
				protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: { name: APP_BILDER_SERVER, version: '1' },
			},
		});
	} else if (method === 'ping') {
		sende({ id, result: {} });
	} else if (method === 'tools/list') {
		sende({ id, result: { tools: await bilder.schemas() } });
	} else if (method === 'tools/call' && typeof params?.name === 'string' && bilder.namen.includes(params.name)) {
		sende({ id, result: await bilder.aufruf(params.name, params.arguments) });
	} else {
		sende({ id, error: { code: -32601, message: 'Unbekannte Methode' } });
	}
};

createInterface({ input: process.stdin }).on('line', (zeile) => {
	let anfrage: unknown;
	try {
		anfrage = JSON.parse(zeile);
	} catch {
		return;
	}
	if (typeof anfrage === 'object' && anfrage !== null) {
		bearbeite(anfrage as Anfrage).catch((fehler: unknown) => {
			console.error('schoolbox-bilder:', fehler instanceof Error ? fehler.message : fehler);
		});
	}
});
