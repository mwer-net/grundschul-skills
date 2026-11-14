import type { FSWatcher } from 'node:fs';
import { existsSync, watch } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { ID_MUSTER, istTempDatei } from '@schoolbox/kern';

import { nimmFremdeAenderungAuf } from './dokumente';
import type { DokumentGeaendert } from './ereignisse';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';

export const RUHE_MS = 2000;
const ID_REGEX = new RegExp(ID_MUSTER);
const DOKUMENT_DATEIEN = new Set(['material.html', 'meta.json']);

export interface Ueberwachung {
	stop: () => void;
}

const istMappe = (materialDir: string, mappe: string) => existsSync(path.join(materialDir, mappe, 'mappe.json'));

/**
 * Beobachtet die Ablage. Ändert sich material.html, ohne dass der Server selbst geschrieben hat, war es Claude:
 * Nach `ruheMs` ohne weitere Änderung entsteht eine Version mit Urheber `claude`, und `dokument-geaendert` geht
 * an alle Browser. Neue Mappen melden `mappe-neu`, verschwundene (Papierkorb) `mappe-entfernt`.
 */
export const starteUeberwachung = async (kontext: Kontext, ruheMs = RUHE_MS): Promise<Ueberwachung> => {
	const { materialDir } = kontext.konfig;
	const timer = new Map<string, ReturnType<typeof setTimeout>>();
	const bekannteMappen = new Set(
		(await readdir(materialDir)).filter((n) => ID_REGEX.test(n) && istMappe(materialDir, n)),
	);

	const plane = (schluessel: string, arbeit: () => Promise<void> | void) => {
		clearTimeout(timer.get(schluessel));
		const neu = setTimeout(() => {
			timer.delete(schluessel);
			Promise.resolve()
				.then(arbeit)
				.catch((fehler: unknown) => console.error(`Überwachung (${schluessel}):`, fehler));
		}, ruheMs);
		timer.set(schluessel, neu);
	};

	const pruefeDokument = (mappe: string, dok: string) =>
		kontext.sperre(dokSchluessel(mappe, dok), async () => {
			const dir = path.join(materialDir, mappe, 'dokumente', dok);
			if (!existsSync(path.join(dir, 'material.html')) || !existsSync(path.join(dir, 'meta.json'))) {
				return;
			}
			const { jetzt, quelleNeu, vorher } = await nimmFremdeAenderungAuf(kontext, mappe, dok);
			if (quelleNeu || vorher?.meta !== jetzt.meta) {
				const daten: DokumentGeaendert = {
					mappe,
					dok,
					version: jetzt.quelle,
					urheber: quelleNeu ? 'claude' : null,
				};
				kontext.ereignisse.sende({ typ: 'dokument-geaendert', daten });
			}
		});

	const pruefeMappe = (mappe: string) => {
		if (!istMappe(materialDir, mappe)) {
			if (bekannteMappen.delete(mappe)) {
				kontext.ereignisse.sende({ typ: 'mappe-entfernt', daten: { mappe } });
			}
		} else if (!bekannteMappen.has(mappe)) {
			bekannteMappen.add(mappe);
			kontext.ereignisse.sende({ typ: 'mappe-neu', daten: { mappe } });
		}
	};

	const meldeDokument = (mappe: string, dok: string) =>
		plane(`dok:${mappe}/${dok}`, () => pruefeDokument(mappe, dok));

	/**
	 * 193-01: Der Server ersetzt material.html atomar (temporäre Datei und `rename`). Danach verliert der rekursive
	 * Beobachter unter Linux diese Datei. Ein eigener, nicht rekursiver Beobachter je Dokumentordner sieht beides.
	 */
	const dokumentBeobachter = new Map<string, FSWatcher>();
	const beobachteDokument = (mappe: string, dok: string) => {
		const schluessel = `${mappe}/${dok}`;
		const dir = path.join(materialDir, mappe, 'dokumente', dok);
		if (dokumentBeobachter.has(schluessel) || !existsSync(dir)) {
			return;
		}
		try {
			const w = watch(dir, (_typ, name) => {
				if (name && DOKUMENT_DATEIEN.has(name.toString())) {
					meldeDokument(mappe, dok);
				}
			});
			const weg = () => {
				w.close();
				dokumentBeobachter.delete(schluessel);
			};
			w.on('error', weg);
			dokumentBeobachter.set(schluessel, w);
		} catch {
			// Der Ordner ist zwischen Prüfen und Beobachten verschwunden.
		}
	};
	const beobachteMappe = async (mappe: string) => {
		const dokumente = await readdir(path.join(materialDir, mappe, 'dokumente')).catch(() => []);
		for (const dok of dokumente) {
			if (ID_REGEX.test(dok)) {
				beobachteDokument(mappe, dok);
			}
		}
	};
	for (const mappe of bekannteMappen) {
		await beobachteMappe(mappe);
	}

	const beobachter = watch(materialDir, { recursive: true }, (_typ, name) => {
		const teile = name?.split(path.sep) ?? [];
		const [mappe, ordner, dok, datei] = teile;
		if (mappe === undefined || !ID_REGEX.test(mappe) || istTempDatei(teile.at(-1) ?? '')) {
			return;
		}
		if (teile.length <= 2 && (ordner === undefined || ordner === 'mappe.json')) {
			plane(`mappe:${mappe}`, () => pruefeMappe(mappe));
		}
		if (ordner === 'dokumente' && dok !== undefined && ID_REGEX.test(dok)) {
			beobachteDokument(mappe, dok);
			if (teile.length === 4 && DOKUMENT_DATEIEN.has(datei ?? '')) {
				meldeDokument(mappe, dok);
			}
		} else if (teile.length === 1 || (teile.length === 2 && ordner === 'dokumente')) {
			// Neue Mappe oder neuer Ordner „dokumente“, etwa per rename: Die Dokumente darin gleich mit beobachten.
			void beobachteMappe(mappe);
		}
	});
	beobachter.on('error', (fehler) => console.error('Überwachung der Ablage:', fehler));

	return {
		stop: () => {
			beobachter.close();
			for (const w of dokumentBeobachter.values()) {
				w.close();
			}
			dokumentBeobachter.clear();
			for (const t of timer.values()) {
				clearTimeout(t);
			}
			timer.clear();
		},
	};
};
