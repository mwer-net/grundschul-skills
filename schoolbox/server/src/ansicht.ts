import { existsSync, realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { ASSETS, darstellungsHtml, ID_MUSTER, mappenDir, sucheRessource } from '@schoolbox/kern';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { leseQuelle, verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { pruefeIdParam } from './schutz';

const ID_REGEX = new RegExp(ID_MUSTER);
const ASSETS_PFAD = '_assets';
const CSS_URL = /url\((?!data:)([^)]+)\)/g;

const nichtGefunden = () => new HttpFehler(404, 'Nicht gefunden.');

/**
 * Pfadteile aus der URL. Browser lösen `.` und `..` selbst auf, echte Seiten schicken sie also nie. Express
 * dekodiert `%2f` innerhalb eines Teils zu `/`; auch das ist ein Angriff, kein Dateiname.
 */
const pruefeTeile = (teile: unknown): string[] => {
	const liste = Array.isArray(teile) ? teile.filter((t): t is string => typeof t === 'string') : [];
	const ungueltig = (t: string) => !t || t.startsWith('.') || /[/\\\0]/.test(t);
	if (liste.length === 0 || liste.some(ungueltig)) {
		throw new HttpFehler(400, 'Ungültiger Pfad.');
	}
	return liste;
};

const liegtIn = (datei: string, ordner: string) => {
	const relativ = path.relative(ordner, datei);
	return relativ !== '' && !relativ.startsWith('..') && !path.isAbsolute(relativ);
};

/** Erlaubt ist nur, was nach dem Auflösen aller Symlinks in der Mappe oder in assets/ liegt. */
const pruefeGrenzen = async (datei: string | null, mappeDir: string | null): Promise<string> => {
	const grenzen = [realpathSync(ASSETS), ...(mappeDir ? [realpathSync(mappeDir)] : [])];
	if (datei === null || !grenzen.some((g) => liegtIn(datei, g))) {
		throw nichtGefunden();
	}
	const info = await stat(datei).catch(() => null);
	if (!info?.isFile()) {
		throw nichtGefunden();
	}
	return datei;
};

const urlPfad = (teile: string[]) => teile.map(encodeURIComponent).join('/');

/**
 * Wie blatt.py: `url()` in CSS gilt relativ zum Ordner der CSS-Datei, nicht zur Adresse im Browser. Darum werden
 * die Verweise auf die tatsächlich gefundene Datei umgeschrieben, relativ zur Adresse der CSS-Datei.
 */
const schreibeCssUm = (css: string, cssDatei: string, req: Request, mappe: string | null, mappeDir: string | null) => {
	const cssUrl = `${req.baseUrl}${req.path}`;
	const assets = realpathSync(ASSETS);
	const mappeEcht = mappeDir ? realpathSync(mappeDir) : null;
	return css.replace(CSS_URL, (ganz, roh: string) => {
		const datei = sucheRessource(roh.trim().replace(/^["']|["']$/g, ''), path.dirname(cssDatei));
		if (datei === null) {
			return ganz;
		}
		let ziel: string | null = null;
		if (liegtIn(datei, assets)) {
			ziel = `${req.baseUrl}/${ASSETS_PFAD}/${urlPfad(path.relative(assets, datei).split(path.sep))}`;
		} else if (mappe && mappeEcht && liegtIn(datei, mappeEcht)) {
			ziel = `${req.baseUrl}/${mappe}/${urlPfad(path.relative(mappeEcht, datei).split(path.sep))}`;
		}
		return ziel === null ? ganz : `url("${path.posix.relative(path.posix.dirname(cssUrl), ziel)}")`;
	});
};

const sendeDatei = async (
	req: Request,
	res: Response,
	datei: string,
	mappe: string | null,
	mappeDir: string | null,
) => {
	res.set('Cache-Control', 'no-cache');
	if (path.extname(datei).toLowerCase() === '.css') {
		const css = await readFile(datei, 'utf8');
		res.type('text/css').send(schreibeCssUm(css, datei, req, mappe, mappeDir));
		return;
	}
	await new Promise<void>((resolve, reject) => {
		res.sendFile(datei, { dotfiles: 'allow', cacheControl: false }, (fehler) => {
			if (fehler) {
				reject(fehler);
			} else {
				resolve();
			}
		});
	});
};

/**
 * Darstellung von material.html und seinen Ressourcen. Die Adresse spiegelt die Ablage
 * (`/ansicht/<mappe>/dokumente/<dok>/`), damit `../../bilder/x.png` wie in blatt.py die Bilder der Mappe trifft.
 */
export const ansichtRouter = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router({ strict: true });
	router.param('mappe', pruefeIdParam('Mappe'));
	router.param('dok', pruefeIdParam('Dokument'));

	router.get(`/${ASSETS_PFAD}/*teile`, async (req, res) => {
		const teile = pruefeTeile(req.params.teile);
		const datei = existsSync(path.join(ASSETS, ...teile)) ? realpathSync(path.join(ASSETS, ...teile)) : null;
		await sendeDatei(req, res, await pruefeGrenzen(datei, null), null, null);
	});

	router.get('/:mappe/dokumente/:dok', (req, res) => {
		const [pfad, query] = req.originalUrl.split('?', 2);
		res.redirect(301, `${pfad}/${query === undefined ? '' : `?${query}`}`);
	});

	router.get('/:mappe/dokumente/:dok/', async (req, res) => {
		const dir = verlangeDokument(kontext, req.params.mappe, req.params.dok);
		const html = darstellungsHtml(await leseQuelle(dir), { loesung: req.query.loesung === '1' });
		res.set('Cache-Control', 'no-store').type('html').send(html);
	});

	router.get('/:mappe/*teile', async (req, res) => {
		const { mappe } = req.params;
		const mappeDir = mappenDir(materialDir, mappe);
		if (!existsSync(path.join(mappeDir, 'mappe.json'))) {
			throw nichtGefunden();
		}
		const teile = pruefeTeile(req.params.teile);
		const [ordner, dok, ...rest] = teile;
		let datei: string | null;
		if (ordner === 'dokumente' && dok !== undefined && ID_REGEX.test(dok) && rest.length > 0) {
			datei = sucheRessource(rest.join('/'), path.join(mappeDir, 'dokumente', dok));
		} else {
			const kandidat = path.join(mappeDir, ...teile);
			datei = existsSync(kandidat) ? realpathSync(kandidat) : null;
		}
		await sendeDatei(req, res, await pruefeGrenzen(datei, mappeDir), mappe, mappeDir);
	});

	router.use(() => {
		throw nichtGefunden();
	});
	return router;
};
