/**
 * Schema der Abbildungen aus `abbildungen.js` (018): welche Attribute ein `x-…`-Element hat, wie sie heißen, welche
 * Werte gelten und welche Regeln zwischen ihnen. Das Abbildungs-Panel baut daraus seine Eingaben; ein neues Element
 * braucht nur einen Eintrag hier. Rechnet nur über Text-Patches auf der Quelle, wie die anderen Editor-Befehle.
 */

import type { Knoten } from './quelltext';
import { attribut, setzeAttribut, wendeAn, zerlege } from './quelltext';
import type { StrukturErgebnis } from './struktur';

/** Ein zweites Attribut für denselben Wert, das `abbildungen.js` nur im Beispiel und auf dem Lösungsblatt zeichnet. */
interface Loesung {
	attribut: string;
	/** Beschriftung des Schalters, z. B. „Zeiger nur in der Lösung“. */
	name: string;
	/** Stehen beide Attribute in der Quelle, zeichnet `abbildungen.js` dieses (sonst das sichtbare). */
	vorrang?: boolean;
}

interface FeldBasis {
	attribut: string;
	name: string;
	hilfe?: string;
	loesung?: Loesung;
}

export interface ZahlFeld extends FeldBasis {
	art: 'zahl';
	min: number;
	max: number;
	/** Was `abbildungen.js` ohne Attribut nimmt. */
	standard: number;
	schritt?: number;
	einheit?: string;
}

export interface UhrzeitFeld extends FeldBasis {
	art: 'uhrzeit';
}

export interface AuswahlFeld extends FeldBasis {
	art: 'auswahl';
	/** `wert: null` entfernt das Attribut, dann gilt der Standard aus `abbildungen.js`. */
	optionen: { wert: string | null; name: string }[];
	/** Was `abbildungen.js` ohne Attribut zeichnet, wenn es dafür eine eigene Option gibt. */
	standard?: string;
}

export interface SchalterFeld extends FeldBasis {
	art: 'schalter';
	an: string;
	aus: string;
	standard: boolean;
}

/** Eine Liste von Zahlen, z. B. die beschrifteten Zahlen am Zahlenstrahl. */
export interface ZahlenFeld extends FeldBasis {
	art: 'zahlen';
	beispiel: string;
}

/** Eine Zahl je Stelle einer Stellentafel; die Stellen stehen im Feld `stellen`. */
export interface ZiffernFeld extends FeldBasis {
	art: 'ziffern';
	stellen: string;
}

export type Feld = ZahlFeld | UhrzeitFeld | AuswahlFeld | SchalterFeld | ZahlenFeld | ZiffernFeld;

/** Attributname → Wert in der Quelle, `null` = fehlt. Enthält auch die Lösungs-Attribute. */
export type Werte = Record<string, string | null>;

/** Feld (`attribut`) → Meldung für die Lehrkraft. */
export type Fehler = Record<string, string>;

export interface AbbildungSchema {
	name: string;
	felder: Feld[];
	/** Regeln über mehrere Felder; laufen nur, wenn jedes Feld für sich gültig ist. */
	regeln?: (w: Lesen) => Fehler;
}

/** Zugriff auf die wirksamen Werte innerhalb einer Regel. */
export interface Lesen {
	zahl: (attribut: string) => number;
	zahlen: (attribut: string) => number[];
	text: (attribut: string) => string | null;
}

const STELLEN_STANDARD = 'Z E';

const GROESSE = { attribut: 'groesse', name: 'Größe', einheit: 'px' } as const;

const ZEHNER_EINER = (zehner: string, einer: string): AbbildungSchema['felder'] => [
	{ art: 'zahl', attribut: 'z', name: zehner, min: 0, max: 10, standard: 0 },
	{ art: 'zahl', attribut: 'e', name: einer, min: 0, max: 20, standard: 0 },
];

const mindestensEins = (w: Lesen): Fehler =>
	w.zahl('z') + w.zahl('e') === 0 ? { e: 'Mindestens ein Zehner oder ein Einer.' } : {};

export const ABBILDUNG_SCHEMA = {
	'x-uhr': {
		name: 'Uhr',
		felder: [
			{
				art: 'uhrzeit',
				attribut: 'zeit',
				name: 'Uhrzeit',
				hilfe: 'Ohne Uhrzeit bleibt die Uhr leer, zum Einzeichnen.',
				loesung: { attribut: 'loesung', name: 'Zeiger nur in der Lösung' },
			},
			{ art: 'schalter', attribut: 'ziffern', name: 'Ziffern 1 bis 12', an: 'ja', aus: 'nein', standard: true },
			{ art: 'zahl', ...GROESSE, min: 48, max: 300, standard: 88, schritt: 8 },
		],
	},
	'x-menge': {
		name: 'Menge',
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Anzahl', min: 1, max: 100, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'form',
				name: 'Form',
				standard: 'kreis',
				optionen: [
					{ wert: 'kreis', name: 'Kreise' },
					{ wert: 'plaettchen', name: 'Plättchen' },
					{ wert: 'nuss', name: 'Nüsse' },
				],
			},
			{ art: 'zahl', attribut: 'reihe', name: 'In einer Reihe', min: 1, max: 10, standard: 10 },
			{
				art: 'zahl',
				attribut: 'buendel',
				name: 'Eingekreiste Zehner',
				min: 0,
				max: 10,
				standard: 0,
				loesung: { attribut: 'buendel-loesung', name: 'Nur in der Lösung einkreisen', vorrang: true },
			},
			{ art: 'zahl', ...GROESSE, min: 8, max: 40, standard: 16, schritt: 2 },
		],
		regeln: (w): Fehler => {
			const buendel = w.zahl('buendel');
			if (buendel > 0 && w.zahl('reihe') !== 10) {
				return { buendel: 'Zehner einkreisen geht nur mit 10 in einer Reihe.' };
			}
			const voll = Math.floor(w.zahl('n') / 10);
			if (buendel > voll) {
				return {
					buendel:
						voll === 0
							? 'Es gibt keinen vollen Zehner zum Einkreisen.'
							: `Es gibt nur ${voll} volle ${voll === 1 ? 'Zehnerreihe' : 'Zehnerreihen'}.`,
				};
			}
			return {};
		},
	},
	'x-dienes': {
		name: 'Zehnerstangen und Einerwürfel',
		felder: [
			...ZEHNER_EINER('Zehnerstangen', 'Einerwürfel'),
			{ art: 'zahl', ...GROESSE, min: 4, max: 16, standard: 8 },
		],
		regeln: mindestensEins,
	},
	'x-strichpunkt': {
		name: 'Strich-Punkt-Bild',
		felder: [
			...ZEHNER_EINER('Striche (Zehner)', 'Punkte (Einer)'),
			{ art: 'zahl', ...GROESSE, min: 20, max: 80, standard: 40, schritt: 4 },
		],
		regeln: mindestensEins,
	},
	'x-stellentafel': {
		name: 'Stellentafel',
		felder: [
			{
				art: 'auswahl',
				attribut: 'stellen',
				name: 'Stellen',
				standard: STELLEN_STANDARD,
				optionen: [
					{ wert: 'E', name: 'E' },
					{ wert: 'Z E', name: 'Z E' },
					{ wert: 'H Z E', name: 'H Z E' },
					{ wert: 'T H Z E', name: 'T H Z E' },
					{ wert: 'ZT T H Z E', name: 'ZT T H Z E' },
				],
			},
			{
				art: 'ziffern',
				attribut: 'werte',
				name: 'Zahlen in der Tafel',
				stellen: 'stellen',
				loesung: { attribut: 'loesung', name: 'Nur in der Lösung zeigen' },
			},
			{ art: 'zahl', attribut: 'zeilen', name: 'Zeilen', min: 1, max: 6, standard: 1 },
		],
	},
	'x-zwanzigerfeld': {
		name: 'Zwanzigerfeld',
		felder: [
			{ art: 'zahl', attribut: 'n', name: 'Plättchen', min: 0, max: 20, standard: 0 },
			{ art: 'zahl', ...GROESSE, min: 12, max: 40, standard: 22, schritt: 2 },
		],
	},
	'x-zahlenstrahl': {
		name: 'Zahlenstrahl',
		felder: [
			{ art: 'zahl', attribut: 'von', name: 'Von', min: 0, max: 100000, standard: 0 },
			{ art: 'zahl', attribut: 'bis', name: 'Bis', min: 1, max: 100000, standard: 20 },
			{ art: 'zahl', attribut: 'schritt', name: 'Abstand der Striche', min: 1, max: 10000, standard: 1 },
			{
				art: 'zahlen',
				attribut: 'zahlen',
				name: 'Beschriftete Zahlen',
				beispiel: '0 5 10',
				hilfe: 'Leer: nur Anfang und Ende.',
			},
			{
				art: 'zahlen',
				attribut: 'pfeile',
				name: 'Pfeile mit Kästchen',
				beispiel: '7 13',
				hilfe: 'Die Zahl im Kästchen steht nur in der Lösung.',
			},
			{
				art: 'zahl',
				attribut: 'breite',
				name: 'Breite',
				einheit: 'px',
				min: 200,
				max: 1000,
				standard: 560,
				schritt: 20,
			},
			{ art: 'zahl', attribut: 'schrift', name: 'Schriftgröße', einheit: 'px', min: 10, max: 28, standard: 16 },
		],
		regeln: (w): Fehler => {
			const von = w.zahl('von');
			const bis = w.zahl('bis');
			if (von >= bis) {
				return { bis: '„Bis“ muss größer sein als „Von“.' };
			}
			const striche = (bis - von) / w.zahl('schritt');
			if (striche > 200) {
				return {
					schritt: `Das wären ${Math.ceil(striche)} Striche. Nimm einen größeren Abstand (höchstens 200).`,
				};
			}
			const fehler: Fehler = {};
			for (const feld of ['zahlen', 'pfeile']) {
				const draussen = w.zahlen(feld).find((z) => z < von || z > bis);
				if (draussen !== undefined) {
					fehler[feld] = `${draussen} liegt nicht zwischen ${von} und ${bis}.`;
				}
			}
			return fehler;
		},
	},
	'x-timer': {
		name: 'Timer',
		felder: [
			{ art: 'zahl', attribut: 'minuten', name: 'Minuten', min: 1, max: 120, standard: 10 },
			{
				art: 'auswahl',
				attribut: 'skala',
				name: 'Skala',
				hilfe: 'Für kurze Phasen 5 oder 10 Minuten, sonst ist die Scheibe kaum zu sehen.',
				optionen: [
					{ wert: null, name: 'Passend (60 bzw. 120)' },
					{ wert: '5', name: '5 Minuten' },
					{ wert: '10', name: '10 Minuten' },
					{ wert: '15', name: '15 Minuten' },
					{ wert: '30', name: '30 Minuten' },
					{ wert: '60', name: '60 Minuten' },
					{ wert: '120', name: '120 Minuten' },
				],
			},
			{ art: 'zahl', ...GROESSE, min: 120, max: 600, standard: 360, schritt: 20 },
		],
		regeln: (w): Fehler => {
			const skala = w.text('skala');
			return skala !== null && w.zahl('minuten') > Number(skala)
				? { skala: `Die Skala reicht nur bis ${skala}. Nimm eine größere oder „Passend“.` }
				: {};
		},
	},
} satisfies Record<string, AbbildungSchema>;

export type Abbildung = keyof typeof ABBILDUNG_SCHEMA;

/**
 * Attribute, die `abbildungen.js` liest, die das Panel aber bewusst nicht anbietet: `rest` setzt `praesentation.js`
 * zur Laufzeit, während ein Timer abläuft.
 */
export const NUR_ZUR_LAUFZEIT = ['rest'];

export const schemaVon = (tag: string): AbbildungSchema | undefined =>
	(ABBILDUNG_SCHEMA as Record<string, AbbildungSchema>)[tag];

export const attributeVon = (schema: AbbildungSchema) =>
	schema.felder.flatMap((f) => (f.loesung ? [f.attribut, f.loesung.attribut] : [f.attribut]));

// ── Werte lesen und schreiben ───────────────────────────────────────────────

export const werteVon = (schema: AbbildungSchema, k: Knoten): Werte =>
	Object.fromEntries(attributeVon(schema).map((a) => [a, attribut(k, a)?.wert ?? null]));

/** Wert eines Feldes und ob er nur in der Lösung steht; mit beiden Attributen gilt, was `abbildungen.js` zeichnet. */
export const feldWert = (feld: Feld, w: Werte): { wert: string | null; nurLoesung: boolean } => {
	const sichtbar = w[feld.attribut] ?? null;
	const loesung = feld.loesung ? (w[feld.loesung.attribut] ?? null) : null;
	if (loesung !== null && (sichtbar === null || feld.loesung?.vorrang)) {
		return { wert: loesung, nurLoesung: true };
	}
	return { wert: sichtbar, nurLoesung: false };
};

export const stellenVon = (w: Werte, attributName: string) =>
	(w[attributName] ?? STELLEN_STANDARD).split(/\s+/).filter(Boolean);

export const listeVon = (wert: string | null) => (wert ?? '').split(/[\s,;]+/).filter(Boolean);

/** Ziffern je Stelle als Attributwert; leere Stellen am Ende fallen weg, eine ganz leere Tafel hat keinen Wert. */
export const ziffernText = (liste: string[]) => {
	const bis = liste.findLastIndex((z) => z.trim() !== '');
	return bis < 0
		? null
		: liste
				.slice(0, bis + 1)
				.map((z) => z.trim() || '?')
				.join(' ');
};

/**
 * Ändert ein Feld. Mit Lösungs-Gegenstück steht der Wert danach in genau einem der beiden Attribute. Ändern sich die
 * Stellen einer Stellentafel, bleiben die Zahlen rechtsbündig an ihrer Stelle (der Einer bleibt der Einer).
 */
export const aendereFeld = (
	schema: AbbildungSchema,
	w: Werte,
	feld: Feld,
	wert: string | null,
	nurLoesung = feldWert(feld, w).nurLoesung,
): Werte => {
	const neu = { ...w };
	if (feld.loesung) {
		neu[feld.attribut] = nurLoesung ? null : wert;
		neu[feld.loesung.attribut] = nurLoesung ? wert : null;
	} else {
		neu[feld.attribut] = wert;
	}
	for (const f of schema.felder) {
		if (f.art !== 'ziffern' || f.stellen !== feld.attribut) {
			continue;
		}
		const alt = stellenVon(w, f.stellen).length;
		const jetzt = stellenVon(neu, f.stellen).length;
		const { nurLoesung: nur, wert: ziffern } = feldWert(f, neu);
		if (ziffern === null || alt === jetzt) {
			continue;
		}
		const liste = Array.from({ length: alt }, (_, i) => listeVon(ziffern)[i] ?? '');
		const gerueckt = jetzt > alt ? [...Array<string>(jetzt - alt).fill(''), ...liste] : liste.slice(alt - jetzt);
		Object.assign(neu, aendereFeld(schema, neu, f, ziffernText(gerueckt), nur));
	}
	return neu;
};

/** Die Attribute, die sich zwischen zwei Fassungen unterscheiden. */
export const unterschiede = (alt: Werte, neu: Werte) =>
	Object.keys(neu).filter((a) => (alt[a] ?? null) !== (neu[a] ?? null));

// ── Prüfen ──────────────────────────────────────────────────────────────────

const ZAHL = /^-?\d+([.,]\d+)?$/;

export const alsZahl = (wert: string) => (ZAHL.test(wert.trim()) ? Number(wert.trim().replace(',', '.')) : NaN);

const zahlText = (n: number) => String(n).replace('.', ',');

const pruefeFeld = (feld: Feld, w: Werte): string | null => {
	const { wert } = feldWert(feld, w);
	switch (feld.art) {
		case 'zahl': {
			if (wert === null) {
				return null;
			}
			const n = alsZahl(wert);
			if (!Number.isInteger(n) || n < feld.min || n > feld.max) {
				return `Bitte eine ganze Zahl von ${zahlText(feld.min)} bis ${zahlText(feld.max)}.`;
			}
			return null;
		}
		case 'uhrzeit': {
			if (wert === null) {
				return null;
			}
			const teile = /^(\d{1,2}):(\d{2})$/.exec(wert.trim());
			const [stunde, minute] = [Number(teile?.[1]), Number(teile?.[2])];
			if (!teile || stunde > 23 || minute > 59) {
				return 'Bitte eine Uhrzeit wie 4:30 (Minuten 0 bis 59).';
			}
			return null;
		}
		case 'schalter':
			return wert === null || wert === feld.an || wert === feld.aus
				? null
				: `Nur „${feld.an}“ oder „${feld.aus}“.`;
		case 'zahlen': {
			const falsch = listeVon(wert).find((z) => Number.isNaN(alsZahl(z)));
			return falsch === undefined ? null : `„${falsch}“ ist keine Zahl. Trenne die Zahlen mit Leerzeichen.`;
		}
		case 'ziffern': {
			const stellen = stellenVon(w, feld.stellen);
			const liste = listeVon(wert);
			if (liste.length > stellen.length) {
				return `Die Tafel hat nur ${stellen.length} ${stellen.length === 1 ? 'Stelle' : 'Stellen'}.`;
			}
			const luecke = liste.findIndex((z) => z === '?');
			if (luecke >= 0) {
				return `Bei „${stellen[luecke] ?? ''}“ fehlt eine Zahl. Trag eine ein oder nimm weniger Stellen.`;
			}
			const falsch = liste.find((z) => !/^\d{1,2}$/.test(z));
			return falsch === undefined ? null : `„${falsch}“ geht nicht. Bitte je Stelle eine Zahl von 0 bis 99.`;
		}
		default:
			return null;
	}
};

const leser = (schema: AbbildungSchema, w: Werte): Lesen => {
	const feld = (a: string) => schema.felder.find((f) => f.attribut === a);
	return {
		text: (a) => {
			const f = feld(a);
			return f ? feldWert(f, w).wert : (w[a] ?? null);
		},
		zahl: (a) => {
			const f = feld(a);
			const wert = f ? feldWert(f, w).wert : null;
			if (wert !== null) {
				return alsZahl(wert);
			}
			return f?.art === 'zahl' ? f.standard : 0;
		},
		zahlen: (a) => {
			const f = feld(a);
			return listeVon(f ? feldWert(f, w).wert : null).map(alsZahl);
		},
	};
};

/** Leer heißt gültig. Erst jedes Feld für sich, dann die Regeln zwischen den Feldern. */
export const pruefeWerte = (schema: AbbildungSchema, w: Werte): Fehler => {
	const fehler: Fehler = {};
	for (const feld of schema.felder) {
		const meldung = pruefeFeld(feld, w);
		if (meldung) {
			fehler[feld.attribut] = meldung;
		}
	}
	return Object.keys(fehler).length > 0 || !schema.regeln ? fehler : schema.regeln(leser(schema, w));
};

// ── Befehl ──────────────────────────────────────────────────────────────────

/**
 * Setzt die Attribute einer Abbildung (`null` entfernt eines). Nur diese Attribute ändern sich in der Quelle; die
 * Nummern der Elemente bleiben, die Auswahl auch.
 */
export const setzeAbbildung = (quelle: string, nr: number, werte: Werte): StrukturErgebnis => {
	const k = zerlege(quelle).knoten[nr];
	const schema = k ? schemaVon(k.tag) : undefined;
	if (!k || !schema) {
		throw new Error(`Das Element ${nr} ist keine Abbildung.`);
	}
	const fehler = Object.values(pruefeWerte(schema, { ...werteVon(schema, k), ...werte }));
	if (fehler.length > 0) {
		throw new Error(fehler[0]);
	}
	let neu = quelle;
	for (const [name, wert] of Object.entries(werte)) {
		const z = zerlege(neu);
		const knoten = z.knoten[nr];
		if (knoten) {
			neu = wendeAn(neu, setzeAttribut(z, knoten, name, wert));
		}
	}
	return { quelle: neu, nr };
};
