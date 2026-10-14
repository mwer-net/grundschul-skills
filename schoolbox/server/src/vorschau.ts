import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { dokumentDir, VORSCHAU_DATEI } from '@schoolbox/kern';

import type { Begrenzung } from './begrenzung';
import type { Ereignisse } from './ereignisse';
import type { Sperre } from './sperre';

/** Baut die Vorschau eines Dokumentordners nach `ausgabe/`. Im Betrieb ist das blatt.py, im Test ein Ersatz. */
export type VorschauBauer = (dokDir: string) => Promise<unknown>;

export interface Vorschau {
	/**
	 * Kennung der vorhandenen Vorschau für die Adresse des Bildes, `null` solange es keine gibt. Mit `bauen` stößt
	 * der Aufruf den Bau an, wenn die Vorschau fehlt oder älter ist als material.html.
	 */
	stand: (mappe: string, dok: string, bauen: boolean) => Promise<string | null>;
}

interface Abhaengigkeiten {
	materialDir: string;
	ereignisse: Ereignisse;
	sperre: Sperre;
	begrenzung: Begrenzung;
	bauer: VorschauBauer | null;
}

/**
 * Vorschauen eine nach der anderen, und zusammen mit den PDF-Bauten in der gemeinsamen Grenze: So wartet ein PDF,
 * auf das die Lehrkraft wartet, höchstens auf eine einzige Vorschau.
 */
const VORSCHAU_SPERRE = '_vorschau';

export const erstelleVorschau = ({ bauer, begrenzung, ereignisse, materialDir, sperre }: Abhaengigkeiten): Vorschau => {
	const laufend = new Set<string>();
	/** Stand von material.html, an dem der Bau gescheitert ist: erst eine neue Fassung bekommt einen neuen Versuch. */
	const gescheitert = new Map<string, number>();

	const baue = (mappe: string, dok: string, dir: string, quelleZeit: number) => {
		const schluessel = `${mappe}/${dok}`;
		if (!bauer || laufend.has(schluessel) || gescheitert.get(schluessel) === quelleZeit) {
			return;
		}
		laufend.add(schluessel);
		void sperre(VORSCHAU_SPERRE, async () => {
			if (!existsSync(path.join(dir, 'material.html'))) {
				return false;
			}
			await begrenzung(() => bauer(dir));
			return true;
		})
			.then(
				(gebaut) => {
					gescheitert.delete(schluessel);
					if (gebaut) {
						ereignisse.sende({ typ: 'vorschau-fertig', daten: { mappe, dok } });
					}
				},
				(fehler: unknown) => {
					// Während des Baus gelöscht: kein Fehler. Nach dem Wiederherstellen gibt es einen neuen Versuch.
					if (!existsSync(path.join(dir, 'material.html'))) {
						return;
					}
					gescheitert.set(schluessel, quelleZeit);
					console.error(`Vorschau für ${schluessel}:`, fehler instanceof Error ? fehler.message : fehler);
				},
			)
			.finally(() => laufend.delete(schluessel));
	};

	return {
		stand: async (mappe, dok, bauen) => {
			const dir = dokumentDir(materialDir, mappe, dok);
			const [quelle, bild] = await Promise.all([
				stat(path.join(dir, 'material.html')).catch(() => null),
				stat(path.join(dir, 'ausgabe', VORSCHAU_DATEI)).catch(() => null),
			]);
			if (bauen && quelle && (!bild || bild.mtimeMs < quelle.mtimeMs)) {
				baue(mappe, dok, dir, quelle.mtimeMs);
			}
			return bild ? Math.round(bild.mtimeMs).toString(36) : null;
		},
	};
};
