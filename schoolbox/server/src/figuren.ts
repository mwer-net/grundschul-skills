import { benenneFigur, entfernePose, leseBibliothek, setzeEntferntesEin } from '@schoolbox/kern';
import { Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';

/** Figurenbibliothek (177): Willi, Wilma und die Figuren aus `materialien/_figuren/`, je mit ihren Posen. */
export const figurenApi = (kontext: Kontext) => {
	const { konfig } = kontext;
	const router = Router();

	router.get('/', async (_req, res) => {
		res.json({ figuren: await leseBibliothek(konfig, konfig.materialDir) });
	});

	/**
	 * Streicht eine Pose, die Grundpose mit ihrer Figur (176). Die Dateien bleiben liegen. `rueckweg` geht für
	 * Rückgängig (199-03) unverändert an `/wiederherstellen`.
	 */
	router.post('/posen/:pose/entfernen', async (req, res) => {
		const rueckweg = await entfernePose(konfig, konfig.materialDir, req.params.pose);
		if (!rueckweg) {
			throw new HttpFehler(404, 'Diese Pose gibt es nicht.');
		}
		res.json({ ok: true, rueckweg });
	});

	router.post('/wiederherstellen', async (req, res) => {
		const rueckweg = (req.body as { rueckweg?: unknown } | undefined)?.rueckweg;
		if (!(await setzeEntferntesEin(konfig, konfig.materialDir, rueckweg))) {
			throw new HttpFehler(409, 'Die Figur ließ sich nicht wiederherstellen.');
		}
		res.json({ ok: true });
	});

	/** 199: neuer Name einer Figur der Bibliothek. */
	router.post('/:figur/umbenennen', async (req, res) => {
		const name = (req.body as { name?: unknown } | undefined)?.name;
		if (typeof name !== 'string') {
			throw new HttpFehler(400, '„name“ fehlt.');
		}
		if (!(await benenneFigur(konfig, konfig.materialDir, req.params.figur, name))) {
			throw new HttpFehler(404, 'Diese Figur gibt es nicht.');
		}
		res.json({ ok: true });
	});

	return router;
};
