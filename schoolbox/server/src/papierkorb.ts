import {
	entferneFreigabenVon,
	istPapierkorbEintrag,
	leerePapierkorb,
	listePapierkorb,
	PAPIERKORB_TAGE,
	stelleWiederHer,
} from '@schoolbox/kern';
import { Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { FREIGABEN_SPERRE } from './kontext';

const TAG_MS = 24 * 60 * 60 * 1000;

/** Gelöschte Mappen ansehen und zurückholen (unter `/api/papierkorb`). */
export const papierkorbApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();

	router.get('/', async (_req, res) => {
		res.json({ eintraege: await listePapierkorb(materialDir), tage: PAPIERKORB_TAGE });
	});

	router.post('/:eintrag/wiederherstellen', async (req, res) => {
		const { eintrag } = req.params;
		const vorhanden = (await listePapierkorb(materialDir)).some((e) => e.eintrag === eintrag);
		if (!istPapierkorbEintrag(eintrag) || !vorhanden) {
			throw new HttpFehler(404, 'Diese Mappe liegt nicht mehr im Papierkorb.');
		}
		res.json({ eintrag: await stelleWiederHer(materialDir, eintrag) });
	});

	return router;
};

/** Löscht endgültig, was 30 Tage im Papierkorb lag, samt den Teilen-Links dieser Mappen. */
export const raeumePapierkorbAuf = async (kontext: Kontext, jetzt = new Date()): Promise<string[]> => {
	const { materialDir } = kontext.konfig;
	const entfernt = await leerePapierkorb(materialDir, jetzt);
	if (entfernt.length > 0) {
		await kontext.sperre(FREIGABEN_SPERRE, () => entferneFreigabenVon(materialDir, entfernt));
		console.log(`Papierkorb: ${entfernt.length} Mappe(n) nach ${PAPIERKORB_TAGE} Tagen endgültig gelöscht.`);
	}
	return entfernt;
};

export const starteAufraeumen = (kontext: Kontext) => {
	const lauf = () => {
		raeumePapierkorbAuf(kontext).catch((fehler: unknown) => console.error('Papierkorb:', fehler));
	};
	lauf();
	const takt = setInterval(lauf, TAG_MS);
	takt.unref();
	return { stop: () => clearInterval(takt) };
};
