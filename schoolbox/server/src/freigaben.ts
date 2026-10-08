import type { Freigabe, Ziel } from '@schoolbox/kern';
import {
	findeFreigabe,
	ID_MUSTER,
	istToken,
	legeFreigabeAn,
	leseFreigaben,
	leseMappe,
	leseMeta,
	widerrufeFreigabe,
	zielGibtEs,
} from '@schoolbox/kern';
import type { Request, RequestHandler } from 'express';
import { Router } from 'express';

import { ansichtRouter } from './ansicht';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { FREIGABEN_SPERRE } from './kontext';

const ID_REGEX = new RegExp(ID_MUSTER);
const SICHERE_METHODEN = new Set(['GET', 'HEAD']);
/** Was ein Teilen-Link im Dokumentordner nie sieht: alte Stände, Entwürfe, Verwaltungsdaten. */
const GESPERRT_IM_DOKUMENT = new Set(['versionen', 'entwuerfe', 'meta.json']);
export const GILT_NICHT_MEHR = 'Dieser Link gilt nicht mehr.';

export const freigabePfad = (token: string) => `/f/${token}`;

const mitLink = (kontext: Kontext, freigabe: Freigabe) => ({
	...freigabe,
	pfad: freigabePfad(freigabe.token),
	url: kontext.konfig.schoolboxUrl ? `${kontext.konfig.schoolboxUrl}${freigabePfad(freigabe.token)}` : null,
});

const leseZiel = (body: unknown): Ziel => {
	const { dok, mappe } = (body ?? {}) as { dok?: unknown; mappe?: unknown };
	if (typeof mappe !== 'string' || !ID_REGEX.test(mappe)) {
		throw new HttpFehler(400, '„mappe“ fehlt oder ist ungültig.');
	}
	if (dok !== undefined && dok !== null && (typeof dok !== 'string' || !ID_REGEX.test(dok))) {
		throw new HttpFehler(400, '„dok“ ist ungültig.');
	}
	return { mappe, dok: dok ?? null };
};

const text = (wert: unknown) => (typeof wert === 'string' && wert ? wert : undefined);

/** Verwaltung der Teilen-Links für die angemeldete Lehrkraft (unter `/api/freigaben`). */
export const freigabenApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();

	router.get('/', async (req, res) => {
		const mappe = text(req.query.mappe);
		const dok = text(req.query.dok);
		const freigaben = (await leseFreigaben(materialDir))
			.filter((f) => mappe === undefined || f.ziel.mappe === mappe)
			.filter((f) => dok === undefined || f.ziel.dok === dok)
			.map((f) => mitLink(kontext, f));
		res.json({ freigaben });
	});

	router.post('/', async (req, res) => {
		const ziel = leseZiel(req.body);
		const freigabe = await kontext.sperre(FREIGABEN_SPERRE, () => legeFreigabeAn(materialDir, ziel));
		res.status(201).json(mitLink(kontext, freigabe));
	});

	router.post('/:token/widerrufen', async (req, res) => {
		const { token } = req.params;
		const freigabe = istToken(token)
			? await kontext.sperre(FREIGABEN_SPERRE, () => widerrufeFreigabe(materialDir, token))
			: null;
		if (!freigabe) {
			throw new HttpFehler(404, 'Diesen Link gibt es nicht.');
		}
		res.json(mitLink(kontext, freigabe));
	});

	return router;
};

const freigaben = new WeakMap<Request, Freigabe>();

const freigabeVon = (req: Request): Freigabe => {
	const freigabe = freigaben.get(req);
	if (!freigabe) {
		throw new HttpFehler(500, 'Freigabe fehlt.');
	}
	return freigabe;
};

/** Dokumente, die ein Teilen-Link zeigt: das eine Dokument oder alle Dokumente der Mappe (Reihenfolge der Mappe). */
const erlaubteDokumente = async (materialDir: string, { dok, mappe }: Ziel) => {
	if (dok !== null) {
		return [dok];
	}
	return (await leseMappe(materialDir, mappe)).dokumente;
};

const zerlegePfad = (pfad: string): string[] => {
	const teile = pfad.slice(1).split('/');
	if (teile.length > 1 && teile.at(-1) === '') {
		teile.pop();
	}
	try {
		return teile.map((t) => decodeURIComponent(t));
	} catch {
		throw new HttpFehler(400, 'Ungültiger Pfad.');
	}
};

/**
 * Erlaubt in der Darstellung nur das freigegebene Ziel: die Dokumentordner (ohne Versionen, Entwürfe, meta.json),
 * die Bilder der Mappe (`../../bilder/` aus dem Dokument) und `_assets/`. Alles andere ist 404, als gäbe es es nicht.
 */
const ansichtWaechter =
	(materialDir: string): RequestHandler =>
	async (req, _res, next) => {
		const { ziel } = freigabeVon(req);
		const [mappe, ordner, dok, erster] = zerlegePfad(req.path);
		if (mappe === '_assets') {
			next();
			return;
		}
		const inMappe = mappe === ziel.mappe;
		const erlaubt =
			inMappe &&
			(ordner === 'bilder' ||
				(ordner === 'dokumente' &&
					dok !== undefined &&
					(await erlaubteDokumente(materialDir, ziel)).includes(dok) &&
					(erster === undefined || !GESPERRT_IM_DOKUMENT.has(erster))));
		next(erlaubt ? undefined : new HttpFehler(404, 'Nicht gefunden.'));
	};

/**
 * Teilen-Links unter `/f/:token`: Seiten (Ansicht, Präsentation), eine nur lesende API und die Darstellung, beides
 * beschränkt auf das freigegebene Ziel. Schreiben geht hier nie.
 */
export const teilenRouter = (kontext: Kontext, sendeSeite: (status: number) => RequestHandler) => {
	const { materialDir } = kontext.konfig;
	const router = Router({ mergeParams: true });

	router.use(async (req, res, next) => {
		res.set('Cache-Control', 'no-store');
		if (!SICHERE_METHODEN.has(req.method)) {
			throw new HttpFehler(403, 'Über einen geteilten Link lässt sich nichts ändern.');
		}
		const { token = '' } = req.params as { token?: string };
		const freigabe = await findeFreigabe(materialDir, token);
		const gueltig = freigabe !== null && freigabe.widerrufen === null && zielGibtEs(materialDir, freigabe.ziel);
		if (gueltig) {
			freigaben.set(req, freigabe);
			next();
			return;
		}
		const status = freigabe === null ? 404 : 410;
		if (/^\/(api|ansicht)(\/|$)/.test(req.path)) {
			throw new HttpFehler(status, GILT_NICHT_MEHR);
		}
		sendeSeite(status)(req, res, next);
	});

	router.get('/api/inhalt', async (req, res) => {
		const { ziel } = freigabeVon(req);
		const ids = await erlaubteDokumente(materialDir, ziel);
		const mappe = await leseMappe(materialDir, ziel.mappe);
		const dokumente = await Promise.all(
			ids.map(async (id) => ({ id, meta: await leseMeta(materialDir, mappe.id, id) })),
		);
		res.json({ ziel, mappe: { ...mappe, dokumente: ids }, dokumente });
	});

	router.use('/api', () => {
		throw new HttpFehler(404, 'Nicht gefunden.');
	});

	router.use('/ansicht', ansichtWaechter(materialDir), ansichtRouter(kontext));

	router.get('/{*seite}', sendeSeite(200));

	return router;
};
