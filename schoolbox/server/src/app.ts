import { existsSync } from 'node:fs';
import path from 'node:path';

import type { RequestHandler } from 'express';
import express, { static as statisch } from 'express';

import { ANMELDE_SEITE, anmeldeRouter, verlangeSitzung } from './anmeldung';
import { ansichtRouter } from './ansicht';
import { apiRouter } from './api';
import { fehlerBehandlung } from './fehler';
import { teilenRouter } from './freigaben';
import type { Kontext } from './kontext';

export const WEB_DIST = path.resolve(__dirname, '..', '..', 'web', 'dist');

const sicherheitsKoepfe: RequestHandler = (_req, res, next) => {
	res.set({
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'SAMEORIGIN',
		'Referrer-Policy': 'same-origin',
		'X-Robots-Tag': 'noindex, nofollow',
	});
	next();
};

/** Die Oberfläche (index.html); den Rest erledigt der Router im Browser. `status` z. B. 410 für widerrufene Links. */
const seite =
	(webDist: string) =>
	(status: number): RequestHandler =>
	(_req, res) => {
		const index = path.join(webDist, 'index.html');
		if (!existsSync(index)) {
			res.status(503).type('text/plain').send('Die Oberfläche ist noch nicht gebaut („pnpm build“).');
			return;
		}
		res.status(status).set('Cache-Control', 'no-cache').sendFile(index);
	};

export const erstelleApp = (kontext: Kontext, webDist = WEB_DIST) => {
	const sendeSeite = seite(webDist);
	const app = express();
	app.disable('x-powered-by');
	app.set('trust proxy', 'loopback');
	app.use(sicherheitsKoepfe);

	// Ohne Anmeldung erreichbar
	app.get('/healthz', (_req, res) => {
		res.set('Cache-Control', 'no-store').json({ status: 'ok', version: kontext.version });
	});
	app.get('/robots.txt', (_req, res) => {
		res.type('text/plain').send('User-agent: *\nDisallow: /\n');
	});
	app.use('/f/:token', teilenRouter(kontext, sendeSeite));
	app.use('/api', anmeldeRouter(kontext));
	app.use(statisch(webDist, { index: false }));
	app.get(ANMELDE_SEITE, sendeSeite(200));

	// Ab hier nur mit Sitzung
	app.use(verlangeSitzung(kontext));
	app.use('/api', apiRouter(kontext));
	app.use('/ansicht', ansichtRouter(kontext));
	app.get('/{*seite}', sendeSeite(200));
	app.use(fehlerBehandlung);
	return app;
};
