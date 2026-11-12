// >> 176
import { entfernePose, leseBibliothek } from '@schoolbox/kern';
// << 176
import { Router } from 'express';

// >> 176
import { HttpFehler } from './fehler';
// << 176
import type { Kontext } from './kontext';

/** Figurenbibliothek (177): Willi, Wilma und die Figuren aus `materialien/_figuren/`, je mit ihren Posen. */
export const figurenApi = (kontext: Kontext) => {
	const { konfig } = kontext;
	const router = Router();

	router.get('/', async (_req, res) => {
		res.json({ figuren: await leseBibliothek(konfig, konfig.materialDir) });
	});

	// >> 176
	/** Streicht eine Pose, die Grundpose mit ihrer Figur (176). Die Dateien bleiben liegen. */
	router.post('/posen/:pose/entfernen', async (req, res) => {
		if (!(await entfernePose(konfig, konfig.materialDir, req.params.pose))) {
			throw new HttpFehler(404, 'Diese Pose gibt es nicht.');
		}
		res.json({ ok: true });
	});
	// << 176

	return router;
};
