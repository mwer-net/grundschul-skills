/**
 * Die Bildwerkzeuge für Sitzungen der Claude-App (280): derselbe `erstelleBildWerkzeug` wie in den Läufen der
 * Schoolbox, aber ohne laufenden Lauf, im Prozess des MCP-Servers `schoolbox-bilder` (`app-bilder-start.ts`, gestartet
 * aus `.mcp.json` über `bin/schoolbox-bilder`). Jeder Aufruf nennt das Dokument (`<mappe>/<dokument>`).
 *
 * Der Arbeitsordner ist die Mappe: Die Bilder liegen gleich in `bilder/` der Mappe, wo das Material sie als
 * `../../bilder/<datei>` einbindet und die Schoolbox sie mit Herkunft (`bilder/bilder-herkunft.tsv`) zeigt; der
 * Vertrag steht in `bilder.json` der Mappe, Prüfbilder und Vorversionen unter `ansicht/bilder/`, Grundposen der
 * Figurenbibliothek unter `referenzen/`. Grenzen: die eines Blatts je Dokument und `MAX_AUFRUFE_SITZUNG` je Prozess.
 *
 * Die Sitzung läuft im Auto-Modus, das Repo ist öffentlich: Das Dokument muss es unter `MATERIAL_DIR` geben, ohne Link
 * auf dem Weg dorthin; Referenzen kommen nur aus der Mappe (und darin nur aus den Quellen des Werkzeugs), nie von
 * anderswo. Der Schlüssel steht in keiner Antwort.
 */
import { existsSync } from 'node:fs';
import { lstat, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BibliotheksFigur, Konfig } from '@schoolbox/kern';
import { kopieGrund, leseBibliothek, SchoolboxFehler, zerlegeZiel } from '@schoolbox/kern';

import { BILD_API_GESPERRT } from './bild-api';
import type { Zuschnitt } from './bild-datei';
import { ANSICHT_BILDER, BILDER_LISTE, istDateiname, pruefBildPfade } from './bild-datei';
import { BILD_GRENZEN } from './bild-grenzen';
import type { BildWerkzeug } from './bild-werkzeug';
import { BILD_HERKUNFT, erstelleBildWerkzeug, REFERENZ_ORDNER, VERSUCHE } from './bild-werkzeug';
import type { BildApi, BildKonfig } from './bild-zugang';
import { grundposeReferenz } from './bild-zugang';
import type { BildOrt, WerkzeugSchema } from './werkzeug-schemas';
import { BILD_BEARBEITEN, BILD_ERZEUGEN, bildWerkzeugSchemas } from './werkzeug-schemas';

export const APP_BILDER_SERVER = 'schoolbox-bilder';
/** Je Sitzung (Prozess) über alle Dokumente; je Dokument gilt die Grenze eines Blatts (`BILD_GRENZEN.aufrufe.blatt`). */
export const MAX_AUFRUFE_SITZUNG = 3 * BILD_GRENZEN.aufrufe.blatt;
const MAX_FIGUREN_TEXT = 30;
/** Prüfbilder in der Antwort, je Bild und zusammen; was darüber liegt, nennt nur der Pfad. */
const MAX_BILD_BYTES = 3_500_000;
const MAX_BILDER_BYTES = 12_000_000;

export type AppBilderKonfig = BildKonfig & Pick<Konfig, 'materialDir' | 'wurzel'>;

export interface AppFigur {
	/** Dateiname in `referenzen/` ohne Endung (die ID der Figur). */
	name: string;
	/** Die Grundpose. */
	datei: string;
	/** Pfad relativ zur Mappe, z. B. `referenzen/willi.png`. */
	pfad: string;
	/** Der Name der Figur für den Text. */
	anzeige: string;
}

export interface AppBilderOptionen {
	konfig: AppBilderKonfig;
	/** Ohne Angabe die Grundposen der Figurenbibliothek. */
	figuren?: AppFigur[];
	/** Für Tests: statt der echten Bild-API und statt `blatt.py viertel`. */
	api?: BildApi;
	zuschnitt?: Zuschnitt;
	jetzt?: () => Date;
}

export type McpInhalt = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

export interface AppAntwort {
	content: McpInhalt[];
	isError: boolean;
}

class Abgelehnt extends Error {}

const gesperrtText = (grund: string) =>
	`${BILD_API_GESPERRT}: ${grund} Frage in dieser Sitzung kein Bild mehr über die Bild-API an.`;

/** Die Grundposen der Figurenbibliothek als Referenzen, wie der Blatt-Lauf sie nimmt (`grundposeReferenz`). */
export const ladeAppFiguren = async (konfig: AppBilderKonfig): Promise<AppFigur[]> => {
	const bibliothek: BibliotheksFigur[] = await leseBibliothek(konfig, konfig.materialDir).catch(() => []);
	const figuren: AppFigur[] = [];
	for (const f of bibliothek) {
		const r = await grundposeReferenz(konfig.materialDir, f).catch(() => null);
		if (r) {
			figuren.push({ name: r.name, datei: r.datei, pfad: r.pfad, anzeige: f.name });
		}
	}
	return figuren;
};

/** Wie die Beschreibung der Werkzeuge Ablage und Quellen in der Claude-App nennt. */
const appOrt = (figuren: readonly AppFigur[]): BildOrt => {
	const liste = figuren
		.slice(0, MAX_FIGUREN_TEXT)
		.map((f) => `${f.pfad} (${f.anzeige})`)
		.join(', ');
	return {
		ablage: 'bilder/<datei> der Mappe (im Material ../../bilder/<datei>)',
		liste: `${BILDER_LISTE} der Mappe (materialien/<mappe>/${BILDER_LISTE})`,
		quellen:
			'bilder/, dokumente/<dokument>/bilder/, referenzen/ und den Vorversionen in ansicht/bilder/versuche/; der Arbeitsordner ist hier die Mappe, ein Pfad darf mit materialien/<mappe>/ beginnen',
		versuche: 'ansicht/bilder/versuche/ der Mappe',
		vorab: {
			dokument: {
				type: 'string',
				description: 'Das Dokument wie bei den Befehlen der Schoolbox: <mappe>/<dokument>.',
			},
		},
		zusatz: `Die Antwort zeigt die Prüfbilder.${liste ? ` Grundposen der Figurenbibliothek als Referenz: ${liste}.` : ''}`,
	};
};

const istObjekt = (w: unknown): w is Record<string, unknown> =>
	typeof w === 'object' && w !== null && !Array.isArray(w);

/** Ein Eintrag, den es geben darf, ist ein echter Ordner bzw. eine echte Datei, kein Link. */
const keinLink = async (voll: string, ordner: boolean) => {
	const info = await lstat(voll).catch(() => null);
	if (info && (ordner ? !info.isDirectory() : !info.isFile())) {
		throw new Abgelehnt('Die Ablage der Mappe ist nicht in Ordnung: Dort liegt ein Link oder etwas Unerwartetes.');
	}
};

/**
 * Die Bildwerkzeuge der Claude-App. `schemas` für `tools/list`, `aufruf` für `tools/call`; Werkzeuge entstehen je
 * Dokument beim ersten Aufruf.
 */
export const erstelleAppBilder = (o: AppBilderOptionen) => {
	const { konfig } = o;
	const figurenLaden = (o.figuren ? Promise.resolve(o.figuren) : ladeAppFiguren(konfig)).catch(
		() => [] as AppFigur[],
	);
	const werkzeuge = new Map<string, Promise<BildWerkzeug>>();
	let gesperrt: string | null = null;
	let laufend = 0;
	const schluessel = konfig.openaiSchluessel;
	const praefix = path.relative(konfig.wurzel, konfig.materialDir).split(path.sep).join('/');

	const ohneGeheimnis = (text: string) => {
		const ohne = schluessel ? text.split(schluessel).join('…') : text;
		return ohne.replace(/sk-[A-Za-z0-9_*-]{6,}/g, 'sk-…');
	};

	const aufrufeBisher = async () => {
		let summe = 0;
		for (const w of werkzeuge.values()) {
			summe += await w.then(
				(x) => x.stand().aufrufe,
				() => 0,
			);
		}
		return summe;
	};

	/** Das Dokument unter `MATERIAL_DIR`, ohne Link auf dem Weg: nur dann ist `realpath` genau der erwartete Pfad. */
	const findeDokument = async (dokument: unknown) => {
		if (typeof dokument !== 'string' || dokument.length > 200) {
			throw new Abgelehnt('„dokument“ fehlt: <mappe>/<dokument> wie bei den Befehlen der Schoolbox.');
		}
		let ziel;
		try {
			ziel = zerlegeZiel(dokument, true);
		} catch (fehler) {
			throw new Abgelehnt(fehler instanceof SchoolboxFehler ? fehler.message : '„dokument“ ist ungültig.');
		}
		const dok = ziel.dok ?? '';
		const basis = await realpath(konfig.materialDir).catch(() => null);
		const mappeDir = path.join(konfig.materialDir, ziel.mappe);
		const dokDir = path.join(mappeDir, 'dokumente', dok);
		const echt = await realpath(dokDir).catch(() => null);
		const quelle = await lstat(path.join(dokDir, 'material.html')).catch(() => null);
		if (!basis || echt !== path.join(basis, ziel.mappe, 'dokumente', dok) || !quelle?.isFile()) {
			throw new Abgelehnt(
				`Das Dokument „${dokument}“ gibt es nicht. „schoolbox/bin/schoolbox liste“ zeigt die Mappen und Dokumente.`,
			);
		}
		return { mappe: ziel.mappe, dok, mappeDir };
	};

	/** Was das Werkzeug in der Mappe liest und schreibt, ist kein Link nach draußen (280). */
	const pruefeAblage = async (mappeDir: string, dok: string, datei: string, figuren: readonly AppFigur[]) => {
		const ordner = ['bilder', REFERENZ_ORDNER, 'ansicht', ANSICHT_BILDER, VERSUCHE, `dokumente/${dok}/bilder`];
		const dateien = [
			BILDER_LISTE,
			`bilder/${BILD_HERKUNFT}`,
			`bilder/${datei}`,
			...pruefBildPfade(datei, true),
			...figuren.map((f) => f.pfad),
		];
		for (const rel of ordner) {
			await keinLink(path.join(mappeDir, rel), true);
		}
		for (const rel of dateien) {
			await keinLink(path.join(mappeDir, rel), false);
		}
	};

	/** Ein Bild der Mappe, das ein anderes Dokument zeigt, gehört diesem: Ein neues Bild bekommt einen eigenen Namen. */
	const pruefeFremd = async (mappeDir: string, dok: string, datei: string) => {
		const andere = (await readdir(path.join(mappeDir, 'dokumente')).catch(() => [] as string[])).filter(
			(d) => d !== dok,
		);
		for (const d of andere) {
			const html = await readFile(path.join(mappeDir, 'dokumente', d, 'material.html'), 'utf8').catch(() => '');
			if (html.includes(`../../bilder/${datei}`)) {
				throw new Abgelehnt(
					`bilder/${datei} zeigt schon ein anderes Material dieser Mappe. Nimm für dieses Bild einen anderen Dateinamen.`,
				);
			}
		}
	};

	const werkzeugFuer = (mappe: string, dok: string, mappeDir: string, figuren: AppFigur[]) => {
		const key = `${mappe}/${dok}`;
		let w = werkzeuge.get(key);
		if (!w) {
			w = (async () => {
				const liste = path.join(mappeDir, BILDER_LISTE);
				if (!existsSync(liste)) {
					await writeFile(liste, '[]\n', { flag: 'wx' }).catch(() => undefined);
				}
				return await erstelleBildWerkzeug({
					arbeit: mappeDir,
					art: 'blatt',
					konfig,
					api: o.api,
					zuschnitt: o.zuschnitt,
					jetzt: o.jetzt,
					figuren: figuren.map((f) => ({ name: f.name, datei: f.datei })),
					referenzQuellen: [`dokumente/${dok}/bilder`],
					pruefeVertrag: kopieGrund,
				});
			})();
			werkzeuge.set(key, w);
			void w.catch(() => werkzeuge.delete(key));
		}
		return w;
	};

	/** Die Prüfbilder dieses Aufrufs als Bilder; fehlen sie, das Bild selbst. */
	const bilderDerAntwort = async (mappeDir: string, datei: string, seit: number): Promise<McpInhalt[]> => {
		const kandidaten = pruefBildPfade(datei, true);
		const frisch: string[] = [];
		for (const rel of kandidaten) {
			const info = await stat(path.join(mappeDir, rel)).catch(() => null);
			if (info?.isFile() && info.mtimeMs >= seit - 1000) {
				frisch.push(rel);
			}
		}
		const liste = frisch.length ? frisch : [`bilder/${datei}`];
		const inhalt: McpInhalt[] = [];
		let summe = 0;
		for (const rel of liste) {
			const daten = await readFile(path.join(mappeDir, rel)).catch(() => null);
			if (!daten || daten.length > MAX_BILD_BYTES || summe + daten.length > MAX_BILDER_BYTES) {
				continue;
			}
			summe += daten.length;
			inhalt.push({ type: 'text', text: rel });
			inhalt.push({
				type: 'image',
				data: daten.toString('base64'),
				mimeType: rel.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
			});
		}
		return inhalt;
	};

	const fuehreAus = async (name: string, argumente: Record<string, unknown>): Promise<AppAntwort> => {
		const beginn = Date.now();
		const { dokument, ...rest } = argumente;
		const { dok, mappe, mappeDir } = await findeDokument(dokument);
		if (!schluessel && !o.api) {
			throw new Abgelehnt(gesperrtText('Auf dem Server fehlt der Schlüssel für die Bild-API.'));
		}
		if (gesperrt) {
			throw new Abgelehnt(gesperrt);
		}
		const { datei } = rest;
		if (!istDateiname(datei)) {
			throw new Abgelehnt(
				'„datei“ ist ungültig: Kleinbuchstaben, Ziffern und Bindestrich, Endung .png oder .jpg, ohne Ordner.',
			);
		}
		const figuren = await figurenLaden;
		await pruefeAblage(mappeDir, dok, datei, figuren);
		await pruefeFremd(mappeDir, dok, datei);
		if ((await aufrufeBisher()) + laufend >= MAX_AUFRUFE_SITZUNG) {
			throw new Abgelehnt(
				`Die Obergrenze von ${MAX_AUFRUFE_SITZUNG} Bildaufrufen für diese Sitzung ist erreicht. Frage kein Bild mehr über die Bild-API an.`,
			);
		}
		const vorsilbe = praefix && !praefix.startsWith('..') ? `${praefix}/${mappe}/` : null;
		if (Array.isArray(rest.referenzen)) {
			rest.referenzen = rest.referenzen.map((r: unknown) =>
				typeof r === 'string' && vorsilbe && r.startsWith(vorsilbe) ? r.slice(vorsilbe.length) : r,
			);
		}
		const werkzeug = await werkzeugFuer(mappe, dok, mappeDir, figuren);
		laufend += 1;
		let antwort;
		try {
			antwort = await werkzeug.aufruf(name, rest);
		} finally {
			laufend -= 1;
		}
		if (werkzeug.stand().gesperrt) {
			gesperrt = gesperrtText('OpenAI erzeugt keine Bilder mehr (Guthaben, Ausgabenlimit oder Schlüssel).');
		}
		if (antwort.fehler) {
			return { content: [{ type: 'text', text: ohneGeheimnis(antwort.text) }], isError: true };
		}
		const kopf = `Mappe: materialien/${mappe}/ (die Pfade unten sind relativ dazu). Im Material: ../../bilder/${datei}`;
		return {
			content: [
				{ type: 'text', text: ohneGeheimnis(`${kopf}\n${antwort.text}`) },
				...(await bilderDerAntwort(mappeDir, datei, beginn)),
			],
			isError: false,
		};
	};

	return {
		/** Die Werkzeuge für `tools/list`: wie in den Läufen, dazu `dokument`. */
		schemas: async (): Promise<WerkzeugSchema[]> => bildWerkzeugSchemas(false, appOrt(await figurenLaden)),
		namen: [BILD_ERZEUGEN, BILD_BEARBEITEN],
		aufruf: async (name: string, argumente: unknown): Promise<AppAntwort> => {
			if (name !== BILD_ERZEUGEN && name !== BILD_BEARBEITEN) {
				return { content: [{ type: 'text', text: `Unbekanntes Werkzeug „${name}“.` }], isError: true };
			}
			try {
				return await fuehreAus(name, istObjekt(argumente) ? { ...argumente } : {});
			} catch (fehler) {
				if (fehler instanceof Abgelehnt) {
					return { content: [{ type: 'text', text: fehler.message }], isError: true };
				}
				console.error(
					'Bild für die Claude-App:',
					fehler instanceof Error ? ohneGeheimnis(fehler.message) : '?',
				);
				return {
					content: [{ type: 'text', text: 'Das Bild ließ sich nicht ablegen. Versuche es noch einmal.' }],
					isError: true,
				};
			}
		},
	};
};

export type AppBilder = ReturnType<typeof erstelleAppBilder>;
