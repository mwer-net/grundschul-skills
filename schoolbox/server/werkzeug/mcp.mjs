/**
 * Das Werkzeug „bauen“ für Claude-Läufe der Schoolbox, als kleiner MCP-Server über stdin und stdout. Er baut nichts
 * selbst: Jeder Aufruf geht über den Unix-Socket des Laufs an den Schoolbox-Server (`src/ki-werkzeug.ts`), der allein
 * weiß, welches Material gemeint ist. Ohne Abhängigkeiten, damit `claude` ihn mit bloßem `node` starten kann.
 */
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

const socket = process.argv[2];
const mitDokument = process.argv[3] === 'einheit';

const WERKZEUG = {
	name: 'bauen',
	description: mitDokument
		? 'Baut ein Material der Einheit wie `blatt.py bauen` und liefert den Prüfbericht und die Seitenbilder für die visuelle Endkontrolle.'
		: 'Baut material.html wie `blatt.py bauen` und liefert den Prüfbericht und die Seitenbilder für die visuelle Endkontrolle.',
	inputSchema: {
		type: 'object',
		properties: mitDokument
			? { dokument: { type: 'string', description: 'Der Slug des Materials, wie in einheit.json.' } }
			: {},
		required: mitDokument ? ['dokument'] : [],
	},
};

const frage = (anfrage) =>
	new Promise((resolve) => {
		const verbindung = connect(socket);
		let antwort = '';
		verbindung.on('connect', () => verbindung.write(`${JSON.stringify(anfrage)}\n`));
		verbindung.on('data', (teil) => {
			antwort += teil.toString();
		});
		verbindung.on('error', () => resolve({ text: 'Der Bau ist gerade nicht erreichbar.', fehler: true }));
		verbindung.on('close', () => {
			try {
				resolve(JSON.parse(antwort));
			} catch {
				resolve({ text: 'Der Bau hat nicht geantwortet.', fehler: true });
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
		sende({ id, result: { tools: [WERKZEUG] } });
	} else if (method === 'tools/call' && params?.name === WERKZEUG.name) {
		const dokument = typeof params.arguments?.dokument === 'string' ? params.arguments.dokument : undefined;
		const { fehler, text } = await frage({ dokument });
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
