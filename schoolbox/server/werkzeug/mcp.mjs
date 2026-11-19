/**
 * Die Werkzeuge der Schoolbox für Claude-Läufe, als kleiner MCP-Server über stdin und stdout. Er tut nichts selbst:
 * Jeder Aufruf geht als `{werkzeug, argumente}` über den Unix-Socket des Laufs an den Schoolbox-Server
 * (`src/ki-werkzeug.ts`), der allein weiß, welches Material gemeint ist, und die Argumente prüft. Ohne Abhängigkeiten,
 * damit `claude` ihn mit bloßem `node` starten kann. Welche Werkzeuge es gibt, hängt an der Art (237):
 * `blatt` und `einheit` bauen, mit dem Zusatz `bilder` dazu die Bildwerkzeuge; `bilder` hat nur diese; `recherche`
 * hat „pruefen“, das `recherche.md` zählt und prüft, auch das im Server.
 */
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

const socket = process.argv[2];
const art = process.argv[3];
const mitBildern = art === 'bilder' || process.argv[4] === 'bilder';

/** Wie `BILD_FORMATE` in `kern/src/bild-formate.ts`; ein Test hält beide gleich. */
const FORMATE = [
	'LANDSCAPE_2_1',
	'LANDSCAPE_16_9',
	'LANDSCAPE_3_2',
	'LANDSCAPE_4_3',
	'LANDSCAPE_5_4',
	'SQUARE_1_1',
	'PORTRAIT_4_5',
	'PORTRAIT_3_4',
	'PORTRAIT_2_3',
	'PORTRAIT_9_16',
	'PORTRAIT_1_2',
];

const BAUEN = {
	name: 'bauen',
	description:
		art === 'einheit'
			? 'Baut ein Material der Einheit wie `blatt.py bauen` und liefert den Prüfbericht und die Seitenbilder für die visuelle Endkontrolle.'
			: 'Baut material.html wie `blatt.py bauen` und liefert den Prüfbericht und die Seitenbilder für die visuelle Endkontrolle.',
	inputSchema: {
		type: 'object',
		properties:
			art === 'einheit'
				? { dokument: { type: 'string', description: 'Der Slug des Materials, wie in einheit.json.' } }
				: {},
		required: art === 'einheit' ? ['dokument'] : [],
	},
};

const PRUEFEN = {
	name: 'pruefen',
	description:
		'Zählt die Zeichen von recherche.md genau wie der Server und prüft die Datei wie er: Länge, HTML, Steuerzeichen, Sätze an eine KI, Quellen. Antwortet „In Ordnung“ oder nennt, was fehlt.',
	inputSchema: { type: 'object', properties: {}, required: [] },
};

const DATEI = {
	type: 'string',
	description: 'Dateiname in bilder/, z. B. fall-1.jpg: Kleinbuchstaben, Ziffern, Bindestrich, .png oder .jpg.',
};
const PROMPT = { type: 'string', description: 'Der Prompt für das Bildmodell.' };
const befund = (wann) => ({
	type: 'string',
	description: `Der Fehler, den ${wann} behebt, in einem Satz, höchstens 300 Zeichen. Für denselben Fehler derselbe Wortlaut.`,
});
const referenzen = (max) => ({
	type: 'array',
	items: { type: 'string' },
	maxItems: max,
	description: `Höchstens ${max} Bilder, relativ zum Arbeitsordner, nur aus bilder/, referenzen/ und den Vorversionen in ansicht/bilder/versuche/. Im Prompt mit Nummer und Rolle benennen („Bild 1 zeigt …“).`,
});

const BILD_ERZEUGEN = {
	name: 'bild_erzeugen',
	description:
		'Erzeugt ein neues Bild über die Bild-API und legt es unter bilder/<datei> ab, dazu die Prüfbilder. Vorher muss in bilder.json der Vertrag mit dieser datei und einem motiv stehen. format ist einer der Formatnamen; transparent nur bei .png. Ein Aufruf kann bis zu zwei Minuten dauern.',
	inputSchema: {
		type: 'object',
		properties: {
			datei: DATEI,
			prompt: PROMPT,
			format: { type: 'string', enum: FORMATE },
			referenzen: referenzen(4),
			transparent: { type: 'boolean', description: 'Freigestellt auf transparentem Hintergrund, nur bei .png.' },
			befund: befund('das neue Bild'),
		},
		required: ['datei', 'prompt', 'format'],
	},
};

const BILD_BEARBEITEN = {
	name: 'bild_bearbeiten',
	description:
		'Bearbeitet ein vorhandenes Bild in bilder/ und ersetzt es; Format und Transparenz bleiben. Die Vorversion bleibt unter ansicht/bilder/versuche/ und kann Referenz sein („stelle … wie in Bild 2 wieder her“). Im Prompt „Ändere nur …“ und aufzählen, was bleibt; eine Änderung je Aufruf, eine Bearbeitung je Fehler. Danach neue Prüfbilder.',
	inputSchema: {
		type: 'object',
		properties: { datei: DATEI, prompt: PROMPT, referenzen: referenzen(3), befund: befund('diese Bearbeitung') },
		required: ['datei', 'prompt', 'befund'],
	},
};

const WERKZEUGE =
	art === 'recherche'
		? [PRUEFEN]
		: [...(art === 'bilder' ? [] : [BAUEN]), ...(mitBildern ? [BILD_ERZEUGEN, BILD_BEARBEITEN] : [])];

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
