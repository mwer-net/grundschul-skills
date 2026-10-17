import { MAX_BILD_BYTES, nimmBildAuf, sammleBilder, uebernimmBild, wandleInGraustufen } from '@schoolbox/kern';
import type { NextFunction, Request, Response } from 'express';
import { raw, Router } from 'express';

import { verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';

/** Kopf mit dem Dateinamen des Uploads, URI-kodiert (Umlaute). */
export const DATEINAME_HEADER = 'x-dateiname';

const leseText = (body: unknown, feld: string) => {
	const wert = (body as Record<string, unknown> | undefined)?.[feld];
	if (typeof wert !== 'string' || !wert.trim()) {
		throw new HttpFehler(400, `„${feld}“ fehlt.`);
	}
	return wert;
};

const dateiname = (req: Request) => {
	try {
		return decodeURIComponent(req.get(DATEINAME_HEADER) ?? '');
	} catch {
		return '';
	}
};

const bildRoh = raw({ type: 'application/octet-stream', limit: MAX_BILD_BYTES });

/** Wie Apache: mehr als 25 MB nimmt schon der Body-Parser nicht an; die Meldung soll trotzdem verständlich sein. */
const nimmRohAn = (req: Request, res: Response, next: NextFunction) => {
	bildRoh(req, res, (fehler?: unknown) => {
		const status = (fehler as { status?: unknown } | undefined)?.status;
		next(status === 413 ? new HttpFehler(413, 'Das Bild ist zu groß (höchstens 25 MB).') : fehler);
	});
};

/**
 * Bilder eines Dokuments: Sammlung zum Aussuchen, Upload, Übernehmen aus der Sammlung, Graustufen. Alle schreibenden
 * Wege legen nur neue Dateien in `bilder/` an; material.html ändert erst der Editor mit dem neuen `src`.
 */
export const bilderApi = (kontext: Kontext) => {
	const { konfig } = kontext;
	const router = Router({ mergeParams: true });
	const ziel = (req: Request) => {
		const { dok, mappe } = req.params as { mappe: string; dok: string };
		return { mappe, dok, dir: verlangeDokument(kontext, mappe, dok) };
	};

	router.get('/', async (req, res) => {
		const { mappe } = ziel(req);
		res.json(await sammleBilder(konfig.materialDir, mappe));
	});

	router.post('/', nimmRohAn, async (req, res) => {
		const { dir, dok, mappe } = ziel(req);
		if (!Buffer.isBuffer(req.body)) {
			throw new HttpFehler(400, 'Bitte das Bild als application/octet-stream schicken.');
		}
		const daten = req.body;
		const bild = await kontext.sperre(dokSchluessel(mappe, dok), () =>
			nimmBildAuf(konfig, dir, daten, dateiname(req)),
		);
		res.json(bild);
	});

	router.post('/uebernehmen', async (req, res) => {
		const { dok, mappe } = ziel(req);
		const schluessel = leseText(req.body, 'schluessel');
		res.json(
			await kontext.sperre(dokSchluessel(mappe, dok), () =>
				uebernimmBild(konfig.materialDir, mappe, dok, schluessel),
			),
		);
	});

	router.post('/graustufen', async (req, res) => {
		const { dok, mappe } = ziel(req);
		const src = leseText(req.body, 'src');
		res.json(await kontext.sperre(dokSchluessel(mappe, dok), () => wandleInGraustufen(konfig, mappe, dok, src)));
	});

	return router;
};
