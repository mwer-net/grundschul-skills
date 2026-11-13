/**
 * Neue Bilder aus Canva für ein einzelnes Blatt. Claude trägt sie in `bilder.json` ein wie bei der Einheit
 * (`canva-bild.ts`); geladen wird in den Arbeitsordner, wo Claude sie ansieht. In die Mappe kommt nur, was das Blatt
 * nennt: Ein verworfenes Bild bleibt im Arbeitsordner und verschwindet mit ihm.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { uebernimmBilder, wendeBilderAn } from '@schoolbox/kern';

import { erstelleBildLader, notiereCanvaId } from './canva-bild';

const BILD_IM_BLATT = /\.\.\/\.\.\/bilder\/([a-z0-9][a-z0-9-]{0,59}\.(?:png|jpg))/g;
const TAKT_MS = 2000;

type Laden = Parameters<typeof erstelleBildLader>[2];

interface Uebernommen {
	hash: string;
	ziel: string;
	/** Diese Datei in der Mappe hat der Lauf angelegt; nur dann darf er sie wieder entfernen. */
	angelegt: boolean;
}

export const erstelleBlattBilder = (arbeit: string, mappeDir: string, laden?: Laden) => {
	const lader = erstelleBildLader(arbeit, path.join(arbeit, 'bilder'), laden);
	// Export-URLs laufen ab, und Claude sieht sich das Bild gleich nach dem Eintrag an.
	const takt = setInterval(() => void lader.pruefe(), TAKT_MS);
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
		const wunsch = lader.wunsch(path.basename(bild));
		if (wunsch) {
			await notiereCanvaId(path.join(mappeDir, 'bilder'), { ...wunsch, datei: path.basename(ziel) });
		}
		return ziel;
	};

	return {
		/** Legt die neuen Bilder, die das Blatt nennt, in die Mappe und setzt dort vergebene Namen im Blatt um. */
		einsetzen: async (html: string) => {
			await lader.pruefe();
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
		ende: () => clearInterval(takt),
	};
};

export type BlattBilder = ReturnType<typeof erstelleBlattBilder>;
