/**
 * Wer neue KI-Bilder bekommt (237): Ohne `OPENAI_API_KEY` bekommt kein Lauf Bildwerkzeuge. Hier entstehen die
 * Bildwerkzeuge eines Laufs mit der echten oder (Tests) einer eingespritzten Bild-API, dazu die Sätze für die
 * Lehrkraft und die Grundposen als Referenz.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { BibliotheksFigur } from '@schoolbox/kern';
import { ASSETS, ASSETS_SCHLUESSEL } from '@schoolbox/kern';

import type { BildAnfrage, BildErgebnis } from './bild-api';
import { BildApiFehler, erzeugeBild } from './bild-api';
import { typAus } from './bild-datei';
import { BILD_GRENZEN } from './bild-grenzen';
import type { BildLaufArt, BildWerkzeug } from './bild-werkzeug';
import { erstelleBildWerkzeug, REFERENZ_ORDNER } from './bild-werkzeug';
import type { ServerKonfig } from './konfig';

export const BILDER_AUS =
	'Neue KI-Bilder sind aus: Auf dem Server fehlt der Schlüssel für OpenAI. Der Admin trägt ihn in die .env ein.';
/** Wie `erstelleBildWerkzeug` Figurennamen annimmt. */
const REFERENZ_NAME = /^[a-z0-9][a-z0-9-]{0,59}$/;

export const BILDER_GESPERRT = 'OpenAI hat keine Bilder mehr erzeugt (Guthaben, Ausgabenlimit oder Schlüssel).';

/** Die Bild-API, wie `erstelleBildWerkzeug` sie ruft; Tests und der E2E-Server spritzen eine Attrappe ein. */
export type BildApi = (anfrage: BildAnfrage, bis: number) => Promise<BildErgebnis>;

export type BildKonfig = Pick<ServerKonfig, 'openaiSchluessel' | 'bildModell' | 'bildQualitaet' | 'pythonBin'>;

/** Für `GET /api/ki/status`: Ohne Schlüssel blendet die Oberfläche das Erzeugen neuer Bilder aus. */
export const bilderStand = (konfig: Pick<ServerKonfig, 'openaiSchluessel'>) =>
	konfig.openaiSchluessel
		? { verfuegbar: true, grund: null }
		: { verfuegbar: false as boolean, grund: BILDER_AUS as string | null };

export type LaufBilder = BildWerkzeug & {
	/** Der kurze Text des letzten Fehlers der Bild-API in diesem Lauf, für die Fehlerkachel der Schubladen. */
	letzterFehler: () => string | null;
};

/**
 * Die Bildwerkzeuge eines Laufs, oder `null` ohne Schlüssel: Dann bekommt der Lauf keine. `api` ersetzt die echte
 * Bild-API (Tests, E2E).
 */
export const erstelleLaufBilder = async (o: {
	arbeit: string;
	art: BildLaufArt;
	konfig: BildKonfig;
	api?: BildApi | null;
	obergrenze?: number;
	figuren?: { name: string; datei: string }[];
}): Promise<LaufBilder | null> => {
	const { konfig } = o;
	if (!konfig.openaiSchluessel) {
		return null;
	}
	const schluessel = konfig.openaiSchluessel;
	const echt: BildApi = (anfrage, bis) =>
		erzeugeBild(
			anfrage,
			{ schluessel, modell: konfig.bildModell, qualitaet: konfig.bildQualitaet },
			{ zeitMs: BILD_GRENZEN.zeitMs, bis },
		);
	const api = o.api ?? echt;
	let letzter: string | null = null;
	const werkzeug = await erstelleBildWerkzeug({
		arbeit: o.arbeit,
		art: o.art,
		konfig,
		obergrenze: o.obergrenze,
		figuren: o.figuren,
		api: async (anfrage, bis) => {
			try {
				return await api(anfrage, bis);
			} catch (fehler) {
				if (fehler instanceof BildApiFehler) {
					letzter = fehler.art === 'gesperrt' ? BILDER_GESPERRT : fehler.message;
				}
				throw fehler;
			}
		},
	});
	return { ...werkzeug, letzterFehler: () => letzter };
};

/** Ein Bild der Figurenbibliothek: `_assets/…` liegt in den Assets des Skills, sonst in der Ablage. */
export const posenPfad = (materialDir: string, schluessel: string) =>
	schluessel.startsWith(`${ASSETS_SCHLUESSEL}/`)
		? path.join(ASSETS, schluessel.slice(ASSETS_SCHLUESSEL.length + 1))
		: path.join(materialDir, schluessel);

/**
 * Die Grundpose einer Figur als Referenz für `erstelleBildWerkzeug`: nur PNG oder JPEG, denn nur die nimmt die
 * Bild-API. `pfad` ist der Name, unter dem der Lauf sie in `referenzen/` findet; `null` ohne taugliche Datei.
 */
export const grundposeReferenz = async (
	materialDir: string,
	figur: Pick<BibliotheksFigur, 'id' | 'posen'>,
): Promise<{ name: string; datei: string; pfad: string } | null> => {
	const schluessel = figur.posen[0]?.schluessel;
	if (!schluessel || !REFERENZ_NAME.test(figur.id)) {
		return null;
	}
	const datei = posenPfad(materialDir, schluessel);
	const typ = typAus(await readFile(datei).catch(() => Buffer.alloc(0)));
	return typ ? { name: figur.id, datei, pfad: `${REFERENZ_ORDNER}/${figur.id}.${typ}` } : null;
};
