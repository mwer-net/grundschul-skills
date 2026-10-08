import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { MappenFilter } from '@schoolbox/kern';
import {
	FAECHER,
	ID_MUSTER,
	leseMappenEintrag,
	leseMeta,
	listeMappen,
	listeVersionen,
	mappenDir,
	STATUS,
	versionsPfad,
	waehleKlasse,
	waehleWert,
} from '@schoolbox/kern';
import type { RequestHandler, RequestParamHandler } from 'express';
import { json, Router } from 'express';

import { istAusgabeVeraltet, leseQuelle, schreibeQuelle, verlangeDokument } from './dokumente';
import type { Ereignis } from './ereignisse';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { dokSchluessel, kennung } from './kontext';

export const MAX_JSON = '5mb';
export const CSRF_HEADER = 'x-schoolbox';
const PULS_MS = 25_000;
const ID_REGEX = new RegExp(ID_MUSTER);
const KENNUNG_REGEX = /^[0-9a-f]{16}$/;
const SICHERE_METHODEN = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Schreibende Anfragen nur als JSON mit eigenem Header. Ein fremdes Formular kann beides nicht setzen. */
export const csrfSchutz: RequestHandler = (req, _res, next) => {
	if (SICHERE_METHODEN.has(req.method) || (req.is('application/json') && req.get(CSRF_HEADER) === '1')) {
		next();
		return;
	}
	next(new HttpFehler(403, `Schreibende Anfragen brauchen Content-Type application/json und ${CSRF_HEADER}: 1.`));
};

export const pruefeIdParam = (was: string) => {
	const pruefen: RequestParamHandler = (_req, _res, next, wert: string) => {
		next(ID_REGEX.test(wert) ? undefined : new HttpFehler(400, `${was} „${wert}“ ist keine gültige ID.`));
	};
	return pruefen;
};

const text = (wert: unknown) => (typeof wert === 'string' && wert.trim() ? wert : undefined);

const leseFilter = (query: Record<string, unknown>): MappenFilter => {
	const fach = text(query.fach);
	const klasse = text(query.klasse);
	const status = text(query.status);
	return {
		fach: fach === undefined ? undefined : waehleWert('Fach', fach, FAECHER),
		klasse: klasse === undefined ? undefined : waehleKlasse(klasse),
		status: status === undefined ? undefined : waehleWert('Status', status, STATUS),
		suche: text(query.suche),
	};
};

const ereignisStrom =
	(kontext: Kontext): RequestHandler =>
	(req, res) => {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no',
		});
		res.write('retry: 3000\n\n');
		const senden = ({ daten, typ }: Ereignis) => {
			res.write(`event: ${typ}\ndata: ${JSON.stringify(daten)}\n\n`);
		};
		const abmelden = kontext.ereignisse.abonniere(senden);
		const puls = setInterval(() => res.write(': puls\n\n'), PULS_MS);
		req.on('close', () => {
			clearInterval(puls);
			abmelden();
		});
	};

const leseBody = (body: unknown) => {
	const { basisVersion, quelle } = (body ?? {}) as { basisVersion?: unknown; quelle?: unknown };
	if (typeof quelle !== 'string' || !quelle.trim()) {
		throw new HttpFehler(400, '„quelle“ fehlt oder ist leer.');
	}
	if (typeof basisVersion !== 'string' || !KENNUNG_REGEX.test(basisVersion)) {
		throw new HttpFehler(400, '„basisVersion“ fehlt oder ist ungültig.');
	}
	return { basisVersion, quelle };
};

export const apiRouter = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();
	router.use(csrfSchutz);
	router.use(json({ limit: MAX_JSON }));
	router.param('mappe', pruefeIdParam('Mappe'));
	router.param('dok', pruefeIdParam('Dokument'));
	router.param('version', (_req, _res, next, wert: string) => {
		next(/^[0-9TZ_a-z-]+$/.test(wert) ? undefined : new HttpFehler(400, `Version „${wert}“ ist ungültig.`));
	});

	router.get('/mappen', async (req, res) => {
		res.json({ mappen: await listeMappen(materialDir, leseFilter(req.query)) });
	});

	router.get('/mappen/:mappe', async (req, res) => {
		if (!existsSync(path.join(mappenDir(materialDir, req.params.mappe), 'mappe.json'))) {
			throw new HttpFehler(404, `Die Mappe „${req.params.mappe}“ gibt es nicht.`);
		}
		res.json(await leseMappenEintrag(materialDir, req.params.mappe));
	});

	router.get('/dokumente/:mappe/:dok', async (req, res) => {
		const { dok, mappe } = req.params;
		const dir = verlangeDokument(kontext, mappe, dok);
		const [quelle, meta, ausgabeVeraltet] = await Promise.all([
			leseQuelle(dir),
			leseMeta(materialDir, mappe, dok),
			istAusgabeVeraltet(dir),
		]);
		res.json({ quelle, meta, version: kennung(quelle), ausgabeVeraltet });
	});

	router.put('/dokumente/:mappe/:dok', async (req, res) => {
		const { dok, mappe } = req.params;
		const dir = verlangeDokument(kontext, mappe, dok);
		const { basisVersion, quelle } = leseBody(req.body);
		const ergebnis = await kontext.sperre(dokSchluessel(mappe, dok), async () => {
			const aktuell = kennung(await leseQuelle(dir));
			if (aktuell !== basisVersion) {
				throw new HttpFehler(409, 'Das Material wurde inzwischen geändert.', { version: aktuell });
			}
			return schreibeQuelle(kontext, mappe, dok, quelle);
		});
		res.json(ergebnis);
	});

	router.get('/dokumente/:mappe/:dok/versionen', async (req, res) => {
		const dir = verlangeDokument(kontext, req.params.mappe, req.params.dok);
		res.json({ versionen: await listeVersionen(dir) });
	});

	router.post('/dokumente/:mappe/:dok/versionen/:version/wiederherstellen', async (req, res) => {
		const { dok, mappe, version } = req.params;
		const dir = verlangeDokument(kontext, mappe, dok);
		const ergebnis = await kontext.sperre(dokSchluessel(mappe, dok), async () => {
			const gefunden = (await listeVersionen(dir)).find((v) => v.id === version);
			if (!gefunden) {
				throw new HttpFehler(404, `Die Version „${version}“ gibt es nicht.`);
			}
			return schreibeQuelle(kontext, mappe, dok, await readFile(versionsPfad(dir, gefunden), 'utf8'));
		});
		res.json(ergebnis);
	});

	router.get('/ereignisse', ereignisStrom(kontext));

	router.use((req) => {
		throw new HttpFehler(404, `Unbekannte Adresse: ${req.method} ${req.originalUrl}`);
	});
	return router;
};
