import { leseBibliothek } from '@schoolbox/kern';
import { Router } from 'express';

import type { Kontext } from './kontext';

/** Figurenbibliothek (177): Willi, Wilma und die Figuren aus `materialien/_figuren/`, je mit ihren Posen. */
export const figurenApi = (kontext: Kontext) => {
	const { konfig } = kontext;
	const router = Router();

	router.get('/', async (_req, res) => {
		res.json({ figuren: await leseBibliothek(konfig, konfig.materialDir) });
	});

	return router;
};
