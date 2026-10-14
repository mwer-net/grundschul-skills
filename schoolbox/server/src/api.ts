import { readFile } from 'node:fs/promises';

import { leseMeta, listeVersionen, versionsPfad } from '@schoolbox/kern';
import type { RequestHandler } from 'express';
import { json, Router } from 'express';

import { istAusgabeVeraltet, leseQuelle, schreibeQuelle, verlangeDokument } from './dokumente';
import type { Ereignis } from './ereignisse';
import { HttpFehler } from './fehler';
import { freigabenApi } from './freigaben';
import type { Kontext } from './kontext';
import { dokSchluessel, kennung } from './kontext';
import { mappenApi } from './mappen';
import { papierkorbApi } from './papierkorb';
import { pdfAntwort, sendePdf, waehlePdfVariante } from './pdf';
import { csrfSchutz, pruefeIdParam } from './schutz';

export const MAX_JSON = '5mb';
const PULS_MS = 25_000;
const KENNUNG_REGEX = /^[0-9a-f]{16}$/;

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

	router.use('/mappen', mappenApi(kontext));
	router.use('/papierkorb', papierkorbApi(kontext));

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

	router.post('/dokumente/:mappe/:dok/pdf', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		const variante = waehlePdfVariante((req.body as { variante?: unknown } | undefined)?.variante);
		const pdf = await kontext.pdf.dokument(mappe, dok, variante);
		res.json(pdfAntwort(`/api/dokumente/${mappe}/${dok}/pdf/${variante}`, pdf));
	});

	router.get('/dokumente/:mappe/:dok/pdf/:variante{/:datei}', async (req, res) => {
		const { dok, mappe, variante } = req.params;
		verlangeDokument(kontext, mappe, dok);
		await sendePdf(req, res, await kontext.pdf.dokument(mappe, dok, waehlePdfVariante(variante)));
	});

	router.get('/ereignisse', ereignisStrom(kontext));

	router.use('/freigaben', freigabenApi(kontext));

	router.use((req) => {
		throw new HttpFehler(404, `Unbekannte Adresse: ${req.method} ${req.originalUrl}`);
	});
	return router;
};
