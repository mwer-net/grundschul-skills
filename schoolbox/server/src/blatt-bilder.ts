/**
 * Neue KI-Bilder für ein einzelnes Blatt (seit 237 über die Bild-API). Claude trägt den Bildvertrag in `bilder.json`
 * ein, das Werkzeug `bild_erzeugen` legt das Bild in den Arbeitsordner, wo Claude es ansieht. In die Mappe kommt nur,
 * was das Blatt nennt, mit seiner Herkunft: Ein verworfenes Bild bleibt im Arbeitsordner und verschwindet mit ihm.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { uebernimmBilder, wendeBilderAn } from '@schoolbox/kern';

import { uebertrageHerkunft } from './bild-herkunft';

const BILD_IM_BLATT = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;

interface Uebernommen {
	hash: string;
	ziel: string;
	/** Diese Datei in der Mappe hat der Lauf angelegt; nur dann darf er sie wieder entfernen. */
	angelegt: boolean;
}

export const erstelleBlattBilder = (arbeit: string, mappeDir: string) => {
	const stand = new Map<string, Uebernommen>();

	const uebernimm = async (bild: string) => {
		const hash = createHash('sha256')
			.update(await readFile(path.join(arbeit, bild)))
			.digest('hex');
		const alt = stand.get(bild);
		if (alt?.hash === hash) {
			return alt.ziel;
		}
		// Ein repariertes Bild ersetzt seine erste Fassung, statt neben ihr in der Mappe liegen zu bleiben.
		if (alt?.angelegt) {
			await rm(path.join(mappeDir, alt.ziel), { force: true });
		}
		const gabEs = existsSync(path.join(mappeDir, bild));
		// Ein vergebener Name mit anderem Inhalt gehört einem anderen Material der Mappe: Das neue Bild heißt dann anders.
		const ziel = (await uebernimmBilder(arbeit, mappeDir, [bild]))[bild] ?? bild;
		stand.set(bild, { hash, ziel, angelegt: !gabEs || ziel !== bild });
		await uebertrageHerkunft(path.join(arbeit, 'bilder'), path.join(mappeDir, 'bilder'), {
			[path.basename(bild)]: path.basename(ziel),
		});
		return ziel;
	};

	return {
		/** Legt die neuen Bilder, die das Blatt nennt, in die Mappe und setzt dort vergebene Namen im Blatt um. */
		einsetzen: async (html: string) => {
			const bilder = [...new Set([...html.matchAll(BILD_IM_BLATT)].map((t) => `bilder/${t[1]}`))].filter((b) =>
				existsSync(path.join(arbeit, b)),
			);
			const umbenannt: Record<string, string> = {};
			for (const bild of bilder) {
				const ziel = await uebernimm(bild);
				if (ziel !== bild) {
					umbenannt[bild] = ziel;
				}
			}
			return wendeBilderAn(html, umbenannt);
		},
	};
};

export type BlattBilder = ReturnType<typeof erstelleBlattBilder>;
