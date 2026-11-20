/**
 * Das Werkzeug „bauen“ eines Claude-Laufs: Claude ruft es statt `blatt.py bauen` auf und bekommt denselben Prüfbericht
 * und dieselben Seitenbilder wie in der Claude-App. Bash bekommt der Lauf dafür nicht (Issue 056): Der Bau läuft im
 * Server, Claude erreicht ihn nur über den Unix-Socket seines eigenen Laufordners. Seit 237 kann derselbe MCP-Server
 * mehrere Werkzeuge anbieten, je nach Art des Laufs auch die Bildwerkzeuge; über den Socket läuft `{werkzeug, argumente}`.
 */
import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:net';
import { createServer } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { Ansicht, Meldung, MeldungCode } from '@schoolbox/kern';
import { ANSICHT_ORDNER, HINWEIS_OHNE, WURZEL } from '@schoolbox/kern';

import type { BildWerkzeug, WerkzeugAntwort } from './bild-werkzeug';

export const WERKZEUG_SERVER = 'schoolbox';
export const WERKZEUG_BAUEN = `mcp__${WERKZEUG_SERVER}__bauen`;
/** Im Recherche-Lauf (236) statt „bauen“: zählt die Zeichen von `recherche.md` und prüft sie wie der Server. */
export const WERKZEUG_PRUEFEN = `mcp__${WERKZEUG_SERVER}__pruefen`;
/** Die Bildwerkzeuge (237): erzeugen und bearbeiten über die Bild-API, im Server (`bild-werkzeug.ts`). */
export const BILD_ERZEUGEN = 'bild_erzeugen';
export const BILD_BEARBEITEN = 'bild_bearbeiten';
export const WERKZEUG_BILD_ERZEUGEN = `mcp__${WERKZEUG_SERVER}__${BILD_ERZEUGEN}`;
export const WERKZEUG_BILD_BEARBEITEN = `mcp__${WERKZEUG_SERVER}__${BILD_BEARBEITEN}`;
/** Im Einheit-Lauf (252): Vertrag eines Bildes lesen, Prüfung und `offen` eintragen; `bilder.json` schreibt der Server. */
export const BILD_VERTRAG = 'bild_vertrag';
export const BILD_PRUEFUNG = 'bild_pruefung';
export const WERKZEUG_BILD_VERTRAG = `mcp__${WERKZEUG_SERVER}__${BILD_VERTRAG}`;
export const WERKZEUG_BILD_PRUEFUNG = `mcp__${WERKZEUG_SERVER}__${BILD_PRUEFUNG}`;
const MCP_SKRIPT = path.join(WURZEL, 'schoolbox', 'server', 'werkzeug', 'mcp.mjs');
const MAX_MELDUNGEN = 60;

export type Bauen = (dokument: string | undefined) => Promise<WerkzeugAntwort>;

const MAX_HINWEISE = 15;
/** Hinweise, die hinter alle anderen kommen, damit sie unter den ersten 15 keine wichtigeren verdrängen (249). */
const HINWEIS_ZULETZT: readonly MeldungCode[] = ['antwort-menge'];
const zuletzt = (m: Meldung) => (m.code && HINWEIS_ZULETZT.includes(m.code) ? 1 : 0);

const zeile = (m: Meldung) => `${m.stufe}${m.seite > 0 ? ` Seite ${m.seite}` : ''}: ${m.text}`;

/**
 * Der Text, den Claude nach einem Bau liest. `ordner`: wo die Bilder liegen, aus Sicht seines Arbeitsordners.
 * `zusatz`: Meldungen des Servers zum Lauf (`laufMeldungen`), sie zählen wie die des Prüfberichts (225).
 */
export const ansichtText = ({ bericht, bilder }: Ansicht, ordner = ANSICHT_ORDNER, zusatz: Meldung[] = []) => {
	const alle = [...bericht.meldungen, ...zusatz];
	const meldungen = alle.filter((m) => m.stufe !== 'HINWEIS');
	const hinweise = alle
		.filter((m) => m.stufe === 'HINWEIS' && !(m.code && HINWEIS_OHNE.includes(m.code)))
		.sort((a, b) => zuletzt(a) - zuletzt(b));
	const fehler = meldungen.filter((m) => m.stufe === 'FEHLER').length;
	const seiten = bilder.filter((b) => /^seite-\d+\.png$/.test(b));
	const ausschnitte = bilder.filter((b) => /^seite-\d+-aufgabe-\d+\.png$/.test(b));
	const loesung = bilder.filter((b) => b.startsWith('loesung-'));
	const liste = (namen: string[]) => namen.map((n) => `${ordner}/${n}`).join(', ');
	return [
		`Gebaut: ${seiten.length} ${seiten.length === 1 ? 'Seite' : 'Seiten'}. Prüfbericht: ${fehler} Fehler, ${meldungen.length - fehler} Warnungen, ${hinweise.length} Hinweise.`,
		...meldungen.slice(0, MAX_MELDUNGEN).map(zeile),
		meldungen.length > MAX_MELDUNGEN ? `… und ${meldungen.length - MAX_MELDUNGEN} weitere.` : null,
		hinweise.length ? 'Hinweise (ansehen, kein Zwang):' : null,
		...hinweise.slice(0, MAX_HINWEISE).map(zeile),
		hinweise.length > MAX_HINWEISE ? `… und ${hinweise.length - MAX_HINWEISE} weitere Hinweise.` : null,
		seiten.length ? `Seiten zum Ansehen mit Read: ${liste(seiten)}` : null,
		ausschnitte.length ? `Ausschnitt je Aufgabe: ${liste(ausschnitte)}` : null,
		loesung.length ? `Lösung: ${liste(loesung)}` : null,
		'Sieh dir die Seiten jetzt an (visuelle Endkontrolle). Jeder FEHLER und jeder sichtbare Mangel wird behoben, danach baust du neu.',
	]
		.filter(Boolean)
		.join('\n');
};

/** Welche Werkzeuge der MCP-Server anbietet, hängt an der Art des Laufs (237). */
export type WerkzeugArt = 'blatt' | 'einheit' | 'recherche' | 'bilder';

export interface WerkzeugOptionen {
	/** Die Bildwerkzeuge des Laufs (`erstelleBildWerkzeug`); Pflicht bei `bilder`, bei `blatt`/`einheit` dazu. */
	bilder?: BildWerkzeug | null;
}

const MAX_DOKUMENT = 200;

/** Die Namen der Werkzeuge, wie `mcp.mjs` sie anbietet. */
export const werkzeugNamen = (art: WerkzeugArt, mitBildern: boolean, mitVertrag = false): string[] => {
	if (art === 'recherche') {
		return ['pruefen'];
	}
	const bilder =
		mitBildern || art === 'bilder'
			? [BILD_ERZEUGEN, BILD_BEARBEITEN, ...(mitVertrag ? [BILD_VERTRAG, BILD_PRUEFUNG] : [])]
			: [];
	return art === 'bilder' ? bilder : ['bauen', ...bilder];
};

const istObjekt = (w: unknown): w is Record<string, unknown> =>
	typeof w === 'object' && w !== null && !Array.isArray(w);

/**
 * Öffnet den Socket in `dir` und schreibt die MCP-Konfiguration daneben. `dir` gehört der Schoolbox und hat Modus
 * 0700; mehr Schutz braucht der Socket nicht. Der Name ist kurz und zufällig: Ein Socket-Pfad fasst nur 108 Zeichen.
 * Bei `recherche` bietet der MCP-Server „pruefen“ statt „bauen“ an, `bauen` ist dann die Prüfung. Mit `o.bilder`
 * kommen `bild_erzeugen` und `bild_bearbeiten` dazu; bei `bilder` gibt es nur sie, `bauen` ist dann `null`.
 */
export const starteWerkzeug = async (
	dir: string,
	bauen: Bauen | null,
	art: WerkzeugArt = 'blatt',
	o: WerkzeugOptionen = {},
) => {
	const bilder = art === 'recherche' ? null : (o.bilder ?? null);
	if (art === 'bilder' && !bilder) {
		throw new Error('Werkzeug „bilder“ ohne Bildwerkzeug');
	}
	if (art !== 'bilder' && !bauen) {
		throw new Error(`Werkzeug „${art}“ ohne bauen`);
	}
	const mitVertrag = bilder?.namen.includes(BILD_VERTRAG) === true;
	const namen = werkzeugNamen(art, bilder !== null, mitVertrag);
	const name = `w-${randomBytes(4).toString('hex')}`;
	const socket = path.join(dir, `${name}.sock`);
	const mcpDatei = path.join(dir, `${name}.json`);
	/** Ein Bau zur Zeit: Zwei Aufrufe schrieben sonst in denselben Ordner. Bilder laufen nebenher (bis zu drei). */
	let reihe: Promise<unknown> = Promise.resolve();
	const baue = (dokument: string | undefined) => {
		const lauf = reihe.then(() => (bauen ? bauen(dokument) : { text: 'Bauen gibt es hier nicht.', fehler: true }));
		reihe = lauf.catch(() => undefined);
		return lauf.catch((fehler: unknown) => {
			console.error(art === 'recherche' ? 'Prüfung für Claude:' : 'Bau für Claude:', fehler);
			return {
				text:
					art === 'recherche'
						? 'Die Prüfung ist gescheitert. Rufe pruefen noch einmal auf.'
						: 'Der Bau ist gescheitert. Prüfe das HTML auf offene Tags und baue noch einmal.',
				fehler: true,
			};
		});
	};
	/** Prüft die Argumente je Werkzeug und verteilt; nie mehr, als `mcp.mjs` für diese Art anbietet. */
	const verteile = async (werkzeug: string, argumente: Record<string, unknown>): Promise<WerkzeugAntwort> => {
		if (!namen.includes(werkzeug)) {
			return { text: `Das Werkzeug „${werkzeug}“ gibt es in diesem Lauf nicht.`, fehler: true };
		}
		if (werkzeug === 'pruefen') {
			return await baue(undefined);
		}
		if (werkzeug === 'bauen') {
			const { dokument } = argumente;
			if (dokument !== undefined && (typeof dokument !== 'string' || dokument.length > MAX_DOKUMENT)) {
				return { text: '„dokument“ ist der Slug des Materials, wie in einheit.json.', fehler: true };
			}
			return await baue(dokument);
		}
		return bilder
			? await bilder.aufruf(werkzeug, argumente)
			: { text: 'Keine Bilder in diesem Lauf.', fehler: true };
	};
	const server: Server = createServer((verbindung) => {
		verbindung.on('error', () => undefined);
		createInterface({ input: verbindung }).once('line', (eingang) => {
			const antworte = (ergebnis: WerkzeugAntwort) => verbindung.end(JSON.stringify(ergebnis));
			let anfrage: unknown;
			try {
				anfrage = JSON.parse(eingang);
			} catch {
				anfrage = null;
			}
			if (!istObjekt(anfrage) || typeof anfrage.werkzeug !== 'string') {
				antworte({ text: 'Die Anfrage war ungültig.', fehler: true });
				return;
			}
			const argumente = anfrage.argumente === undefined ? {} : anfrage.argumente;
			if (!istObjekt(argumente)) {
				antworte({ text: 'Die Argumente waren ungültig.', fehler: true });
				return;
			}
			verteile(anfrage.werkzeug, argumente).then(antworte, (fehler: unknown) => {
				console.error('Werkzeug für Claude:', fehler);
				antworte({ text: 'Das Werkzeug ist gescheitert. Versuche es noch einmal.', fehler: true });
			});
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(socket, resolve);
	});
	const mitBildern = [...(bilder !== null && art !== 'bilder' ? ['bilder'] : []), ...(mitVertrag ? ['vertrag'] : [])];
	await writeFile(
		mcpDatei,
		JSON.stringify({
			mcpServers: {
				[WERKZEUG_SERVER]: { command: process.execPath, args: [MCP_SKRIPT, socket, art, ...mitBildern] },
			},
		}),
	);
	return {
		mcpDatei,
		/** Die Werkzeuge für `--allowedTools`, z. B. `mcp__schoolbox__bild_erzeugen`. */
		werkzeuge: namen.map((n) => `mcp__${WERKZEUG_SERVER}__${n}`),
		ende: async () => {
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
			await Promise.all([socket, mcpDatei].map((datei) => rm(datei, { force: true })));
		},
	};
};

export type Werkzeug = Awaited<ReturnType<typeof starteWerkzeug>>;
