import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { schreibeJson } from './atomar';
import { SchoolboxFehler } from './fehler';
import type { JsonSchema } from './schema';
import { ID_MUSTER, pruefeSchema } from './schema';

/**
 * Ordner sind eine logische Schicht über der Ablage (Entscheidung 34): Bewegen ist ein Schreibvorgang in
 * `_ordner.json`, keine Datei wandert. Der Name beginnt mit `_`, darum ignorieren Überwachung und `sammleMappen` sie.
 * Nur der Server schreibt die Datei.
 */
export const ORDNER_DATEI = '_ordner.json';
export const ORDNER_SICHERUNG = '_ordner-sicherung';
export const ORDNER_SPERRE = '_ordner';
export const MAX_NAME = 120;
const STUNDE_MS = 60 * 60 * 1000;
const TAG_MS = 24 * STUNDE_MS;
const MAX_SICHERUNGEN = 50;
const ORDNER_ID = /^o-[0-9a-f]{8}$/;
const ID_REGEX = new RegExp(ID_MUSTER);

export interface Geloescht {
	zeit: string;
	/** Namen der Ordner, in denen das Objekt lag; daraus entsteht der Pfad neu, falls es ihn nicht mehr gibt. */
	herkunft: string[];
}

export interface OrdnerEintrag {
	id: string;
	name: string;
	/** `null`: direkt in „Mein Material“. */
	eltern: string | null;
	/** Mappe, aus der der Ordner entstand; neues Material landet dort. */
	behaelter: string | null;
	erstellt: string;
	geaendert: string;
	geloescht: Geloescht | null;
}

export interface DokumentPlatz {
	ordner: string | null;
	geloescht: Geloescht | null;
}

export interface Baum {
	version: 1;
	rev: number;
	ordner: OrdnerEintrag[];
	/** Schlüssel `mappe/dok`: Dokument-IDs sind nur je Behälter eindeutig. */
	dokumente: Record<string, DokumentPlatz>;
}

export type AblageKnoten = { ordner: string } | { mappe: string; dok: string };

interface AktionsAngaben {
	neu: { eltern: string | null; name?: string; inhalt?: AblageKnoten[]; id?: string };
	umbenennen: { knoten: AblageKnoten; name: string };
	bewegen: { knoten: AblageKnoten[]; ziel: string | null; namen?: Record<string, string> };
	kopieren: { knoten: AblageKnoten[]; ziel: string | null };
	papierkorb: { knoten: AblageKnoten[] };
	zuruecklegen: { knoten: AblageKnoten[] };
	/** Nur als Umkehr von `neu`: entfernt einen Ordner, in dem nichts Lebendes mehr liegt. */
	entfernen: { ordner: string };
}

export type Aktion = { [A in keyof AktionsAngaben]: { art: A } & AktionsAngaben[A] }[keyof AktionsAngaben];

const GELOESCHT_SCHEMA: JsonSchema = {
	type: ['object', 'null'],
	required: ['zeit', 'herkunft'],
	properties: { zeit: { type: 'string' }, herkunft: { type: 'array', items: { type: 'string' } } },
};

export const ORDNER_SCHEMA: JsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'schoolbox/_ordner.json',
	type: 'object',
	required: ['version', 'rev', 'ordner', 'dokumente'],
	properties: {
		version: { enum: [1] },
		rev: { type: 'integer' },
		ordner: {
			type: 'array',
			items: {
				type: 'object',
				required: ['id', 'name', 'eltern', 'behaelter', 'erstellt', 'geaendert', 'geloescht'],
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					eltern: { type: ['string', 'null'] },
					behaelter: { type: ['string', 'null'] },
					geloescht: GELOESCHT_SCHEMA,
				},
			},
		},
		dokumente: { type: 'object' },
	},
};

export const leererBaum = (): Baum => ({ version: 1, rev: 0, ordner: [], dokumente: {} });

export const dokKnotenSchluessel = (mappe: string, dok: string) => `${mappe}/${dok}`;

export const knotenSchluessel = (k: AblageKnoten) => ('ordner' in k ? k.ordner : dokKnotenSchluessel(k.mappe, k.dok));

const zerlegeSchluessel = (schluessel: string) => {
	const [mappe = '', dok = ''] = schluessel.split('/');
	return { mappe, dok };
};

export const neueOrdnerId = () => `o-${randomBytes(4).toString('hex')}`;

const klon = (baum: Baum): Baum => structuredClone(baum);

/* Zugriff --------------------------------------------------------------------------------------------------------- */

const nachId = (baum: Baum) => new Map(baum.ordner.map((o) => [o.id, o]));

/** Gelöscht ist, was selbst oder über einen Vorfahren im Papierkorb liegt. Zyklen zählen nicht als gelöscht. */
export const ordnerGeloescht = (baum: Baum, id: string | null, index = nachId(baum)): boolean => {
	const gesehen = new Set<string>();
	let aktuell = id;
	while (aktuell !== null && !gesehen.has(aktuell)) {
		gesehen.add(aktuell);
		const o = index.get(aktuell);
		if (!o) {
			return false;
		}
		if (o.geloescht) {
			return true;
		}
		aktuell = o.eltern;
	}
	return false;
};

export const dokumentGeloescht = (baum: Baum, mappe: string, dok: string, index = nachId(baum)): boolean => {
	const platz = baum.dokumente[dokKnotenSchluessel(mappe, dok)];
	return platz !== undefined && (platz.geloescht !== null || ordnerGeloescht(baum, platz.ordner, index));
};

export const lebenderOrdner = (baum: Baum, id: string | null): OrdnerEintrag | null => {
	const o = id === null ? undefined : baum.ordner.find((e) => e.id === id);
	return o && !ordnerGeloescht(baum, o.id) ? o : null;
};

/** Der lebende Ordner, der aus dieser Mappe entstand. */
export const ordnerMitBehaelter = (baum: Baum, mappe: string): OrdnerEintrag | null => {
	const index = nachId(baum);
	return baum.ordner.find((o) => o.behaelter === mappe && !ordnerGeloescht(baum, o.id, index)) ?? null;
};

/** Pfad als Namen, von „Mein Material“ abwärts, ohne den Ordner selbst zu verlassen (zyklensicher). */
export const ordnerPfad = (baum: Baum, id: string | null, index = nachId(baum)): OrdnerEintrag[] => {
	const pfad: OrdnerEintrag[] = [];
	const gesehen = new Set<string>();
	let aktuell = id;
	while (aktuell !== null && !gesehen.has(aktuell)) {
		gesehen.add(aktuell);
		const o = index.get(aktuell);
		if (!o) {
			break;
		}
		pfad.unshift(o);
		aktuell = o.eltern;
	}
	return pfad;
};

export const pfadNamen = (baum: Baum, id: string | null) => ordnerPfad(baum, id).map((o) => o.name);

/** Alle lebenden Ordner als `Klasse 3/Mathe`, sortiert. */
export const alleOrdnerPfade = (baum: Baum): { id: string; pfad: string }[] => {
	const index = nachId(baum);
	return baum.ordner
		.filter((o) => !ordnerGeloescht(baum, o.id, index))
		.map((o) => ({
			id: o.id,
			pfad: ordnerPfad(baum, o.id, index)
				.map((e) => e.name)
				.join('/'),
		}))
		.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de', { numeric: true }));
};

/** Dieser Ordner und alles darunter, ohne Gelöschtes, wenn nicht anders verlangt. */
export const ordnerUnter = (baum: Baum, id: string): string[] => {
	const kinder = new Map<string, string[]>();
	for (const o of baum.ordner) {
		if (o.eltern !== null && !o.geloescht) {
			kinder.set(o.eltern, [...(kinder.get(o.eltern) ?? []), o.id]);
		}
	}
	const ergebnis: string[] = [];
	const offen = [id];
	while (offen.length > 0) {
		const aktuell = offen.pop() ?? '';
		if (!ergebnis.includes(aktuell)) {
			ergebnis.push(aktuell);
			offen.push(...(kinder.get(aktuell) ?? []));
		}
	}
	return ergebnis;
};

/** Alle lebenden Dokumente in einem Ordner und seinen Unterordnern. */
export const dokumenteUnter = (baum: Baum, id: string): { mappe: string; dok: string }[] => {
	const ordner = new Set(ordnerUnter(baum, id));
	return Object.entries(baum.dokumente)
		.filter(([, p]) => p.ordner !== null && ordner.has(p.ordner) && !p.geloescht)
		.map(([s]) => zerlegeSchluessel(s));
};

// >> 122
/** Die lebenden Dokumente direkt in einem Ordner, ohne Unterordner (Rezept auf alle Blätter, 122). */
export const dokumenteIn = (baum: Baum, id: string): { mappe: string; dok: string }[] =>
	Object.entries(baum.dokumente)
		.filter(([, p]) => p.ordner === id && !p.geloescht)
		.map(([s]) => zerlegeSchluessel(s));
// << 122

export type ZugangsZiel = { mappe: string; dok: string | null } | { ordner: string };

/**
 * Die eine Stelle, die entscheidet, was ein Teilen-Link zeigt. Ein alter Link auf eine Mappe löst sich in den Ordner
 * mit diesem Behälter auf: Er zeigt, was jetzt im Ordner liegt, nicht, was im Behälter blieb.
 */
export const dokumenteVonZiel = (baum: Baum, ziel: ZugangsZiel): { mappe: string; dok: string }[] => {
	if ('ordner' in ziel) {
		return lebenderOrdner(baum, ziel.ordner) ? dokumenteUnter(baum, ziel.ordner) : [];
	}
	const { dok, mappe } = ziel;
	if (dok !== null) {
		return dokumentGeloescht(baum, mappe, dok) ? [] : [{ mappe, dok }];
	}
	const ordner = ordnerMitBehaelter(baum, mappe);
	return ordner ? dokumenteUnter(baum, ordner.id) : [];
};

/** Der Ordner, den ein Teilen-Ziel zeigt (für Unterordner und Pfad); `null` bei einem einzelnen Dokument. */
export const ordnerVonZiel = (baum: Baum, ziel: ZugangsZiel): OrdnerEintrag | null => {
	if ('ordner' in ziel) {
		return lebenderOrdner(baum, ziel.ordner);
	}
	return ziel.dok === null ? ordnerMitBehaelter(baum, ziel.mappe) : null;
};

/* Lesen, Sichern --------------------------------------------------------------------------------------------------- */

export const ordnerDatei = (materialDir: string) => path.join(materialDir, ORDNER_DATEI);

const sicherungsDir = (materialDir: string) => path.join(materialDir, ORDNER_SICHERUNG);

const zeitName = (zeit: Date) => zeit.toISOString().replace(/[:.]/g, '-');

const zeitAusName = (name: string): Date | null => {
	const t = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)\.json$/.exec(name);
	return t ? new Date(`${t[1]}:${t[2]}:${t[3]}.${t[4]}`) : null;
};

const PLATZ_SCHEMA: JsonSchema = {
	type: 'object',
	required: ['ordner', 'geloescht'],
	properties: { ordner: { type: ['string', 'null'] }, geloescht: GELOESCHT_SCHEMA },
};

/** Die Einträge von `dokumente` haben freie Schlüssel; das kann das Schema nicht ausdrücken. */
const pruefeBaumDaten = (daten: unknown): Baum | null => {
	if (pruefeSchema(ORDNER_SCHEMA, daten).length > 0) {
		return null;
	}
	const baum = daten as Baum;
	return Object.values(baum.dokumente).every((p) => pruefeSchema(PLATZ_SCHEMA, p).length === 0) ? baum : null;
};

const leseBaumRoh = (datei: string): Baum | null => {
	try {
		return pruefeBaumDaten(JSON.parse(readFileSync(datei, 'utf8')) as unknown);
	} catch {
		return null;
	}
};

export const sicherungen = (materialDir: string): string[] => {
	const dir = sicherungsDir(materialDir);
	return existsSync(dir)
		? readdirSync(dir)
				.filter((n) => zeitAusName(n) !== null)
				.sort()
		: [];
};

export interface GeladenerBaum {
	/** `null`: Es gibt noch keinen Baum, der Abgleich baut den ersten. */
	baum: Baum | null;
	hinweis?: string;
}

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/**
 * Liest `_ordner.json`. Eine kaputte Datei wird nie überschrieben, sondern beiseitegelegt; es gilt die neueste gültige
 * Sicherung, und die Oberfläche sagt das. Gibt es keine, baut der Abgleich neu auf: auch das meldet sie.
 */
export const ladeBaum = (materialDir: string, jetzt = new Date()): GeladenerBaum => {
	const datei = ordnerDatei(materialDir);
	if (!existsSync(datei)) {
		return { baum: null };
	}
	const baum = leseBaumRoh(datei);
	if (baum) {
		return { baum };
	}
	renameSync(datei, path.join(materialDir, `_ordner.defekt-${zeitName(jetzt)}.json`));
	for (const name of sicherungen(materialDir).reverse()) {
		const sicherung = path.join(sicherungsDir(materialDir), name);
		const gesichert = leseBaumRoh(sicherung);
		if (gesichert) {
			// Gleich zurückschreiben: Sonst baut der nächste Start ohne Datei alles neu auf und die Struktur ist weg.
			copyFileSync(sicherung, datei);
			const zeit = zeitAusName(name);
			return {
				baum: gesichert,
				hinweis: `Die Ordner wurden aus der Sicherung von ${zeit ? UHRZEIT.format(zeit) : '?'} wiederhergestellt.`,
			};
		}
	}
	return {
		baum: null,
		hinweis:
			'Die Ordnerstruktur ließ sich nicht lesen und musste neu aufgebaut werden. Dein Material ist vollständig.',
	};
};

/** Nur lesen, ohne Folgen: für CLI und `sammleMappen`. Eine kaputte Datei zählt hier als leer. */
export const leseBaumNachsichtig = (materialDir: string): Baum | null => leseBaumRoh(ordnerDatei(materialDir));

const sichere = async (materialDir: string, jetzt: Date, loescht: boolean) => {
	const datei = ordnerDatei(materialDir);
	if (!existsSync(datei)) {
		return;
	}
	const alle = sicherungen(materialDir);
	const letzte = alle.at(-1);
	const zeit = letzte === undefined ? null : zeitAusName(letzte);
	if (!loescht && zeit && jetzt.getTime() - zeit.getTime() < STUNDE_MS) {
		return;
	}
	const dir = sicherungsDir(materialDir);
	await mkdir(dir, { recursive: true });
	await copyFile(datei, path.join(dir, `${zeitName(jetzt)}.json`));
	const namen = (await readdir(dir)).filter((n) => zeitAusName(n) !== null).sort();
	await Promise.all(namen.slice(0, -MAX_SICHERUNGEN).map((n) => rm(path.join(dir, n), { force: true })));
};

/** Schreibt atomar, vorher ggf. eine Sicherung. Nur innerhalb der Sperre `ORDNER_SPERRE` aufrufen. */
export const schreibeBaum = async (materialDir: string, baum: Baum, jetzt = new Date(), loescht = false) => {
	await sichere(materialDir, jetzt, loescht);
	await schreibeJson(ordnerDatei(materialDir), baum);
};

/* Abgleich --------------------------------------------------------------------------------------------------------- */

export interface BestandsMappe {
	id: string;
	titel: string;
	/** Reihenfolge wie in der Mappe. */
	dokumente: { id: string; erstellt: string }[];
	/** `--ordner` aus `schoolbox neu`, gilt nur für die erste Einordnung. */
	ablage?: string;
	erstellt: string;
}

export interface Bestand {
	mappen: BestandsMappe[];
	/** Mappen, die gerade nicht lesbar sind: Ihre Einträge bleiben unangetastet (Claude schreibt von Hand). */
	unlesbar: string[];
}

export interface Abgleich {
	baum: Baum;
	geaendert: boolean;
	meldungen: string[];
}

const gleicherName = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');

const legeOrdnerAn = (
	baum: Baum,
	name: string,
	eltern: string | null,
	behaelter: string | null,
	zeit: string,
	erstellt = zeit,
): OrdnerEintrag => {
	let id = neueOrdnerId();
	while (baum.ordner.some((o) => o.id === id)) {
		id = neueOrdnerId();
	}
	const o = { id, name, eltern, behaelter, erstellt, geaendert: zeit, geloescht: null };
	baum.ordner.push(o);
	return o;
};

/** Sucht je Stück einen lebenden Ordner gleichen Namens und legt an, was fehlt. */
const stellePfadHer = (baum: Baum, namen: readonly string[], zeit: string): { id: string | null; neu: string[] } => {
	const neu: string[] = [];
	let eltern: string | null = null;
	for (const name of namen) {
		const aktuell: string | null = eltern;
		const index = nachId(baum);
		const vorhanden: OrdnerEintrag | undefined = baum.ordner.find(
			(o) => o.eltern === aktuell && gleicherName(o.name, name) && !ordnerGeloescht(baum, o.id, index),
		);
		if (vorhanden) {
			eltern = vorhanden.id;
		} else {
			const angelegt = legeOrdnerAn(baum, name, eltern, null, zeit);
			neu.push(angelegt.id);
			eltern = angelegt.id;
		}
	}
	return { id: eltern, neu };
};

const zerlegeAblage = (ablage: string | undefined) =>
	(ablage ?? '')
		.split('/')
		.map((t) => t.trim())
		.filter(Boolean);

/** Zeigt ein Objekt auf Unbekanntes oder hängt ein Ordner im Kreis, wandert es nach „Mein Material“. */
const repariereVerweise = (baum: Baum, meldungen: string[]) => {
	const index = nachId(baum);
	let geaendert = false;
	for (const o of baum.ordner) {
		if (o.eltern !== null && !index.has(o.eltern)) {
			if (!o.geloescht) {
				meldungen.push(
					`Ordner „${o.name}“ zeigte auf einen unbekannten Ordner und liegt jetzt in „Mein Material“.`,
				);
			}
			o.eltern = null;
			geaendert = true;
		}
	}
	for (const o of baum.ordner) {
		const gesehen = new Set([o.id]);
		let aktuell = o.eltern;
		while (aktuell !== null) {
			if (gesehen.has(aktuell)) {
				meldungen.push(`Ordner „${o.name}“ lag in einem Kreis und liegt jetzt in „Mein Material“.`);
				o.eltern = null;
				geaendert = true;
				break;
			}
			gesehen.add(aktuell);
			aktuell = index.get(aktuell)?.eltern ?? null;
		}
	}
	for (const [schluessel, platz] of Object.entries(baum.dokumente)) {
		if (platz.ordner !== null && !index.has(platz.ordner)) {
			if (!platz.geloescht) {
				meldungen.push(
					`Dokument „${schluessel}“ zeigte auf einen unbekannten Ordner und liegt jetzt in „Mein Material“.`,
				);
			}
			platz.ordner = null;
			geaendert = true;
		}
	}
	return geaendert;
};

const entferneVerschwundene = (baum: Baum, bestand: Bestand) => {
	const unlesbar = new Set(bestand.unlesbar);
	const auf = new Map(bestand.mappen.map((m) => [m.id, new Set(m.dokumente.map((d) => d.id))]));
	let geaendert = false;
	for (const schluessel of Object.keys(baum.dokumente)) {
		const { dok, mappe } = zerlegeSchluessel(schluessel);
		if (!unlesbar.has(mappe) && !auf.get(mappe)?.has(dok)) {
			// `baum` ist hier schon der eigene Klon: Der Eintrag entfällt, die Datei gibt es ja nicht mehr.

			delete baum.dokumente[schluessel];
			geaendert = true;
		}
	}
	return geaendert;
};

/** Wohin ein neues Dokument einer bekannten Mappe gehört. Ohne Ordner: neben das jüngste Geschwister. */
const platzFuerNeues = (baum: Baum, mappe: BestandsMappe, index: Map<string, OrdnerEintrag>) => {
	const eigener = baum.ordner.find((o) => o.behaelter === mappe.id && !ordnerGeloescht(baum, o.id, index));
	if (eigener) {
		return eigener.id;
	}
	const geschwister = [...mappe.dokumente]
		.sort((a, b) => b.erstellt.localeCompare(a.erstellt))
		.map((d) => baum.dokumente[dokKnotenSchluessel(mappe.id, d.id)])
		.find((p) => p && !p.geloescht && !ordnerGeloescht(baum, p.ordner, index));
	return geschwister?.ordner ?? null;
};

/**
 * Macht den Baum zur Sicht auf die Ablage, an der Claude über die CLI vorbeischreibt. Der Abgleich legt nur Neues
 * ein: Er bewegt nie etwas, das schon einen Platz hat. Ohne Baum entsteht je Mappe ein Ordner: Das ist der ganze
 * Erststart. Bleibt alles gleich, ändert sich `rev` nicht und es wird nichts geschrieben.
 */
export const gleicheAb = (vorher: Baum | null, bestand: Bestand, jetzt = new Date()): Abgleich => {
	const meldungen: string[] = [];
	const baum = vorher ? klon(vorher) : leererBaum();
	const zeit = jetzt.toISOString();
	let geaendert = vorher === null;
	geaendert = entferneVerschwundene(baum, bestand) || geaendert;
	geaendert = repariereVerweise(baum, meldungen) || geaendert;
	for (const mappe of [...bestand.mappen].sort((a, b) => a.erstellt.localeCompare(b.erstellt))) {
		const hatOrdner = baum.ordner.some((o) => o.behaelter === mappe.id);
		const hatPlatz = mappe.dokumente.some((d) => baum.dokumente[dokKnotenSchluessel(mappe.id, d.id)] !== undefined);
		if (!hatOrdner && !hatPlatz) {
			const { id: eltern } = stellePfadHer(baum, zerlegeAblage(mappe.ablage), zeit);
			legeOrdnerAn(baum, mappe.titel, eltern, mappe.id, zeit, mappe.erstellt);
			geaendert = true;
		}
		for (const { id } of mappe.dokumente) {
			const schluessel = dokKnotenSchluessel(mappe.id, id);
			if (baum.dokumente[schluessel] === undefined) {
				baum.dokumente[schluessel] = { ordner: platzFuerNeues(baum, mappe, nachId(baum)), geloescht: null };
				geaendert = true;
			}
		}
	}
	if (geaendert) {
		baum.rev += 1;
	}
	return { baum, geaendert, meldungen };
};

/* Aktionen --------------------------------------------------------------------------------------------------------- */

export interface Umgebung {
	jetzt: Date;
	/** Titel eines Dokuments aus `meta.json`; `undefined`, wenn es das Dokument nicht gibt. */
	titel: (mappe: string, dok: string) => string | undefined;
}

interface DokumentTitelAenderung {
	art: 'dokument-titel';
	mappe: string;
	dok: string;
	titel: string;
}
interface MappeTitelAenderung {
	art: 'mappe-titel';
	mappe: string;
	titel: string;
}
export type Effekt = DokumentTitelAenderung | MappeTitelAenderung;

export interface NamensAenderung {
	knoten: AblageKnoten;
	von: string;
	nach: string;
}

export interface AktionsErgebnis {
	baum: Baum;
	umkehr: Aktion[];
	effekte: Effekt[];
	/** Neu angelegter Ordner, soweit es einen gibt. */
	neu?: string;
	/** Die Objekte nach der Aktion, zum Auswählen. */
	knoten: AblageKnoten[];
	/** Bei gleichem Namen bleiben beide: Das Bewegte heißt am Ziel anders. */
	umbenannt: NamensAenderung[];
	loescht: boolean;
}

const nichtMoeglich = (text: string) => new SchoolboxFehler(text);

const pruefeName = (name: unknown): string => {
	const n = typeof name === 'string' ? name.trim() : '';
	if (!n) {
		throw nichtMoeglich('Bitte gib einen Namen ein.');
	}
	if (n.length > MAX_NAME) {
		throw nichtMoeglich(`Der Name ist zu lang (höchstens ${MAX_NAME} Zeichen).`);
	}
	if (n.includes('/')) {
		throw nichtMoeglich('Ein Name darf keinen Schrägstrich enthalten.');
	}
	return n;
};

const NAME_BELEGT = 'Diesen Namen gibt es hier schon.';

/** Was direkt in einem Ordner lebt. Ordner und Material teilen sich die Namen wie im Finder. */
export const namenIn = (baum: Baum, ziel: string | null, u: Umgebung, ausser: ReadonlySet<string> = new Set()) => {
	const namen: string[] = [];
	for (const o of baum.ordner) {
		if (o.eltern === ziel && !o.geloescht && !ausser.has(o.id)) {
			namen.push(o.name);
		}
	}
	for (const [schluessel, p] of Object.entries(baum.dokumente)) {
		if (p.ordner === ziel && !p.geloescht && !ausser.has(schluessel)) {
			const { dok, mappe } = zerlegeSchluessel(schluessel);
			const titel = u.titel(mappe, dok);
			if (titel !== undefined) {
				namen.push(titel);
			}
		}
	}
	return namen;
};

/** Nie ersetzen, nie fragen: beide behalten, „X 2“. */
export const freierName = (wunsch: string, vergeben: readonly string[]) => {
	const belegt = (n: string) => vergeben.some((v) => gleicherName(v, n));
	if (!belegt(wunsch)) {
		return wunsch;
	}
	let n = 2;
	while (belegt(`${wunsch} ${n}`)) {
		n += 1;
	}
	return `${wunsch} ${n}`;
};

const verlangeOrdner = (baum: Baum, id: string): OrdnerEintrag => {
	const o = baum.ordner.find((e) => e.id === id);
	if (!o) {
		throw nichtMoeglich('Diesen Ordner gibt es nicht mehr.');
	}
	return o;
};

const verlangeZiel = (baum: Baum, ziel: string | null) => {
	if (ziel !== null && !lebenderOrdner(baum, ziel)) {
		throw nichtMoeglich('Diesen Ordner gibt es nicht mehr.');
	}
};

const verlangePlatz = (baum: Baum, mappe: string, dok: string): DokumentPlatz => {
	const platz = baum.dokumente[dokKnotenSchluessel(mappe, dok)];
	if (!platz) {
		throw nichtMoeglich('Dieses Material gibt es nicht mehr.');
	}
	return platz;
};

const nameVon = (baum: Baum, k: AblageKnoten, u: Umgebung) =>
	'ordner' in k ? verlangeOrdner(baum, k.ordner).name : (u.titel(k.mappe, k.dok) ?? k.dok);

const ortVon = (baum: Baum, k: AblageKnoten) =>
	'ordner' in k ? verlangeOrdner(baum, k.ordner).eltern : verlangePlatz(baum, k.mappe, k.dok).ordner;

/** Ein Ordner kann nicht in sich selbst oder einen Nachkommen. */
export const istUngueltigesZiel = (baum: Baum, ordner: string, ziel: string | null) => {
	const gesehen = new Set<string>();
	let aktuell = ziel;
	while (aktuell !== null && !gesehen.has(aktuell)) {
		if (aktuell === ordner) {
			return true;
		}
		gesehen.add(aktuell);
		aktuell = baum.ordner.find((o) => o.id === aktuell)?.eltern ?? null;
	}
	return false;
};

const setzeOrt = (baum: Baum, k: AblageKnoten, ziel: string | null, zeit: string) => {
	if ('ordner' in k) {
		const o = verlangeOrdner(baum, k.ordner);
		o.eltern = ziel;
		o.geaendert = zeit;
	} else {
		verlangePlatz(baum, k.mappe, k.dok).ordner = ziel;
	}
};

const setzeName = (baum: Baum, k: AblageKnoten, name: string, zeit: string, effekte: Effekt[]) => {
	if ('ordner' in k) {
		const o = verlangeOrdner(baum, k.ordner);
		o.name = name;
		o.geaendert = zeit;
		if (o.behaelter !== null) {
			effekte.push({ art: 'mappe-titel', mappe: o.behaelter, titel: name });
		}
	} else {
		effekte.push({ art: 'dokument-titel', mappe: k.mappe, dok: k.dok, titel: name });
	}
};

const bewege = (baum: Baum, a: Extract<Aktion, { art: 'bewegen' }>, u: Umgebung): AktionsErgebnis => {
	const zeit = u.jetzt.toISOString();
	verlangeZiel(baum, a.ziel);
	const bewegt = new Set(a.knoten.map(knotenSchluessel));
	const vergeben = namenIn(baum, a.ziel, u, bewegt);
	const effekte: Effekt[] = [];
	const umbenannt: NamensAenderung[] = [];
	const quellen = new Map<string | null, AblageKnoten[]>();
	for (const k of a.knoten) {
		if ('ordner' in k && istUngueltigesZiel(baum, k.ordner, a.ziel)) {
			throw nichtMoeglich('Ein Ordner kann nicht in sich selbst liegen.');
		}
		const von = ortVon(baum, k);
		quellen.set(von, [...(quellen.get(von) ?? []), k]);
		const alt = nameVon(baum, k, u);
		const gewuenscht = a.namen?.[knotenSchluessel(k)] ?? alt;
		// Bleibt ein Objekt, wo es ist, kollidiert es mit nichts Neuem.
		const name = freierName(gewuenscht, von === a.ziel ? [] : vergeben);
		vergeben.push(name);
		setzeOrt(baum, k, a.ziel, zeit);
		if (name !== alt) {
			setzeName(baum, k, name, zeit, effekte);
			umbenannt.push({ knoten: k, von: alt, nach: name });
		}
	}
	const umkehr: Aktion[] = [...quellen.entries()].map(([ziel, knoten]) => {
		const namen = Object.fromEntries(
			umbenannt
				.filter((n) => knoten.some((k) => knotenSchluessel(k) === knotenSchluessel(n.knoten)))
				.map((n) => [knotenSchluessel(n.knoten), n.von]),
		);
		return { art: 'bewegen', knoten, ziel, ...(Object.keys(namen).length > 0 ? { namen } : {}) };
	});
	return { baum, umkehr, effekte, knoten: a.knoten, umbenannt, loescht: false };
};

const neu = (baum: Baum, a: Extract<Aktion, { art: 'neu' }>, u: Umgebung): AktionsErgebnis => {
	const zeit = u.jetzt.toISOString();
	verlangeZiel(baum, a.eltern);
	if (a.id !== undefined && (!ORDNER_ID.test(a.id) || baum.ordner.some((o) => o.id === a.id))) {
		throw nichtMoeglich('Diese Ordner-ID ist ungültig oder vergeben.');
	}
	const vergeben = namenIn(baum, a.eltern, u);
	const wunsch = a.name === undefined ? 'Neuer Ordner' : pruefeName(a.name);
	if (a.name !== undefined && a.id === undefined && vergeben.some((v) => gleicherName(v, wunsch))) {
		throw nichtMoeglich(NAME_BELEGT);
	}
	const o = legeOrdnerAn(baum, freierName(wunsch, vergeben), a.eltern, null, zeit);
	if (a.id !== undefined) {
		o.id = a.id;
	}
	const umkehrEntfernen: Aktion = { art: 'entfernen', ordner: o.id };
	if (!a.inhalt?.length) {
		return {
			baum,
			umkehr: [umkehrEntfernen],
			effekte: [],
			neu: o.id,
			knoten: [{ ordner: o.id }],
			umbenannt: [],
			loescht: false,
		};
	}
	const bewegt = bewege(baum, { art: 'bewegen', knoten: a.inhalt, ziel: o.id }, u);
	return { ...bewegt, umkehr: [...bewegt.umkehr, umkehrEntfernen], neu: o.id, knoten: [{ ordner: o.id }] };
};

const umbenenne = (baum: Baum, a: Extract<Aktion, { art: 'umbenennen' }>, u: Umgebung): AktionsErgebnis => {
	const zeit = u.jetzt.toISOString();
	const name = pruefeName(a.name);
	const alt = nameVon(baum, a.knoten, u);
	const ort = ortVon(baum, a.knoten);
	const lebt =
		'ordner' in a.knoten
			? lebenderOrdner(baum, a.knoten.ordner)
			: !dokumentGeloescht(baum, a.knoten.mappe, a.knoten.dok);
	const effekte: Effekt[] = [];
	if (lebt && namenIn(baum, ort, u, new Set([knotenSchluessel(a.knoten)])).some((v) => gleicherName(v, name))) {
		throw nichtMoeglich(NAME_BELEGT);
	}
	if (name !== alt) {
		setzeName(baum, a.knoten, name, zeit, effekte);
	}
	return {
		baum,
		umkehr: [{ art: 'umbenennen', knoten: a.knoten, name: alt }],
		effekte,
		knoten: [a.knoten],
		umbenannt: [],
		loescht: false,
	};
};

const inPapierkorb = (baum: Baum, a: Extract<Aktion, { art: 'papierkorb' }>, u: Umgebung): AktionsErgebnis => {
	const zeit = u.jetzt.toISOString();
	for (const k of a.knoten) {
		const geloescht = { zeit, herkunft: pfadNamen(baum, ortVon(baum, k)) };
		if ('ordner' in k) {
			const o = verlangeOrdner(baum, k.ordner);
			o.geloescht = geloescht;
		} else {
			verlangePlatz(baum, k.mappe, k.dok).geloescht = geloescht;
		}
	}
	return {
		baum,
		umkehr: [{ art: 'zuruecklegen', knoten: a.knoten }],
		effekte: [],
		knoten: a.knoten,
		umbenannt: [],
		loescht: true,
	};
};

/**
 * Zurück an den alten Ort. Gibt es den nicht mehr (endgültig gelöscht oder selbst im Papierkorb), entsteht der Pfad
 * neu aus den gemerkten Namen. Nichts wird ersetzt.
 */
const zuruecklegen = (baum: Baum, a: Extract<Aktion, { art: 'zuruecklegen' }>, u: Umgebung): AktionsErgebnis => {
	const zeit = u.jetzt.toISOString();
	const effekte: Effekt[] = [];
	const umbenannt: NamensAenderung[] = [];
	const angelegt: string[] = [];
	for (const k of a.knoten) {
		const eintrag = 'ordner' in k ? verlangeOrdner(baum, k.ordner) : verlangePlatz(baum, k.mappe, k.dok);
		const herkunft = eintrag.geloescht?.herkunft ?? [];
		const ort = ortVon(baum, k);
		let ziel = ort;
		if (ort === null ? herkunft.length > 0 : !lebenderOrdner(baum, ort)) {
			const { id, neu: neuePfadOrdner } = stellePfadHer(baum, herkunft, zeit);
			ziel = id;
			angelegt.push(...neuePfadOrdner);
		}
		const alt = nameVon(baum, k, u);
		const name = freierName(alt, namenIn(baum, ziel, u, new Set([knotenSchluessel(k)])));
		setzeOrt(baum, k, ziel, zeit);
		eintrag.geloescht = null;
		if (name !== alt) {
			setzeName(baum, k, name, zeit, effekte);
			umbenannt.push({ knoten: k, von: alt, nach: name });
		}
	}
	const umkehr: Aktion[] = [
		{ art: 'papierkorb', knoten: a.knoten },
		...umbenannt.map((n): Aktion => ({ art: 'umbenennen', knoten: n.knoten, name: n.von })),
		...angelegt.reverse().map((ordner): Aktion => ({ art: 'entfernen', ordner })),
	];
	return { baum, umkehr, effekte, knoten: a.knoten, umbenannt, loescht: false };
};

const entferne = (baum: Baum, a: Extract<Aktion, { art: 'entfernen' }>): AktionsErgebnis => {
	const o = verlangeOrdner(baum, a.ordner);
	if (o.behaelter !== null) {
		throw nichtMoeglich('Dieser Ordner enthält Material und lässt sich nicht entfernen.');
	}
	const lebtDarin =
		baum.ordner.some((e) => e.eltern === o.id && !e.geloescht) ||
		Object.values(baum.dokumente).some((p) => p.ordner === o.id && !p.geloescht);
	if (lebtDarin) {
		throw nichtMoeglich('In diesem Ordner liegt inzwischen etwas. Rückgängig geht deshalb nicht mehr.');
	}
	for (const e of baum.ordner) {
		if (e.eltern === o.id) {
			e.eltern = null;
		}
	}
	for (const p of Object.values(baum.dokumente)) {
		if (p.ordner === o.id) {
			p.ordner = null;
		}
	}
	baum.ordner = baum.ordner.filter((e) => e.id !== o.id);
	return {
		baum,
		umkehr: [{ art: 'neu', eltern: o.eltern, name: o.name, id: o.id }],
		effekte: [],
		knoten: [],
		umbenannt: [],
		loescht: true,
	};
};

/**
 * Reine Funktion: wendet eine Aktion auf eine Kopie des Baums an. Die Antwort enthält ihre Umkehr, aus der ⌘Z und
 * „Rückgängig“ bestehen. Titel auf der Platte ändert erst der Server anhand von `effekte`. `kopieren` braucht die
 * Platte und läuft über `kopiereKnoten` in `ordner-ablage.ts`.
 */
export const wendeAktionAn = (vorher: Baum, aktion: Aktion, u: Umgebung): AktionsErgebnis => {
	const baum = klon(vorher);
	baum.rev += 1;
	switch (aktion.art) {
		case 'neu':
			return neu(baum, aktion, u);
		case 'umbenennen':
			return umbenenne(baum, aktion, u);
		case 'bewegen':
			return bewege(baum, aktion, u);
		case 'papierkorb':
			return inPapierkorb(baum, aktion, u);
		case 'zuruecklegen':
			return zuruecklegen(baum, aktion, u);
		case 'entfernen':
			return entferne(baum, aktion);
		case 'kopieren':
			throw new Error('kopieren läuft über kopiereKnoten.');
	}
};

const istText = (w: unknown): w is string => typeof w === 'string';
const istId = (w: unknown): w is string => istText(w) && ID_REGEX.test(w);

const leseOrdnerId = (roh: unknown) => {
	if (istText(roh) && ORDNER_ID.test(roh)) {
		return roh;
	}
	throw nichtMoeglich('Ein Objekt der Aktion ist ungültig.');
};

const leseKnoten = (roh: unknown): AblageKnoten => {
	const k = (roh ?? {}) as Record<string, unknown>;
	if (istText(k.ordner) && ORDNER_ID.test(k.ordner)) {
		return { ordner: k.ordner };
	}
	if (istId(k.mappe) && istId(k.dok)) {
		return { mappe: k.mappe, dok: k.dok };
	}
	throw nichtMoeglich('Ein Objekt der Aktion ist ungültig.');
};

const leseKnotenListe = (roh: unknown): AblageKnoten[] => {
	if (!Array.isArray(roh) || roh.length === 0) {
		throw nichtMoeglich('Die Aktion nennt keine Objekte.');
	}
	const knoten = roh.map(leseKnoten);
	return [...new Map(knoten.map((k) => [knotenSchluessel(k), k])).values()];
};

const leseZiel = (roh: unknown): string | null => {
	if (roh === null) {
		return null;
	}
	if (istText(roh) && ORDNER_ID.test(roh)) {
		return roh;
	}
	throw nichtMoeglich('Das Ziel der Aktion ist ungültig.');
};

const leseNamen = (roh: unknown): Record<string, string> | undefined => {
	if (roh === undefined) {
		return undefined;
	}
	const namen = Object.entries((roh ?? {}) as Record<string, unknown>).map(([k, n]) => [k, pruefeName(n)]);
	return Object.fromEntries(namen) as Record<string, string>;
};

/** Prüft, was der Browser schickt. Ungültiges wirft: Der Server antwortet dann mit 400. */
export const leseAktion = (roh: unknown): Aktion => {
	const a = (roh ?? {}) as Record<string, unknown>;
	switch (a.art) {
		case 'neu':
			return {
				art: 'neu',
				eltern: leseZiel(a.eltern ?? null),
				...(a.name === undefined ? {} : { name: pruefeName(a.name) }),
				...(a.inhalt === undefined ? {} : { inhalt: leseKnotenListe(a.inhalt) }),
				...(a.id === undefined ? {} : { id: leseOrdnerId(a.id) }),
			};
		case 'umbenennen':
			return { art: 'umbenennen', knoten: leseKnoten(a.knoten), name: pruefeName(a.name) };
		case 'bewegen': {
			const namen = leseNamen(a.namen);
			return {
				art: 'bewegen',
				knoten: leseKnotenListe(a.knoten),
				ziel: leseZiel(a.ziel ?? null),
				...(namen ? { namen } : {}),
			};
		}
		case 'kopieren':
			return { art: 'kopieren', knoten: leseKnotenListe(a.knoten), ziel: leseZiel(a.ziel ?? null) };
		case 'papierkorb':
			return { art: 'papierkorb', knoten: leseKnotenListe(a.knoten) };
		case 'zuruecklegen':
			return { art: 'zuruecklegen', knoten: leseKnotenListe(a.knoten) };
		case 'entfernen':
			return { art: 'entfernen', ordner: leseKnoten({ ordner: a.ordner }) && String(a.ordner) };
		default:
			throw nichtMoeglich('Diese Aktion gibt es nicht.');
	}
};

/* Papierkorb im Baum ----------------------------------------------------------------------------------------------- */

const abgelaufen = (g: Geloescht | null, grenze: number) => g !== null && new Date(g.zeit).getTime() <= grenze;

export interface Faellig {
	/** Dokumente, deren Ordner auf der Platte weg kann. */
	dokumente: { mappe: string; dok: string }[];
	/** Ordner, die aus dem Baum verschwinden. */
	ordner: string[];
}

/** Was nach `tage` Tagen endgültig fällig ist: abgelaufene Einträge samt allem darunter, was nicht eigens gelöscht ist. */
export const faelligImPapierkorb = (baum: Baum, tage: number, jetzt: Date): Faellig => {
	const grenze = jetzt.getTime() - tage * TAG_MS;
	const index = nachId(baum);
	const ordner = new Set<string>();
	for (const o of baum.ordner) {
		if (abgelaufen(o.geloescht, grenze)) {
			ordner.add(o.id);
		}
	}
	const unterAbgelaufen = (id: string | null): boolean => {
		const gesehen = new Set<string>();
		let aktuell = id;
		while (aktuell !== null && !gesehen.has(aktuell)) {
			gesehen.add(aktuell);
			const o = index.get(aktuell);
			if (!o) {
				return false;
			}
			if (ordner.has(aktuell)) {
				return true;
			}
			if (o.geloescht) {
				// Eigens gelöscht: eigene Frist. Darunter gilt sie auch.
				return false;
			}
			aktuell = o.eltern;
		}
		return false;
	};
	for (const o of baum.ordner) {
		if (!o.geloescht && unterAbgelaufen(o.eltern)) {
			ordner.add(o.id);
		}
	}
	const dokumente = Object.entries(baum.dokumente)
		.filter(([, p]) => (p.geloescht ? abgelaufen(p.geloescht, grenze) : unterAbgelaufen(p.ordner)))
		.map(([s]) => zerlegeSchluessel(s));
	return { dokumente, ordner: [...ordner] };
};

/** Trägt Fälliges aus dem Baum aus. Gelöschtes, das noch Frist hat, behält seine Herkunft und verliert den Verweis. */
export const entferneAusBaum = (vorher: Baum, { dokumente, ordner }: Faellig): Baum => {
	const baum = klon(vorher);
	const weg = new Set(ordner);
	baum.ordner = baum.ordner.filter((o) => !weg.has(o.id));
	for (const o of baum.ordner) {
		if (o.eltern !== null && weg.has(o.eltern)) {
			o.eltern = null;
		}
	}
	const dokWeg = new Set(dokumente.map((d) => dokKnotenSchluessel(d.mappe, d.dok)));
	baum.dokumente = Object.fromEntries(Object.entries(baum.dokumente).filter(([s]) => !dokWeg.has(s)));
	for (const p of Object.values(baum.dokumente)) {
		if (p.ordner !== null && weg.has(p.ordner)) {
			p.ordner = null;
		}
	}
	baum.rev += 1;
	return baum;
};
