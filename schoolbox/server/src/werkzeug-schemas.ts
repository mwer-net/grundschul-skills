/**
 * Die Werkzeuge, die Claude über MCP sieht: Name, Beschreibung und Eingabeschema. Eine Quelle für beide MCP-Server:
 * `werkzeug/mcp.mjs` der Läufe bekommt die Liste vom Server als Datei (`starteWerkzeug`), der Bilder-Server der
 * Claude-App (`app-bilder.ts`, 280) nimmt dieselben Bildwerkzeuge mit dem Parameter `dokument`.
 */
import { BILD_FORMAT_NAMEN } from '@schoolbox/kern';

export const BILD_ERZEUGEN = 'bild_erzeugen';
export const BILD_BEARBEITEN = 'bild_bearbeiten';
export const BILD_VERTRAG = 'bild_vertrag';
export const BILD_PRUEFUNG = 'bild_pruefung';

export interface WerkzeugSchema {
	name: string;
	description: string;
	inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
}

/** Welche Werkzeuge ein Lauf anbietet, hängt an der Art (237). */
export type WerkzeugArt = 'blatt' | 'einheit' | 'recherche' | 'bilder';

/** Wo die Bildwerkzeuge ablegen und lesen, in den Worten der Beschreibung. */
export interface BildOrt {
	/** Wohin das Bild kommt, z. B. „bilder/<datei>“. */
	ablage: string;
	/** Wo der Vertrag steht, z. B. „bilder.json“. */
	liste: string;
	/** Woher Referenzen kommen dürfen, als Satzteil nach „nur aus“. */
	quellen: string;
	/** Wo die Vorversion bleibt. */
	versuche: string;
	/** Weitere Parameter vor den übrigen, etwa `dokument` in der Claude-App. */
	vorab?: Record<string, unknown>;
	/** Ein Satz am Ende der Beschreibung von `bild_erzeugen`. */
	zusatz?: string;
}

export const LAUF_ORT: BildOrt = {
	ablage: 'bilder/<datei>',
	liste: 'bilder.json',
	quellen: 'bilder/, referenzen/ und den Vorversionen in ansicht/bilder/versuche/',
	versuche: 'ansicht/bilder/versuche/',
};

const DATEI = {
	type: 'string',
	description: 'Dateiname in bilder/, z. B. fall-1.jpg: Kleinbuchstaben, Ziffern, Bindestrich, .png oder .jpg.',
};
const PROMPT = { type: 'string', description: 'Der Prompt für das Bildmodell.' };
const befund = (wann: string) => ({
	type: 'string',
	description: `Der Fehler, den ${wann} behebt, in einem Satz, höchstens 300 Zeichen. Für denselben Fehler derselbe Wortlaut.`,
});
const referenzen = (max: number, ort: BildOrt) => ({
	type: 'array',
	items: { type: 'string' },
	maxItems: max,
	description: `Höchstens ${max} Bilder, relativ zum Arbeitsordner, nur aus ${ort.quellen}. Im Prompt mit Nummer und Rolle benennen („Bild 1 zeigt …“).`,
});

/** Der Bildvertrag als Parameter (252), wie ein Eintrag in bilder.json; der Server schreibt ihn vor dem Bild. */
const VERTRAG = {
	motiv: { type: 'string', description: 'Was das Bild zeigt, in einem Satz, höchstens 300 Zeichen.' },
	platz: {
		type: 'object',
		properties: { breite: { type: 'number' }, hoehe: { type: 'number' } },
		required: ['breite', 'hoehe'],
		description: 'Der Platz im Material in px.',
	},
	blickpunkt: {
		type: 'object',
		properties: { x: { type: 'number' }, y: { type: 'number' } },
		required: ['x', 'y'],
		description: 'Wo das Wichtige liegt, in Prozent von links und oben.',
	},
	vertrag: {
		type: 'object',
		properties: {
			pflicht: { type: 'array', description: 'Je Pflichtobjekt ein Eintrag mit was, zahl, farbe, lage.' },
			buehne: { type: 'string' },
			verboten: { type: 'array', items: { type: 'string' } },
		},
		description: 'Der Bildvertrag: pflicht, buehne, verboten, bei einem Zettel als Ebene frei.',
	},
	figur: { type: 'string', description: 'Nur bei einer Figur allein: ihr Name aus dem Plan.' },
	pose: { type: 'string', description: 'Nur mit figur: „grund“ oder die Pose.' },
};
const VERTRAG_TEXT =
	' Den Vertrag gibst du mit (motiv, platz, blickpunkt, vertrag, bei einer Figur allein figur und pose); der Server schreibt ihn in bilder.json, bevor das Bild entsteht. Ein Feld, das du weglässt, bleibt, wie es war.';

const PUNKTE = (was: string) => ({
	type: 'array',
	items: { type: 'string' },
	maxItems: 20,
	description: `${was}, je ein Satz, höchstens 300 Zeichen.`,
});

/** `bild_erzeugen` und `bild_bearbeiten`, mit Vertrag (252) dazu `bild_vertrag` und `bild_pruefung`. */
export const bildWerkzeugSchemas = (mitVertrag: boolean, ort: BildOrt = LAUF_ORT): WerkzeugSchema[] => {
	const vorab = ort.vorab ?? {};
	const vorabPflicht = Object.keys(vorab);
	const vertrag = mitVertrag ? VERTRAG : {};
	const erzeugen: WerkzeugSchema = {
		name: BILD_ERZEUGEN,
		description: `Erzeugt ein neues Bild über die Bild-API und legt es unter ${ort.ablage} ab, dazu die Prüfbilder.${mitVertrag ? VERTRAG_TEXT : ` Vorher muss in ${ort.liste} der Vertrag mit dieser datei und einem motiv stehen.`} format ist einer der Formatnamen; transparent nur bei .png. Ein Aufruf kann bis zu zwei Minuten dauern.${ort.zusatz ? ` ${ort.zusatz}` : ''}`,
		inputSchema: {
			type: 'object',
			properties: {
				...vorab,
				datei: DATEI,
				prompt: PROMPT,
				format: { type: 'string', enum: [...BILD_FORMAT_NAMEN] },
				referenzen: referenzen(4, ort),
				transparent: {
					type: 'boolean',
					description: 'Freigestellt auf transparentem Hintergrund, nur bei .png.',
				},
				befund: befund('das neue Bild'),
				...vertrag,
			},
			required: [...vorabPflicht, 'datei', 'prompt', 'format'],
		},
	};
	const bearbeiten: WerkzeugSchema = {
		name: BILD_BEARBEITEN,
		description: `Bearbeitet ein vorhandenes Bild in bilder/ und ersetzt es; Format und Transparenz bleiben. Die Vorversion bleibt unter ${ort.versuche} und kann Referenz sein („stelle … wie in Bild 2 wieder her“). Im Prompt „Ändere nur …“ und aufzählen, was bleibt; eine Änderung je Aufruf, eine Bearbeitung je Fehler. Danach neue Prüfbilder.`,
		inputSchema: {
			type: 'object',
			properties: {
				...vorab,
				datei: DATEI,
				prompt: PROMPT,
				referenzen: referenzen(3, ort),
				befund: befund('diese Bearbeitung'),
				...vertrag,
			},
			required: [...vorabPflicht, 'datei', 'prompt', 'befund'],
		},
	};
	if (!mitVertrag) {
		return [erzeugen, bearbeiten];
	}
	return [
		erzeugen,
		bearbeiten,
		{
			name: BILD_VERTRAG,
			description:
				'Liefert den Eintrag eines Bildes aus bilder.json: Vertrag, figur, pose, die Prüfungen und offen. Etwa vor bild_bearbeiten oder einer Prüfung.',
			inputSchema: { type: 'object', properties: { datei: DATEI }, required: ['datei'] },
		},
		{
			name: BILD_PRUEFUNG,
			description:
				'Trägt die Prüfung des letzten Versuchs in bilder.json ein (die Versuchsnummer setzt der Server) und setzt oder löscht offen. Abgenommen ist das Bild, wenn ok etwas nennt und fehlt und verboten leer sind.',
			inputSchema: {
				type: 'object',
				properties: {
					datei: DATEI,
					ok: PUNKTE('Die Punkte aus pflicht, die das Bild erfüllt'),
					fehlt: PUNKTE('Die Punkte aus pflicht, die fehlen oder falsch sind'),
					verboten: PUNKTE('Was aus verboten im Bild ist'),
					offen: {
						type: 'string',
						description: 'Der Fehler, der nach zwei neuen Bildern bleibt, in einem Satz; leer löscht ihn.',
					},
				},
				required: ['datei'],
			},
		},
	];
};

const bauenSchema = (art: WerkzeugArt): WerkzeugSchema => ({
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
});

const PRUEFEN: WerkzeugSchema = {
	name: 'pruefen',
	description:
		'Zählt die Zeichen von recherche.md genau wie der Server und prüft die Datei wie er: Länge, HTML, Steuerzeichen, Sätze an eine KI, Quellen. Antwortet „In Ordnung“ oder nennt, was fehlt.',
	inputSchema: { type: 'object', properties: {}, required: [] },
};

/**
 * Die Werkzeuge eines Laufs (237): `blatt` und `einheit` bauen, mit Bildern dazu die Bildwerkzeuge; `bilder` hat nur
 * diese; `recherche` hat „pruefen“. Mit Vertrag (252) kommen `bild_vertrag` und `bild_pruefung` dazu.
 */
export const laufWerkzeuge = (art: WerkzeugArt, mitBildern: boolean, mitVertrag = false): WerkzeugSchema[] => {
	if (art === 'recherche') {
		return [PRUEFEN];
	}
	const bilder = mitBildern || art === 'bilder' ? bildWerkzeugSchemas(mitVertrag) : [];
	return art === 'bilder' ? bilder : [bauenSchema(art), ...bilder];
};
