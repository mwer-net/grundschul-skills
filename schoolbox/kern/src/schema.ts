import { SchoolboxFehler } from './fehler';
import type { Art, Druckprofil, Fach, Format, Klasse, Status } from './werte';
import { ARTEN, DRUCKPROFILE, FAECHER, FORMATE, KLASSEN, STATUS } from './werte';

export interface Mappe {
	id: string;
	titel: string;
	fach: Fach;
	klasse: Klasse;
	erstellt: string;
	geaendert: string;
	status: Status;
	dokumente: string[];
}

export interface Pruefung {
	fehler: number;
	warnungen: number;
	hinweise: number;
}

export interface Entwurf {
	name: string;
	titel: string;
	idee: string;
}

export interface DokumentMeta {
	titel: string;
	art: Art;
	format: Format;
	druckprofil: Druckprofil;
	hatLoesung: boolean;
	druckhinweise: string[];
	status: Status;
	seiten: number;
	pruefung: Pruefung | null;
	entwuerfe: Entwurf[];
	erstellt: string;
	geaendert: string;
}

export interface JsonSchema {
	$schema?: string;
	$id?: string;
	type?: string | string[];
	enum?: readonly unknown[];
	pattern?: string;
	minimum?: number;
	format?: string;
	properties?: Record<string, JsonSchema>;
	required?: readonly string[];
	items?: JsonSchema;
}

export const ID_MUSTER = '^[a-z0-9]+(-[a-z0-9]+)*$';
const ZEIT: JsonSchema = { type: 'string', format: 'date-time' };
const ANZAHL: JsonSchema = { type: 'integer', minimum: 0 };

export const MAPPE_SCHEMA: JsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'schoolbox/mappe.json',
	type: 'object',
	required: ['id', 'titel', 'fach', 'klasse', 'erstellt', 'geaendert', 'status', 'dokumente'],
	properties: {
		id: { type: 'string', pattern: ID_MUSTER },
		titel: { type: 'string' },
		fach: { enum: FAECHER },
		klasse: { enum: KLASSEN },
		erstellt: ZEIT,
		geaendert: ZEIT,
		status: { enum: STATUS },
		dokumente: { type: 'array', items: { type: 'string', pattern: ID_MUSTER } },
	},
};

export const META_SCHEMA: JsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'schoolbox/meta.json',
	type: 'object',
	required: [
		'titel',
		'art',
		'format',
		'druckprofil',
		'hatLoesung',
		'druckhinweise',
		'status',
		'seiten',
		'pruefung',
		'entwuerfe',
		'erstellt',
		'geaendert',
	],
	properties: {
		titel: { type: 'string' },
		art: { enum: ARTEN },
		format: { enum: FORMATE },
		druckprofil: { enum: DRUCKPROFILE },
		hatLoesung: { type: 'boolean' },
		druckhinweise: { type: 'array', items: { type: 'string' } },
		status: { enum: STATUS },
		seiten: ANZAHL,
		pruefung: {
			type: ['object', 'null'],
			required: ['fehler', 'warnungen', 'hinweise'],
			properties: { fehler: ANZAHL, warnungen: ANZAHL, hinweise: ANZAHL },
		},
		entwuerfe: {
			type: 'array',
			items: {
				type: 'object',
				required: ['name', 'titel', 'idee'],
				properties: {
					name: { type: 'string', pattern: '^[A-Z]$' },
					titel: { type: 'string' },
					idee: { type: 'string' },
				},
			},
		},
		erstellt: ZEIT,
		geaendert: ZEIT,
	},
};

const typVon = (wert: unknown): string => {
	if (wert === null) {
		return 'null';
	}
	if (Array.isArray(wert)) {
		return 'array';
	}
	if (typeof wert === 'number' && Number.isInteger(wert)) {
		return 'integer';
	}
	return typeof wert;
};

const passtTyp = (erwartet: string, tatsaechlich: string) =>
	erwartet === tatsaechlich || (erwartet === 'number' && tatsaechlich === 'integer');

export const pruefeSchema = (schema: JsonSchema, wert: unknown, pfad = ''): string[] => {
	const ort = pfad || '(Wurzel)';
	const typ = typVon(wert);
	if (schema.type !== undefined) {
		const erwartet = Array.isArray(schema.type) ? schema.type : [schema.type];
		if (!erwartet.some((e) => passtTyp(e, typ))) {
			return [`${ort}: erwartet ${erwartet.join(' oder ')}, gefunden ${typ}`];
		}
	}
	if (schema.enum && !schema.enum.includes(wert)) {
		return [
			`${ort}: ${JSON.stringify(wert)} ist keiner von ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`,
		];
	}
	if (typeof wert === 'string' && schema.pattern && !new RegExp(schema.pattern).test(wert)) {
		return [`${ort}: „${wert}“ passt nicht zu ${schema.pattern}`];
	}
	if (typeof wert === 'number' && schema.minimum !== undefined && wert < schema.minimum) {
		return [`${ort}: ${wert} ist kleiner als ${schema.minimum}`];
	}
	if (Array.isArray(wert) && schema.items) {
		const items = schema.items;
		return wert.flatMap((w, i) => pruefeSchema(items, w, `${pfad}[${i}]`));
	}
	if (typ !== 'object') {
		return [];
	}
	const objekt = wert as Record<string, unknown>;
	const fehlend = (schema.required ?? []).filter((k) => !(k in objekt)).map((k) => `${ort}: „${k}“ fehlt`);
	const felder = Object.entries(schema.properties ?? {}).flatMap(([k, s]) =>
		k in objekt ? pruefeSchema(s, objekt[k], pfad ? `${pfad}.${k}` : k) : [],
	);
	return [...fehlend, ...felder];
};

export const verlangeSchema = <T>(schema: JsonSchema, wert: unknown, datei: string): T => {
	const fehler = pruefeSchema(schema, wert);
	if (fehler.length > 0) {
		throw new SchoolboxFehler(`${datei} ist ungültig:\n  ${fehler.join('\n  ')}`);
	}
	return wert as T;
};
