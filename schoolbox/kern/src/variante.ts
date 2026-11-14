import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

import { schemaVon, setzeAbbildung, werteVon } from './abbildungen';
import { ASSETS } from './konfig';
import { zerlege } from './quelltext';

type Werte = Record<string, string | null>;

interface Kerne {
	neueZahlen: (tag: string, werte: Werte, seed: string) => Werte | null;
}

let geladen: Kerne | null = null;

/** Dieselbe Regel wie im Editor: `abbildungen.js` ohne Browser. Dort stehen die Generatoren genau einmal. */
const kerne = (): Kerne => {
	if (!geladen) {
		const fenster: { schoolboxAbbildungen?: Kerne } = {};
		const dokument = {
			readyState: 'complete',
			querySelectorAll: () => [],
			body: { classList: { contains: () => false } },
		};
		runInNewContext(readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8'), {
			window: fenster,
			document: dokument,
			Element: class {},
		});
		if (!fenster.schoolboxAbbildungen) {
			throw new Error('abbildungen.js stellt keine Rechenkerne bereit.');
		}
		geladen = fenster.schoolboxAbbildungen;
	}
	return geladen;
};

/**
 * Würfelt alle generierbaren Elemente neu: berechenbare Werte über „Neue Zahlen“, Elemente mit `seed` über einen neuen
 * Seed. Nur diese Attribute ändern sich; der Aufbau bleibt. Ein Element, das nicht will, bleibt, wie es ist.
 */
export const wuerfleNeu = (quelle: string, seed: string) => {
	let neu = quelle;
	let geaendert = 0;
	const anzahl = zerlege(quelle).knoten.length;
	for (let nr = 0; nr < anzahl; nr++) {
		const z = zerlege(neu);
		const k = z.knoten[nr];
		const schema = k ? schemaVon(k.tag) : undefined;
		if (k && schema) {
			const zahlen = kerne().neueZahlen(k.tag, werteVon(schema, k, z), `${seed}|${nr}`);
			const mischen = schema.felder.find((f) => f.art === 'mischen');
			const werte: Werte = { ...(mischen ? { [mischen.attribut]: `${seed}-${nr}` } : {}), ...(zahlen ?? {}) };
			if (Object.keys(werte).length > 0) {
				try {
					neu = setzeAbbildung(neu, nr, JSON.parse(JSON.stringify(werte)) as Werte).quelle;
					geaendert++;
				} catch {
					// Ein Element mit Angaben, die das Schema ablehnt, bleibt unverändert.
				}
			}
		}
	}
	return { quelle: neu, geaendert };
};

/**
 * Ob `wuerfleNeu` an dieser Quelle etwas ändern würde: dieselbe Frage, ohne zu würfeln. Die Ablage zeigt „Variante mit
 * neuen Zahlen“ nur dort (188-33).
 */
export const wuerfelbar = (quelle: string) => {
	try {
		const z = zerlege(quelle);
		return z.knoten.some((k, nr) => {
			const schema = schemaVon(k.tag);
			if (!schema) {
				return false;
			}
			if (schema.felder.some((f) => f.art === 'mischen')) {
				return true;
			}
			const zahlen = kerne().neueZahlen(k.tag, werteVon(schema, k, z), `pruefen|${nr}`);
			return zahlen !== null && Object.keys(zahlen).length > 0;
		});
	} catch {
		return false;
	}
};

const GEMERKT = new Map<string, { zeit: number; wert: boolean }>();

/** `wuerfelbar` für eine Datei, gemerkt bis zur nächsten Änderung: Die Ablage fragt bei jedem Laden. */
export const istWuerfelbar = async (datei: string) => {
	try {
		const { mtimeMs } = await stat(datei);
		const gemerkt = GEMERKT.get(datei);
		if (gemerkt !== undefined && gemerkt.zeit === mtimeMs) {
			return gemerkt.wert;
		}
		const wert = wuerfelbar(await readFile(datei, 'utf8'));
		GEMERKT.set(datei, { zeit: mtimeMs, wert });
		return wert;
	} catch {
		return false;
	}
};
