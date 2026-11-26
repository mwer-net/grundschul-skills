/**
 * Die Werkzeuge der Schoolbox für Claude-Läufe, als kleiner MCP-Server über stdin und stdout. Er tut nichts selbst:
 * Jeder Aufruf geht als `{werkzeug, argumente}` über den Unix-Socket des Laufs an den Schoolbox-Server
 * (`src/ki-werkzeug.ts`), der allein weiß, welches Material gemeint ist, und die Argumente prüft. Ohne Abhängigkeiten,
 * damit `claude` ihn mit bloßem `node` starten kann. Welche Werkzeuge es gibt (237), schreibt der Server vor dem Start
 * in die Datei, die das zweite Argument nennt (`src/werkzeug-schemas.ts`, seit 280 eine Quelle mit dem Bilder-Server
 * der Claude-App).
 */
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

const socket = process.argv[2];
const WERKZEUGE = JSON.parse(readFileSync(process.argv[3] ?? '', 'utf8'));

const TEXTE = {
	bauen: ['Der Bau ist gerade nicht erreichbar.', 'Der Bau hat nicht geantwortet.'],
	pruefen: ['Die Prüfung ist gerade nicht erreichbar.', 'Die Prüfung hat nicht geantwortet.'],
	bild: ['Die Bild-API des Servers ist gerade nicht erreichbar.', 'Die Bild-API des Servers hat nicht geantwortet.'],
};

const frage = (anfrage) =>
	new Promise((resolve) => {
		const [nichtDa, stumm] = TEXTE[anfrage.werkzeug] ?? TEXTE.bild;
		const verbindung = connect(socket);
		let antwort = '';
		verbindung.on('connect', () => verbindung.write(`${JSON.stringify(anfrage)}\n`));
		verbindung.on('data', (teil) => {
			antwort += teil.toString();
		});
		verbindung.on('error', () => resolve({ text: nichtDa, fehler: true }));
		verbindung.on('close', () => {
			try {
				resolve(JSON.parse(antwort));
			} catch {
				resolve({ text: stumm, fehler: true });
			}
		});
	});

const sende = (nachricht) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...nachricht })}\n`);

const bearbeite = async ({ id, method, params }) => {
	if (id === undefined) {
		return;
	}
	if (method === 'initialize') {
		sende({
			id,
			result: {
				protocolVersion: params?.protocolVersion ?? '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: { name: 'schoolbox', version: '1' },
			},
		});
	} else if (method === 'ping') {
		sende({ id, result: {} });
	} else if (method === 'tools/list') {
		sende({ id, result: { tools: WERKZEUGE } });
	} else if (method === 'tools/call' && WERKZEUGE.some((w) => w.name === params?.name)) {
		const argumente =
			params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
				? params.arguments
				: {};
		const { fehler, text } = await frage({ werkzeug: params.name, argumente });
		sende({ id, result: { content: [{ type: 'text', text: String(text) }], isError: fehler === true } });
	} else {
		sende({ id, error: { code: -32601, message: 'Unbekannte Methode' } });
	}
};

createInterface({ input: process.stdin }).on('line', (zeile) => {
	try {
		void bearbeite(JSON.parse(zeile));
	} catch {
		// Keine JSON-Zeile: gehört nicht zum Protokoll.
	}
});
