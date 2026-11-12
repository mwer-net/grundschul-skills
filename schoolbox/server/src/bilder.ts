import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	CANVA_TEXT_ZEICHEN,
	druckfassung,
	figurenFuerBild,
	leseBibliothek,
	leseBlatt,
	MAX_BILD_BYTES,
	MAX_FIGUREN_JE_BILD,
	nimmBildAuf,
	sammleBilder,
	uebernimmBild,
	WURZEL,
} from '@schoolbox/kern';
import type { NextFunction, Request, Response } from 'express';
import { raw, Router } from 'express';

import { bildAuftragText, legeBildAb } from './bild-beschreiben';
import { leseQuelle, verlangeDokument } from './dokumente';
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
 * Bilder eines Dokuments: Sammlung zum Aussuchen, Upload, Übernehmen aus der Sammlung. Alle schreibenden
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
		res.json(await sammleBilder(konfig, konfig.materialDir, mappe));
	});

	router.get('/fassung', async (req, res) => {
		const { dir } = ziel(req);
		res.json(await druckfassung(konfig, dir, leseText(req.query, 'src')));
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
				uebernimmBild(konfig, konfig.materialDir, mappe, dok, schluessel),
			),
		);
	});

	/** Ein neues Bild über Canva (176). Es landet in `bilder/` der Mappe; material.html ändert sich nicht. */
	router.post('/beschreiben', async (req, res) => {
		const { dir, dok, mappe } = ziel(req);
		const roh = (req.body as { text?: unknown } | undefined)?.text;
		const text = typeof roh === 'string' ? roh.trim() : '';
		if (!text) {
			throw new HttpFehler(400, 'Beschreibe das Bild.');
		}
		if (text.length > CANVA_TEXT_ZEICHEN) {
			throw new HttpFehler(400, `Höchstens ${CANVA_TEXT_ZEICHEN} Zeichen.`);
		}
		const figuren = figurenFuerBild(text, await leseBibliothek(konfig, konfig.materialDir));
		if (figuren.length > MAX_FIGUREN_JE_BILD) {
			throw new HttpFehler(400, 'Höchstens vier Figuren je Bild.');
		}
		const { palette } = leseBlatt(await leseQuelle(dir));
		const vorlage = await readFile(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'bild.md'), 'utf8');
		const stand = kontext.canva.starte(
			{
				art: 'bild',
				text,
				auftrag: `${vorlage.trimEnd()}\n\n${bildAuftragText({ text, figuren, palette })}`,
				ziel: { mappe, dok },
			},
			{ uebernimm: (e) => legeBildAb(konfig.materialDir, mappe, e) },
		);
		res.status(201).json({ id: stand.id });
	});

	return router;
};
